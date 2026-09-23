#!/usr/bin/env node
/**
 * summary.js — 用 LLM 为站点“实际渲染、人类可读”的页面生成标题与搜索关键词，
 *              并自动更新搜索数据文件 public/assets/search-suggestion.json
 *
 * ═══════════════════════════════════════════════════════════════
 *  运行前置
 * ═══════════════════════════════════════════════════════════════
 *  1. 先构建站点（本脚本读取构建产物 dist/ 下的 .html —— 即“实际渲染”结果）：
 *       ASTRO_TELEMETRY_DISABLED=1 npx astro build
 *  2. 在仓库根目录准备 secret.json（已被 .gitignore 忽略），格式：
 *       {
 *         "apiKey": "sk-...",                    // OpenAI 格式的密钥（必填）
 *         "baseURL": "https://api.openai.com/v1",// API 地址（可选，缺省为 OpenAI 官方）
 *         "model": "gpt-4o-mini",                // 使用的模型名（可选）
 *         "useStreamAPI": false,                 // 是否使用 Stream API（流式）
 *         "useResponseAPI": false                // 是否使用 Response API（否则 Chat Completions）
 *       }
 *     也兼容写成数组 [{...}]（取第一项）；baseURL 可指向任意 OpenAI 兼容端点（如 DeepSeek）。
 *
 *  用法：
 *    node summary.js                # 扫描 dist、调用 LLM、合并写入搜索数据（压缩 JSON）
 *    node summary.js --dry-run      # 只扫描并打印将被处理的页面，不调用 LLM、不写文件
 *    node summary.js --no-write     # 调用 LLM 并打印结果，但不写入文件
 *    node summary.js --replace      # 整体替换搜索数据（丢弃未覆盖的旧条目，默认是“合并保留”）
 *    node summary.js --limit 3      # 只处理前 N 个页面（试跑用）
 *    node summary.js --pretty       # 以缩进格式写出（默认转为压缩的单行标准 JSON）
 *    node summary.js --dir <path>   # 指定构建产物目录（默认 dist）
 *    node summary.js --only <模式>  # 只处理命中「名单」的页面（逗号分隔，覆盖名单文件）
 *
 *  ═══════════════════════════════════════════════════════════════
 *  名单（只总结指定目录的文件，支持通配符）
 *  ═══════════════════════════════════════════════════════════════
 *  在仓库根目录维护 summary-list.txt，一行一个模式（# 开头为注释，空行忽略）：
 *
 *       doc/**              # doc 下所有页面
 *       about/legal         # 该目录及其下的页面
 *       /webtool/*          # 通配符：webtool 下任意一层
 *       /doc/policy/privacy # 单个页面也可以
 *       !doc/event/**       # 以 ! 开头：强制排除（优先级高于纳入）
 *
 *  · 模式匹配的是**网站路径**（如 /doc/policy/donate，而非 dist 里的文件路径）
 *  · 开头的 / 可省略；以 / 结尾（如 `doc/policy/`）等价于 `doc/policy/**`
 *  · 通配符：`*` 匹配任意多个字符（不含 /）、`**` 跨层级、`?` 匹配单个字符
 *  · 只写目录名（如 `doc/policy`）时，该目录**及其下所有页面**都会被纳入
 *  · **`!` 前缀 = 强制排除**：命中任一排除模式的页面一律不总结，
 *    且**无论它在不在纳入范围内、也不论书写顺序**（排除始终优先）
 *  · 只写排除项（没有纳入项）时，基准是「全部可读页面」，即「除了这些，其余都总结」
 *  · 名单为空或文件不存在 → 不做过滤，照旧处理全部可读页面
 *  · 名单里某个模式没命中任何页面时会告警，便于发现笔误
 *  · `--only` 传入的模式会**覆盖**名单文件（临时试跑用），同样支持 `!` 前缀
 *
 *  说明：
 *   · 只总结“页面”——HTML 页面；.js/.css 等资源不处理
 *   · 自动跳过 dist/assets/**（框架片段/归档）与 404、以及纯跳转/内容过短的页面
 *   · 默认“合并”：本次未覆盖的旧条目（如外部文档站 /doc/**）原样保留
 *   · 输出为**压缩过的标准 JSON**（无多余空白），--pretty 可切换为缩进格式
 *
 *  生成条目字段：
 *    { link, keywords, title, summary }
 *    · title   —— 真·文章标题，取自页面 <title> 并去除站点名后缀
 *    · summary —— LLM 生成的全文概要
 *    · keywords—— LLM 生成的搜索关键词
 */

