/**
 * Streack · 搜索模块（框架通用）
 * 搜索建议加载/匹配/渲染、键盘导航
 */

import {
  DOM, openURL,
  toolbarSlots, toolbarExpanded,
  expandToolbar, shrinkToolbar,
  requestInitFunc,
} from './framework.js';


// ============================================================
//  DOM 引用（toolbar 由 includes 动态加载，故惰性查询）
// ============================================================

let searchInput = null;
let searchSuggestions = null;
let searchBtn = null;

function querySearchDOM() {
  searchInput = document.getElementById('toolbar-search-input');
  searchSuggestions = document.getElementById('toolbar-search-suggestions');
  searchBtn = document.getElementById('toolbar1-search');
}

/**
 * 初始化搜索模块（入口）
 * 由页面通过 requestInitFunc 注册，框架就绪后自动执行
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

/** 搜索建议数据 */
let searchSuggestionData = [];

/** 当前高亮索引 */
let highlightIndex = -1;

/** 当前渲染的建议项数据 */
let currentSuggestionItems = [];


// ============================================================
//  数据加载
// ============================================================

/** 加载搜索建议 JSON */
async function loadSearchSuggestions() {
  try {
    const res = await fetch('/assets/search-suggestion.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    searchSuggestionData = await res.json();
    if (toolbarSlots.search?.classList.contains('active')) {
      renderSuggestions(filterSuggestions(searchInput.value.trim()));
    }
  } catch (err) {
    console.warn('[search] 搜索建议加载失败:', err);
  }
}


// ============================================================
//  匹配引擎
// ============================================================

function filterSuggestions(query = '') {
  if (!searchSuggestionData.length) return [];
  if (!query) return searchSuggestionData.slice();

  const q = query.toLowerCase();
  const scored = [];

  for (const item of searchSuggestionData) {
    let score = 0;

    for (const kw of item.keywords) {
      const kwLower = kw.toLowerCase();
      if (kwLower === q) {
        score += 100;
      } else if (kwLower.startsWith(q)) {
        score += 50;
      } else if (kwLower.includes(q)) {
        score += 20;
      }
    }

    if (item.title.toLowerCase().includes(q)) score += 10;
    if (item.link.toLowerCase().includes(q)) score += 8;

    if (score > 0) scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}


// ============================================================
//  高度计算
// ============================================================

function calcMaxSuggestionItems() {
  if (!DOM.toolbar) return 5;
  const container = DOM.toolbar.actions.root;
  if (!container || !searchSuggestions) return 5;
  const rect = container.getBoundingClientRect();
  const searchBox = document.getElementById('toolbar-search-box');
  const searchBoxHeight = searchBox ? searchBox.offsetHeight : 48;
  const available = rect.height - searchBoxHeight - 20;
  if (available <= 8) return 5;
  return Math.max(1, Math.floor(available / 36));
}


// ============================================================
//  高亮管理
// ============================================================

function clearHighlight() {
  searchSuggestions.querySelectorAll('.ts-suggestion-item.highlighted')
    .forEach((el) => el.classList.remove('highlighted'));
  highlightIndex = -1;
}

function setHighlight(index) {
  const items = searchSuggestions.querySelectorAll('.ts-suggestion-item');
  clearHighlight();
  if (index < 0 || index >= items.length) return;
  items[index].classList.add('highlighted');
  highlightIndex = index;
  items[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}


// ============================================================
//  渲染
// ============================================================

function renderSuggestions(items) {
  searchSuggestions.innerHTML = '';
  currentSuggestionItems = [];

  const currentQuery = searchInput.value.trim();
  const hasQuery = !!currentQuery;
  const maxItems = calcMaxSuggestionItems();
  const bingReserved = hasQuery ? 1 : 0;
  const limited = items.slice(0, Math.max(0, maxItems - bingReserved));

  limited.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'ts-suggestion-item';
    el.style.animationDelay = `${i * 40}ms`;
    el.innerHTML = `
      <span class="ts-suggestion-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14">
          <path fill="#888" d="M14.298,27.202l-3.87-3.87c0.701-0.929,1.122-2.081,1.122-3.332c0-3.06-2.489-5.55-5.55-5.55c-3.06,0-5.55,2.49-5.55,5.55 c0,3.061,2.49,5.55,5.55,5.55c1.251,0,2.403-0.421,3.332-1.122l3.87,3.87c0.151,0.151,0.35,0.228,0.548,0.228 s0.396-0.076,0.548-0.228C14.601,27.995,14.601,27.505,14.298,27.202z M1.55,20c0-2.454,1.997-4.45,4.45-4.45 c2.454,0,4.45,1.997,4.45,4.45S8.454,24.45,6,24.45C3.546,24.45,1.55,22.454,1.55,20z" transform="translate(0, -9)"/>
        </svg>
      </span>
      <span class="ts-suggestion-title">${escapeHtml(item.title)}</span>
    `;
    el.addEventListener('click', () => {
      openURL(item.link, true);
      searchInput.value = '';
      shrinkToolbar();
    });
    el.addEventListener('mousemove', () => setHighlight(i));
    searchSuggestions.appendChild(el);
    currentSuggestionItems.push(item);
  });

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

  if (!limited.length && !hasQuery) {
    searchSuggestions.classList.remove('has-items');
    clearHighlight();
    searchSuggestions.innerHTML = '';
    currentSuggestionItems = [];
    return;
  }

  searchSuggestions.classList.add('has-items');
  setHighlight(0);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}


// ============================================================
//  防抖
// ============================================================

function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

const handleSearchInput = debounce(function () {
  renderSuggestions(filterSuggestions(searchInput.value.trim()));
}, 200);


// ============================================================
//  事件绑定
// ============================================================

function initSearchUI() {
  function onSearchBtnClick() {
    if (toolbarExpanded) {
      shrinkToolbar();
    } else {
      expandToolbar('search');
      searchInput.value = '';
      requestAnimationFrame(() => {
        searchInput.focus();
        renderSuggestions(filterSuggestions());
      });
    }
  }
  if (!searchBtn || !searchInput || !searchSuggestions) {
    console.warn('[search] 搜索 DOM 元素未就绪，跳过初始化');
    return;
  }
  searchBtn.addEventListener('click', onSearchBtnClick);

  searchInput.addEventListener('input', handleSearchInput);

  searchInput.setAttribute('placeholder', `搜索 ${location.hostname}……`);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      onSearchBtnClick();
    }
  });

  searchInput.addEventListener('keydown', (e) => {
    const items = searchSuggestions.querySelectorAll('.ts-suggestion-item');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!items.length) return;
      const next = highlightIndex < items.length - 1 ? highlightIndex + 1 : 0;
      setHighlight(next);

    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      const prev = highlightIndex > 0 ? highlightIndex - 1 : items.length - 1;
      setHighlight(prev);

    } else if (e.key === 'Tab' && items.length > 0) {
      e.preventDefault();
      navigateHighlighted();

    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < currentSuggestionItems.length) {
        navigateHighlighted();
        return;
      }
      fallbackBingSearch();
    }
  });

  window.addEventListener('resize', debounce(() => {
    if (!toolbarExpanded || !toolbarSlots.search?.classList.contains('active')) return;
    renderSuggestions(filterSuggestions(searchInput.value.trim()));
  }, 200));

  loadSearchSuggestions();
}


// ============================================================
//  导航辅助
// ============================================================

function navigateHighlighted() {
  const item = currentSuggestionItems[highlightIndex];
  if (!item) return;

  if (item.bing) {
    fallbackBingSearch();
  } else {
    openURL(item.link, true);
  }
  searchInput.value = '';
  shrinkToolbar();
}

function fallbackBingSearch() {
  const query = searchInput.value.trim();
  if (!query) return;
  const url = 'https://cn.bing.com/search?q=' +
    encodeURIComponent(query + ' (site:streack.top OR site:mc.kdxiaoyi.top)');
  window.open(url, '_blank');
  searchInput.value = '';
  shrinkToolbar();
}
