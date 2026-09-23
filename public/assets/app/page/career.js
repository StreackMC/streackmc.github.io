/**
 * Streack · 广纳贤士页（about/career）页面特定脚本
 *
 * 从 #jobcards 容器渲染招聘卡片：
 *   · 职位数据在下方 JOB_LIST —— 增删改职位只动这里
 *   · what 为空视为占位项、不渲染（便于保留结构化的空模板）
 *   · 卡片样式随脚本注入（仅本页需要，不放进全站样式表）
 */

import { openURL } from '../frame/utils.js';

/** 职位列表 */
const JOB_LIST = [
  {
    what: '暂无',                                   // 职位
    where: '目前 Streack Team 暂时没有发布招聘需求', // 地点
    todo: '点击以刷新',                             // 工作内容
    wanna: '',                                      // 需求
    reward: '',                                     // 福利待遇
    detail: '.',                                    // 详细地址
  },
  {
    what: '',
    where: '',
    todo: '',
    wanna: '',
    reward: '',
    detail: '',
  },
];

/** 卡片外观（随脚本注入，避免污染全站样式） */
const CARD_STYLE = `
  div#jobcards { flex-direction: row; flex-wrap: wrap; gap: 1rem; }
  body s-card.jobs_container { width: fit-content; padding: 1rem 1.5rem; height: max-content; min-width: calc(50% - 1rem); max-width: 100%; }
  body s-card.jobs_container div[slot="headline"] { font-size: 1.5rem; }
  body s-card.jobs_container div[slot="subhead"] { font-size: 1rem; }
  body s-card.jobs_container div[slot="text"] { font-size: .875rem; }
`;

/** 把 \n 转成 <br>，保持数据里可写多行 */
const nl2br = (text) => String(text ?? '').replace(/\n/g, '<br>');

const container = document.getElementById('jobcards');

if (container) {
  JOB_LIST.forEach((job) => {
    if (!job?.what) return;
    const card = document.createElement('s-card');
    card.type = 'outlined';
    card.classList.add('jobs_container');
    card.innerHTML = `
      <!-- <img slot="image" src="cover.jpg" alt=""> -->
      <div slot="headline">${nl2br(job.what)}</div>
      <div slot="subhead">${nl2br(job.where)}</div>
      <div slot="text">${nl2br(job.todo)}<br>${nl2br(job.wanna)}<br>${nl2br(job.reward)}</div>
    `;
    card.clickable = true;
    card.addEventListener('click', () => openURL(job.detail, true));
    container.appendChild(card);
  });

  const style = document.createElement('style');
  style.innerText = CARD_STYLE;
  document.body.appendChild(style);
}
