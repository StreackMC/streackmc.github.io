import { openURL } from '../../frame/utils.js';
import { toolbarPresets, getToolbarPreset } from '../../config/toolbar-presets.js';

// ============================================================
// Toolbar 品牌 loc + 可变插槽设置 toolbar-set
// ============================================================
//
// 品牌后缀 loc：
//   <template data-toolbar-nav loc="文档"> → 品牌渲染为「栈流Streack·文档」
//   当 #toolbar1 一行放不下时，隐藏英文名 Streack，退化为「栈流·文档」
//
// 可变通用插槽设置 toolbar-set：
//   <template data-toolbar-nav toolbar-set="预设名" replaceset='{"k":"v"}'>
//   · 按名在预设表（assets/app/config/toolbar-presets.js）中查找 ToolbarTemplateLike
//   · 继承其全部设置：loc（品牌后缀）与 nav（导航项按钮）
//   · 元素自身的 loc 属性 / template 内部内容优先于预设
//   · replaceset 是 Maplike（占位符名 → 值）；预设值里的 %xxx% 用它替换，
//     未提供对应值的占位符原样保留

/** 解析 replaceset 属性（JSON 对象字符串）→ Map；失败则告警并返回空 Map */
export function parseReplaceset(raw) {
  const map = new Map();
  if (!raw) return map;
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    console.warn('[toolbar-set] replaceset 不是合法 JSON，已忽略：', raw, e);
    return map;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    console.warn('[toolbar-set] replaceset 需为 JSON 对象，已忽略：', raw);
    return map;
  }
  for (const [k, v] of Object.entries(obj)) map.set(k, v);
  return map;
}

/**
 * 用 replaceset 填充 %xxx% 占位符
 * @param {string} text
 * @param {Map<string, any>} [replaceset]
 * @returns {string} 未提供值的占位符原样保留
 */
export function fillPlaceholders(text, replaceset) {
  if (typeof text !== 'string' || !text) return text || '';
  const get = (key) => {
    if (!replaceset) return undefined;
    return typeof replaceset.get === 'function' ? replaceset.get(key) : replaceset[key];
  };
  return text.replace(/%([A-Za-z0-9_-]+)%/g, (whole, key) => {
    const v = get(key);
    return v === undefined || v === null ? whole : String(v);
  });
}

/**
 * 设置品牌后缀（渲染为「栈流Streack·文档」）
 * 框架会自动补「·」；若文本已以「·」开头则不重复添加
 * @param {string} [text] 传空则清除后缀
 */
export function setToolbarLoc(text) {
  const el = document.getElementById('toolbar-brand-loc');
  if (!el) return;
  const t = String(text ?? '');
  // 若使用者自带前导分隔符（·/・/| 等），不再重复添加
  el.textContent = !t.trim() ? '' : /^[·・|｜/]/.test(t.trim()) ? t.trimEnd() : ' · ' + t;
  // 用 rAF 调度而非同步调用：此时 s-tooltip（搜索/汉堡按钮）可能尚未完成内部渲染，
  // 同步测量其 getBoundingClientRect().width 会得 0，导致可用宽度被高估、降级判断不足
  scheduleToolbarBrandFit();
}

/**
 * 设置 loc 后缀的点击跳转地址（loc-index 设置）
 * 点击 loc 文字时跳转到该地址，取代「点击品牌默认跳首页」；
 * 未设置（传空）时，点击 loc 会冒泡到品牌，恢复默认跳首页
 * @param {string} [url] 传空则清除
 */
export function setToolbarLocIndex(url) {
  const el = document.getElementById('toolbar-brand-loc');
  if (!el) return;
  const u = String(url ?? '').trim();
  // 清除旧的点击处理
  if (el._locIndexClick) {
    el.removeEventListener('click', el._locIndexClick);
    el._locIndexClick = null;
    el.removeAttribute('data-loc-index');
  }
  if (!u) return;
  el.setAttribute('data-loc-index', u);
  el._locIndexClick = (e) => {
    e.stopPropagation(); // 阻止冒泡到品牌（否则会跳首页）
    e.preventDefault();
    openURL(u, true);
  };
  el.addEventListener('click', el._locIndexClick);
}

/** 节流：多处（resize / 字体加载 / 导航注入）都会触发品牌适配。
    rAF 节流：合并到下一渲染帧执行，连续 resize 时只算一次，避免 setTimeout 写死的延迟与多余计算 */
let _brandFitRaf = null;
export function scheduleToolbarBrandFit() {
  if (_brandFitRaf) return;
  _brandFitRaf = requestAnimationFrame(() => {
    _brandFitRaf = null;
    fitToolbarBrand();
  });
}

/**
 * 按可用宽度适配品牌（三级降级）：
 *   ① 全显示「栈流Streack·loc」
 *   ② 放不下 → 隐藏英文名 Streack（「栈流·loc」）
 *   ③ 还放不下 → 隐藏整个品牌（只留按钮，保证按钮可点）
 *
 * 宽度判定用「全角字符估算」而非实测：品牌文本每个字符都按 1em（font-size）计，
 * 半角英文同样按全角算 → 结果偏保守、天然留出设计冗余，避免半角实测偏窄导致的误判
 * （如 268~299px 时英文本应隐藏，却因实测「放得下」而未隐藏）。
 *
 * 每次测量前都复原 display，因此反复调用结果稳定、不会来回抖动。
 */
