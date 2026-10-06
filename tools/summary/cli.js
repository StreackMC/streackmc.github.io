/**
 * cli.js — 命令行参数解析、帮助文本与交互式向导
 *
 * 对应关系（模式 → 参数）：
 *   · 全量更新             → 默认（不带 --incremental）
 *   · 仅增量更新           → --incremental
 *   · 仅更新指定目录       → --only <模式,...>
 *   · 仅在指定目录增量更新 → --incremental --only <模式,...>
 *
 * 不带任何参数且处于交互终端时，`summary.js` 会调用本模块的 `runWizard()` 打开向导；
 * 传入 `-y/--yes` 可强制非交互执行，便于脚本与 VS Code 任务使用。
 */

import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

import { readListFile } from './allowlist.js';
import { style } from './terminal.js';

/**
 * 参数用法错误（由入口捕获后打印帮助文本）。
 */
export class UsageError extends Error {
  /**
   * @param {string} message 错误信息
   */
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

/**
 * 生成全部选项的默认值（所有路径均基于仓库根目录）。
 *
 * @param {string} root 仓库根目录绝对路径
 * @returns {object} 默认选项
 */
export function defaultOptions(root) {
  return {
    root,
    distDir: join(root, 'dist'),
    listPath: join(root, 'summary-list.txt'),
    outputPath: join(root, 'public', 'assets', 'search-suggestion.json'),
    secretPath: join(root, 'secret.json'),
    cachePath: join(root, '.summary-cache.json'),

    help: false,
    interactive: false,
    assumeYes: false,
    incremental: false,
    dryRun: false,
    noWrite: false,
    replace: false,
    pretty: false,
    limit: 0,
    only: [],
  };
}

/**
 * 把逗号分隔的模式串拆成数组。
 *
 * @param {string} value 原始取值，如 `doc/**,!doc/event/**`
 * @returns {string[]} 模式数组
 */
function splitPatterns(value) {
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 解析命令行参数。
 *
 * @param {string[]} argv 参数列表（不含 node 与脚本路径）
 * @param {string} root 仓库根目录绝对路径
 * @returns {object} 解析后的选项
 * @throws {UsageError} 出现未知参数或缺少取值时抛出
 */
export function parseArgs(argv, root) {
  const options = defaultOptions(root);
  /** @type {string[]} */
  const errors = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    /** 读取下一个参数作为取值 */
    const takeValue = () => {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) {
        errors.push(`参数 ${arg} 缺少取值`);
        return null;
      }
      i += 1;
      return value;
    };

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-i':
      case '--interactive':
        options.interactive = true;
        break;
      case '-y':
      case '--yes':
      case '--non-interactive':
        options.assumeYes = true;
        break;
      case '--incremental':
        options.incremental = true;
        break;
      case '--full':
        options.incremental = false;
        break;
      case '-n':
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--no-write':
        options.noWrite = true;
        break;
      case '--replace':
        options.replace = true;
        break;
      case '--pretty':
        options.pretty = true;
        break;
      case '--no-cache':
        options.cachePath = null;
        break;
      case '-d':
      case '--dir': {
        const value = takeValue();
        if (value) options.distDir = resolve(root, value);
        break;
      }
      case '-o':
      case '--only': {
        const value = takeValue();
        if (value) options.only = splitPatterns(value);
        break;
      }
      case '-l':
      case '--limit': {
        const value = takeValue();
        if (value) options.limit = Math.max(0, parseInt(value, 10) || 0);
        break;
      }
      case '--cache': {
        const value = takeValue();
        if (value) options.cachePath = resolve(root, value);
        break;
      }
      case '--list': {
        const value = takeValue();
        if (value) options.listPath = resolve(root, value);
        break;
      }
      case '--output': {
        const value = takeValue();
        if (value) options.outputPath = resolve(root, value);
        break;
      }
      default:
        errors.push(arg.startsWith('-') ? `未知参数：${arg}` : `无法识别的参数：${arg}`);
    }
  }

  if (errors.length) throw new UsageError(errors.join('\n'));
  return options;
}

/**
 * 判断本次运行是否应打开交互式向导。
 *
 * 规则：显式 `-i/--interactive` 时始终打开；否则仅当「没有任何命令行参数」
 * 且处于交互终端、且未指定 `-y/--yes` 时打开。
 *
 * @param {string[]} argv 参数列表
 * @param {object} options 解析后的选项
 * @returns {boolean} 是否打开向导
 */
export function shouldUseWizard(argv, options) {
  if (options.help) return false;
  if (options.interactive) return true;
  if (options.assumeYes) return false;
  if (argv.length > 0) return false;
  return process.stdin.isTTY === true;
}

/**
 * 返回帮助文本（每条一行）。
 *
 * @returns {string} 帮助文本
 */
