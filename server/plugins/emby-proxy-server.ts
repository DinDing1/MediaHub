import { createHash } from 'crypto'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Readable } from 'stream'
import { getSetting } from '../utils/db'
import { log } from '../utils/logger'
import { getDirectLink } from '../utils/pan115/direct_link_115'

/**
 * Emby 反代的基础超时与缓存策略。
 *
 * 设计目标：
 * 1. 普通请求尽量少干预，优先保证登录与页面初始化稳定。
 * 2. 媒体请求尽量走最短链路，优先命中 302，提高首播与重复播放速度。
 * 3. 缓存只做短时加速，不做长期持久化，避免旧链接残留太久。
 */
const API_TIMEOUT = 30000
const REDIRECT_RESOLVE_TIMEOUT = 10000
const PLAYBACK_INFO_CACHE_TTL_MS = 90000
const PLAYBACK_URL_CACHE_TTL_MS = 45000
const PLAYBACK_STRM_CACHE_TTL_MS = 300000
const CACHE_HIT_LOG_THROTTLE_MS = 5000
const MAX_CACHE_SIZE = 500

/**
 * Emby 常见媒体直链路由。
 *
 * 这里只匹配真正可能进入播放链路的接口，后续再结合名称排除字幕、附加内容等非主媒体请求。
 */
