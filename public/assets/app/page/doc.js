/**
 * doc.js — 文档页交互增强（配合 DocLayout + 构建期 rehype-doc 生成的标记）
 *
 * 增强标记（标题锚点、链接语法糖、代码复制按钮、引用提示框、任务列表 s-checkbox）
 * 均在构建期由 rehype 生成；本脚本只负责必须的交互：
 *   1. 代码块「复制」按钮（复用框架 CopyText，silent 模式 + 回调改按钮文案）
 *   2. 目录：折叠交给 Sober <s-fold>（内容 ≥40dvh 时默认折叠；箭头旋转由 CSS 负责）
 *
 * 初始化统一走框架的 requestInitFunc：框架就绪后执行，无需自行监听 DOMContentLoaded。
 */

import { requestInitFunc } from '../frame/init-hooks.js';
import { CopyText } from '../frame/utils.js';

/**
 * 代码块「复制」按钮
 * 复制成功后临时把按钮文案换成「已复制」——故用 CopyText 的 silent 模式，
 * 由按钮自身反馈，不再另弹 Snackbar。
 */
function initCodeCopy() {
  document.querySelectorAll('.code-copy').forEach((btn) => {
    if (btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';
    btn.classList.add('glass');

    const original = btn.textContent;
    btn.addEventListener('click', () => {
      const pre = btn.closest('pre');
      const code = pre ? pre.querySelector('code') : null;
      const text = code ? code.textContent : '';

      CopyText(text, {
        silent: true,
        onSuccess: () => {
          btn.textContent = '已复制';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = original;
            btn.classList.remove('copied');
          }, 2000);
        },
      });
    });
  });
}

/* === 目录：折叠复用 Sober <s-fold>；内容过高（≥40dvh）时默认折叠 ===
 * s-fold 的属性 `folded="true"` 表示折叠（组件样式为 :host([folded=true])，
 * 故必须带 ="true"，裸属性会被组件抹掉）。点击标题栏（trigger 槽）由 s-fold
 * 自行切换 folded，箭头方向由 CSS 依据 [folded] 自动旋转，无需在此同步。 */
function initToc() {
  const fold = document.querySelector('[data-doc-toc]');
  if (!fold) return;
  const body = fold.querySelector('[data-doc-toc-body]');
  if (!body) return;

  // 页面加载时一次性判定：目录过高则默认折叠，否则保持展开
  if (body.scrollHeight >= window.innerHeight * 0.4) {
    fold.setAttribute('folded', 'true');
  } else {
    fold.setAttribute('folded', 'false');
  }
}

requestInitFunc(() => {
  initCodeCopy();
  initToc();
});
