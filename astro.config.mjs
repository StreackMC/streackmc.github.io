import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
      // 排除 404 页面
      filter: (page) => !page.includes('/404'),
      // 收录 public/webtool/ 下的静态 HTML 页面
      // （Astro sitemap 只扫描 src/pages/，这些静态透传文件需手动添加）
      customPages: [
        'https://streack.top/webtool/status.html',
        'https://streack.top/webtool/uuid.html',
        'https://streack.top/webtool/credits.html',
      ],
    }),
    // @astrojs/sitemap 默认输出 sitemap-index.xml + sitemap-0.xml
    // 此内联集成在构建完成后将其合并为单个 /sitemap.xml
    {
      name: 'sitemap-to-single-file',
      hooks: {
        'astro:build:done': ({ dir }) => {
          const distDir = fileURLToPath(dir);
          const indexFile = distDir + 'sitemap-index.xml';
          const dataFile = distDir + 'sitemap-0.xml';
          const targetFile = distDir + 'sitemap.xml';

          if (existsSync(dataFile)) {
            // 将 sitemap-0.xml 内容写入 sitemap.xml
            writeFileSync(targetFile, readFileSync(dataFile, 'utf-8'));
            // 清理原始分片文件和索引文件
            unlinkSync(dataFile);
            if (existsSync(indexFile)) {
              unlinkSync(indexFile);
            }
            console.log('\x1b[32m[sitemap]\x1b[0m sitemap-index.xml + sitemap-0.xml → sitemap.xml');
          }
        },
      },
    },
  ],
});
