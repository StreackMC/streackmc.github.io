import { initSearch } from './search.js';

// ============================================================
// DOM 元素引用
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
// 工具函数
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
// 存储 API（来自 pmd）
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
// 对话框 / 底栏管理（不操作 hash，不污染历史）
// ============================================================

/** 关闭所有弹窗 */
function closeAllDialogs() {
  document.querySelectorAll("s-bottom-sheet, s-dialog").forEach((el) => {
    el.showed = false;
  });
  shrinkToolbar();
}

/** 打开「加入游戏」对话框 */
function openPlayDialog() {
  closeAllDialogs();
  DOM.dialog.play.showed = true;
}

/** 打开加群底栏 */
function qqunlink() {
  closeAllDialogs();
  openURL("https://qun.qq.com/universal-share/share?ac=1&authKey=s5cU0BgRmCgh7IpO6euWb%2BNfJ0eMAROSmpk2oYHMQPqDBu6gQZ65SZTpv2%2BKV0xb&busi_data=eyJncm91cENvZGUiOiI5Mzk2NTgzMDUiLCJ0b2tlbiI6IlBSbFZsb3M0bHZRZEs5aHBzMnQ0SWFxMTJETWY5M1IzUEU4aThodC9Ja1VNSTAzWXJ5TnFkdWtSeWtlZWM0L1kiLCJ1aW4iOiIxMjkxNjQ2NDAxIn0%3D&data=BklO_dMaEAelBXAEjYa83iYMU5Y2qC7bIrkA2ZtrFWz3HbIkwVvT4IE5_xBP1Wlj4OKod-VVTle9TL8nDGZjig&svctype=4&tempid=h5_group_info", false);
  DOM.sheet.qun.showed = true;
}

/** 打开好评底栏 */
function commentlink() {
  closeAllDialogs();
  DOM.sheet.comment.showed = true;
}

/** 赞助倒计时（>0 倒计时中，-1 空闲） */
let donateLockCounter = -1;

const DONATE_CHECKBOX_HTML = '我已认真阅读并同意赞助方针。';

/** 打开赞助底栏 */
function donatelink(from = "first") {
  if (from.toLowerCase() === "then") {
    DOM.donate.thk.textContent = "谢谢。";
    // 立即解锁
    donateLockCounter = 0;
  } else {
    DOM.donate.thk.textContent = "赞助";
    // 如果已解锁，那么将没有逻辑处理倒计时，也就是自动忽略
    donateLockCounter = 15;
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
// 伪参数路由与命令
// ============================================================

/**
 * 通过 pushState 打开弹窗，不污染 URL hash
 * @returns 是否成功执行
 * @param {string} name - 动作标识：play/donate/qqun/comment/issue
 */
function openState(name) {
  const h = String(name).trim().toLowerCase();
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
      commentlink();
      break;
    case "issue":
      issuelink();
      break;
    default:
      console.warn('[state] 未知的动作：' + h);
      return false; // 未知动作，不 pushState
  }

  history.pushState({ action: h }, "", window.location.pathname + window.location.search);
  return true;
}

/**
 * 执行命令
 * @returns 是否成功执行
 * @param {'url'|'state'|'slot'} type 命令类型
 * @param {string} param 命令参数
 */
function executeCommand(type, param) {
  if (!(type && param)) return false;
  switch (type.toLowerCase()) {
    case 'url':
      openURL(...param.split("|", 2));
      break;
    case 'state':
      openState(param);
      break;
    case 'slot':
      param = parseInt(param);
      const slot = document.querySelector(`div[slot="${param}"]`);
      try {
        slot.scrollIntoView({
          behavior: 'smooth',
          container: 'nearest',
          block: 'center',
        });
      } catch (error) {
        console.warn('[cmd/slot] 无法滚动目标元素', param, '至视口：', error);
        msg('无法查找目标锚点：' + error.message, '好', true);
      }
      break;
  
    default:
      return false;
  };
  return true;
}

// 浏览器后退/前进时关闭弹窗
window.addEventListener("popstate", () => {
  closeAllDialogs();
});

// 兼容以前的Hash路由
window.addEventListener('hashchange', onHashChangeEvent);
function onHashChangeEvent() {
  if (!openState(location.hash.slice(1))) {
    // 如果没有成功执行改为执行命令
    const [t, p] = location.hash.slice(1).split(':', 2);
    executeCommand(t, p);
  }
}

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

  // ISO-8601 周数
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);

  DOM.counting.innerHTML = `；今天是${now.getFullYear()}年的第${weekNum}周，迄今为止我们已运营${days}天${hours}小时${minutes}分钟${seconds}秒（${window.timezone.offsetStrMin}）`;
}


