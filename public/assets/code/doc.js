/**
 * doc.js — 文档页交互增强（配合 DocLayout + 构建期 rehype-doc 生成的标记）
 *
 * 增强标记（标题锚点、链接语法糖、代码复制按钮、引用提示框、任务列表 s-checkbox）
 * 均在构建期由 rehype 生成；本脚本负责必须的交互：
 *   1. 代码块「复制」按钮
 *   2. 目录：折叠交给 Sober <s-fold>（内容 ≥40dvh 时默认折叠，并同步开关状态）
 */
(function () {
  'use strict';

  function initCodeCopy() {
    document.querySelectorAll('.code-copy').forEach(function (btn) {
      if (btn.dataset.bound === 'true') return;
      btn.dataset.bound = 'true';

      var original = btn.textContent;
      btn.addEventListener('click', function () {
        var pre = btn.closest('pre');
        var code = pre ? pre.querySelector('code') : null;
        var text = code ? code.textContent : '';

        var done = function () {
          btn.textContent = '已复制';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = original;
            btn.classList.remove('copied');
          }, 2000);
        };
        var fail = function () {
          if (window.streack && window.streack.msg) window.streack.msg('未能复制代码，无法访问剪贴板', '好', true);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, fail);
        } else if (window.streack && window.streack.CopyText) {
          window.streack.CopyText(text);
          done();
        } else {
          fail();
        }
      });
    });
  }

  /* === 目录：折叠复用 Sober <s-fold>；内容过高（≥40dvh）时默认折叠 ===
   * s-fold 的属性 `folded="true"` 表示折叠（组件样式为 :host([folded=true])，
   * 故必须带 ="true"，裸属性会被组件抹掉）。点击 trigger 区域（目录标题栏）
   * 由 s-fold 自行切换 folded；开关作为独立控件，阻止冒泡以免双重切换。 */
  function initToc() {
    var fold = document.querySelector('[data-doc-toc]');
    if (!fold) return;
    var sw = fold.querySelector('[data-doc-toc-switch]');
    var body = fold.querySelector('[data-doc-toc-body]');
    if (!body) return;

    function setFolded(folded) {
      if (folded) fold.setAttribute('folded', 'true');
      else fold.removeAttribute('folded');
    }

    function syncSwitch() {
      if (!sw) return;
      var open = fold.getAttribute('folded') !== 'true';
      try { sw.checked = open; } catch (e) { /* 组件未定义时忽略 */ }
      if (open) sw.setAttribute('checked', 'true');
      else sw.removeAttribute('checked');
    }

    if (sw) {
      // 开关是独立控件：点击不应冒泡到 s-fold 的 trigger（否则双重切换）
      sw.addEventListener('click', function (e) { e.stopPropagation(); });
      sw.addEventListener('change', function () {
        setFolded(sw.checked === false);
      });
    }

    // 点击标题栏折叠 / 其它来源改变 folded 时，同步开关状态
    new MutationObserver(syncSwitch).observe(fold, {
      attributes: true,
      attributeFilter: ['folded'],
    });

    // 页面加载时一次性判定：目录过高则默认折叠，否则保持展开
    if (body.scrollHeight >= window.innerHeight * 0.4) setFolded(true);
    syncSwitch();
  }

  function init() {
    initCodeCopy();
    initToc();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
