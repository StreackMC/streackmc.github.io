import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

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
  ],
});
