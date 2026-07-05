/**
 * Streack Framework JS — 通用框架脚本
 * 提供所有基于此框架的页面共享的：工具函数、存储API、Toolbar管理器、命令系统、循环卡片、视频背景等
 */

// ============================================================
// DOM 元素引用（通用部分）
// ============================================================

/**
 * 核心 DOM 元素引用
 * @type {{ page: HTMLElement, main: HTMLElement, noScript: HTMLElement }}
 */
export const DOM = {
  page: document.getElementById("page"),          // 页面根容器
  main: document.getElementById("main"),          // 主内容区
  noScript: document.getElementById("no_script"), // 无脚本提示
};

/**
 * 动态重新查询工具栏 DOM 元素（toolbar 由 includes 动态加载后调用）
 * 所有 toolbar 操作函数内部自动调用此方法，外部无需手动调用
 */
export function refreshToolbarDOM() {
  DOM.toolbar = {
    root: document.getElementById("toolbar-area"),
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

/** 获取当前时区信息（偏移量、UTC 字符串、IANA 名称） */
export function getCurrentTimeZone() {
  // 计算本地时区相对于 UTC 的分钟偏移
  const offset = new Date().getTimezoneOffset();
  const absH = String(Math.abs(offset) / 60).padStart(2, "0");
  const absM = String(Math.abs(offset) % 60).padStart(2, "0");
  const sign = offset <= 0 ? "+" : "-";
  return {
    offset,                                      // 分钟偏移值
    offsetStr: `UTC${sign}${absH}:${absM}`,      // 完整格式 e.g. "UTC+08:00"
    offsetStrMin: `UTC${sign}${Math.abs(offset) / 60}`, // 精简格式 e.g. "UTC+8"
    ianaName: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown", // IANA 时区名 e.g. "Asia/Shanghai"
  };
}

/** 获取 URL 查询参数值 */
export function getQueryString(name) {
  const m = window.location.search.substr(1).match(
    new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i")
  );
  return m ? unescape(m[2]) : null;
}

/**
 * 打开链接（通过创建 <a> 元素触发，不产生多余 history 条目）
 * @param {string} uri - 目标 URI
 * @param {boolean} stayInSameWindow - 是否在当前窗口打开（默认 false，新窗口）
 */
export function openURL(uri, stayInSameWindow = false) {
  const a = document.createElement("a");
  a.target = stayInSameWindow ? "_self" : "_blank";
  a.href = uri;
  a.click();   // 编程式触发导航
  return a;
}

/**
 * 显示 Snackbar 消息提示
 * @param {string} message - 消息文本
 * @param {string} [confirmText] - 确认按钮文字
 * @param {boolean} [isWarning] - 是否为警告样式
 * @param {number} [duration] - 显示时长（毫秒）
 * @param {Function} [onClick] - 点击回调
 * @param {number} [align] - 对齐方式（0=auto, 1=top, 2=bottom）
 * @param {string} [icon] - 图标名称
 */
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
  // 调用自定义 <s-snackbar> 组件的 builder 方法来渲染
  customElements.get("s-snackbar").builder(info);
  return info;
}

/** 将文本复制到系统剪贴板，并提示结果 */
export function CopyText(text) {
  if (!navigator.clipboard) {
    msg("未能复制文本，因为方法不支持", "好", true);
    return false;
  }
  navigator.clipboard.writeText(String(text)).then(
    () => msg("✓ 已复制文本", "好"),           // 成功提示
    () => msg("未能复制文本，因为拒绝访问剪贴板", "好", true) // 失败提示
  );
}


// ============================================================
// 存储 API
// ============================================================

/**
 * 统一存储 API — 封装 Cookie / localStorage / sessionStorage 的常用操作
 * 所有值在写入时自动 JSON 序列化，读取时自动 JSON 反序列化
 */
export const pmdStorage = {
  /** Cookie 存储操作 */
  Cookies: {
    /** 设置 Cookie */
    set(key, value, maxAge, path) {
      const encoded = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      if (maxAge) {
        // 有过期时间时设置 expires
        const d = new Date(Date.now() + maxAge * 1000);
        document.cookie = `${encoded}; expires=${d.toUTCString()}; path=${path || "/"}`;
      } else {
        document.cookie = `${encoded}; path=${path || "/"}`;
      }
    },
    /** 获取指定 Cookie 的值 */
    get(key) {
      for (const pair of document.cookie.split("; ")) {
        const [k, v] = pair.split("=", 2);
        if (decodeURIComponent(k) === key) return decodeURIComponent(v);
      }
      return null;
    },
    /** 删除指定 Cookie */
    remove(key) { this.set(key, "", -1); },  // 设置 maxAge=-1 使 Cookie 立即过期
    /** 获取所有 Cookie */
    getAll() {
      const r = {};
      for (const pair of document.cookie.split("; ")) {
        const [k, v] = pair.split("=", 2);
        r[decodeURIComponent(k)] = decodeURIComponent(v);
      }
      return r;
    },
    /** 清除所有 Cookie（危险操作） */
    reset_dangerous() { Object.keys(this.getAll()).forEach((k) => this.remove(k)); },
  },
  /** localStorage 存储操作 */
  Local: {
    /** 设置值（自动 JSON 序列化） */
    set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
    /** 获取值（自动 JSON 反序列化，失败时返回原始字符串） */
    get(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch { return localStorage.getItem(key); }
    },
    /** 删除指定键 */
    remove(key) { localStorage.removeItem(key); },
    /** 获取所有键值对 */
    getAll() {
      const r = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        r[k] = this.get(k);
      }
      return r;
    },
    /** 清空所有本地存储（危险操作） */
    reset_dangerous() { localStorage.clear(); },
  },
  /** sessionStorage 存储操作 */
  Session: {
    /** 设置值（自动 JSON 序列化） */
    set(key, value) { sessionStorage.setItem(key, JSON.stringify(value)); },
    /** 获取值（自动 JSON 反序列化，失败时返回原始字符串） */
    get(key) {
      try { return JSON.parse(sessionStorage.getItem(key)); } catch { return sessionStorage.getItem(key); }
    },
    /** 删除指定键 */
    remove(key) { sessionStorage.removeItem(key); },
    /** 获取所有键值对 */
    getAll() {
      const r = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        r[k] = this.get(k);
      }
      return r;
    },
    /** 清空所有会话存储（危险操作） */
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
 * - 向挂载点元素的后面插入片段 HTML
 * - 然后移除挂载点自身（避免残留空标签）
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
    if (url.includes('tool')) console.log(html);// 工具栏片段打印调试
    mount.insertAdjacentHTML('afterend', html);// 注入到挂载点之后
    mount.remove();// 移除挂载点自身
  } catch (err) {
    console.error(`[framework] 加载片段 ${url} 失败:`, err);
  }
}

