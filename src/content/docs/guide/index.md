---
title: 编写指南
description: 如何在栈流Streack 站点新增一篇文档。
---

本指南介绍如何在本站点新增与维护文档内容。

## 新增一篇文档

1. 在 `src/content/` 下选择了你希望发布的路径；
2. 新建对应的 `.md` 文件（目录首页请命名为 `index.md`）；
3. 编写内容，保存后即可通过对应网址访问。

例如，希望发布到 `/docs/guide/setup`，只需创建文件：

```
src/content/docs/guide/setup.md
```

## 建议约定

- 一篇文档使用一个一级标题（`#`）作为标题，或用 frontmatter 的 `title`；
- 章节使用二级、三级标题（`##` / `###`）；
- 图片、代码、表格等语法参见 [Markdown 语法示例](/docs/guide/markdown-syntax)。

## 样式说明

文档正文由 `DocLayout` 渲染，样式定义在 `public/assets/code/doc.css`，
与站点整体风格保持一致（配色、圆角、代码块等随站点主题自动适配）。
