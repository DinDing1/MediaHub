/**
 * 115开放平台授权模块
 * 
 * 功能说明：
 * - 开放平台OAuth授权流程
 * - access_token获取和刷新
 * - 自动授权（使用Cookie）
 * 
 * 使用场景：
 * - 直链服务获取大文件下载链接
 * - 其他开放平台API调用
 */

import { getSetting, setSetting } from '../db'
import { log } from '../logger'
import { createHash, randomBytes } from 'crypto'

/** 115 QR Code API 基础地址 */
const QRCODEAPI_BASE = 'https://qrcodeapi.115.com'

/**
 * 生成code_verifier和code_challenge
 * code_verifier: 43-128位随机字符串
 * code_challenge: base64(md5(code_verifier))
 */
function generateCodeChallenge(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(48).toString('base64').replace(/[+/=]/g, (c) => c === '+' ? '-' : c === '/' ? '_' : '')
  const codeChallenge = createHash('md5').update(Buffer.from(codeVerifier)).digest().toString('base64')
  return { codeVerifier, codeChallenge }
}

/**
 * 二维码Token信息
 */
export interface QrcodeTokenInfo {
  uid: string
  time: number
  sign: string
  qrcode?: string
  codeVerifier: string
}

/**
 * 获取二维码登录Token（开放平台）
 * 使用开放平台API，需要AppID
 * @param appId - 开放平台AppID
 * @returns 二维码Token信息
 */
export async function getQrcodeToken(appId: string): Promise<QrcodeTokenInfo> {
  const { codeVerifier, codeChallenge } = generateCodeChallenge()
  
  const params = new URLSearchParams({
    client_id: appId,
    code_challenge: codeChallenge,
    code_challenge_method: 'md5'
  })

  const response = await fetch(`${QRCODEAPI_BASE}/open/authDeviceCode`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  })

  if (!response.ok) {
    throw new Error(`获取二维码Token失败: ${response.status}`)
  }

  const result = await response.json()
  
  if (result.code) {
    throw new Error(result.error || `无效的AppID: ${appId}`)
  }

  const data = result.data || result
  return {
    uid: data.uid,
    time: data.time,
    sign: data.sign,
    qrcode: data.qrcode || `https://115.com/scan/dg-${data.uid}`,
    codeVerifier
  }
}

/**
 * 检查二维码扫码状态
 * @param tokenInfo - 二维码Token信息（包含uid, time, sign）
 * @returns 扫码状态
 */
export async function checkQrcodeStatus(tokenInfo: QrcodeTokenInfo): Promise<{ status: number; message: string }> {
  const params = new URLSearchParams({
    uid: tokenInfo.uid,
    time: String(tokenInfo.time),
    sign: tokenInfo.sign
  })

  const response = await fetch(`${QRCODEAPI_BASE}/get/status/?${params.toString()}`, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  })

  if (!response.ok) {
    throw new Error(`检查扫码状态失败: ${response.status}`)
  }

  const result = await response.json()
  
  return {
    status: result.data?.status ?? -1,
    message: result.data?.message || ''
  }
}

/**
 * 获取访问令牌（开放平台）
 * 使用 /open/deviceCodeToToken 接口
 * @param uid - 二维码UID
 * @param codeVerifier - 用于验证的code_verifier
 * @returns 访问令牌信息
 */
export async function getAccessToken(uid: string, codeVerifier: string): Promise<{ openToken: string; refreshToken: string; expiresIn: number }> {
  const params = new URLSearchParams({
    uid: uid,
    code_verifier: codeVerifier
  })

  const response = await fetch(`${QRCODEAPI_BASE}/open/deviceCodeToToken`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  })

  if (!response.ok) {
    throw new Error(`获取访问令牌失败: ${response.status}`)
  }

  const result = await response.json()
  
  if (result.code) {
    throw new Error(result.error || result.msg || '获取访问令牌失败')
  }

  const data = result.data || result
  return {
    openToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 7200
  }
}

/**
 * 刷新访问令牌（开放平台）
 * 使用 refresh_token 获取新的 access_token
 * 注意：刷新后返回新的 access_token 和新的 refresh_token（值会变，但有效期不延长）
 * @param refreshToken - 刷新令牌
 * @returns 新的访问令牌信息
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ openToken: string; refreshToken: string; expiresIn: number }> {
  const params = new URLSearchParams({
    refresh_token: refreshToken
  })

  const response = await fetch(`${QRCODEAPI_BASE}/open/refreshToken`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  })

  if (!response.ok) {
    throw new Error(`刷新访问令牌失败: ${response.status}`)
  }

  const result = await response.json()
  
  if (result.code) {
    throw new Error(result.error || result.msg || '刷新访问令牌失败')
  }

  const data = result.data || result
  return {
    openToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 7200
  }
}

/**
 * 自动扫描开放平台二维码（使用Cookie）
 * 用已登录的Cookie自动扫描开放平台二维码
 * @param cookie - 115云盘Cookie
 * @param uid - 二维码UID
 * @returns 扫描结果
 */
async function autoScanQrcode(cookie: string, uid: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${QRCODEAPI_BASE}/api/2.0/prompt.php?uid=${uid}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookie,
      }
    })

    if (!response.ok) {
      return { success: false, error: `扫描请求失败: ${response.status}` }
    }

    const result = await response.json()
    
    if (result.state === 1 && result.data) {
      return { success: true }
    }
    
    return { success: false, error: result.error || '扫描失败' }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

/**
 * 确认扫描开放平台二维码
 * @param cookie - 115云盘Cookie
 * @param uid - 二维码UID
 * @returns 确认结果
 */