// ============================================================
// 事件绑定
// ============================================================

// 声明式绑定功能
document.querySelectorAll('*[data-cmd]').forEach((ele) => {
  const [t, p] = new String(ele.dataset.cmd).split(':', 2);
  ele.addEventListener('click', (event) => { executeCommand(t, p); });
  delete ele.dataset.cmd;
});

// 禁止 Safari 双指缩放
document.addEventListener("gesturestart", (e) => e.preventDefault());

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

// 赞助倒计时循环（每秒执行一次）
let donateUnlockingInterval = setInterval(() => {
  const cb = DOM.donate.checkbox;

  // 倒计时中：锁定 checkbox，折叠面板关闭，显示剩余秒数
  if (donateLockCounter > 0) {
    cb.disabled = true;
    DOM.donate.fold.folded = true;
    cb.checked = false;
    cb.innerHTML = DONATE_CHECKBOX_HTML + `（${donateLockCounter}秒）`;
    donateLockCounter -= 1;

    // 归零时永久解锁
    if (donateLockCounter <= 0) {
      donateLockCounter = -1;
      cb.disabled = false;
      cb.innerHTML = DONATE_CHECKBOX_HTML;
      DOM.donate.fold.folded = true;
      clearInterval(donateUnlockingInterval);
    }
    return;
  }

  // 空闲状态（未触发过首次倒计时），不做任何事
}, 1000);

DOM.donate.checkbox.addEventListener("click", () => {
  if (DOM.donate.checkbox.disabled) {
    DOM.donate.checkbox.checked = false;
    return;
  }
  DOM.donate.fold.folded = !DOM.donate.checkbox.checked;
});

// ============================================================
// Toolbar 插槽管理器
// ============================================================

/** 缓存所有 toolbar2 插槽 { slotName: HTMLElement } */
const toolbarSlots = {};

/** 缓存插槽引用 */
function cacheToolbarSlots() {
  document.querySelectorAll('[data-toolbar-slot]').forEach((el) => {
    toolbarSlots[el.dataset.toolbarSlot] = el;
  });
}

/** Toolbar 展开状态 */
let toolbarExpanded = false;

/** 关闭Toolbar（带出场动画） */
function shrinkToolbar() {
  DOM.toolbar.root.classList.remove('expanded');
  toolbarExpanded = false;
  // 给所有激活的插槽添加 leaving 类播放出场动画
  Object.values(toolbarSlots).forEach((s) => {
    if (s.classList.contains('active')) {
      // 此处不移除 active 标记，后续打开时自动移除，这是为了保证收起动画流畅
      // 简单来说由于 active 没了，元素不占空间了， toolbar2 的高度会突变导致动画卡顿
      s.classList.add('leaving');
      // 动画结束后清理 leaving
      s.addEventListener('animationend', function onLeave() {
        s.classList.remove('leaving');
        s.removeEventListener('animationend', onLeave);
      }, { once: true });
    }
  });
}

/**
 * 展开Toolbar并激活指定插槽
 * @param {string} [slotName] - 插槽名称，不传则 toolbar2 内容为空
 */
function expandToolbar(slotName) {
  toolbarExpanded = true;
  // 隐藏所有插槽，仅激活指定插槽
  Object.values(toolbarSlots).forEach((s) => s.classList.remove('active'));
  if (slotName && toolbarSlots[slotName]) {
    toolbarSlots[slotName].classList.add('active');
    if (toolbarSlots[slotName].dataset.noscroll) {
      DOM.toolbar.actions.root.style.overflow = 'hidden';
    } else {
      DOM.toolbar.actions.root.style.overflow = 'auto';
    }
  }
  DOM.toolbar.root.classList.add('expanded');
}

/** 切换Toolbar（兼容旧调用） */
function switchToolbar(slotName) {
  if (toolbarExpanded) {
    shrinkToolbar();
  } else {
    expandToolbar(slotName);
  }
}

// 区域外事件关闭 Toolbar
DOM.toolbar.closeArea.addEventListener('click', shrinkToolbar);
DOM.toolbar.closeArea.addEventListener('mousemove', shrinkToolbar);
DOM.toolbar.closeArea.addEventListener('touchstart', shrinkToolbar);


