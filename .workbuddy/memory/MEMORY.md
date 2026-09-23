# Streack 项目长期记忆

## 项目概述
栈流Streack — Minecraft 服务器网站，Astro 5.7.0 静态站。
- 部署：GitHub Pages（自定义域 streack.top）；`dist/` 已被 .gitignore 忽略
- UI：Sober UI（自定义 Web Components，CDN）。**布尔属性必须写 `attr="true"`**（裸属性被组件抹掉）

## Git 提交规则
- 身份必须命令行携带：`git -c user.name="Neonai" -c user.email="neonai+coding@streack.top" commit ...`（不写配置）
- Conventional Commits + 中文描述；只 `git add` 必要文件，禁止盲目 `git add .`

## JS / CSS 目录结构（2026-09-23 重构，M1–M6 六个批次）
`public/assets/app/` 按层收纳：
- **frame/** — 底层，不依赖组件
  - `entry.js` 浏览器启动入口（组合根）· `init.js` initFramework 主流程（组合根）
  - `dom.js`(DOM/SAME_REIGON/refreshToolbarDOM) · `utils.js`(getQueryString/openURL/msg/CopyText/时区)
  - `storage.js`(pmdStorage) · `fragments.js`(loadFragment) · `init-hooks.js`(requestInitFunc)
  - `commands.js`(registerCommand/executeCommand/bindCommandOn) · `page-config.js` · `api.js`
  - `framework.css` 全站基础样式（`.content` 排版系统）
- **component/** — 各组件（自包含、可解耦）
  - `toolbar/toolbar.js`(插槽管理 + toolbar2 注册) · `toolbar/toolbar-nav.js`(品牌 loc / loc-index /
    toolbar-set / nav 合并) · `toolbar/toolbar.css`
  - `search.js`+`search.css` · `popups.js`(toolbar/dialog/sheet 命令) · `dialog.js`+`dialog.css`
  - `counting.js`(运营计时器) · `video-bg.js` · `loop-cards.js` · `selector/selector.js`+`selector.css`
- **config/** — 代码驱动的配置：`toolbar-presets.js`
- **page/** — 页面特有：`home.js` · `doc.js`+`doc.css` · `download.js` · `career.js`

依赖方向：`page → component → frame`；`config` 被两侧读取。frame 里只有 `entry.js` / `init.js` 是
**组合根**（唯一允许引用 component 的 frame 模块）。
⚠️ 原 `app/framework.js`（1286 行巨石）与 `assets/code/` 目录已不存在 —— 前者拆为 frame/ + component/，
后者的 selector 归入 component/、其余归入 page/。

## 页面配置模型（<streack> 标签）
- **唯一数据源 = `<streack>` 标签**：Astro 页面用 `FrameworkLayout` 的 props 声明（构建期落成该标签），
  非 Astro 的静态 HTML 页面直接手写；两种写法语义相同，框架只认一种读法。
- `features`：可选组件清单（空格/逗号分隔）→ `frame/page-config.js` 按名动态 import，
  **未声明的组件不会被下载**；`counting` 是默认组件（FrameworkLayout 自动追加）。
  注册表 `featureRegistry` 在 page-config.js；新增组件写 init 函数后登记即可。
- `redirect`：声明式重定向 —— initFramework 早期 `location.replace` 并 return（中转页用）。
- ⚠️ **toolbar 配置不在 <streack> 里**，仍在 `<template slot="toolbar-nav" data-toolbar-nav>`
  （loc / loc-index / toolbar-set / replaceset），这是刻意的语义划分（"我专门管这个"）。

## 全局 API 与命令系统
- `window.streack.*` 由 `frame/api.js` 一处暴露；`window.CopyText` 是保留的**兼容别名**
  （首页 HTML 的 `onclick="CopyText('…')"` 依赖它；规范写法是 `window.streack.CopyText`）。
- `data-cmd="type:param"` 声明式绑定 → `executeCommand`；内置 url / popurl / state(弃用) / note /
  slot / copy(cp) / msg；`registerCommand` 扩展（popups.js 注册 toolbar/tb、dialog/dlg、sheet/bst）。
- `bindCommandOn(element)` 用于动态插入内容后重绑；initFramework 对 body 调用一次。

## 布局层级与排版系统
- 三层继承：BaseLayout（骨架 + Sober CDN + 字体）→ FrameworkLayout（s-page + Toolbar + Footer +
  `.contents` 槽；桥接 pmd.js 的 conf；加载 `frame/entry.js`；输出 `<streack>` 配置标签）
  → DownloadLayout / SelectorLayout / DocLayout
- `ToolLayout` / `Sidebar` 已不存在；`temple/` 是顶层源模板目录（5 文件，不参与构建）
- `.content *` 是排版基石：子元素统一吃 `text-align: var(--a,left)` /
  `font-size: var(--fz, clamp(var(--fs), var(--fv), var(--fl)))` / `margin: var(--my,0) var(--mx,0)`
  - `--fs`/`--fl` 端点字号，视口 320→1352px 线性插值；`--fz` 是硬覆盖（绕过 clamp）
  - **调字号一律给 `--fs`/`--fl`，不要写 `font-size`**（类选择器的死字号会盖过 `.content *`）；
    要覆盖就用元素内联样式
- 首栏标题（DownloadLayout.heading / SelectorLayout.config.title）：`<h1>` + 图标独占上方一行，
  `--fs:24px;--fl:42px`；图标由 `src/components/PageIcon.astro` 渲染（`icon_svg` 优先 `icon_src`）
  - ⚠️ 别把图标塞进标题字符串（Astro 插值会转义成源码文本）；SelectorLayout 标题须 `set:html`

## Toolbar 机制（品牌 loc / loc-index / toolbar-set）
- 品牌：`#toolbar-brand` > `#toolbar-brand-en`(Streack，窄屏可隐藏) + `#toolbar-brand-loc`(loc 后缀)
- `setToolbarLoc`（自动补「·」）· `setToolbarLocIndex`（点击 loc 跳转，stopPropagation 阻止冒泡到品牌）
  · `fitToolbarBrand` 三级降级：全显示 → 隐藏英文名 → 隐藏整个品牌（只留按钮）
  - 宽度判定用**全角字符估算**（每字按 1em，半角英文也按全角 → 留冗余），避免实测偏窄误判
  - **⚠️ setToolbarLoc 必须 rAF 调度 fitToolbarBrand**：同步调用时 s-tooltip（搜索/汉堡）尚未完成
    内部渲染，`getBoundingClientRect().width` 为 0 → 可用宽度被高估 → 极窄时品牌不隐藏
- 预设表 `config/toolbar-presets.js`：`Map<名称,{loc,locIndex,nav}>`，含 `document` / `about` /
  `example-of-section`（`%section%` 占位符）；**预设按钮都带 id**（doc-* / about-* / ex-*）
- 用法：`<template slot="toolbar-nav" data-toolbar-nav toolbar-set="…" loc="…" loc-index="…"
  replaceset='{"k":"v"}'>`；Markdown `nav-preset: document` 或 `{ set, loc, loc-index, replaceset }`
- 合并：loc / loc-index「自身有值用自身，否则继承预设」，都做 `%xxx%` 替换（未提供值原样保留）；
  nav **合并** —— preset 与 template 按钮都显示，template 带 id 且命中 preset 同 id → 覆写（保持原位置），
  否则追加末尾
- **断点约定**：`[pc-only]` 用 `max-width:833px`、`[mobile-only]` 用 `min-width:834px` —— 必须错开 1px，
  都用 834px 会让 834px 处导航项全部消失
- 抽屉动画：`#toolbar-area` 用 `grid-template-rows: 0fr→1fr`（600ms），`#toolbar2` opacity 淡入延迟 150ms；
  `expandToolbar` 用 `grid-template-rows` 的 **transitionend** 代替 setTimeout 魔法数字，
  动画期间加 `.toolbar2-disallow-scroll` 防滚动条闪现

## 组件要点
- **loop-cards**（`component/loop-cards.js`，当前无页面在用）：容器 `<div class="loop-cards" data-speed="1">`，
  直接子元素即卡片；页面写 `features="loopCards"` 按需加载。
  ⚠️ 两处「文档说有、实际没有」：悬停暂停未实现；点击卡片点不到（track 的 `pointer-events:none` 被继承）
- **Selector**（`component/selector/`）：双模式（SelectorLayout 整页 / Selector.astro 嵌入），
  扫描所有 `[data-selector]` 支持多实例；配置 `{title,description?,layerTitle?,options:[…]}`；
  初始化后移除 `[data-selector-config]` 脚本
  - **滚动时机**由 `renderLayer(…, autoScroll)` 第 4 参决定：初始化不滚（第 0 层紧贴标题）；
    下钻滚；**用户主动的「重新选择」与面包屑回退回到第 0 层也必须显式传 true**（用 depth 推断不可靠）
  - **URL 同步两级开关**（只认设了 id 的实例）：不设 id → 完全不用（不读参数、不写 URL、不产生历史条目）；
    设了 id → `?selector=id:a.b|id2:x.y` + popstate 重放；默认 pushState，
    `data-selector-history="false"` → 一律 replaceState。**push/replace 判断必须按 participants**

## Markdown 内容管线与增强
- `src/content/<路径>.md` → `/<路径>`（目录内 index.md 去掉 index 段）；`[...slug].astro` 根级 catch-all；
  `DocLayout.astro` 渲染（正文 `article > .doc-body`，`page/doc.css` 提供 prose 样式）
- `src/plugins/rehype-doc.mjs`（astro.config 的 markdown.rehypePlugins）构建期产出：标题锚点、
  链接语法糖（↗/$/฿ → 新标签页）、代码块复制按钮、callout（`[i]/[!]/[x]/[@]/[#hex$tip]`）、
  GFM 复选框 → `<s-checkbox disabled="true">`、注释合并（`[^1]:` 或 `<!-- notes -->` + 列表 →
  `<template data-inject="notes">`，条内容必须行内，`<p>` 会让 ↗ 换行）
- `page/doc.js` 只做客户端交互：代码复制（复用 CopyText 的 silent + onSuccess）、目录 ≥40dvh 默认折叠
- **坑（高频）**：Astro 缓存渲染结果与插件模块 → 改 rehype 插件后必须
  `rm -rf .astro node_modules/.astro node_modules/.vite` 再 build，否则静默不生效
- 坑：Astro 的 rehypeHeadingIds 在用户插件之后运行 → 插件里需自行生成标题 id
- 坑：不能用 hast `content` 构建 `<template>`（rehype-raw 往返会清空）→ 用 raw 字符串节点承载
- 坑：remark-gfm 的 `dataFootnoteBackref` 是空字符串，判断存在性要用 `!== undefined`
- 坑：模板区（`---` 之后）的 `/* … <Foo /> … */` 仍会被编译成组件调用，须用 `{/* */}`；
  `temple/*.astro` 不参与构建，改完要临时复制到 `src/pages/` 下 build 校验（目录名不能以 `_` 开头）

## Sober UI 约束（sober@1.0.6）
- 布尔属性必须写 `attr="true"`：`syncProps` 用 `v === "true"` 转换，裸属性 → false → 被 removeAttribute。
  例外：`s-page` 的 `dark`（`:host([dark])` 看存在性）
- 常用 API：`s-fold(folded, 插槽 trigger)` / `s-switch(checked)` / `s-checkbox(checked, indeterminate)` /
  `s-button(type)` / `s-card(type, clickable)`；目录折叠用 s-fold + CSS 按 `[folded]` 旋转 chevron

## 搜索数据（summary.js）与 Sitemap
- `summary.js`：扫描 `dist/**/*.html`，LLM 生成 summary/keywords，更新
  `public/assets/search-suggestion.json`（压缩单行 JSON，`--pretty` 可缩进）；密钥 `secret.json`（gitignore）；
  需先 build 再跑。名单 `summary-list.txt`：只总结命中页面，模式匹配**网站路径**，支持 `*`/`**`/`?`，
  `!` 前缀强制排除（排除优先）
- Sitemap：@astrojs/sitemap 分片输出；customPages 扫描 public/ 下 HTML，排除 includes 与 archived

## 构建注意事项
- 构建：`ASTRO_TELEMETRY_DISABLED=1 npx astro build`
- 引用 public/ 或外部 URL 的 `<script>` 必须加 `is:inline`
- HTML `slot` 属性与 Astro 插槽指令冲突 → 用 `display:contents` 包裹层隔离
- ⚠️ 沙箱有「批量删除守卫」：build 清理 dist（>50 文件）会被拦，旧产物需手动 `rm`
- ⚠️ 查产物前务必先 build：`public/` 是直接复制，增量构建会留下已删源文件的旧产物