import { existsSync, readFileSync } from 'node:fs';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, relative, sep, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';
import { parse } from 'node-html-parser';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, streamObject, generateText } from 'ai';

// ============================================================
// 常量与命令行参数
// ============================================================
const ROOT = dirname(fileURLToPath(import.meta.url));
const SECRET_PATH = join(ROOT, 'secret.json');
/** 「名单」文件：一行一个模式，只总结命中名单的页面（不存在或为空则不过滤） */
const LIST_PATH = join(ROOT, 'summary-list.txt');
const OUTPUT_PATH = join(ROOT, 'public', 'assets', 'search-suggestion.json');

/** 页面可见正文少于该字符数则视为“无实质内容”，跳过 */
const MIN_TEXT_LENGTH = 40;
/** LLM 并发请求数 */
const CONCURRENCY = 3;
/** 送入 LLM 的正文截断长度 */
const MAX_INPUT_CHARS = 6000;

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run') || argv.includes('-n');
const NO_WRITE = argv.includes('--no-write');
const REPLACE = argv.includes('--replace');
/** 默认写出压缩（单行）的标准 JSON；--pretty 切换为缩进格式 */
const PRETTY = argv.includes('--pretty');
const dirFlag = argv.findIndex((a) => a === '--dir' || a === '-d');
const DIST_DIR = dirFlag >= 0 && argv[dirFlag + 1]
  ? resolve(ROOT, argv[dirFlag + 1])
  : join(ROOT, 'dist');
const limitFlag = argv.findIndex((a) => a === '--limit' || a === '-l');
const LIMIT = limitFlag >= 0 && argv[limitFlag + 1] ? Math.max(0, parseInt(argv[limitFlag + 1], 10) || 0) : 0;
/** --only 的模式列表（逗号分隔），命中则覆盖名单文件 */
const onlyFlag = argv.findIndex((a) => a === '--only' || a === '-o');
const ONLY = onlyFlag >= 0 && argv[onlyFlag + 1]
  ? argv[onlyFlag + 1].split(',').map((s) => s.trim()).filter(Boolean)
  : [];

// ============================================================
// 数据模型（zod）
// ============================================================

/** secret.json 的结构 */
const SecretSchema = z.object({
  apiKey: z.string().min(1, 'apiKey 不能为空'),
  baseURL: z.string().url('baseURL 需为合法 URL').optional(),
  model: z.string().min(1).default('gpt-4o-mini'),
  useStreamAPI: z.boolean().default(false),
  useResponseAPI: z.boolean().default(false),
});

/** LLM 结构化输出：全文概要 + 搜索关键词（标题不由 LLM 生成，取自页面真实标题） */
const ResultSchema = z.object({
  summary: z.string().describe('该页面的全文概要，用 2～3 句中文概括页面主要内容'),
  keywords: z
    .array(z.string())
    .min(1)
    .describe('用于站内搜索匹配的关键词与同义词，中英文混合，按相关性从高到低排列'),
});

/**
 * 搜索数据条目（写入 public/assets/search-suggestion.json，由 assets/app/component/search.js 消费）
 *   link     — 站点路径
 *   keywords — 搜索关键词
 *   title    — 真·文章标题（取自页面 <title>，去除站点名后缀）
 *   summary  — 全文概要（LLM 生成）
 */
