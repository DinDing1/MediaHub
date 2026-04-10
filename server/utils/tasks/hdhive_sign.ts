/**
 * 影巢(HDHIVE)签到模块
 * 
 * 功能：
 * - 自动完成影巢每日签到
 * - 获取签到前后的积分和签到天数
 * - 签到完成后自动发送通知
 * 
 * 配置：
 * - hdhive_cookie: 浏览器登录后的完整 Cookie
 * - hdhive_base_url: 站点地址（可选，默认 https://hdhive.com）
 */

import { getSetting } from '../db'
import { log } from '../logger'
import { sendNotification } from '../telegram/client'
import { sendWechatNotification } from '../wechat/client'
import { formatShanghaiDateTime } from '~/utils/time'

interface SignResult {
  success: boolean
  message: string
  rewardPoints?: number
  currentPoints?: number
  signinDaysTotal?: number
  nickname?: string
  userId?: number
}

interface UserInfo {
  id: number | null
  nickname: string | null | undefined
  username: string | null | undefined
  email: string | null | undefined
  points: number | null
  signin_days_total: number | null
}

const HDHIVE_BASE_URL = 'https://hdhive.com'

function parseCookieString(cookieString: string): Record<string, string> {
  const jar: Record<string, string> = {}
  
  for (const part of cookieString.split(';')) {
    const item = part.trim()
    if (!item) continue
    
    const idx = item.indexOf('=')
    if (idx <= 0) continue
    
    const key = item.slice(0, idx).trim()
    const value = item.slice(idx + 1).trim()
    if (key) {
      jar[key] = value
    }
  }
  
  return jar
}

function parseSetCookie(setCookieHeaders: string[]): Record<string, string> {
  const cookies: Record<string, string> = {}
  
  for (const item of setCookieHeaders) {
    const first = item.split(';')[0]
    if (!first) continue
    const idx = first.indexOf('=')
    if (idx > 0) {
      const k = first.slice(0, idx).trim()
      const v = first.slice(idx + 1).trim()
      cookies[k] = v
    }
  }
  
  return cookies
}

function mergeCookies(jar: Record<string, string>, resp: Response): void {
  const setCookies = resp.headers.getSetCookie ? resp.headers.getSetCookie() : []
  const parsed = parseSetCookie(setCookies)
  Object.assign(jar, parsed)
}

function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

function extractCurrentUser(text: string): UserInfo {
  const info: UserInfo = {
    id: null,
    nickname: null,
    username: null,
    email: null,
    points: null,
    signin_days_total: null
  }
  
  const mId = text.match(/"currentUser":\{"id":(\d+)/)
  const mNick = text.match(/"nickname":"([^"]*)"/)
  const mUsername = text.match(/"username":"([^"]*)"/)
  const mEmail = text.match(/"email":"([^"]*)"/)
  const mPoints = text.match(/"user_meta":\{[^}]*"points":(\d+)/)
  const mDays = text.match(/"user_meta":\{[^}]*"signin_days_total":(\d+)/)
  
  if (mId) info.id = Number(mId[1])
  if (mNick) info.nickname = mNick[1]
  if (mUsername) info.username = mUsername[1]
  if (mEmail) info.email = mEmail[1]
  if (mPoints) info.points = Number(mPoints[1])
  if (mDays) info.signin_days_total = Number(mDays[1])
  
  return info
}

async function fetchUserInfo(cookieJar: Record<string, string>): Promise<UserInfo> {
  const baseUrl = HDHIVE_BASE_URL
  
  const routerState = encodeURIComponent(
    JSON.stringify([
      '',
      {
        children: [
          '(app)',
          {
            children: ['manager', { children: ['__PAGE__', {}, null, null] }, null, null],
          },
          null,
          null,
        ],
      },
      null,
      null,
      true,
    ])
  )
  
  try {
    const response = await fetch(`${baseUrl}/manager?_rsc=1`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'rsc': '1',
        'next-url': '/manager',
        'next-router-state-tree': routerState,
        'Referer': `${baseUrl}/manager`,
        'Cookie': cookieHeader(cookieJar)
      }
    })
    
    mergeCookies(cookieJar, response)
    
    if (!response.ok) {
      log.error('影巢签到', `获取用户信息失败: HTTP ${response.status}`)
      return extractCurrentUser('')
    }
    
    const text = await response.text()
    return extractCurrentUser(text)
  } catch (e: any) {
    log.error('影巢签到', `获取用户信息异常: ${e.message}`)
    return extractCurrentUser('')
  }
}

