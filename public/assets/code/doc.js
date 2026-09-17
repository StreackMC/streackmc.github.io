/**
 * doc.js — 文档页交互增强（配合 DocLayout + 构建期 rehype-doc 生成的标记）
 *
 * 增强标记（标题锚点、链接语法糖、代码复制按钮、引用提示框、任务列表 s-checkbox）
 * 均在构建期由 rehype 生成；本脚本只负责必须的交互：代码块「复制」按钮。
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCodeCopy);
  } else {
    initCodeCopy();
  }
})();
