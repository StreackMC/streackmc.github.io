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
  - `DownloadLayout`（继承 FrameworkLayout）— 下载页：**首栏标题** + 三段式（hero/actions/meta）
  - `SelectorLayout`（继承 FrameworkLayout）— 分层选择器整页模式
- **首栏标题（2026-09-20 转正）**：`DownloadLayout` 的 `heading` / `SelectorLayout` 的 `config.title`
  渲染为 `<h1>`，布局取自 `about/contact.astro` 首栏（整体居中、图标独占标题上方一行），
  但**字号沿用下载页** `--fs:24px; --fl:42px; margin: 4rem auto 1.5rem;`
  - 图标：两个布局都提供可选参数 `icon_svg`（内联 SVG 源码 → 包进 `<s-icon>`，s-icon 模板即
    `<slot>`，支持自定义 SVG）与 `icon_src`（图片地址 → 包成 `<img>`）；
    两者都给以 **svg** 为准，都不给**不渲染**；由共用组件 `src/components/PageIcon.astro` 实现
    （输出「图标 + `<br>`」，尺寸 `width:1.5em; margin-bottom:.5em` 随标题字号缩放）
  - ⚠ 别把图标塞进标题字符串：Astro 文本插值 `{x}` 会转义 HTML → 图标变成源码文本；
    也不要用 `textContent` 注入含 HTML 的标题（`selector.js` 层标题已改 `innerHTML`）
- **`.content *` 布局变量**（framework.css，站点排版的基石）：子元素统一吃
  `text-align: var(--a, left)` / `font-size: <见下>` / `margin: var(--my,0) var(--mx,0)`
  - 字号：`font-size: var(--fz, clamp(var(--fs), var(--fv), var(--fl)))`
    - `--fs` / `--fl` = 端点字号；`--min-width: 320px`、`--max-width: 1352px`（视口宽）
    - `--fv` 默认 = `--fs + (--fl - --fs) * (--w - --min-width) / (--max-width - --min-width)`
      → 视口从 320px 到 1352px **线性插值**，超出则被 clamp 钉在端点上
    - `--fz` 是**硬覆盖**，会完全绕过 clamp（需要「任何宽度都不变」时才用）
  - **约定**：调字号一律给 `--fs`/`--fl`，**不要写 `font-size`** —— 类选择器写死的 `font-size`
    会盖过 `.content *`，反而让内联的 `--fs` 失效。要覆盖就用**元素内联样式**
    （内联 > 类选择器，可盖掉写死的 font-size 与 `.content *` 的 margin）
  - 实例：下载页首栏 `--fs:24px;--fl:42px`、正文 `--fs:1rem;--fl:1.2rem`；
    选择器页标题 `--fs:1.5rem;--fl:2.5rem`、描述 `--fs:1rem;--fl:1.2rem`（两者同机制）
- **`ToolLayout` / `Sidebar` 已不存在**：全部页面统一到 FrameworkLayout 体系
- `src/components/`：Toolbar、Footer（服务端渲染）、Selector（嵌入选择器）、PageIcon（首栏图标）
- `temple/` 为**顶层源模板目录**（5 文件），不在 src/pages，不参与构建
- `public/`：静态资源；`public/webtool/*.html` 与 `public/h5event/` 为原始静态 HTML（仅 SoberJS，Astro 静态透传）
- `dist/` 已被 `.gitignore` 忽略（不再提交入 git，构建产物仅本地/CI 生成）
- Sitemap：@astrojs/sitemap 集成，filter 排除 404，customPages 自动收录 public/ 静态 HTML

## 命令系统（public/assets/app/framework.js）
- `data-cmd="type:param"` 声明式绑定 → `executeCommand(type, param)`
- 内置类型：url / popurl / state(弃用) / note / slot / copy(cp) / msg
- `registerCommand(type, handler)` 注册自定义类型（popups.js 注册 toolbar/dialog/sheet 等）
- `bindCommandOn(element)` — 对元素及子元素重绑 data-cmd，用于动态插入内容；
  initFramework 初始化时对 document.body 调用一次
