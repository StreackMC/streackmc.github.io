/**
 * run.js — 主编排流程
 *
 * 流程：
 *   扫描构建产物 → 名单过滤 → 读取旧数据/增量缓存 → 载入密钥 →
 *   增量规划（可复用 / 待总结）→ 调用 LLM → 合并写出 → 更新增量缓存 → 报告
 */

import { existsSync } from 'node:fs';
import { relative } from 'node:path';

import { applyAllowList, loadAllowList } from './allowlist.js';
import { describeMode } from './cli.js';
import { buildCache, computeFingerprint, getCachedHash, loadCache, saveCache } from './incremental.js';
import { buildModel, createProvider, loadSecret, summarizePage } from './llm.js';
import { scanPages } from './pages.js';
import { buildEntry, mergeEntries, readSearchData, writeSearchData } from './store.js';
import { createProgress, endProgress, style } from './terminal.js';

/** LLM 并发请求数 */
const CONCURRENCY = 3;

/**
 * 受限并发地映射数组（保持结果与输入同序）。
 *
 * @template T, R
 * @param {T[]} items 输入数组
 * @param {number} limit 最大并发数
 * @param {(item: T, index: number) => Promise<R>} fn 处理函数
 * @returns {Promise<R[]>} 结果数组
 */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * 执行一次完整的搜索建议生成流程。
 *
 * @param {object} options 运行时选项（见 cli.js 的 defaultOptions）
 * @returns {Promise<number>} 进程退出码（0 表示成功）
 */
