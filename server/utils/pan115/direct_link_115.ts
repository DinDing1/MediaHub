/**
 * 115云盘直链服务模块
 * 
 * 功能说明：
 * - 通过pickcode获取115云盘文件的直链下载地址
 * - 支持开放平台API，无文件大小限制
 * - 支持缓存机制，避免频繁请求API
 * - 支持强制刷新缓存
 * 
 * API接口：
 * - GET /api/d115/pickcode={pickcode}         通过pickcode获取直链
 * - GET /api/d115/{pickcode}                  直接路径方式获取直链
 * - GET /api/d115?pickcode={pickcode}         查询参数方式获取直链
 * - GET /api/d115?refresh=true                强制刷新缓存
 * 
 * 使用场景：
 * - 媒体服务器（如Infuse、Emby等）直接播放115云盘视频
 * - 下载工具直接下载115云盘文件
 */

import { getSetting, getDirectLinkCache, saveDirectLinkCache } from '../db'
import { log } from '../logger'
import { tryRefreshToken } from './open115'

/** 115 Pro API 基础地址 */
const PROAPI_BASE = 'https://proapi.115.com'

/** 默认User-Agent，兼容Infuse等媒体播放器 */
const DEFAULT_USER_AGENT = 'Infuse-Direct/8.2.4'

/** 并发请求去重：相同pickcode的请求共享同一个Promise */
const pendingRequests = new Map<string, Promise<DirectLinkResult>>()

/**
 * 从直链URL中提取过期时间戳
 * 115直链URL中包含t参数表示过期时间
 * @param url - 直链URL
 * @returns 过期时间戳（秒），默认返回当前时间+1小时
 */
export function extractExpireTs(url: string): number {
  try {
    const urlObj = new URL(url)
    const t = urlObj.searchParams.get('t')
    if (t) {
      return parseInt(t, 10)
    }
  } catch {}
  return Math.floor(Date.now() / 1000) + 3600
}

/**
 * 下载链接获取结果接口
 */
interface DownloadUrlResult {
  success: boolean
  url?: string
  fileName?: string
  fileSize?: number
  error?: string
  errorCode?: number | string
}

const G_KTS = Buffer.from('f0e569aebfdcbf8a1a45e8be7da673b8de8fe7c445da86c49b648b146ab4f1aa3801359e26692c86006b4fa5363462a62a966818f24afdbd6b978f4d8f8913b76c8e93ed0e0d483ed72f88d8fefe7e8650954fd1eb832634db667b9c7e9d7a8132eab633de3aa95934663baaba816048b9d5819cf86c8477ff5478265fbee81e369f34805c452c9b76d51b8fccc3b8f5', 'hex')
const RSA_PUBLIC_EXPONENT = 0x10001n
const RSA_MODULUS = BigInt('0x8686980c0f5a24c4b9d43020cd2c22703ff3f450756529058b1cf88f09b8602136477198a6e2683149659bd122c33592fdb5ad47944ad1ea4d36c6b172aad6338c3bb6ac6227502d010993ac967d1aef00f0c8e038de2e4d3bc2ec368af2e9f10a6f1eda4f7262f136420c07c331b871bf139f74f3010e3c4fe57df3afb71683')
const XOR_KEY_1 = Buffer.from([0x8d, 0xa5, 0xa5, 0x8d])
const XOR_KEY_2 = Buffer.from([0x78, 0x06, 0xad, 0x4c, 0x33, 0x86, 0x5d, 0x18, 0x4c, 0x01, 0x3f, 0x46])

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  if (modulus === 1n) return 0n

  let result = 1n
  let value = base % modulus
  let power = exponent

  while (power > 0n) {
    if (power & 1n) {
      result = (result * value) % modulus
    }
    power >>= 1n
    value = (value * value) % modulus
  }

  return result
}

function bufferToBigInt(buffer: Buffer): bigint {
  if (buffer.length === 0) {
    return 0n
  }

  return BigInt(`0x${buffer.toString('hex')}`)
}