export function fitToolbarBrand() {
  const brand = document.getElementById('toolbar-brand');
  const en = document.getElementById('toolbar-brand-en');
  const loc = document.getElementById('toolbar-brand-loc');
  const row = document.getElementById('toolbar1');
  if (!brand || !en || !loc || !row) return;

  // 先复原再估算，否则量到的是已隐藏后的宽度
  en.style.display = '';
  brand.style.display = '';

  // 没有 loc 时不介入（保持默认「栈流Streack」完整显示）
  if (!loc.textContent.trim()) return;

  // 可用宽度 = row 内容宽 - 非品牌子元素宽 - 间隔
  const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
  const kids = Array.from(row.children);
  const othersWidth = kids
    .filter((c) => c !== brand)
    .reduce((s, c) => s + c.getBoundingClientRect().width, 0)
    + gap * Math.max(0, kids.length - 1);
  const avail = row.clientWidth - othersWidth;

  // 全角估算：每个「字」（去除空白）按 1em 计（半角英文也按全角 → 留冗余）
  const fontSize = parseFloat(getComputedStyle(row).fontSize) || 18;
  const charWidth = (text) => Array.from(String(text || '').replace(/\s+/g, '')).length * fontSize;
  const cnText = (brand.firstElementChild && brand.firstElementChild.textContent) || '';
  const enText = en.textContent || '';
  const locText = loc.textContent; // 已含前导「·」与空格

  const fullWidth = charWidth(cnText + enText + locText);
  const noEnWidth = charWidth(cnText + locText);

  if (fullWidth > avail) {
    if (noEnWidth <= avail) {
      en.style.display = 'none'; // ② 隐藏英文
    } else {
      brand.style.display = 'none'; // ③ 隐藏整个品牌
    }
  }
}

/**
 * 把导航 HTML 字符串解析为顶层元素节点数组（忽略空白文本节点）
 * @param {string} html
 * @returns {HTMLElement[]}
 */
function parseNavNodes(html) {
  if (!html || !String(html).trim()) return [];
  const t = document.createElement('template');
  t.innerHTML = String(html);
  return Array.from(t.content.children);
}

/**
 * 合并 preset 与 template 的导航按钮（template 优先）：
 *   · template 按钮带 id 且命中 preset 同 id → 覆写（保持 preset 原位置）
 *   · 否则（无 id 或 id 未命中）→ 追加到末尾
 * 返回新数组；不修改传入的 presetNodes / ownNodes
 * @param {HTMLElement[]} presetNodes
 * @param {HTMLElement[]} ownNodes
 * @returns {HTMLElement[]}
 */
export function mergeNavNodes(presetNodes, ownNodes) {
  const result = (presetNodes || []).slice();
  for (const node of ownNodes || []) {
    const id = node && node.getAttribute && node.getAttribute('id');
    if (id) {
      const idx = result.findIndex(
        (n) => n && n.getAttribute && n.getAttribute('id') === id
      );
      if (idx !== -1) {
        result[idx] = node; // 同 id 覆写，保持位置
        continue;
      }
    }
    result.push(node); // 无 id 或 id 未命中 → 追加合并
  }
  return result;
}

/**
 * 处理页面里的 <template data-toolbar-nav>：解析 toolbar-set / loc / replaceset，
 * 合并 preset 与 template 的导航后注入 #toolbar-nav-slot
 * @returns {boolean} 是否设置了品牌 loc
 */
export function applyToolbarNavTemplates() {
  const navSlot = document.getElementById('toolbar-nav-slot');
  let locApplied = false;

  document.querySelectorAll('template[data-toolbar-nav]').forEach((tmpl) => {
    // ① 取出三项设置（toolbar-set 亦可用更符合 HTML 习惯的 data-toolbar-set）
    const setName = tmpl.getAttribute('toolbar-set') || tmpl.dataset.toolbarSet || '';
    const replaceset = parseReplaceset(tmpl.getAttribute('replaceset'));
    const preset = setName ? getToolbarPreset(setName) : undefined;
    if (setName && !preset) {
      console.warn(`[toolbar-set] 未找到名为「${setName}」的预设，已忽略（可用预设：`
        + `${Array.from(toolbarPresets.keys()).join(', ') || '（空）'}）`);
    }

    // ② loc：元素自身属性优先，否则继承预设；两者都会做占位符替换
    const ownLoc = tmpl.getAttribute('loc');
    const locText = ownLoc != null
      ? fillPlaceholders(ownLoc, replaceset)
      : fillPlaceholders(preset?.loc, replaceset);
    if (locText) {
      setToolbarLoc(locText);
      locApplied = true;
    }

    // ②b loc-index：点击 loc 文字的跳转地址（元素自身优先，否则继承预设；同样做占位符替换）
    const ownLocIndex = tmpl.getAttribute('loc-index');
    const locIndex = ownLocIndex != null
      ? fillPlaceholders(ownLocIndex, replaceset)
      : fillPlaceholders(preset?.locIndex, replaceset);
    setToolbarLocIndex(locIndex || '');

    // ③ nav：preset 与 template 的按钮**合并**（template 优先）
    //   · template 按钮带 id 且命中 preset 同 id → 覆写（保持 preset 原位置）
    //   · 否则追加（合并）；两者都做占位符替换
    const presetNodes = parseNavNodes(fillPlaceholders(preset?.nav, replaceset));
    const ownNodes = parseNavNodes(fillPlaceholders((tmpl.innerHTML || '').trim(), replaceset));
    const merged = mergeNavNodes(presetNodes, ownNodes);
    if (navSlot) merged.forEach((n) => navSlot.appendChild(n));

    tmpl.remove();
  });

  return locApplied;
}
