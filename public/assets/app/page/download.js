/**
 * Streack 下载页 · 页面特定脚本
 *
 * 职责：
 *   SHA256 声明式渲染 —— 从 HTML data-sha256 属性读取哈希值，
 *   渲染到 .sha256 元素文本内容，并绑定单击一键复制。
 *
 * 声明方式（在 .astro 页面中）：
 *   <span class="sha256 selectable" data-sha256="f48ddecc..."></span>
 *   ↑ JS 自动填入 textContent 并附加 click → CopyText 事件
 *
 * 约定：
 *   - .sha256 元素的 textContent 留空，哈希值仅通过 data-sha256 属性声明
 *   - 复制依赖 /assets/app/framework.js 的 CopyText 函数
 */

import { CopyText } from '../app/framework.js';

const $sha = document.querySelector('.sha256');

if ($sha) {
  const hash = $sha.dataset.sha256;
  if (hash) {
    $sha.textContent = hash;
    $sha.addEventListener('click', () => CopyText(hash));
  }
}
