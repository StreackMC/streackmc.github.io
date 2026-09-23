/**
 * loop-cards —— 卡片轮播 / 循环滚动组件
 *
 * 容器上的配置属性（全部可选，括号内为缺省）：
 *
 *   data-orientation   "horizontal" | "vertical" | "reverted-horizontal" | "reverted-vertical"
 *                      轮播方向（缺省 horizontal）；reverted-* 表示内容移动方向相反
 *
 *   data-type          "continuous" | "pausing"（缺省 continuous）
 *                      · continuous —— 连续无缝滚动，data-speed 为**速度倍率**（缺省 1，基准 1.2px/帧）
 *                      · pausing    —— 每切换一张后停顿片刻，data-speed 为**停顿秒数**
 *                                      （缺省 2 秒；支持小数，精度到毫秒，多余位数直接舍弃）
 *
 *   data-controller-type  "" | "step" | "progress" | "step-pause"（缺省空 = 不渲染控制器）
 *                      · step        上一张 / 下一张 两个玻璃按钮
 *                      · step-pause  在 step 基础上多一个暂停 / 继续按钮
 *                      · progress    胶囊进度条（对应各卡片的点，当前点展开为进度条）
 *                                    + 暂停 / 继续按钮
 *                      · ⚠️ data-type="continuous" 时没有「当前卡片」概念、进度条无意义，
 *                         因此**任何 controller-type 都只渲染暂停 / 继续按钮**
 *
 *   data-controller-pos    "left"|"center"|"right" + "top"|"bottom"（缺省 right-bottom）
 *                          （如 "left-top"、"center-bottom"、"right-top"）
 *
 *   data-controller-overlap "true" | "false"（缺省 false）
 *                          false —— 控制器参与布局、把容器撑开，不与卡片重叠
 *                          true  —— 控制器绝对定位于上表六方位之一，叠在卡片上
 *
 * 初始化时生成的结构：
 *   .loop-cards[data-*]
 *     ├ .loop-cards-viewport > .loop-cards-track > 卡片 ×N + 克隆 ×N
 *     └ .loop-cards-controller > .loop-cards-btn ×N (+ .loop-cards-progress > .loop-cards-dot ×N)
 *
 * 其它行为：
 *   · 卡片内容不足一屏（含相等）时居中显示、不滚动，控制器也不渲染 ——
 *     判定用 轨道内容尺寸 vs 视口可用尺寸（+1px 容差），见 initInstance 内注释
 *   · 测量严格等到「样式表就绪 + 字体就绪」之后再做（stylesReady / document.fonts.ready）：
 *     否则量到的是**未套样式的裸 DOM**（卡片纵向堆叠），会被误判成「内容不足一屏」
 *     而静止不动 —— 表现为「要手动 resize 窗口才开始轮播」
 *   · 容器尺寸变化由 ResizeObserver 捕获并防抖重建：既覆盖不伴随 window resize 的
 *     布局变化，也覆盖容器从 display:none 变为可见（因此放进可折叠容器也能自动恢复）
 *   · 垂直轮播需调用方给容器限定高度，否则视口被卡片撑满、永远「不足一屏」而不滚动
 *   · window.streack.flag.noAnimation 为真时整体不动画
 *   · 页面切到后台（document.hidden）暂停，回到前台继续
 *   · 视口带 pointer-events:none（卡片不拦截点击）；需要卡片可点就删掉该样式
 *   · 样式由 component/loop-cards.css 自动注入，页面无需手写 <link>
 */

const STYLE_HREF = new URL('./loop-cards.css', import.meta.url).href;

/** 图标路径（24×24 实心，颜色随 currentColor） */
const ICONS = {
  left: 'M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z',
  right: 'M8.6 16.6 10 18l6-6-6-6-1.4 1.4L13.2 12z',
  up: 'M7.4 15.4 6 14l6-6 6 6-1.4 1.4L12 10.8z',
  down: 'M16.6 8.6 18 10l-6 6-6-6 1.4-1.4L12 13.2z',
  pause: 'M8 5h3v14H8zM13 5h3v14h-3z',
  play: 'M8 5l11 7-11 7z',
};

