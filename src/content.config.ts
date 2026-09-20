/**
 * Astro 内容集合配置 — Markdown 内容管线
 *
 * ═══════════════════════════════════════════════════════════════
 *  存放位置 ↔ 网站路径 映射规则
 * ═══════════════════════════════════════════════════════════════
 *
 *   src/content/<路径>.md  →  /<路径>
 *
 *   · 内容根目录为 src/content/，其下的目录结构原样映射为 URL 路径
 *   · 目录形式的 index.md 会去掉末尾的 index 段
 *   · 扩展名不参与 URL
 *
 * 示例：
 *   src/content/docs/aaa/index.md   → /docs/aaa
 *   src/content/docs/aaa/bbb.md     → /docs/aaa/bbb
 *   src/content/docs/guide/setup.md → /docs/guide/setup
 *   src/content/policy/privacy.md   → /policy/privacy
 *
 * 即：把 .md 放进什么目录，就自动发布到同名网址下 —— 无需额外配置。
 *
 * ═══════════════════════════════════════════════════════════════
 *  Frontmatter（均为可选）
 * ═══════════════════════════════════════════════════════════════
 *
 *   title       — 页面标题（<title> 与可选页头）
 *   description — meta description
 *   keywords    — meta keywords
 *   theme       — 'light' | 'dark'，s-page 主题（默认 light）
 *   toc         — 是否渲染页首目录（默认 true；写 false 则该页不渲染目录）
 *   nav         — 工具栏导航项 [{ label, href?, cmd? }]（标题栏智能插槽）
 *   nav-preset  — toolbar 预设：字符串 = 预设名，或 { set?, loc?, replaceset? }
 *                 （继承 assets/app/toolbar-presets.js 里预设的 loc 与 nav）
 */
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** 通用 Markdown 内容集合：src/content 下所有 .md → /路径 */
const content = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content' }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    keywords: z.string().optional(),
    theme: z.enum(['light', 'dark']).optional(),
    // 是否渲染页首目录；缺省为 true，写 false 则不渲染该页目录
    toc: z.boolean().optional(),
    // 工具栏导航项（标题栏智能插槽）：label 必填，href 用 url 命令、cmd 用任意 data-cmd；
    // id 可选——与预设按钮同 id 时覆写（保持预设位置），否则与预设按钮合并追加
    nav: z
      .array(
        z.object({
          label: z.string(),
          href: z.string().optional(),
          cmd: z.string().optional(),
          id: z.string().optional(),
        }),
      )
      .optional(),
    // toolbar 预设（可变通用插槽设置）：引用 toolbar-presets.js 里的预设，
    // 继承其 loc（品牌后缀）与 nav（导航项）；replaceset 为占位符 %xxx% 的替换表
    'nav-preset': z
      .union([
        z.string(),
        z.object({
          set: z.string().optional(),
          loc: z.string().optional(),
          'loc-index': z.string().optional(),
          replaceset: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
        }),
      ])
      .optional(),
  }),
});

export const collections = { content };
