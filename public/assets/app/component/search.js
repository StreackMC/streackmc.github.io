/**
 * Streack · 搜索模块（框架通用）
 * 搜索建议加载/匹配/渲染、键盘导航、搜索框交互
 *
 * 依赖框架的 requestInitFunc 确保 Toolbar DOM 就绪后才初始化
 */

import {
  DOM, openURL,
  toolbarSlots, toolbarExpanded,
  expandToolbar, shrinkToolbar,
  requestInitFunc, registerCommand
} from './framework.js';


// ============================================================
//  DOM 引用（toolbar 由 includes 动态加载，故使用惰性查询）
// ============================================================

/** @type {HTMLInputElement} 搜索输入框 */
let searchInput = null;

/** @type {HTMLElement} 搜索建议列表容器 */
let searchSuggestions = null;

/** @type {HTMLElement} 搜索触发按钮 */
let searchBtn = null;

/** 惰性查询搜索相关的 DOM 元素（框架就绪后才可获取到） */
function querySearchDOM() {
  searchInput = document.getElementById('toolbar-search-input');
  searchSuggestions = document.getElementById('toolbar-search-suggestions');
  searchBtn = document.getElementById('toolbar1-search');
}

/**
 * 初始化搜索模块（入口）
 * 由页面通过 requestInitFunc 注册，框架完全就绪后自动执行
 */
export function initSearch() {
  requestInitFunc(() => {
    querySearchDOM();
    initSearchUI();
  });
}


// ============================================================
//  数据与状态
// ============================================================

/** 从 JSON 加载的搜索建议原始数据 */
let searchSuggestionData = [];

/** 当前键盘高亮的建议项索引（-1 表示无高亮） */
let highlightIndex = -1;

/** 当前渲染的建议项列表（用于键盘导航时获取目标数据） */
let currentSuggestionItems = [];


// ============================================================
//  数据加载
// ============================================================

/**
 * 异步加载搜索建议 JSON 数据
 * 加载成功后如果搜索面板正处于激活状态，则立即重新渲染
 */
