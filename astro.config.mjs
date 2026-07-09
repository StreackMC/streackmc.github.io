import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * 递归扫描目录下所有 .html 文件，返回相对于 base 的路径（以 / 开头）
 * base 固定为最外层目录，递归时不改变，确保路径前缀完整
 */
function findHtmlFiles(dir, base = dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...findHtmlFiles(fullPath, base));
    } else if (entry.endsWith('.html')) {
      results.push('/' + relative(base, fullPath).replace(/\\/g, '/'));
    }
  }
  return results;
}

/**
 * 自动收集 public/ 下的静态 HTML 页面作为 sitemap customPages
 * 排除框架片段和归档页面
 */
function collectStaticPages() {
  const SITE = 'https://streack.top';
  // 排除规则：这些路径前缀的 HTML 不收录进 sitemap
  const excludePrefixes = [
    '/assets/app/includes/', // 框架片段（toolbar/footer）
    '/assets/archived-file/', // 归档旧站点
  ];

  return findHtmlFiles('public')
    .filter((path) => !excludePrefixes.some((p) => path.startsWith(p)))
    .map((path) => SITE + path);
}

// https://astro.build/config
export default defineConfig({
  // 自定义域名 streack.top (CNAME 在 public/ 中)
  site: 'https://streack.top',
  // 自定义域名无需 base 路径
  base: '/',
  // 静态输出（GitHub Pages 部署）
  output: 'static',
  // 构建产物目录
  build: {
    assets: 'assets',
  },
  // 开发服务器配置
  server: {
    host: true,
    port: 4321,
  },
  integrations: [
    sitemap({
      // 排除 404 页面、temple 模板页
      filter: (page) => !page.includes('/404') && !page.includes('/temple/'),
      // 自动收录 public/ 下的静态 HTML 页面
      // （Astro sitemap 只扫描 src/pages/，这些静态透传文件需手动添加）
      customPages: collectStaticPages(),
    }),
  ],
});