const MEDIA_ROUTE_PATTERNS = [
  /^\/audio\/([^/]+)\/([^/?#]+)/i,
  /^\/emby\/audio\/([^/]+)\/([^/?#]+)/i,
  /^\/videos\/([^/]+)\/([^/?#]+)/i,
  /^\/emby\/videos\/([^/]+)\/([^/?#]+)/i,
  /^\/items\/([^/]+)\/download$/i,
  /^\/emby\/items\/([^/]+)\/download$/i,
  /^\/items\/([^/]+)\/file$/i,
  /^\/emby\/items\/([^/]+)\/file$/i,
  /^\/sync\/jobitems\/([^/]+)\/file$/i,
  /^\/emby\/sync\/jobitems\/([^/]+)\/file$/i
]

const NON_MEDIA_NAMES = new Set([
  'additionalparts',
  'subtitles',
  'similar',
  'thememedia',
  'themevideos',
  'themesongs',
  'specialfeatures',
  'linkeditems'
])

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade'
])

const CACHE_KEY_HEADERS = [
  'authorization',
  'cookie',
  'x-emby-token',
  'x-emby-authorization',
  'user-agent',
  'x-emby-device-id',
  'x-emby-device-name',
  'x-emby-client',
  'x-emby-client-version',
  'x-device-id',
  'x-device-name',
  'x-client'
]

const EMBY_AUTH_TOKEN_RE = /Token="([^"]+)"/i

interface ProxySettings {
  embyUrl: string
  embyApiKey: string
  enabled: boolean
}

interface MediaSource {
  Id?: string
  Path?: string
  DirectStreamUrl?: string
  [key: string]: any
}

/**
 * PlaybackInfo 是给反代内部使用的最小媒体源信息结构。
 *
 * 这里不再像重型版本那样对外改写 PlaybackInfo 响应，
 * 只在媒体请求到来时，内部查询一次 Emby，用来判断当前条目最终能否走 302。
 */
interface PlaybackInfoResponse {
  MediaSources?: MediaSource[]
  [key: string]: any
}

/**
 * 通用缓存项结构。
 * value 为缓存值，expiresAt 为过期时间戳。
 */
interface CacheEntry<T> {
  value: T
  expiresAt: number
}

/**
 * 三类短时内存缓存：
 * 1. playbackInfoCache：缓存 Emby PlaybackInfo，减少短时间重复查询。
 * 2. playbackUrlCache：缓存“某次媒体请求最终应 302 到哪里”，直接加速重复播放/seek/range。
 * 3. strmSourceCache：缓存从 PlaybackInfo 中提取到的远程 HTTP / d115 源路径。
 *
 * 注意：这些缓存都只存在于当前 Node 进程内，不落盘，重启即失效。
 */
const playbackInfoCache = new Map<string, CacheEntry<PlaybackInfoResponse>>()
const playbackUrlCache = new Map<string, CacheEntry<string>>()
const strmSourceCache = new Map<string, CacheEntry<Record<string, string>>>()

/**
 * 缓存命中日志节流表。
 *
 * 播放器在播放、拖动、重试时会短时间反复请求同一资源，
 * 如果每次命中都打日志，会严重刷屏，因此按 cache key 做节流。
 */
const cacheHitLogTimestamps = new Map<string, number>()

let server: ReturnType<typeof createServer> | null = null

function getProxySettings(): ProxySettings {
  return {
    embyUrl: (getSetting('emby_base_url') || '').trim().replace(/\/$/, ''),
    embyApiKey: (getSetting('emby_api_key') || '').trim(),
    enabled: getSetting('emby_proxy_enabled') === 'true'
  }
}

function getRequestUrl(req: IncomingMessage): URL {
  return new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
}

function getRequestHeaders(req: IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {}

  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      headers[key] = value
    } else if (Array.isArray(value) && value.length > 0) {
      headers[key] = value[0] || ''
    }
  }

  return headers
}

function hasBody(method?: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes((method || 'GET').toUpperCase())
}

async function readRequestBody(req: IncomingMessage): Promise<Uint8Array | undefined> {
  if (!hasBody(req.method)) {
    return undefined
  }

  const chunks: Uint8Array[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) {
    return undefined
  }

  return Buffer.concat(chunks)
}

function getFetchRequestBody(body: Uint8Array | undefined): ArrayBuffer | undefined {
  if (!body) {
    return undefined
  }

  return Uint8Array.from(body).buffer
}

function isAuthPath(path: string): boolean {
  return /^\/(emby\/)?users\/authenticatebyname$/i.test(path)
}

function getMediaRouteMatch(path: string): { itemId: string, name: string } | null {
  for (const pattern of MEDIA_ROUTE_PATTERNS) {
    const match = path.match(pattern)
    if (match?.[1]) {
      return {
        itemId: match[1],
        name: match[2] || ''
      }
    }
  }

  return null
}

function buildTargetUrl(embyUrl: string, path: string, query: URLSearchParams): string {
  const queryString = query.toString()
  return queryString ? `${embyUrl}${path}?${queryString}` : `${embyUrl}${path}`
}

function extractApiKey(query: URLSearchParams, requestHeaders: Record<string, string>, fallbackApiKey: string): string {
  const queryApiKey = query.get('api_key') || query.get('X-Emby-Token') || query.get('x-emby-token')
  if (queryApiKey) {
    return queryApiKey
  }

  const headerApiKey = requestHeaders['x-emby-token'] || requestHeaders['X-Emby-Token']
  if (headerApiKey) {
    return headerApiKey
  }

  const authHeader = requestHeaders['x-emby-authorization'] || requestHeaders['X-Emby-Authorization'] || requestHeaders.authorization || requestHeaders.Authorization
  if (authHeader) {
    const match = authHeader.match(EMBY_AUTH_TOKEN_RE)
    if (match?.[1]) {
      return match[1]
    }
  }

  return fallbackApiKey
}

function buildForwardHeaders(
  requestHeaders: Record<string, string>,
  options: {
    stripAcceptEncoding?: boolean
    contentLength?: number
    fallbackApiKey?: string
  } = {}
): Record<string, string> {
  const headers: Record<string, string> = {}

  for (const [key, value] of Object.entries(requestHeaders)) {
    const lowerKey = key.toLowerCase()
    if (lowerKey === 'host' || lowerKey === 'content-length' || HOP_BY_HOP_HEADERS.has(lowerKey)) {
      continue
    }
    if (options.stripAcceptEncoding && lowerKey === 'accept-encoding') {
      continue
    }
    headers[key] = value
  }

  if (options.stripAcceptEncoding) {
    headers['Accept-Encoding'] = 'identity'
  }

  const hasToken = Object.keys(headers).some(key => key.toLowerCase() === 'x-emby-token')
  if (options.fallbackApiKey && !hasToken) {
    headers['X-Emby-Token'] = options.fallbackApiKey
  }

  if (typeof options.contentLength === 'number') {
    headers['Content-Length'] = String(options.contentLength)
  }

  return headers
}

function getHeaderHash(requestHeaders: Record<string, string>): string {
  const parts: string[] = []

  for (const headerName of CACHE_KEY_HEADERS) {
    const matchedKey = Object.keys(requestHeaders).find(key => key.toLowerCase() === headerName)
    if (matchedKey && requestHeaders[matchedKey]) {
      parts.push(`${headerName}:${requestHeaders[matchedKey]}`)
    }
  }

  return createHash('sha256').update(parts.join('\n')).digest('hex')
}

function getPlaybackInfoCacheKey(itemId: string, mediaSourceId: string, requestHeaders: Record<string, string>): string {
  return `${itemId}:${mediaSourceId}:${getHeaderHash(requestHeaders)}`
}

function getPlaybackUrlCacheKey(itemId: string, mediaSourceId: string, requestHeaders: Record<string, string>): string {
  return `${itemId}:${mediaSourceId}:${getHeaderHash(requestHeaders)}`
}

function getStrmSourceCacheKey(itemId: string, requestHeaders: Record<string, string>): string {
  return `${itemId}:${getHeaderHash(requestHeaders)}`
}

function getCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key)
  if (!entry) {
    return undefined
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return undefined
  }

  return entry.value
}

function setCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number): void {
  const now = Date.now()

  for (const [cacheKey, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(cacheKey)
    }
  }

  while (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value
    if (!oldestKey) {
      break
    }
    cache.delete(oldestKey)
  }

  cache.set(key, {
    value,
    expiresAt: now + ttlMs
  })
}

function shouldLogCacheHit(key: string): boolean {
  const now = Date.now()
  const lastLoggedAt = cacheHitLogTimestamps.get(key) || 0

  if (now - lastLoggedAt < CACHE_HIT_LOG_THROTTLE_MS) {
    return false
  }

  cacheHitLogTimestamps.set(key, now)
  return true
}

/**
 * 从 /api/d115/... 或 /d115/... 路径中提取 pickcode 与文件名。
 *
 * 这里只负责解析路径，不负责访问 115；真正取最终下载地址仍交给 getDirectLink()。
 */
function extractPickcodeAndName(path: string): { pickcode: string, fileName: string } | null {
  if (!path.includes('/d115/')) {
    return null
  }

  const parts = path.split('/d115/')
  if (parts.length < 2) {
    return null
  }

  const payload = parts[1]
  if (!payload) {
    return null
  }

  let pickcode = ''
  let fileName = ''

  if (payload.includes('pickcode=')) {
    const afterPickcode = payload.split('pickcode=')[1]
    if (!afterPickcode) {
      return null
    }

    const segments = afterPickcode.split('/')
    pickcode = segments[0] || ''
    if (segments.length > 1) {
      fileName = decodeURIComponent(segments.slice(1).join('/'))
    }
  } else {
    const segments = payload.split('/')
    pickcode = segments[0] || ''
    if (segments.length > 1) {
      fileName = decodeURIComponent(segments.slice(1).join('/'))
    }
  }

  if (!pickcode) {
    return null
  }

  if (pickcode.includes('?')) {
    pickcode = pickcode.split('?')[0] || ''
  }

  return { pickcode, fileName }
}

function getMediaSourceHttpPath(source: MediaSource | undefined): string {
  if (!source) {
    return ''
  }

  const path = typeof source.Path === 'string' ? source.Path : ''
  if (path) {
    return path
  }

  const directStreamUrl = typeof source.DirectStreamUrl === 'string' ? source.DirectStreamUrl : ''
  if (directStreamUrl.startsWith('http://') || directStreamUrl.startsWith('https://')) {
    return directStreamUrl
  }

  return ''
}

function isRemoteHttpSource(source: MediaSource | undefined): boolean {
  const sourcePath = getMediaSourceHttpPath(source)
  if (!sourcePath) {
    return false
  }

  if (sourcePath.includes('/d115/')) {
    return true
  }

  return sourcePath.startsWith('http://') || sourcePath.startsWith('https://')
}

function clonePlaybackInfo<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function collectStrmSources(playbackInfo: PlaybackInfoResponse | null): Record<string, string> {
  const sources = Array.isArray(playbackInfo?.MediaSources) ? playbackInfo.MediaSources : []
  const result: Record<string, string> = {}

  for (const source of sources) {
    if (!isRemoteHttpSource(source) || !source?.Id) {
      continue
    }

    const sourcePath = getMediaSourceHttpPath(source)
    if (sourcePath) {
      result[source.Id] = sourcePath
    }
  }

  return result
}

