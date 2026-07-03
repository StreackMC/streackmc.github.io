/**
 * Streack 主页 · 主逻辑（ES Module）
 * 重构目标：消除历史记录污染，功能语义清晰化
 * 变更说明：
 *   - 移除所有滚动/弹窗操作对 window.location.hash 的写入，根源上消除历史污染
 *   - 弹窗不再通过 hash 导航触发，直接调用函数；hash 仅用于深层链接和浏览器回退
 *   - 修复 dc/dC 大小写 Bug；移除 ChangeColorTheme 等死代码
 *   - 使用清晰的语义化命名，分模块组织
 *   - 转换为 ES Module，集成 LiquidGlass
 */

// ============================================================
//  一、DOM 元素引用
// ============================================================

const DOM = {
  page: document.getElementById("page"),
  main: document.getElementById("main"),
  counting: document.getElementById("counting"),
  slot0Float: document.getElementById("slot0-bg-floatingText"),
  noScript: document.getElementById("no_script"),

  toolbar: {
    root: document.getElementById("toolbar-area"),
    closeArea: document.getElementById("toolbar-outline"),
    btns: {
      root: document.getElementById("toolbar1"),
      search: document.getElementById("toolbar1-search"),
    },
    actions: {
      root: document.getElementById("toolbar2"),
    },
  },

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
      null, // QQ 由函数处理
      "mailto:streack@kdxiaoyi.top",
    ],
  },

  qun: { link: document.getElementById("qqunid") },
  comment: { link: document.getElementById("commentid") },
};


// ============================================================
//  二、工具函数
// ============================================================

/** 获取当前时区信息 */
function getCurrentTimeZone() {
  const offset = new Date().getTimezoneOffset();
  const absH = String(Math.abs(offset) / 60).padStart(2, "0");
  const absM = String(Math.abs(offset) % 60).padStart(2, "0");
  const sign = offset <= 0 ? "+" : "-";
  return {
    offset,
    offsetStr: `UTC${sign}${absH}:${absM}`,
    offsetStrMin: `UTC${sign}${Math.abs(offset) / 60}`,
    ianaName: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
  };
}

/** 获取 URL 查询参数 */
function getQueryString(name) {
  const m = window.location.search.substr(1).match(
    new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i")
  );
  return m ? unescape(m[2]) : null;
}

/**
 * 打开链接（不产生多余 history 条目）
 * @param {string} uri - 目标 URI
 * @param {boolean} stayInSameWindow - 是否在当前窗口打开（默认 false，新窗口）
 */
function openURL(uri, stayInSameWindow = false) {
  const a = document.createElement("a");
  a.target = stayInSameWindow ? "_self" : "_blank";
  a.href = uri;
  a.click();
  return a;
}

/** 显示 Snackbar 消息 */
function msg(message, confirmText, isWarning, duration, onClick, align, icon) {
  const info = {
    root: DOM.page,
    text: message,
    type: isWarning ? "error" : "basic",
    action: {},
  };
  if (confirmText) info.action.text = String(confirmText);
  if (duration) info.duration = parseInt(String(duration), 10);
  if (onClick) info.action.click = onClick;
  if (align != null) info.align = ["auto", "top", "bottom"][Number(align) % 3];
  if (icon) info.icon = icon;
  customElements.get("s-snackbar").builder(info);
  return info;
}

/** 复制文本到剪贴板 */
function CopyText(text) {
  if (!navigator.clipboard) {
    msg("未能复制文本，因为方法不支持", "好", true);
    return false;
  }
  navigator.clipboard.writeText(String(text)).then(
    () => msg("✓ 已复制文本", "好"),
    () => msg("未能复制文本，因为拒绝访问剪贴板", "好", true)
  );
}


// ============================================================
//  三、存储 API（来自 pmd）
// ============================================================

