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
 * 滚动：
 *   是否滚动由 renderLayer 的第 4 个参数 autoScroll 决定（缺省 = depth > 0）：
 *   - 初始化（页面加载 / URL 驱动）时**不滚动** —— 第一层紧贴页面标题，
 *     首层选项多时居中滚动会把标题顶出视口；
 *   - 下钻产生的新层（depth > 0）滚动至视口居中；
 *   - 用户主动的「重新选择」与面包屑回退，即便回到第 0 层也**要滚动**
 *     （是明确的用户意图，不滚会让用户停在「结果卡已消失」的空位置上）。
 *
 * URL 同步：
 *   通过 ?selector=id:path.subpath|id2:path2 参数控制选择器状态。
 *   - 页面加载时解析参数，自动选中对应路径
 *   - 用户交互后 pushState 更新参数
 *   - 浏览器前进/后退时 popstate 重新应用
 *   需要给 .selector-wrap 设置 id 属性才能参与 URL 同步
 *   data-selector-history="false" → replaceState 仅改地址栏，不增加历史条目
 *
 * 配置结构：
 *   config = { title, description?, layerTitle?, options: [...] }
 *   每个选项 = { label, hint?, layerTitle?, children? | result? }
 *   children → 有子选项，继续下钻
 *   result: { title, content(HTML) } → 最终结果
 *   两者互斥
 */

