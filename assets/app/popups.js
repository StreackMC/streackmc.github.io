/**
 * Streack Popups Module — 统一弹窗/工具栏管理
 * 提供 toolbar/tb、dialog/dlg、sheet/bst 三种命令的动态查找与展示，
 * 通过框架的命令注册机制自动接入 executeCommand。
 */

import {
  registerCommand, toolbarSlots,
  expandToolbar,
} from './framework.js';


// ============================================================
// 核心操作函数
// ============================================================

/**
 * 按名称查找 toolbar2 插槽并展开
 * @param {string} name - data-toolbar-slot 属性值
 * @returns {boolean}
 */
function openToolbarSlot(name) {
  const slot = toolbarSlots[name] || document.querySelector(`[data-toolbar-slot="${name}"]`);
  if (!slot) return false;
  expandToolbar(name);
  return true;
}

/**
 * 按 ID 查找 s-dialog 并显示
 * @param {string} id - 元素 id
 * @returns {boolean}
 */
function openDialog(id) {
  const el = document.getElementById(id);
  if (!el || el.tagName !== 'S-DIALOG') return false;
  el.showed = true;
  return true;
}

/**
 * 按 ID 查找 s-bottom-sheet 并显示
 * @param {string} id - 元素 id
 * @returns {boolean}
 */
function openSheet(id) {
  const el = document.getElementById(id);
  if (!el || el.tagName !== 'S-BOTTOM-SHEET') return false;
  el.showed = true;
  return true;
}


// ============================================================
// 命令注册
// ============================================================

registerCommand('toolbar', openToolbarSlot);
registerCommand('tb', openToolbarSlot);
registerCommand('dialog', openDialog);
registerCommand('dlg', openDialog);
registerCommand('sheet', openSheet);
registerCommand('bst', openSheet);
