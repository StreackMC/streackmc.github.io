/**
 * incremental.js — 增量更新的指纹缓存
 *
 * 思路：为每个「可读页面」计算一个内容指纹（标题 + 正文的 SHA-256）。
 * 增量运行时，若某页面的指纹与上次记录一致、且搜索数据中已有对应条目，
 * 就直接复用旧条目、跳过 LLM 调用；否则才重新总结。
 *
 * 缓存文件（默认仓库根目录 `.summary-cache.json`）结构：
 *   {
 *     "version": 1,
 *     "model": "gpt-4o-mini",        // 上次生成时使用的模型（用于检测换模型）
 *     "generatedAt": "2026-…",       // 上次写入时间（ISO 字符串）
 *     "pages": { "/doc/xxx": { "hash": "…", "updatedAt": "…" } }
 *   }
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** 缓存结构版本号；版本变化会让旧缓存整体失效，避免结构不兼容 */
export const CACHE_VERSION = 1;

/** 指纹盐值：与缓存版本绑定，便于结构升级时整体失效 */
const HASH_SALT = `streack-summary-v${CACHE_VERSION}`;

/**
 * 计算页面的内容指纹。
 *
 * @param {{ title: string, text: string }} page 页面对象
 * @returns {string} 十六进制 SHA-256
 */
export function computeFingerprint(page) {
  return createHash('sha256')
    .update(`${HASH_SALT}\u0000${page.title}\u0000${page.text}`)
    .digest('hex');
}

/**
 * 生成一个空缓存对象。
 *
 * @returns {{ version: number, model: string|null, generatedAt: string|null, pages: Record<string, { hash: string, updatedAt: string }> }}
 */
export function emptyCache() {
  return { version: CACHE_VERSION, model: null, generatedAt: null, pages: {} };
}

/**
 * 读取缓存文件；文件缺失或损坏时回退为空缓存。
 *
 * @param {string|null} cachePath 缓存文件路径（为 null 表示不启用缓存）
 * @returns {Promise<ReturnType<typeof emptyCache>>} 缓存对象
 */
export async function loadCache(cachePath) {
  if (!cachePath || !existsSync(cachePath)) return emptyCache();
  try {
    const raw = JSON.parse(await readFile(cachePath, 'utf8'));
    if (!raw || raw.version !== CACHE_VERSION || typeof raw.pages !== 'object' || raw.pages === null) {
      return emptyCache();
    }
    return { ...emptyCache(), ...raw, pages: raw.pages };
  } catch (err) {
    console.warn(`[summary] 增量缓存解析失败，将视为空缓存：${err.message}`);
    return emptyCache();
  }
}

/**
 * 读取某个页面已记录的指纹。
 *
 * @param {ReturnType<typeof emptyCache>} cache 缓存对象
 * @param {string} link 网站路径
 * @returns {string|null} 指纹；不存在时返回 null
 */
export function getCachedHash(cache, link) {
  return cache?.pages?.[link]?.hash ?? null;
}

/**
 * 生成新的缓存对象。
 *
 * 规则：
 *   · 仅保留本次扫描到的页面（其余视为已下线，从缓存剔除）
 *   · 指纹未变化 → 原样保留旧记录（含 updatedAt）
 *   · 指纹变化且本次成功产出 → 更新指纹与时间戳
 *   · 指纹变化但本次处理失败 → 保留旧记录，使其下次仍会被判定为「待更新」
 *
 * @param {object} params
 * @param {ReturnType<typeof emptyCache>} params.previous 上一次的缓存
 * @param {string|null} params.model 本次使用的模型名
 * @param {Array<{ link: string }>} params.pages 本次扫描到的**全部**页面（不受名单过滤影响）
 * @param {Map<string, string>} params.fingerprints link → 本次指纹
 * @param {Set<string>} params.successful 本次成功产出（含复用）的 link 集合
 * @param {string} [params.now] 时间戳（ISO 字符串）
 * @returns {ReturnType<typeof emptyCache>} 新缓存对象
 */
export function buildCache({ previous, model, pages, fingerprints, successful, now = new Date().toISOString() }) {
  const previousPages = previous?.pages ?? {};
  /** @type {Record<string, { hash: string, updatedAt: string }>} */
  const nextPages = {};

  for (const page of pages) {
    const link = page.link;
    const hash = fingerprints.get(link);
    const old = previousPages[link];

    if (old && old.hash === hash) {
      nextPages[link] = old; // 内容未变：保留原记录与时间
    } else if (successful.has(link)) {
      nextPages[link] = { hash, updatedAt: now }; // 内容变化且产出成功：刷新
    } else if (old) {
      nextPages[link] = old; // 内容变化但处理失败：保留旧指纹，下次重试
    }
  }

  return { version: CACHE_VERSION, model, generatedAt: now, pages: nextPages };
}

/**
 * 写出缓存文件（自动创建上级目录，压缩为标准单行 JSON）。
 *
 * @param {string} cachePath 缓存文件路径
 * @param {ReturnType<typeof emptyCache>} cache 缓存对象
 * @returns {Promise<void>}
 */
export async function saveCache(cachePath, cache) {
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(cache), 'utf8');
}