async function loadSearchSuggestions() {
  try {
    const res = await fetch('/assets/search-suggestion.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    searchSuggestionData = await res.json();
    // 若搜索面板当前已展开，刷新建议列表
    if (toolbarSlots.search?.classList.contains('active')) {
      renderSuggestions(filterSuggestions(searchInput.value.trim()));
    }
  } catch (err) {
    console.warn('[search] 搜索建议加载失败:', err);
  }
}


// ============================================================
//  匹配引擎（关键词打分排序）
// ============================================================

/**
 * 根据输入查询对建议数据进行匹配和排序
 * 匹配优先级：关键词完全匹配(100) > 关键词前缀匹配(50) > 关键词包含(20) > 标题包含(10) > 链接包含(8)
 * @param {string} query - 用户输入的查询文本
 * @returns {Array} 按相关度降序排列的匹配项
 */
function filterSuggestions(query = '') {
  if (!searchSuggestionData.length) return [];
  // 空查询返回全部建议
  if (!query) return searchSuggestionData.slice();

  const q = query.toLowerCase();
  const scored = [];

  for (const item of searchSuggestionData) {
    let score = 0;

    // 遍历关键词数组，计算最高匹配得分
    for (const kw of item.keywords) {
      const kwLower = kw.toLowerCase();
      if (kwLower === q) {
        score += 100;        // 精确匹配
      } else if (kwLower.startsWith(q)) {
        score += 50;         // 前缀匹配
      } else if (kwLower.includes(q)) {
        score += 20;         // 子串包含
      }
    }

    // 标题和链接的模糊匹配（较低权重）
    if (item.title.toLowerCase().includes(q)) score += 10;
    if (item.link.toLowerCase().includes(q)) score += 8;

    if (score > 0) scored.push({ item, score });
  }

  // 按得分降序排列
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}


// ============================================================
//  建议列表高度计算
// ============================================================

/**
 * 计算建议列表最多可显示的条目数
 * 总显示区域高度 = (100dvh - toolbar1高度 - padding高度) / 2
 * 再扣除搜索框高度和底部间距后，÷ 每条建议高度(36px) 得出条数
 * @apiNote 最小返回 3 条
 * @returns {number} 最多可显示的建议条目数
 */
function calcMaxSuggestionItems() {
  const MIN = 3;
  if (!DOM.toolbar) return MIN;

  // 100dvh = viewport 高度
  const viewportH = window.innerHeight;
  // toolbar1 实际渲染高度
  const toolbar1 = document.getElementById('toolbar1');
  const toolbar1H = toolbar1 ? toolbar1.offsetHeight : 0;
  // toolbar-area 的垂直 padding 总和
  const area = DOM.toolbar.root;
  const areaStyle = area ? getComputedStyle(area) : null;
  const paddingH = areaStyle
    ? parseFloat(areaStyle.paddingTop) + parseFloat(areaStyle.paddingBottom)
    : 0;

  const totalArea = (viewportH - toolbar1H - paddingH) / 2;

  const searchBox = document.getElementById('toolbar-search-box');
  const searchBoxHeight = searchBox ? searchBox.offsetHeight : 48;
  const available = totalArea - searchBoxHeight - 20;  // 可用高度 = 总区域 - 搜索框 - 底部间距
  if (available <= 8) return MIN;
  return Math.max(MIN, Math.floor(available / 36));    // 每条建议高度约 36px
}


// ============================================================
//  键盘高亮管理
// ============================================================

/** 清除所有建议项的高亮状态 */
function clearHighlight() {
  searchSuggestions.querySelectorAll('.ts-suggestion-item.highlighted')
    .forEach((el) => el.classList.remove('highlighted'));
  highlightIndex = -1;
}

/**
 * 设置指定索引的建议项为高亮状态
 * 自动清除旧高亮，并将该项滚动到可视区域
 * @param {number} index - 目标索引（超出范围则仅清除高亮）
 */
function setHighlight(index) {
  const items = searchSuggestions.querySelectorAll('.ts-suggestion-item');
  if (index < 0 || index >= items.length || items[index]?.dataset?.searchSuggetionPlaceholderId) return;
  clearHighlight();
  items[index].classList.add('highlighted');
  highlightIndex = index;
  // 将高亮项滚动到可视区域（不改变滚动容器的平滑度）
  items[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}


// ============================================================
//  建议列表渲染
// ============================================================

/**
 * 渲染搜索建议列表
 * - 根据可用高度限制显示数量
 * - 有查询时在最底部保留一个「在 Bing 上查找」快捷入口
 * - 每项带图标、标题、交错动画延迟、鼠标悬停高亮
 * @param {Array} items - 经过 filterSuggestions 排序后的建议项
 */
function renderSuggestions(items) {
  searchSuggestions.innerHTML = '';
  currentSuggestionItems = [];

  const currentQuery = searchInput.value.trim();
  const hasQuery = !!currentQuery;
  const maxItems = calcMaxSuggestionItems();
  const bingReserved = hasQuery ? 1 : 0;  // 有查询时预留底部 Bing 搜索项的位置
  const limited = items.slice(0, Math.max(0, maxItems - bingReserved));

  // 渲染匹配到的站内建议项
  limited.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'ts-suggestion-item';
    el.style.animationDelay = `${i * 40}ms`;  // 交错动画
    el.innerHTML = `
      <span class="ts-suggestion-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14">
          <path fill="#888" d="M14.298,27.202l-3.87-3.87c0.701-0.929,1.122-2.081,1.122-3.332c0-3.06-2.489-5.55-5.55-5.55c-3.06,0-5.55,2.49-5.55,5.55 c0,3.061,2.49,5.55,5.55,5.55c1.251,0,2.403-0.421,3.332-1.122l3.87,3.87c0.151,0.151,0.35,0.228,0.548,0.228 s0.396-0.076,0.548-0.228C14.601,27.995,14.601,27.505,14.298,27.202z M1.55,20c0-2.454,1.997-4.45,4.45-4.45 c2.454,0,4.45,1.997,4.45,4.45S8.454,24.45,6,24.45C3.546,24.45,1.55,22.454,1.55,20z" transform="translate(0, -9)"/>
        </svg>
      </span>
      <span class="ts-suggestion-title">${escapeHtml(item.title)}</span>
    `;
    // 点击跳转
    el.addEventListener('click', () => {
      openURL(item.link, true);
      searchInput.value = '';
      shrinkToolbar();
    });
    // 鼠标悬停同步高亮
    el.addEventListener('mousemove', () => setHighlight(i));
    searchSuggestions.appendChild(el);
    currentSuggestionItems.push(item);
  });

  // 有查询时在底部添加「在 Bing 上查找」项
  if (hasQuery) {
    const bingIdx = limited.length;
    const bingEl = document.createElement('div');
    bingEl.className = 'ts-suggestion-item ts-suggestion-bing';
    bingEl.style.animationDelay = `${bingIdx * 40}ms`;
    bingEl.innerHTML = `
      <span class="ts-suggestion-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14">
          <path fill="#888" d="M14.298,27.202l-3.87-3.87c0.701-0.929,1.122-2.081,1.122-3.332c0-3.06-2.489-5.55-5.55-5.55c-3.06,0-5.55,2.49-5.55,5.55 c0,3.061,2.49,5.55,5.55,5.55c1.251,0,2.403-0.421,3.332-1.122l3.87,3.87c0.151,0.151,0.35,0.228,0.548,0.228 s0.396-0.076,0.548-0.228C14.601,27.995,14.601,27.505,14.298,27.202z M1.55,20c0-2.454,1.997-4.45,4.45-4.45 c2.454,0,4.45,1.997,4.45,4.45S8.454,24.45,6,24.45C3.546,24.45,1.55,22.454,1.55,20z" transform="translate(0, -9)"/>
        </svg>
      </span>
      <span class="ts-suggestion-title">在 Bing 上查找「${escapeHtml(currentQuery)}」</span>
    `;
    bingEl.addEventListener('click', () => {
      const q = searchInput.value.trim();
      if (!q) return;
      const url = 'https://cn.bing.com/search?q=' +
        encodeURIComponent(q + ' (site:streack.top OR site:mc.kdxiaoyi.top)');
      window.open(url, '_blank');
      searchInput.value = '';
      shrinkToolbar();
    });
    bingEl.addEventListener('mousemove', () => setHighlight(bingIdx));
    searchSuggestions.appendChild(bingEl);
    currentSuggestionItems.push({ link: null, title: '在 Bing 上查找', bing: true });
  }

  // 如果建议数量不足，那么就在末尾补足数量
  const missed = maxItems - bingReserved - limited.length;
  for (let i = 1; i <= missed; i++) {
    const el = document.createElement('div');
    el.className = 'ts-suggestion-item';
    el.style.animationDelay = `${i * 40}ms`;
    el.innerHTML = `
    <span class="ts-suggestion-icon" style="opacity:0;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14">
        <path fill="#888" d="M14.298,27.202l-3.87-3.87c0.701-0.929,1.122-2.081,1.122-3.332c0-3.06-2.489-5.55-5.55-5.55c-3.06,0-5.55,2.49-5.55,5.55 c0,3.061,2.49,5.55,5.55,5.55c1.251,0,2.403-0.421,3.332-1.122l3.87,3.87c0.151,0.151,0.35,0.228,0.548,0.228 s0.396-0.076,0.548-0.228C14.601,27.995,14.601,27.505,14.298,27.202z M1.55,20c0-2.454,1.997-4.45,4.45-4.45 c2.454,0,4.45,1.997,4.45,4.45S8.454,24.45,6,24.45C3.546,24.45,1.55,22.454,1.55,20z" transform="translate(0, -9)"/>
      </svg>
    </span>
    <span class="ts-suggestion-title" style="opacity:0;">No suggetions yet</span>
    `;
    // 设置透明度并忽略事件，只占据位置不渲染出图形
    el.style.opacity = 0;
    el.style.pointerEvents = 'none';
    // 设置该属性防止 setHightlight
    el.dataset.searchSuggetionPlaceholderId = i;
    searchSuggestions.appendChild(el);
    currentSuggestionItems.push({ link: null, title: null, bing: false });
  }

  // 无查询且无匹配时清空建议区
  if (!limited.length && !hasQuery) {
    searchSuggestions.classList.remove('has-items');
    clearHighlight();
    searchSuggestions.innerHTML = '';
    currentSuggestionItems = [];
    return;
  }

  // 有内容时默认高亮第一项，并滚动至首项
  searchSuggestions.classList.add('has-items');
  setHighlight(0);
  if (DOM?.toolbar?.actions?.root instanceof HTMLElement) DOM.toolbar.actions.root.scrollTop = 0;
}