(function () {
  'use strict';

  let ICON_CHEVRON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.41 1.41l4.59-4.59a1 1 0 0 0 0-1.41L10.7 6.7a1 1 0 0 0-1.41 0z"/></svg>';
  let ICON_RESET = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>';

  /* === 实例注册表 & URL 同步 === */
  let registry = []; /* { root, getPath, selectPath, addHistory } */
  let fromURLSync = false; /* true 时抑制 pushState（URL 驱动 / popstate） */

  /**
   * 收集所有已注册实例的路径，构建 selector 参数并写入 URL
   * @param {boolean} usePush — true=用户交互（受 addHistory 控制），false=初始化/URL驱动
   *
   * addHistory 规则：
   *   当 usePush=true 时，若所有参与同步的实例 addHistory=false → replaceState
   *   否则 → pushState（只要有任一实例需要历史记录，就保留）
   */
  function syncURL(usePush) {
    let active = registry.filter(function (inst) {
      return inst.root.id && inst.getPath().length > 0;
    });
    let parts = active.map(function (inst) {
      return inst.root.id + ':' + inst.getPath().join('.');
    });

    let url = new URL(window.location.href);
    if (parts.length > 0) {
      url.searchParams.set('selector', parts.join('|'));
    } else {
      url.searchParams.delete('selector');
    }

    /* 判断实际操作：pushState 还是 replaceState */
    let shouldPush = usePush;
    if (usePush && active.length > 0) {
      /* 只要有一个实例 addHistory=true，就 pushState */
      shouldPush = active.some(function (inst) { return inst.addHistory; });
    }

    if (shouldPush) {
      history.pushState({}, '', url);
    } else {
      history.replaceState({}, '', url);
    }
  }

  /**
   * 读取 URL ?selector= 参数并应用到对应实例
   * 使用 framework.js 的 getQueryString
   */
  function applyURLParam() {
    let raw = null, url=null;
    try {
      url = new URL(window.location.href);
      raw = url.searchParams.get('selector');
    } catch (error) {
      console.error('[selector] 无法查询 URL 参数：', error);
      raw = undefined;
    }
    if (!raw) return;

    fromURLSync = true;

    /* 按 | 分拆多个选择器规格 */
    let specs = raw.split('|');
    for (let i = 0; i < specs.length; i++) {
      let spec = specs[i].trim();
      /* 验证格式：id:path（至少一个冒号，两边非空） */
      let match = spec.match(/^([^:]+):(.+)$/);
      if (!match) continue;

      let id = match[1];
      let pathStr = match[2];
      let labels = pathStr.split('.');

      /* 在注册表中查找匹配的实例 */
      for (let j = 0; j < registry.length; j++) {
        if (registry[j].root.id === id) {
          registry[j].selectPath(labels);
          break;
        }
      }
    }

    fromURLSync = false;
  }

  /* === 单实例初始化 === */
  function initInstance(root, config) {
    let path = [];
    let autoTimer = null;
    let suppressAutoAdvance = false;

    let $bc = function () { return root.querySelector('[data-breadcrumb]'); };
    let $layers = function () { return root.querySelector('[data-layers]'); };
    let $result = function () { return root.querySelector('[data-result]'); };

    /**
     * 渲染一层选项
     * @param {any[]}   options
     * @param {number}  depth
     * @param {string}  [layerTitle]
     * @param {boolean} [autoScroll] 是否把新层滚入视口。
     *        缺省按 depth 推断（depth > 0 才滚）—— 但**初始化渲染第 0 层**与
     *        **用户点「重新选择」/ 面包屑回到第 0 层**都必须显式传值区分，
     *        否则会连带把后者的滚动一起掐掉。
     */
    function renderLayer(options, depth, layerTitle, autoScroll) {
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
      $layers().querySelectorAll('.selector-layer').forEach(function (l) {
        if (parseInt(l.dataset.depth) >= depth) l.remove();
      });
      $result().innerHTML = '';
      $result().classList.remove('visible');

      let layer = document.createElement('div');
      layer.className = 'selector-layer';
      layer.dataset.depth = depth;

      if (layerTitle) {
        let heading = document.createElement('h2');
        heading.className = 'selector-layer-title';
        // 用 innerHTML：layerTitle 可能来自 config.title / option.label，
        // 二者都可能含内联图标等 HTML（label 本就以 innerHTML 渲染）
        heading.innerHTML = layerTitle;
        layer.appendChild(heading);
      }

      options.forEach(function (opt) { layer.appendChild(createOptionButton(opt, depth)); });
      $layers().appendChild(layer);

      requestAnimationFrame(function () { layer.classList.add('visible'); });
      // 是否滚动：未显式指定时，只有下钻出的新层（depth > 0）才滚。
      // 初始化渲染第 0 层时若居中滚动，会把页面标题顶出视口（首层选项多时尤甚）；
      // 而「重新选择」/ 面包屑回退虽同为第 0 层，却是用户主动行为，必须滚。
      let shouldScroll = (autoScroll === undefined) ? depth > 0 : !!autoScroll;
      if (shouldScroll) {
        setTimeout(function () { layer.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
      }
      updateBreadcrumb();

      if (options.length === 1 && !suppressAutoAdvance) {
        autoTimer = setTimeout(function () {
          autoTimer = null;
          let btn = layer.querySelector('.selector-option');
          if (btn) selectOption(options[0], depth, btn);
        }, 700);
      }
    }

    function createOptionButton(option, depth) {
      let btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'selector-option';
      btn.dataset.selected = 'false';
      btn.dataset.label = option.label;
      let hasChildren = option.children && option.children.length > 0;
      btn.innerHTML = '<span class="selector-option-text"><span class="selector-option-label">'
        + option.label + '</span>'
        + (option.hint ? '<span class="selector-option-hint">' + option.hint + '</span>' : '')
        + '</span>'
        + (hasChildren ? '<span class="selector-option-arrow">' + ICON_CHEVRON + '</span>' : '');
      btn.addEventListener('click', function () { selectOption(option, depth, btn); });
      return btn;
    }

    function selectOption(option, depth, buttonEl) {
      let layer = buttonEl.closest('.selector-layer');
      layer.querySelectorAll('.selector-option').forEach(function (b) { b.dataset.selected = 'false'; });
      buttonEl.dataset.selected = 'true';

      path = path.slice(0, depth);
      path[depth] = { option: option, depth: depth };

      if (option.children && option.children.length > 0) {
        renderLayer(option.children, depth + 1, option.layerTitle || option.label);
      } else {
        if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
        $layers().querySelectorAll('.selector-layer').forEach(function (l) {
          if (parseInt(l.dataset.depth) > depth) l.remove();
        });
        let result = option.result || { title: option.label, content: '<p>暂无详细内容。</p>' };
        showResult(result);
      }
      updateBreadcrumb();

      if (!fromURLSync) syncURL(true);
    }

    function showResult(result) {
      let el = $result();
      el.innerHTML = '';

      let card = document.createElement('s-card');
      card.type = 'outlined';
      card.classList.add('selector-result-card');
      let content = '';
      if (result.html) {
        card.innerHTML = result.html;
      } else {
        if (result.title) content += `<div slot="headline">${result.title}</div>`;
        if (result.content) content += `<div slot="text">${result.content}</div>`;
        card.innerHTML = (content) ? content : `<div slot="text">暂无内容</div>`;
      }
      // 绑定新插入元素的命令（统一处理 html / content 两种分支）
      if (typeof window?.streack?.bindCommandOn === 'function') {
        window.streack.bindCommandOn(card);
      }
      el.appendChild(card);

      let resetBtn = document.createElement('s-button');
      resetBtn.type = 'outlined';
      resetBtn.classList.add('selector-reset');
      resetBtn.innerHTML = '<s-icon slot="start">' + ICON_RESET + '</s-icon>重新选择';
      resetBtn.addEventListener('click', resetSelector);
      el.appendChild(resetBtn);

      requestAnimationFrame(function () { el.classList.add('visible'); });
      setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
    }

    function updateBreadcrumb() {
      let bc = $bc();
      if (path.length === 0) { bc.innerHTML = ''; return; }
      let html = '<span class="bc-item" data-depth="0">全部</span>';
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
      // 面包屑回退是用户主动行为，回到第 0 层也要把该层滚回视口
      if (depth === 0) renderLayer(config.options, 0, config.layerTitle || config.title, true);
      else renderLayer(path[depth - 1].option.children, depth, path[depth - 1].option.layerTitle || path[depth - 1].option.label, true);

      if (!fromURLSync) syncURL(true);
    }

    function resetSelector() {
      path = [];
      // 同 goBackTo(0)：点「重新选择」后结果卡被清空，
      // 必须把第 0 层滚回视口，否则用户会停在页面下方一片空白处
      renderLayer(config.options, 0, config.layerTitle || config.title, true);

      if (!fromURLSync) syncURL(true);
    }

    /**
     * 获取当前选择路径（选项 label 数组）
     */
    function getPath() {
      return path.map(function (item) { return item.option.label; });
    }

    /**
     * 按 label 路径自动选中选项（URL 驱动）
     * @param {string[]} labels — 如 ['隐私政策', '我们收集的信息', '账户信息']
     */
    function selectPath(labels) {
      if (!labels || labels.length === 0) return;

      suppressAutoAdvance = true;
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }

      /* 重置到根层 */
      $layers().innerHTML = '';
      $result().innerHTML = '';
      $result().classList.remove('visible');
      path = [];

      /* 渲染根层（URL 驱动，不滚动，保留页面标题可见） */
      renderLayer(config.options, 0, config.layerTitle || config.title, false);

      let currentOptions = config.options;
      for (let i = 0; i < labels.length; i++) {
        let label = labels[i];
        let found = null;
        for (let j = 0; j < currentOptions.length; j++) {
          if (currentOptions[j].label === label) {
            found = currentOptions[j];
            break;
          }
        }
        if (!found) break;

        /* 在当前层中找到对应按钮 */
        let layer = $layers().querySelector('.selector-layer[data-depth="' + i + '"]');
        if (!layer) break;

        let btn = null;
        layer.querySelectorAll('.selector-option').forEach(function (b) {
          if (b.dataset.label === label) btn = b;
        });
        if (!btn) break;

        /* 选中该选项（selectOption 内部会渲染下一层） */
        selectOption(found, i, btn);

        if (found.children && found.children.length > 0) {
          currentOptions = found.children;
        } else {
          break; /* 叶子节点，路径结束 */
        }
      }

      suppressAutoAdvance = false;
    }

    /* 注册实例 */
    let addHistory = root.dataset.selectorHistory !== 'false';
    registry.push({ root: root, getPath: getPath, selectPath: selectPath, addHistory: addHistory });

    /* 启动：初始化渲染第 0 层，不滚动（保留页面标题可见） */
    path = [];
    renderLayer(config.options, 0, config.layerTitle || config.title, false);
  }

  /* === 扫描 & 初始化 === */
  function scanAndInit() {
    let nodes = document.querySelectorAll('[data-selector]');
    nodes.forEach(function (root) {
      if (root.dataset.selectorInit === 'true') return;
      root.dataset.selectorInit = 'true';

      let configScript = root.querySelector('[data-selector-config]');
      if (!configScript) {
        configScript = document.getElementById('selector-config');
        if (!configScript) {
          console.warn('[Selector] No config found for', root);
          return;
        }
      }

      let config;
      try {
        config = JSON.parse(configScript.textContent);
      } catch (e) {
        console.warn('[Selector] Failed to parse config:', e);
        return;
      }

      initInstance(root, config);

      /* 配置已载入内存，移除 DOM 中的原始数据脚本 */
      configScript.remove();

      console.log('[selector] 成功初始化:', root);
    });

    /* 所有实例初始化完成后，应用 URL 参数 */
    if (registry.length > 0) applyURLParam();
  }

  /* popstate：浏览器前进/后退时重新应用 URL 参数 */
  window.addEventListener('popstate', function () {
    applyURLParam();
  });

  /* DOM 就绪后扫描 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAndInit);
  } else {
    scanAndInit();
  }
})();
