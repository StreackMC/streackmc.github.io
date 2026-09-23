/**
 * Streack 网站初始化入口（组合根 · Composition Root）
 *
 * 职责：按序装配框架基础行为与必需组件。本文件是全站唯一的浏览器启动入口，
 * 也是 frame 层中允许引用 component 的组合根之一（另一个是 init.js）。
 *
 * 说明：import 语句会被提升，其依赖模块在本文件主体执行前求值，
 * 因此 api.js 必定在 initFramework() 之前把 window.streack 建立好。
 */

// 框架基础行为 —— 等待 DOM、加载片段、模板注入、命令绑定等
import { initFramework } from './init.js';

// 公共 API 暴露 —— 把框架能力挂到 window.streack（与旧框架 pmd.js 协作）
import './api.js';

initFramework();

// 弹窗管理模块 —— 注册 toolbar/tb / dialog/dlg / sheet/bst 命令
import '../component/popups.js';

// 搜索模块 —— 搜索建议加载、键盘导航、渲染等
import { initSearch } from '../component/search.js';
initSearch();
