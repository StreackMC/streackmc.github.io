// ============================================================
// 动态片段加载
// ============================================================

const FRAGMENTS_BASE = './assets/app/includes/';

/**
 * 默认要加载的片段
 * Astro 迁移后：工具栏和页脚由 Astro 组件服务端渲染，无需运行时 fetch
 */
export const DEFAULT_FRAGMENTS = {};

/**
 * 加载 HTML 片段并注入到指定的挂载点
 * - 向挂载点元素的后面插入片段 HTML
 * - 然后移除挂载点自身（避免残留空标签）
 * @param {string} mountId - 挂载点元素的 id
 * @param {string} url - 片段 URL
 */
export async function loadFragment(mountId, url) {
  const mount = document.getElementById(mountId);
  if (!mount) {
    console.warn(`[framework] 挂载点 #${mountId} 不存在，跳过`);
    return;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    mount.insertAdjacentHTML('afterend', html);// 注入到挂载点之后
    mount.remove();// 移除挂载点自身
  } catch (err) {
    console.error(`[framework] 加载片段 ${url} 失败:`, err);
  }
}
