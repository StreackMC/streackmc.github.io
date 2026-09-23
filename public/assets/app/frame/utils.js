import { DOM } from './dom.js';

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
