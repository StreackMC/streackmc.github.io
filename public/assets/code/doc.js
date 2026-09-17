/**
 * doc.js — 文档页交互增强（配合 DocLayout + 构建期 rehype-doc 生成的标记）
 *
 * 增强标记（标题锚点、链接语法糖、代码复制按钮、引用提示框、任务列表 s-checkbox）
 * 均在构建期由 rehype 生成；本脚本负责必须的交互：
 *   1. 代码块「复制」按钮
 *   2. 目录开关与折叠（内容 ≥40dvh 时默认折叠）
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

  /* === 目录开关 + 折叠：内容过高（≥40dvh）时默认折叠 === */
  function initToc() {
    var toc = document.querySelector('.doc-toc');
    if (!toc) return;
    var sw = toc.querySelector('[data-doc-toc-switch]');
    var list = toc.querySelector('.doc-toc-list');
    if (!list) return;

    function setOpen(open) {
      toc.classList.toggle('doc-toc-collapsed', !open);
      if (sw) {
        try { sw.checked = open; } catch (e) { /* 组件未定义时忽略 */ }
        if (open) sw.setAttribute('checked', '');
        else sw.removeAttribute('checked');
      }
    }

    // 页面加载时一次性判定：目录过高则默认折叠，否则默认展开
    var tooTall = list.scrollHeight >= window.innerHeight * 0.4;
    setOpen(!tooTall);

    if (sw) {
      sw.addEventListener('change', function () {
        var open = 'checked' in sw ? !!sw.checked : sw.hasAttribute('checked');
        setOpen(open);
      });
    }
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
