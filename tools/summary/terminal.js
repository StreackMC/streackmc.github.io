/**
 * terminal.js — 终端输出辅助
 *
 * 提供：
 *   · `style`          —— 一组 ANSI 着色函数（非 TTY 或设置了 NO_COLOR 时自动降级为纯文本）
 *   · `createProgress` —— 原地刷新的进度打印器（非 TTY 时按步长抽稀输出，避免刷屏）
 */

/** 当前环境是否支持 ANSI 颜色 */
const COLOR = process.stdout.isTTY === true && !process.env.NO_COLOR;

/**
 * 用 ANSI SGR 序列包裹文本；在无颜色环境下原样返回。
 *
 * @param {string} code ANSI SGR 参数，如 `'1'`（加粗）、`'36'`（青色）
 * @param {string} text 待着色文本
 * @returns {string} 着色后的文本
 */
function paint(code, text) {
  return COLOR ? `\u001b[${code}m${text}\u001b[0m` : text;
}

/**
 * 常用样式集合。
 * @type {Record<'bold'|'dim'|'cyan'|'green'|'yellow'|'red', (text: string) => string>}
 */
export const style = {
  bold: (text) => paint('1', text),
  dim: (text) => paint('2', text),
  cyan: (text) => paint('36', text),
  green: (text) => paint('32', text),
  yellow: (text) => paint('33', text),
  red: (text) => paint('31', text),
};

/**
 * 创建一个进度打印器。
 *
 * · 支持 ANSI 时：使用 `\r` 原地刷新同一行；
 * · 不支持时：每 10 项（或结束时）输出一行，避免日志被刷爆。
 *
 * @param {string} label 进度前缀标签（如 `'[summary] 进度'`）
 * @returns {(done: number, total: number, extra?: string) => void} 进度更新函数
 */
export function createProgress(label) {
  let lastPrinted = 0;
  return (done, total, extra = '') => {
    const line = `${label}：${done}/${total}${extra ? ` ${extra}` : ''}`;
    if (COLOR) {
      process.stdout.write(`\r${style.dim(line)}\u001b[K`);
    } else if (done === total || done - lastPrinted >= 10) {
      lastPrinted = done;
      console.log(line);
    }
  };
}

/**
 * 结束一次原地刷新的进度输出（TTY 环境下换行）。
 */
export function endProgress() {
  if (COLOR) process.stdout.write('\n');
}
