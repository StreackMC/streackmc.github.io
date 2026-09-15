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

## 架构（2026-09-15 更新）
- **布局层级（三层继承）**：
  - `BaseLayout` — HTML 骨架 + Sober UI CDN + 字体 + favicon
  - `FrameworkLayout`（继承 BaseLayout）— s-page + Toolbar + Footer + `.contents` 内容槽系统；
    桥接 pmd.js 的 `conf` 到 `window.streack.conf`，加载 `assets/app/entry.js`
  - `DownloadLayout`（继承 FrameworkLayout）— 下载页三段式（hero/actions/meta）
  - `SelectorLayout`（继承 FrameworkLayout）— 分层选择器整页模式
- **`ToolLayout` / `Sidebar` 已不存在**：全部页面统一到 FrameworkLayout 体系
- `src/components/`：Toolbar、Footer（服务端渲染）、Selector（嵌入选择器）
- `temple/` 为**顶层源模板目录**（5 文件），不在 src/pages，不参与构建
- `public/`：静态资源；`public/webtool/*.html` 与 `public/h5event/` 为原始静态 HTML（仅 SoberJS，Astro 静态透传）
- `dist/` 已提交入 git
- Sitemap：@astrojs/sitemap 集成，filter 排除 404，customPages 自动收录 public/ 静态 HTML

## 命令系统（public/assets/app/framework.js）
- `data-cmd="type:param"` 声明式绑定 → `executeCommand(type, param)`
- 内置类型：url / popurl / state(弃用) / note / slot / copy(cp) / msg
- `registerCommand(type, handler)` 注册自定义类型（popups.js 注册 toolbar/dialog/sheet 等）
- `bindCommandOn(element)` — 对元素及子元素重绑 data-cmd，用于动态插入内容；
  initFramework 初始化时对 document.body 调用一次
- 其他工具：openURL（含嵌套页面识别）、msg、getQueryString、CopyText、存储 API pmdStorage
- 全部导出到 `window.streack.*`

## Selector 分层选择器（public/assets/code/selector.js + selector.css）
- 双模式：整页（`SelectorLayout`）/ 嵌入（`Selector.astro`），共享同一 JS，扫描所有 `[data-selector]` 支持多实例
- 配置结构：`{ title, description?, layerTitle?, options:[{label,hint?,layerTitle?,children?|result?}] }`
- 交互：逐层下钻、层级标题、单选项 700ms 自动前进、scrollIntoView、面包屑回退、结果卡片
- URL 同步：`?selector=id:a.b.c|id2:x.y`（pushState/popstate）；给 `.selector-wrap` 设 id 才启用；
  `data-selector-history="false"` → replaceState 仅改地址栏
- 初始化后移除 DOM 中的 `[data-selector-config]` 脚本

## Markdown 内容管线（2026-09-15 新增）
- **映射规则**：内容根目录 `src/content/`，其下目录结构原样映射为 URL
  - `src/content/<路径>.md` → `/<路径>`；目录内 `index.md` 去掉末尾 index 段
  - 例：`src/content/docs/aaa/index.md` → `/docs/aaa`
- `src/content.config.ts` — Content Collection `content`（glob loader，base `./src/content`，`**/*.md`）
- `src/pages/[...slug].astro` — 根级 catch-all 路由，slug = `entry.id.replace(/(^|\/)index$/, '')`
- `src/layouts/DocLayout.astro` — 继承 FrameworkLayout；正文 `article > .doc-body`
- `public/assets/code/doc.css` — prose 样式；以 `.doc-content .doc-body …` 覆盖 framework.css 的 `.content *` 重置
- Frontmatter（可选）：title / description / keywords / theme
- 正文含顶级 `#` 时不重复渲染 frontmatter 页头

## Sitemap 配置
- 模式：`sitemap-index.xml` + `sitemap-0.xml` 分片输出（与用户其它项目保持一致）
- customPages 自动扫描 `public/` 下所有 HTML，排除 `assets/app/includes/` 和 `assets/archived-file/`
- 外部 sitemap 在 `public/robots.txt` 末尾用 `Sitemap:` 指令添加
- 扫描函数 `findHtmlFiles` 的 base 参数必须固定在最外层，递归时传递不变

## 构建注意事项
- 构建命令：`ASTRO_TELEMETRY_DISABLED=1 npx astro build`
- 所有引用 public/ 或外部 URL 的 `<script>` 必须加 `is:inline`
- HTML `slot` 属性与 Astro 插槽指令冲突，需用 `display:contents` 包裹层隔离