const EntrySchema = z.object({
  link: z.string(),
  keywords: z.array(z.string()),
  title: z.string(),
  summary: z.string(),
});

// ============================================================
// 工具函数
// ============================================================

/** 受限并发地映射数组 */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

/** 构建产物路径 → 网站路径 */
function fileToLink(absPath, distDir) {
  const rel = relative(distDir, absPath).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'/index.html'.length);
  return '/' + rel;
}

/** 递归收集目录下的 .html 文件（跳过 assets/ 等非页面目录） */
async function collectHtmlFiles(dir) {
  const SKIP_DIRS = new Set(['assets', 'node_modules', '.git', '.astro']);
  const out = [];
  async function walk(cur) {
    const entries = await readdir(cur, { withFileTypes: true });
    for (const ent of entries) {
      const full = join(cur, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        await walk(full);
      } else if (ent.isFile() && ent.name.endsWith('.html')) {
        out.push(full);
      }
    }
  }
  await walk(dir);
  return out;
}

/**
 * 从渲染后的 HTML 中提取“人类可读正文”
 * 移除脚本/样式/模板、工具栏、页脚等与页面主题无关的样板内容
 */
function extractContent(html) {
  const root = parse(html);
  root.querySelectorAll('script, style, noscript, template').forEach((n) => n.remove());
  root.querySelectorAll('#toolbar-area, #no_script').forEach((n) => n.remove());
  root.querySelectorAll('.content[slot="footer"]').forEach((n) => n.remove());

  const rawTitle = root.querySelector('title')?.textContent?.trim() ?? '';
  const scope = root.querySelector('s-page') ?? root;
  const text = (scope.textContent ?? '').replace(/\s+/g, ' ').trim();
  return { rawTitle, text };
}

/** 去掉页面 <title> 末尾的站点名后缀（如「— 栈流Streack」），得到真·文章标题 */
function cleanTitle(raw) {
  const t = String(raw || '').trim();
  if (!t) return '';
  const cleaned = t.replace(/\s*[—–\-|·]\s*(栈流\s*)?Streack\s*$/i, '').trim();
  return cleaned || t;
}

// ============================================================
// 名单（只总结指定目录的文件，支持通配符）
// ============================================================

/** 把名单里的一行拆成 { negated, pattern }；`!` 前缀表示强制排除 */
function parseListEntry(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const negated = s.startsWith('!');
  const body = negated ? s.slice(1).trim() : s;
  if (!body) return null;
  return { negated, pattern: body };
}

/** 规范化名单模式：补开头的 /；`dir/` 视作 `dir/**` */
function normalizePattern(raw) {
  const p = String(raw || '').trim();
  if (!p) return '';
  const withSlash = p.startsWith('/') ? p : '/' + p;
  return withSlash.endsWith('/') ? withSlash + '**' : withSlash;
}

/** 通配符 → 正则：`**` 跨层级、`*` 不跨 `/`、`?` 单字符 */
function globToRegExp(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        re += '.*';
        i += 1;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp('^' + re + '$');
}

/** 判断某个网站路径是否命中名单模式（目录模式同时覆盖其下所有页面） */
function matchesPattern(link, pattern) {
  if (globToRegExp(pattern).test(link)) return true;
  // 「指定目录」语义：不带通配符的 `/doc/policy` 也应命中 `/doc/policy/donate`
  if (!pattern.includes('*') && !pattern.includes('?')) {
    return globToRegExp(pattern + '/**').test(link);
  }
  return false;
}

/**
 * 读取名单：优先 --only（覆盖），否则读 summary-list.txt。
 * 返回 { include, exclude, fromCli }；两者皆空表示不过滤。
 */
