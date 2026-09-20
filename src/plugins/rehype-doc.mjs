/**
 * rehype-doc — Markdown 渲染结果的站点级增强（对应旧站 PagesSober 的 pmd 客户端增强）
 *
 * 在**构建期（服务端）**直接产出增强后的 HTML 标记，仅把必须的交互留给客户端脚本
 * （见 public/assets/code/doc.js）：
 *
 *   1. 标题锚点按钮  —— 在每个 h1~h6 末尾追加「链接到此标题」按钮（旧站 hyper_markdown.header_link）
 *   2. 链接语法糖    —— 链接文字中写 ↗ / $ / ฿ 时，改为新标签页打开并加外链箭头
 *                        （默认链接在当前窗口打开；旧站 link.arrow）
 *   3. 代码块复制按钮—— 用 .code-block 包裹 <pre> 并插入 <button.code-copy>（旧站 code）
 *   4. 引用块提示框  —— [i] / [!] / [！] / [x] / [@] / [#hex$tip] → 带色边框与标题的 callout（旧站 hyper_markdown.quotepro）
 *   5. 任务列表      —— GFM 复选框 <input type=checkbox> → Sober 的 <s-checkbox disabled="true">（站点 UI 统一）
 *   6. 图片          —— <img> 追加 loading=lazy / decoding=async
 *   7. 注释合并      —— 把两种注释都搬到页脚注释区（见下）
 *
 * ── 7. 注释合并（语法糖）──────────────────────────────────────────
 * 页脚注释区由框架提供：Footer.astro 的 `ol#notes`，framework.js 会
 *   ① 把任意 `<template data-inject="notes">` 的内容注入到 `ol#notes`；
 *   ② 把正文 `<sup data-note="token">` 与 `li[data-note="token"]` 双向绑定
 *      （自动编号、点击互跳，并给条目补 ↩ 返回链接）。
 * 因此本插件只需在构建期产出上面两种标记。支持两种写法：
 *   A. `[^1]: 说明` —— 标准脚注语法（remark-gfm）。文末的脚注区块与正文引用
 *      会被拆开，分别变成 `li[data-note="1"]` 与 `sup[data-note="1"]`。
 *   B. `<!-- notes -->` 标记 + 紧随其后的无序/有序列表 —— 该列表整体搬入页脚，
 *      条目编号为 `notes-1`、`notes-2` …（正文若需引用，写
 *      `<sup data-note="notes-1"></sup>` 即可）。
 * 注意：只有**显式**带 `<!-- notes -->` 标记的列表会被搬运——正文里以列表结尾
 * （如「注意事项」）不会被误伤。
 *
 * ⚠ 实现约束：注入模板必须用 **raw 字符串节点** 承载。Astro 在用户 rehype 插件
 *   **之后**还会跑 rehype-raw，而它以 `node.content` 序列化 `<template>`，
 *   会把手写的 `content` 清空（实测 `<template></template>`）；改用 raw 节点
 *   交回 rehype-raw 解析，才能得到带内容的模板。
 */
import { toHtml } from 'hast-util-to-html';

/** 链接语法糖标记：↗（U+2197）、$（U+0024）、฿（U+0E3F） */
const LINK_SUGAR = /[\u2197\u0024\u0e3f]/;

const ICONS = {
  info: 'M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z',
  notice: 'M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z',
  warn: 'm40-120 440-760 440 760H40Zm138-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm-40-120h80v-200h-80v200Zm40-100Z',
  tip: 'M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q65 0 123 19t107 53l-58 59q-38-24-81-37.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160q133 0 226.5-93.5T800-480q0-18-2-36t-6-35l65-65q11 32 17 66t6 70q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-56-216L254-466l56-56 114 114 400-401 56 56-456 457Z',
  link: 'M680-160v-120H560v-80h120v-120h80v120h120v80H760v120h-80ZM440-280H280q-83 0-141.5-58.5T80-480q0-83 58.5-141.5T280-680h160v80H280q-50 0-85 35t-35 85q0 50 35 85t85 35h160v80ZM320-440v-80h320v80H320Zm560-40h-80q0-50-35-85t-85-35H520v-80h160q83 0 141.5 58.5T880-480Z',
};

/** 提示框类型：键 → {标签, 颜色, 图标} */
const CALLOUTS = {
  i: { label: 'Info', color: '#1A73E7', icon: 'info' },
  '!': { label: 'Notice', color: '#FBC116', icon: 'notice' },
  '！': { label: 'Notice', color: '#FBC116', icon: 'notice' },
  x: { label: 'Warn', color: '#E23B2E', icon: 'warn' },
  '@': { label: 'Tip', color: '#30C496', icon: 'tip' },
};