- 其他工具：openURL（含嵌套页面识别）、msg、getQueryString、CopyText、存储 API pmdStorage
- 全部导出到 `window.streack.*`

## Toolbar 预设与品牌后缀 loc（2026-09-20）
- 品牌拆分：Toolbar.astro 里 `#toolbar-brand` > `#toolbar-brand-en`(英文 Streack，窄屏可隐藏) + `#toolbar-brand-loc`(loc 后缀位)
- framework.js 新增导出：`setToolbarLoc(text)`（自动补「·」）、`setToolbarLocIndex(url)`（点击 loc 跳转）、
  `fitToolbarBrand()`（品牌响应式适配，见下）、`applyToolbarNavTemplates()`（解析 `<template data-toolbar-nav>`）、
  `parseReplaceset` / `fillPlaceholders`（`%xxx%` 替换，未提供的占位符原样保留）、
  `mergeNavNodes(presetNodes, ownNodes)`（导航合并，见下）
- **loc-index**：与 loc 配套，点击 loc 后缀文字跳转到指定地址（取代「点击品牌默认跳首页」）。
  优先级元素自身 > 预设；未设置则点击冒泡到品牌、恢复跳首页。
  预设字段 `locIndex`（如 `document` 预设 `locIndex:'/doc/'`），frontmatter 字段 `loc-index`
- `fitToolbarBrand()` 三级降级（仅配置 loc 时介入）：
  ① 全显示「栈流Streack·loc」→ ② 放不下隐藏英文名 → ③ 还放不下隐藏整个品牌（只留按钮）
  宽度判定用**全角字符估算**：每个「字」（去空白）按 1em 计，半角英文也按全角算 → 留设计冗余，
  避免实测宽度（半角偏窄）导致的误判；节流用 **rAF**（非 setTimeout）
- **⚠️ setToolbarLoc 必须用 rAF 调度 fitToolbarBrand，不能同步调用**：同步调用时 s-tooltip
  （搜索/汉堡按钮）尚未完成内部渲染，`getBoundingClientRect().width` 为 0，可用宽度被高估、
  降级判断不足（只到「隐藏英文」、到不了「隐藏整个品牌」）——这是「极窄品牌未隐藏」的根因
- **响应式断点约定**：移动端 ≤833px、桌面 ≥834px（两者错开 1px）——
  framework.css 里 `[pc-only]` 用 `max-width:833px` 隐藏、`[mobile-only]` 用 `min-width:834px` 隐藏，
  **不可都用 834px**（否则 834px 处两者同时隐藏、导航项全部消失）
- 预设表 `public/assets/app/toolbar-presets.js`：`Map<名称, { loc, locIndex, nav }>`，现含
  `document` / `about` / `example-of-section`（后者用 `%section%` 演示占位符）；
  `registerToolbarPreset` / `getToolbarPreset` 可运行时扩展；**预设按钮都带 id**（doc-* / about-* / ex-*）
- 用法两种：Astro `<template slot="toolbar-nav" data-toolbar-nav toolbar-set="document" loc-index="…">`；
  Markdown frontmatter `nav-preset: document`（简写）或 `{ set, loc, loc-index, replaceset }`（对象）
- 合并规则：
  · loc / loc-index：元素自身属性有值用自身，否则继承预设（两者都做占位符替换）
  · nav：preset 按钮与 template 按钮**合并**（都显示）——template 按钮带 id 且命中
    preset 同 id → 覆写（保持 preset 原位置）；否则（无 id / 未命中）→ 追加到末尾；
    占位符替换同时作用于 preset 与 template
- `content.config.ts` 加 `nav-preset` schema（含 loc-index）与 `nav` 项可选 `id` 字段；
  `DocLayout.astro` 转成 template 属性（toolbar-set / loc / loc-index / replaceset）

## loop-cards 循环卡片组件（自研轮播，无文档、当前未使用）
- 位置：`public/assets/app/framework.js` 的 `export function initLoopCards()`（约 865 行）
  + `public/assets/app/framework.css` 的 `.loop-cards` / `.loop-cards-track`（约 478–519 行）
