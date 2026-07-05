/**
 * Streack 首页 · 页面特定脚本
 * 首页独有的对话框/底栏/赞助/计时器等逻辑
 */

import {
  DOM, openURL, msg, CopyText,
  executeCommand, shrinkToolbar, requestInitFunc,
  initVideoBg, initLoopCards,
} from '../app/framework.js';


// ============================================================
// DOM 元素引用
// ============================================================

const homeDOM = {
  counting: null,
};


// ============================================================
// 旧 state 向后兼容 —— 处理地址栏 & hash 路由
// ============================================================

if (!window.streack) window.streack = {};

/** 将旧 state 动作转发到新 API */
function migrateState(name) {
  const h = String(name).trim().toLowerCase();
  switch (h) {
    case "play":
      return executeCommand('bst', 'play_message');
    case "donate":
    case "donate_done":
      window.open('/about/donate', '_self');
      return true;
    case "qqun":
    case "qqun_done":
      window.open('/about/contact', '_self');
      return true;
    case "comment":
      window.open('/', '_self');
      return true;
    case "issue":
      window.open('/about/contact', '_self');
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
// 运营计时器
// ============================================================

function refreshCountup(year, month, day) {
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const elapsed = now - new Date(year, month - 1, day);
  const days = Math.floor(elapsed / 86400000);
  const hours = Math.floor((elapsed % 86400000) / 3600000);
  const minutes = Math.floor((elapsed % 3600000) / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);

  if (homeDOM.counting) {
    homeDOM.counting.innerHTML = `今天是${now.getFullYear()}年的第${weekNum}周，迄今为止我们已运营${days}天${hours}小时${minutes}分钟${seconds}秒。`;
  }
}


// ============================================================
// 事件绑定（首页独有）
// ============================================================

//（无旧弹窗相关的事件绑定）


// ============================================================
// 初始化 —— 通过 requestInitFunc 注册，框架就绪后自动执行
// ============================================================

requestInitFunc(() => {
  // 填充动态 DOM 引用（来自 footer include）
  homeDOM.counting = document.getElementById("counting");

  // 处理初始深层链接（旧 state 兼容 → 转发到新 API）
  const params = new URLSearchParams(window.location.search);
  const action = params.get("action");
  if (action) migrateState(action);

  // 启动运营计时器
  refreshCountup(2024, 12, 25);
  setInterval(() => refreshCountup(2024, 12, 25), 1000);

  // 初始化视频背景
  initVideoBg();

  // 初始化循环卡片
  initLoopCards();

});


// ============================================================
// 暴露给全局（供 HTML onclick 等调用）
// ============================================================

window.streack.openURL = openURL;
window.streack.openState = migrateState;
window.streack.msg = msg;
window.streack.CopyText = CopyText;
window.CopyText = CopyText;
