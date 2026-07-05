/**
 * Streack Framework JS — 通用框架脚本
 * 提供所有基于此框架的页面共享的：工具函数、存储API、Toolbar管理器、命令系统、循环卡片、视频背景等
 */

// ============================================================
// DOM 元素引用（通用部分）
// ============================================================

/** @type {{ page: HTMLElement, main: HTMLElement, noScript: HTMLElement }} */
export const DOM = {
  page: document.getElementById("page"),
  main: document.getElementById("main"),
  noScript: document.getElementById("no_script"),
};

/**
 * 动态重新查询工具栏 DOM 元素（toolbar 由 includes 动态加载后调用）
 * 所有 toolbar 操作函数内部自动调用此方法，外部无需手动调用
 */
export function refreshToolbarDOM() {
  DOM.toolbar = {
    root: document.getElementById("toolbar-area"),
    closeArea: document.getElementById("toolbar-outline"),
    btns: {
      root: document.getElementById("toolbar1"),
      search: document.getElementById("toolbar1-search"),
    },
    actions: {
      root: document.getElementById("toolbar2"),
    },
  };
  return DOM.toolbar;
}
// 初始时 toolbar 尚不存在，赋空代理以避免访问报错
DOM.toolbar = null;


// ============================================================
// 工具函数
// ============================================================