- **用法**：容器 `<div class="loop-cards" data-speed="1">`，**直接子元素即卡片**
  （框架会把它们搬进自动生成的 `.loop-cards-track`，并在需要时克隆一份做无缝回绕）
  - `data-speed` = 速度倍率（实际速度 = `1.2 * 倍率` px/帧）；缺省 1.0
- **行为**：rAF 每帧 `translateX(-offset)` 向左无限滚动；内容宽度 ≤ 容器宽度时居中且不滚；
  `window.streack.flag.noAnimation` 可全局停动画；`document.hidden` 时暂停（回前台继续）
- ⚠️ **两处「文档说有、实际没有」的行为**（改之前先确认要不要保留）：
  - **鼠标悬停暂停：未实现** —— `running` 只由 `visibilitychange` 控制
    （原 JSDoc 写着「鼠标悬停停止滚动」，是过时描述，已订正）
  - **点击卡片：实际点不到** —— 代码里有事件委托把克隆体点击映射回原始卡片，
    但 `framework.css` 给 `.loop-cards-track` 加了 `pointer-events: none`，
    而该属性**会被子元素继承**（`.loop-cards-track > div` 没有重开）→ 卡片收不到指针事件，
    委托是死代码。`pointer-events: none` 是 `93c4ff3`（2026-07-05 解耦合 Jekyll/H5）引入的，
    初版(`825c083`)没有 —— 疑似那次重构的副产物（也可能是为了让点击穿透到父级可点横幅）
- **初始化入口**：首页脚本 `public/assets/code/home.js`（`requestInitFunc` 内调用）；
  另 framework.js 监听 window resize（防抖 300ms）重新初始化。
  `requestInitFunc` 在框架已就绪时会**立即执行**，故页面脚本注册时机不会有问题
- ⚠️ 它**只导出为 ES module**，没有挂到 `window.streack.*`
- **用法文档**：已写入 `temple/page.astro`（详细版）与 `temple/page-clean.astro`（精简版）的
  「内容块示例 5」+ 页面脚本里的 `initLoopCards()` 调用
- **现状：没有任何页面在用**（`src/pages/index.astro` 里已无 `.loop-cards`）。
  历史：`825c083`(2026-07-04「添加循环卡片组件」)首页启用 → 之后被注释掉 →
  Astro 迁移(`71f26ed`)时 HTML 用法彻底丢失，只剩 JS/CSS，于是「记得有但找不到」

## Selector 分层选择器（public/assets/code/selector.js + selector.css）
- 双模式：整页（`SelectorLayout`）/ 嵌入（`Selector.astro`），共享同一 JS，扫描所有 `[data-selector]` 支持多实例
- 配置结构：`{ title, description?, layerTitle?, options:[{label,hint?,layerTitle?,children?|result?}] }`
- 交互：逐层下钻、层级标题、单选项 700ms 自动前进、scrollIntoView、面包屑回退、结果卡片
- **滚动时机**由 `renderLayer(options, depth, layerTitle, autoScroll)` 第 4 参决定（缺省 = `depth > 0`）：
  - 初始化（页面加载 / URL 驱动）**不滚** —— 第 0 层紧贴页面标题，居中滚动会把标题顶出视口；
  - 下钻出的新层（depth > 0）滚至居中；
  - **用户主动的「重新选择」与面包屑回退，回到第 0 层也必须显式传 `true`**
    （曾用 `depth > 0` 一刀切，把这俩的滚动一起掐掉 → 点「重新选择」后停在空白处）
  - 教训：用 depth 推断「是不是初始化」不可靠，第 0 层既有初始化也有用户回退，必须由调用方显式表达意图