/** 四种方向 → { 轴, 位移符号 }：dir=-1 表示内容向负方向移动（左/上） */
export const ORIENTATIONS = {
  'horizontal': { axis: 'x', dir: -1 },
  'reverted-horizontal': { axis: 'x', dir: 1 },
  'vertical': { axis: 'y', dir: -1 },
  'reverted-vertical': { axis: 'y', dir: 1 },
};

/** 步进动画时长（ms）—— 与 JS 写入的 CSS transition 共用此常量 */
const MOVE_MS = 520;

/** continuous 模式的速度基准（px/帧） */
const SPEED_BASE = 1.2;

/** 停顿模式的缺省停留时长（秒） */
const HOLD_DEFAULT_SEC = 2;

/**
 * 注入组件样式表，并返回「就绪」Promise（同一份只注入、只等一次）
 *
 * ⚠️ 必须等它就绪再测量：样式表是异步到达的，在此之前布局还是「裸 DOM」——
 * 轨道尚未成为 flex 行、卡片在纵向堆叠，测出的尺寸会被误判成
 * 「内容不足一屏」→ 组件静止不滚动，要手动 resize（触发的重建那时样式已就位）才恢复。
 */
let _stylesReady = null;
function stylesReady() {
  if (_stylesReady) return _stylesReady;
  _stylesReady = new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLE_HREF;
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => {
      console.warn('[loop-cards] 组件样式加载失败，将以裸 DOM 继续：', STYLE_HREF);
      resolve();
    }, { once: true });
    document.head.appendChild(link);
  });
  return _stylesReady;
}

/**
 * 秒 → 毫秒：精度到毫秒，多余位数直接舍弃（1.2345 → 1234）
 * @param {number|string} sec
 * @returns {number} 非法或 ≤0 时返回 0
 */
export function secondsToMs(sec) {
  const n = Number(sec);
  return Number.isFinite(n) && n > 0 ? Math.floor(n * 1000) : 0;
}

/**
 * 取「上一张 / 下一张」按钮的箭头方向
 * 正向模式（内容向左/上移动）时：上一张指反方向、下一张指正方向；reverted 时对调
 * @param {{axis: string, dir: number}} cfg
 * @param {boolean} forward 是否为「下一张」
 * @returns {string} ICONS 的键名
 */
export function resolveArrow(cfg, forward) {
  const positive = cfg.dir < 0 ? forward : !forward;
  if (cfg.axis === 'y') return positive ? 'down' : 'up';
  return positive ? 'right' : 'left';
}

/**
 * 决定控制器要渲染哪些部件
 * · 未设 controller-type → 完全不渲染
 * · data-type="continuous" → 没有「当前卡片」概念、进度条无意义，任何类型都只渲染暂停按钮
 * · data-type="pausing" → 按 controller-type 渲染（step / step-pause / progress）
 * @param {boolean} isPausing
 * @param {string} ctrlType
 * @returns {{ render: boolean, step: boolean, toggle: boolean, progress: boolean }}
 */
export function resolveController(isPausing, ctrlType) {
  if (!ctrlType) return { render: false, step: false, toggle: false, progress: false };
  if (!isPausing) return { render: true, step: false, toggle: true, progress: false };
  return {
    render: true,
    step: ctrlType === 'step' || ctrlType === 'step-pause',
    toggle: ctrlType === 'step-pause' || ctrlType === 'progress',
    progress: ctrlType === 'progress',
  };
}

/**
 * 生成按钮元素
 * 用 Sober 的 <s-icon-button>：其模板自带 `<s-ripple attached="true">`，
 * 因此天然具备涟漪点击反馈（自定义 <button> 需自行触发 ripple，见 Sober 源码）。
 * 图标颜色交给 Sober 的主题变量自动适配亮 / 暗。
 */
function makeButton(role, iconName, label) {
  const btn = document.createElement('s-icon-button');
  btn.className = 'loop-cards-btn glass';
  btn.dataset.role = role;
  btn.tabIndex = 0;
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-label', label);
  btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[iconName]}"/></svg>`;
  return btn;
}

