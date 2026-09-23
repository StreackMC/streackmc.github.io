import { shrinkToolbar } from './toolbar/toolbar.js';

// ============================================================
// 对话框 / 底栏管理
// ============================================================

/**
 * 关闭所有弹窗（底栏弹出层、对话框）并收起 Toolbar
 * 用于导航跳转前的全局清理
 */
export function closeAllDialogs() {
  document.querySelectorAll("s-bottom-sheet, s-dialog").forEach((el) => {
    el.showed = false;  // 设置组件属性以关闭弹窗
  });
  shrinkToolbar();
}
