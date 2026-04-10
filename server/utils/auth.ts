/**
 * 系统认证核心工具模块
 *
 * 负责处理以下能力：
 * 1. 系统账号是否已初始化
 * 2. 用户名/密码校验与密码哈希
 * 3. 登录会话创建、读取、清理
 * 4. 认证状态聚合
 * 5. 登录/注册成功或失败后的通知下发
 *
 * 设计原则：
 * - 不把密码明文存入数据库
 * - Cookie 里只保存随机会话 token，不保存用户信息
 * - 数据库里保存 token 的哈希值，避免泄露后可直接复用
 * - 通知失败不能影响注册/登录主流程
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { deleteCookie, getCookie, getHeader, getRequestURL, setCookie } from 'h3'
import { getDB } from './db'
import { log } from './logger'
import { formatShanghaiDateTime } from '~/utils/time'

/** 认证会话 Cookie 名称。前后端统一依赖此名称读取登录态。 */
const SESSION_COOKIE_NAME = 'mediahub_session'

/** 未勾选“记住我”时的默认会话时长：12 小时。 */
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60

/** 勾选“记住我”后的持久会话时长：30 天。 */
const REMEMBER_ME_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

/**
 * system_users 表结构对应的完整用户记录。
 * 仅在服务端内部使用，不暴露给前端。
 */
interface SystemUserRow {
  id: number
  username: string
  password_hash: string
  password_salt: string
  created_at: string
  updated_at: string
  last_login_at: string | null
}

/**
 * auth_sessions 与 system_users 联表查询后的会话记录。
 * 用于根据 Cookie 中的 token 找回当前用户。
 */
interface AuthSessionRow {
  session_id: number
  user_id: number
  username: string
  expires_at: string
  remember_me: number
}

/**
 * 返回给前端的认证状态。
 * - hasUsers：系统是否已初始化管理员账号
 * - authenticated：当前请求是否已登录
 * - username：当前登录用户名
 */
export interface AuthStatus {
  hasUsers: boolean
  authenticated: boolean
  username: string | null
}

/**
 * 服务端识别出的当前登录用户。
 * 可挂到 event.context 上供后续接口复用。
 */
export interface AuthenticatedUser {
  id: number
  username: string
  rememberMe: boolean
}

/**
 * 把 Date 转成 SQLite 常用的 DATETIME 字符串格式。
 * 统一使用 UTC 风格的可比对字符串，方便过期判断。
 */
function formatSqliteDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * 把 SQLite 中的 DATETIME 字符串还原为 Date 对象。
 * 当前项目存储时不带时区，因此这里补上 Z 按 UTC 解释。
 */
function parseSqliteDate(value: string): Date {
  return new Date(value.replace(' ', 'T') + 'Z')
}

/**
 * 使用 scrypt + salt 生成密码哈希。
 *
 * 这里不直接保存密码，只保存：
 * - password_hash
 * - password_salt
 */
function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex')
}

/**
 * 对会话 token 做 SHA-256 哈希后再入库。
 * 即使数据库泄露，也无法直接复用原始 token。
 */
function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * 用户名标准化。
 * 当前规则较简单，只做首尾空白裁剪，避免“看起来一样但实际不同”。
 */
function normalizeUsername(username: string): string {
  return username.trim()
}

/**
 * 校验用户名是否合法。
 * 返回 null 表示通过，返回字符串表示具体错误信息。
 */
function validateUsername(username: string): string | null {
  const normalized = normalizeUsername(username)
  if (!normalized) return '用户名不能为空'
  if (normalized.length < 3) return '用户名至少需要 3 个字符'
  if (normalized.length > 32) return '用户名不能超过 32 个字符'
  if (/\s/.test(normalized)) return '用户名不能包含空白字符'
  return null
}

/**
 * 校验密码是否合法。
 * 当前只做长度校验，复杂度策略可以后续按需扩展。
 */
function validatePassword(password: string): string | null {
  if (!password) return '密码不能为空'
  if (password.length < 6) return '密码至少需要 6 个字符'
  if (password.length > 128) return '密码不能超过 128 个字符'
  return null
}

