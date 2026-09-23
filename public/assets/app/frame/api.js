import { openURL, msg, CopyText, getCurrentTimeZone, getQueryString } from './utils.js';
import { executeCommand, registerCommand, bindCommandOn } from './commands.js';
import { shrinkToolbar, expandToolbar, switchToolbar, registerToolbarSlot } from '../component/toolbar/toolbar.js';
import { setToolbarLoc, setToolbarLocIndex } from '../component/toolbar/toolbar-nav.js';
import { closeAllDialogs } from '../component/dialog.js';
import { toolbarPresets, registerToolbarPreset } from '../config/toolbar-presets.js';

// ============================================================
// 导出通用对象
// ============================================================
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
} else {
  window.streack.meta.initby.push("streack-web-framework");
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
};