function bigIntToBuffer(value: bigint, minLength: number = 0): Buffer {
  if (value === 0n) {
    return minLength > 0 ? Buffer.alloc(minLength) : Buffer.from([0])
  }

  let hex = value.toString(16)
  if (hex.length % 2 !== 0) {
    hex = `0${hex}`
  }

  const buffer = Buffer.from(hex, 'hex')
  if (buffer.length >= minLength) {
    return buffer
  }

  return Buffer.concat([Buffer.alloc(minLength - buffer.length), buffer])
}

function xorBytes(source: Buffer, key: Buffer): Buffer {
  const result = Buffer.alloc(source.length)
  const prefixLength = source.length & 0b11

  for (let i = 0; i < prefixLength; i++) {
    result[i] = (source[i] ?? 0) ^ (key[i] ?? 0)
  }

  for (let start = prefixLength; start < source.length; start += key.length) {
    const chunkLength = Math.min(key.length, source.length - start)
    for (let i = 0; i < chunkLength; i++) {
      result[start + i] = (source[start + i] ?? 0) ^ (key[i] ?? 0)
    }
  }

  return result
}

function reverseBuffer(buffer: Buffer): Buffer {
  return Buffer.from(buffer).reverse()
}

function genKey(randKey: Buffer, keyLength: number): Buffer {
  const xorKey = Buffer.alloc(keyLength)
  let length = keyLength * (keyLength - 1)
  let index = 0

  for (let i = 0; i < keyLength; i++) {
    const x = ((randKey[i] ?? 0) + (G_KTS[index] ?? 0)) & 0xff
    xorKey[i] = (G_KTS[length] ?? 0) ^ x
    length -= keyLength
    index += keyLength
  }

  return xorKey
}

function padPkcs1V15(message: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from([0x00]),
    Buffer.alloc(126 - message.length, 0x02),
    Buffer.from([0x00]),
    message,
  ])
}

function encrypt115Payload(payload: string): string {
  const data = Buffer.from(payload, 'utf8')
  const tmp = reverseBuffer(xorBytes(data, XOR_KEY_1))
  const xorText = Buffer.concat([Buffer.alloc(16), xorBytes(tmp, XOR_KEY_2)])
  const encryptedBlocks: Buffer[] = []

  for (let offset = 0; offset < xorText.length; offset += 117) {
    const chunk = xorText.subarray(offset, offset + 117)
    const encrypted = modPow(bufferToBigInt(padPkcs1V15(chunk)), RSA_PUBLIC_EXPONENT, RSA_MODULUS)
    encryptedBlocks.push(bigIntToBuffer(encrypted, 128))
  }

  return Buffer.concat(encryptedBlocks).toString('base64')
}

function decrypt115Payload(cipherText: string): string {
  const cipherBuffer = Buffer.from(cipherText, 'base64')
  const decryptedBlocks: Buffer[] = []

  for (let offset = 0; offset < cipherBuffer.length; offset += 128) {
    const block = cipherBuffer.subarray(offset, offset + 128)
    const decrypted = modPow(bufferToBigInt(block), RSA_PUBLIC_EXPONENT, RSA_MODULUS)
    const decoded = bigIntToBuffer(decrypted)
    const separatorIndex = decoded.indexOf(0)
    decryptedBlocks.push(separatorIndex >= 0 ? decoded.subarray(separatorIndex + 1) : decoded)
  }

  const merged = Buffer.concat(decryptedBlocks)
  const key = genKey(merged.subarray(0, 16), 12)
  const tmp = reverseBuffer(xorBytes(merged.subarray(16), key))
  return xorBytes(tmp, XOR_KEY_1).toString('utf8')
}

function getCookieHeaders(cookie: string, userAgent: string): Record<string, string> {
  return {
    'User-Agent': userAgent || 'Mozilla/5.0 115disk/99.99.99.99 115Browser/99.99.99.99 115wangpan_android/99.99.99.99',
    'Cookie': cookie,
    'Referer': 'https://115.com/',
    'Content-Type': 'application/x-www-form-urlencoded',
  }
}

