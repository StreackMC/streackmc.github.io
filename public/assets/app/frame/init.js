import { DOM, refreshToolbarDOM } from './dom.js';
import { DEFAULT_FRAGMENTS, loadFragment } from './fragments.js';
import { flushInitCallbacks } from './init-hooks.js';
import { bindCommandOn, executeCommand } from './commands.js';
import { cacheToolbarSlots, initToolbar2Slots } from '../component/toolbar/toolbar.js';
import { applyToolbarNavTemplates, scheduleToolbarBrandFit } from '../component/toolbar/toolbar-nav.js';
import { loadFeatures, readFeatures } from './features.js';

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

  // 13. 按页面声明加载可选组件（<streack features="…">，见 frame/features.js）
  //     只为已声明的组件发起动态 import —— 未声明的组件不会下载。
  //     异步进行、不 await：不阻塞初始化收尾，组件自身就绪后再生效。
  loadFeatures(readFeatures());
}
