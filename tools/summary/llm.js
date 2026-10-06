/**
 * llm.js — 模型构建与单页总结
 *
 * 密钥配置来自仓库根目录的 secret.json（已被 .gitignore 忽略）：
 *   {
 *     "apiKey": "sk-...",                     // OpenAI 格式的密钥（必填）
 *     "baseURL": "https://api.openai.com/v1", // API 地址（可选，缺省为 OpenAI 官方）
 *     "model": "gpt-4o-mini",                 // 模型名（可选）
 *     "useStreamAPI": false,                  // 是否使用流式（Stream）输出
 *     "useResponseAPI": false                 // 是否使用 Response API（否则 Chat Completions）
 *   }
 * 也兼容写成数组 [{...}]（取第一项）；baseURL 可指向任意 OpenAI 兼容端点（如 DeepSeek）。
 */

import { existsSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';

import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, streamObject, generateText } from 'ai';

/** 送入 LLM 的正文截断长度 */
export const MAX_INPUT_CHARS = 6000;

/** secret.json 的结构 */
const SecretSchema = z.object({
  apiKey: z.string().min(1, 'apiKey 不能为空'),
  baseURL: z.string().url('baseURL 需为合法 URL').optional(),
  model: z.string().min(1).default('gpt-4o-mini'),
  useStreamAPI: z.boolean().default(false),
  useResponseAPI: z.boolean().default(false),
});

/** LLM 结构化输出：全文概要 + 搜索关键词（标题不由 LLM 生成，取自页面真实标题） */
const ResultSchema = z.object({
  summary: z.string().describe('该页面的全文概要，用 2～3 句中文概括页面主要内容'),
  keywords: z
    .array(z.string())
    .min(1)
    .describe('用于站内搜索匹配的关键词与同义词，中英文混合，按相关性从高到低排列'),
});

const SYSTEM_PROMPT = [
  '你是网站内容编辑。请阅读给定的网页可见正文，为该页面撰写一段全文概要（2～3 句中文），',
  '并给出一组用于站内搜索匹配的关键词/同义词（覆盖主题、别名、常见叫法，中英文兼顾）。',
  '关键词应尽量避免与站点通用导航/品牌重复（例如“栈流”“Streack”“搜索”“文档”“首页”等），',
  '并只依据给定内容，不要编造页面中不存在的信息。',
].join('');

const JSON_ONLY_INSTRUCTION =
  '\n\n请只输出一个 JSON 对象，形如 {"summary":"...","keywords":["...","..."]}，不要输出任何解释或多余文字。';

/**
 * 读取并校验 secret.json。
 *
 * @param {string} secretPath secret.json 绝对路径
 * @param {string} root 仓库根目录（仅用于提示更友好的相对路径）
 * @returns {{ ok: true, config: z.infer<typeof SecretSchema> } | { ok: false, issues: string[] }}
 */
export function loadSecret(secretPath, root) {
  if (!existsSync(secretPath)) {
    return {
      ok: false,
      issues: [`未找到 ${relative(root, secretPath)}，请先创建该文件（参见脚本头部说明）`],
    };
  }

  let json;
  try {
    json = JSON.parse(readFileSync(secretPath, 'utf8'));
  } catch (err) {
    return { ok: false, issues: [`secret.json 不是合法 JSON：${err.message}`] };
  }

  // 兼容数组写法：[{...}]，取第一项
  if (Array.isArray(json)) {
    if (json.length === 0) return { ok: false, issues: ['secret.json 为空数组，未提供任何配置'] };
    if (json.length > 1) console.warn(`[summary] secret.json 含 ${json.length} 项配置，仅使用第一项。`);
    json = json[0];
  }

  const parsed = SecretSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    };
  }
  return { ok: true, config: parsed.data };
}

/**
 * 依配置选择模型实例（Chat Completions vs Responses API）。
 *
 * @param {ReturnType<typeof createOpenAI>} provider OpenAI 兼容 provider
 * @param {z.infer<typeof SecretSchema>} config 密钥配置
 * @returns {object} 模型实例
 */
export function buildModel(provider, config) {
  return config.useResponseAPI ? provider.responses(config.model) : provider(config.model);
}

/**
 * 创建 OpenAI 兼容 provider。
 *
 * @param {z.infer<typeof SecretSchema>} config 密钥配置
 * @returns {ReturnType<typeof createOpenAI>} provider 实例
 */
export function createProvider(config) {
  return createOpenAI({
    apiKey: config.apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });
}

/**
 * 重试包装：任意异常重试 `attempts` 次（递增退避）。
 *
 * @template T
 * @param {() => Promise<T>} fn 待执行函数
 * @param {number} [attempts] 总尝试次数
 * @returns {Promise<T>} 执行结果
 */
async function withRetry(fn, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts) await new Promise((resolve) => setTimeout(resolve, 400 * i));
    }
  }
  throw lastErr;
}

/**
 * 从模型输出中提取第一个 JSON 对象（兼容 ```json 代码块与夹杂文字）。
 *
 * @param {string} text 模型输出
 * @returns {any} 解析出的对象
 */
function extractJson(text) {
  const fenced = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1] : String(text);
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('响应中未找到 JSON 对象');
  return JSON.parse(source.slice(start, end + 1));
}

/**
 * 对单个页面调用 LLM，返回 `{ summary, keywords }`。
 *
 * 策略：优先结构化输出（generateObject / streamObject）；若端点（如部分 OpenAI 兼容服务）
 * 结构化输出不稳定导致解析失败，则回退为纯文本 + 提取 JSON + zod 校验。整体带重试。
 *
 * @param {{ link: string, title: string, rawTitle: string, text: string }} page 页面对象
 * @param {object} model 模型实例
 * @param {z.infer<typeof SecretSchema>} config 密钥配置
 * @returns {Promise<z.infer<typeof ResultSchema>>} LLM 结果
 */
export async function summarizePage(page, model, config) {
  const prompt =
    `文章标题：${page.title || page.rawTitle || '(无)'}\n` +
    `页面链接：${page.link}\n\n` +
    `页面可见正文：\n${page.text.slice(0, MAX_INPUT_CHARS)}`;

  return withRetry(async () => {
    try {
      if (config.useStreamAPI) {
        const result = streamObject({ model, schema: ResultSchema, system: SYSTEM_PROMPT, prompt });
        return await result.object;
      }
      const { object } = await generateObject({ model, schema: ResultSchema, system: SYSTEM_PROMPT, prompt });
      return object;
    } catch {
      // 回退：自由文本 + 提取 JSON + zod 校验
      const { text } = await generateText({
        model,
        system: SYSTEM_PROMPT,
        prompt: prompt + JSON_ONLY_INSTRUCTION,
      });
      return ResultSchema.parse(extractJson(text));
    }
  }, 3);
}