// ============================================================
// 初始化回调队列
// ============================================================

/** @type {Array<() => void>} 等待框架初始化完成后执行的回调队列 */
const _initCallbacks = [];

/** 框架初始化是否已完成 */
let _initDone = false;

/**
 * 注册初始化回调：框架完全就绪（toolbar/footer 已注入、DOM 事件已绑定）后执行。
 * 若框架早已就绪，则同步立即执行。
 * 页面模块（如搜索）通过此函数注册自身初始化逻辑。
 * @param {() => void} callback
 */
export function requestInitFunc(callback) {
  if (_initDone) {
    callback();                              // 框架已就绪，立即执行
  } else {
    _initCallbacks.push(callback);           // 排队等待框架就绪
  }
}

/** 依次执行所有已注册的回调（框架就绪后由 initFramework 调用） */
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


// ============================================================
// 命令系统
// ============================================================

/**
 * 执行命令
 * 状态类命令委托给 window.streack.openState（页面可覆写）
 * 支持的命令类型：
 *   - url：   打开链接，参数格式 "uri|stayInSameWindow"
 *   - state： 切换页面状态（委托给页面自定义的 openState）
 *   - note：  滚动到指定脚注注释
 *   - slot：  滚动到指定锚点元素
 * @param {'url'|'state'|'slot'|'note'} type 命令类型
 * @param {string} param 命令参数
 * @returns {boolean} 是否成功执行
 */