async function confirmScanQrcode(cookie: string, uid: string): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${QRCODEAPI_BASE}/api/2.0/slogin.php?key=${uid}&uid=${uid}&client=0`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookie,
      }
    })

    if (!response.ok) {
      return { success: false, error: `确认请求失败: ${response.status}` }
    }

    const result = await response.json()
    
    if (result.state === true || result.state === 1) {
      return { success: true }
    }
    
    return { success: false, error: result.error || result.msg || '确认失败' }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

/**
 * 通过Cookie自动获取开放平台access_token
 * 流程：获取二维码 -> 自动扫描 -> 确认扫描 -> 获取token
 * @param cookie - 115云盘Cookie
 * @param appId - 开放平台AppID
 * @returns 访问令牌信息
 */
export async function getAccessTokenByCookie(
  cookie: string,
  appId: string
): Promise<{ success: boolean; openToken?: string; refreshToken?: string; expiresIn?: number; error?: string }> {
  try {
    const tokenInfo = await getQrcodeToken(appId)
    
    const scanResult = await autoScanQrcode(cookie, tokenInfo.uid)
    if (!scanResult.success) {
      log.error('115开放平台', `自动扫描失败: ${scanResult.error}`)
      return { success: false, error: scanResult.error }
    }
    
    const confirmResult = await confirmScanQrcode(cookie, tokenInfo.uid)
    if (!confirmResult.success) {
      log.error('115开放平台', `确认扫描失败: ${confirmResult.error}`)
      return { success: false, error: confirmResult.error }
    }
    
    const accessTokenInfo = await getAccessToken(tokenInfo.uid, tokenInfo.codeVerifier)
    log.success('115开放平台', '自动授权成功')
    
    return {
      success: true,
      openToken: accessTokenInfo.openToken,
      refreshToken: accessTokenInfo.refreshToken,
      expiresIn: accessTokenInfo.expiresIn
    }
  } catch (e: any) {
    log.error('115开放平台', `自动授权失败: ${e.message}`)
    return { success: false, error: e.message }
  }
}

/**
 * 保存Token信息到数据库
 * @param openToken - 访问令牌
 * @param refreshToken - 刷新令牌
 * @param expiresIn - 过期时间（秒）
 */
export function saveOpenToken(openToken: string, refreshToken: string, expiresIn: number): void {
  const expireTs = Math.floor(Date.now() / 1000) + expiresIn
  setSetting('pan115_open_token', openToken)
  setSetting('pan115_refresh_token', refreshToken)
  setSetting('pan115_token_expire', String(expireTs))
}

/**
 * 检查Token是否即将过期（提前5分钟刷新）
 * @returns 是否需要刷新
 */
function isTokenExpiringSoon(): boolean {
  const expireTs = getSetting('pan115_token_expire')
  if (!expireTs) return true
  
  const now = Math.floor(Date.now() / 1000)
  const expire = parseInt(expireTs, 10)
  
  return now + 300 > expire
}

/**
 * 自动检查并获取开放平台Token
 * 当数据库存在有效Cookie和AppID但没有Token时自动获取
 * 已有Token时检查是否即将过期，需要时自动刷新
 */
export async function autoCheckAndGetToken(): Promise<void> {
  const cookie = getSetting('pan115_cookie')
  const appId = getSetting('pan115_app_id')
  const openToken = getSetting('pan115_open_token')
  const refreshToken = getSetting('pan115_refresh_token')
  
  if (!cookie || !appId) {
    return
  }
  
  if (openToken && refreshToken) {
    if (isTokenExpiringSoon()) {
      log.info('115开放平台', 'Token即将过期，尝试刷新')
      const refreshed = await tryRefreshToken()
      if (!refreshed) {
        log.warn('115开放平台', 'Token刷新失败，尝试重新授权')
        await reauthorizeToken(cookie, appId)
      }
    } else {
      log.info('115开放平台', 'Token有效，跳过自动获取')
    }
    return
  }
  
  log.info('115开放平台', '检测到有效Cookie和AppID，尝试自动获取访问令牌')
  await reauthorizeToken(cookie, appId)
}

/**
 * 重新授权获取Token
 * @param cookie - 115云盘Cookie
 * @param appId - 开放平台AppID
 */
async function reauthorizeToken(cookie: string, appId: string): Promise<void> {
  const result = await getAccessTokenByCookie(cookie, appId)
  
  if (result.success && result.openToken && result.refreshToken && result.expiresIn) {
    saveOpenToken(result.openToken, result.refreshToken, result.expiresIn)
    log.success('115开放平台', '自动获取访问令牌成功')
  } else {
    log.warn('115开放平台', `自动获取访问令牌失败: ${result.error}`)
  }
}

/**
 * 尝试刷新Token
 * 当access_token失效时，使用refresh_token刷新
 * @returns 是否刷新成功
 */
export async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getSetting('pan115_refresh_token')
  
  if (!refreshToken) {
    log.info('115开放平台', '没有refresh_token，无法刷新')
    return false
  }
  
  try {
    log.info('115开放平台', '尝试使用refresh_token刷新访问令牌')
    const result = await refreshAccessToken(refreshToken)
    
    saveOpenToken(result.openToken, result.refreshToken, result.expiresIn)
    log.success('115开放平台', '刷新访问令牌成功')
    return true
  } catch (e: any) {
    log.error('115开放平台', `刷新访问令牌失败: ${e.message}`)
    return false
  }
}

/**
 * 获取有效的access_token
 * 如果token无效或不存在，尝试刷新或返回null
 * @returns access_token或null
 */
export async function getValidToken(): Promise<string | null> {
  let openToken = getSetting('pan115_open_token')
  
  if (!openToken) {
    return null
  }
  
  return openToken
}