async function checkin(cookieJar: Record<string, string>): Promise<{ ok: boolean; status: string; message: string; rewardPoints: number | null; raw: any }> {
  const baseUrl = HDHIVE_BASE_URL
  const token = cookieJar.token || ''
  const csrf = cookieJar.csrf_access_token || ''
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    
    const response = await fetch(`${baseUrl}/api/customer/user/checkin`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Origin': baseUrl,
        'Referer': `${baseUrl}/`,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
        'Cookie': cookieHeader(cookieJar)
      },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    mergeCookies(cookieJar, response)
    
    const text = await response.text()
    
    let data: any = null
    try {
      data = JSON.parse(text)
    } catch {
      return {
        ok: false,
        status: 'unknown',
        message: `非JSON响应，HTTP ${response.status}`,
        rewardPoints: null,
        raw: text
      }
    }
    
    const message = data.message || ''
    const description = data.description || ''
    const mergedText = `${message} ${description}`
    
    const rewardMatch = mergedText.match(/获得\s*(\d+)\s*积分/)
    const rewardPoints = rewardMatch ? Number(rewardMatch[1]) : null
    
    if (data.success === true) {
      return {
        ok: true,
        status: 'success',
        message: description || message || '签到成功',
        rewardPoints,
        raw: data
      }
    }
    
    if (
      description.includes('已经签到') ||
      message.includes('已经签到') ||
      description.includes('明天再来') ||
      message.includes('明天再来')
    ) {
      return {
        ok: true,
        status: 'already',
        message: description || message || '今日已签到',
        rewardPoints,
        raw: data
      }
    }
    
    if (
      response.status === 401 ||
      description.includes('未登录') ||
      message.includes('未登录') ||
      description.toLowerCase().includes('unauthorized') ||
      message.toLowerCase().includes('unauthorized')
    ) {
      return {
        ok: false,
        status: 'unauthorized',
        message: 'Cookie已失效，请重新登录',
        rewardPoints,
        raw: data
      }
    }
    
    return {
      ok: false,
      status: 'error',
      message: description || message || `HTTP ${response.status}`,
      rewardPoints,
      raw: data
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      return {
        ok: false,
        status: 'timeout',
        message: '请求超时',
        rewardPoints: null,
        raw: null
      }
    }
    return {
      ok: false,
      status: 'error',
      message: e.message,
      rewardPoints: null,
      raw: null
    }
  }
}

function sendSignNotification(result: SignResult, triggerType: 'manual' | 'scheduled' = 'manual'): void {
  const statusIcon = result.success ? '✅' : '❌'
  const statusText = result.success ? '签到成功' : '签到失败'
  const now = new Date()
  const timeStr = formatShanghaiDateTime(now)
  
  const triggerText = triggerType === 'scheduled' ? '定时触发' : '手动触发'
  
  const lines: string[] = [
    `【${statusIcon} 影巢${statusText}】`,
    '',
    '━━━━━━━━━━',
    `🕐 时间：${timeStr}`,
    `📍 方式：${triggerText}`,
    `✨ 状态：${result.message}`,
    '━━━━━━━━━━'
  ]
  
  if (result.success) {
    if (result.rewardPoints !== undefined && result.rewardPoints > 0) {
      lines.push(`📈 本次积分：${result.rewardPoints}`)
    }
    if (result.currentPoints !== undefined) {
      lines.push(`💰 当前积分：${result.currentPoints}`)
    }
    if (result.signinDaysTotal !== undefined) {
      lines.push(`📆 累计签到：${result.signinDaysTotal} 天`)
    }
    if (result.nickname) {
      lines.push(`👤 昵称：${result.nickname}`)
    }
    if (result.userId) {
      lines.push(`🆔 ID：${result.userId}`)
    }
    lines.push('━━━━━━━━━━')
  }
  
  const message = lines.join('\n')
  
  sendNotification(message).catch(e => log.error('Telegram通知', e.message || e))
  sendWechatNotification(message).catch(e => log.error('微信通知', e.message || e))
}

export async function hdhiveSign(triggerType: 'manual' | 'scheduled' = 'manual'): Promise<SignResult> {
  const cookie = getSetting('hdhive_cookie')
  
  if (!cookie) {
    log.error('影巢签到', '未配置Cookie')
    const result: SignResult = { success: false, message: '未配置影巢Cookie' }
    sendSignNotification(result, triggerType)
    return result
  }
  
  const cookieJar = parseCookieString(cookie)
  
  log.info('影巢签到', '获取签到前用户信息...')
  const beforeUserInfo = await fetchUserInfo(cookieJar)
  
  log.info('影巢签到', '执行签到...')
  const checkinResult = await checkin(cookieJar)
  
  log.info('影巢签到', '获取签到后用户信息...')
  const afterUserInfo = await fetchUserInfo(cookieJar)
  
  const result: SignResult = {
    success: checkinResult.ok,
    message: checkinResult.message,
    rewardPoints: checkinResult.rewardPoints || undefined,
    currentPoints: afterUserInfo.points || beforeUserInfo.points || undefined,
    signinDaysTotal: afterUserInfo.signin_days_total || beforeUserInfo.signin_days_total || undefined,
    nickname: afterUserInfo.nickname || beforeUserInfo.nickname || undefined,
    userId: afterUserInfo.id || beforeUserInfo.id || undefined
  }
  
  if (checkinResult.status === 'unauthorized') {
    log.error('影巢签到', 'Cookie已失效')
    result.message = 'Cookie已失效，请重新登录'
  } else if (checkinResult.ok) {
    if (checkinResult.status === 'success') {
      log.success('影巢签到', `签到成功，获得 ${checkinResult.rewardPoints || 0} 积分`)
    } else {
      log.info('影巢签到', '今日已签到')
    }
  } else {
    log.error('影巢签到', `签到失败: ${checkinResult.message}`)
  }
  
  sendSignNotification(result, triggerType)
  return result
}