function getPreferredSource(playbackInfo: PlaybackInfoResponse | null, mediaSourceId: string): MediaSource | null {
  const sources = Array.isArray(playbackInfo?.MediaSources) ? playbackInfo.MediaSources : []
  if (!sources.length) {
    return null
  }

  if (mediaSourceId) {
    const matched = sources.find(source => source?.Id === mediaSourceId)
    if (matched) {
      return matched
    }
  }

  return sources.find(source => isRemoteHttpSource(source)) || sources[0] || null
}

function buildCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range, X-Emby-Token, X-Emby-Authorization',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    'Access-Control-Max-Age': '86400'
  }
}

function buildRedirectHeaders(location: string): Record<string, string> {
  return {
    Location: location,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range, X-Emby-Token, X-Emby-Authorization',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Accept-Ranges': 'bytes'
  }
}

function getResponseHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {}

  response.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(lowerKey)) {
      return
    }
    if (lowerKey === 'set-cookie' || lowerKey === 'content-length' || lowerKey === 'content-encoding') {
      return
    }
    headers[key] = value
  })

  return headers
}

async function writeResponse(
  req: IncomingMessage,
  res: ServerResponse,
  response: Response,
  bodyOverride?: Uint8Array,
  extraHeaders: Record<string, string> = {}
): Promise<void> {
  const headers = {
    ...getResponseHeaders(response),
    ...extraHeaders
  }

  if (bodyOverride) {
    headers['Content-Length'] = String(bodyOverride.byteLength)
  }

  const setCookies = typeof (response.headers as any).getSetCookie === 'function'
    ? ((response.headers as any).getSetCookie() as string[])
    : []

  if (setCookies.length > 0) {
    res.setHeader('Set-Cookie', setCookies)
  }

  res.writeHead(response.status, headers)

  if (req.method === 'HEAD' || response.status === 204 || response.status === 304) {
    res.end()
    return
  }

  if (bodyOverride) {
    res.end(Buffer.from(bodyOverride))
    return
  }

  if (!response.body) {
    res.end()
    return
  }

  const bodyStream = Readable.fromWeb(response.body as any)
  await new Promise<void>((resolve, reject) => {
    bodyStream.on('data', chunk => {
      res.write(chunk)
    })
    bodyStream.on('end', () => {
      res.end()
      resolve()
    })
    bodyStream.on('error', error => {
      reject(error)
    })
    res.on('close', () => {
      bodyStream.destroy()
      resolve()
    })
  })
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(API_TIMEOUT)
  })
}

async function resolveRedirectUrl(url: string, requestHeaders: Record<string, string>): Promise<string> {
  const headers = buildForwardHeaders(requestHeaders, { stripAcceptEncoding: true })

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(REDIRECT_RESOLVE_TIMEOUT)
    })
    return response.url || url
  } catch {}

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(REDIRECT_RESOLVE_TIMEOUT)
    })
    const finalUrl = response.url || url
    await response.body?.cancel().catch(() => undefined)
    return finalUrl
  } catch {
    return url
  }
}

/**
 * 请求 Emby PlaybackInfo。
 *
 * 用途：
 * - 不对外暴露、不改写原始 PlaybackInfo 响应。
 * - 仅在反代内部用它判断当前媒体是否为远程 HTTP / d115 源。
 * - 结果会做短时缓存，避免首播后的短时间重复查询。
 */
