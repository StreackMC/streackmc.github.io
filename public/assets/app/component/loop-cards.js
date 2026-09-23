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
