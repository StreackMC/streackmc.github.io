import { openURL, msg, CopyText, getCurrentTimeZone, getQueryString } from './utils.js';
import { executeCommand, registerCommand, bindCommandOn } from './commands.js';
import { shrinkToolbar, expandToolbar, switchToolbar, registerToolbarSlot } from '../component/toolbar/toolbar.js';
import { setToolbarLoc, setToolbarLocIndex } from '../component/toolbar/toolbar-nav.js';
import { closeAllDialogs } from '../component/dialog.js';
import { toolbarPresets, registerToolbarPreset } from '../config/toolbar-presets.js';

// ============================================================
// 导出通用对象
// ============================================================
// 注：window.CopyText 是保留的**全局兼容别名** —— 页面 HTML 里的
//     onclick="CopyText('…')" 直接依赖它（见 src/pages/index.astro）。
//     规范写法是 window.streack.CopyText；别名只为兼容既有标记而保留。
if (!Array.isArray(window?.streack?.meta?.initby)) {
  window.streack = {
    meta: { initby: ["streack-web-framework/main"] },
    openURL: openURL,
    msg: msg,
    executeCommand: executeCommand,
    cmd: executeCommand,
    registerCommand: registerCommand,
    bindCommandOn: bindCommandOn,
    registerToolbarSlot: registerToolbarSlot,
    shrinkToolbar: shrinkToolbar,
    expandToolbar: expandToolbar,
    switchToolbar: switchToolbar,
    setToolbarLoc: setToolbarLoc,
    setToolbarLocIndex: setToolbarLocIndex,
    toolbarPresets: toolbarPresets,
    registerToolbarPreset: registerToolbarPreset,
    CopyText: CopyText,
    copyText: CopyText,
    closeAllDialogs: closeAllDialogs,
    getCurrentTimeZone: getCurrentTimeZone,
    getQueryString: getQueryString,
  };
} else {  window.streack.meta.initby.push("streack-web-framework");
  window.streack.openURL = openURL;
  window.streack.msg = msg;
  window.streack.executeCommand = executeCommand;
  window.streack.cmd = executeCommand;
  window.streack.registerCommand = registerCommand;
  window.streack.bindCommandOn = bindCommandOn;
  window.streack.registerToolbarSlot = registerToolbarSlot;
  window.streack.shrinkToolbar = shrinkToolbar;
  window.streack.expandToolbar = expandToolbar;
  window.streack.switchToolbar = switchToolbar;
  window.streack.setToolbarLoc = setToolbarLoc;
  window.streack.setToolbarLocIndex = setToolbarLocIndex;
  window.streack.toolbarPresets = toolbarPresets;
  window.streack.registerToolbarPreset = registerToolbarPreset;
  window.streack.CopyText = CopyText;
  window.streack.copyText = CopyText;
  window.streack.closeAllDialogs = closeAllDialogs;
  window.streack.getCurrentTimeZone = getCurrentTimeZone;
  window.streack.getQueryString = getQueryString;
}

// 全局兼容别名 —— 页面 HTML 的 onclick="CopyText('…')" 依赖它（见文件头说明）
window.CopyText = CopyText;