const pmdStorage = {
  Cookies: {
    set(key, value, maxAge, path) {
      const encoded = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      if (maxAge) {
        const d = new Date(Date.now() + maxAge * 1000);
        document.cookie = `${encoded}; expires=${d.toUTCString()}; path=${path || "/"}`;
      } else {
        document.cookie = `${encoded}; path=${path || "/"}`;
      }
    },
    get(key) {
      for (const pair of document.cookie.split("; ")) {
        const [k, v] = pair.split("=", 2);
        if (decodeURIComponent(k) === key) return decodeURIComponent(v);
      }
      return null;
    },
    remove(key) { this.set(key, "", -1); },
    getAll() {
      const r = {};
      for (const pair of document.cookie.split("; ")) {
        const [k, v] = pair.split("=", 2);
        r[decodeURIComponent(k)] = decodeURIComponent(v);
      }
      return r;
    },
    reset_dangerous() { Object.keys(this.getAll()).forEach((k) => this.remove(k)); },
  },
  Local: {
    set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
    get(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch { return localStorage.getItem(key); }
    },
    remove(key) { localStorage.removeItem(key); },
    getAll() {
      const r = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        r[k] = this.get(k);
      }
      return r;
    },
    reset_dangerous() { localStorage.clear(); },
  },
  Session: {
    set(key, value) { sessionStorage.setItem(key, JSON.stringify(value)); },
    get(key) {
      try { return JSON.parse(sessionStorage.getItem(key)); } catch { return sessionStorage.getItem(key); }
    },
    remove(key) { sessionStorage.removeItem(key); },
    getAll() {
      const r = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        r[k] = this.get(k);
      }
      return r;
    },
    reset_dangerous() { sessionStorage.clear(); },
  },
};


// ============================================================
//  四、对话框 / 底栏管理（不操作 hash，不污染历史）
// ============================================================

/** 关闭所有弹窗 */
function closeAllDialogs() {
  document.querySelectorAll("s-bottom-sheet, s-dialog").forEach((el) => {
    el.showed = false;
  });
}

/** 打开「加入游戏」对话框 */
function openPlayDialog() {
  closeAllDialogs();
  DOM.dialog.play.showed = true;
}

/** 打开加群底栏 */
function qqunlink() {
  closeAllDialogs();
  DOM.sheet.qun.showed = true;
}

/** 打开好评底栏 */
function commentlink() {
  closeAllDialogs();
  DOM.sheet.comment.showed = true;
}

/** 赞助倒计时锁状态（-1=空闲, false=暂停, true=已解锁, >0=倒计时） */
let donateLockCounter = -1;
const DONATE_CHECKBOX_HTML =
  '我已认真阅读并同意<a href="./doc/policy/donate">赞助方针</a>。';

/** 打开赞助底栏 */
function donatelink(from = "first") {
  if (from.toLowerCase() === "then") {
    DOM.donate.thk.textContent = "谢谢。";
    donateLockCounter = true;
  } else {
    DOM.donate.thk.textContent = "赞助";
    donateLockCounter = 10;
  }
  closeAllDialogs();
  DOM.sheet.donate.showed = true;
}

/** 打开反馈底栏 */
function issuelink() {
  closeAllDialogs();
  DOM.sheet.issue.showed = true;
}


// ============================================================
//  五、伪参数路由（使用 pushState 替代 hash）
// ============================================================

/**
 * 通过 pushState 打开弹窗，不污染 URL hash
 * @param {string} name - 动作标识：play/donate/qqun/comment/issue
 */
function openState(name) {
  const h = String(name).toLowerCase();
  closeAllDialogs();

  switch (h) {
    case "play":
      DOM.dialog.play.showed = true;
      break;
    case "donate":
      donatelink("first");
      break;
    case "donate_done":
      donatelink("then");
      break;
    case "qqun":
    case "qqun_done":
      qqunlink();
      break;
    case "comment":
    case "comment_done":
      commentlink();
      break;
    case "issue":
    case "issue_done":
      issuelink();
      break;
    default:
      console.warn('未知的动作：' + h);
      return; // 未知动作，不 pushState
  }

  history.pushState({ action: h }, "", window.location.pathname + window.location.search);
}