/**
 * HTML 转义（防止 XSS）
 * 利用 DOM 节点的 textContent 赋值自动转义特性
 * @param {string} str - 原始文本
 * @returns {string} 转义后的 HTML 字符串
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}


// ============================================================
//  防抖工具
// ============================================================

/**
 * 创建一个防抖函数
 * @param {Function} fn - 需要防抖的函数
 * @param {number} delay - 延迟毫秒数
 * @returns {Function} 防抖包装后的函数
 */
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/** 防抖处理后的搜索输入响应（200ms 防抖） */
const handleSearchInput = debounce(function () {
  renderSuggestions(filterSuggestions(searchInput.value.trim()));
}, 200);


// ============================================================
//  搜索 UI 初始化（事件绑定）
// ============================================================

/**
 * 初始化搜索用户界面
 * 绑定：搜索按钮点击、输入框实时过滤、Ctrl+F 全局快捷键、
 * 键盘上下/Tab/Enter 导航、窗口 resize 重排
 */
function initSearchUI() {

  // 安全检查：搜索 DOM 元素必须全部存在
  if (!searchBtn || !searchInput || !searchSuggestions) {
    console.warn('[search] 搜索 DOM 元素未就绪，跳过初始化：btn/input/suggestion=', searchBtn, searchInput, searchSuggestions);
    return;
  }

  searchBtn.addEventListener('click', onSearchBtnClick);

  // 输入实时过滤（已防抖）
  searchInput.addEventListener('input', handleSearchInput);

  // 动态占位符：显示当前站点的域名
  searchInput.setAttribute('placeholder', `搜索 ${location.hostname}`);

  // 全局快捷键 Ctrl/Cmd+F 打开搜索
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      onSearchBtnClick();
    }
  });

  // 搜索框键盘导航
  searchInput.addEventListener('keydown', (e) => {
    const items = searchSuggestions.querySelectorAll('.ts-suggestion-item');

    if (e.key === 'ArrowDown') {
      // 下箭头：移到下一项（循环到开头）
      e.preventDefault();
      if (!items.length) return;
      const next = highlightIndex < items.length - 1 ? highlightIndex + 1 : 0;
      setHighlight(next);

    } else if (e.key === 'ArrowUp') {
      // 上箭头：移到上一项（循环到末尾）
      e.preventDefault();
      if (!items.length) return;
      const prev = highlightIndex > 0 ? highlightIndex - 1 : items.length - 1;
      setHighlight(prev);

    } else if (e.key === 'Tab' && items.length > 0) {
      // Tab：导航到高亮项
      e.preventDefault();
      navigateHighlighted();

    } else if (e.key === 'Enter') {
      // Enter：如果有高亮项则导航，否则回退到 Bing 搜索
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < currentSuggestionItems.length) {
        navigateHighlighted();
        return;
      }
      fallbackBingSearch();
    }
  });

  // 窗口大小变化时重新计算建议列表高度
  window.addEventListener('resize', debounce(() => {
    if (!toolbarExpanded || !toolbarSlots.search?.classList.contains('active')) return;
    renderSuggestions(filterSuggestions(searchInput.value.trim()));
  }, 200));

  // 加载搜索建议数据
  loadSearchSuggestions();
}

