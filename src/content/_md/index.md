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
---
```

- 若正文首行已使用一级标题 `#`，则不再额外渲染页头，避免标题重复。
- `nav` 的每一项：`label` 为显示文字，`href` 表示点击后跳转的地址，
  `cmd` 表示执行一条站点命令（如 `slot:0` 即回到内容顶部）。

## 自动渲染增强

以下效果在构建期自动完成，**写 Markdown 时无需任何额外标记**：

- **标题锚点** —— 每个标题都可点击，跳转到自身锚点；
- **页首目录** —— 自动收集 2~3 级标题（少于 2 项则不显示），可折叠；
  不需要时在 frontmatter 写 `toc: false`；
- **代码复制** —— 代码块右上角带「复制」按钮；
- **提示框** —— 引用块开头写 `[i]` / `[!]` / `[x]` / `[@]` 等标记，即渲染为带色提示框；
- **链接语法糖** —— 链接文字里写 `↗` 则在**新标签页**打开并附外链箭头，默认在当前窗口打开；
- **任务列表** —— `- [x]` / `- [ ]` 渲染为站点风格的复选框；
- **图片** —— 自动懒加载。

各项语法与效果见 [Markdown 语法示例](/_md/guide/markdown-syntax)。

## 下一步

- [Markdown 语法示例](/_md/guide/markdown-syntax)
- [编写指南](/_md/guide)
