/**
 * toolbar 预设表 —— Map<String, ToolbarTemplateLike>
 *
 * ■ ToolbarTemplateLike
 *   等价于「填进 <template slot="toolbar-nav" data-toolbar-nav> 里的内容」，即两项设置：
 *     · loc — 品牌后缀文本，渲染为「栈流Streack·<loc>」
 *             （框架会自动补「·」；若你已自带前导分隔符也不会重复）
 *     · nav — 注入 #toolbar-nav-slot 的 HTML，也就是 template 的 innerHTML
 *             （写法与页面里手写的导航项完全一致，支持 pc-only / data-cmd 等）
 *
 * ■ 占位符 %xxx%
 *   上面两个字符串里可写 %xxx%，使用方通过 replaceset 提供替换值；
 *   未提供值的占位符**原样保留**（便于排查）。例如：
 *     预设   { loc: '%section%' }
 *     页面   replaceset='{"section":"文档"}'
 *     结果   「栈流Streack·文档」
 *
 * ■ 使用方式
 *   Astro     <template slot="toolbar-nav" data-toolbar-nav toolbar-set="document">
 *   Markdown  frontmatter:
 *               nav-preset: document            # 只引用预设（简写）
 *               nav-preset:                     # 或完整写法
 *                 set: document
 *                 loc: 文档
 *                 replaceset:
 *                   section: 文档
 *
 *   合并规则（template 优先）：
 *     · loc：元素自身 loc 属性有值用自身，否则继承预设；两者都做占位符替换
 *     · nav：preset 的按钮与 template 的按钮**合并**（都显示）——
 *           template 按钮带 id 且命中 preset 同 id → 覆写（保持 preset 原位置）；
 *           否则（无 id 或 id 未命中）→ 追加到末尾；两者都做占位符替换
 *   （预设的按钮建议带 id，便于页面按 id 覆写某一项，而非整体重写）
 */

export const toolbarPresets = new Map([
  [
    'document',
    {
      loc: '文档',
      nav: [
        '<div pc-only id="doc-home" data-cmd="url:/doc/|" clickable>文档</div>',
        '<div pc-only id="doc-event" data-cmd="url:/doc/event/|" clickable>活动</div>',
        '<div pc-only id="doc-news" data-cmd="url:/doc/news/|" clickable>新闻博客</div>',
        '<div pc-only id="doc-updata" data-cmd="url:/doc/updata/|" clickable>近期更新</div>',
      ].join(''),
    },
  ],
  [
    'about',
    {
      loc: '关于我们',
      nav: [
        `<div pc-only id="about-team" onclick='window.streack.openURL("/about/leadership/",true)' clickable>团队</div>`,
        `<div pc-only id="about-career" onclick='window.streack.openURL("/about/career/",true)' clickable>广纳贤士</div>`,
        `<div pc-only id="about-contact" onclick='window.streack.openURL("/about/contact/",true)' clickable>联系</div>`,
        `<div pc-only id="about-donate" onclick='window.streack.openURL("/about/donate/",true)' clickable>捐赠与赞助</div>`,
      ].join(''),
    },
  ],

  /* ── 带占位符的示例 ────────────────────────────────────────────
     适用「同一套导航、但品牌后缀随栏目变化」的场景：
       nav-preset:
         set: example-of-section
         replaceset: { section: 活动 }
     → 品牌显示「栈流Streack·活动」 */
  [
    'example-of-section',
    {
      loc: '%section%',
      nav: [
        '<div pc-only id="ex-home" data-cmd="url:/doc/|" clickable>文档</div>',
        '<div pc-only id="ex-event" data-cmd="url:/doc/event/|" clickable>活动</div>',
        '<div pc-only id="ex-news" data-cmd="url:/doc/news/|" clickable>%section%</div>',
      ].join(''),
    },
  ],
]);

/**
 * 注册（或覆盖）一个 toolbar 预设
 * 供页面/插件在运行时扩展；也可直接用 toolbarPresets.set()
 * @param {string} name
 * @param {{ loc?: string, nav?: string }} templateLike
 * @param {{ overwrite?: boolean }} [opts] 默认不覆盖同名预设
 */
export function registerToolbarPreset(name, templateLike, opts = {}) {
  if (!name) return false;
  if (toolbarPresets.has(name) && !opts.overwrite) {
    console.warn(`[toolbar-set] 预设 ${name} 已存在，未覆盖（如需覆盖请传 { overwrite: true }）`);
    return false;
  }
  toolbarPresets.set(name, templateLike || {});
  return true;
}

/**
 * 读取预设（Maplike：本表就是 Map；也兼容外部传入的其它 Maplike 实现）
 * @param {string} name
 * @returns {{ loc?: string, nav?: string } | undefined}
 */
export function getToolbarPreset(name) {
  if (!name) return undefined;
  if (typeof toolbarPresets.get !== 'function') {
    console.warn('[toolbar-set] 预设表不是 Maplike（缺少 get）');
    return undefined;
  }
  return toolbarPresets.get(name);
}
