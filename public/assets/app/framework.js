/**
 * Streack Framework JS — 通用框架脚本
 * 提供所有基于此框架的页面共享的：工具函数、存储API、Toolbar管理器、命令系统、循环卡片、视频背景等
 */

import { toolbarPresets, registerToolbarPreset, getToolbarPreset } from './toolbar-presets.js';

/**
 * 定义不隔离的同源域名列表，支持子域名，列表之外的域名进行访问时会尝试尽可能地隔离数据。
 * 
 * 若定义端口，则端口需要严格显式相等
 */
export const SAME_REIGON = [
  'streack.top',
  'kdxiaoyi.top',
  'kdx233.eu.org',
]

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
 * @apiNote 兼容嵌套
 * @param {string} uri - 目标 URI
 * @param {boolean} stayInSameWindow - 是否在当前窗口打开（默认 false，新窗口）
 */
export function openURL(uri, stayInSameWindow = false) {
  try {
    if (window.parent !== window.top) {
      // 页面在嵌套
      if (typeof window.top?.streack?.openURL === 'function') {
        // 找到父页面的 openURL 方法了
        window.top.streack.openURL(uri, stayInSameWindow);
        return;
      } else {
        // 找不到
        console.warn(`[streack-app/func.openUrl] 父页面的 openURL 方法无效：`, window.top?.streack?.openURL);
        window.top.location.href = uri;
        return;
      }
    }
  } catch (error) {
    console.error(`[streack-app/func.openUrl] 发现跨域，无法访问父页面属性。`);
  }
  const a = document.createElement("a");
  a.target = stayInSameWindow ? "_self" : "_blank";
  a.href = uri;
  a.click();// 编程式触发导航
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

/**
 * 默认要加载的片段
 * Astro 迁移后：工具栏和页脚由 Astro 组件服务端渲染，无需运行时 fetch
 */
const DEFAULT_FRAGMENTS = {};

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
// 可扩展命令系统
// ============================================================

/** 自定义命令处理器注册表 */
const _cmdHandlers = {};

/**
 * 注册自定义命令处理器
 * 注册后可通过 executeCommand(type, param) 调用
 * @param {string} type - 命令类型名（不区分大小写）
 * @param {(param: string) => boolean} handler - 处理函数，返回是否成功
 */
export function registerCommand(type, handler) {
  _cmdHandlers[type.toLowerCase()] = handler;
}

/**
 * 执行命令
 * 内置类型：
 *   - url：     打开链接，参数格式 "uri|stayInSameWindow"
 *   - popurl    在小窗里面打开链接，不支持自动回退
 *   - state：   [已弃用] 旧状态系统，现跳转到 /{param} 独立页面
 *   - note：    滚动到指定脚注注释
 *   - slot：    滚动到指定锚点元素
 *   - copy/cp   复制指定文本
 * 自定义类型通过 registerCommand 注册（参见 popups.js）
 * @param {string} type 命令类型
 * @param {string} param 命令参数
 * @returns {boolean} 是否成功执行
 */
export function executeCommand(type, param) {
  if (!(type)) return false;
  param = param ? param : "";

  const t = type.toLowerCase();

  // 优先查找自定义处理器
  const handler = _cmdHandlers[t];
  if (handler) return handler(param);

  switch (t) {
    case 'popurl':
    case 'purl':
      try {
        const uri = new URL(param);
        let isolated = true;
        for (let i = 0; i < SAME_REIGON.length; i++) {
          const acceptableDomain = SAME_REIGON[i];
          if (uri.host.includes(acceptableDomain)) {
            isolated = false;
            break;
          }
        }
        window.open(param, '_blank', {
          'popup': true,
          noopener: isolated,
        });
        break;
      } catch (popurlErr) {
        // 不支持或发生意外自动fall through到普通URL处理
        // 此处仅记录即可
        console.warn('[streack-app.cmd/popurl] POPURL 命令发生回退：无法处理 POPURL 命令 ', [t, param], ' ，因为：', popurlErr);
      }

    case 'url':
      // 格式："url|stayInSameWindow" 或 "url"
      // 并且只匹配最后一个 | ，支持语法糖，存在即为 true
      const lastSplash = param.lastIndexOf('|');
      if (lastSplash >= 0 && lastSplash < param.length) {
        openURL(param.slice(0, lastSplash), true);
      } else {
        openURL(param, false);
      }
      break;

    case 'state':
      // [已弃用] 旧 state 系统，保留兼容跳转到独立页面
      window.open(`/${encodeURIComponent(param)}`, '_self');
      break;

    case 'note':
      // 滚动到第 N 条脚注
      param = parseInt(param);
      const notesRoot = document.getElementById('notes');
      const notesComments = notesRoot ? notesRoot.querySelectorAll('li') : null;
      if (!notesRoot || !notesComments) {
        console.error('[streack-app.cmd/note] 页面不存在注释区域');
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
        console.warn('[streack-app.cmd/note] 无法滚动目标注释', param, '至视口：', error);
        msg('无法查找目标注释：' + error.message, '好', true);
      }
      break;

    case 'copy':
    case 'cp':
      return CopyText(param);

    case 'msg':
      const params = param.split(/(?<!\\)\|/);
      return msg(...params);

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
        console.warn('[streack-app.cmd/slot] 无法滚动目标元素', param, '至视口：', error);
        msg('无法查找目标锚点：' + error.message, '好', true);
      }
      break;

    default:
      return false;
  }
  return true;
}