function loadAllowList() {
  const fromCli = ONLY.length > 0;
  const raw = fromCli
    ? ONLY
    : existsSync(LIST_PATH)
      ? readFileSync(LIST_PATH, 'utf8')
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('#'))
      : [];

  const include = [];
  const exclude = [];
  for (const item of raw) {
    const entry = parseListEntry(item);
    if (!entry) continue;
    const p = normalizePattern(entry.pattern);
    if (!p) continue;
    const bucket = entry.negated ? exclude : include;
    if (!bucket.includes(p)) bucket.push(p);
  }
  return { include, exclude, fromCli };
}

// ============================================================
// LLM 调用
// ============================================================

/** 依配置选择模型实例（Chat Completions vs Responses API） */
function buildModel(provider, cfg) {
  return cfg.useResponseAPI ? provider.responses(cfg.model) : provider(cfg.model);
}

const SYSTEM_PROMPT = [
  '你是网站内容编辑。请阅读给定的网页可见正文，为该页面撰写一段全文概要（2～3 句中文），',
  '并给出一组用于站内搜索匹配的关键词/同义词（覆盖主题、别名、常见叫法，中英文兼顾）。',
  '关键词应尽量避免与站点通用导航/品牌重复（例如“栈流”“Streack”“搜索”“文档”“首页”等），',
  '并只依据给定内容，不要编造页面中不存在的信息。',
].join('');

/** 重试包装：任意异常重试 attempts 次（递增退避） */
async function withRetry(fn, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts) await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
  throw lastErr;
}

/** 从模型输出中提取第一个 JSON 对象（兼容 ```json 代码块与夹杂文字） */
function extractJson(text) {
  const fenced = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);
  const src = fenced ? fenced[1] : String(text);
  const start = src.indexOf('{');
  const end = src.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('响应中未找到 JSON 对象');
  return JSON.parse(src.slice(start, end + 1));
}

const JSON_ONLY_INSTRUCTION =
  '\n\n请只输出一个 JSON 对象，形如 {"summary":"...","keywords":["...","..."]}，不要输出任何解释或多余文字。';

/**
 * 对单个页面调用 LLM，返回 { summary, keywords }
 * 策略：优先结构化输出（generateObject / streamObject）；若端点（如部分 OpenAI 兼容服务）
 *       结构化输出不稳定导致解析失败，则回退为纯文本 + 提取 JSON + zod 校验。整体带重试。
 */
async function summarizePage(page, model, cfg) {
  const prompt =
    `文章标题：${page.title || page.rawTitle || '(无)'}\n` +
    `页面链接：${page.link}\n\n` +
    `页面可见正文：\n${page.text.slice(0, MAX_INPUT_CHARS)}`;

  return withRetry(async () => {
    try {
      if (cfg.useStreamAPI) {
        const result = streamObject({ model, schema: ResultSchema, system: SYSTEM_PROMPT, prompt });
        return await result.object;
      }
      const { object } = await generateObject({ model, schema: ResultSchema, system: SYSTEM_PROMPT, prompt });
      return object;
    } catch {
      // 回退：自由文本 + 提取 JSON + zod 校验
      const { text } = await generateText({
        model,
        system: SYSTEM_PROMPT,
        prompt: prompt + JSON_ONLY_INSTRUCTION,
      });
      return ResultSchema.parse(extractJson(text));
    }
  }, 3);
}

// ============================================================
// 搜索数据读写
// ============================================================

