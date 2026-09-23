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
export function flushInitCallbacks() {
  _initDone = true;
  let cb;
  while ((cb = _initCallbacks.shift())) {
    try { cb(); } catch (e) { console.error('[framework] 初始化回调出错:', e); }
  }
}
