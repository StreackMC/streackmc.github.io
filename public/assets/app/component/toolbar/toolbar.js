import { DOM } from '../../frame/dom.js';

// ============================================================
// Toolbar 插槽管理器
// ============================================================

/** 缓存所有 toolbar2 插槽 { slotName: HTMLElement } */
export const toolbarSlots = {};

/** 缓存插槽引用 */
export function cacheToolbarSlots() {
  document.querySelectorAll('[data-toolbar-slot]').forEach((el) => {
    toolbarSlots[el.dataset.toolbarSlot] = el;
  });
}

/** Toolbar 当前是否处于展开状态 */
export let toolbarExpanded = false;

/**
 * 收起 Toolbar（带出场动画）
 * - 移除 expanded 类触发 CSS 关带动画
 * - 已激活的插槽添加 leaving 类播放离场动画后自动移除
 */
export function shrinkToolbar() {
  if (!DOM.toolbar) return;
  // 清除未完成的展开结束处理（transitionend），防止动画期间快速操作
  if (DOM.toolbar.root._expandEndHandler) {
    DOM.toolbar.root.removeEventListener('transitionend', DOM.toolbar.root._expandEndHandler);
    DOM.toolbar.root._expandEndHandler = null;
  }
  DOM.toolbar.root.removeEventListener('mouseleave', shrinkToolbar);
  document.removeEventListener('click', onOutsideClick);
  DOM.toolbar.root.classList.remove('expanded');
  toolbarExpanded = false;
  Object.values(toolbarSlots).forEach((s) => {
    if (s.classList.contains('active')) {
      s.classList.add('leaving');
      // 动画结束后清理 leaving 类
      s.addEventListener('animationend', function onLeave() {
        s.classList.remove('leaving');
        s.removeEventListener('animationend', onLeave);
      }, { once: true });
    }
  });
}

/**
 * 展开 Toolbar 并激活指定插槽
 * - 先取消所有插槽的激活状态，再激活目标插槽
 * - 添加 expanded 类触发 CSS 展带动画
 * - 动画期间禁滚（toolbar2-disallow-scroll），过渡结束再按 noscroll 恢复滚动
 * @param {string} [slotName] - 要激活的插槽名称
 */
export function expandToolbar(slotName) {
  if (!DOM.toolbar) return;
  toolbarExpanded = true;
  // 取消所有插槽的激活状态
  Object.values(toolbarSlots).forEach((s) => s.classList.remove('active'));
  if (slotName && toolbarSlots[slotName]) {
    toolbarSlots[slotName].classList.add('active');
  }
  DOM.toolbar.root.classList.add('expanded');

  // 动画期间禁滚，避免 grid 展开过程中滚动条闪现
  const toolbar2 = DOM.toolbar.actions.root;
  toolbar2.classList.add('toolbar2-disallow-scroll');
  DOM.toolbar.root.addEventListener('mouseleave', shrinkToolbar);

  // 用 transitionend 替代 setTimeout(600) 魔法数字：等高度展开过渡结束再切换滚动
  const onExpanded = (e) => {
    if (e.target !== DOM.toolbar.root || e.propertyName !== 'grid-template-rows') return;
    DOM.toolbar.root.removeEventListener('transitionend', onExpanded);
    DOM.toolbar.root._expandEndHandler = null;
    if (!toolbarExpanded) return;  // 动画期间已被收起，不处理
    document.addEventListener('click', onOutsideClick);
    if (slotName && toolbarSlots[slotName]?.dataset.noscroll) {
      toolbar2.classList.add('toolbar2-disallow-scroll');
    } else {
      toolbar2.classList.remove('toolbar2-disallow-scroll');
    }
  };
  DOM.toolbar.root._expandEndHandler = onExpanded;
  DOM.toolbar.root.addEventListener('transitionend', onExpanded);
}

/** 切换 Toolbar 的展开/收起状态 */
export function switchToolbar(slotName) {
  if (toolbarExpanded) {
    shrinkToolbar();
  } else {
    expandToolbar(slotName);
  }
}

function onOutsideClick(e) {
  if (!DOM.toolbar.root.contains(e.target)) {
    shrinkToolbar();
  }
  // TODO: 点击范围外不应触发事件；此处由于事件已经冒泡到 document 了所以无效
  e.stopImmediatePropagation();
  e.preventDefault();
}

// ============================================================
// Toolbar2 插槽注册
// ============================================================

/**
 * 注册自定义 toolbar2 插槽
 * 页面可通过此函数或 <template data-toolbar2-slot="name"> 添加自定义抽屉面板
 * @param {string} name - 插槽名称（传给 expandToolbar 使用）
 * @param {string} html  - 插槽 HTML 内容
 * @param {{ noscroll?: boolean }} [opts] - 选项
 */
export function registerToolbarSlot(name, html, opts = {}) {
  const toolbar2 = document.getElementById('toolbar2');
  if (!toolbar2) return;

  const div = document.createElement('div');
  div.dataset.toolbarSlot = name;
  div.className = 'toolbar2-slot';
  if (opts.noscroll !== false) div.dataset.noscroll = 'true';
  // div.style.overflow = 'hidden';
  div.innerHTML = html;
  toolbar2.appendChild(div);
  toolbarSlots[name] = div;
}

/** 初始化 toolbar2 插槽：移动端导航 + 页面自定义插槽 */
export async function initToolbar2Slots() {
  // A) 移动端导航菜单
  const menuBtn = document.getElementById('toolbar1-menu');
  const navSlot = toolbarSlots.nav;
  if (menuBtn && navSlot) {
    menuBtn.addEventListener('click', () => {
      if (toolbarExpanded) {
        shrinkToolbar();
        return;
      }

      navSlot.innerHTML = '';
      // 从 #toolbar-nav-slot 克隆导航项（模板已在 initFramework 步骤 4 中注入到此）
      const sourceSlot = document.getElementById('toolbar-nav-slot');
      if (sourceSlot) {
        Array.from(sourceSlot.children).forEach((child) => {
          const clone = child.cloneNode(true);
          clone.removeAttribute('pc-only');
          clone.removeAttribute('mobile-only');
          navSlot.appendChild(clone);
        });
      }

      expandToolbar('nav');
    });
  }

  // B) 页面自定义插槽：<template data-toolbar2-slot="name">
  document.querySelectorAll('template[data-toolbar2-slot]').forEach((tmpl) => {
    const name = tmpl.dataset.toolbar2Slot;
    if (!name || toolbarSlots[name]) return;
    registerToolbarSlot(name, tmpl.innerHTML);
    tmpl.remove();
  });
}
