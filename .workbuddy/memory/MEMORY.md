# Streack 项目长期记忆

## 项目概述
栈流Streack — Minecraft 服务器网站，已迁移至 Astro 5.7.0 框架。
- 部署目标：GitHub Pages（自定义域 streack.top）
- UI 框架：Sober UI（自定义 Web Components，CDN 加载）
- 自定义框架 JS：framework.js（运行时 HTML 片段加载 → 已改为服务端渲染）

## Git 提交规则
- 提交身份：user.name="Neonai", user.email="neonai+coding@streack.top"
- **始终在命令行指定身份**：`git -c user.name="Neonai" -c user.email="neonai+coding@streack.top" commit ...`
- 不再依赖仓库 .git/config 或全局配置

## 架构
- `src/layouts/`：BaseLayout（HTML骨架）、FrameworkLayout（首页/dark）、ToolLayout（工具页/light，纯SoberJS）
- `src/components/`：Toolbar、Footer（服务端渲染，替代原 fetch 注入）
- `public/`：静态资源（assets/, webtool/code/, pmd.js 等）
- `public/webtool/*.html`：原始静态 HTML（仅 SoberJS，Astro 静态透传，不加工）
- 两种页面布局风格：FrameworkLayout（s-page dark theme + content slot 系统）、ToolLayout（纯 SoberJS shell）
- Sitemap：@astrojs/sitemap 集成，filter 排除 404，customPages 收录 webtool 静态 HTML

## Sitemap 配置
- 模式：`sitemap-index.xml` + `sitemap-0.xml` 分片输出（与用户其它项目保持一致）
- customPages 自动扫描 `public/` 下所有 HTML，排除 `assets/app/includes/` 和 `assets/archived-file/`
- 外部 sitemap 在 `public/robots.txt` 末尾用 `Sitemap:` 指令添加
- 扫描函数 `findHtmlFiles` 的 base 参数必须固定在最外层，递归时传递不变

## 构建注意事项
- 构建命令：`ASTRO_TELEMETRY_DISABLED=1 npx astro build`
- 所有引用 public/ 或外部 URL 的 `<script>` 必须加 `is:inline`
- HTML `slot` 属性与 Astro 插槽指令冲突，需用 `display:contents` 包裹层隔离
