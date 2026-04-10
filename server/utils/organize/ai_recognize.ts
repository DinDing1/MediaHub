/**
 * AI 文件名识别服务。
 *
 * 作用：
 * - 当传统 TMDB 搜索无法稳定命中时，调用外部 AI 服务辅助识别影视条目
 * - 从噪声很重的文件名中提取作品标题、年份、类型以及可选 TMDB ID
 * - 为 organize 主流程提供“保守候选”，最终是否采用仍由上层做一致性与兼容性校验
 *
 * 当前支持的协议：
 * - OpenAI 风格：/v1/chat/completions
 * - Anthropic 风格：/v1/messages
 *
 * 设计原则：
 * - 优先保守，不鼓励模型硬猜 TMDB ID 或年份
 * - 优先相信本地已解析出的候选标题 / 年份 / 类型
 * - 对代理 / 中转服务的返回结构做宽松兼容，尽量避免因字段轻微差异导致解析失败
 */

import { getSetting } from '../db'
import { log } from '../logger'

/**
 * AI 识别后的标准结果。
 * 说明：
 * - title 优先保存英文原名；若模型无法可靠给出英文原名，也允许返回当前最可靠正式标题
 * - titleCn 若没有公认中文名，应与 title 保持一致
 * - year 不确定时允许为空字符串
 * - tmdbId 不确定时必须为 0
 */
interface AIRecognizeResult {
  title: string
  titleCn: string
  year: string
  mediaType: 'movie' | 'tv'
  tmdbId: number
  confidence: number
}

/**
 * 传给 AI 的辅助线索。
 * 这些信息来自本地文件名解析逻辑，优先级高于原始文件名中的噪声信息。
 */
interface AIRecognizeHints {
  title?: string
  fallbackQuery?: string | null
  year?: string | null
  mediaType?: 'movie' | 'tv'
  season?: number | null
  episode?: number | null
}

/**
 * OpenAI 风格 chat/completions 的典型响应。
 * 某些兼容网关会把 content 改成字符串数组或对象数组，因此这里用 unknown 放宽接收。
 */
interface ChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: unknown
    }
  }>
}

/**
 * Anthropic /v1/messages 及其常见代理变体响应。
 * - 官方通常是 content: [{ type: 'text', text: '...' }]
 * - 部分中转可能额外提供 output_text / completion / message.content
 */
interface MessagesResponse {
  content?: unknown
  output_text?: unknown
  completion?: unknown
  message?: {
    content?: unknown
  }
}

const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions'
const ANTHROPIC_VERSION = '2023-06-01'

/**
 * 给模型的系统级约束。
 * 重点不是“让模型尽量猜”，而是“让模型在不确定时保守返回”。
 */
const SYSTEM_PROMPT = `你是一个视频文件名识别专家，同时拥有丰富的影视知识库。你的任务是从带有大量噪声的媒体文件名中，识别出“作品本体”的信息。

你需要返回以下信息：
1. title: 媒体原始标题（优先英文原名；若无法确定英文原名，可返回当前最可靠的正式标题）
2. titleCn: 媒体中文标题（如果有公认中文名则返回；没有则与 title 保持一致）
3. year: 发行年份（4位数字；不确定时返回空字符串）
4. mediaType: 类型，只能是 "movie" 或 "tv"
5. tmdbId: TMDB ID（只有在非常确定时才填写；不确定时必须填 0）
6. confidence: 置信度（0-1之间的数字；不确定时应降低）

请严格按照以下JSON格式返回，不要包含任何其他内容：
{"title":"英文标题","titleCn":"中文标题","year":"年份","mediaType":"movie或tv","tmdbId":数字,"confidence":数字}

重要规则：
- 你的首要目标是识别“作品主标题”，不要被分辨率、片源、编码、音轨、发布组、平台名等噪声干扰
- 如果已给出“候选标题/备用搜索词/候选年份/候选类型”，这些线索的优先级高于原始文件名中的噪声信息
- 若候选标题已经像正式片名，应优先围绕该标题判断，不要联想成词形相近、词根相近、但并非同一作品的其他影视条目
- 对于只有1-3个英文单词的短标题，必须严格保留整词，不要随意扩写、截断或改写成其他作品
- 标题中的正式片名组成部分必须保留，例如 "The Series"、"+"、":"、"!" 前后的文字，除非能确定它们不是片名的一部分
- 如果是电视剧，返回剧名本身，不要包含季集信息、单集标题或集名
- 年份是作品首次发行年份；不确定时留空，不要猜测
- tmdbId 只有在你非常确定时才填写；只要存在疑问，一律返回 0
- 如果文件名中包含剧集标题（如 S01E01 后面的单集标题），请忽略单集标题
- 常见的视频规格关键词应该忽略：2160p, 1080p, 720p, WEB-DL, BluRay, REMUX, H264, H265, HEVC, DTS, DDP, Atmos, HDR, DV, ATVP, AMZN, NF 等
- 如果作品有中文译名，titleCn 请返回中文译名；没有则返回与 title 相同的内容
- 如果无法非常确定，请返回更保守的结果：保留候选标题、tmdbId=0、较低 confidence，而不是猜测一个看似相近但错误的作品`