export function executeCommand(type, param) {
  if (!(type && param)) return false;
  switch (type.toLowerCase()) {
    case 'url':
      // 格式："url|stayInSameWindow" 或 "url"
      openURL(...param.split("|", 2));
      break;

    case 'state':
      // 委托给页面自定义的状态切换函数
      if (window.streack && typeof window.streack.openState === 'function') {
        window.streack.openState(param);
      } else {
        console.warn('[cmd] 页面未定义 openState');
        return false;
      }
      break;

    case 'note':
      // 滚动到第 N 条脚注
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
      // 滚动到指定 slot 属性的元素
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

/** Toolbar 当前是否处于展开状态 */
export let toolbarExpanded = false;

/**
 * 收起 Toolbar（带出场动画）
 * - 移除 expanded 类触发 CSS 关带动画
 * - 已激活的插槽添加 leaving 类播放离场动画后自动移除
 */
export function shrinkToolbar() {
  if (!DOM.toolbar) return;
  // 取消展开延迟计时器，防止动画期间快速操作
  clearTimeout(DOM.toolbar.actions.root._expandTimer);
  // 在动画开始前隐藏滚动条
  DOM.toolbar.actions.root.style.overflow = '';
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
 * - 先取消所有插槽的激活状态
 * - 然后激活目标插槽，根据 noscroll 属性控制滚动
 * - 最后添加 expanded 类触发 CSS 展带动画
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

  // 等 grid 展开动画（600ms）结束后再显示滚动条，避免动画过程中出现
  const toolbar2 = DOM.toolbar.actions.root;
  clearTimeout(toolbar2._expandTimer);
  toolbar2._expandTimer = setTimeout(() => {
    if (!toolbarExpanded) return;  // 动画期间已被收起，不处理
    if (slotName && toolbarSlots[slotName]?.dataset.noscroll) {
      toolbar2.style.overflow = 'hidden';
    } else {
      toolbar2.style.overflow = 'auto';
    }
  }, 600);
}

/** 切换 Toolbar 的展开/收起状态 */
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
  // div.style.overflow = 'hidden';
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

/**
 * 初始化框架基础行为（入口函数）
 * 执行顺序：
 *   1. 等待 DOM 解析 → 2. 加载 HTML 片段 → 3. 缓存 DOM → 4. 初始化插槽
 *   5. 绑定声明式命令 → 6. 禁用缩放 → 7. 绑定关闭区域 →
 *   8. 保护媒体资源 → 9. 锁定 body 滚动 → 10. 处理注释链接 → 11. 通知页面模块
 */
export async function initFramework() {
  // 1. 等待 DOM 解析完成
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
  }

  // 2. 并加载入 HTML 片段（toolbar / footer）
  const loads = Object.entries(DEFAULT_FRAGMENTS).map(
    ([id, url]) => loadFragment(id, url)
  );
  await Promise.all(loads);

  // 3. 重新查询工具栏 DOM 并缓存插槽引用
  refreshToolbarDOM();
  cacheToolbarSlots();

  // 初始化 toolbar2 插槽（移动端导航菜单 + 页面自定义插槽）
  initToolbar2Slots();

  // 4. 移除非脚本提示（<noscript> 标签）
  if (DOM.noScript) DOM.noScript.remove();

  // 5. 声明式命令绑定：将 data-cmd 属性转换为点击事件
  document.querySelectorAll('*[data-cmd]').forEach((ele) => {
    const [t, p] = new String(ele.dataset.cmd).split(':', 2);
    ele.addEventListener('click', (event) => { executeCommand(t, p); });
    delete ele.dataset.cmd;  // 消费后移除属性，避免重复绑定
  });

  // 6. 禁止 Safari 双指缩放/缩放手势
  document.addEventListener("gesturestart", (e) => e.preventDefault());

  // 7. 鼠标移出 Toolbar 区域或点击外部时自动收起（替代旧版辅助元素方案）
  if (DOM.toolbar && DOM.toolbar.root) {
    // 鼠标离开整个 Toolbar 区域时收起
    DOM.toolbar.root.addEventListener('mouseleave', shrinkToolbar);
    // 点击/触摸 Toolbar 外部区域时收起
    document.addEventListener('click', function onOutsideClick(e) {
      if (!DOM.toolbar.root.contains(e.target)) {
        shrinkToolbar();
      }
      // TODO: 点击范围外不应触发事件；此处由于事件已经冒泡到 document 了所以无效
      e.stopImmediatePropagation();
      e.preventDefault();
    });
  }

  // 8. 保护图片与视频：禁止拖拽、禁止右键菜单
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

  // 9. 锁定 body 滚动（页面滚动统一由容器管理）
  document.body.addEventListener('scroll', () => { document.body.scrollTop = 0; document.body.scrollLeft = 0; });

  // 10. 动态绑定正文注释的跳转链接（正文 ↔ 脚注双向关联）
  const notesRoot = document.getElementById('notes');
  if (notesRoot) {
    const notesComments = notesRoot.querySelectorAll('li');
    document.querySelectorAll('sup[data-note]').forEach((eleOfColumn) => {
      const bindToken = eleOfColumn.dataset.note;
      const eleOfFooter = notesRoot.querySelector(`li[data-note="${bindToken}"]`);
      if (!eleOfFooter) return;

      const index = [...notesComments].indexOf(eleOfFooter) + 1;
      if (index <= 0) return;

      // 正文中的上标 → 脚注链接（点击滚动到对应脚注）
      const link2Footer = document.createElement('a');
      link2Footer.textContent = index;
      link2Footer.style.cssText = 'font-size: .6em;';
      link2Footer.addEventListener('click', (e) => e.preventDefault());
      eleOfColumn.addEventListener('click', () => executeCommand('note', index));
      eleOfColumn.appendChild(link2Footer);

      // 脚注 → 正文返回链接（↩ 点击返回正文对应位置）
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

  // 11. 框架初始化完成，依次执行页面模块注册的初始化回调
  flushInitCallbacks();
}


// ============================================================
// 视频背景（通用组件）
// ============================================================

/**
 * 初始化视频背景组件
 * 查找所有 class 为 slotBg-V 的 <video> 元素并尝试自动播放
 * 若浏览器阻止自动播放，静默忽略错误
 */
export function initVideoBg() {
  const videos = document.querySelectorAll('video.slotBg-V');
  videos.forEach((video) => {
    const token = `img.slotBg-V[data-ivpair="${video?.dataset?.ivpair}"]`; // 关联的图片选择器（预留）
    // 尝试自动播放，如果被浏览器策略阻止则需要点击
    video.play().catch(() => {
      const onVideoClick = () => {
        video.play().then(() => {
          video.removeEventListener('click', onVideoClick);
        });
      };
      video.addEventListener('click', onVideoClick);
    });
  });
}


// ============================================================
// 循环卡片（通用组件）
// ============================================================

/**
 * 初始化循环卡片组件
 * 将卡片列表放入滚动轨道中，复制一份以实现无缝循环滚动
 * 鼠标悬停停止滚动，点击触发原始卡片的点击事件
 * 容器支持 data-speed 属性控制滚动速度倍率
 */
export function initLoopCards() {
  document.querySelectorAll('.loop-cards').forEach((container) => {
    // 速度基准 1.2，可被 data-speed 属性覆盖
    const speed = 1.2 * (parseFloat(container.dataset.speed) || 1.0);

    // 缓存原始卡片列表（避免重复初始化时丢失引用）
    if (!container._loopCards) {
      container._loopCards = [...container.children];
    }
    const cards = container._loopCards;
    if (cards.length === 0) return;

    // 重建轨道 DOM 结构
    container.innerHTML = '';
    const track = document.createElement('div');
    track.className = 'loop-cards-track';
    container.appendChild(track);

    cards.forEach((c) => track.appendChild(c));

    // 等待一帧确保布局完成后再计算尺寸
    requestAnimationFrame(() => {
      const containerW = container.getBoundingClientRect().width;
      let trackW = track.scrollWidth;

      // 如果内容宽度不超过容器宽度，居中显示无需滚动
      if (trackW <= containerW + 1) {
        track.style.justifyContent = 'center';
        track.style.padding = '0';
        return;
      }

      // 复制一份卡片以制造无缝循环效果
      cards.forEach((c) => {
        const clone = c.cloneNode(true);
        track.appendChild(clone);
      });

      // 点击事件委托：将点击映射回原始卡片
      track.addEventListener('click', (e) => {
        const card = e.target.closest('.loop-cards-track > *');
        if (!card) return;
        const idx = [...track.children].indexOf(card);
        if (idx < 0) return;
        const origIdx = idx % cards.length;  // 通过取模映射到原始卡片
        cards[origIdx].click();
      });

      trackW = track.scrollWidth / 2;  // 半宽即为有效滚动距离

      let offset = 0;
      let running = true;

      // 核心动画循环：每帧向左移动 speed 像素
      function scrollLoop() {
        // 如果全局禁用了动画则跳过渲染
        if (window?.streack?.flag?.noAnimation) {
          requestAnimationFrame(scrollLoop);
          return;
        }
        if (!running) return;
        offset -= speed;

        // 到达副本边界时重置偏移，实现无缝回绕
        if (Math.abs(offset) >= trackW) {
          offset += trackW;
        }

        track.style.transform = `translateX(${offset}px)`;
        requestAnimationFrame(scrollLoop);
      }

      // 页面可见性变化时暂停/恢复动画（节省性能）
      const visibilityHandler = () => {
        running = !document.hidden;
        if (running) requestAnimationFrame(scrollLoop);
      };
      // 清理旧监听器避免重复注册
      if (container._loopVisHandler) {
        document.removeEventListener('visibilitychange', container._loopVisHandler);
      }
      container._loopVisHandler = visibilityHandler;
      document.addEventListener('visibilitychange', visibilityHandler);

      // 启动动画
      requestAnimationFrame(scrollLoop);
    });
  });
}

// 窗口 resize 时重新计算卡片布局（防抖 300ms）
let _loopResizeTimer = null;
window.addEventListener('resize', () => {
  if (_loopResizeTimer) clearTimeout(_loopResizeTimer);
  _loopResizeTimer = setTimeout(() => {
    _loopResizeTimer = null;
    initLoopCards();
  }, 300);
});
