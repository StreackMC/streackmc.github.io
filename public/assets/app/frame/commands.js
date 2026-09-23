import { SAME_REIGON } from './dom.js';
import { openURL, msg, CopyText } from './utils.js';

// ============================================================
// 可扩展命令系统
// ============================================================

/** 自定义命令处理器注册表 */
const _cmdHandlers = {};

/**
 * 注册自定义命令处理器
 * 注册后可通过 executeCommand(type, param) 调用
 * @param {string} type - 命令类型名（不区分大小写）
 * @param {(param: string) => boolean} handler - 处理函数，返回是否成功
 */
export function registerCommand(type, handler) {
  _cmdHandlers[type.toLowerCase()] = handler;
}

/**
 * 执行命令
 * 内置类型：
 *   - url：     打开链接，参数格式 "uri|stayInSameWindow"
 *   - popurl    在小窗里面打开链接，不支持自动回退
 *   - state：   [已弃用] 旧状态系统，现跳转到 /{param} 独立页面
 *   - note：    滚动到指定脚注注释
 *   - slot：    滚动到指定锚点元素
 *   - copy/cp   复制指定文本
 * 自定义类型通过 registerCommand 注册（参见 popups.js）
 * @param {string} type 命令类型
 * @param {string} param 命令参数
 * @returns {boolean} 是否成功执行
 */
export function executeCommand(type, param) {
  if (!(type)) return false;
  param = param ? param : "";

  const t = type.toLowerCase();

  // 优先查找自定义处理器
  const handler = _cmdHandlers[t];
  if (handler) return handler(param);

  switch (t) {
    case 'popurl':
    case 'purl':
      try {
        const uri = new URL(param);
        let isolated = true;
        for (let i = 0; i < SAME_REIGON.length; i++) {
          const acceptableDomain = SAME_REIGON[i];
          if (uri.host.includes(acceptableDomain)) {
            isolated = false;
            break;
          }
        }
        window.open(param, '_blank', {
          'popup': true,
          noopener: isolated,
        });
        break;
      } catch (popurlErr) {
        // 不支持或发生意外自动fall through到普通URL处理
        // 此处仅记录即可
        console.warn('[streack-app.cmd/popurl] POPURL 命令发生回退：无法处理 POPURL 命令 ', [t, param], ' ，因为：', popurlErr);
      }

    case 'url':
      // 格式："url|stayInSameWindow" 或 "url"
      // 并且只匹配最后一个 | ，支持语法糖，存在即为 true
      const lastSplash = param.lastIndexOf('|');
      if (lastSplash >= 0 && lastSplash < param.length) {
        openURL(param.slice(0, lastSplash), true);
      } else {
        openURL(param, false);
      }
      break;

    case 'state':
      // [已弃用] 旧 state 系统，保留兼容跳转到独立页面
      window.open(`/${encodeURIComponent(param)}`, '_self');
      break;

    case 'note':
      // 滚动到第 N 条脚注
      param = parseInt(param);
      const notesRoot = document.getElementById('notes');
      const notesComments = notesRoot ? notesRoot.querySelectorAll('li') : null;
      if (!notesRoot || !notesComments) {
        console.error('[streack-app.cmd/note] 页面不存在注释区域');
        msg('页面中未定义注释区域', '好', true);
        break;
      }
      try {
        if (param <= 0 || param > notesComments.length) throw new ReferenceError(param + '超出可接受的范围');
        notesComments[param - 1].scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      } catch (error) {
        console.warn('[streack-app.cmd/note] 无法滚动目标注释', param, '至视口：', error);
        msg('无法查找目标注释：' + error.message, '好', true);
      }
      break;

    case 'copy':
    case 'cp':
      return CopyText(param);

    case 'msg':
      const params = param.split(/(?<!\\)\|/);
      return msg(...params);

    case 'slot':
      // 滚动到指定 slot 属性的元素
      param = parseInt(param);
      const slot = document.querySelector(`div[slot="${param}"]`);
      try {
        slot.scrollIntoView({
          behavior: 'smooth',
          container: 'nearest',
          block: 'center',
        });
      } catch (error) {
        console.warn('[streack-app.cmd/slot] 无法滚动目标元素', param, '至视口：', error);
        msg('无法查找目标锚点：' + error.message, '好', true);
      }
      break;

    default:
      return false;
  }
  return true;
}

/**
 * 对目标元素及其全部子元素绑定命令
 * 扫描 data-cmd 属性（格式 "type:param"），转换为点击事件，消费后移除属性。
 * 用于动态插入 DOM 后重新绑定命令（如 selector 结果区、弹窗内容等）。
 * @param {Element} element - 目标元素（含自身及子元素）
 */
export function bindCommandOn(element) {
  if (!element || !element.querySelectorAll) return;

  const targets = element.hasAttribute && element.hasAttribute('data-cmd')
    ? [element, ...element.querySelectorAll('*[data-cmd]')]
    : [...element.querySelectorAll('*[data-cmd]')];

  targets.forEach((ele) => {
    const p = new String(ele.dataset.cmd).split(':');
    ele.addEventListener('click', (event) => { executeCommand(p[0], p.slice(1).join(':')); });
    delete ele.dataset.cmd;
  });
}