/**
 * 去掉文件扩展名，减少 .mkv / .mp4 等后缀对模型的干扰。
 */
function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

/**
 * 根据 URL 判断当前是否应走 /v1/messages 协议。
 * 仅根据路径判断，避免额外引入配置项。
 */
function isMessagesApiUrl(apiUrl: string): boolean {
  return /\/v1\/messages\/?(?:\?.*)?$/i.test(apiUrl.trim())
}

/**
 * 构造请求头。
 * - /v1/messages 优先使用 Anthropic 规范头
 * - /v1/chat/completions 使用常见 Bearer 头
 */
function buildHeaders(apiKey: string, useMessagesApi: boolean): Record<string, string> {
  if (useMessagesApi) {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    }
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
}

/**
 * 构造用户提示词。
 *
 * 输入同时包含：
 * - 原始完整文件名
 * - 去扩展名后的文件名
 * - 本地预解析得到的 hints
 *
 * 这样既保留完整上下文，又能明确告诉模型应优先相信哪些线索。
 */
function buildUserPrompt(fileName: string, hints: AIRecognizeHints = {}): string {
  const lines = [
    `原始文件名：${fileName}`,
    `去扩展名文件名：${stripFileExtension(fileName)}`,
    hints.title ? `候选标题：${hints.title}` : '',
    hints.fallbackQuery && hints.fallbackQuery !== hints.title ? `备用搜索词：${hints.fallbackQuery}` : '',
    hints.year ? `候选年份：${hints.year}` : '',
    hints.mediaType ? `候选类型：${hints.mediaType}` : '',
    hints.season ? `候选季：S${String(hints.season).padStart(2, '0')}` : '',
    hints.episode ? `候选集：E${String(hints.episode).padStart(2, '0')}` : '',
    '请先识别作品主标题，再补充年份、类型和 TMDB ID。',
    '若候选标题已经合理，请优先保持该标题，不要改写成相似但不同的作品。',
    '若不确定，请返回保守结果：tmdbId=0，并降低 confidence。',
  ].filter(Boolean)

  return `${lines.join('\n')}\n\n请只返回 JSON。`
}

/**
 * 按协议构造请求体。
 * - /v1/messages 使用独立 system 字段
 * - /v1/chat/completions 把 system 放入 messages 数组
 */
function buildRequestBody(fileName: string, hints: AIRecognizeHints, model: string, useMessagesApi: boolean): string {
  const userPrompt = buildUserPrompt(fileName, hints)

  if (useMessagesApi) {
    return JSON.stringify({
      model,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        }
      ],
      temperature: 0.1,
      max_tokens: 300,
    })
  }

  return JSON.stringify({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 300,
  })
}

/**
 * 从任意响应字段中尽量提取纯文本。
 *
 * 兼容场景：
 * - string
 * - [{ type: 'text', text: '...' }]
 * - [{ text: '...' }]
 * - { text: '...' }
 * - { content: '...' }
 * - { content: [...] }
 * - 部分代理返回的 { value: '...' } / { output_text: '...' }
 */
function extractText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return value
      .map(item => extractText(item))
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  if (!value || typeof value !== 'object') {
    return ''
  }

  const record = value as Record<string, unknown>

  if (typeof record.text === 'string') {
    return record.text.trim()
  }

  if (typeof record.content === 'string') {
    return record.content.trim()
  }

  if (typeof record.value === 'string') {
    return record.value.trim()
  }

  if (typeof record.output_text === 'string') {
    return record.output_text.trim()
  }

  if (record.content) {
    const nestedContent = extractText(record.content)
    if (nestedContent) {
      return nestedContent
    }
  }

  if (record.message) {
    const nestedMessage = extractText(record.message)
    if (nestedMessage) {
      return nestedMessage
    }
  }

  return ''
}

