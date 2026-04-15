/**
 * 影巢(HDHIVE)签到模块 - 纯 Cookie 增强版
 *
 * 当前设计目标：
 * 1. 只依赖用户提供的 hdhive_cookie，不再走账号密码登录
 * 2. 优先使用 refresh_token 刷新登录态，尽量延长 Cookie 可用时间
 * 3. refresh 不可用时，如果现有 token + csrf_access_token 仍可用，则直接签到
 * 4. 签到完成后自动回写最新认证 Cookie，减少后续失效概率
 * 5. 保持与现有任务调度、手动执行、通知链路兼容
 *
 * Cookie 关键字段说明：
 * - token: 业务接口 Bearer Token
 * - refresh_token: 用于刷新登录态
 * - csrf_access_token: 提交签到等写操作时需要的 CSRF Token
 */
import { getSetting, setSetting } from '../db'
import { log } from '../logger'
import { sendNotification } from '../telegram/client'
import { sendWechatNotification } from '../wechat/client'
import { formatShanghaiDateTime } from '~/utils/time'

/** 签到任务最终返回结果，同时用于通知消息拼装 */
interface SignResult {
  success: boolean
  message: string
  rewardPoints?: number
  currentPoints?: number
  signinDaysTotal?: number
  nickname?: string
  userId?: number
}

/** 从影巢管理页 RSC 数据中提取出的当前用户关键信息 */
interface UserInfo {
  id: number | null
  nickname: string | null | undefined
  username: string | null | undefined
  email: string | null | undefined
  points: number | null
  signin_days_total: number | null
}

/** refresh 接口的归一化结果，方便主流程统一判断 */
interface RefreshResult {
  ok: boolean
  status: string
  message: string
  raw: any
}

const DEFAULT_HDHIVE_BASE_URL = 'https://hdhive.com'

/**
 * 只持久化认证相关 Cookie。
 * 其他临时 Cookie 没有长期价值，避免把无关字段写回数据库。
 */
const AUTH_COOKIE_KEYS = ['token', 'refresh_token', 'csrf_access_token']

/** 获取影巢站点地址，未配置时回落到默认主站 */
function getBaseUrl(): string {
  return (getSetting('hdhive_base_url') || DEFAULT_HDHIVE_BASE_URL).replace(/\/$/, '')
}

/**
 * 将数据库里保存的 Cookie 字符串解析为对象。
 * 兼容以下格式：
 * - token=...; refresh_token=...; csrf_access_token=...
 * - Cookie: token=...; refresh_token=...
 */
function parseCookieString(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  const normalized = cookieString.replace(/^Cookie:\s*/i, '').trim()

  for (const item of normalized.split(';')) {
    const trimmed = item.trim()
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex > 0) {
      const name = trimmed.substring(0, eqIndex).trim()
      const value = trimmed.substring(eqIndex + 1).trim()
      if (name && value) {
        cookies[name] = value
      }
    }
  }

  return cookies
}

/** 从响应头中的 Set-Cookie 列表中提取首段 key=value */
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

/**
 * 兼容不同运行环境读取 Set-Cookie 的方式。
 * Node/undici 某些版本支持 headers.getSetCookie()，否则退回普通 header 解析。
 */
function getSetCookieHeaders(resp: Response): string[] {
  const headersAny = resp.headers as any

  if (typeof headersAny.getSetCookie === 'function') {
    return headersAny.getSetCookie()
  }

  const raw = resp.headers.get('set-cookie')
  if (!raw) return []

  return raw.split(/,(?=[^;,]+=)/).map((s) => s.trim()).filter(Boolean)
}

/**
 * 将接口响应返回的新 Cookie 合并回当前 cookieJar。
 * 这样 refresh / checkin / manager 任一接口只要返回了新 token，都能被后续流程继续使用。
 */
function mergeCookies(jar: Record<string, string>, resp: Response): void {
  const setCookies = getSetCookieHeaders(resp)
  const parsed = parseSetCookie(setCookies)
  Object.assign(jar, parsed)
}

/** 将 cookieJar 重新拼成 HTTP Cookie 头 */
function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

/** 检查 cookieJar 中是否缺少后续流程所需的关键字段 */
function getMissingCookieKeys(jar: Record<string, string>, requiredKeys: string[]): string[] {
  return requiredKeys.filter((key) => !jar[key])
}

/**
 * 将最新认证 Cookie 回写数据库。
 * 触发时机：
 * - refresh 成功后签到成功 / 已签到
 * 目的：
 * - 持久化最新 token / refresh_token / csrf_access_token
 * - 降低下次任务直接失效的概率
 */