- URL 同步是**两级开关**（`syncURL` 只认「设了 id 的实例」= participants）：
  - **不设 id → 完全不使用该功能**：`participants.length === 0` 时直接 return，
    不读参数、不写 URL、不产生任何历史条目（连 replaceState 都不调）
  - **设了 id → 参与**：`?selector=id:a.b.c|id2:x.y`，加载时逐层选中 + popstate 重新应用；
    默认 pushState；`data-selector-history="false"` → 一律 replaceState
  - **坑**：判断 push/replace 必须按 **participants** 而非「有路径的实例」。
    曾用后者 → `path` 清空时（点「重新选择」/ 回退到根层）退化成无条件 pushState，
    使 `history=false` 失效，且不设 id 的页面也会被塞进一条历史记录
- 首栏图标参数（两个布局共用 `src/components/PageIcon.astro`）：
  `icon_svg`（内联 SVG，包进 `<s-icon>`，优先）/ `icon_src`（图片，包成 `<img>`）；
  都不给（或空串）则不渲染；渲染在标题上方一行（自带 `<br>`），1.5em 随字号缩放。
  **只属于整页模式** —— 嵌入组件 `Selector.astro` 不渲染首栏，故无此参数
- 初始化后移除 DOM 中的 `[data-selector-config]` 脚本
- **配置字段可含 HTML**（如 `title` 内联 `<s-icon><svg>…</svg></s-icon>`；`s-icon` 模板就是 `<slot>`，支持自定义 SVG）：
  `title`/`description` 在 `SelectorLayout` 里**必须用 `set:html`** —— Astro 文本插值 `{x}` 会转义成
  `&lt;s-icon…&gt;`，图标就变成可见源码；`label`/`hint`/`result.content`/面包屑由 `selector.js`
  以 `innerHTML` 注入，天然支持；**层标题**也曾用 `textContent`（已改 `innerHTML`，因 layerTitle 会
  fallback 到 `config.title`/`option.label`）
- 提醒：`dist/` 是构建产物，**改了源码要先 build 再查产物**（曾因看到旧产物而差点误判）

## Markdown 内容管线（2026-09-15 新增）
- **映射规则**：内容根目录 `src/content/`，其下目录结构原样映射为 URL
  - `src/content/<路径>.md` → `/<路径>`；目录内 `index.md` 去掉末尾 index 段
  - 例：`src/content/docs/aaa/index.md` → `/docs/aaa`
- `src/content.config.ts` — Content Collection `content`（glob loader，base `./src/content`，`**/*.md`）
- `src/pages/[...slug].astro` — 根级 catch-all 路由，slug = `entry.id.replace(/(^|\/)index$/, '')`
- `src/layouts/DocLayout.astro` — 继承 FrameworkLayout；正文 `article > .doc-body`
- `public/assets/code/doc.css` — prose 样式；以 `.doc-content .doc-body …` 覆盖 framework.css 的 `.content *` 重置
- Frontmatter（可选）：title / description / keywords / theme / **toc**（`toc: false` 则该页不渲染页首目录）/ nav
- 正文含顶级 `#` 时不重复渲染 frontmatter 页头

## Markdown 增强渲染（rehype，2026-09-17；源自旧站 pmd 的客户端增强）
- `src/plugins/rehype-doc.mjs` — rehype 插件（`astro.config.mjs` 的 `markdown.rehypePlugins`）：
  - 标题补 `id` + `.heading-anchor` 按钮
  - **链接语法糖**：链接文字含 `↗`/`$`/`฿` → 新标签页 + `.ext-link`（CSS 箭头）；默认链接当前窗口
  - 代码块 `.code-block` 容器 + `.code-copy`；引用块 `.doc-callout`（`[i]/[!]/[！]/[x]/[@]/[#hex$tip]`）
  - 任务列表 `<input type=checkbox>` → Sober `<s-checkbox disabled="true" [checked="true"]>`
  - **注释合并**（第 7 项）：两种注释写法都搬到页脚注释区 ——
    A. `[^1]: …`（remark-gfm 脚注）→ 拆成 `li[data-note="1"]` + 正文 `sup[data-note="1"]`
    B. 单独一行 `<!-- notes -->` + 紧随的 ul/ol → 列表整体搬走，token 为 `notes-1`、`notes-2`…
    （必须显式标记：全站 17 篇的末尾块就是正文列表，自动判定会误伤）
    产出 `<template data-inject="notes">`，由 `framework.js` 注入 `ol#notes` 并与 `sup` 双向绑定。
    **条目内容必须行内**：框架把 `↩` append 到 `<li>` 末尾，若内容被 `<p>` 包着箭头会换行
    → 抽出时用 `unwrapParagraphs()` 展开 `<p>`（多段之间补 `<br>`）；页脚注释区无任何 CSS
  - 图片仅加 `loading=lazy`（**图片查看器已移除**，不再有 `.doc-img`/灯箱）
