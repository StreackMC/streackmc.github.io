/**
 * Streack 首页 · 页面特定脚本
 * 首页独有的对话框/底栏/赞助等逻辑
 * 运营计时器（counting）与视频背景（videoBg）等可选组件由
 * <streack features="…"> 声明后按需加载，本文件不再直接调用
 *
 * 全局 API（openURL / msg / CopyText 等）统一由 frame/api.js 暴露，
 * 页面脚本不再重复挂载；URL 参数读取统一走框架的 getQueryString。
 */

import { openURL, getQueryString } from '../frame/utils.js';
import { executeCommand } from '../frame/commands.js';
import { requestInitFunc } from '../frame/init-hooks.js';
import { shrinkToolbar } from '../component/toolbar/toolbar.js';


// ============================================================
// 旧 state 向后兼容 —— 处理地址栏 & hash 路由
// ============================================================

// 记录本页脚本已加载（window.streack 由框架建立，此处只补 initby 追踪标记）
window.streack?.meta?.initby?.push?.('page/home.js');

/** 将旧 state 动作转发到新 API */
function migrateState(name) {
  const h = String(name).trim().toLowerCase();
  switch (h) {
    case "play":
      return executeCommand('bst', 'play_message');
    case "donate":
    case "donate_done":
      openURL('/about/donate', true);
      return true;
    case "qqun":
    case "qqun_done":
      openURL('/about/contact', true);
      return true;
    case "comment":
      openURL('/', true);
      return true;
    case "issue":
      openURL('/about/contact', true);
      return true;
    default:
      return false;
  }
}

// 保持 openState 挂载以防外部代码引用，内部转发到新 API
window.streack.openState = migrateState;

// 浏览器后退/前进时关闭所有弹窗并收起 Toolbar
window.addEventListener("popstate", () => {
  document.querySelectorAll('s-dialog, s-bottom-sheet').forEach(el => { el.showed = false; });
  shrinkToolbar();
});

// 兼容 Hash 路由 → 转发到新 API
window.addEventListener('hashchange', () => {
  const hash = location.hash.slice(1);
  if (!hash) return;
  const [t, p] = hash.split(':', 2);
  if (t === 'state') {
    migrateState(p);
  } else {
    executeCommand(t, p);
  }
});


// ============================================================
// 初始化 —— 通过 requestInitFunc 注册，框架就绪后自动执行
// ============================================================

requestInitFunc(() => {
  // 处理初始深层链接（旧 state 兼容 → 转发到新 API）
  const action = getQueryString('action');
  if (action) migrateState(action);

  // 视频背景（videoBg）等可选组件由页面声明后按需加载，见 FrameworkLayout
});
