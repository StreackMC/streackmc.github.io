/**
 * Streack Framework · 可选组件注册表与按需加载
 *
 * 页面通过 <streack features="videoBg loopCards"> 声明需要哪些可选组件
 * （Astro 页面用 FrameworkLayout 的 features 属性声明，构建期落成该标签；
 *   非 Astro 的静态 HTML 页面直接手写该标签）。
 *
 * 框架在初始化收尾时**只为已声明的组件**发起动态 import —— 未声明的组件
 * 不会被下载，避免全站下发与页面无关的代码。
 *
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
 * 供后续新增配置项（如 redirect 等）复用的统一入口
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
        `[features] 未知组件「${name}」，已跳过（可用：${Array.from(featureRegistry.keys()).join(', ')}）`,
      );
      continue;
    }
    try {
      const mod = await import(entry.module);
      const init = mod[entry.init];
      if (typeof init !== 'function') {
        console.warn(`[features] 组件「${name}」未导出 ${entry.init}()，已跳过`);
        continue;
      }
      init();
      loaded.push(name);
    } catch (e) {
      console.error(`[features] 组件「${name}」加载失败：`, e);
    }
  }
  return loaded;
}
