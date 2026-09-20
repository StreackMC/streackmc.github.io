---
title: 编写指南
description: 如何在栈流Streack 站点新增一篇文档。
---

本指南介绍如何在本站点新增与维护文档内容。

## 新增一篇文档

1. 在 `src/content/` 下选好这篇文档要发布的位置（目录结构即 URL 路径）；
2. 新建对应的 `.md` 文件（作为目录首页的请命名为 `index.md`）；
3. 编写内容并保存，构建后即可通过对应网址访问。

例如，希望发布到 `/doc/policy/rule`，就创建这个文件：

```
src/content/doc/policy/rule.md
```

若要发布为某个目录的首页（如 `/doc/policy`），则命名为 `index.md`：

```
src/content/doc/policy/index.md
```

## Frontmatter

在文件顶部用一对 `---` 包裹元数据块声明页面信息，字段全部可省略：

```yaml
---
title: 页面标题
description: 页面描述
toc: false            # 本页不渲染页首目录
nav:
  - label: 文档中心
    href: /_md
---
```

完整字段说明见 [文档中心](/_md)。

## 建议约定

- 一篇文档使用一个一级标题（`#`）作为标题，或在 frontmatter 写 `title`；
- 章节使用二级、三级标题（`##` / `###`）——它们会自动进入页首目录，
  因此标题文字要能独立表意；
- 标题、代码块、提示框、外链等写法参见 [Markdown 语法示例](/_md/guide/markdown-syntax)。

## 样式说明

文档正文由 `DocLayout` 渲染，样式定义在 `public/assets/code/doc.css`，
与站点整体风格保持一致（配色、圆角、代码块等随站点主题自动适配）。

> [i] 正文中无需手动加锚点或目录——标题锚点、页首目录、代码复制按钮
> 都在构建期自动生成，保持 Markdown 源文件干净。