/** 匹配引用块高级语法标记 */
const CALLOUT_MARK = /\[(?:@|！|!|i|x|#(?:[0-9a-f]{3}){1,2}(?:\$[\s\S]*)?)\]/i;

/** 构造一个内联 SVG 图标（hast 元素） */
function svgIcon(name, className) {
  return {
    type: 'element',
    tagName: 'svg',
    properties: { viewBox: '0 -960 960 960', className: [className] },
    children: [{ type: 'element', tagName: 'path', properties: { d: ICONS[name] }, children: [] }],
  };
}

function addClass(node, cls) {
  const p = node.properties || (node.properties = {});
  let cur = p.className;
  if (!Array.isArray(cur)) cur = cur ? String(cur).split(/\s+/).filter(Boolean) : [];
  if (!cur.includes(cls)) cur.push(cls);
  p.className = cur;
}

/** 取元素下第一个含非空白内容的文本节点 */
function firstTextNode(node) {
  if (node.type === 'text') return node.value && node.value.trim() ? node : null;
  if (node.children) {
    for (const c of node.children) {
      const found = firstTextNode(c);
      if (found) return found;
    }
  }
  return null;
}

/** 汇总标题内的纯文本（供生成 id，与 Astro 的 heading 采集口径一致） */
function headingText(node) {
  let text = '';
  const walk = (n) => {
    if (n.type === 'text') {
      text += n.value;
      return;
    }
    if (n.children) n.children.forEach(walk);
  };
  walk(node);
  return text;
}

/** 简易 slug 生成器：去空白/非法字符并处理重名 */
function makeSlugger() {
  const seen = new Map();
  return (text) => {
    let base = String(text)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\p{L}\p{N}\-_]/gu, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!base) base = 'section';
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n}`;
  };
}

/**
 * 1. 标题：确保有 id 并追加锚点按钮
 * @note Astro 的 rehypeHeadingIds 在本插件之后运行，会尊重已存在的 id，
 *       且其 headings[].slug 即取用该 id —— 因此目录链接与本处锚点始终一致。
 */
function enhanceHeading(h, slugger) {
  const p = h.properties || (h.properties = {});
  if (typeof p.id !== 'string') {
    let s = slugger(headingText(h));
    if (s.endsWith('-')) s = s.slice(0, -1);
    p.id = s;
  }
  const icon = svgIcon('link', 'heading-anchor-icon');

  // 标题内已含链接时，避免 <a> 嵌套 —— 回退为“仅图标可点”
  if (hasElement(h, 'a')) {
    h.children.push({
      type: 'element',
      tagName: 'a',
      properties: { href: '#' + p.id, className: ['heading-anchor'], title: '链接到此标题' },
      children: [icon],
    });
    return;
  }

  // 整个标题（文字 + 图标）包进一个锚点，使整块可点（对应旧站行为）
  h.children = [
    {
      type: 'element',
      tagName: 'a',
      properties: { href: '#' + p.id, className: ['heading-link'], title: '链接到此标题' },
      children: [...h.children, icon],
    },
  ];
}

/** 判断元素内是否存在指定标签（含自身） */
function hasElement(node, tag) {
  if (node.type === 'element' && node.tagName === tag) return true;
  if (Array.isArray(node.children)) return node.children.some((c) => hasElement(c, tag));
  return false;
}

/**
 * 2. 链接语法糖：链接文字含 ↗ / $ / ฿ 时 → 移除标记、改为新标签页打开、加 .ext-link（CSS 箭头）。
 *    默认（无标记）链接保持在当前窗口打开。已带 target="_blank" 的链接同样补箭头。
 */
function enhanceLink(a) {
  const p = a.properties || (a.properties = {});
  const alreadyBlank = p.target === '_blank';
  const sugar = stripLinkSugar(a);
  if (!sugar && !alreadyBlank) return; // 默认：当前窗口、无箭头
  p.target = '_blank';
  p.rel = 'noopener noreferrer';
  addClass(a, 'ext-link');
}

/** 在链接文本中移除首个语法糖标记，返回是否命中 */
function stripLinkSugar(node) {
  let hit = false;
  const walk = (n) => {
    if (hit) return;
    if (n.type === 'text') {
      const m = String(n.value).match(LINK_SUGAR);
      if (m) {
        n.value = n.value.slice(0, m.index) + n.value.slice(m.index + m[0].length);
        hit = true;
      }
      return;
    }
    if (n.children) n.children.forEach(walk);
  };
  walk(node);
  return hit;
}

/** 3. 代码块：包一层容器并插入复制按钮（容器不滚动，按钮定位稳定） */
function wrapCode(pre) {
  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['code-block'] },
    children: [
      pre,
      {
        type: 'element',
        tagName: 'button',
        properties: { type: 'button', className: ['code-copy'], title: '复制代码', 'aria-label': '复制代码' },
        children: [{ type: 'text', value: '复制' }],
      },
    ],
  };
}

/** 4. 引用块：解析提示框语法 */
function enhanceQuote(bq) {
  const t = firstTextNode(bq);
  if (!t || typeof t.value !== 'string') return;
  const val = t.value;

  const found = val.match(CALLOUT_MARK);
  if (!found) return;
  // 前面的非空白字符为 ^ 表示转义，不处理，仅去掉 ^
  const before = val.slice(0, found.index);
  if (/\^$/.test(before)) {
    t.value = val.replace(/\^\s*/, '');
    return;
  }

  const key = found[0].slice(1, -1);
  let color, label, icon;
  if (key.startsWith('#')) {
    const m = key.match(/^(#[0-9a-f]{3,6})\$?([\s\S]*)$/i);
    color = m[1];
    label = (m[2] || '').trim();
  } else {
    const c = CALLOUTS[key];
    if (!c) return;
    color = c.color;
    label = c.label;
    icon = c.icon;
  }

  // 移除标记本身
  t.value = val.replace(CALLOUT_MARK, '').replace(/^\s+/, '');

  addClass(bq, 'doc-callout');
  bq.properties = bq.properties || {};
  bq.properties.style = `--callout-color:${color}`;

  if (label || icon) {
    bq.children.unshift({
      type: 'element',
      tagName: 'p',
      properties: { className: ['doc-callout-title'] },
      children: [...(icon ? [svgIcon(icon, 'doc-callout-icon')] : []), { type: 'text', value: label }],
    });
  }
}

/** 6. 图片：懒加载与异步解码 */
function enhanceImage(img) {
  if (!img.properties) img.properties = {};
  if (!img.properties.loading) img.properties.loading = 'lazy';
  if (!img.properties.decoding) img.properties.decoding = 'async';
}

/**
 * 5. 任务列表：把 GFM 的 <input type=checkbox> 换成 Sober 的 <s-checkbox>。
 *
 * ⚠ Sober 组件的布尔属性必须写成 `attr="true"`（字符串 "true"），不能写成裸布尔属性。
 *   原因（sober@1.0.6 内部）：组件基类对 props 走 syncProps，setter 用
 *   `Ye(v, default)` 转换，布尔类型的转换是 `v === "true"`。裸属性 `checked` 的
 *   属性值为空串 ""，转换得 false，恰等于默认值 → 组件随即 removeAttribute，
 *   属性被抹掉；而组件样式用的是 `:host([checked=true])`（比较属性「值」），
 *   于是既不勾选、也不禁用。写成 checked="true" / disabled="true" 才生效。
 */
function hasClass(node, cls) {
  const c = node.properties && node.properties.className;
  const arr = Array.isArray(c) ? c : c ? String(c).split(/\s+/) : [];
  return arr.includes(cls);
}

function fixTaskItem(li) {
  li.children = (li.children || []).map((c) => {
    const isCheckbox =
      c.type === 'element' &&
      c.tagName === 'input' &&
      c.properties &&
      String(c.properties.type).toLowerCase() === 'checkbox';
    if (!isCheckbox) return c;
    const checked = c.properties.checked === true || c.properties.checked === '';
    return {
      type: 'element',
      tagName: 's-checkbox',
      properties: { disabled: 'true', ...(checked ? { checked: 'true' } : {}) },
      children: [],
    };
  });
}

function transform(node, slugger) {
  if (!node || !Array.isArray(node.children)) return;
  const out = [];
  for (const child of node.children) {
    if (child.type === 'element') {
      if (/^h[1-6]$/.test(child.tagName)) {
        enhanceHeading(child, slugger);
      } else if (child.tagName === 'a') {
        enhanceLink(child);
      } else if (child.tagName === 'blockquote') {
        enhanceQuote(child);
      } else if (child.tagName === 'img') {
        enhanceImage(child);
      } else if (child.tagName === 'li' && hasClass(child, 'task-list-item')) {
        fixTaskItem(child);
      } else if (child.tagName === 'pre') {
        out.push(wrapCode(child)); // 用容器包裹
        transform(child, slugger);
        continue;
      }
      transform(child, slugger);
    }
    out.push(child);
  }
  node.children = out;
}

export default function rehypeDoc() {
  return (tree) => transform(tree, makeSlugger());
}
