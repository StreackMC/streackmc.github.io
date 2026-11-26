#!/usr/bin/env node
/**
 * 压缩 dist 中由 public/ 原样复制过来的 JS / CSS 文件。
 *
 * 只在 release 构建（npm run build:release）的最后一步执行：
 *   - 遍历 public/，收集 .js / .css 的相对路径
 *   - 对 dist/ 中同路径文件用 esbuild 做 minify，并移除全部注释（含 legal comments）
 *   - 不写回 public/，因此开发服务器与本地 npm run build 看到的仍是未压缩源码
 *   - --check 时用 public/ 源码与 dist/ 产物比对，不写文件
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
const DIST_DIR = join(PROJECT_ROOT, 'dist');
const TARGET_EXTENSIONS = new Set(['.js', '.css']);
const CHECK_ONLY = process.argv.includes('--check');

async function collectFiles(dir, base = dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await collectFiles(full, base)));
    } else if (TARGET_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      found.push(relative(base, full));
    }
  }
  return found;
}

const files = (await collectFiles(PUBLIC_DIR)).sort();
let before = 0;
let after = 0;
let changed = 0;

for (const relPath of files) {
  const distPath = join(DIST_DIR, relPath);
  const sourcePath = CHECK_ONLY ? join(PUBLIC_DIR, relPath) : distPath;
  const source = await readFile(sourcePath, 'utf8');
  const distCode = CHECK_ONLY ? await readFile(distPath, 'utf8') : source;
  const loader = extname(relPath).toLowerCase() === '.js' ? 'js' : 'css';

  let minified;
  try {
    const result = await transform(source, {
      loader,
      minify: true,
      legalComments: 'none',
      charset: 'utf8',
    });
    minified = result.code;
  } catch (error) {
    throw new Error(`压缩失败：${relPath}\n${error.message}`, { cause: error });
  }

  before += Buffer.byteLength(source, 'utf8');
  after += Buffer.byteLength(minified, 'utf8');
  if (minified !== distCode) {
    changed += 1;
    if (!CHECK_ONLY) {
      await writeFile(distPath, minified, 'utf8');
    }
  }
}

const verb = CHECK_ONLY ? '待压缩' : '已压缩';
console.log(
  `[minify-public] ${verb} ${changed}/${files.length} 个文件，${before} → ${after} 字节（节省 ${(((before - after) / before) * 100).toFixed(1)}%）`,
);

if (CHECK_ONLY && changed > 0) {
  process.exitCode = 1;
}
