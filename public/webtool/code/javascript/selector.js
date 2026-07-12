/**
 * ============================================================
 * Selector 模版 — 分层选择器
 * 类似 Apple 隐私页的逐层选择交互
 *
 * 正文流中依次展示：标题 → 描述文本 → 选择区
 * 选择区逐层展示选项卡按钮，点击后进入下一层，
 * 新出现的选项卡滚动至视口内部，
 * 若某层仅一个选项则自动选中并继续，
 * 直至展示最终结果。
 *
 * 使用方式：修改下方 SELECTOR_CONFIG 对象即可。
 *
 * 选项节点结构：
 *   {
 *     label:    "按钮标签",          // 必填
 *     hint:     "简短描述",          // 可选
 *     children: [ ... ],            // 子选项数组（与 result 二选一）
 *     result: {                      // 最终结果（与 children 二选一）
 *       title:   "结果标题",
 *       content: "HTML 内容字符串"
 *     }
 *   }
 * ============================================================
 */

const SELECTOR_CONFIG = {
  title: "选择主题",
  description:
    "选择一个主题以查看相关内容。点击选项卡逐层深入，直至找到你需要的详细信息。",
  options: [
    {
      label: "隐私政策",
      hint: "了解我们如何处理你的数据",
      children: [
        {
          label: "我们收集的信息",
          hint: "数据收集类型与范围",
          children: [
            {
              label: "账户信息",
              result: {
                title: "账户信息",
                content: `
                  <p>当你注册栈流Streack账户时，我们会收集以下信息：</p>
                  <ul>
                    <li>用户名与邮箱地址</li>
                    <li>加密后的密码（仅存储哈希值，不可逆）</li>
                    <li>注册时间与 IP 地址（用于安全审计）</li>
                  </ul>
                  <p>这些信息仅用于账户管理与身份验证，不会向第三方分享。</p>`,
              },
            },
            {
              label: "游戏数据",
              result: {
                title: "游戏数据",
                content: `
                  <p>在游戏过程中，服务器会记录以下数据：</p>
                  <ul>
                    <li>玩家位置、背包物品与游戏进度</li>
                    <li>聊天消息（用于违规行为审查）</li>
                    <li>登录 / 登出时间与在线时长</li>
                  </ul>
                  <p>这些数据存储在服务器数据库中，用于提供游戏服务与维护社区秩序。</p>`,
              },
            },
          ],
        },
        {
          label: "信息的使用",
          // 仅一个子项 → 自动选中并继续展示下一层
          children: [
            {
              label: "使用方式",
              result: {
                title: "信息的使用方式",
                content: `
                  <p>我们收集的信息仅用于以下目的：</p>
                  <ol>
                    <li><b>提供服务</b> — 运行游戏服务器、维护玩家数据</li>
                    <li><b>安全保障</b> — 防止恶意行为、处理违规举报</li>
                    <li><b>服务改进</b> — 分析使用趋势以优化体验</li>
                  </ol>
                  <p>我们绝不会将你的个人信息出售或用于商业广告目的。</p>`,
              },
            },
          ],
        },
      ],
    },
    {
      label: "服务条款",
      hint: "使用我们的服务即表示你同意这些条款",
      result: {
        title: "服务条款",
        content: `
          <p>欢迎使用栈流Streack。使用我们的服务器与服务即表示你接受以下条款：</p>
          <ul>
            <li>你必须遵守所有适用的法律法规</li>
            <li>不得使用作弊客户端、外挂或利用游戏漏洞</li>
            <li>尊重其他玩家，禁止骚扰、歧视或恶意行为</li>
            <li>管理员保留对违规行为进行处罚的权利</li>
          </ul>
          <p>如对条款有疑问，请通过<a href="/about/contact">联系我们</a>页面获取帮助。</p>`,
      },
    },
    {
      label: "免责声明",
      hint: "服务可用性与责任限制",
      result: {
        title: "免责声明",
        content: `
          <p>栈流Streack 提供的服务按"现状"提供，不附带任何明示或暗示的保证。</p>
          <ul>
            <li>服务器可能因维护、故障或其他原因随时中断服务</li>
            <li>因不可抗力导致的服务中断，我们不承担责任</li>
            <li>玩家应自行备份重要游戏数据</li>
            <li>对于因使用本服务而产生的任何间接损失，我们不承担责任</li>
          </ul>`,
      },
    },
  ],
};

// ============================================================
// State
// ============================================================

/** @type {{ option: object, depth: number }[]} */
let path = [];

const $ = (id) => document.getElementById(id);

// SVG icons
const ICON_CHEVRON_RIGHT =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.41 1.41l4.59-4.59a1 1 0 0 0 0-1.41L10.7 6.7a1 1 0 0 0-1.41 0z"/></svg>';
const ICON_RESET =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>';

// ============================================================
// Core rendering
// ============================================================

/**
 * 初始化选择器：填充标题与描述，渲染根层
 */
function initSelector() {
  $("selTitle").textContent = SELECTOR_CONFIG.title;
  $("selDesc").textContent = SELECTOR_CONFIG.description;
  path = [];
  renderLayer(SELECTOR_CONFIG.options, 0);
}

