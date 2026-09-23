/**
 * Streack 网站初始化入口
 * 页面加载后依次初始化框架、弹窗管理、搜索模块
 */

// 框架初始化 —— DOM 片段加载、Toolbar 绑定、命令系统注册等
import { initFramework } from './framework.js';
initFramework();

// 弹窗管理模块 —— 注册 toolbar/tb / dialog/dlg / sheet/bst 命令
import './popups.js';

// 搜索模块 —— 搜索建议加载、键盘导航、渲染等
import { initSearch } from "./search.js";
initSearch();