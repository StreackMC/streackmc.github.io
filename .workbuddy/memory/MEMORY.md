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

## Markdown 增强渲染（rehype，2026-09-17；源自旧站 pmd 的客户端增强）
- `src/plugins/rehype-doc.mjs` — rehype 插件（`astro.config.mjs` 的 `markdown.rehypePlugins`）：
  - 标题补 `id` + `.heading-anchor` 按钮
  - **链接语法糖**：链接文字含 `↗`/`$`/`฿` → 新标签页 + `.ext-link`（CSS 箭头）；默认链接当前窗口
  - 代码块 `.code-block` 容器 + `.code-copy`；引用块 `.doc-callout`（`[i]/[!]/[！]/[x]/[@]/[#hex$tip]`）
  - 任务列表 `<input type=checkbox>` → Sober `<s-checkbox disabled="true" [checked="true"]>`
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
