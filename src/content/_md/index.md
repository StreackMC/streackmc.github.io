---
title: 文档中心
description: 栈流Streack 站内文档 —— 使用 Markdown 编写，自动映射为网站路径。
keywords: 栈流,Streack,文档,Markdown
---

本站点使用 **Markdown 内容管线**：把 `.md` 文件放进 `src/content/` 目录，
即自动发布到与之对应的网站路径下，并套用站点统一的样式与渲染增强。

## 路径映射规则

内容根目录为 `src/content/`，**其下的目录结构原样映射为 URL 路径**：

| Markdown 文件 | 生成的网址 |
| --- | --- |
| `src/content/doc/index.md` | `/doc` |
| `src/content/doc/policy/rule.md` | `/doc/policy/rule` |
| `src/content/about/legal/tos/all_zh-cn.md` | `/about/legal/tos/all_zh-cn` |
| `src/content/_md/index.md` | `/_md` |

要点：

- 目录形式的 `index.md` 会自动去掉末尾的 `index` 段；
- 扩展名 `.md` 不参与 URL；
- 把文件放进什么目录，就发布到同名网址，**无需任何额外配置**。

> [@] 新增文档时，只需新建 `src/content/...` 下的 `.md` 文件，保存即生效。

## Frontmatter（可选）

文件顶部可选的 `---` 元数据块支持以下字段，**全部可省略**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `title` | 文本 | 页面标题，用于 `<title>` 与页头 |
| `description` | 文本 | meta description |
| `keywords` | 文本 | meta keywords，逗号分隔 |
| `theme` | `light` / `dark` | 页面配色，默认 `light` |
| `toc` | 布尔 | 是否渲染页首目录，默认 `true` |
| `nav` | 列表 | 工具栏导航项，见下 |
| `nav-preset` | 文本 / 对象 | 工具栏预设：继承预定义的品牌后缀与导航项，见下 |

```yaml
---
title: 页面标题
description: 页面描述
keywords: 关键词,逗号,分隔
theme: light
toc: false            # 本页不渲染页首目录
nav:
  - label: 文档中心
    href: /_md
  - label: 回到顶部
    cmd: "slot:0"
nav-preset: document  # 引用预设（简写）
---
```

- 若正文首行已使用一级标题 `#`，则不再额外渲染页头，避免标题重复。
- `nav` 的每一项：`label` 为显示文字，`href` 表示点击后跳转的地址，
  `cmd` 表示执行一条站点命令（如 `slot:0` 即回到内容顶部）。

### `nav-preset` —— 工具栏预设

工具栏品牌默认显示「栈流Streack」。想让某一页（或一批页）显示后缀、并复用一整套导航项时，
用 `nav-preset` 引用**预设**即可，无需每页重复抄写 `nav`：

| 写法 | 含义 |
| --- | --- |
| `nav-preset: document` | 简写，等于只写 `set: document` |
| `nav-preset: { set: 预设名 }` | 引用预设，继承其 `loc` / `loc-index`；`nav`（若有）与预设按钮**合并** |
| `nav-preset: { loc: 文档 }` | 不引用预设，只给品牌加后缀 |
| `nav-preset: { loc: 文档, loc-index: /doc/ }` | 加后缀，且点击后缀文字跳转到 `/doc/` |
| `nav-preset: { set: 预设名, loc: 覆盖值 }` | 引用预设并覆盖其后缀 |
| `nav-preset: { set: 预设名, replaceset: { 键: 值 } }` | 预设里可写 `%键%` 占位符，由 `replaceset` 替换 |

```yaml
---
title: 活动一览
nav-preset:
  set: example-of-section
  replaceset:
    section: 活动      # 预设里的 %section% 会被替换为「活动」
---
```

- 预设表定义在 `public/assets/app/config/toolbar-presets.js`（`Map<名称, { loc, locIndex, nav }>`），
  可按站点需要增删；预设按钮都带 `id`，便于页面按 id 覆写某一项。
- **`loc-index`**：点击 loc 后缀文字时的跳转地址（取代「点击品牌默认跳首页」）；
  未设置时点击 loc 会冒泡到品牌、恢复跳首页。
- **nav 的合并规则（template 优先）**：`nav` 里的每一项与预设按钮**合并**（都显示）；
  `nav` 项带 `id` 且命中预设同 `id` → **覆写**（保持预设原位置），否则追加到末尾。
  例：预设含 `id="doc-news"` 的「新闻博客」，页面写
  `<div id="doc-news">最新资讯</div>` 即可只改这一项、其余预设按钮保留。
- 品牌后缀渲染为「栈流Streack·活动」；当窗口宽度放不下时，会自动隐藏英文名
  「Streack」，退化为「栈流·活动」。
- 未提供替换值的占位符会**原样保留**（便于发现拼写问题），并在控制台告警。


## 自动渲染增强

以下效果在构建期自动完成，**写 Markdown 时无需任何额外标记**：

- **标题锚点** —— 每个标题都可点击，跳转到自身锚点；
- **页首目录** —— 自动收集 2~3 级标题（少于 2 项则不显示），可折叠；
  不需要时在 frontmatter 写 `toc: false`；
- **代码复制** —— 代码块右上角带「复制」按钮；
- **提示框** —— 引用块开头写 `[i]` / `[!]` / `[x]` / `[@]` 等标记，即渲染为带色提示框；
- **注释合并** —— `[^1]:` 脚注与 `<!-- notes -->` 标记的列表都会搬入页脚注释区，
  正文只留可点击的上标（两种写法可混用）；
- **链接语法糖** —— 链接文字里写 `↗` 则在**新标签页**打开并附外链箭头，默认在当前窗口打开；
- **任务列表** —— `- [x]` / `- [ ]` 渲染为站点风格的复选框；
- **图片** —— 自动懒加载。

各项语法与效果见 [Markdown 语法示例](/_md/guide/markdown-syntax)。

## 下一步

- [Markdown 语法示例](/_md/guide/markdown-syntax)
- [编写指南](/_md/guide)
