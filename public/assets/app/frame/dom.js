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