async function requestPlaybackInfo(
  embyUrl: string,
  apiKey: string,
  itemId: string,
  mediaSourceId: string,
  requestHeaders: Record<string, string>
): Promise<PlaybackInfoResponse | null> {
  const cacheKey = getPlaybackInfoCacheKey(itemId, mediaSourceId, requestHeaders)
  const cached = getCacheValue(playbackInfoCache, cacheKey)
  if (cached) {
    return clonePlaybackInfo(cached)
  }

  const requestBody: Record<string, any> = {
    EnableDirectPlay: true,
    EnableDirectStream: true,
    EnableTranscoding: false
  }

  if (mediaSourceId) {
    requestBody.MediaSourceId = mediaSourceId
  }

  const requestBodyText = JSON.stringify(requestBody)
  const headers = buildForwardHeaders(requestHeaders, {
    stripAcceptEncoding: true,
    fallbackApiKey: apiKey,
    contentLength: Buffer.byteLength(requestBodyText)
  })
  headers['Content-Type'] = 'application/json'
  headers.Accept = 'application/json'

  try {
    const response = await fetchWithTimeout(`${embyUrl}/Items/${itemId}/PlaybackInfo`, {
      method: 'POST',
      headers,
      body: requestBodyText,
      redirect: 'follow'
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json() as PlaybackInfoResponse
    setCacheValue(playbackInfoCache, cacheKey, clonePlaybackInfo(data), PLAYBACK_INFO_CACHE_TTL_MS)
    return data
  } catch {
    return null
  }
}

/**
 * 尝试把媒体请求直接转换为 302。
 *
 * 核心流程：
 * 1. 判断是否为真正的媒体播放请求，排除字幕、附加内容、m3u8 等非目标请求。
 * 2. 先查 playbackUrlCache，命中则直接 302，避免重复解析。
 * 3. 未命中时，内部请求 PlaybackInfo，提取可播放的远程 HTTP / d115 源。
 * 4. 若是 d115 源，则调用 getDirectLink() 获取 115 最终下载地址。
 * 5. 若是普通远程 HTTP 源，则解析最终跳转地址。
 * 6. 成功后写入短时缓存并返回 302；失败则回退到普通上游代理。
 */
async function tryHandleMediaRequest(
  res: ServerResponse,
  settings: ProxySettings,
  path: string,
  query: URLSearchParams,
  requestHeaders: Record<string, string>
): Promise<boolean> {
  const startedAt = Date.now()
  const mediaRoute = getMediaRouteMatch(path)
  if (!mediaRoute) {
    return false
  }

  if (mediaRoute.name && NON_MEDIA_NAMES.has(mediaRoute.name.toLowerCase())) {
    return false
  }

  if (mediaRoute.name.toLowerCase().endsWith('.m3u8')) {
    return false
  }

  const apiKey = extractApiKey(query, requestHeaders, settings.embyApiKey)
  const mediaSourceId = query.get('MediaSourceId') || ''
  const playbackUrlCacheKey = getPlaybackUrlCacheKey(mediaRoute.itemId, mediaSourceId, requestHeaders)
  const cachedFinalUrl = getCacheValue(playbackUrlCache, playbackUrlCacheKey)

  if (cachedFinalUrl) {
    if (shouldLogCacheHit(`playback-url:${playbackUrlCacheKey}`)) {
      log.info('Emby反代', `Playback URL 缓存命中: ${mediaRoute.itemId} (${Date.now() - startedAt}ms)`)
    }
    res.writeHead(302, buildRedirectHeaders(cachedFinalUrl))
    res.end()
    return true
  }

  const playbackInfo = await requestPlaybackInfo(settings.embyUrl, apiKey, mediaRoute.itemId, mediaSourceId, requestHeaders)
  const strmSources = collectStrmSources(playbackInfo)
  if (Object.keys(strmSources).length > 0) {
    setCacheValue(strmSourceCache, getStrmSourceCacheKey(mediaRoute.itemId, requestHeaders), strmSources, PLAYBACK_STRM_CACHE_TTL_MS)
  }

  let httpPath = getMediaSourceHttpPath(getPreferredSource(playbackInfo, mediaSourceId) || undefined)

  if (!httpPath) {
    const cachedStrmSources = getCacheValue(strmSourceCache, getStrmSourceCacheKey(mediaRoute.itemId, requestHeaders))
    if (cachedStrmSources) {
      httpPath = mediaSourceId ? (cachedStrmSources[mediaSourceId] || '') : (Object.values(cachedStrmSources)[0] || '')
      if (httpPath && shouldLogCacheHit(`strm-source:${mediaRoute.itemId}:${mediaSourceId || 'default'}`)) {
        log.info('Emby反代', `STRM 源缓存命中: ${mediaRoute.itemId}`)
      }
    }
  }

  if (!httpPath) {
    return false
  }

  const d115Info = extractPickcodeAndName(httpPath)
  if (d115Info) {
    const userAgent = requestHeaders['user-agent'] || 'Emby/4.8.8.0'
    const displayName = d115Info.fileName || d115Info.pickcode
    const result = await getDirectLink(d115Info.pickcode, userAgent, false, displayName)

    if (!result.success || !result.url) {
      log.warn('Emby反代', `115 直链解析失败，回退上游代理: ${displayName}`)
      return false
    }

    setCacheValue(playbackUrlCache, playbackUrlCacheKey, result.url, PLAYBACK_URL_CACHE_TTL_MS)
    log.success('Emby反代', `302播放: ${result.fileName || displayName} (${Date.now() - startedAt}ms)`)
    res.writeHead(302, buildRedirectHeaders(result.url))
    res.end()
    return true
  }

  if (!httpPath.startsWith('http://') && !httpPath.startsWith('https://')) {
    return false
  }

  const finalUrl = await resolveRedirectUrl(httpPath, requestHeaders)
  setCacheValue(playbackUrlCache, playbackUrlCacheKey, finalUrl, PLAYBACK_URL_CACHE_TTL_MS)
  log.info('Emby反代', `302 重定向成功: ${mediaRoute.itemId} (${Date.now() - startedAt}ms)`)
  res.writeHead(302, buildRedirectHeaders(finalUrl))
  res.end()
  return true
}

/**
 * 普通代理请求。
 *
 * 对非媒体请求尽量少干预：
 * - 不做 HTML/JS 注入
 * - 不改写 JSON
 * - 不做代理层业务判断
 * 目标是尽量贴近直连 Emby 的行为，优先保证登录、初始化与常规页面访问稳定。
 */
async function proxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  settings: ProxySettings,
  path: string,
  query: URLSearchParams,
  requestHeaders: Record<string, string>
): Promise<void> {
  const body = await readRequestBody(req)
  const targetUrl = buildTargetUrl(settings.embyUrl, path, query)
  const headers = buildForwardHeaders(requestHeaders, {
    contentLength: body?.byteLength
  })

  let response: Response
  try {
    response = await fetchWithTimeout(targetUrl, {
      method: req.method || 'GET',
      headers,
      body: getFetchRequestBody(body),
      redirect: 'manual'
    })

    if (isAuthPath(path)) {
      log.info('Emby反代', `认证请求: ${path} -> ${response.status}`)
    }
  } catch (error: any) {
    log.error('Emby反代', `代理请求失败: ${error?.message || '未知错误'}`)
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: '代理请求失败', message: error?.message || '未知错误' }))
    return
  }

  await writeResponse(req, res, response)
}