- `DocLayout.astro` — `render()` 的 `headings` 服务端生成 TOC（`.doc-toc`，**折叠复用 Sober `<s-fold>`** +
  180° 旋转箭头，见下「Sober UI 组件约束」）；
  **frontmatter `nav` → 工具栏导航插槽**（`<template data-toolbar-nav>`，标题栏智能插槽）
- `public/assets/code/doc.js` — 仅客户端交互：代码复制 + 目录自动折叠（≥40dvh 设 `folded='true'`）
- `doc.css` — 上述增强的样式
- **坑 1**：Astro 的 `rehypeHeadingIds` 在用户 rehype 插件**之后**运行 → 插件里标题还没有 id；
  需自行生成 id（Astro 尊重已有 id，且 `headings[].slug` 即取该 id，故 TOC 与锚点一致）
- **坑 2（高频）**：Astro 会缓存渲染结果（`node_modules/.astro` 数据存储）与配置插件模块
  （`node_modules/.vite`）→ **改插件后必须 `npm run clean` 再 build/dev**，否则静默不生效
- **坑 3**：遍历 blockquote 找标记时，首个文本节点常是空白，需跳过
- **坑 4**：**不能用 hast 的 `content` 构建 `<template>`**。Astro 在用户插件**之后**还跑 `rehype-raw`，
  而 `hast-util-to-html` 对 template 只序列化 `node.content`；rehype-raw 的「序列化→重解析」往返
  会把 content 清空 → 产物变空模板。**解法**：整段模板用 **raw 字符串节点**承载
  （`{type:'raw', value:'<template data-inject="notes">…</template>'}`），交给 rehype-raw 解析。
  另：`<!-- notes -->` 在此阶段是 **raw 节点**（非 comment），且与其后元素间夹着空白 text 节点。
- **坑 5**：remark-gfm 的 `dataFootnoteBackref` 值是**空字符串**（`dataFootnoteRef` 才是 `true`），
  判断存在性要用 `!== undefined`，否则漏掉 ↩ 返回链接。
- **集成**：Markdown 里也可直接写原始 HTML `<template data-toolbar-nav>…</template>`（已验证生效）

## Sober UI 组件约束（sober@1.0.6，**布尔属性必须写 `attr="true"`**）
- 组件基类对 props 走 `syncProps`，setter 用 `Ye(v, default)` 转换；布尔转换 = `v === "true"`，
  且 `attributeChangedCallback` 把属性**值**字符串赋给属性。
- **裸布尔属性会失效**：`<s-checkbox checked>`（属性值 `""`）→ `Ye("",false)=false` = 默认值
  → 组件立刻 `removeAttribute` 抹掉属性；而样式一律是 `:host([checked=true])`（比较属性**值**）
  → 表现为「不勾选 / 不禁用 / 不折叠」。**必须写 `checked="true"` / `disabled="true"` / `folded="true"`。**
- hast（rehype 插件）侧：`properties: { disabled: 'true' }` → `disabled="true"`（正确）；
  `properties: { disabled: true }` → 裸 `disabled`（错误）。已用 hast-util-to-html 实测。
- 唯一例外：`s-page` 的 `dark` 用 `:host([dark])`（**存在性**）→ `setAttribute("dark","")` 是对的。
- 常用组件 API：`s-fold`(`folded`, 插槽 `trigger`+默认)、`s-switch`(`checked`,`disabled`)、
  `s-checkbox`(`checked`,`indeterminate`,`disabled`)、`s-button`(`disabled`,`type`)、`s-card`(`type`,`clickable`)