export function helpText() {
  return [
    'summary.js — 用 LLM 为站点「实际渲染、人类可读」的页面生成标题与搜索关键词',
    '',
    '用法：',
    '  node summary.js [模式选项] [其他选项]',
    '  node summary.js                          # 交互式向导（仅限交互终端）',
    '',
    '运行模式：',
    '  --full                     全量更新：重新总结所有命中名单的页面（默认）',
    '  --incremental              仅增量更新：只重新总结内容有变化的页面',
    '  --only <模式,...>          仅更新指定目录/页面（覆盖 summary-list.txt）',
    '  --incremental --only <...> 仅在指定目录增量更新',
    '  -i, --interactive          强制打开交互式向导',
    '',
    '其他选项：',
    '  -y, --yes                  非交互模式，按参数直接执行（脚本/任务用）',
    '  -n, --dry-run              只扫描并列出将处理的页面，不调用 LLM、不写文件',
    '      --no-write             调用 LLM 但不写入搜索数据（打印结果）',
    '      --replace              整体替换搜索数据（丢弃未覆盖的旧条目）',
    '      --pretty               以缩进格式写出（默认压缩为单行 JSON）',
    '  -l, --limit <N>            只处理前 N 个页面（试跑用）',
    '  -d, --dir <路径>           指定构建产物目录（默认 dist）',
    '      --cache <路径>         指定增量缓存文件（默认 .summary-cache.json）',
    '      --no-cache             不读写增量缓存（增量模式下等价于全量）',
    '      --list <路径>          指定名单文件（默认 summary-list.txt）',
    '      --output <路径>        指定搜索数据文件（默认 public/assets/search-suggestion.json）',
    '  -h, --help                 显示本帮助',
    '',
    '增量更新：',
    '  为每个页面记录「标题 + 正文」的 SHA-256 指纹。增量运行时，指纹未变且搜索数据中',
    '  已有该页面条目的，直接复用旧结果；否则才调用 LLM。缓存文件默认写在仓库根目录的',
    '  .summary-cache.json（已加入 .gitignore）。更换模型会使缓存整体失效。',
    '',
    '目录模式（--only 与 summary-list.txt 通用）：',
    '  · 匹配的是网站路径（如 /doc/policy/donate），不是 dist 中的文件路径；开头 / 可省略',
    '  · 通配符：* 不跨 /、** 跨层级、? 单字符；以 / 结尾等价于追加 /**',
    '  · 只写目录名（如 doc/policy）时，该目录及其下所有页面都会被纳入',
    '  · ! 前缀表示强制排除，排除始终优先；只写排除项时基准为全部可读页面',
    '',
    '示例：',
    '  node summary.js                                    # 交互式向导',
    '  node summary.js -y                                 # 全量更新（非交互）',
    '  node summary.js --incremental                      # 仅增量更新',
    '  node summary.js --only "doc/**,about"              # 仅更新指定目录',
    '  node summary.js --incremental --only "doc/**"      # 仅在指定目录增量更新',
    '  node summary.js --incremental --only "doc/**" -n   # 先看看会处理哪些页面',
  ].join('\n');
}

/**
 * 向导中的模式菜单项。
 * @type {Array<{ key: string, label: string, desc: string }>}
 */
const MODE_MENU = [
  { key: '1', label: '全量更新', desc: '重新总结所有命中名单的页面' },
  { key: '2', label: '仅增量更新', desc: '只重新总结内容有变化的页面，未变化的复用旧结果' },
  { key: '3', label: '仅更新指定目录', desc: '对指定的目录/页面做全量重新总结' },
  { key: '4', label: '仅在指定目录增量更新', desc: '对指定的目录/页面做增量更新' },
  { key: '5', label: '试运行（dry-run）', desc: '只列出将处理的页面，不调用 LLM、不写文件' },
  { key: '0', label: '退出', desc: '不执行任何操作' },
];

/**
 * 输出一行提问并读取回答（空回答时取默认值）。
 *
 * @param {import('node:readline/promises').Interface} rl readline 接口
 * @param {string} question 问题文本
 * @param {string} [defaultValue] 默认值
 * @returns {Promise<string>} 用户回答
 */
async function ask(rl, question, defaultValue = '') {
  const hint = defaultValue ? style.dim(`（默认 ${defaultValue}）`) : '';
  const answer = (await rl.question(`${style.cyan('?')} ${question}${hint}：`)).trim();
  return answer || defaultValue;
}

/**
 * 输出「是/否」提问并归一化回答。
 *
 * @param {import('node:readline/promises').Interface} rl readline 接口
 * @param {string} question 问题文本
 * @param {boolean} defaultValue 默认值
 * @returns {Promise<boolean>} 用户回答
 */
async function askYesNo(rl, question, defaultValue = true) {
  const hint = defaultValue ? 'Y/n' : 'y/N';
  for (;;) {
    const answer = (await rl.question(`${style.cyan('?')} ${question} [${hint}]：`)).trim().toLowerCase();
    if (!answer) return defaultValue;
    if (['y', 'yes', '是'].includes(answer)) return true;
    if (['n', 'no', '否'].includes(answer)) return false;
    console.log(style.yellow('  请输入 y 或 n。'));
  }
}

