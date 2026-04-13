/**
 * 影巢(HDHIVE)签到模块 - 最终版（账号密码登录）
 *
 * 功能说明：
 * 1. 使用账号密码自动登录 HDHive
 * 2. 登录成功后自动获取最新登录态（token / 其他 cookie）
 * 3. 调用每日签到接口完成签到
 * 4. 获取签到前后的用户信息（积分、累计签到天数、昵称、ID）
 * 5. 自动发送 Telegram / 微信通知
 *
 * 适用场景：
 * - 不想依赖长期保存的 cookie
 * - 避免 cookie 过期导致每日签到失败
 * - 希望通过账号密码每天自动建立新的登录态后再签到
 *
 * 配置项：
 * - hdhive_username: HDHive 登录账号
 * - hdhive_password: HDHive 登录密码
 * - hdhive_base_url: 站点地址（可选，默认 https://hdhive.com）
 *
 * 重要说明：
 * - HDHive 的登录不是传统的 /api/login 接口
 * - 它使用的是 Next.js Server Action
 * - 因此不能简单 POST 用户名密码到某个固定 API
 * - 本脚本会先打开登录页，再动态解析当前登录 action id，然后再提交登录请求
 * - 这样即使网站重新部署、action hash 变化，脚本也更不容易失效
 */

import { getSetting } from './server/utils/db'
import { log } from './server/utils/logger'
import { sendNotification } from './server/utils/telegram/client'
import { sendWechatNotification } from './server/utils/wechat/client'
import { formatShanghaiDateTime } from '~/utils/time'

/**
 * 最终返回给上层调用者的签到结果
 */
interface SignResult {
  /** 是否整体成功。注意：今日已签到也会视为成功 */
  success: boolean
  /** 给通知和日志展示的结果描述 */
  message: string
  /** 本次签到获得的积分（如果接口能识别出来） */
  rewardPoints?: number
  /** 当前总积分 */
  currentPoints?: number
  /** 累计签到天数 */
  signinDaysTotal?: number
  /** 用户昵称 */
  nickname?: string
  /** 用户 ID */
  userId?: number
}

/**
 * 从页面 / RSC 响应中提取的用户信息结构
 */
interface UserInfo {
  id: number | null
  nickname: string | null | undefined
  username: string | null | undefined
  email: string | null | undefined
  points: number | null
  signin_days_total: number | null
}

/**
 * 登录函数的结果
 */
interface LoginResult {
  /** 登录是否成功 */
  success: boolean
  /** 登录结果描述 */
  message: string
  /** 登录后拿到的 cookie 容器 */
  cookieJar: Record<string, string>
}

/**
 * 默认站点地址
 */
const DEFAULT_HDHIVE_BASE_URL = 'https://hdhive.com'

/**
 * 读取站点地址。
 *
 * 支持通过 hdhive_base_url 覆盖默认地址，
 * 并去掉末尾的 /，避免后面拼接 URL 时出现 //。
 */
function getBaseUrl(): string {
  return (getSetting('hdhive_base_url') || DEFAULT_HDHIVE_BASE_URL).replace(/\/$/, '')
}

/**
 * 把 "a=1; b=2; c=3" 这种 Cookie 字符串解析成对象。
 *
 * 当前最终版主要走“账号密码登录”流程，理论上不再强依赖旧 cookie 配置；
 * 这个工具函数保留下来，方便后续兼容或扩展。
 */
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

/**
 * 解析响应头里的 Set-Cookie。
 *
 * 输入：
 *   [
 *     'token=xxx; Path=/; HttpOnly',
 *     'csrf_access_token=yyy; Path=/'
 *   ]
 *
 * 输出：
 *   {
 *     token: 'xxx',
 *     csrf_access_token: 'yyy'
 *   }
 */
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
 * 尽量兼容不同 fetch 实现读取 set-cookie 的方式。
 *
 * 在某些 Node / undici 环境里：
 * - resp.headers.getSetCookie() 存在
 * 在另一些环境里：
 * - 可能只能 resp.headers.get('set-cookie')
 *
 * 所以这里统一做一层兼容处理。
 */
function getSetCookieHeaders(resp: Response): string[] {
  const headersAny = resp.headers as any

  if (typeof headersAny.getSetCookie === 'function') {
    return headersAny.getSetCookie()
  }

  const raw = resp.headers.get('set-cookie')
  if (!raw) return []

  /**
   * 有些实现会把多个 set-cookie 合并为一行，
   * 这里做一个尽量稳妥的拆分。
   */
  return raw.split(/,(?=[^;,]+=)/).map((s) => s.trim()).filter(Boolean)
}

