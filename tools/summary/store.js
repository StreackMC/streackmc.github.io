/**
 * store.js — 搜索数据（public/assets/search-suggestion.json）的读写与合并
 *
 * 条目结构（由 assets/app/component/search.js 消费）：
 *   {
 *     link,     // 网站路径
 *     keywords, // 搜索关键词
 *     title,    // 真·文章标题（取自页面 <title>，已去除站点名后缀）
 *     summary   // 全文概要（LLM 生成）
 *   }
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { z } from 'zod';

/** 搜索数据条目的结构 */
export const EntrySchema = z.object({
  link: z.string(),
  keywords: z.array(z.string()),
  title: z.string(),
  summary: z.string(),
});

/**
 * 由页面与 LLM 结果构造一条标准化的搜索数据条目。
 * 关键词会去空、去重并截断到最多 20 个。
 *
 * @param {{ link: string, title?: string, rawTitle?: string }} page 页面对象
 * @param {{ summary?: string, keywords?: string[] }} result LLM 返回结果
 * @returns {z.infer<typeof EntrySchema>} 标准化条目
 */
export function buildEntry(page, result) {
  return EntrySchema.parse({
    link: page.link,
    keywords: [...new Set((result.keywords ?? []).map((k) => String(k).trim()).filter(Boolean))].slice(0, 20),
    title: page.title || page.rawTitle || page.link,
    summary: String(result.summary ?? '').trim(),
  });
}

/**
 * 读取现有搜索数据；文件缺失或损坏时返回空数组。
 *
 * @param {string} outputPath 搜索数据文件路径
 * @returns {Promise<Array<z.infer<typeof EntrySchema>>>} 条目列表
 */
export async function readSearchData(outputPath) {
  if (!existsSync(outputPath)) return [];
  try {
    const raw = JSON.parse(await readFile(outputPath, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.warn(`[summary] 现有搜索数据解析失败，将视为空：${err.message}`);
    return [];
  }
}

/**
 * 合并新条目到旧数据。
 *
 * · 默认合并：旧数据中未被本次覆盖的条目（如外部文档站页面）原样保留，且顺序稳定
 * · `replace = true`：以本次结果整体替换（丢弃未被覆盖的旧条目）
 *
 * @param {object} params
 * @param {Array<object>} params.oldEntries 现有条目
 * @param {Array<object>} params.newEntries 本次产出的条目
 * @param {boolean} params.replace 是否整体替换
 * @returns {Array<object>} 合并后的条目列表
 */
export function mergeEntries({ oldEntries, newEntries, replace }) {
  if (replace) return newEntries;

  const byLink = new Map(newEntries.map((entry) => [entry.link, entry]));
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
  for (const entry of newEntries) {
    if (!used.has(entry.link)) merged.push(entry); // 新增的本地页面
  }
  return merged;
}

/**
 * 写出搜索数据。默认输出**压缩过的标准单行 JSON**，`pretty` 为 true 时输出缩进格式。
 *
 * @param {string} outputPath 搜索数据文件路径
 * @param {Array<object>} entries 条目列表
 * @param {{ pretty?: boolean }} [options]
 * @returns {Promise<void>}
 */
export async function writeSearchData(outputPath, entries, { pretty = false } = {}) {
  const body = JSON.stringify(entries, null, pretty ? 2 : undefined);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, pretty ? body + '\n' : body, 'utf8');
}
