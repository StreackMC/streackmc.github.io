/**
 * Streack Selector 分层选择器 · 页面脚本
 *
 * 支持两种使用方式：
 *   1. 整页模式 — SelectorLayout 包裹的页面（.selector-wrap[data-selector]）
 *   2. 嵌入模式 — Selector.astro 组件插入任意页面（同结构）
 *
 * 两种模式共享同一份 JS：扫描页面上所有 [data-selector] 元素，
 * 各自从内部 [data-selector-config] 读取配置并独立初始化。
 *
 * 配置结构：
 *   config = { title, description?, layerTitle?, options: [...] }
 *   每个选项 = { label, hint?, layerTitle?, children? | result? }
 *   layerTitle → 该选项子层的选择区域标题（默认用 label）
 *   children → 有子选项，继续下钻
 *   result: { title, content(HTML) } → 最终结果
 *   两者互斥
 *
 * 交互：
 *   - 选项卡逐层展示，点击进入下一层
 *   - 新选项卡自动滚动至视口中央
 *   - 某层仅一个选项时自动选中并继续（700ms 延迟）
 *   - 面包屑导航可点击回退到任意层级
 *   - 最终结果以 s-card 卡片展示，附"重新选择"按钮
 */

(function () {
  'use strict';

  const ICON_CHEVRON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.41 1.41l4.59-4.59a1 1 0 0 0 0-1.41L10.7 6.7a1 1 0 0 0-1.41 0z"/></svg>';
  const ICON_RESET = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>';

  /**
   * 初始化单个选择器实例
   * @param {HTMLElement} root — .selector-wrap[data-selector] 根元素
   * @param {object} config — 选择器配置
   */
  function initInstance(root, config) {
    var path = [];
    var autoTimer = null;

    var $bc = function () { return root.querySelector('[data-breadcrumb]'); };
    var $layers = function () { return root.querySelector('[data-layers]'); };
    var $result = function () { return root.querySelector('[data-result]'); };

    function renderLayer(options, depth, layerTitle) {
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
      $layers().querySelectorAll('.selector-layer').forEach(function (l) {
        if (parseInt(l.dataset.depth) >= depth) l.remove();
      });
      $result().innerHTML = '';
      $result().classList.remove('visible');

      var layer = document.createElement('div');
      layer.className = 'selector-layer';
      layer.dataset.depth = depth;

      /* 层级标题（分割不同选择区域） */
      if (layerTitle) {
        var heading = document.createElement('h2');
        heading.className = 'selector-layer-title';
        heading.textContent = layerTitle;
        layer.appendChild(heading);
      }

      options.forEach(function (opt) { layer.appendChild(createOptionButton(opt, depth)); });
      $layers().appendChild(layer);

      requestAnimationFrame(function () { layer.classList.add('visible'); });
      setTimeout(function () { layer.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
      updateBreadcrumb();

      if (options.length === 1) {
        autoTimer = setTimeout(function () {
          autoTimer = null;
          var btn = layer.querySelector('.selector-option');
          if (btn) selectOption(options[0], depth, btn);
        }, 700);
      }
    }

    function createOptionButton(option, depth) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'selector-option';
      btn.dataset.selected = 'false';
      var hasChildren = option.children && option.children.length > 0;
      btn.innerHTML = '<span class="selector-option-text"><span class="selector-option-label">'
        + option.label + '</span>'
        + (option.hint ? '<span class="selector-option-hint">' + option.hint + '</span>' : '')
        + '</span>'
        + (hasChildren ? '<span class="selector-option-arrow">' + ICON_CHEVRON + '</span>' : '');
      btn.addEventListener('click', function () { selectOption(option, depth, btn); });
      return btn;
    }

    function selectOption(option, depth, buttonEl) {
      var layer = buttonEl.closest('.selector-layer');
      layer.querySelectorAll('.selector-option').forEach(function (b) { b.dataset.selected = 'false'; });
      buttonEl.dataset.selected = 'true';

      path = path.slice(0, depth);
      path[depth] = { option: option, depth: depth };

      if (option.children && option.children.length > 0) {
        renderLayer(option.children, depth + 1, option.layerTitle || option.label);
      } else {
        /* 清理更深层级（从分支切换到叶子时，旧子层必须移除） */
        if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
        $layers().querySelectorAll('.selector-layer').forEach(function (l) {
          if (parseInt(l.dataset.depth) > depth) l.remove();
        });
        var result = option.result || { title: option.label, content: '<p>暂无详细内容。</p>' };
        showResult(result);
      }
      updateBreadcrumb();
    }

    function showResult(result) {
      var el = $result();
      el.innerHTML = '';

      /* Sober UI s-card */
      var card = document.createElement('s-card');
      card.type = 'outlined';
      card.classList.add('selector-result-card');
      card.innerHTML = '<div slot="headline">' + result.title + '</div><div slot="text">' + result.content + '</div>';
      el.appendChild(card);

      /* Sober UI s-button */
      var resetBtn = document.createElement('s-button');
      resetBtn.type = 'outlined';
      resetBtn.classList.add('selector-reset');
      resetBtn.innerHTML = '<s-icon slot="start">' + ICON_RESET + '</s-icon>重新选择';
      resetBtn.addEventListener('click', resetSelector);
      el.appendChild(resetBtn);

      requestAnimationFrame(function () { el.classList.add('visible'); });
      setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
    }

    function updateBreadcrumb() {
      var bc = $bc();
      if (path.length === 0) { bc.innerHTML = ''; return; }
      var html = '<span class="bc-item" data-depth="0">全部</span>';
      path.forEach(function (item, i) {
        html += '<span class="bc-sep">›</span>';
        if (i === path.length - 1) {
          html += '<span class="bc-item current">' + item.option.label + '</span>';
        } else {
          html += '<span class="bc-item" data-depth="' + (i + 1) + '">' + item.option.label + '</span>';
        }
      });
      bc.innerHTML = html;
      bc.querySelectorAll('.bc-item[data-depth]').forEach(function (el) {
        el.addEventListener('click', function () { goBackTo(parseInt(el.dataset.depth)); });
      });
    }

    function goBackTo(depth) {
      path = path.slice(0, depth);
      if (depth === 0) renderLayer(config.options, 0, config.layerTitle || config.title);
      else renderLayer(path[depth - 1].option.children, depth, path[depth - 1].option.layerTitle || path[depth - 1].option.label);
    }

    function resetSelector() {
      path = [];
      renderLayer(config.options, 0, config.layerTitle || config.title);
    }

    /* 启动 */
    path = [];
    renderLayer(config.options, 0, config.layerTitle || config.title);
  }

  /**
   * 扫描页面上所有 [data-selector] 元素并初始化
   * 支持多实例：每个实例从自身内部的 [data-selector-config] 读取配置
   */
  function scanAndInit() {
    var instances = document.querySelectorAll('[data-selector]');
    instances.forEach(function (root) {
      /* 避免重复初始化 */
      if (root.dataset.selectorInit === 'true') return;
      root.dataset.selectorInit = 'true';

      var configScript = root.querySelector('[data-selector-config]');
      if (!configScript) {
        /* 向后兼容：查找同页面的 #selector-config */
        configScript = document.getElementById('selector-config');
        if (!configScript) {
          console.warn('[Selector] No config found for', root);
          return;
        }
      }

      var config;
      try {
        config = JSON.parse(configScript.textContent);
      } catch (e) {
        console.warn('[Selector] Failed to parse config:', e);
        return;
      }

      initInstance(root, config);
    });
  }

  /* DOM 就绪后扫描 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAndInit);
  } else {
    scanAndInit();
  }
})();