/**
 * 对目标元素及其全部子元素绑定命令
 * 扫描 data-cmd 属性（格式 "type:param"），转换为点击事件，消费后移除属性。
 * 用于动态插入 DOM 后重新绑定命令（如 selector 结果区、弹窗内容等）。
 * @param {Element} element - 目标元素（含自身及子元素）
 */
export function bindCommandOn(element) {
  if (!element || !element.querySelectorAll) return;

  const targets = element.hasAttribute && element.hasAttribute('data-cmd')
    ? [element, ...element.querySelectorAll('*[data-cmd]')]
    : [...element.querySelectorAll('*[data-cmd]')];

  targets.forEach((ele) => {
    const p = new String(ele.dataset.cmd).split(':');
    ele.addEventListener('click', (event) => { executeCommand(p[0], p.slice(1).join(':')); });
    delete ele.dataset.cmd;
  });
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
  // 在动画开始前隐藏滚动条并清空事件
  DOM.toolbar.root.removeEventListener('mouseleave', shrinkToolbar);
  document.removeEventListener('click', onOutsideClick);
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
  DOM.toolbar.root.addEventListener('mouseleave', shrinkToolbar);
  toolbar2._expandTimer = setTimeout(() => {
    if (!toolbarExpanded) return;  // 动画期间已被收起，不处理
    // 注册事件并设置样式
    document.addEventListener('click', onOutsideClick);
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


// ============================================================
// Toolbar 品牌 loc + 可变插槽设置 toolbar-set
// ============================================================
//
// 品牌后缀 loc：
//   <template data-toolbar-nav loc="文档"> → 品牌渲染为「栈流Streack·文档」
//   当 #toolbar1 一行放不下时，隐藏英文名 Streack，退化为「栈流·文档」
//
// 可变通用插槽设置 toolbar-set：
//   <template data-toolbar-nav toolbar-set="预设名" replaceset='{"k":"v"}'>
//   · 按名在预设表（assets/app/toolbar-presets.js）中查找 ToolbarTemplateLike
//   · 继承其全部设置：loc（品牌后缀）与 nav（导航项按钮）
//   · 元素自身的 loc 属性 / template 内部内容优先于预设
//   · replaceset 是 Maplike（占位符名 → 值）；预设值里的 %xxx% 用它替换，
//     未提供对应值的占位符原样保留

/** 解析 replaceset 属性（JSON 对象字符串）→ Map；失败则告警并返回空 Map */
export function parseReplaceset(raw) {
  const map = new Map();
  if (!raw) return map;
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    console.warn('[toolbar-set] replaceset 不是合法 JSON，已忽略：', raw, e);
    return map;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    console.warn('[toolbar-set] replaceset 需为 JSON 对象，已忽略：', raw);
    return map;
  }
  for (const [k, v] of Object.entries(obj)) map.set(k, v);
  return map;
}

/**
 * 用 replaceset 填充 %xxx% 占位符
 * @param {string} text
 * @param {Map<string, any>} [replaceset]
 * @returns {string} 未提供值的占位符原样保留
 */
export function fillPlaceholders(text, replaceset) {
  if (typeof text !== 'string' || !text) return text || '';
  const get = (key) => {
    if (!replaceset) return undefined;
    return typeof replaceset.get === 'function' ? replaceset.get(key) : replaceset[key];
  };
  return text.replace(/%([A-Za-z0-9_-]+)%/g, (whole, key) => {
    const v = get(key);
    return v === undefined || v === null ? whole : String(v);
  });
}

/**
 * 设置品牌后缀（渲染为「栈流Streack·文档」）
 * 框架会自动补「·」；若文本已以「·」开头则不重复添加
 * @param {string} [text] 传空则清除后缀
 */
export function setToolbarLoc(text) {
  const el = document.getElementById('toolbar-brand-loc');
  if (!el) return;
  const t = String(text ?? '');
  // 若使用者自带前导分隔符（·/・/| 等），不再重复添加
  el.textContent = !t.trim() ? '' : /^[·・|｜/]/.test(t.trim()) ? t.trimEnd() : ' · ' + t;
  // 用 rAF 调度而非同步调用：此时 s-tooltip（搜索/汉堡按钮）可能尚未完成内部渲染，
  // 同步测量其 getBoundingClientRect().width 会得 0，导致可用宽度被高估、降级判断不足
  scheduleToolbarBrandFit();
}

/**
 * 设置 loc 后缀的点击跳转地址（loc-index 设置）
 * 点击 loc 文字时跳转到该地址，取代「点击品牌默认跳首页」；
 * 未设置（传空）时，点击 loc 会冒泡到品牌，恢复默认跳首页
 * @param {string} [url] 传空则清除
 */
export function setToolbarLocIndex(url) {
  const el = document.getElementById('toolbar-brand-loc');
  if (!el) return;
  const u = String(url ?? '').trim();
  // 清除旧的点击处理
  if (el._locIndexClick) {
    el.removeEventListener('click', el._locIndexClick);
    el._locIndexClick = null;
    el.removeAttribute('data-loc-index');
  }
  if (!u) return;
  el.setAttribute('data-loc-index', u);
  el._locIndexClick = (e) => {
    e.stopPropagation(); // 阻止冒泡到品牌（否则会跳首页）
    e.preventDefault();
    openURL(u, true);
  };
  el.addEventListener('click', el._locIndexClick);
}

/** 节流：多处（resize / 字体加载 / 导航注入）都会触发品牌适配。
    rAF 节流：合并到下一渲染帧执行，连续 resize 时只算一次，避免 setTimeout 写死的延迟与多余计算 */
let _brandFitRaf = null;
function scheduleToolbarBrandFit() {
  if (_brandFitRaf) return;
  _brandFitRaf = requestAnimationFrame(() => {
    _brandFitRaf = null;
    fitToolbarBrand();
  });
}

/**
 * 按可用宽度适配品牌（三级降级）：
 *   ① 全显示「栈流Streack·loc」
 *   ② 放不下 → 隐藏英文名 Streack（「栈流·loc」）
 *   ③ 还放不下 → 隐藏整个品牌（只留按钮，保证按钮可点）
 *
 * 宽度判定用「全角字符估算」而非实测：品牌文本每个字符都按 1em（font-size）计，
 * 半角英文同样按全角算 → 结果偏保守、天然留出设计冗余，避免半角实测偏窄导致的误判
 * （如 268~299px 时英文本应隐藏，却因实测「放得下」而未隐藏）。
 *
 * 每次测量前都复原 display，因此反复调用结果稳定、不会来回抖动。
 */
export function fitToolbarBrand() {
  const brand = document.getElementById('toolbar-brand');
  const en = document.getElementById('toolbar-brand-en');
  const loc = document.getElementById('toolbar-brand-loc');
  const row = document.getElementById('toolbar1');
  if (!brand || !en || !loc || !row) return;

  // 先复原再估算，否则量到的是已隐藏后的宽度
  en.style.display = '';
  brand.style.display = '';

  // 没有 loc 时不介入（保持默认「栈流Streack」完整显示）
  if (!loc.textContent.trim()) return;

  // 可用宽度 = row 内容宽 - 非品牌子元素宽 - 间隔
  const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
  const kids = Array.from(row.children);
  const othersWidth = kids
    .filter((c) => c !== brand)
    .reduce((s, c) => s + c.getBoundingClientRect().width, 0)
    + gap * Math.max(0, kids.length - 1);
  const avail = row.clientWidth - othersWidth;

  // 全角估算：每个「字」（去除空白）按 1em 计（半角英文也按全角 → 留冗余）
  const fontSize = parseFloat(getComputedStyle(row).fontSize) || 18;
  const charWidth = (text) => Array.from(String(text || '').replace(/\s+/g, '')).length * fontSize;
  const cnText = (brand.firstElementChild && brand.firstElementChild.textContent) || '';
  const enText = en.textContent || '';
  const locText = loc.textContent; // 已含前导「·」与空格

  const fullWidth = charWidth(cnText + enText + locText);
  const noEnWidth = charWidth(cnText + locText);

  if (fullWidth > avail) {
    if (noEnWidth <= avail) {
      en.style.display = 'none'; // ② 隐藏英文
    } else {
      brand.style.display = 'none'; // ③ 隐藏整个品牌
    }
  }
}

/**
 * 把导航 HTML 字符串解析为顶层元素节点数组（忽略空白文本节点）
 * @param {string} html
 * @returns {HTMLElement[]}
 */
function parseNavNodes(html) {
  if (!html || !String(html).trim()) return [];
  const t = document.createElement('template');
  t.innerHTML = String(html);
  return Array.from(t.content.children);
}

/**
 * 合并 preset 与 template 的导航按钮（template 优先）：
 *   · template 按钮带 id 且命中 preset 同 id → 覆写（保持 preset 原位置）
 *   · 否则（无 id 或 id 未命中）→ 追加到末尾
 * 返回新数组；不修改传入的 presetNodes / ownNodes
 * @param {HTMLElement[]} presetNodes
 * @param {HTMLElement[]} ownNodes
 * @returns {HTMLElement[]}
 */
export function mergeNavNodes(presetNodes, ownNodes) {
  const result = (presetNodes || []).slice();
  for (const node of ownNodes || []) {
    const id = node && node.getAttribute && node.getAttribute('id');
    if (id) {
      const idx = result.findIndex(
        (n) => n && n.getAttribute && n.getAttribute('id') === id
      );
      if (idx !== -1) {
        result[idx] = node; // 同 id 覆写，保持位置
        continue;
      }
    }
    result.push(node); // 无 id 或 id 未命中 → 追加合并
  }
  return result;
}

/**
 * 处理页面里的 <template data-toolbar-nav>：解析 toolbar-set / loc / replaceset，
 * 合并 preset 与 template 的导航后注入 #toolbar-nav-slot
 * @returns {boolean} 是否设置了品牌 loc
 */
export function applyToolbarNavTemplates() {
  const navSlot = document.getElementById('toolbar-nav-slot');
  let locApplied = false;

  document.querySelectorAll('template[data-toolbar-nav]').forEach((tmpl) => {
    // ① 取出三项设置（toolbar-set 亦可用更符合 HTML 习惯的 data-toolbar-set）
    const setName = tmpl.getAttribute('toolbar-set') || tmpl.dataset.toolbarSet || '';
    const replaceset = parseReplaceset(tmpl.getAttribute('replaceset'));
    const preset = setName ? getToolbarPreset(setName) : undefined;
    if (setName && !preset) {
      console.warn(`[toolbar-set] 未找到名为「${setName}」的预设，已忽略（可用预设：`
        + `${Array.from(toolbarPresets.keys()).join(', ') || '（空）'}）`);
    }

    // ② loc：元素自身属性优先，否则继承预设；两者都会做占位符替换
    const ownLoc = tmpl.getAttribute('loc');
    const locText = ownLoc != null
      ? fillPlaceholders(ownLoc, replaceset)
      : fillPlaceholders(preset?.loc, replaceset);
    if (locText) {
      setToolbarLoc(locText);
      locApplied = true;
    }

    // ②b loc-index：点击 loc 文字的跳转地址（元素自身优先，否则继承预设；同样做占位符替换）
    const ownLocIndex = tmpl.getAttribute('loc-index');
    const locIndex = ownLocIndex != null
      ? fillPlaceholders(ownLocIndex, replaceset)
      : fillPlaceholders(preset?.locIndex, replaceset);
    setToolbarLocIndex(locIndex || '');

    // ③ nav：preset 与 template 的按钮**合并**（template 优先）
    //   · template 按钮带 id 且命中 preset 同 id → 覆写（保持 preset 原位置）
    //   · 否则追加（合并）；两者都做占位符替换
    const presetNodes = parseNavNodes(fillPlaceholders(preset?.nav, replaceset));
    const ownNodes = parseNavNodes(fillPlaceholders((tmpl.innerHTML || '').trim(), replaceset));
    const merged = mergeNavNodes(presetNodes, ownNodes);
    if (navSlot) merged.forEach((n) => navSlot.appendChild(n));

    tmpl.remove();
  });

  return locApplied;
}


// ============================================================
// 共享初始化（框架基础行为）
// ============================================================

/**
 * 初始化框架基础行为（入口函数）
 * 执行顺序：
 *   1. 等待 DOM 解析 → 2. 加载 HTML 片段 → 3. 缓存 DOM → 4. 初始化插槽
 *   5. 模板注入（data-toolbar-nav / data-inject）→ 6. 移除非脚本提示 →
 *   7. 绑定声明式命令 → 8. 禁用缩放 → 9. 绑定关闭区域 →
 *   10. 保护媒体资源 → 11. 锁定 body 滚动 → 12. 处理注释链接 → 13. 通知页面模块
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

  // 4. 处理页面模板注入
  // 4a. <template data-toolbar-nav> → 解析 toolbar-set / loc / replaceset 后注入 #toolbar-nav-slot
  const locApplied = applyToolbarNavTemplates();
  // 品牌适配：仅当本页配置了 loc 时介入（窄屏时隐藏英文名 Streack）
  // 字体异步加载、窗口尺寸变化都会改变可用宽度，故都重新适配一次
  if (locApplied) {
    try {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(scheduleToolbarBrandFit);
      }
    } catch (e) { /* 忽略：字体 API 不可用 */ }
    const row = document.getElementById('toolbar1');
    if (row && typeof ResizeObserver === 'function' && !row._brandFitObserved) {
      row._brandFitObserved = true;
      new ResizeObserver(scheduleToolbarBrandFit).observe(row);
    }
    scheduleToolbarBrandFit();
  }
  // 4a-2. 若导航插槽无内容，隐藏移动端折叠菜单按钮（无项可展开）
  {
    const navSlot = document.getElementById('toolbar-nav-slot');
    const menuBtn = document.getElementById('toolbar1-menu');
    if (menuBtn && navSlot && navSlot.children.length === 0) {
      menuBtn.style.display = 'none';
    }
  }
  // 4b. <template data-inject="targetId"> → 注入到 #targetId
  document.querySelectorAll('template[data-inject]').forEach((tmpl) => {
    const target = document.getElementById(tmpl.dataset.inject);
    if (target) {
      target.innerHTML = tmpl.innerHTML;
      tmpl.remove();
    }
  });

  // 5. 移除一些元素
  if (DOM.noScript) DOM.noScript.remove();
  let url = null;
  try {
    url = new URL(window.location.href);
    if (url.searchParams.get('embed')) {
      // 使用嵌入式模式，移除 toolbar 和 footer 的绘制
      document.getElementById('toolbar-area').style.display = 'none';
      document.querySelector('div.content[slot="footer"]').style.display = 'none';
      // 顺带将 safezone 设置为0
      const style = document.createElement('style');
      style.innerText = `.contents .content * {--safezone:0.01px;}`;
      style.dataset.note = `Inserted by [streack-app/embedding]`;
      document.head.appendChild(style);
    }
  } catch (error) {
    console.error('[streack-app/embedding] 无法查询 URL 参数：', error);
  }

  // 6. 声明式命令绑定：将 data-cmd 属性转换为点击事件
  bindCommandOn(document.body);

  // 7. 禁止 Safari 双指缩放/缩放手势
  document.addEventListener("gesturestart", (e) => e.preventDefault());

  // 9. 保护图片与视频：禁止拖拽、禁止右键菜单
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

  // 10. 锁定 body 滚动（页面滚动统一由容器管理）
  document.body.addEventListener('scroll', () => { document.body.scrollTop = 0; document.body.scrollLeft = 0; });

  // 11. 动态绑定正文注释的跳转链接（正文 ↔ 脚注双向关联）
  // 初始化完成后由 flushInitCallbacks 通知页面模块
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
      link2Footer.style.cssText = 'font-size: .6em; display: initial;';
      link2Footer.addEventListener('click', (e) => e.preventDefault());
      eleOfColumn.addEventListener('click', () => executeCommand('note', index));
      eleOfColumn.appendChild(link2Footer);

      // 脚注 → 正文返回链接（↩ 点击返回正文对应位置）
      const link2Column = document.createElement('a');
      link2Column.textContent = '↩';
      link2Column.style.cssText = 'font-size: .85em; display: initial;';
      link2Column.addEventListener('click', () => eleOfColumn.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      }));
      eleOfFooter.appendChild(link2Column);

      // 判断 pc-only / mobile-only
      const nearest = link2Footer.closest('[mobile-only],[pc-only]');
      if (nearest?.matches('*[mobile-only]')) {
        link2Footer.setAttribute('mobile-only', 'appended');
        link2Column.setAttribute('mobile-only', 'appended');
      } else if (nearest?.matches('*[pc-only]')) {
        link2Footer.setAttribute('pc-only', 'appended');
        link2Column.setAttribute('pc-only', 'appended');
      }
    });
  }

  // 12. 框架初始化完成，依次执行页面模块注册的初始化回调
  console.log(`[streack-app/main] Streack Web Framework Loaded!`);
  flushInitCallbacks();
  console.log(`[streack-app/plugins] Framework Plugins Loaded!`);

  // 13. 启动运营计时器（所有使用 FrameworkLayout 的页面均生效）
  initCounting();
}

