---
title: 文档中心
description: 栈流Streack 站内文档 —— 使用 Markdown 编写，自动映射为网站路径。
keywords: 栈流,Streack,文档,Markdown
---

本文档演示站点的 **Markdown 内容管线**：把 `.md` 文件放进 `src/content/` 目录，
即自动发布到与之对应的网站路径下，并套用站点统一的样式。

## 路径映射规则

内容根目录为 `src/content/`，**其下的目录结构原样映射为 URL 路径**：

| Markdown 文件 | 生成的网址 |
| --- | --- |
| `src/content/docs/index.md` | `/docs` |
| `src/content/docs/aaa/index.md` | `/docs/aaa` |
| `src/content/docs/guide/setup.md` | `/docs/guide/setup` |

要点：

- 目录形式的 `index.md` 会自动去掉末尾的 `index` 段；
- 扩展名 `.md` 不参与 URL；
- 把文件放进什么目录，就发布到同名网址，**无需任何额外配置**。

> 新增文档时，只需新建 `src/content/...` 下的 `.md` 文件，保存即生效。

## Frontmatter（可选）

文件顶部可选的 `---` 元数据块支持以下字段：

```yaml
---
title: 页面标题        # 用于 <title> 与页头
description: 页面描述  # meta description
keywords: 关键词,逗号,分隔
theme: light          # light | dark，页面配色
toc: false            # 是否渲染页首目录，默认 true（省略即渲染）
---
```

若正文首行已使用一级标题 `#`，则不再额外渲染页头，避免标题重复。

页首目录默认会渲染（含 2 级及以上标题、且至少 2 项时）；若某页不需要目录，
在 frontmatter 写 `toc: false` 即可，该页将完全不输出目录区块。

## 下一步

- [Markdown 语法示例](/docs/guide/markdown-syntax)
- [编写指南](/docs/guide)