/**
 * 输出单选菜单并读取选择。
 *
 * @param {import('node:readline/promises').Interface} rl readline 接口
 * @param {string} title 菜单标题
 * @param {Array<{ key: string, label: string, desc: string }>} choices 选项列表
 * @param {string} defaultKey 默认选项 key
 * @returns {Promise<string>} 选中的 key
 */
async function askChoice(rl, title, choices, defaultKey) {
  console.log(`${style.cyan('?')} ${title}`);
  for (const choice of choices) {
    const key = choice.key === defaultKey ? style.green(choice.key) : style.dim(choice.key);
    const desc = choice.desc ? style.dim(`  —— ${choice.desc}`) : '';
    console.log(`    ${key}) ${choice.label}${desc}`);
  }

  const keys = choices.map((choice) => choice.key);
  for (;;) {
    const answer = (await rl.question(`  ${style.dim(`选择 [${defaultKey}]`)}：`)).trim();
    if (!answer) return defaultKey;
    if (keys.includes(answer)) return answer;
    console.log(style.yellow(`  请输入 ${keys.join(' / ')} 之一。`));
  }
}

/**
 * 向导的默认目录模式：直接沿用名单文件里的写法。
 *
 * @param {string} listPath 名单文件路径
 * @returns {string} 逗号分隔的模式串
 */
function defaultScopeValue(listPath) {
  const raw = readListFile(listPath);
  return raw.length ? raw.join(',') : 'doc/**';
}

/**
 * 打印向导抬头。
 */
function printBanner() {
  console.log('');
  console.log(style.bold('  栈流 Streack · 搜索建议生成器'));
  console.log(style.dim('  summary.js 交互模式 —— 用 LLM 汇总页面标题与搜索关键词'));
  console.log('');
}

/**
 * 打印即将执行的操作摘要。
 *
 * @param {object} options 运行时选项
 * @param {string} modeLabel 模式名称
 */
function printPlan(options, modeLabel) {
  console.log('');
  console.log(style.bold('  即将执行：'));
  console.log(`    模式      ${modeLabel}`);
  console.log(`    目录范围  ${options.only.length ? options.only.join(', ') : '（按名单文件）'}`);
  console.log(`    增量缓存  ${options.cachePath ?? '（未启用）'}`);
  console.log(`    输出文件  ${options.outputPath}`);
  console.log(`    写入文件  ${options.dryRun || options.noWrite ? '否' : '是'}`);
  console.log('');
}

/**
 * 运行交互式向导，返回补全后的选项。
 *
 * @param {object} options 已解析的选项（作为默认值）
 * @returns {Promise<object|null>} 补全后的选项；用户取消时返回 null
 */
export async function runWizard(options) {
  if (process.stdin.isTTY !== true) {
    console.log(style.yellow('当前环境不支持交互式输入（stdin 不是 TTY），已按默认全量模式继续。'));
    return { ...options, assumeYes: true };
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    printBanner();
    const mode = await askChoice(rl, '请选择运行模式', MODE_MENU, '1');
    if (mode === '0') {
      console.log('已取消。');
      return null;
    }

    /** @type {object} */
    const patch = { incremental: false, only: [], dryRun: false, replace: false, pretty: false, limit: 0 };

    if (mode === '2' || mode === '4') patch.incremental = true;
    if (mode === '5') patch.dryRun = true;

    if (mode === '3' || mode === '4') {
      const input = await ask(rl, '请输入目录/页面模式（逗号分隔，! 前缀表示排除）', defaultScopeValue(options.listPath));
      patch.only = splitPatterns(input);
      if (patch.only.length === 0) {
        console.log(style.yellow('  未输入任何模式，将按名单文件处理。'));
      }
    }

    if (mode !== '5') {
      patch.replace = await askYesNo(rl, '是否整体替换搜索数据（丢弃未覆盖的旧条目）', false);
      patch.pretty = await askYesNo(rl, '是否输出缩进格式的 JSON', false);
      patch.limit = Math.max(0, parseInt(await ask(rl, '最多处理多少个页面（0 表示不限制）', '0'), 10) || 0);
    }

    const next = { ...options, ...patch, interactive: true };
    printPlan(next, describeMode(next));

    if (!(await askYesNo(rl, '确认开始', true))) {
      console.log('已取消。');
      return null;
    }
    return next;
  } catch {
    console.log('\n' + style.yellow('已取消交互。'));
    return null;
  } finally {
    rl.close();
  }
}

/**
 * 由选项推导出「运行模式」的展示文案。
 *
 * @param {object} options 运行时选项
 * @returns {string} 模式名称
 */
export function describeMode(options) {
  const scoped = Array.isArray(options.only) && options.only.length > 0;
  if (options.dryRun) return '试运行（dry-run）';
  if (options.incremental) return scoped ? '仅在指定目录增量更新' : '仅增量更新';
  return scoped ? '仅更新指定目录' : '全量更新';
}