// 浏览器后退/前进时关闭弹窗
window.addEventListener("popstate", () => {
  closeAllDialogs();
});


// ============================================================
//  六、运营计时器
// ============================================================

function refreshCountup(year, month, day) {
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const elapsed = now - new Date(year, month - 1, day);
  const days = Math.floor(elapsed / 86400000);
  const hours = Math.floor((elapsed % 86400000) / 3600000);
  const minutes = Math.floor((elapsed % 3600000) / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  // ISO-8601 周数
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);

  DOM.counting.innerHTML = `；今天是${now.getFullYear()}年的第${weekNum}周，迄今为止我们已运营${days}天${hours}小时${minutes}分钟${seconds}秒（${window.timezone.offsetStrMin}）`;
}


// ============================================================
//  七、事件绑定
// ============================================================

// 禁止 Safari 双指缩放
document.addEventListener("gesturestart", (e) => e.preventDefault());

// 点击区域外侧关闭 Toolbar
DOM.toolbar.closeArea.addEventListener('click', () => {
  DOM.toolbar.root.classList.remove('expanded');
});

// 页面滚动位置限制，最小更新为 30fps
// let scrollLimiterRafId = null;
// let scrollLimiterTimeoutId = null;
// function limitScroll() {
//   const toolbarHeight = DOM.toolbar.root.offsetHeight - DOM.toolbar.actions.root.offsetHeight;
//   if (DOM.main.scrollTop < toolbarHeight) {
//     DOM.main.scrollTop = toolbarHeight;
//   }
// }
// DOM.main.addEventListener('scroll', function () {
//   // 如果已经有待处理的更新，则不再重复调度
//   if (scrollLimiterRafId !== null || scrollLimiterTimeoutId !== null) {
//     return;
//   }

//   // 1. 调度 requestAnimationFrame（优先）
//   scrollLimiterRafId = requestAnimationFrame(() => {
//     // 如果 setTimeout 尚未触发，则清除它
//     if (scrollLimiterTimeoutId !== null) {
//       clearTimeout(scrollLimiterTimeoutId);
//       scrollLimiterTimeoutId = null;
//     }
//     // 执行更新
//     limitScroll();
//     scrollLimiterRafId = null;
//   });

//   // 2. 调度 setTimeout 后备（约 30 FPS）
//   scrollLimiterTimeoutId = setTimeout(() => {
//     // 如果 rAF 尚未执行，则取消它
//     if (scrollLimiterRafId !== null) {
//       cancelAnimationFrame(scrollLimiterRafId);
//       scrollLimiterRafId = null;
//     }
//     // 执行更新
//     limitScroll();
//     scrollLimiterTimeoutId = null;
//   }, 33); // 33ms ≈ 30 FPS
// });

// --- Issue 链接选择器 ---
DOM.issue.selector.addEventListener("change", (event) => {
  const idx = DOM.issue.values.indexOf(event.target.value);
  if (idx < 0 || idx >= DOM.issue.links.length) {
    msg("不存在的工单链接标识", "好", true);
    event.target.value = "";
    return;
  }
  const link = DOM.issue.links[idx];
  if (link) {
    openURL(link, true);
  } else if (event.target.value === "qq") {
    // QQ 特殊处理：直接调用函数而非 javascript: URI
    qqunlink();
  }
  event.target.value = "";
});

// --- 赞助面板 ---
DOM.donate.selector.addEventListener("change", (event) => {
  // 直接跳转支付链接，不再设置 hash 避免污染历史
  if (event.target.value) {
    openURL(event.target.value, true);
  }
  event.target.value = "";
});