/**
 * 对通知中的动态文本做 HTML 转义。
 * Telegram 通知使用 HTML parseMode，必须避免用户名/IP/错误信息注入标签。
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeClientIp(ip: string): string {
  const value = ip.trim()
  if (!value) {
    return '未知'
  }

  if (value === '::1') {
    return '127.0.0.1'
  }

  if (value.startsWith('::ffff:')) {
    return value.slice(7)
  }

  return value
}

/**
 * 获取客户端 IP。
 * 优先取反向代理头，其次取直连 socket 地址。
 */
function getClientIp(event: H3Event): string {
  const forwardedFor = getHeader(event, 'x-forwarded-for')
  if (forwardedFor) {
    return normalizeClientIp(forwardedFor.split(',')[0]?.trim() || '未知')
  }

  const realIp = getHeader(event, 'x-real-ip')
  if (realIp) {
    return normalizeClientIp(realIp)
  }

  return normalizeClientIp(event.node.req.socket.remoteAddress || '未知')
}

/**
 * 根据是否勾选“记住我”计算会话过期时间。
 */
function getSessionExpiry(rememberMe: boolean): Date {
  return new Date(Date.now() + (rememberMe ? REMEMBER_ME_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS) * 1000)
}

/**
 * 判断当前请求是否处于 HTTPS 环境。
 *
 * 飞牛应用通常通过反向代理 / iframe 访问，
 * 此时需要优先信任 x-forwarded-proto 才能正确设置 Cookie 策略。
 */
function isHttpsRequest(event: H3Event): boolean {
  const forwardedProto = getHeader(event, 'x-forwarded-proto')
  if (forwardedProto) {
    return forwardedProto.split(',')[0]?.trim() === 'https'
  }

  return getRequestURL(event).protocol === 'https:'
}

/**
 * 生成认证 Cookie 配置。
 *
 * 关键点：
 * - 普通本地 HTTP 开发：使用 SameSite=Lax，避免浏览器拒绝非安全 Cookie
 * - HTTPS + iframe / 嵌入场景：使用 SameSite=None + Secure，确保第三方上下文也能带上会话 Cookie
 */
function getSessionCookieOptions(event: H3Event, rememberMe: boolean) {
  const isHttps = isHttpsRequest(event)

  return {
    httpOnly: true,
    sameSite: isHttps ? 'none' as const : 'lax' as const,
    secure: isHttps,
    path: '/',
    ...(rememberMe ? { maxAge: REMEMBER_ME_MAX_AGE_SECONDS } : {})
  }
}

/**
 * 判断系统是否已经创建过账号。
 * 当前系统只允许首次注册一个系统账号，因此这里用 count > 0 即可判断。
 */
export function hasSystemUsers(): boolean {
  const database = getDB()
  const row = database.prepare('SELECT COUNT(*) as count FROM system_users').get() as { count: number }
  return row.count > 0
}

/**
 * 按用户名查询完整用户记录。
 * 仅供认证内部使用，不应直接返回给前端。
 */
function getUserByUsername(username: string): SystemUserRow | null {
  const database = getDB()
  const stmt = database.prepare('SELECT * FROM system_users WHERE username = ? LIMIT 1')
  return stmt.get(normalizeUsername(username)) as SystemUserRow | undefined || null
}

/**
 * 按用户 ID 查询用户基础信息。
 * 主要用于创建会话前确认用户确实存在。
 */
function getUserById(userId: number): Pick<SystemUserRow, 'id' | 'username'> | null {
  const database = getDB()
  const stmt = database.prepare('SELECT id, username FROM system_users WHERE id = ? LIMIT 1')
  return stmt.get(userId) as Pick<SystemUserRow, 'id' | 'username'> | undefined || null
}

/**
 * 注册系统首个账号。
 *
 * 逻辑说明：
 * - 先校验用户名和密码
 * - 若系统中已存在账号，则拒绝再次注册
 * - 为密码生成随机 salt，再计算哈希后入库
 * - 返回基础用户信息给上层 API，用于创建登录会话
 */