/** 生成胶囊进度条（每个卡片一个点，第一个点先激活展开） */
function makeProgress(count) {
  const box = document.createElement('div');
  box.className = 'loop-cards-progress glass';
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('span');
    dot.className = 'loop-cards-dot';
    if (i === 0) dot.dataset.active = 'true';
    dot.innerHTML = '<span class="loop-cards-dot-fill"></span>';
    box.appendChild(dot);
  }
  return box;
}

/** 初始化全部 .loop-cards 容器 */
export function initLoopCards() {
  document.querySelectorAll('.loop-cards').forEach((container) => {
    initInstance(container);
    observeResize(container);
  });
}

/** 初始化单个容器 */
function initInstance(container) {
  // 重复初始化（resize）前先停掉上一轮的循环与计时
  if (container._loopRaf) cancelAnimationFrame(container._loopRaf);
  if (container._loopTimer) clearTimeout(container._loopTimer);
  container._loopRaf = 0;
  container._loopTimer = 0;

  const orientation = container.dataset.orientation || 'horizontal';
  const cfg = ORIENTATIONS[orientation] || ORIENTATIONS.horizontal;

  const isPausing = container.dataset.type === 'pausing';
  const ctrlType = container.dataset.controllerType || '';
  const ctrlPos = container.dataset.controllerPos || 'right-bottom';
  const ctrlOverlap = container.dataset.controllerOverlap === 'true';

  const speedRaw = parseFloat(container.dataset.speed);
  const speed = Number.isFinite(speedRaw) && speedRaw > 0 ? speedRaw : null;

  /** 连续模式：每帧位移像素 */
  const pxPerFrame = SPEED_BASE * (speed ?? 1);
  /** 停顿模式：每张停留毫秒（非法或 ≤0 时用缺省 2 秒） */
  const holdMs = secondsToMs(speed ?? HOLD_DEFAULT_SEC) || HOLD_DEFAULT_SEC * 1000;

  // 卡片列表（重复初始化时保留首轮的引用）
  if (!container._loopCards) container._loopCards = [...container.children];
  const cards = container._loopCards;
  if (cards.length === 0) return;

  // 重建结构：视口 + 轨道（卡片被搬进轨道）
  container.innerHTML = '';
  const viewport = document.createElement('div');
  viewport.className = 'loop-cards-viewport';
  const track = document.createElement('div');
  track.className = 'loop-cards-track';
  viewport.appendChild(track);
  cards.forEach((c) => track.appendChild(c));
  container.appendChild(viewport);

  // 测量与启动（须等样式表 + 字体就绪，见文件尾部的 Promise.all）
  const measure = () => requestAnimationFrame(() => {
    const posOf = (el) => (cfg.axis === 'x' ? el.offsetLeft : el.offsetTop);
    const sizeOf = (el) => (cfg.axis === 'x' ? el.offsetWidth : el.offsetHeight);
    const viewportSize = cfg.axis === 'x' ? viewport.clientWidth : viewport.clientHeight;
    const stripSize = cfg.axis === 'x' ? track.scrollWidth : track.scrollHeight;

    // 内容不足一屏：居中展示，不滚动也不渲染控制器
    if (stripSize <= viewportSize + 1) {
      track.style.width = '100%';
      track.style.justifyContent = 'center';
      return;
    }

    // 步长 = 相邻卡片的跨距（已包含卡片间距）
    const step = cards.length > 1
      ? Math.abs(posOf(track.children[1]) - posOf(track.children[0]))
      : sizeOf(track.children[0]);

    // 克隆一份卡片，用于无缝回绕
    cards.forEach((c) => track.appendChild(c.cloneNode(true)));

    // 回绕跨度 = 克隆区第一张相对原始第一张的位移
    const span = (posOf(track.children[cards.length]) - posOf(track.children[0])) || stripSize;

    // ---------- 控制器 ----------
    const plan = resolveController(isPausing, ctrlType);
    let dots = [];
    let toggleBtn = null;

    if (plan.render) {
      const controller = document.createElement('div');
      controller.className = 'loop-cards-controller';
      controller.dataset.pos = ctrlPos;
      controller.dataset.overlap = String(ctrlOverlap);

      if (plan.progress) {
        const progress = makeProgress(cards.length);
        dots = [...progress.children];
        controller.appendChild(progress);
      }
      if (plan.step) {
        controller.appendChild(makeButton('prev', resolveArrow(cfg, false), '上一张'));
        controller.appendChild(makeButton('next', resolveArrow(cfg, true), '下一张'));
      }
      if (plan.toggle) {
        toggleBtn = makeButton('toggle', 'pause', '暂停');
        controller.appendChild(toggleBtn);
      }

      if (ctrlPos.endsWith('-top')) container.insertBefore(controller, viewport);
      else container.appendChild(controller);
    }

    // ---------- 运行状态 ----------
    let offset = cfg.dir < 0 ? 0 : -span;
    let stepIndex = Number.isInteger(container._loopStep)
      ? ((container._loopStep % cards.length) + cards.length) % cards.length
      : 0;
    let paused = false;
    let hidden = false;
    let phase = 'hold';      // 仅停顿模式：'hold' 停留 | 'move' 步进动画中
    let holdStart = 0;       // 当前计时段起点（0 = 未开始 / 已结算）
    let holdElapsed = 0;     // 已累计的停留毫秒数（暂停、切后台时保留，进度不丢）
    let lastTs = 0;          // 最近一帧时间戳（结算时用）

    const apply = () => {
      track.style.transform = cfg.axis === 'x'
        ? `translateX(${offset}px)`
        : `translateY(${offset}px)`;
    };

    /** 越过回绕边界时把位移拉回有效区间，实现无缝衔接 */
    const wrap = () => {
      if (cfg.dir < 0) {
        if (offset <= -span) offset += span;
      } else if (offset >= 0) {
        offset -= span;
      }
    };

    /** 把当前计时段结算进 holdElapsed（暂停 / 切后台时调用）—— 恢复后接着走，不清零 */
    const freezeHold = () => {
      if (holdStart) {
        holdElapsed += Math.max(0, (lastTs || holdStart) - holdStart);
        holdStart = 0;
      }
    };

    /** 进度归零（点击当前点重置、跳转后、一轮结束时） */
    const resetHold = () => {
      holdElapsed = 0;
      holdStart = 0;
      renderDots(0);
    };

    /** 更新进度点：仅当前卡片的点展开并填充，其余点回到纯底色（避免与当前项混淆） */
    const renderDots = (p) => {
      if (!dots.length) return;
      dots.forEach((d, i) => {
        const active = i === stepIndex;
        d.dataset.active = String(active);
        const fill = d.firstElementChild;
        if (fill) fill.style.setProperty('--p', active ? String(p) : '0');
      });
    };

    /** 步进一张（forward=false 为上一张）；仅停顿模式使用 */
    const advance = (forward) => {
      if (phase === 'move') return;
      phase = 'move';
      offset += cfg.dir * step * (forward ? 1 : -1);
      wrap();
      apply();
      container._loopTimer = setTimeout(() => {
        phase = 'hold';
        const delta = forward ? 1 : -1;
        stepIndex = ((stepIndex + delta) % cards.length + cards.length) % cards.length;
        container._loopStep = stepIndex;
        resetHold();
        container._loopTimer = 0;
      }, MOVE_MS);
    };

    /** 直接跳到第 index 张（点击进度点时）；位移取与当前位置最近的一个等价位置 */
    const jumpTo = (index) => {
      if (phase === 'move') return;
      stepIndex = index;
      container._loopStep = index;
      const base = cfg.dir < 0 ? -index * step : -span + index * step;
      let target = base;
      for (const cand of [base - span, base, base + span]) {
        if (Math.abs(cand - offset) < Math.abs(target - offset)) target = cand;
      }
      offset = target;
      apply();
      resetHold();
    };

    const frozen = () => hidden || paused || window?.streack?.flag?.noAnimation;

    /** 连续模式：每帧位移 */
    const tickContinuous = () => {
      container._loopRaf = requestAnimationFrame(tickContinuous);
      if (frozen()) return;
      offset += cfg.dir * pxPerFrame;
      wrap();
      apply();
    };

    /** 停顿模式：停留计时 → 满了就步进。暂停 / 切后台时结算进度，恢复后接着走 */
    const tickPausing = (ts) => {
      container._loopRaf = requestAnimationFrame(tickPausing);
      lastTs = ts;
      if (frozen()) { freezeHold(); return; }
      if (phase !== 'hold') return;
      if (!holdStart) holdStart = ts;
      const p = Math.min(1, (holdElapsed + (ts - holdStart)) / holdMs);
      renderDots(p);
      if (p >= 1) {
        holdElapsed = 0;
        holdStart = 0;
        advance(true);
      }
    };

    // ---------- 事件 ----------
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (paused) {
          paused = false;        // 恢复：保留已走过的进度，接着计时
        } else {
          freezeHold();          // 暂停：先结算当前段，避免进度被清零
          paused = true;
        }
        toggleBtn.dataset.paused = String(paused);
        const path = toggleBtn.querySelector('svg path');
        if (path) path.setAttribute('d', ICONS[paused ? 'play' : 'pause']);  // 只换路径，保留 ripple
        toggleBtn.setAttribute('aria-label', paused ? '继续' : '暂停');
      });
    }
    const prevBtn = container.querySelector('.loop-cards-btn[data-role="prev"]');
    const nextBtn = container.querySelector('.loop-cards-btn[data-role="next"]');
    if (prevBtn) prevBtn.addEventListener('click', () => advance(false));
    if (nextBtn) nextBtn.addEventListener('click', () => advance(true));

    // 进度点：点其他点 → 立即切到该卡片；点当前（已展开的进度条）→ 重置进度
    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        if (i === stepIndex) resetHold();
        else jumpTo(i);
      });
    });

    // 页面切到后台时暂停（省电），回到前台继续
    if (container._loopVisHandler) {
      document.removeEventListener('visibilitychange', container._loopVisHandler);
    }
    container._loopVisHandler = () => {
      hidden = document.hidden;
      if (hidden) freezeHold();   // 结算进度，回前台接着走
    };
    document.addEventListener('visibilitychange', container._loopVisHandler);

    // ---------- 启动 ----------
    apply();
    if (isPausing) {
      container._loopStep = stepIndex;
      renderDots(0);
      // 步进动画用 CSS transition 完成（时长与 MOVE_MS 一致）
      track.style.transition = `transform ${MOVE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
      container._loopRaf = requestAnimationFrame(tickPausing);
    } else {
      container._loopRaf = requestAnimationFrame(tickContinuous);
    }
  });

  // 等样式表与字体就绪再测量：两者都会改变布局尺寸（字体就绪后文字宽度会变），
  // 过早测量会得到「裸 DOM」的尺寸 → 误判为内容不足一屏（详见 stylesReady 注释）
  Promise.all([
    stylesReady(),
    (document.fonts && document.fonts.ready) || Promise.resolve(),
  ]).then(measure);
}

/**
 * 容器尺寸变化时重建（防抖 200ms）
 * 比监听 window resize 更准：容器自身被布局改变（不伴随窗口变化）时同样能响应；
 * 也顺带解决了「容器从 display:none 变为可见时不会恢复轮播」的问题。
 * 重建后短暂忽略回调，避免「重建 → 尺寸再变 → 再重建」的自激。
 */
function observeResize(container) {
  if (typeof ResizeObserver !== 'function' || container._loopResizeObs) return;
  let last = null;
  let timer = 0;
  container._loopResizeObs = new ResizeObserver((entries) => {
    const rect = entries[0] && entries[0].contentRect;
    if (!rect) return;
    if (Date.now() < (container._loopIgnoreUntil || 0)) return;   // 刚重建过，忽略
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const changed = !last || Math.abs(w - last.w) > 1 || Math.abs(h - last.h) > 1;
    last = { w, h };
    if (!changed) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      container._loopIgnoreUntil = Date.now() + 400;
      initInstance(container);
    }, 200);
  });
  container._loopResizeObs.observe(container);
}