function parseFileSize(value: unknown): number | undefined {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseCookieDownurlData(data: unknown): DownloadUrlResult {
  if (!data || typeof data !== 'object') {
    return { success: false, error: '普通接口未返回有效的下载链接数据' }
  }

  const values = Array.isArray(data) ? data : Object.values(data as Record<string, unknown>)
  for (const value of values) {
    if (!value || typeof value !== 'object') continue
    const info = value as Record<string, any>
    const urlInfo = info.url

    if (urlInfo && typeof urlInfo === 'object' && typeof urlInfo.url === 'string') {
      return {
        success: true,
        url: urlInfo.url,
        fileName: info.file_name || info.fileName,
        fileSize: parseFileSize(info.file_size ?? info.fileSize),
      }
    }
  }

  return { success: false, error: '普通接口未解析到下载链接' }
}

function shouldFallbackToCookie(result: DownloadUrlResult | null): boolean {
  if (!result || result.success) {
    return false
  }

  const errorCode = String(result.errorCode ?? '')
  const errorText = result.error || ''

  return errorCode === '770004' ||
    errorText.includes('访问上限') ||
    errorText.includes('稍后再试') ||
    errorText.includes('rate limit') ||
    errorText.includes('限流')
}

async function executeGetDownloadUrlCookie(
  cookie: string,
  pickcode: string,
  userAgent: string,
): Promise<DownloadUrlResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const body = new URLSearchParams({
      data: encrypt115Payload(JSON.stringify({ pickcode }))
    })

    const response = await fetch(`${PROAPI_BASE}/app/chrome/downurl`, {
      method: 'POST',
      headers: getCookieHeaders(cookie, userAgent),
      body: body.toString(),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      log.error('115直链', `普通接口请求失败: ${response.status}`)
      return { success: false, error: `普通接口请求失败: ${response.status}` }
    }

    const result = await response.json() as any
    if (!result.state || !result.data) {
      const errorCode = result.errno || result.code
      const errorMsg = result.error || result.msg || result.message || '普通接口获取下载链接失败'
      log.error('115直链', `普通接口错误: ${errorCode || 'unknown'} - ${errorMsg}`)
      return { success: false, error: errorMsg, errorCode }
    }

    const decrypted = decrypt115Payload(String(result.data))
    const parsed = parseCookieDownurlData(JSON.parse(decrypted))
    return parsed.success ? parsed : { ...parsed, errorCode: result.errno || result.code }
  } catch (e: any) {
    clearTimeout(timeoutId)
    log.error('115直链', `普通接口异常: ${e.message}`)
    return { success: false, error: e.message }
  }
}

/**
 * 通过开放平台API获取下载链接
 * 使用 /open/ufile/downurl 接口
 * @param openToken - 开放平台访问令牌
 * @param pickcode - 文件pickcode
 * @param userAgent - User-Agent
 * @param appId - 开放平台AppID
 * @returns 下载链接结果
 */
async function executeGetDownloadUrlOpen(
  openToken: string,
  pickcode: string,
  userAgent: string,
  appId?: string
): Promise<DownloadUrlResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const params = new URLSearchParams({
      pick_code: pickcode
    })

    const headers: Record<string, string> = {
      'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${openToken}`,
    }

    if (appId) {
      headers['Appid'] = appId
    }

    const response = await fetch(`${PROAPI_BASE}/open/ufile/downurl`, {
      method: 'POST',
      headers,
      body: params.toString(),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      log.error('115直链', `开放平台API请求失败: ${response.status}`)
      return { success: false, error: `请求失败: ${response.status}` }
    }

    const result = await response.json() as any

    if (!result.state) {
      const errorCode = result.errno || result.code
      const errorMsg = result.error || result.message || '获取下载链接失败'

      if (errorCode === 40140123) {
        log.error('115直链', 'access_token格式错误，请确保使用正确的AppID扫码获取')
        return { success: false, error: 'access_token格式错误，请使用正确的AppID重新扫码授权', errorCode }
      }
      if (errorCode === 40140125) {
        log.error('115直链', 'access_token已过期或已解除授权')
        return { success: false, error: 'access_token已过期，请重新扫码授权', errorCode }
      }

      log.error('115直链', `开放平台API错误: ${errorCode} - ${errorMsg}`)
      return { success: false, error: `${errorMsg} (错误码: ${errorCode})`, errorCode }
    }

    const data = result.data
    if (!data) {
      return { success: false, error: '未获取到下载链接数据' }
    }

    for (const fid in data) {
      const info = data[fid]
      const urlInfo = info.url
      if (urlInfo && urlInfo.url) {
        return {
          success: true,
          url: urlInfo.url,
          fileName: info.file_name,
          fileSize: parseFileSize(info.file_size),
        }
      }
    }

    return { success: false, error: '未获取到下载链接' }
  } catch (e: any) {
    clearTimeout(timeoutId)
    log.error('115直链', `开放平台API异常: ${e.message}`)
    return { success: false, error: e.message }
  }
}

