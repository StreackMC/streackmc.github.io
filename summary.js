#!/usr/bin/env node
/**
 * summary.js — 用 LLM 为站点「实际渲染、人类可读」的页面生成标题与搜索关键词，
 *              并自动更新搜索数据文件 public/assets/search-suggestion.json
 *
 * ═══════════════════════════════════════════════════════════════
 *  运行前置
 * ═══════════════════════════════════════════════════════════════
 *  1. 先构建站点（本脚本读取构建产物 dist/ 下的 .html —— 即「实际渲染」结果）：
 *       ASTRO_TELEMETRY_DISABLED=1 npx astro build
 *  2. 在仓库根目录准备 secret.json（已被 .gitignore 忽略），格式：
 *       {
 *         "apiKey": "sk-...",                    // OpenAI 格式的密钥（必填）
 *         "baseURL": "https://api.openai.com/v1",// API 地址（可选，缺省为 OpenAI 官方）
 *         "model": "gpt-4o-mini",                // 使用的模型名（可选）
 *         "useStreamAPI": false,                 // 是否使用 Stream API（流式）
 *         "useResponseAPI": false                // 是否使用 Response API（否则 Chat Completions）
 *       }
 *     也兼容写成数组 [{...}]（取第一项）；baseURL 可指向任意 OpenAI 兼容端点（如 DeepSeek）。
 *
 * ═══════════════════════════════════════════════════════════════
 *  用法
 * ═══════════════════════════════════════════════════════════════
 *  不带参数运行会在交互终端中打开**交互式向导**：
 *       node summary.js
 *
 *  四种运行模式：
 *   · 全量更新              node summary.js -y
 *   · 仅增量更新            node summary.js --incremental
 *   · 仅更新指定目录        node summary.js --only "doc/**,about"
 *   · 仅在指定目录增量更新  node summary.js --incremental --only "doc/**"
 *
 *  常用选项（完整列表见 --help）：
 *       --dry-run / -n    只列出将处理的页面，不调用 LLM、不写文件
 *       --no-write        调用 LLM 但不写入搜索数据（打印结果）
 *       --replace         整体替换搜索数据（丢弃未覆盖的旧条目，默认「合并保留」）
 *       --pretty          以缩进格式写出（默认压缩为单行标准 JSON）
 *       --limit N         只处理前 N 个页面（试跑用）
 *       --no-cache        不读写增量缓存（增量模式下等价于全量）
 *       --help / -h       显示完整帮助
 *
 * ═══════════════════════════════════════════════════════════════
 *  增量更新
 * ═══════════════════════════════════════════════════════════════
 *  为每个页面记录「标题 + 正文」的 SHA-256 指纹，缓存在仓库根目录的
 *  .summary-cache.json（已加入 .gitignore）。增量运行时，指纹未变且搜索数据中
 *  已有该页面条目的会直接复用旧结果，仅对发生变化的页面调用 LLM；
 *  更换模型会使缓存整体失效，自动退回全量。
 *
 * ═══════════════════════════════════════════════════════════════
 *  名单（只总结指定目录的文件，支持通配符）
 * ═══════════════════════════════════════════════════════════════
 *  在仓库根目录维护 summary-list.txt，一行一个模式（# 开头为注释，空行忽略）：
 *
 *       doc/**              # doc 下所有页面
 *       about/legal         # 该目录及其下的页面
 *       /webtool/*          # 通配符：webtool 下任意一层
 *       /doc/policy/privacy # 单个页面也可以
 *       !doc/event/**       # 以 ! 开头：强制排除（优先级高于纳入）
 *
 *  · 模式匹配的是**网站路径**（如 /doc/policy/donate，而非 dist 里的文件路径）
 *  · 开头的 / 可省略；以 / 结尾（如 doc/policy/）等价于 doc/policy/**
 *  · 通配符：* 匹配任意多个字符（不含 /）、** 跨层级、? 匹配单个字符
 *  · 只写目录名（如 doc/policy）时，该目录**及其下所有页面**都会被纳入
 *  · **! 前缀 = 强制排除**，排除始终优先；只写排除项时基准为「全部可读页面」
 *  · 名单为空或文件不存在 → 不做过滤，处理全部可读页面
 *  · --only 传入的模式会**覆盖**名单文件（临时试跑用），规则完全一致
 *
 * ═══════════════════════════════════════════════════════════════
 *  生成条目字段
 * ═══════════════════════════════════════════════════════════════
 *    { link, keywords, title, summary }
 *    · title    —— 真·文章标题，取自页面 <title> 并去除站点名后缀
 *    · summary  —— LLM 生成的全文概要
 *    · keywords —— LLM 生成的搜索关键词
 *
 * ═══════════════════════════════════════════════════════════════
 *  代码组织
 * ═══════════════════════════════════════════════════════════════
 *  本文件只是**入口**：解析参数 → 必要时打开交互向导 → 交给工具模块执行。
 *
 *    tools/summary/cli.js          参数解析、帮助文本、交互式向导
 *    tools/summary/run.js          主编排流程（扫描 → 增量规划 → LLM → 写出）
 *    tools/summary/pages.js        扫描 dist、提取「人类可读」正文
 *    tools/summary/allowlist.js    名单读取与路径匹配
 *    tools/summary/incremental.js  增量指纹缓存
 *    tools/summary/llm.js          模型构建与单页总结
 *    tools/summary/store.js        搜索数据读写与合并
 *    tools/summary/terminal.js     终端样式与进度输出
 */

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { helpText, parseArgs, runWizard, shouldUseWizard, UsageError } from './tools/summary/cli.js';
import { run } from './tools/summary/run.js';

/** 仓库根目录（本文件所在目录） */
const ROOT = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

/**
 * 入口流程：解析参数 → 校验 → 交互向导 → 执行。
 *
 * @returns {Promise<number>} 进程退出码
 */
async function main() {
  let options;
  try {
    options = parseArgs(argv, ROOT);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    console.error(`[summary] ${err.message}\n`);
    console.error(helpText());
    return 2;
  }

  if (options.help) {
    console.log(helpText());
    return 0;
  }

  if (shouldUseWizard(argv, options)) {
    const wizardOptions = await runWizard(options);
    if (!wizardOptions) return 0; // 用户取消
    options = wizardOptions;
  }

  return run(options);
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error('[summary] 运行出错：', err);
    process.exitCode = 1;
  });