// 搜索模块初始化由 init() 中调用

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

  // 缓存 toolbar2 插槽
  cacheToolbarSlots();

  // 初始化搜索模块
  initSearch();

  // 初始化视频背景
  initVideoBg();

  // 初始化循环卡片
  initLoopCards();

  // 兼容Hash路由
  onHashChangeEvent();

  // 处理img与video
  document.querySelectorAll('img').forEach((i) => {
    i.draggable = false;
    i.addEventListener('contextmenu', (e) => e.preventDefault());
    i.addEventListener('dragstart', (e) => e.preventDefault());
  });
  document.querySelectorAll('video').forEach((i) => {
    i.draggable = false;
    i.addEventListener('contextmenu', (e) => e.preventDefault());
    i.addEventListener('dragstart', (e) => e.preventDefault());
  });
}

/** ============================================================
 *  loop-cards —— 水平卡片循环滚动
 *  容器宽度足够容纳所有卡片 → 静态展示
 *  容器宽度不足 → rAF 驱动向左缓慢循环滚动
 *  data-speed 属性控制每帧偏移量（px）
 *  ============================================================ */
function initLoopCards() {
  document.querySelectorAll('.loop-cards').forEach((container) => {
    const speed = 1.2 * (parseFloat(container.dataset.speed) || 1.0);

    // 首次初始化时缓存原始卡片引用（含事件监听）
    if (!container._loopCards) {
      container._loopCards = [...container.children];
    }
    const cards = container._loopCards;
    if (cards.length === 0) return;

    // 清空容器但保留原始卡片 DOM 引用
    container.innerHTML = '';
    const track = document.createElement('div');
    track.className = 'loop-cards-track';
    container.appendChild(track);

    // 将原始卡片移入轨道（保持事件监听完好）
    cards.forEach((c) => track.appendChild(c));

    // 等待布局就绪后判断是否需要滚动
    requestAnimationFrame(() => {
      const containerW = container.getBoundingClientRect().width;
      let trackW = track.scrollWidth;

      // 卡片总宽度 ≤ 容器宽度 → 静态居中展示
      if (trackW <= containerW + 1) {
        track.style.justifyContent = 'center';
        track.style.padding = '0';
        return;
      }

      // 需要滚动：克隆全部卡片实现无缝循环
      cards.forEach((c) => {
        const clone = c.cloneNode(true);
        track.appendChild(clone);
      });

      // 事件委托：点击任何卡片（包括克隆副本）都转发到原始卡片触发
      track.addEventListener('click', (e) => {
        const card = e.target.closest('.loop-cards-track > *');
        if (!card) return;
        const idx = [...track.children].indexOf(card);
        if (idx < 0) return;
        const origIdx = idx % cards.length;
        cards[origIdx].click();
      });

      // 重新测量（克隆后宽度翻倍）
      trackW = track.scrollWidth / 2;

      let offset = 0;
      let running = true;

      function scrollLoop() {
        if (window?.streack?.flag?.noAnimation) {
          // 停止动画时不进行动画计算，只保持动画循环进行
          requestAnimationFrame(scrollLoop);
          return;
        };
        if (!running) return;
        offset -= speed;

        // 已滚过一整组卡片宽度 → 无缝复位
        if (Math.abs(offset) >= trackW) {
          offset += trackW;
        }

        track.style.transform = `translateX(${offset}px)`;
        requestAnimationFrame(scrollLoop);
      }

      // 页面不可见时暂停以节省性能
      const visibilityHandler = () => {
        running = !document.hidden;
        if (running) requestAnimationFrame(scrollLoop);
      };
      // 移除旧监听避免重复
      if (container._loopVisHandler) {
        document.removeEventListener('visibilitychange', container._loopVisHandler);
      }
      container._loopVisHandler = visibilityHandler;
      document.addEventListener('visibilitychange', visibilityHandler);

      requestAnimationFrame(scrollLoop);
    });
  });
}

// resize 时重新计算卡片布局（防抖）
let _loopResizeTimer = null;
window.addEventListener('resize', () => {
  if (_loopResizeTimer) clearTimeout(_loopResizeTimer);
  _loopResizeTimer = setTimeout(() => {
    _loopResizeTimer = null;
    initLoopCards();
  }, 300);
});

/** ============================================================
 *  slotBg-V —— 视频循环背景
 *  ============================================================ */
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
            console.warn('[slotBg-V] 自动播放被拦截，需要用户手势');
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
// 导出（ES Module 接口）
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
  toolbarSlots,
  toolbarExpanded,
  expandToolbar,
  shrinkToolbar,
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
  switchToolbar: switchToolbar,
  expandToolbar: expandToolbar,
  shrinkToolbar: shrinkToolbar,
  stopAnimation: (status = true) => { if (!window.streack.flag) window.streack.flag = {}; window.streack.flag.noAnimation = !!status; },
};