/** 搜索按钮点击处理：展开/收起切换 */
export function onSearchBtnClick(value = "") {
  if (toolbarExpanded) {
    shrinkToolbar();
  } else {
    expandToolbar('search');           // 展开搜索面板
    searchInput.value = (typeof value === 'string') ? value : "";
    requestAnimationFrame(() => {
      searchInput.focus();              // 自动聚焦输入框
      renderSuggestions(filterSuggestions());  // 渲染全部建议
    });
  }
}
registerCommand('search', onSearchBtnClick);

// ============================================================
//  导航辅助
// ============================================================

/**
 * 导航到当前高亮项对应的目标\n * - 站内建议项：在当前窗口打开链接\n * - Bing 搜索项：回退到 Bing 搜索\n * 导航后清空输入并收起 Toolbar\n */
function navigateHighlighted() {
  const item = currentSuggestionItems[highlightIndex];
  if (!item) return;

  if (item.bing) {
    fallbackBingSearch();
  } else {
    openURL(item.link, true);  // 在当前窗口打开站内链接
  }
  searchInput.value = '';
  shrinkToolbar();
}

/**
 * 回退到 Bing 搜索\n * 当无匹配建议或用户按 Enter 时，将查询内容提交给 Bing\n * 搜索限定在当前站点域名 (streack.top / mc.kdxiaoyi.top) 范围内\n */
function fallbackBingSearch() {
  const query = searchInput.value.trim();
  if (!query) return;
  const url = 'https://cn.bing.com/search?q=' +
    encodeURIComponent(query + ' (site:streack.top OR site:mc.kdxiaoyi.top)');
  window.open(url, '_blank');   // 新窗口打开 Bing 搜索结果
  searchInput.value = '';
  shrinkToolbar();
}