/**
 * 渲染一层选项按钮
 * @param {object[]} options - 当前层的选项数组
 * @param {number} depth     - 层级深度（0 = 根）
 */
function renderLayer(options, depth) {
  const container = $("layers");

  // 移除当前层及更深层
  container.querySelectorAll(".selector-layer").forEach((layer) => {
    if (parseInt(layer.dataset.depth) >= depth) layer.remove();
  });

  // 清空结果区
  const result = $("result");
  result.innerHTML = "";
  result.classList.remove("visible");

  // 创建新层容器
  const layer = document.createElement("div");
  layer.className = "selector-layer";
  layer.dataset.depth = depth;

  options.forEach((option) => {
    layer.appendChild(createOptionButton(option, depth));
  });

  container.appendChild(layer);

  // 触发入场动画
  requestAnimationFrame(() => {
    layer.classList.add("visible");
  });

  // 滚动至视口
  setTimeout(() => scrollToElement(layer), 120);

  // 更新面包屑
  updateBreadcrumb();

  // 若仅一个选项 → 自动选中并继续
  if (options.length === 1) {
    setTimeout(() => {
      const btn = layer.querySelector(".selector-option");
      if (btn) selectOption(options[0], depth, btn);
    }, 700);
  }
}

/**
 * 创建单个选项按钮
 */
function createOptionButton(option, depth) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "selector-option";

  const hasChildren = option.children && option.children.length > 0;

  btn.innerHTML = `
    <span class="selector-option-text">
      <span class="selector-option-label">${option.label}</span>
      ${option.hint ? `<span class="selector-option-hint">${option.hint}</span>` : ""}
    </span>
    ${hasChildren ? `<span class="selector-option-arrow">${ICON_CHEVRON_RIGHT}</span>` : ""}
  `;

  btn.addEventListener("click", () => {
    selectOption(option, depth, btn);
  });

  return btn;
}

/**
 * 选中一个选项 — 标记选中、更新路径、进入下一层或展示结果
 */
function selectOption(option, depth, buttonEl) {
  // 标记同层选中状态
  const layer = buttonEl.closest(".selector-layer");
  layer.querySelectorAll(".selector-option").forEach((b) => {
    b.dataset.selected = "false";
  });
  buttonEl.dataset.selected = "true";

  // 更新路径（截断到当前深度后追加）
  path = path.slice(0, depth);
  path[depth] = { option, depth };

  // 进入下一层或展示结果
  if (option.children && option.children.length > 0) {
    renderLayer(option.children, depth + 1);
  } else if (option.result) {
    showResult(option.result);
  } else {
    showResult({
      title: option.label,
      content: "<p>暂无详细内容。</p>",
    });
  }

  updateBreadcrumb();
}

/**
 * 展示最终结果
 */
function showResult(result) {
  const el = $("result");
  el.innerHTML = `
    <div class="selector-result-card">
      <h2 class="selector-result-title">${result.title}</h2>
      <div class="selector-result-content">${result.content}</div>
    </div>
    <button class="selector-reset" type="button">
      ${ICON_RESET}
      <span>重新选择</span>
    </button>
  `;

  el.querySelector(".selector-reset").addEventListener("click", resetSelector);

  requestAnimationFrame(() => {
    el.classList.add("visible");
  });

  setTimeout(() => scrollToElement(el), 120);
}

// ============================================================
// Breadcrumb
// ============================================================

/**
 * 更新面包屑导航
 */
function updateBreadcrumb() {
  const bc = $("breadcrumb");

  if (path.length === 0) {
    bc.innerHTML = "";
    bc.style.display = "none";
    return;
  }

  bc.style.display = "flex";

  let html = `<span class="bc-item" data-depth="0">全部</span>`;
  path.forEach((item, i) => {
    html += `<span class="bc-sep">›</span>`;
    if (i === path.length - 1) {
      html += `<span class="bc-item current">${item.option.label}</span>`;
    } else {
      html += `<span class="bc-item" data-depth="${i + 1}">${item.option.label}</span>`;
    }
  });
  bc.innerHTML = html;

  bc.querySelectorAll('.bc-item[data-depth]').forEach((el) => {
    el.addEventListener("click", () => {
      goBackTo(parseInt(el.dataset.depth));
    });
  });
}

/**
 * 返回到指定层级（面包屑点击）
 */
function goBackTo(depth) {
  path = path.slice(0, depth);

  if (depth === 0) {
    renderLayer(SELECTOR_CONFIG.options, 0);
  } else {
    const parentOption = path[depth - 1].option;
    renderLayer(parentOption.children, depth);
  }
}

// ============================================================
// Reset & Scroll
// ============================================================

/**
 * 重置选择器至初始状态
 */
function resetSelector() {
  path = [];
  renderLayer(SELECTOR_CONFIG.options, 0);
}

/**
 * 将元素平滑滚动至视口中央
 */
function scrollToElement(el) {
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ============================================================
// Boot
// ============================================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSelector);
} else {
  initSelector();
}
