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
