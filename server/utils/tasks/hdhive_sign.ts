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

interface LoginResult {
  success: boolean
  message: string
  cookieJar: Record<string, string>
}

const DEFAULT_HDHIVE_BASE_URL = 'https://hdhive.com'

function getBaseUrl(): string {
  return (getSetting('hdhive_base_url') || DEFAULT_HDHIVE_BASE_URL).replace(/\/$/, '')
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

function getSetCookieHeaders(resp: Response): string[] {
  const headersAny = resp.headers as any

  if (typeof headersAny.getSetCookie === 'function') {
    return headersAny.getSetCookie()
  }

  const raw = resp.headers.get('set-cookie')
  if (!raw) return []

  return raw.split(/,(?=[^;,]+=)/).map((s) => s.trim()).filter(Boolean)
}

function mergeCookies(jar: Record<string, string>, resp: Response): void {
  const setCookies = getSetCookieHeaders(resp)
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

function buildLoginRouterState(): string {
  return encodeURIComponent(
    JSON.stringify([
      '',
      {
        children: [
          '(auth)',
          {
            children: ['login', { children: ['__PAGE__', {}, null, null] }, null, null],
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
}

function buildManagerRouterState(): string {
  return encodeURIComponent(
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
}

async function resolveLoginActionId(baseUrl: string): Promise<string> {
  const loginPageUrl = `${baseUrl}/login?redirect=/`

  const pageResp = await fetch(loginPageUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': baseUrl,
    },
  })

  if (!pageResp.ok) {
    throw new Error(`打开登录页失败: HTTP ${pageResp.status}`)
  }

  const html = await pageResp.text()
  const chunkMatch = html.match(/\/_next\/static\/chunks\/app\/\(auth\)\/login\/page-[^"']+\.js/)
  if (!chunkMatch) {
    throw new Error('未找到登录页脚本资源')
  }

  const chunkPath = chunkMatch[0]
  const jsResp = await fetch(`${baseUrl}${chunkPath}`, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Referer': loginPageUrl,
    },
  })

  if (!jsResp.ok) {
    throw new Error(`读取登录脚本失败: HTTP ${jsResp.status}`)
  }

  const js = await jsResp.text()
  const actionMatch = js.match(/createServerReference\)\("([a-f0-9]+)"[\s\S]*?"login"\)/i)
  if (!actionMatch) {
    throw new Error('未解析到登录 action id')
  }

  return actionMatch[1] || ''
}

async function loginWithPassword(username: string, password: string): Promise<LoginResult> {
  const baseUrl = getBaseUrl()
  const cookieJar: Record<string, string> = {}

  try {
    const loginPageResp = await fetch(`${baseUrl}/login?redirect=/`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': baseUrl,
      },
    })

    mergeCookies(cookieJar, loginPageResp)

    if (!loginPageResp.ok) {
      return {
        success: false,
        message: `打开登录页失败: HTTP ${loginPageResp.status}`,
        cookieJar,
      }
    }

    const actionId = await resolveLoginActionId(baseUrl)
    const body = JSON.stringify([{ username, password }, '/'])

    const resp = await fetch(`${baseUrl}/login?redirect=/`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/x-component',
        'Content-Type': 'text/plain;charset=UTF-8',
        'Origin': baseUrl,
        'Referer': `${baseUrl}/login?redirect=/`,
        'next-action': actionId,
        'next-router-state-tree': buildLoginRouterState(),
        ...(cookieHeader(cookieJar) ? { 'Cookie': cookieHeader(cookieJar) } : {}),
      },
      body,
      redirect: 'manual',
    })

    mergeCookies(cookieJar, resp)
    const text = await resp.text().catch(() => '')

    if (cookieJar.token) {
      return {
        success: true,
        message: '登录成功',
        cookieJar,
      }
    }

    if (text.includes('用户名') && text.includes('密码')) {
      return {
        success: false,
        message: '登录失败，账号密码错误或登录态未建立',
        cookieJar,
      }
    }

    return {
      success: false,
      message: text ? `登录失败: ${text.slice(0, 200)}` : `登录失败: HTTP ${resp.status}`,
      cookieJar,
    }
  } catch (e: any) {
    return {
      success: false,
      message: `登录异常: ${e.message}`,
      cookieJar,
    }
  }
}

async function fetchUserInfo(cookieJar: Record<string, string>): Promise<UserInfo> {
  const baseUrl = getBaseUrl()
  const routerState = buildManagerRouterState()

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
  const baseUrl = getBaseUrl()
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
        message: '登录已失效，请检查账号密码',
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
  const username = getSetting('hdhive_username')
  const password = getSetting('hdhive_password')

  if (!username || !password) {
    log.error('影巢签到', '未配置账号或密码')
    const result: SignResult = { success: false, message: '未配置影巢账号或密码' }
    sendSignNotification(result, triggerType)
    return result
  }

  log.info('影巢签到', '账号密码登录中...')
  const loginResult = await loginWithPassword(username, password)

  if (!loginResult.success) {
    log.error('影巢签到', `登录失败: ${loginResult.message}`)
    const result: SignResult = { success: false, message: loginResult.message }
    sendSignNotification(result, triggerType)
    return result
  }

  const cookieJar = loginResult.cookieJar

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
    log.error('影巢签到', '登录已失效或登录态建立失败')
    result.message = '登录已失效，请检查账号密码'
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