function persistCookieJar(jar: Record<string, string>): void {
  const persistedJar: Record<string, string> = {}

  for (const key of AUTH_COOKIE_KEYS) {
    const value = jar[key]
    if (value) {
      persistedJar[key] = value
    }
  }

  const cookie = cookieHeader(persistedJar)
  if (cookie) {
    setSetting('hdhive_cookie', cookie)
  }
}

/**
 * 从 manager RSC 响应中提取当前用户信息。
 * 这里不依赖正式 JSON 接口，而是直接从页面数据中抓取用户状态。
 */
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

/**
 * 构造 manager 页的 next-router-state-tree。
 * 当前用于请求 /manager?_rsc=1，让服务端返回当前登录用户状态。
 */
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

/**
 * 尝试使用 refresh_token 刷新登录态。
 *
 * 成功条件：
 * - refresh 接口明确返回 success=true
 * - 或响应 Set-Cookie 后，cookieJar 已补齐 token + csrf_access_token
 *
 * 失败后不一定立即终止主流程：
 * - 如果旧 token + csrf_access_token 仍然存在，主流程会继续直接签到
 */
async function refreshAuth(cookieJar: Record<string, string>): Promise<RefreshResult> {
  const baseUrl = getBaseUrl()
  const token = cookieJar.token || ''
  const refreshToken = cookieJar.refresh_token || ''
  const csrf = cookieJar.csrf_access_token || ''

  if (!refreshToken) {
    return {
      ok: false,
      status: 'missing_refresh_token',
      message: 'Cookie 中缺少 refresh_token，无法刷新登录态',
      raw: null
    }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(`${baseUrl}/api/public/auth/refresh`, {
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
        message: `refresh 返回非 JSON，HTTP ${response.status}`,
        raw: text
      }
    }

    const message = data.message || ''
    const description = data.description || ''
    const missingAfterRefresh = getMissingCookieKeys(cookieJar, ['token', 'csrf_access_token'])

    if (data.success === true || missingAfterRefresh.length === 0) {
      return {
        ok: true,
        status: 'success',
        message: description || message || '刷新登录态成功',
        raw: data
      }
    }

    if (
      response.status === 401 ||
      description.includes('缺少 refresh token') ||
      message.includes('缺少 refresh token') ||
      description.includes('刷新令牌无效') ||
      message.includes('刷新令牌无效')
    ) {
      return {
        ok: false,
        status: 'unauthorized',
        message: description || message || 'refresh_token 无效',
        raw: data
      }
    }

    return {
      ok: false,
      status: 'error',
      message: description || message || `HTTP ${response.status}`,
      raw: data
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      return {
        ok: false,
        status: 'timeout',
        message: '刷新登录态请求超时',
        raw: null
      }
    }

    return {
      ok: false,
      status: 'error',
      message: e.message,
      raw: null
    }
  }
}

/**
 * 获取签到前/后的用户信息。
 * 主要用于：
 * - 获取当前积分
 * - 获取累计签到天数
 * - 辅助判断登录态是否仍有效
 */
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

/**
 * 执行正式签到请求。
 *
 * 返回 status 约定：
 * - success: 本次签到成功
 * - already: 今日已签到
 * - unauthorized: 登录态失效
 * - error/timeout/unknown: 其他异常
 */
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
        message: 'Cookie无效或已过期，请更新影巢Cookie',
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

/** 发送签到结果通知，沿用现有 Telegram / 微信通知链路 */
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

  sendNotification(message).catch((e: any) => log.error('Telegram通知', e.message || e))
  sendWechatNotification(message).catch((e: any) => log.error('微信通知', e.message || e))
}

/**
 * 影巢签到主流程。
 *
 * 流程概览：
 * 1. 读取数据库中的 hdhive_cookie
 * 2. 解析 Cookie，检查是否具备直接签到或 refresh 的基础条件
 * 3. 先获取一次签到前用户信息，便于失败时也能返回当前积分/签到天数
 * 4. 如果存在 refresh_token，则优先刷新登录态
 * 5. refresh 后再次确认 token + csrf_access_token 是否齐全
 * 6. 调用 checkin 执行签到
 * 7. 再次获取用户信息，用于生成更完整的结果与通知
 * 8. 若签到成功或今日已签到，则持久化最新认证 Cookie
 * 9. 发送通知并返回结果
 */
