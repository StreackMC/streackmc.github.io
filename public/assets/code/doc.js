/**
 * doc.js — 文档页交互增强（配合 DocLayout + 构建期 rehype-doc 生成的标记）
 *
 * 增强标记（标题锚点、外链箭头、代码复制按钮、引用提示框、图片 .doc-img）
 * 均在构建期由 rehype 生成；本脚本只负责必须的交互：
 *   1. 代码块「复制」按钮
 *   2. 图片灯箱（点击正文图片放大查看）
 */
(function () {
  'use strict';

  function closeDialog(dlg) {
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  }

  /* === 1. 代码块复制 === */
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

  /* === 2. 图片灯箱 === */
  function initLightbox() {
    var dlg = document.querySelector('[data-doc-lightbox]');
    if (!dlg) return;
    var img = dlg.querySelector('[data-doc-lightbox-img]');
    var closeBtn = dlg.querySelector('[data-doc-lightbox-close]');

    document.querySelectorAll('.doc-body .doc-img').forEach(function (src) {
      if (src.dataset.lightboxBound === 'true') return;
      src.dataset.lightboxBound = 'true';
      src.addEventListener('click', function () {
        img.src = src.currentSrc || src.src;
        img.alt = src.alt || '';
        if (typeof dlg.showModal === 'function') dlg.showModal();
        else dlg.setAttribute('open', '');
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', function () { closeDialog(dlg); });
    // 点击遮罩（dialog 自身）关闭；Esc 由 <dialog> 原生处理
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDialog(dlg); });
  }

  function init() {
    initCodeCopy();
    initLightbox();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
