/**
 * Streack Framework · 页面配置（<streack> 标签）
 *
 * 页面配置在运行时的**唯一数据源**是 <streack> 标签：
 *   · Astro 页面 → 用 FrameworkLayout 的 props 声明（构建期落成该标签）
 *   · 非 Astro 的静态 HTML 页面 → 直接手写该标签
 * 两种写法语义完全相同，框架只认一种读法。
 *
 * 目前支持的配置项：
 *   features  可选组件清单（空格 / 逗号分隔），按需动态 import —— 见下
 *   redirect  声明式重定向地址，初始化早期 replace 跳转
 *
 * 注意：toolbar 的配置（loc / loc-index / toolbar-set 等）**不在这里**，
 * 它们属于 <template data-toolbar-nav> 的语义（"我专门管这个"），
 * 见 component/toolbar/toolbar-nav.js。
 */

// ============================================================
// features —— 可选组件注册表与按需加载
// ============================================================

/**
 * 组件注册表：名称 → { module, init }
 * 新增组件：在 component/ 下实现并导出一个 init 函数，然后在此登记即可。
 * module 路径相对于本文件（浏览器按模块 URL 解析，不经打包器）。
 */
export const featureRegistry = new Map([
  ['videoBg', { module: '../component/video-bg.js', init: 'initVideoBg' }],
  ['loopCards', { module: '../component/loop-cards.js', init: 'initLoopCards' }],
  ['counting', { module: '../component/counting.js', init: 'initCounting' }],
]);

/**
 * 读取 <streack> 上的 features 声明
 * @returns {string[]} 组件名数组（空格 / 逗号分隔）
 */
export function readFeatures() {
  const el = document.querySelector('streack');
  const raw = (el && el.getAttribute('features')) || '';
  return raw.split(/[\s,]+/).filter(Boolean);
}

/**
 * 读取 <streack> 上的全部配置属性
 * @returns {Record<string, string>}
 */
export function readPageConfig() {
  const el = document.querySelector('streack');
  const conf = {};
  if (!el) return conf;
  Array.from(el.attributes).forEach((attr) => {
    conf[attr.name] = attr.value;
  });
  return conf;
}

/**
 * 按名加载并初始化可选组件
 * 未知名称会告警跳过；单个组件加载失败不影响其它组件
 * @param {string[]} [names] 缺省取 <streack features="…"> 的声明
 * @returns {Promise<string[]>} 实际初始化成功的组件名
 */
export async function loadFeatures(names = readFeatures()) {
  const loaded = [];
  for (const name of names) {
    const entry = featureRegistry.get(name);
    if (!entry) {
      console.warn(
        `[page-config] 未知组件「${name}」，已跳过（可用：${Array.from(featureRegistry.keys()).join(', ')}）`,
      );
      continue;
    }
    try {
      const mod = await import(entry.module);
      const init = mod[entry.init];
      if (typeof init !== 'function') {
        console.warn(`[page-config] 组件「${name}」未导出 ${entry.init}()，已跳过`);
        continue;
      }
      init();
      loaded.push(name);
    } catch (e) {
      console.error(`[page-config] 组件「${name}」加载失败：`, e);
    }
  }
  return loaded;
}

// ============================================================
// redirect —— 声明式重定向
// ============================================================

/**
 * 应用 <streack redirect="…"> 声明的跳转
 * 用 replace 而非 assign：不产生多余的历史条目（返回键不会回到中转页）
 * @returns {boolean} 是否发生了跳转
 */
export function applyRedirect() {
  const { redirect } = readPageConfig();
  if (!redirect) return false;
  try {
    window.location.replace(redirect);
    return true;
  } catch (e) {
    console.error('[page-config] redirect 跳转失败：', e);
    return false;
  }
}