/**
 * 从不同协议、不同代理实现的响应中提取最终文本。
 *
 * /v1/messages 常见变体：
 * - response.content
 * - response.output_text
 * - response.completion
 * - response.message.content
 *
 * chat/completions 常见变体：
 * - choices[0].message.content
 * - 少量代理也可能额外给出 output_text / content
 */
function extractResponseContent(data: unknown, useMessagesApi: boolean): string {
  if (!data || typeof data !== 'object') {
    return ''
  }

  if (useMessagesApi) {
    const response = data as MessagesResponse

    return extractText(response.output_text)
      || extractText(response.content)
      || extractText(response.completion)
      || extractText(response.message?.content)
      || ''
  }

  const response = data as ChatCompletionsResponse & Record<string, unknown>

  return extractText(response.choices?.[0]?.message?.content)
    || extractText(response.output_text)
    || extractText(response.content)
    || ''
}

/**
 * 调用外部 AI 服务。
 *
 * 注意：
 * - 这里只负责“调用 + 解析 + 基础字段清洗”
 * - 最终是否采纳 AI 结果，不在本文件决定，而由 organize 主流程进一步校验
 */
async function callSiliconFlowAPI(fileName: string, hints: AIRecognizeHints = {}): Promise<AIRecognizeResult | null> {
  const apiKey = getSetting('ai_api_key')
  const apiUrl = getSetting('ai_api_url') || SILICONFLOW_API_URL
  const model = getSetting('ai_model') || 'Qwen/Qwen2.5-7B-Instruct'

  if (!apiKey) {
    log.warn('AI识别', '未配置AI API Key')
    return null
  }

  const useMessagesApi = isMessagesApiUrl(apiUrl)

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: buildHeaders(apiKey, useMessagesApi),
      body: buildRequestBody(fileName, hints, model, useMessagesApi),
    })

    if (!response.ok) {
      const errorText = await response.text()
      log.error('AI识别', `API请求失败: ${response.status} - ${errorText}`)
      return null
    }

    const data = await response.json() as unknown
    const content = extractResponseContent(data, useMessagesApi)

    if (!content) {
      log.error('AI识别', 'API返回内容为空')
      return null
    }

    const jsonMatch = content.match(/\{[^{}]+\}/s)
    if (!jsonMatch) {
      log.error('AI识别', `无法解析JSON: ${content}`)
      return null
    }

    const result = JSON.parse(jsonMatch[0]) as AIRecognizeResult

    if (!result.title && !result.titleCn) {
      log.error('AI识别', 'AI返回结果缺少标题')
      return null
    }

    if (!result.mediaType) {
      log.error('AI识别', 'AI返回结果缺少类型')
      return null
    }

    result.title = result.title || result.titleCn || ''
    result.titleCn = result.titleCn || result.title || ''
    result.year = result.year || ''
    result.tmdbId = result.tmdbId || 0
    result.confidence = result.confidence || 0.5

    return result
  } catch (e: any) {
    log.error('AI识别', `API调用异常: ${e.message}`)
    return null
  }
}

/**
 * AI 识别主入口。
 *
 * 行为：
 * - 先检查 AI 功能开关
 * - 再调用外部接口获取候选结果
 * - 对置信度做最基础的拦截
 *
 * 说明：
 * - 这里不会直接保证结果正确，只保证结果“像一个可用候选”
 * - 更严格的标题一致性、年份一致性、TMDB 兼容性校验由上层负责
 */
export async function aiRecognizeFileName(fileName: string, hints: AIRecognizeHints = {}): Promise<AIRecognizeResult | null> {
  const enabled = getSetting('ai_recognize_enabled') === 'true'

  if (!enabled) {
    return null
  }

  const result = await callSiliconFlowAPI(fileName, hints)

  if (!result) {
    return null
  }

  if (result.confidence < 0.5) {
    log.warn('AI识别', `AI识别置信度过低: ${result.confidence}`)
    return null
  }

  log.info('AI识别', `AI识别: ${result.titleCn || result.title} (${result.year}) [${result.mediaType}]`)

  return result
}

/**
 * 判断 AI 识别功能是否可用。
 * 需要同时满足：
 * - 已启用 AI 识别开关
 * - 已配置 API Key
 */
export function isAIRecognizeEnabled(): boolean {
  return getSetting('ai_recognize_enabled') === 'true' && !!getSetting('ai_api_key')
}
