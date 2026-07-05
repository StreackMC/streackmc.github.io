/**
 * Streack 网站初始化入口
 * 页面加载后依次初始化框架模块与搜索模块
 */

// 导入框架初始化函数并执行 —— 负责 DOM 片段加载、Toolbar 绑定、命令系统注册等
import { initFramework } from './framework.js';
initFramework();

// 导入搜索模块初始化函数并执行 —— 负责搜索建议加载、键盘导航、渲染等
import { initSearch } from "./search.js";
initSearch();