export function registerSystemUser(username: string, password: string): { id: number; username: string } {
  const usernameError = validateUsername(username)
  if (usernameError) {
    throw new Error(usernameError)
  }

  const passwordError = validatePassword(password)
  if (passwordError) {
    throw new Error(passwordError)
  }

  if (hasSystemUsers()) {
    throw new Error('系统账号已存在，请直接登录')
  }

  const normalizedUsername = normalizeUsername(username)
  const salt = randomBytes(16).toString('hex')
  const passwordHash = hashPassword(password, salt)
  const database = getDB()

  const stmt = database.prepare(`
    INSERT INTO system_users (username, password_hash, password_salt, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `)

  const result = stmt.run(normalizedUsername, passwordHash, salt)
  return {
    id: Number(result.lastInsertRowid),
    username: normalizedUsername
  }
}

/**
 * 校验用户名和密码是否正确。
 *
 * 注意：
 * - 无论用户名不存在还是密码错误，都返回统一错误文案
 * - 使用 timingSafeEqual 避免普通字符串比较带来的时序差异
 */
export function verifySystemUser(username: string, password: string): { success: boolean; user?: { id: number; username: string }; error?: string } {
  const usernameError = validateUsername(username)
  if (usernameError) {
    return { success: false, error: usernameError }
  }

  const passwordError = validatePassword(password)
  if (passwordError) {
    return { success: false, error: passwordError }
  }

  const user = getUserByUsername(username)
  if (!user) {
    return { success: false, error: '用户名或密码错误' }
  }

  const expectedHash = Buffer.from(user.password_hash, 'hex')
  const actualHash = Buffer.from(hashPassword(password, user.password_salt), 'hex')

  if (expectedHash.length !== actualHash.length || !timingSafeEqual(expectedHash, actualHash)) {
    return { success: false, error: '用户名或密码错误' }
  }

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username
    }
  }
}

/**
 * 创建登录会话。
 *
 * 实现方式：
 * 1. 生成随机 token 返回给浏览器（写入 HttpOnly Cookie）
 * 2. 数据库只保存 token 的哈希值
 * 3. 记录本次会话过期时间、rememberMe 状态与最近使用时间
 * 4. 同步更新用户最后登录时间
 */
