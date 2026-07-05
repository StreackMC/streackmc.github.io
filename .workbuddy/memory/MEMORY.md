# Streack 项目长期记忆

## 项目概述
栈流Streack — Minecraft 服务器网站，已迁移至 Astro 5.7.0 框架。
- 部署目标：GitHub Pages（自定义域 streack.top）
- UI 框架：Sober UI（自定义 Web Components，CDN 加载）
- 自定义框架 JS：framework.js（运行时 HTML 片段加载 → 已改为服务端渲染）

## Git 配置（仓库级）
- user.name: Neonai
- user.email: neonai+coding@streack.top
- **只能写入本地 .git/config，不能写入全局配置**

## 架构
- `src/layouts/`：BaseLayout（HTML骨架）、FrameworkLayout（首页/dark）、ToolLayout（工具页/light）
- `src/components/`：Toolbar、Footer、Sidebar（服务端渲染，替代原 fetch 注入）
- `public/`：静态资源（assets/, webtool/code/, pmd.js 等）
- 两种页面布局风格：FrameworkLayout（s-page dark theme + content slot 系统）、ToolLayout（s-appbar + s-drawer + sidebar）

## 构建注意事项
- 构建命令：`ASTRO_TELEMETRY_DISABLED=1 npx astro build`
- 所有引用 public/ 或外部 URL 的 `<script>` 必须加 `is:inline`
- HTML `slot` 属性与 Astro 插槽指令冲突，需用 `display:contents` 包裹层隔离
