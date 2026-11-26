#!/usr/bin/env node
/**
 * 给 dist/ 下所有 HTML / CSS / JS 文件开头插入版权注释（release 专用）。
 *
 * HTML 插在 <!DOCTYPE html> 之前（规范允许，不会触发 quirks mode）；
 * CSS / JS 插在文件内容之前。重复执行不会重复插入；--check 只比对不写文件。
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LICENSE_HEADER } from './license-header.mjs';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST_DIR = join(PROJECT_ROOT, 'dist');
const HEADERS = new Map([
  ['.html', LICENSE_HEADER.html],
  ['.css', LICENSE_HEADER.css],
  ['.js', LICENSE_HEADER.js],
]);
const CHECK_ONLY = process.argv.includes('--check');

async function collectTargets(dir, base = dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await collectTargets(full, base)));
    } else if (HEADERS.has(extname(entry.name).toLowerCase())) {
      found.push(relative(base, full));
    }
  }
  return found;
}

const files = (await collectTargets(DIST_DIR)).sort();
let inserted = 0;

for (const relPath of files) {
  const filePath = join(DIST_DIR, relPath);
  const header = `${HEADERS.get(extname(relPath).toLowerCase())}\n`;
  const source = await readFile(filePath, 'utf8');
  if (source.startsWith(header)) {
    continue;
  }

  inserted += 1;
  if (!CHECK_ONLY) {
    await writeFile(filePath, header + source, 'utf8');
  }
}

const verb = CHECK_ONLY ? '待插入' : '已插入';
console.log(`[insert-copyright] ${verb} ${inserted}/${files.length} 个 HTML/CSS/JS 文件`);

if (CHECK_ONLY && inserted > 0) {
  process.exitCode = 1;
}
