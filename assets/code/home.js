/**
 * Streack 首页 · 页面特定脚本
 * 首页独有的对话框/底栏/赞助/计时器等逻辑
 */

import {
  DOM, openURL, msg, CopyText, closeAllDialogs,
  executeCommand, shrinkToolbar, requestInitFunc,
  initVideoBg, initLoopCards,
} from '../app/framework.js';
import { initSearch } from '../app/search.js';


// ============================================================
// DOM 元素引用
// 静态元素（对话框等）可直接查询；动态元素（footer 等）在 init 中填充
// ============================================================

const homeDOM = {
  counting: null,
  slot0Float: document.getElementById("slot0-bg-floatingText"),

  dialog: {
    play: document.getElementById("go-play"),
  },

  sheet: {
    qun: document.getElementById("qun_message"),
    donate: document.getElementById("donate_message"),
    comment: document.getElementById("comment_message"),
    issue: document.getElementById("issue_message"),
  },

  donate: {
    thk: document.getElementById("donate_THK_message"),
    checkbox: document.getElementById("donate_checkbox"),
    fold: document.getElementById("donate_fold"),
    selector: document.getElementById("donate_link_selector"),
  },

  issue: {
    selector: document.getElementById("issue_link_selector"),
    values: ["github", "gitee", "qq", "email"],
    links: [
      "https://github.com/StreackMC/issues/new",
      "https://gitee.com/kdxiaoyi/issues/new",
      null,
      "mailto:streack@kdxiaoyi.top",
    ],
  },

  qun: { link: document.getElementById("qqunid") },
  comment: { link: document.getElementById("commentid") },
};


// ============================================================
// 对话框 / 底栏操作
// ============================================================

/** 打开「加入游戏」对话框 */
function openPlayDialog() {
  closeAllDialogs();
  homeDOM.dialog.play.showed = true;
}

/** 打开加群底栏 */
function qqunlink() {
  closeAllDialogs();
  openURL("https://qun.qq.com/universal-share/share?ac=1&authKey=s5cU0BgRmCgh7IpO6euWb%2BNfJ0eMAROSmpk2oYHMQPqDBu6gQZ65SZTpv2%2BKV0xb&busi_data=eyJncm91cENvZGUiOiI5Mzk2NTgzMDUiLCJ0b2tlbiI6IlBSbFZsb3M0bHZRZEs5aHBzMnQ0SWFxMTJETWY5M1IzUEU4aThodC9Ja1VNSTAzWXJ5TnFkdWtSeWtlZWM0L1kiLCJ1aW4iOiIxMjkxNjQ2NDAxIn0%3D&data=BklO_dMaEAelBXAEjYa83iYMU5Y2qC7bIrkA2ZtrFWz3HbIkwVvT4IE5_xBP1Wlj4OKod-VVTle9TL8nDGZjig&svctype=4&tempid=h5_group_info", false);
  homeDOM.sheet.qun.showed = true;
}

/** 打开好评底栏 */
function commentlink() {
  closeAllDialogs();
  homeDOM.sheet.comment.showed = true;
}

/** 赞助倒计时（>0 倒计时中，-1 空闲） */
let donateLockCounter = -1;

const DONATE_CHECKBOX_HTML = '我已认真阅读并同意赞助方针。';

/** 打开赞助底栏 */
function donatelink(from = "first") {
  if (from.toLowerCase() === "then") {
    homeDOM.donate.thk.textContent = "谢谢。";
    donateLockCounter = 0;
  } else {
    homeDOM.donate.thk.textContent = "赞助";
    donateLockCounter = 15;
  }
  closeAllDialogs();
  homeDOM.sheet.donate.showed = true;
}

/** 打开反馈底栏 */
function issuelink() {
  closeAllDialogs();
  homeDOM.sheet.issue.showed = true;
}


// ============================================================
// 新 Toolbar 动作路由
// ============================================================

