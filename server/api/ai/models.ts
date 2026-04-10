import { defineEventHandler, readBody } from 'h3'

interface ModelOption {
  id: string
  label: string
}

interface ModelsResponsePayload {
  data?: unknown
  models?: unknown
}

function resolveModelsUrl(apiUrl: string): string {
  const trimmed = apiUrl.trim()
  if (!trimmed) {
    throw new Error('AI API地址不能为空')
  }

  const url = new URL(trimmed)
  const pathname = url.pathname.replace(/\/+$/, '')

  if (/\/v1\/models$/i.test(pathname)) {
    return url.toString()
  }

  if (/\/v1\/chat\/completions$/i.test(pathname)) {
    url.pathname = pathname.replace(/\/v1\/chat\/completions$/i, '/v1/models')
    return url.toString()
  }

  if (/\/v1\/messages$/i.test(pathname)) {
    url.pathname = pathname.replace(/\/v1\/messages$/i, '/v1/models')
    return url.toString()
  }

  throw new Error('AI API地址需填写为 /v1/chat/completions、/v1/messages 或 /v1/models')
}

function extractString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeModelOption(item: unknown): ModelOption | null {
  if (!item || typeof item !== 'object') {
    return null
  }

  const record = item as Record<string, unknown>
  const id = extractString(record.id) || extractString(record.model) || extractString(record.name)
  if (!id) {
    return null
  }

  const label = extractString(record.display_name)
    || extractString(record.name)
    || extractString(record.label)
    || extractString(record.model)
    || id

  return { id, label }
}

function extractModels(data: unknown): ModelOption[] {
  if (Array.isArray(data)) {
    return data
      .map(item => normalizeModelOption(item))
      .filter((item): item is ModelOption => !!item)
  }

  if (!data || typeof data !== 'object') {
    return []
  }

  const payload = data as ModelsResponsePayload & Record<string, unknown>
  const sources = [payload.data, payload.models, payload.items]

  for (const source of sources) {
    const models = extractModels(source)
    if (models.length > 0) {
      return models
    }
  }

  return []
}

function dedupeModels(models: ModelOption[]): ModelOption[] {
  const seen = new Set<string>()
  const result: ModelOption[] = []

  for (const model of models) {
    if (seen.has(model.id)) {
      continue
    }

    seen.add(model.id)
    result.push(model)
  }

  return result
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }
}

export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') {
    return { success: false, error: '不支持的请求方法' }
  }

  try {
    const body = await readBody(event) as { apiUrl?: string; apiKey?: string }
    const apiUrl = body.apiUrl?.trim() || ''
    const apiKey = body.apiKey?.trim() || ''

    if (!apiUrl) {
      return { success: false, error: '请先填写 AI API 地址' }
    }

    if (!apiKey) {
      return { success: false, error: '请先填写 AI API Key' }
    }

    const modelsUrl = resolveModelsUrl(apiUrl)
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: buildHeaders(apiKey),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `获取模型列表失败: HTTP ${response.status}${errorText ? ` - ${errorText}` : ''}` }
    }

    const data = await response.json() as unknown
    const models = dedupeModels(extractModels(data))

    if (models.length === 0) {
      return { success: false, error: '模型接口未返回可用模型列表' }
    }

    return {
      success: true,
      models,
      modelsUrl,
    }
  } catch (error: any) {
    return { success: false, error: error?.message || '获取模型列表失败' }
  }
})