/**
 * 把本次响应里返回的新 cookie 合并进 cookieJar。
 *
 * 这样后续请求始终使用“最新登录态”。
 */
function mergeCookies(jar: Record<string, string>, resp: Response): void {
  const setCookies = getSetCookieHeaders(resp)
  const parsed = parseSetCookie(setCookies)
  Object.assign(jar, parsed)
}

/**
 * 把 cookie 对象重新拼回请求头需要的字符串。
 *
 * 输入：
 *   { token: 'abc', csrf_access_token: 'def' }
 * 输出：
 *   'token=abc; csrf_access_token=def'
 */
function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

/**
 * 从 manager 页面返回的文本中提取当前用户信息。
 *
 * 注意：
 * - 这里不是标准 JSON API，而是基于页面 / RSC 响应文本做正则提取
 * - 这种方式虽然不够优雅，但对当前站点是有效的
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
 * 构造登录页需要的 next-router-state-tree。
 *
 * 这是 Next.js Server Action 请求里常见的内部头之一。
 * 当前站点登录请求会带这个值。
 */
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

/**
 * 构造 manager 页面读取用户信息时需要的 next-router-state-tree。
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
 * 动态解析当前站点的登录 action id。
 *
 * 为什么要这样做？
 * 因为 HDHive 登录不是固定 REST API，
 * 而是 Next.js Server Action，类似：
 *   next-action: 602b5a3af7ab2e93be6a14001ca83c1be491ccecea
 *
 * 这个 action id 可能随着部署变化。
 * 如果写死，网站一更新脚本就可能失效。
 *
 * 所以这里流程是：
 * 1. 打开登录页 HTML
 * 2. 找到登录页对应的 JS chunk
 * 3. 读取该 JS
 * 4. 从 createServerReference(..., "login") 中提取 action id
 */
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

  /**
   * 从 HTML 中提取登录页脚本路径，例如：
   * /_next/static/chunks/app/(auth)/login/page-xxxx.js
   */
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

  /**
   * 实际源码中可见类似：
   * createServerReference)("602b5a3af7ab2e93be6a14001ca83c1be491ccecea", ..., "login")
   */
  const actionMatch = js.match(/createServerReference\)\("([a-f0-9]+)"[\s\S]*?"login"\)/i)
  if (!actionMatch) {
    throw new Error('未解析到登录 action id')
  }

  return actionMatch[1] || ''
}

/**
 * 使用账号密码登录。
 *
 * 登录流程：
 * 1. 打开登录页，建立初始上下文，并拿可能的初始 cookie
 * 2. 动态提取当前登录 action id
 * 3. 按站点真实请求格式 POST 到 /login?redirect=/
 * 4. 从 Set-Cookie 中拿到 token 等登录态
 */