/**
 * 处理 toolbar 命令（由 framework executeCommand 调用）
 * @param {string} name - 动作标识
 * @returns {boolean} 是否成功执行
 */
function openToolbar(name) {
  const h = String(name).trim().toLowerCase();
  closeAllDialogs();

  switch (h) {
    case "play":
      homeDOM.dialog.play.showed = true;
      break;
    default:
      console.warn('[toolbar] 未知的动作：' + h);
      return false;
  }

  history.pushState({ toolbar: h }, "", window.location.pathname + window.location.search);
  return true;
}

if (!window.streack) window.streack = {};
window.streack.openToolbar = openToolbar;


// ============================================================
// 旧 state 向后兼容 —— 处理地址栏 & hash 路由
// ============================================================

/** 将旧 state 动作转发到新 API（弹窗类→openToolbar，其他→独立页面） */
function migrateState(name) {
  const h = String(name).trim().toLowerCase();
  switch (h) {
    case "play":
      return openToolbar('play');
    case "donate":
    case "donate_done":
      window.open('/donate', '_self');
      return true;
    case "qqun":
    case "qqun_done":
      window.open('/qqun', '_self');
      return true;
    case "comment":
      window.open('/comment', '_self');
      return true;
    case "issue":
      window.open('/issue', '_self');
      return true;
    default:
      return false;
  }
}

// 保持 openState 挂载以防外部代码引用，内部转发到新 API
window.streack.openState = migrateState;

// 浏览器后退/前进时关闭弹窗
window.addEventListener("popstate", () => {
  closeAllDialogs();
});

// 兼容 Hash 路由 → 转发到新 API
window.addEventListener('hashchange', () => {
  const hash = location.hash.slice(1);
  if (!hash) return;
  const [t, p] = hash.split(':', 2);
  if (t === 'toolbar') {
    openToolbar(p);
  } else if (t === 'state') {
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

// --- Issue 链接选择器 ---
homeDOM.issue.selector.addEventListener("change", (event) => {
  const idx = homeDOM.issue.values.indexOf(event.target.value);
  if (idx < 0 || idx >= homeDOM.issue.links.length) {
    msg("不存在的工单链接标识", "好", true);
    event.target.value = "";
    return;
  }
  const link = homeDOM.issue.links[idx];
  if (link) {
    openURL(link, true);
  } else if (event.target.value === "qq") {
    qqunlink();
  }
  event.target.value = "";
});

// --- 赞助面板 ---
homeDOM.donate.selector.addEventListener("change", (event) => {
  if (event.target.value) {
    openURL(event.target.value, true);
  }
  event.target.value = "";
});

// 赞助倒计时循环
let donateUnlockingInterval = setInterval(() => {
  const cb = homeDOM.donate.checkbox;

  if (donateLockCounter > 0) {
    cb.disabled = true;
    homeDOM.donate.fold.folded = true;
    cb.checked = false;
    cb.innerHTML = DONATE_CHECKBOX_HTML + `（${donateLockCounter}秒）`;
    donateLockCounter -= 1;

    if (donateLockCounter <= 0) {
      donateLockCounter = -1;
      cb.disabled = false;
      cb.innerHTML = DONATE_CHECKBOX_HTML;
      homeDOM.donate.fold.folded = true;
      clearInterval(donateUnlockingInterval);
    }
    return;
  }
}, 1000);

homeDOM.donate.checkbox.addEventListener("click", () => {
  if (homeDOM.donate.checkbox.disabled) {
    homeDOM.donate.checkbox.checked = false;
    return;
  }
  homeDOM.donate.fold.folded = !homeDOM.donate.checkbox.checked;
});


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
window.streack.openToolbar = openToolbar;
window.streack.openState = migrateState;
window.streack.msg = msg;
window.streack.CopyText = CopyText;
// HTML onclick / javascript: 直接调用的函数需暴露到全局
window.CopyText = CopyText;
window.commentlink = commentlink;
window.qqunlink = qqunlink;