/**
 * 直链获取结果接口（导出）
 */
export interface DirectLinkResult {
  success: boolean
  url?: string
  fileName?: string
  fileSize?: number
  error?: string
}

/**
 * 通过pickcode获取直链
 * 
 * 流程：
 * 1. 检查缓存是否存在且未过期
 * 2. 缓存命中则直接返回
 * 3. 使用开放平台API获取直链
 * 4. 如果Token失效，尝试刷新后重试
 * 5. 成功后缓存结果
 * 
 * @param pickcode - 文件pickcode
 * @param userAgent - User-Agent，用于缓存区分
 * @param refresh - 是否强制刷新缓存
 * @param displayName - 显示名称（用于日志）
 * @returns 直链获取结果
 */
export async function getDirectLink(
  pickcode: string,
  userAgent?: string,
  refresh: boolean = false,
  displayName?: string
): Promise<DirectLinkResult> {
  let openToken = getSetting('pan115_open_token')
  const appId = getSetting('pan115_app_id')
  const cookie = getSetting('pan115_cookie')

  const ua = userAgent || DEFAULT_USER_AGENT
  const logName = displayName || pickcode
  const cacheKey = `${pickcode}:${ua}`

  /** 检查缓存 */
  if (!refresh) {
    const cached = getDirectLinkCache(pickcode, ua)
    if (cached) {
      log.info('115直链', `缓存命中(直链缓存): ${logName}`)
      return {
        success: true,
        url: cached.download_url
      }
    }
  }

  /** 并发请求去重：检查是否有相同请求正在进行 */
  if (pendingRequests.has(cacheKey)) {
    log.info('115直链', `等待并发请求: ${logName}`)
    return pendingRequests.get(cacheKey)!
  }

  /** 创建新请求 */
  const promise = (async (): Promise<DirectLinkResult> => {
    try {
      let result: DownloadUrlResult | null = null

      if (openToken) {
        log.info('115直链', `使用开放平台获取直链: ${logName}`)
        result = await executeGetDownloadUrlOpen(openToken, pickcode, ua, appId || undefined)

        /** 如果Token过期，尝试刷新后重试 */
        if (!result.success && result.error?.includes('access_token已过期')) {
          log.info('115直链', '开放平台Token已过期，尝试刷新后重试')
          const refreshed = await tryRefreshToken()
          if (refreshed) {
            openToken = getSetting('pan115_open_token')
            if (openToken) {
              log.info('115直链', `刷新Token后重新使用开放平台: ${logName}`)
              result = await executeGetDownloadUrlOpen(openToken, pickcode, ua, appId || undefined)
            }
          }
        }
      }

      if ((!openToken || shouldFallbackToCookie(result)) && cookie) {
        if (result && !result.success) {
          log.warn('115直链', `开放平台失败，回退普通接口: ${logName} - ${result.error}`)
        } else if (!openToken) {
          log.info('115直链', `未配置开放平台Token，直接使用普通接口: ${logName}`)
        }

        log.info('115直链', `使用普通接口获取直链: ${logName}`)
        result = await executeGetDownloadUrlCookie(cookie, pickcode, ua)
      }

      if (!result) {
        return { success: false, error: '未配置115开放平台Token或115 Cookie' }
      }

      if (result.success && result.url) {
        const expireTs = extractExpireTs(result.url) - 300
        saveDirectLinkCache(pickcode, null, result.url, expireTs, ua)
        const name = result.fileName || logName
        log.success('115直链', `获取成功: ${name}`)
        return result
      }

      log.error('115直链', `获取失败: ${logName} - ${result.error}`)
      return result
    } finally {
      setTimeout(() => pendingRequests.delete(cacheKey), 100)
    }
  })()

  pendingRequests.set(cacheKey, promise)
  return promise
}