// ============================================================
// 运营计时器（通用功能）
// ============================================================

/**
 * 刷新 Footer 中的运营计时器显示
 * 计算自建站日期（2024-12-25）至今的精确时长（天/时/分/秒）
 * @param {number} year  - 起始年
 * @param {number} month - 起始月 (1-12)
 * @param {number} day   - 起始日
 */
function refreshCountup(year, month, day) {
  const countingEl = document.getElementById("counting");
  if (!countingEl) return;

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

  countingEl.innerHTML = `今天是${now.getFullYear()}年的第${weekNum}周，迄今为止我们已运营${days}天${hours}小时${minutes}分钟${seconds}秒。`;
}

/** 从 window.streack.conf.info.time 读取配置并启动计时器 */
function initCounting() {
  try {
    // conf.info.time: [enabled, year, month, day, hour, minute, second]
    const tConf = window?.streack?.conf?.info?.time;
    if (!tConf || !tConf[0]) return;
    const y = tConf[1], m = tConf[2], d = tConf[3];
    refreshCountup(y, m, d);
    setInterval(() => refreshCountup(y, m, d), 1000);
  } catch (_) { /* 静默忽略 */ }
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
 * 页面切到后台（document.hidden）时暂停滚动，回到前台继续
 * 容器支持 data-speed 属性控制滚动速度倍率
 *
 * 两处与旧注释不符的现状（改动前请先确认是否需要保留）：
 *   · 鼠标悬停暂停**未实现** —— running 只由 visibilitychange 控制
 *   · 点击经事件委托映射回原始卡片，但 framework.css 的
 *     .loop-cards-track { pointer-events: none } 会被子元素继承，
 *     卡片收不到指针事件，故该委托实际不会触发
 * 需要可点击/悬停暂停时，先放开上述限制再实现。
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

// ============================================================
// 导出通用对象
// ============================================================
if (!Array.isArray(window?.streack?.meta?.initby)) {
  window.streack = {
    meta: { initby: ["streack-web-framework/main"] },
    openURL: openURL,
    msg: msg,
    executeCommand: executeCommand,
    cmd: executeCommand,
    registerCommand: registerCommand,
    bindCommandOn: bindCommandOn,
    registerToolbarSlot: registerToolbarSlot,
    shrinkToolbar: shrinkToolbar,
    expandToolbar: expandToolbar,
    switchToolbar: switchToolbar,
    setToolbarLoc: setToolbarLoc,
    setToolbarLocIndex: setToolbarLocIndex,
    toolbarPresets: toolbarPresets,
    registerToolbarPreset: registerToolbarPreset,
    CopyText: CopyText,
    copyText: CopyText,
    closeAllDialogs: closeAllDialogs,
    getCurrentTimeZone: getCurrentTimeZone,
    getQueryString: getQueryString,
  };
} else {
  window.streack.meta.initby.push("streack-web-framework");
  window.streack.openURL = openURL;
  window.streack.msg = msg;
  window.streack.executeCommand = executeCommand;
  window.streack.cmd = executeCommand;
  window.streack.registerCommand = registerCommand;
  window.streack.bindCommandOn = bindCommandOn;
  window.streack.registerToolbarSlot = registerToolbarSlot;
  window.streack.shrinkToolbar = shrinkToolbar;
  window.streack.expandToolbar = expandToolbar;
  window.streack.switchToolbar = switchToolbar;
  window.streack.setToolbarLoc = setToolbarLoc;
  window.streack.setToolbarLocIndex = setToolbarLocIndex;
  window.streack.toolbarPresets = toolbarPresets;
  window.streack.registerToolbarPreset = registerToolbarPreset;
  window.streack.CopyText = CopyText;
  window.streack.copyText = CopyText;
  window.streack.closeAllDialogs = closeAllDialogs;
  window.streack.getCurrentTimeZone = getCurrentTimeZone;
  window.streack.getQueryString = getQueryString;
};