import { defineConfig } from 'astro/config';

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
});