export async function run(options) {
  const startedAt = Date.now();
  /** 相对仓库根目录展示路径；位于根目录之外时直接展示绝对路径 */
  const rel = (path) => {
    if (!path) return '(未启用)';
    const short = relative(options.root, path);
    return !short || short.startsWith('..') ? path : short;
  };
  const modeLabel = describeMode(options);

  // ---------- 1. 扫描构建产物 ----------
  if (!existsSync(options.distDir)) {
    console.error(style.red(`[summary] 未找到构建产物目录：${rel(options.distDir)}`));
    console.error('          请先执行： ASTRO_TELEMETRY_DISABLED=1 npx astro build');
    return 1;
  }
  const { pages: allPages, stats } = await scanPages(options.distDir);
  if (allPages.length === 0) {
    console.warn('[summary] 没有可读页面，退出。');
    return 0;
  }

  // ---------- 2. 名单过滤 ----------
  const allowList = loadAllowList({ listPath: options.listPath, only: options.only });
  const filtering = allowList.include.length > 0 || allowList.exclude.length > 0;
  let scopedPages = allPages;
  let allowResult = null;
  if (filtering) {
    allowResult = applyAllowList(allPages, allowList);
    scopedPages = allowResult.pages;
  }

  scopedPages = [...scopedPages].sort((a, b) => a.link.localeCompare(b.link));
  const truncated = options.limit > 0 && scopedPages.length > options.limit;
  if (truncated) scopedPages = scopedPages.slice(0, options.limit);

  // ---------- 3. 报告扫描与过滤结果 ----------
  console.log(
    `[summary] 构建产物：${rel(options.distDir)}（HTML ${stats.htmlFiles} 个 → 可读页面 ${stats.pages} 个）`
  );
  if (filtering) {
    const parts = [];
    if (allowResult.include.length) parts.push(`纳入 ${allowResult.include.length} 条`);
    if (allowResult.exclude.length) parts.push(`排除 ${allowResult.exclude.length} 条`);
    console.log(
      `[summary] 名单（${allowList.source}）：${parts.join(' / ')} → 命中 ${scopedPages.length} 个页面`
    );
    for (const pattern of allowResult.missing) {
      console.warn(style.yellow(`  ! 该模式未命中任何页面，请检查写法：${pattern}`));
    }
  }
  console.log(`[summary] 模式：${style.bold(modeLabel)}${truncated ? `（--limit ${options.limit}）` : ''}`);

  // ---------- 4. 读取现有数据与增量缓存 ----------
  const oldEntries = await readSearchData(options.outputPath);
  const oldByLink = new Map(oldEntries.filter(Boolean).map((entry) => [entry.link, entry]));
  const cache = await loadCache(options.cachePath);
  const fingerprints = new Map(allPages.map((page) => [page.link, computeFingerprint(page)]));

  // ---------- 5. 载入密钥配置 ----------
  const secret = loadSecret(options.secretPath, options.root);
  let config = null;
  let model = null;
  if (secret.ok) {
    config = secret.config;
    model = buildModel(createProvider(config), config);
  } else if (!options.dryRun) {
    console.error('[summary] secret.json 校验失败：');
    for (const issue of secret.issues) console.error(`  · ${issue}`);
    return 1;
  } else {
    console.warn(`[summary] 试运行：未载入 secret.json（${secret.issues[0]}）`);
  }

  const currentModel = config?.model ?? null;
  const modelChanged = Boolean(currentModel && cache.model && cache.model !== currentModel);

  // ---------- 6. 增量规划：区分「可复用」与「待总结」 ----------
  /** @type {Map<string, object>} link → 可直接复用的旧条目 */
  const reusable = new Map();
  /** @type {Array<object>} 需要调用 LLM 的页面 */
  const pending = [];

  for (const page of scopedPages) {
    const upToDate =
      options.incremental &&
      !modelChanged &&
      oldByLink.has(page.link) &&
      getCachedHash(cache, page.link) === fingerprints.get(page.link);
    if (upToDate) reusable.set(page.link, oldByLink.get(page.link));
    else pending.push(page);
  }

  if (options.incremental) {
    if (modelChanged) {
      console.log(style.yellow(`[summary] 增量缓存失效：模型由 ${cache.model} 变为 ${currentModel}。`));
    } else if (!options.cachePath) {
      console.log(style.yellow('[summary] 增量模式：缓存已被禁用（--no-cache），本次将处理全部页面。'));
    } else if (!existsSync(options.cachePath)) {
      console.log(style.dim(`[summary] 增量模式：首次运行（未找到 ${rel(options.cachePath)}），将处理全部页面。`));
    }
    console.log(`[summary] 增量计划：可复用 ${reusable.size} 个页面 / 需重新总结 ${pending.length} 个页面`);
  }

  // ---------- 7. 试运行：到此为止 ----------
  if (options.dryRun) {
    console.log(`\n[summary] 将处理以下 ${pending.length} 个页面：`);
    for (const page of pending) {
      console.log(`  · ${page.link}  (${page.text.length} 字)  ${page.title}`);
    }
    if (reusable.size) {
      console.log(`[summary] 另有 ${reusable.size} 个页面内容未变化，将直接复用旧条目。`);
    }
    console.log('\n[summary] --dry-run：未调用 LLM，也未写入文件。');
    return 0;
  }

  console.log(
    `[summary] 模型：${currentModel}（${config.useResponseAPI ? 'Responses API' : 'Chat Completions'}` +
      `${config.useStreamAPI ? ' + Stream' : ''}）`
  );

  // ---------- 8. 逐页调用 LLM ----------
  /** @type {Array<{ link: string, error: string }>} */
  const failed = [];
  /** @type {Array<object>} */
  const generated = [];

  if (pending.length > 0) {
    const progress = createProgress('[summary] 进度');
    let done = 0;
    const results = await mapLimit(pending, CONCURRENCY, async (page) => {
      try {
        return buildEntry(page, await summarizePage(page, model, config));
      } catch (err) {
        failed.push({ link: page.link, error: err?.message ?? String(err) });
        return null;
      } finally {
        done += 1;
        progress(done, pending.length);
      }
    });
    endProgress();
    for (const entry of results) if (entry) generated.push(entry);
  }

  // ---------- 9. 汇总本次范围内的条目 ----------
  const produced = new Map(reusable);
  for (const entry of generated) produced.set(entry.link, entry);
  const scopedEntries = scopedPages.map((page) => produced.get(page.link)).filter(Boolean);

  // ---------- 10. 合并与写出 ----------
  const merged = mergeEntries({ oldEntries, newEntries: scopedEntries, replace: options.replace });

  if (options.noWrite) {
    console.log('\n[summary] --no-write：本次生成结果（未写入文件）：');
    console.log(JSON.stringify(generated, null, 2));
    console.log(`[summary] 若写入，合并后共 ${merged.length} 条。`);
    return 0;
  }

  const unchanged = JSON.stringify(merged) === JSON.stringify(oldEntries);
  if (unchanged) {
    console.log(style.dim(`[summary] 搜索数据无变化，跳过写入：${rel(options.outputPath)}`));
  } else {
    await writeSearchData(options.outputPath, merged, { pretty: options.pretty });
  }

  // ---------- 11. 更新增量缓存（仅在真正写出数据后） ----------
  if (options.cachePath) {
    const nextCache = buildCache({
      previous: cache,
      model: currentModel,
      pages: allPages,
      fingerprints,
      successful: new Set(scopedEntries.map((entry) => entry.link)),
    });
    await saveCache(options.cachePath, nextCache);
    console.log(
      style.dim(`[summary] 增量缓存：${rel(options.cachePath)}（记录 ${Object.keys(nextCache.pages).length} 个页面）`)
    );
  }

  // ---------- 12. 报告 ----------
  if (failed.length) {
    console.warn(style.yellow(`[summary] 有 ${failed.length} 个页面处理失败（其原数据已保留）：`));
    for (const item of failed) console.warn(`  · ${item.link} — ${item.error}`);
  }

  const parts = [`生成 ${generated.length} 条`];
  if (reusable.size) parts.push(`复用 ${reusable.size} 条`);
  if (failed.length) parts.push(`失败 ${failed.length} 条`);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[summary] 完成：${parts.join(' / ')} → ${unchanged ? '搜索数据未变' : `写入 ${rel(options.outputPath)}`}` +
      ` 共 ${merged.length} 条${options.replace ? '（整体替换）' : '（合并保留旧条目）'}，耗时 ${elapsed}s`
  );
  return 0;
}