async function loginWithPassword(username: string, password: string): Promise<LoginResult> {
  const baseUrl = getBaseUrl()
  const cookieJar: Record<string, string> = {}

  try {
    /**
     * 第一步：打开登录页
     *
     * 目的：
     * - 让请求上下文更贴近真实浏览器
     * - 获取初始 cookie（如果站点有下发）
     */
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

    /**
     * 第二步：动态获取当前登录 action id
     */
    const actionId = await resolveLoginActionId(baseUrl)

    /**
     * 第三步：构造与浏览器一致的登录请求体
     *
     * 经过真实验证，请求体格式为：
     *   [{ username, password }, '/']
     */
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

    /**
     * 第四步：把登录响应里返回的 cookie 合并进 cookieJar
     *
     * 当前站点经验证，登录成功后至少会建立 token cookie。
     */
    mergeCookies(cookieJar, resp)
    const text = await resp.text().catch(() => '')

    /**
     * 以 token 是否存在作为登录成功的重要判断依据。
     */
    if (cookieJar.token) {
      return {
        success: true,
        message: '登录成功',
        cookieJar,
      }
    }

    /**
     * 如果响应里还是停留在登录表单语义，通常可判定为登录失败。
     */
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

/**
 * 获取用户信息。
 *
 * 这里复用了你原脚本的思路：
 * - 请求 /manager?_rsc=1
 * - 从返回文本里解析 currentUser / user_meta
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
 * 执行签到。
 *
 * 经过验证，签到接口为：
 *   POST /api/customer/user/checkin
 *
 * 其中：
 * - token cookie 可作为登录态核心凭证
 * - Authorization: Bearer <token> 也需要带上
 * - csrf_access_token 若存在则一并带上
 */
async function checkin(cookieJar: Record<string, string>): Promise<{ ok: boolean; status: string; message: string; rewardPoints: number | null; raw: any }> {
  const baseUrl = getBaseUrl()
  const token = cookieJar.token || ''
  const csrf = cookieJar.csrf_access_token || ''

  try {
    /**
     * 给签到请求设置 30 秒超时，防止卡死。
     */
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

    /**
     * 从接口返回文本里尝试提取“获得 X 积分”。
     */
    const rewardMatch = mergedText.match(/获得\s*(\d+)\s*积分/)
    const rewardPoints = rewardMatch ? Number(rewardMatch[1]) : null

    /**
     * 情况 1：接口明确返回 success=true
     */
    if (data.success === true) {
      return {
        ok: true,
        status: 'success',
        message: description || message || '签到成功',
        rewardPoints,
        raw: data
      }
    }

    /**
     * 情况 2：今天已经签到过
     *
     * 对自动化任务来说，“今天已签到”应该视为任务成功，
     * 因为最终目标是“今天处于已签到状态”。
     */
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

    /**
     * 情况 3：未登录 / 鉴权失败
     */
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

    /**
     * 其他业务失败
     */
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

/**
 * 发送签到结果通知。
 *
 * 保留你原有的通知风格，只补充必要注释。
 */
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
 * 模块主入口。
 *
 * 最终执行流程：
 * 1. 读取账号密码配置
 * 2. 自动登录 HDHive
 * 3. 获取签到前用户信息
 * 4. 执行签到
 * 5. 获取签到后用户信息
 * 6. 汇总结果并发送通知
 */
export async function hdhiveSign(triggerType: 'manual' | 'scheduled' = 'manual'): Promise<SignResult> {
  const username = getSetting('hdhive_username')
  const password = getSetting('hdhive_password')

  /**
   * 如果没有配置账号密码，直接返回失败。
   */
  if (!username || !password) {
    log.error('影巢签到', '未配置账号或密码')
    const result: SignResult = { success: false, message: '未配置影巢账号或密码' }
    sendSignNotification(result, triggerType)
    return result
  }

  /**
   * 第一步：登录
   */
  log.info('影巢签到', '账号密码登录中...')
  const loginResult = await loginWithPassword(username, password)

  if (!loginResult.success) {
    log.error('影巢签到', `登录失败: ${loginResult.message}`)
    const result: SignResult = { success: false, message: loginResult.message }
    sendSignNotification(result, triggerType)
    return result
  }

  const cookieJar = loginResult.cookieJar

  /**
   * 第二步：读取签到前用户信息
   */
  log.info('影巢签到', '获取签到前用户信息...')
  const beforeUserInfo = await fetchUserInfo(cookieJar)

  /**
   * 第三步：执行签到
   */
  log.info('影巢签到', '执行签到...')
  const checkinResult = await checkin(cookieJar)

  /**
   * 第四步：读取签到后用户信息
   */
  log.info('影巢签到', '获取签到后用户信息...')
  const afterUserInfo = await fetchUserInfo(cookieJar)

  /**
   * 汇总最终结果。
   *
   * 这里优先使用签到后的数据；
   * 如果签到后拿不到，就退回到签到前的数据。
   */
  const result: SignResult = {
    success: checkinResult.ok,
    message: checkinResult.message,
    rewardPoints: checkinResult.rewardPoints || undefined,
    currentPoints: afterUserInfo.points || beforeUserInfo.points || undefined,
    signinDaysTotal: afterUserInfo.signin_days_total || beforeUserInfo.signin_days_total || undefined,
    nickname: afterUserInfo.nickname || beforeUserInfo.nickname || undefined,
    userId: afterUserInfo.id || beforeUserInfo.id || undefined
  }

  /**
   * 根据签到返回状态输出日志。
   */
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

  /**
   * 最后发送通知并返回结果
   */
  sendSignNotification(result, triggerType)
  return result
}

/**
 * 备注：
 * 当前脚本保留了 parseCookieString 等旧工具函数，
 * 是为了后续如果你想兼容“账号密码优先，cookie 兜底”的方案时，可以直接扩展。
 *
 * 当前推荐使用方式：
 * - 配置 hdhive_username
 * - 配置 hdhive_password
 */