- 目录折叠实现：`<s-fold class="doc-toc" data-doc-toc>` + `div[slot=trigger]`（标题 + 旋转箭头 SVG）
  + 内容区；`doc.js` 仅需判定 `≥40dvh` 设 `folded='true'`。
  **指示物选语义正确的**：折叠用 180° 旋转 chevron（CSS 按 `[folded]` 旋转），**不要用 `s-switch`**。

## 搜索数据生成脚本（summary.js，2026-09-15 新增）
- 根目录 `summary.js`：扫描 `dist/**/*.html`（实际渲染页面），LLM 生成 `summary`(全文概要)+`keywords`，
  更新 `public/assets/search-suggestion.json`
- 搜索数据条目字段：`{ link, keywords[], title, summary }`
  - `title` = **真·文章标题**（取自页面 `<title>`，去站点名后缀；非 LLM 生成）
  - `summary` = LLM 生成的全文概要；`keywords` = LLM 生成的搜索关键词
  - 条目由 `assets/app/search.js` 消费（当前 UI 仅用到 `title`）
- **输出格式**：`search-suggestion.json` 写为**压缩（单行）标准 JSON**；`--pretty` 可切换为缩进格式
- 密钥 `secret.json`（已 gitignore；对象或数组皆可）：`apiKey / baseURL / model / useStreamAPI / useResponseAPI`
- 依赖（devDependencies）：`ai` / `@ai-sdk/openai` / `node-html-parser` / `zod`
- LLM 策略：结构化输出优先，失败回退「文本 + 提取 JSON + zod」；整体重试 3 次
- 写出默认“合并”（保留未覆盖旧条目，如外部 `/doc/**`）；选项 `--dry-run` / `--no-write` / `--replace` / `--limit` / `--pretty` / `--dir`
- **名单（2026-09-20 新增）**：根目录 `summary-list.txt` 一行一个模式，**只总结命中名单的页面**；
  模式匹配**网站路径**（非 dist 文件路径），支持 `*`（不跨 `/`）/ `**`（跨层级）/ `?`；
  开头 `/` 可省略，`dir/` 等价 `dir/**`；**不带通配符的目录名同时覆盖其下所有页面**；
  **`!` 前缀 = 强制排除（排除始终优先，与顺序无关）**；只写排除项时基准为全部页面；
  名单为空/文件不存在则不过滤（保持原行为）；模式零命中会告警（查笔误）；`--only "a,b"` 可临时覆盖名单
- VSCode 任务：`Generate Search Suggestions`（`astro build && node summary.js`）
- 运行：`node summary.js`（需先 build）

## Sitemap 配置
- 模式：`sitemap-index.xml` + `sitemap-0.xml` 分片输出（与用户其它项目保持一致）
- customPages 自动扫描 `public/` 下所有 HTML，排除 `assets/app/includes/` 和 `assets/archived-file/`
- 外部 sitemap 在 `public/robots.txt` 末尾用 `Sitemap:` 指令添加
- 扫描函数 `findHtmlFiles` 的 base 参数必须固定在最外层，递归时传递不变

## 构建注意事项
- 构建命令：`ASTRO_TELEMETRY_DISABLED=1 npx astro build`
- 所有引用 public/ 或外部 URL 的 `<script>` 必须加 `is:inline`
- HTML `slot` 属性与 Astro 插槽指令冲突，需用 `display:contents` 包裹层隔离
- **模板体里的普通块注释保护不了 JSX**：在 `---` 之后的模板区写 `/* … <Foo /> … */`，
  Astro 仍会把 `<Foo />` 编译成组件调用 → 未导入时报 `Foo is not defined`。
  模板区必须用 **JSX 注释 `{/* … */}`**（前台的 `---` 里才是真 JS 块注释，那里写 `/* */` 没问题）。
  `temple/*.astro` 不参与构建，所以这类错误平时看不见 —— **改完 temple 要临时复制到
  `src/pages/<目录>/` 再 build 校验一次**；注意目录名不能以 `_` 开头（Astro 忽略下划线开头的路径）。