/** 获取当前时区信息 */
export function getCurrentTimeZone() {
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
export function getQueryString(name) {
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
export function openURL(uri, stayInSameWindow = false) {
  const a = document.createElement("a");
  a.target = stayInSameWindow ? "_self" : "_blank";
  a.href = uri;
  a.click();
  return a;
}

/** 显示 Snackbar 消息 */
export function msg(message, confirmText, isWarning, duration, onClick, align, icon) {
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
export function CopyText(text) {
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
// 存储 API
// ============================================================

export const pmdStorage = {
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
// 动态片段加载
// ============================================================

const FRAGMENTS_BASE = './assets/app/includes/';

/** 默认要加载的片段 */
const DEFAULT_FRAGMENTS = {
  'toolbar-mount': FRAGMENTS_BASE + 'toolbar.html',
  'footer-mount': FRAGMENTS_BASE + 'footer.html',
};

/**
 * 加载 HTML 片段并注入到指定的挂载点
 * @param {string} mountId - 挂载点元素的 id
 * @param {string} url - 片段 URL
 */
export async function loadFragment(mountId, url) {
  const mount = document.getElementById(mountId);
  if (!mount) {
    console.warn(`[framework] 挂载点 #${mountId} 不存在，跳过`);
    return;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    if (url.includes('tool')) console.log(html);
    mount.insertAdjacentHTML('afterend', html);
    mount.remove(); // 移除挂载点自身
  } catch (err) {
    console.error(`[framework] 加载片段 ${url} 失败:`, err);
  }
}

// ============================================================
// 初始化回调队列
// ============================================================

/** @type {Array<() => void>} 等待框架初始化完成后执行的回调 */
const _initCallbacks = [];

/** 框架初始化是否已完成 */
let _initDone = false;

/**
 * 注册初始化回调：框架完全就绪（toolbar/footer 已注入、DOM 事件已绑定）后执行。
 * 若框架早已就绪，则立即执行。
 * @param {() => void} callback
 */
export function requestInitFunc(callback) {
  if (_initDone) {
    callback();
  } else {
    _initCallbacks.push(callback);
  }
}

/** 执行所有已注册的回调 */
function flushInitCallbacks() {
  _initDone = true;
  let cb;
  while ((cb = _initCallbacks.shift())) {
    try { cb(); } catch (e) { console.error('[framework] 初始化回调出错:', e); }
  }
}


// ============================================================
// 对话框 / 底栏管理
// ============================================================

/** 关闭所有弹窗 */
export function closeAllDialogs() {
  document.querySelectorAll("s-bottom-sheet, s-dialog").forEach((el) => {
    el.showed = false;
  });
  shrinkToolbar();
}


// ============================================================
// 命令系统
// ============================================================

/**
 * 执行命令
 * 状态类命令委托给 window.streack.openState（页面可覆写）
 * @param {'url'|'state'|'slot'|'note'} type 命令类型
 * @param {string} param 命令参数
 * @returns {boolean} 是否成功执行
 */
export function executeCommand(type, param) {
  if (!(type && param)) return false;
  switch (type.toLowerCase()) {
    case 'url':
      openURL(...param.split("|", 2));
      break;
    case 'state':
      if (window.streack && typeof window.streack.openState === 'function') {
        window.streack.openState(param);
      } else {
        console.warn('[cmd] 页面未定义 openState');
        return false;
      }
      break;
    case 'note':
      param = parseInt(param);
      const notesRoot = document.getElementById('notes');
      const notesComments = notesRoot ? notesRoot.querySelectorAll('li') : null;
      if (!notesRoot || !notesComments) {
        console.error('[cmd/note] 页面不存在注释区域');
        msg('页面中未定义注释区域', '好', true);
        break;
      }
      try {
        if (param <= 0 || param > notesComments.length) throw new ReferenceError(param + '超出可接受的范围');
        notesComments[param - 1].scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      } catch (error) {
        console.warn('[cmd/note] 无法滚动目标注释', param, '至视口：', error);
        msg('无法查找目标注释：' + error.message, '好', true);
      }
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
  }
  return true;
}

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

/** Toolbar 展开状态 */
export let toolbarExpanded = false;

/** 关闭Toolbar（带出场动画） */
export function shrinkToolbar() {
  if (!DOM.toolbar) return;
  DOM.toolbar.root.classList.remove('expanded');
  toolbarExpanded = false;
  Object.values(toolbarSlots).forEach((s) => {
    if (s.classList.contains('active')) {
      s.classList.add('leaving');
      s.addEventListener('animationend', function onLeave() {
        s.classList.remove('leaving');
        s.removeEventListener('animationend', onLeave);
      }, { once: true });
    }
  });
}

/**
 * 展开Toolbar并激活指定插槽
 * @param {string} [slotName] - 插槽名称
 */
export function expandToolbar(slotName) {
  if (!DOM.toolbar) return;
  toolbarExpanded = true;
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

/** 切换Toolbar */
export function switchToolbar(slotName) {
  if (toolbarExpanded) {
    shrinkToolbar();
  } else {
    expandToolbar(slotName);
  }
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
  div.style.overflow = 'hidden';
  div.innerHTML = html;
  toolbar2.appendChild(div);
  toolbarSlots[name] = div;
}

/** 初始化 toolbar2 插槽：移动端导航 + 页面自定义插槽 */
async function initToolbar2Slots() {
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
      // 从 pc-only 导航槽克隆导航项
      const sourceSlot = document.getElementById('toolbar-nav-slot');
      if (sourceSlot) {
        Array.from(sourceSlot.children).forEach((child) => {
          const clone = child.cloneNode(true);
          clone.removeAttribute('pc-only');
          clone.removeAttribute('mobile-only');
          navSlot.appendChild(clone);
        });
      }
      // 补充 template[data-toolbar-nav]
      document.querySelectorAll('template[data-toolbar-nav]').forEach((tmpl) => {
        const temp = document.createElement('div');
        temp.innerHTML = tmpl.innerHTML;
        Array.from(temp.children).forEach((child) => {
          const clone = child.cloneNode(true);
          clone.removeAttribute('pc-only');
          clone.removeAttribute('mobile-only');
          navSlot.appendChild(clone);
        });
      });

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


// ============================================================
// 共享初始化（框架基础行为）
// ============================================================

/** 初始化框架基础行为 */
export async function initFramework() {
  // 1. 等待 DOM 解析完成
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
  }

  // 2. 加载并注入 HTML 片段（toolbar / footer）
  const loads = Object.entries(DEFAULT_FRAGMENTS).map(
    ([id, url]) => loadFragment(id, url)
  );
  await Promise.all(loads);

  // 3. 重新查询工具栏 DOM 并缓存插槽
  refreshToolbarDOM();
  cacheToolbarSlots();

  // 初始化 toolbar2 插槽（移动端导航 + 页面自定义插槽）
  initToolbar2Slots();

  // 4. 移除非脚本提示
  if (DOM.noScript) DOM.noScript.remove();

  // 5. 声明式绑定功能
  document.querySelectorAll('*[data-cmd]').forEach((ele) => {
    const [t, p] = new String(ele.dataset.cmd).split(':', 2);
    ele.addEventListener('click', (event) => { executeCommand(t, p); });
    delete ele.dataset.cmd;
  });

  // 6. 禁止 Safari 双指缩放
  document.addEventListener("gesturestart", (e) => e.preventDefault());

  // 7. 区域外事件关闭 Toolbar
  if (DOM.toolbar && DOM.toolbar.closeArea) {
    DOM.toolbar.closeArea.addEventListener('click', shrinkToolbar);
    DOM.toolbar.closeArea.addEventListener('mousemove', shrinkToolbar);
    DOM.toolbar.closeArea.addEventListener('touchstart', shrinkToolbar);
  }

  // 8. 处理img与video
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

  // 9. body不允许Scroll
  document.body.addEventListener('scroll', () => { document.body.scrollTop = 0; document.body.scrollLeft = 0; });

  // 10. 动态插值正文的注释链接
  const notesRoot = document.getElementById('notes');
  if (notesRoot) {
    const notesComments = notesRoot.querySelectorAll('li');
    document.querySelectorAll('sup[data-note]').forEach((eleOfColumn) => {
      const bindToken = eleOfColumn.dataset.note;
      const eleOfFooter = notesRoot.querySelector(`li[data-note="${bindToken}"]`);
      if (!eleOfFooter) return;

      const index = [...notesComments].indexOf(eleOfFooter) + 1;
      if (index <= 0) return;

      // 正文 → 脚注链接
      const link2Footer = document.createElement('a');
      link2Footer.textContent = index;
      link2Footer.style.cssText = 'font-size: .6em;';
      link2Footer.addEventListener('click', (e) => e.preventDefault());
      eleOfColumn.addEventListener('click', () => executeCommand('note', index));
      eleOfColumn.appendChild(link2Footer);

      // 脚注 → 正文返回链接
      const link2Column = document.createElement('a');
      link2Column.textContent = '↩';
      link2Column.style.cssText = 'font-size: .85em;';
      link2Column.addEventListener('click', () => eleOfColumn.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      }));
      eleOfFooter.appendChild(link2Column);
    });
  }

  // 11. 框架初始化完成，调用页面注册的回调
  flushInitCallbacks();
}


// ============================================================
// 视频背景（通用组件）
// ============================================================

export function initVideoBg() {
  const videos = document.querySelectorAll('video.slotBg-V');
  videos.forEach((video) => {
    const token = `img.slotBg-V[data-ivpair="${video?.dataset?.ivpair}"]`;
    // 默认自动播放
    video.play().catch(() => {});
  });
}


// ============================================================
// 循环卡片（通用组件）
// ============================================================

export function initLoopCards() {
  document.querySelectorAll('.loop-cards').forEach((container) => {
    const speed = 1.2 * (parseFloat(container.dataset.speed) || 1.0);

    if (!container._loopCards) {
      container._loopCards = [...container.children];
    }
    const cards = container._loopCards;
    if (cards.length === 0) return;

    container.innerHTML = '';
    const track = document.createElement('div');
    track.className = 'loop-cards-track';
    container.appendChild(track);

    cards.forEach((c) => track.appendChild(c));

    requestAnimationFrame(() => {
      const containerW = container.getBoundingClientRect().width;
      let trackW = track.scrollWidth;

      if (trackW <= containerW + 1) {
        track.style.justifyContent = 'center';
        track.style.padding = '0';
        return;
      }

      cards.forEach((c) => {
        const clone = c.cloneNode(true);
        track.appendChild(clone);
      });

      track.addEventListener('click', (e) => {
        const card = e.target.closest('.loop-cards-track > *');
        if (!card) return;
        const idx = [...track.children].indexOf(card);
        if (idx < 0) return;
        const origIdx = idx % cards.length;
        cards[origIdx].click();
      });

      trackW = track.scrollWidth / 2;

      let offset = 0;
      let running = true;

      function scrollLoop() {
        if (window?.streack?.flag?.noAnimation) {
          requestAnimationFrame(scrollLoop);
          return;
        }
        if (!running) return;
        offset -= speed;

        if (Math.abs(offset) >= trackW) {
          offset += trackW;
        }

        track.style.transform = `translateX(${offset}px)`;
        requestAnimationFrame(scrollLoop);
      }

      const visibilityHandler = () => {
        running = !document.hidden;
        if (running) requestAnimationFrame(scrollLoop);
      };
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
