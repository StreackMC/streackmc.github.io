/**
 * pages.js — 扫描构建产物，提取「人类可读」的页面正文
 *
 * 只处理构建产物（dist/）下的 `.html` 页面：
 *   · 自动跳过 `assets/` 等非页面目录、404 页面，以及可见正文过短的纯跳转/空壳页
 *   · 正文提取时会剔除脚本、样式、工具栏、页脚等与页面主题无关的样板内容
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { parse } from 'node-html-parser';

/** 页面可见正文少于该字符数则视为「无实质内容」，跳过 */
export const MIN_TEXT_LENGTH = 40;

/** 扫描时直接跳过的目录名 */
const SKIP_DIRS = new Set(['assets', 'node_modules', '.git', '.astro']);

/**
 * 构建产物路径 → 网站路径。
 *
 * @param {string} absPath HTML 文件绝对路径
 * @param {string} distDir 构建产物根目录
 * @returns {string} 网站路径，如 `/doc/policy/donate`
 */
export function fileToLink(absPath, distDir) {
  const rel = relative(distDir, absPath).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'/index.html'.length);
  return '/' + rel;
}

/**
 * 递归收集目录下的 `.html` 文件。
 *
 * @param {string} dir 起始目录
 * @returns {Promise<string[]>} HTML 文件绝对路径列表
 */
export async function collectHtmlFiles(dir) {
  const out = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        out.push(full);
      }
    }
  }
  await walk(dir);
  return out;
}

/**
 * 从渲染后的 HTML 中提取标题与可见正文。
 *
 * @param {string} html 页面 HTML 源码
 * @returns {{ rawTitle: string, text: string }} 原始标题与压缩空白后的正文
 */
export function extractContent(html) {
  const root = parse(html);
  root.querySelectorAll('script, style, noscript, template').forEach((node) => node.remove());
  root.querySelectorAll('#toolbar-area, #no_script').forEach((node) => node.remove());
  root.querySelectorAll('.content[slot="footer"]').forEach((node) => node.remove());

  const rawTitle = root.querySelector('title')?.textContent?.trim() ?? '';
  const scope = root.querySelector('s-page') ?? root;
  const text = (scope.textContent ?? '').replace(/\s+/g, ' ').trim();
  return { rawTitle, text };
}

/**
 * 去掉页面 `<title>` 末尾的站点名后缀（如「— 栈流Streack」），得到真·文章标题。
 *
 * @param {string} raw 原始标题
 * @returns {string} 清洗后的标题
 */
export function cleanTitle(raw) {
  const title = String(raw || '').trim();
  if (!title) return '';
  const cleaned = title.replace(/\s*[—–\-|·]\s*(栈流\s*)?Streack\s*$/i, '').trim();
  return cleaned || title;
}

/**
 * 扫描构建产物，返回全部可读页面。
 *
 * @param {string} distDir 构建产物根目录
 * @param {{ minTextLength?: number }} [options]
 * @returns {Promise<{
 *   pages: Array<{ link: string, title: string, rawTitle: string, text: string, file: string }>,
 *   stats: { htmlFiles: number, pages: number, skipped404: number, skippedEmpty: number }
 * }>} 页面列表与扫描统计
 */
export async function scanPages(distDir, { minTextLength = MIN_TEXT_LENGTH } = {}) {
  const htmlFiles = await collectHtmlFiles(distDir);
  const pages = [];
  let skipped404 = 0;
  let skippedEmpty = 0;

  for (const file of htmlFiles) {
    const link = fileToLink(file, distDir);
    if (/(^|\/)404(\.html)?$/.test(link)) {
      skipped404 += 1;
      continue;
    }

    const { rawTitle, text } = extractContent(await readFile(file, 'utf8'));
    if (text.length < minTextLength) {
      skippedEmpty += 1;
      continue;
    }

    pages.push({ link, title: cleanTitle(rawTitle), rawTitle, text, file });
  }

  return {
    pages,
    stats: { htmlFiles: htmlFiles.length, pages: pages.length, skipped404, skippedEmpty },
  };
}
