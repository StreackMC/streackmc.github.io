/**
 * Streack Selector 分层选择器 · 页面脚本
 *
 * 职责：
 *   读取页面内 <script type="application/json" id="selector-config"> 的配置，
 *   渲染分层选择器交互。
 *
 * 配置结构（由 SelectorLayout 序列化注入）：
 *   config = { title, description, layerTitle?, options: [...] }
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

/* 读取由 SelectorLayout 序列化的配置 */
const configScript = document.getElementById('selector-config');
if (!configScript) {
  console.warn('[Selector] #selector-config not found');
} else {
  const config = JSON.parse(configScript.textContent);

  let path = [];
  let autoTimer = null;

  const root = document.querySelector('.selector-wrap');
  if (!root) {
    console.warn('[Selector] .selector-wrap not found');
  } else {
    const $bc = () => root.querySelector('[data-breadcrumb]');
    const $layers = () => root.querySelector('[data-layers]');
    const $result = () => root.querySelector('[data-result]');

    const ICON_CHEVRON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.41 1.41l4.59-4.59a1 1 0 0 0 0-1.41L10.7 6.7a1 1 0 0 0-1.41 0z"/></svg>';
    const ICON_RESET = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>';

    function initSelector() {
      path = [];
      renderLayer(config.options, 0, config.layerTitle || config.title);
    }

    function renderLayer(options, depth, layerTitle) {
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
      $layers().querySelectorAll('.selector-layer').forEach(l => {
        if (parseInt(l.dataset.depth) >= depth) l.remove();
      });
      $result().innerHTML = '';
      $result().classList.remove('visible');

      const layer = document.createElement('div');
      layer.className = 'selector-layer';
      layer.dataset.depth = depth;

      /* 层级标题（分割不同选择区域） */
      if (layerTitle) {
        const heading = document.createElement('h2');
        heading.className = 'selector-layer-title';
        heading.textContent = layerTitle;
        layer.appendChild(heading);
      }

      options.forEach(opt => layer.appendChild(createOptionButton(opt, depth)));
      $layers().appendChild(layer);

      requestAnimationFrame(() => layer.classList.add('visible'));
      setTimeout(() => layer.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      updateBreadcrumb();

      if (options.length === 1) {
        autoTimer = setTimeout(() => {
          autoTimer = null;
          const btn = layer.querySelector('.selector-option');
          if (btn) selectOption(options[0], depth, btn);
        }, 700);
      }
    }

    function createOptionButton(option, depth) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'selector-option';
      btn.dataset.selected = 'false';
      const hasChildren = option.children && option.children.length > 0;
      btn.innerHTML = '<span class="selector-option-text"><span class="selector-option-label">'
        + option.label + '</span>'
        + (option.hint ? '<span class="selector-option-hint">' + option.hint + '</span>' : '')
        + '</span>'
        + (hasChildren ? '<span class="selector-option-arrow">' + ICON_CHEVRON + '</span>' : '');
      btn.addEventListener('click', () => selectOption(option, depth, btn));
      return btn;
    }

    function selectOption(option, depth, buttonEl) {
      const layer = buttonEl.closest('.selector-layer');
      layer.querySelectorAll('.selector-option').forEach(b => b.dataset.selected = 'false');
      buttonEl.dataset.selected = 'true';

      path = path.slice(0, depth);
      path[depth] = { option, depth };

      if (option.children && option.children.length > 0) {
        renderLayer(option.children, depth + 1, option.layerTitle || option.label);
      } else {
        /* 清理更深层级（从分支切换到叶子时，旧子层必须移除） */
        if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
        $layers().querySelectorAll('.selector-layer').forEach(l => {
          if (parseInt(l.dataset.depth) > depth) l.remove();
        });
        const result = option.result || { title: option.label, content: '<p>暂无详细内容。</p>' };
        showResult(result);
      }
      updateBreadcrumb();
    }

    function showResult(result) {
      const el = $result();
      el.innerHTML = '';

      /* Sober UI s-card */
      const card = document.createElement('s-card');
      card.type = 'outlined';
      card.classList.add('selector-result-card');
      card.innerHTML = '<div slot="headline">' + result.title + '</div><div slot="text">' + result.content + '</div>';
      el.appendChild(card);

      /* Sober UI s-button */
      const resetBtn = document.createElement('s-button');
      resetBtn.type = 'outlined';
      resetBtn.classList.add('selector-reset');
      resetBtn.innerHTML = '<s-icon slot="start">' + ICON_RESET + '</s-icon>重新选择';
      resetBtn.addEventListener('click', resetSelector);
      el.appendChild(resetBtn);

      requestAnimationFrame(() => el.classList.add('visible'));
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }

    function updateBreadcrumb() {
      const bc = $bc();
      if (path.length === 0) { bc.innerHTML = ''; return; }
      let html = '<span class="bc-item" data-depth="0">全部</span>';
      path.forEach((item, i) => {
        html += '<span class="bc-sep">›</span>';
        if (i === path.length - 1) {
          html += '<span class="bc-item current">' + item.option.label + '</span>';
        } else {
          html += '<span class="bc-item" data-depth="' + (i + 1) + '">' + item.option.label + '</span>';
        }
      });
      bc.innerHTML = html;
      bc.querySelectorAll('.bc-item[data-depth]').forEach(el => {
        el.addEventListener('click', () => goBackTo(parseInt(el.dataset.depth)));
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

    initSelector();
  }
}