export function createAuthSession(event: H3Event, userId: number, rememberMe: boolean): { username: string } {
  const user = getUserById(userId)
  if (!user) {
    throw new Error('用户不存在')
  }

  cleanExpiredAuthSessions()

  const token = randomBytes(32).toString('hex')
  const tokenHash = hashSessionToken(token)
  const expiresAt = getSessionExpiry(rememberMe)
  const database = getDB()

  database.prepare(`
    INSERT INTO auth_sessions (user_id, session_token_hash, expires_at, remember_me, last_used_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(user.id, tokenHash, formatSqliteDate(expiresAt), rememberMe ? 1 : 0)

  database.prepare(`
    UPDATE system_users
    SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(user.id)

  setCookie(event, SESSION_COOKIE_NAME, token, getSessionCookieOptions(event, rememberMe))

  return { username: user.username }
}

/**
 * 清理当前请求对应的登录会话。
 *
 * 同时做两件事：
 * - 删除数据库中的会话记录
 * - 删除浏览器中的认证 Cookie
 */
export function clearAuthSession(event: H3Event): void {
  const token = getCookie(event, SESSION_COOKIE_NAME)
  const database = getDB()

  if (token) {
    database.prepare('DELETE FROM auth_sessions WHERE session_token_hash = ?').run(hashSessionToken(token))
  }

  deleteCookie(event, SESSION_COOKIE_NAME, getSessionCookieOptions(event, false))
}

/**
 * 清理所有已过期会话。
 *
 * 这里返回删除数量，便于后续如需做调试或统计时复用。
 */
export function cleanExpiredAuthSessions(): number {
  const database = getDB()
  const stmt = database.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?')
  const result = stmt.run(formatSqliteDate(new Date()))
  return result.changes
}

/**
 * 根据当前请求中的 Cookie 获取已认证用户。
 *
 * 处理流程：
 * 1. 先清理过期会话
 * 2. 读取 Cookie 中的原始 token
 * 3. 用 token 哈希值去数据库找会话
 * 4. 找不到或已过期则自动清理并返回 null
 * 5. 命中后更新 last_used_at，并返回用户信息
 */
export function getAuthenticatedUser(event: H3Event): AuthenticatedUser | null {
  cleanExpiredAuthSessions()

  const token = getCookie(event, SESSION_COOKIE_NAME)
  if (!token) {
    return null
  }

  const database = getDB()
  const row = database.prepare(`
    SELECT
      auth_sessions.id as session_id,
      auth_sessions.user_id,
      auth_sessions.expires_at,
      auth_sessions.remember_me,
      system_users.username
    FROM auth_sessions
    INNER JOIN system_users ON system_users.id = auth_sessions.user_id
    WHERE auth_sessions.session_token_hash = ?
    LIMIT 1
  `).get(hashSessionToken(token)) as AuthSessionRow | undefined

  if (!row) {
    clearAuthSession(event)
    return null
  }

  if (parseSqliteDate(row.expires_at).getTime() <= Date.now()) {
    clearAuthSession(event)
    return null
  }

  database.prepare('UPDATE auth_sessions SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.session_id)

  return {
    id: row.user_id,
    username: row.username,
    rememberMe: row.remember_me === 1
  }
}

/**
 * 获取当前请求的整体认证状态。
 * 前端路由守卫和页面初始化都会依赖这个聚合结果。
 */
export function getAuthStatus(event: H3Event): AuthStatus {
  const user = getAuthenticatedUser(event)
  return {
    hasUsers: hasSystemUsers(),
    authenticated: !!user,
    username: user?.username || null
  }
}

/**
 * 懒加载 Telegram 通知模块。
 *
 * 这样做的原因：
 * - 避免认证模块在服务启动时就把 Telegram 相关依赖整体引入
 * - 减少非认证主链路上的副作用
 */
async function notifyByTelegram(message: string): Promise<void> {
  const { sendNotification } = await import('./telegram/client')
  await sendNotification(message)
}

/**
 * 懒加载微信通知模块。
 * 与 Telegram 一样，避免顶层静态引入导致额外启动负担。
 */
async function notifyByWechat(message: string): Promise<void> {
  const { sendWechatNotification } = await import('./wechat/client')
  await sendWechatNotification(message)
}

/**
 * 发送登录/注册结果通知。
 *
 * 说明：
 * - 调用方通常使用 `void notifyAuthResult(...)` 异步触发
 * - 这里内部统一吞掉异常并写日志，确保通知失败不影响主流程
 * - Telegram 使用 HTML；微信端会在各自客户端中再转换为纯文本
 */
export async function notifyAuthResult(
  event: H3Event,
  action: 'register' | 'login',
  username: string,
  success: boolean,
  error?: string
): Promise<void> {
  try {
    const safeUsername = escapeHtml(normalizeUsername(username) || '未知用户')
    const safeError = error ? escapeHtml(error) : ''
    const ip = escapeHtml(getClientIp(event))
    const time = escapeHtml(formatShanghaiDateTime(new Date()))

    const title = action === 'register'
      ? (success ? '系统首次注册成功' : '系统注册失败')
      : (success ? '系统登录成功' : '系统登录失败')

    const message = [
      `🔐 <b>${title}</b>`,
      `账号：${safeUsername}`,
      `IP：${ip}`,
      `时间：${time}`,
      success ? '状态：已通过验证' : `状态：${safeError || '验证失败'}`
    ].join('\n')

    const results = await Promise.allSettled([
      notifyByTelegram(message),
      notifyByWechat(message)
    ])

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const channel = index === 0 ? 'Telegram' : '微信'
        log.error('认证通知', `${channel} 发送失败: ${result.reason?.message || result.reason}`)
      }
    })
  } catch (notifyError: any) {
    log.error('认证通知', `构建或发送通知失败: ${notifyError?.message || notifyError}`)
  }
}