async function readSearchData() {
  if (!existsSync(OUTPUT_PATH)) return [];
  try {
    const raw = JSON.parse(await readFile(OUTPUT_PATH, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.warn(`[summary] 现有搜索数据解析失败，将视为空：${err.message}`);
    return [];
  }
}

/**
 * 合并新条目到旧数据：
 *   · 默认合并——旧数据中未被本次覆盖的条目（如外部 /doc/**）原样保留，顺序稳定
 *   · --replace——以本次结果整体替换
 */
function mergeEntries(oldEntries, newEntries) {
  if (REPLACE) return newEntries;

  const byLink = new Map(newEntries.map((e) => [e.link, e]));
  const used = new Set();
  const merged = [];

  for (const old of oldEntries) {
    if (old && byLink.has(old.link)) {
      merged.push(byLink.get(old.link)); // 本地页面：用新结果覆盖
      used.add(old.link);
    } else {
      merged.push(old); // 未覆盖的旧条目：保留（外部页面等）
    }
  }
  for (const e of newEntries) {
    if (!used.has(e.link)) merged.push(e); // 新增的本地页面
  }
  return merged;
}

// ============================================================
// 主流程
// ============================================================

function loadSecret() {
  if (!existsSync(SECRET_PATH)) {
    throw new Error(`未找到 ${relative(ROOT, SECRET_PATH)}。请先创建该文件（参见脚本头部说明）。`);
  }
  let json;
  try {
    json = JSON.parse(readFileSync(SECRET_PATH, 'utf8'));
  } catch (err) {
    throw new Error(`secret.json 不是合法 JSON：${err.message}`);
  }
  // 兼容数组写法：[{...}]，取第一项
  if (Array.isArray(json)) {
    if (json.length === 0) throw new Error('secret.json 为空数组，未提供任何配置。');
    if (json.length > 1) console.warn(`[summary] secret.json 含 ${json.length} 项配置，仅使用第一项。`);
    json = json[0];
  }
  return SecretSchema.safeParse(json);
}

async function main() {
  // 1. 检查构建产物
  if (!existsSync(DIST_DIR)) {
    console.error(`[summary] 未找到构建产物目录：${relative(ROOT, DIST_DIR)}`);
    console.error('          请先执行： ASTRO_TELEMETRY_DISABLED=1 npx astro build');
    process.exit(1);
  }

  // 2. 扫描并提取各页面正文
  const htmlFiles = await collectHtmlFiles(DIST_DIR);
  let pages = [];
  for (const file of htmlFiles) {
    const link = fileToLink(file, DIST_DIR);
    // 跳过 404
    if (/(^|\/)404(\.html)?$/.test(link)) continue;

    const { rawTitle, text } = extractContent(await readFile(file, 'utf8'));
    if (text.length < MIN_TEXT_LENGTH) continue; // 跳转页 / 空壳页

    pages.push({ link, title: cleanTitle(rawTitle), rawTitle, text, file });
  }

  // 2b. 名单过滤：纳入范围 − 强制排除（名单为空则不过滤）
  const { include, exclude, fromCli } = loadAllowList();
  if (include.length > 0 || exclude.length > 0) {
    // 各模式独立统计命中数，便于发现笔误
    const countHits = (patterns) => {
      const map = new Map(patterns.map((p) => [p, 0]));
      for (const page of pages) {
        for (const p of patterns) {
          if (matchesPattern(page.link, p)) map.set(p, map.get(p) + 1);
        }
      }
      return map;
    };
    const incHits = countHits(include);
    const excHits = countHits(exclude);

    pages = pages.filter((page) => {
      // 排除始终优先：命中任一排除模式即剔除（不看顺序、也不管是否在纳入范围内）
      for (const p of exclude) {
        if (matchesPattern(page.link, p)) return false;
      }
      if (include.length === 0) return true; // 只写了排除项 → 基准为全部可读页面
      for (const p of include) {
        if (matchesPattern(page.link, p)) return true;
      }
      return false;
    });

    const source = fromCli ? '--only' : relative(ROOT, LIST_PATH);
    const parts = [];
    if (include.length > 0) parts.push(`纳入 ${include.length} 条`);
    if (exclude.length > 0) parts.push(`排除 ${exclude.length} 条`);
    console.log(`[summary] 名单（${source}）：${parts.join(' / ')} → 命中 ${pages.length} 个页面`);
    for (const p of include) {
      if (incHits.get(p) === 0) console.warn(`  ! 该纳入模式未命中任何页面，请检查写法：${p}`);
    }
    for (const p of exclude) {
      if (excHits.get(p) === 0) console.warn(`  ! 该排除模式未命中任何页面，请检查写法：${p}`);
    }
  }

  pages.sort((a, b) => a.link.localeCompare(b.link));
  if (LIMIT > 0 && pages.length > LIMIT) pages.length = LIMIT; // --limit 试跑

  console.log(`[summary] 构建产物：${relative(ROOT, DIST_DIR)}`);
  console.log(`[summary] 发现可读页面 ${pages.length} 个：`);
  for (const p of pages) {
    console.log(`  · ${p.link}  (${p.text.length} 字)  ${p.title}`);
  }

  // 3. dry-run：到此为止
  if (DRY_RUN) {
    console.log('\n[summary] --dry-run：未调用 LLM，也未写入文件。');
    return;
  }
  if (pages.length === 0) {
    console.warn('[summary] 没有可处理的页面，退出。');
    return;
  }

  // 4. 载入并校验密钥配置
  const secret = loadSecret();
  if (!secret.success) {
    console.error('[summary] secret.json 校验失败：');
    for (const issue of secret.error.issues) {
      console.error(`  · ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    process.exit(1);
  }
  const cfg = secret.data;
  const provider = createOpenAI({
    apiKey: cfg.apiKey,
    ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}),
  });
  const model = buildModel(provider, cfg);
  console.log(
    `[summary] 模型：${cfg.model}（${cfg.useResponseAPI ? 'Responses API' : 'Chat Completions'}` +
    `${cfg.useStreamAPI ? ' + Stream' : ''}）`
  );

  // 5. 逐页调用 LLM
  let done = 0;
  const failed = [];
  const newEntries = (
    await mapLimit(pages, CONCURRENCY, async (page) => {
      try {
        const res = await summarizePage(page, model, cfg);
        done += 1;
        process.stdout.write(`\r[summary] 进度：${done}/${pages.length}`);
        // 校验并规整输出（title 用页面真实标题；关键词去重、去空、截断）
        return EntrySchema.parse({
          link: page.link,
          keywords: [...new Set(res.keywords.map((k) => String(k).trim()).filter(Boolean))].slice(0, 20),
          title: page.title || page.rawTitle || page.link,
          summary: String(res.summary ?? '').trim(),
        });
      } catch (err) {
        failed.push({ link: page.link, error: err?.message ?? String(err) });
        done += 1;
        process.stdout.write(`\r[summary] 进度：${done}/${pages.length}`);
        return null;
      }
    })
  ).filter(Boolean);
  process.stdout.write('\n');

  if (failed.length) {
    console.warn(`[summary] 有 ${failed.length} 个页面处理失败（将保留其原数据）：`);
    for (const f of failed) console.warn(`  · ${f.link} — ${f.error}`);
  }

  // 6. 合并写入
  const oldEntries = await readSearchData();
  const merged = mergeEntries(oldEntries, newEntries);

  if (NO_WRITE) {
    console.log('\n[summary] --no-write：本次生成结果（未写入文件）：');
    console.log(JSON.stringify(newEntries, null, 2));
    console.log(`[summary] 若写入，合并后共 ${merged.length} 条。`);
    return;
  }

  // 写出：默认压缩为标准单行 JSON（--pretty 则缩进）
  const body = JSON.stringify(merged, null, PRETTY ? 2 : undefined);
  await writeFile(OUTPUT_PATH, PRETTY ? body + '\n' : body, 'utf8');

  console.log(
    `[summary] 完成：生成 ${newEntries.length} 条，写入 ${relative(ROOT, OUTPUT_PATH)} 共 ${merged.length} 条` +
    `${REPLACE ? '（整体替换）' : '（合并保留旧条目）'}。`
  );
}

main().catch((err) => {
  console.error('[summary] 运行出错：', err);
  process.exit(1);
});