export async function hdhiveSign(triggerType: 'manual' | 'scheduled' = 'manual'): Promise<SignResult> {
  const cookie = getSetting('hdhive_cookie')

  if (!cookie) {
    log.error('影巢签到', '未配置Cookie')
    const result: SignResult = { success: false, message: '未配置影巢Cookie' }
    sendSignNotification(result, triggerType)
    return result
  }

  // 解析数据库中的完整 Cookie 字符串，作为后续所有请求共享的 cookieJar。
  const cookieJar = parseCookieString(cookie)

  // 如果存在 refresh_token，就先尝试走刷新链路；否则只能依赖现有 token 直接签到。
  const canRefresh = Boolean(cookieJar.refresh_token)

  // 直接签到最少需要 token + csrf_access_token 两个关键字段。
  const missingDirectKeys = getMissingCookieKeys(cookieJar, ['token', 'csrf_access_token'])

  // 既不能 refresh，又缺少直接签到必需字段时，说明当前 Cookie 已不可用。
  if (!canRefresh && missingDirectKeys.length > 0) {
    log.error('影巢签到', `Cookie缺少关键字段: ${missingDirectKeys.join(', ')}`)
    const result: SignResult = {
      success: false,
      message: `影巢Cookie无效，缺少关键字段：${missingDirectKeys.join(', ')}`
    }
    sendSignNotification(result, triggerType)
    return result
  }

  // 先记录签到前的用户状态。
  // 即使后面 refresh / checkin 失败，也能尽量在通知中保留当前积分和累计签到信息。
  log.info('影巢签到', '获取签到前用户信息...')
  const beforeUserInfo = await fetchUserInfo(cookieJar)

  // 如果 Cookie 中带有 refresh_token，则优先刷新登录态。
  // 这样可以减少旧 token 过期导致的签到失败。
  if (canRefresh) {
    log.info('影巢签到', '刷新登录态...')
    const refreshResult = await refreshAuth(cookieJar)

    // refresh 失败不立即终止：
    // - 若旧 token + csrf_access_token 仍在，则继续尝试直接签到
    // - 若连直接签到字段都缺失，则本次任务直接失败
    if (!refreshResult.ok) {
      log.warn('影巢签到', `刷新登录态失败，尝试直接签到: ${refreshResult.message}`)
      if (missingDirectKeys.length > 0) {
        const result: SignResult = {
          success: false,
          message: `刷新登录态失败：${refreshResult.message}`,
          currentPoints: beforeUserInfo.points || undefined,
          signinDaysTotal: beforeUserInfo.signin_days_total || undefined,
          nickname: beforeUserInfo.nickname || undefined,
          userId: beforeUserInfo.id || undefined
        }
        sendSignNotification(result, triggerType)
        return result
      }
    }
  }

  // 无论是否 refresh 成功，执行签到前都再次确认关键字段是否齐全。
  // 因为 refresh 可能没有真正刷新出 token/csrf，也可能原有字段本就不完整。
  const missingCheckinKeys = getMissingCookieKeys(cookieJar, ['token', 'csrf_access_token'])
  if (missingCheckinKeys.length > 0) {
    log.error('影巢签到', `刷新后仍缺少关键字段: ${missingCheckinKeys.join(', ')}`)
    const result: SignResult = {
      success: false,
      message: `影巢Cookie无效，缺少关键字段：${missingCheckinKeys.join(', ')}`,
      currentPoints: beforeUserInfo.points || undefined,
      signinDaysTotal: beforeUserInfo.signin_days_total || undefined,
      nickname: beforeUserInfo.nickname || undefined,
      userId: beforeUserInfo.id || undefined
    }
    sendSignNotification(result, triggerType)
    return result
  }

  // 执行正式签到。
  log.info('影巢签到', '执行签到...')
  const checkinResult = await checkin(cookieJar)

  // 再读取一次用户信息，用于获取签到后的最新积分和累计天数。
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

  // unauthorized 说明当前登录态整体已不可用，需要用户重新抓取完整 Cookie。
  if (checkinResult.status === 'unauthorized') {
    log.error('影巢签到', '登录已失效，请重新抓取完整Cookie')
    result.message = '登录已失效，请重新抓取完整Cookie'
  } else if (checkinResult.ok) {
    // success / already 两种情况都说明当前 Cookie 仍然有效。
    // 这时将运行过程中拿到的最新认证字段回写数据库，供下次定时任务复用。
    if (checkinResult.status === 'success') {
      log.success('影巢签到', `签到成功，获得 ${checkinResult.rewardPoints || 0} 积分`)
    } else {
      // already 表示今天已经完成签到，不算失败，也应保留这次更新后的 Cookie。
      log.info('影巢签到', '今日已签到')
    }
    persistCookieJar(cookieJar)
  } else {
    // 其他失败通常是接口异常、超时、返回格式异常等，记录日志但不覆盖数据库中的旧 Cookie。
    log.error('影巢签到', `签到失败: ${checkinResult.message}`)
  }

  // 无论成功还是失败，都统一发送通知，便于手动执行和定时任务保持一致反馈。
  sendSignNotification(result, triggerType)
  return result
}