/**
 * 总请求入口。
 *
 * 分发原则：
 * - OPTIONS 直接返回 CORS 头
 * - GET/HEAD 且命中媒体路由时，优先尝试 302
 * - 未命中或处理失败时，回退到普通代理
 */
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const settings = getProxySettings()

  if (!settings.enabled) {
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Emby反代服务未启用' }))
    return
  }

  if (!settings.embyUrl) {
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Emby服务器地址未配置' }))
    return
  }

  const url = getRequestUrl(req)
  const path = url.pathname
  const query = url.searchParams
  const requestHeaders = getRequestHeaders(req)

  if (req.method === 'OPTIONS') {
    res.writeHead(200, buildCorsHeaders())
    res.end()
    return
  }

  const isMediaRequest = (req.method === 'GET' || req.method === 'HEAD') && getMediaRouteMatch(path)
  if (isMediaRequest) {
    const handled = await tryHandleMediaRequest(res, settings, path, query, requestHeaders)
    if (handled) {
      return
    }

    log.info('Emby反代', `媒体请求回退上游代理: ${path}`)
  }

  await proxyRequest(req, res, settings, path, query, requestHeaders)
}

/**
 * Nitro 启动时创建一个独立的 HTTP 反代服务。
 *
 * 这里不接管 Nuxt 本身的路由，而是在配置端口上额外启动一个轻量反代入口，
 * 专门服务 Emby Web 与播放请求。
 */
export default defineNitroPlugin(() => {
  const port = parseInt(getSetting('emby_proxy_port') || '8097')
  const settings = getProxySettings()

  if (!settings.enabled) {
    log.info('Emby反代', '反代服务未启用，跳过启动')
    return
  }

  if (server) {
    return
  }

  server = createServer((req, res) => {
    void handleRequest(req, res)
  })

  server.listen(port, () => {
    log.success('Emby反代', `反代服务已启动，端口: ${port}`)
    log.info('Emby反代', `访问地址: http://<服务器IP>:${port}`)
  })

  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      log.error('Emby反代', `端口 ${port} 已被占用`)
      return
    }

    log.error('Emby反代', `服务器错误: ${error.message}`)
  })
})