// 赞助倒计时循环
setInterval(() => {
  const cb = DOM.donate.checkbox;
  if (donateLockCounter === false) {
    // 暂停状态
    return;
  }
  if (donateLockCounter === true) {
    // 已解锁
    cb.disabled = false;
    DOM.donate.fold.folded = true;
    donateLockCounter = -1;
  } else if (donateLockCounter <= 0) {
    // 倒计时结束，解锁
    cb.disabled = false;
    cb.innerHTML = DONATE_CHECKBOX_HTML;
    donateLockCounter = false;
  } else {
    // 倒计时中
    cb.disabled = true;
    DOM.donate.fold.folded = true;
    cb.checked = false;
    cb.innerHTML = DONATE_CHECKBOX_HTML + `(${donateLockCounter})`;
    donateLockCounter -= 1;
  }
}, 1000);

DOM.donate.checkbox.addEventListener("click", () => {
  if (DOM.donate.checkbox.disabled) {
    DOM.donate.checkbox.checked = false;
    return;
  }
  DOM.donate.fold.folded = !DOM.donate.checkbox.checked;
});

// --- Toolbar按钮 ---

let a=false;
DOM.toolbar.btns.search.addEventListener('click', () => {
  if (!a) {
    DOM.toolbar.root.classList.add('expanded');
  } else {
    DOM.toolbar.root.classList.remove('expanded');
  }
  a = !a;
});

// ============================================================
//  八、初始化
// ============================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/** 立即完成页面框架初始化 */
async function init() {
  // 移除非脚本提示
  if (DOM.noScript) DOM.noScript.remove();

  // 处理初始深层链接（通过 openState() + pushState）
  const params = new URLSearchParams(window.location.search);
  const action = params.get("action");
  if (action) openState(action);

  // 修正页面滚动位置
  // limitScroll();

  // 修正工具栏状态
  DOM.toolbar.actions.root.style = "";

  // 初始化视频背景
  initVideoBg();
}

/** 立即初始化视频背景 */
function initVideoBg() {
  const videos = document.querySelectorAll('video.slotBg-V');
  videos.forEach((video) => {
    // 获取对应的video元素
    const token = `img.slotBg-V[data-ivpair="${video?.dataset?.ivpair}"]`;

    // 计划播放视频并隐藏图片
    video.currentTime = 0;
    video.addEventListener('loadeddata', function onBackgroundVideoReady() {
      // 为了防止长 GOP 在 0 秒处未完全渲染，用 rAF 保证下一帧绘制完成
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { // 双重 rAF 确保浏览器合成线程已经拿到画面
          // 先播放（因为loop必须播放才能循环）
          video.play().then(function onVideoStartPlay() {
          }).catch(err => {
            console.warn('自动播放被拦截，需要用户手势');
            video.addEventListener('click', function onImgClick() {
              onBackgroundVideoReady();
              video.removeEventListener('click', onImgClick);
            });
          });
        });
      });

      // 移除监听，防止重复触发
      video.removeEventListener('loadeddata', onBackgroundVideoReady);
    });
  });
}

// ============================================================
//  九、导出（ES Module 接口）
// ============================================================

// 导出内部 API 以供其他模块使用
export {
  DOM,
  openURL,
  msg,
  CopyText,
  pmdStorage,
  closeAllDialogs,
  openPlayDialog,
  qqunlink,
  commentlink,
  donatelink,
  issuelink,
  openState,
  getCurrentTimeZone,
};

// 暴露给 HTML 内联事件处理器（onclick 等）
if (!window.streack) {
  window.streack = {};
}
window.streack = {
  timezone: getCurrentTimeZone(),
  CopyText: CopyText,
  msg: msg,
  openURL: openURL,
  closeAllDialogs: closeAllDialogs,
  openPlayDialog: openPlayDialog,
  qqunlink: qqunlink,
  commentlink: commentlink,
  donatelink: donatelink,
  issuelink: issuelink,
  openState: openState,
};