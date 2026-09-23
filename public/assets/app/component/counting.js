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
export function initCounting() {
  try {
    // conf.info.time: [enabled, year, month, day, hour, minute, second]
    const tConf = window?.streack?.conf?.info?.time;
    if (!tConf || !tConf[0]) return;
    const y = tConf[1], m = tConf[2], d = tConf[3];
    refreshCountup(y, m, d);
    setInterval(() => refreshCountup(y, m, d), 1000);
  } catch (_) { /* 静默忽略 */ }
}
