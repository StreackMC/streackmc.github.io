# Streack 项目长期记忆

## 项目与约定
- 栈流Streack：Minecraft 服务器网站，Astro 5.7 静态站，GitHub Pages（streack.top）；`dist/` 已 gitignore。
- UI：Sober UI（CDN Web Components）。布尔属性必须写 `attr="true"`（裸属性会被抹掉）；`s-page` 的 `dark` 例外。要涟漪反馈用 `<s-icon-button>`；单独 `<s-ripple>` 不会动。
- Git：身份用命令行 `git -c user.name="Neonai" -c user.email="neonai+coding@kdxiaoyi.top" commit`（不写配置）；Conventional Commits + 中文描述；只 add 本次任务文件；不做 push/pull/fetch 等远程操作。

## 代码结构
`public/assets/app/` 分层：
- `frame/`：entry.js / init.js（唯一两个组合根）、dom.js、utils.js、storage.js、fragments.js、init-hooks.js、commands.js、page-config.js、api.js、framework.css
- `component/`：toolbar/、search.js、popups.js、dialog.js、counting.js、video-bg.js、loop-cards.js、selector/
- `config/`：toolbar-presets.js；`page/`：home.js、doc.js、download.js、career.js
依赖方向 `page → component → frame`；旧 `framework.js`、`assets/code/` 已不存在。

## 页面配置与命令
- 唯一数据源是 `<streack>` 标签（Astro 由 FrameworkLayout props 生成，静态 HTML 手写）。`features` 按名动态 import，未声明不下载；`counting` 默认追加；`redirect` 早期跳转。toolbar 配置独立放在 `<template data-toolbar-nav …>`。
- `window.streack.*` 由 api.js 暴露，`window.CopyText` 是兼容别名。`data-cmd="type:param"` → executeCommand；`registerCommand` 可扩展。
- `bindCommandOn` 保留 `data-cmd` 并用 WeakSet 保证幂等；任何 cloneNode / innerHTML 注入后都要重绑，否则克隆件点不动。

## 布局与排版
- BaseLayout → FrameworkLayout → Download/Selector/DocLayout；`temple/` 不参与构建。
- `.content *` 用 `--fs`/`--fl` 调字号，`--fz` 硬覆盖；不要写死 font-size。
- 首栏标题 h1 + PageIcon.astro 图标（`--fs:24px;--fl:42px`）；图标不要塞进标题字符串；Selector 标题用 `set:html`。

## Toolbar
- 品牌 loc / loc-index；`fitToolbarBrand` 三级降级，宽度按全角估算；`setToolbarLoc` 必须 rAF 调度 `fitToolbarBrand`（否则 tooltip 未渲染、宽度误判）。
- 预设表 `config/toolbar-presets.js`，nav 按 id 合并覆写；断点 pc-only `max-width:833px` / mobile-only `min-width:834px`；抽屉用 `grid-template-rows: 0fr→1fr` + transitionend。

## 组件要点
- loop-cards：三段式轨道（前后各一圈克隆）；`cardOffsets` 必须实测；步进按行进方向过滤等价位移、跳转取最近；带过渡归位时先关 transition；进度条用宽度而非 scaleX；样式异步注入后等 `stylesReady()` 再测量；ResizeObserver 防抖重建。`data-speed="0"` = 永不自动滚。
- Selector：多实例；`renderLayer(…, autoScroll)` 控制滚动（初始化不滚，重新选择/面包屑回退也要显式 true）；URL 同步仅在设了 id 时启用，`data-selector-history="false"` 用 replaceState。

## Markdown 管线
- `src/content/**.md` → catch-all `[...slug].astro` + DocLayout；`src/plugins/rehype-doc.mjs` 提供锚点、链接糖、代码复制、callout、复选框、注释合并。
- 改插件后必须 `rm -rf .astro node_modules/.astro node_modules/.vite` 再 build；标题 id 需插件自生成；模板内容用 raw 字符串节点；模板区注释写 `{/* */}`。

## 搜索 / Sitemap
- `summary.js` 扫 dist HTML 生成 `search-suggestion.json`（需先 build）；名单 `summary-list.txt` 按网站路径匹配，`!` 排除。
- sitemap 分片，customPages 扫 public/ 下 HTML，排除 includes 与 archived。

## 构建
- 调试：`npm run build`（= astro build），public/ 资源原样复制，便于排查；`npm run dev` 同样不压缩。
- Release：`npm run build:release` = `npm run build && node tools/minify-public.mjs`，把 dist 中来自 public/ 的 JS/CSS 用 esbuild 压缩并移除全部注释（含 legal comments）；CI 用此命令。`node tools/minify-public.mjs --check` 可校验产物是否为最新压缩结果。
- Astro 默认 `compressHTML: true`；src 打包的 CSS/JS 由 Vite/esbuild 压缩。public/ 图片/HTML/JSON 不在压缩脚本范围内。
- public/ 或外链 `<script>` 必须加 `is:inline`；slot 属性冲突用 `display:contents` 包裹；查产物前先 build（public 透传会留旧文件）。
