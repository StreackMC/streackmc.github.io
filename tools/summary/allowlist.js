/**
 * allowlist.js — 「名单」的读取与路径匹配
 *
 * 名单用于限定「只总结哪些页面」：
 *   · 一行一个模式；以 `#` 开头的行是注释，空行忽略
 *   · 模式匹配的是**网站路径**（如 `/doc/policy/donate`），而非 dist 中的文件路径
 *   · 开头的 `/` 可省略；以 `/` 结尾（如 `doc/policy/`）等价于 `doc/policy/**`
 *   · 通配符：`*` 匹配任意多个字符（不跨 `/`）、`**` 跨层级、`?` 匹配单个字符
 *   · 只写目录名（如 `doc/policy`）时，该目录及其下所有页面都会被纳入
 *   · `!` 前缀 = 强制排除：命中任一排除模式的页面一律不总结，且排除始终优先
 *   · 只写排除项（没有纳入项）时，基准是「全部可读页面」
 *   · 纳入与排除均为空 → 不过滤，处理全部可读页面
 *
 * 命令行 `--only` 传入的模式会覆盖名单文件，两者解析规则一致。
 */

import { existsSync, readFileSync } from 'node:fs';

/**
 * 读取名单文件，返回原始条目（已去除注释与空行，保留 `!` 前缀与原始写法）。
 *
 * @param {string} listPath 名单文件绝对路径
 * @returns {string[]} 原始条目列表；文件不存在时返回空数组
 */
export function readListFile(listPath) {
  if (!existsSync(listPath)) return [];
  return readFileSync(listPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

/**
 * 把名单里的一行拆成 `{ negated, pattern }`；`!` 前缀表示强制排除。
 *
 * @param {string} raw 原始条目
 * @returns {{ negated: boolean, pattern: string } | null} 解析结果，无效时返回 null
 */
function parseListEntry(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const negated = text.startsWith('!');
  const body = negated ? text.slice(1).trim() : text;
  if (!body) return null;
  return { negated, pattern: body };
}

/**
 * 规范化名单模式：补上开头的 `/`；以 `/` 结尾者视作 `dir/**`。
 *
 * @param {string} raw 原始模式
 * @returns {string} 规范化后的模式（形如 `/doc/**`）
 */
function normalizePattern(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const withSlash = text.startsWith('/') ? text : '/' + text;
  return withSlash.endsWith('/') ? withSlash + '**' : withSlash;
}

/**
 * 通配符转正则：`**` 跨层级、`*` 不跨 `/`、`?` 单字符。
 *
 * @param {string} pattern 规范化后的模式
 * @returns {RegExp} 锚定首尾的正则
 */
function globToRegExp(pattern) {
  let source = '';
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        source += '.*';
        i += 1;
      } else {
        source += '[^/]*';
      }
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp('^' + source + '$');
}

/**
 * 判断某个网站路径是否命中名单模式（「目录」模式同时覆盖其下所有页面）。
 *
 * @param {string} link 网站路径，如 `/doc/policy/donate`
 * @param {string} pattern 规范化后的模式
 * @returns {boolean} 命中返回 true
 */
export function matchesPattern(link, pattern) {
  if (globToRegExp(pattern).test(link)) return true;
  // 「指定目录」语义：不含通配符的 `/doc/policy` 也应命中 `/doc/policy/donate`
  if (!pattern.includes('*') && !pattern.includes('?')) {
    return globToRegExp(pattern + '/**').test(link);
  }
  return false;
}

/**
 * 加载名单：优先使用 `--only`（覆盖），否则读取名单文件。
 *
 * @param {{ listPath: string, only?: string[] }} params
 * @returns {{ include: string[], exclude: string[], fromCli: boolean, source: string }}
 *          两者皆空表示不过滤
 */
export function loadAllowList({ listPath, only = [] }) {
  const fromCli = only.length > 0;
  const raw = fromCli ? only : readListFile(listPath);

  /** @type {string[]} */
  const include = [];
  /** @type {string[]} */
  const exclude = [];
  for (const item of raw) {
    const entry = parseListEntry(item);
    if (!entry) continue;
    const pattern = normalizePattern(entry.pattern);
    if (!pattern) continue;
    const bucket = entry.negated ? exclude : include;
    if (!bucket.includes(pattern)) bucket.push(pattern);
  }
  return { include, exclude, fromCli, source: fromCli ? '--only' : 'summary-list.txt' };
}

/**
 * 按名单过滤页面（排除始终优先）。
 *
 * @param {Array<{ link: string }>} pages 全部可读页面
 * @param {{ include: string[], exclude: string[] }} allowList 名单
 * @returns {{
 *   pages: Array<object>,
 *   include: string[],
 *   exclude: string[],
 *   includeHits: Map<string, number>,
 *   excludeHits: Map<string, number>,
 *   missing: string[]
 * }} 过滤结果；`missing` 为「一条都没命中」的模式，便于发现笔误
 */
export function applyAllowList(pages, { include, exclude }) {
  /** 统计各模式独立命中数，便于发现笔误 */
  const countHits = (patterns) => {
    const map = new Map(patterns.map((pattern) => [pattern, 0]));
    for (const page of pages) {
      for (const pattern of patterns) {
        if (matchesPattern(page.link, pattern)) map.set(pattern, map.get(pattern) + 1);
      }
    }
    return map;
  };

  const includeHits = countHits(include);
  const excludeHits = countHits(exclude);

  const kept = pages.filter((page) => {
    // 排除始终优先：命中任一排除模式即剔除（不看顺序，也不管是否在纳入范围内）
    for (const pattern of exclude) {
      if (matchesPattern(page.link, pattern)) return false;
    }
    if (include.length === 0) return true; // 只写了排除项 → 基准为全部可读页面
    for (const pattern of include) {
      if (matchesPattern(page.link, pattern)) return true;
    }
    return false;
  });

  const missing = [...includeHits, ...excludeHits]
    .filter(([, hits]) => hits === 0)
    .map(([pattern]) => pattern);

  return { pages: kept, include, exclude, includeHits, excludeHits, missing };
}
