/**
 * 微信客户端模块
 *
 * 功能：
 * 1. 微信登录（二维码扫码登录）
 * 2. 消息监听与处理
 * 3. 发送通知消息
 * 4. 客户端状态管理
 *
 * 使用 @wechatbot/wechatbot 实现
 * 新 SDK 优势：
 * - 自动管理 context_token（ContextStore），收到消息时自动更新并持久化
 * - 会话过期自动重登录（session:expired → 自动 re-login → session:restored）
 * - 长轮询本身就是保活，无需手动 sendTyping
 * - 可插拔存储（对接数据库）
 * - 中间件支持
 */

import {
  WeChatBot,
  NoContextError,
  ApiError,
  type Storage,
  type Credentials,
  type IncomingMessage
} from '@wechatbot/wechatbot'
import QRCode from 'qrcode'
import { getSetting, setSetting } from '../db'
import { log } from '../logger'
import { handleWechatCommand, handleWechatShareLink } from './commands'

/**
 * 基于数据库的存储实现
 * 将 @wechatbot/wechatbot SDK 的 Storage 接口对接到项目的 settings 数据库表
 * SDK 内部会通过此接口持久化凭证、context_token、轮询游标等状态
 */
class DbStorage implements Storage {
  async get<T>(key: string): Promise<T | undefined> {
    const value = getSetting(`wechat_sdk_${key}`)
    if (!value) return undefined
    try {
      return JSON.parse(value) as T
    } catch {
      return undefined
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    setSetting(`wechat_sdk_${key}`, JSON.stringify(value))
  }

  async delete(key: string): Promise<void> {
    setSetting(`wechat_sdk_${key}`, '')
  }

  async has(key: string): Promise<boolean> {
    return !!getSetting(`wechat_sdk_${key}`)
  }

  async clear(): Promise<void> {
    for (const key of ['credentials', 'cursor', 'context_tokens', 'typing_tickets']) {
      setSetting(`wechat_sdk_${key}`, '')
    }
  }
}

/**
 * 微信全局状态接口
 * 使用 globalThis 实现跨请求的状态持久化
 */
interface WechatGlobalState {
  /** WeChatBot 实例 */
  bot: WeChatBot | null
  /** 连接状态 */
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'waiting_login'
  /** 是否正在初始化 */
  initializing: boolean
  /** Bot ID */
  botId: string | null
  /** 用户 ID */
  userId: string | null
  /** 二维码 URL（Base64 Data URL） */
  qrcodeUrl: string | null
}

/**
 * 获取微信全局状态
 * 状态存储在 globalThis 中，确保服务运行期间状态持久化
 *
 * @returns 微信全局状态对象
 */
function getGlobalState(): WechatGlobalState {
  if (!(globalThis as any).__wechatState__) {
    (globalThis as any).__wechatState__ = {
      bot: null,
      connectionState: 'disconnected' as const,
      initializing: false,
      botId: null,
      userId: null,
      qrcodeUrl: null
    }
  }
  return (globalThis as any).__wechatState__
}

/**
 * 微信登录状态接口
 */
export interface WechatLoginStatus {
  /** 是否已连接 */
  connected: boolean
  /** 连接状态 */
  state: 'disconnected' | 'connecting' | 'connected' | 'waiting_login'
  /** Bot ID */
  botId?: string
  /** 用户 ID */
  userId?: string
  /** 二维码 URL */
  qrcodeUrl?: string
}

/**
 * 二维码获取结果接口
 */
export interface QRCodeResult {
  /** 是否成功 */
  success: boolean
  /** 二维码 URL（Base64 Data URL） */
  qrcodeUrl?: string
  /** 错误信息 */
  error?: string
}

/**
 * 重置当前微信运行时状态，但不清空数据库中的配置
 * 主要用于初始化失败、强制重新拉起二维码登录等场景
 */
function resetWechatRuntimeState(clearQrcode = true): void {
  const state = getGlobalState()
  state.bot = null
  state.connectionState = 'disconnected'
  state.initializing = false

  if (clearQrcode) {
    state.qrcodeUrl = null
  }
}

/**
 * 使数据库中的登录凭证失效
 * 仅在用户主动登出时调用
 */
function clearStoredWechatSession(): void {
  setSetting('wechat_token', '')
  setSetting('wechat_bot_id', '')
  setSetting('wechat_user_id', '')
  setSetting('wechat_notify_user_id', '')
  /* 清除 SDK 存储的凭证和 context_token */
  for (const key of ['credentials', 'cursor', 'context_tokens', 'typing_tickets']) {
    setSetting(`wechat_sdk_${key}`, '')
  }
}

/**
 * 通过 Telegram 通知用户（安全导入，避免循环依赖）
 *
 * @param message - 通知消息
 */
async function notifyViaTelegram(message: string): Promise<void> {
  try {
    const { sendNotification } = await import('../telegram/client')
    sendNotification(message).catch(() => {})
  } catch {}
}

/**
 * 创建 WeChatBot 实例
 * 配置自定义存储（对接数据库）和事件监听
 */
function createBot(): WeChatBot {
  const storage = new DbStorage()

  const bot = new WeChatBot({
    storage,
    logLevel: 'warn'
  })

  /* 消息处理：分发到命令处理器或分享链接处理器 */
  bot.onMessage(async (msg: IncomingMessage) => {
    const text = msg.text
    if (!text) return

    if (text.startsWith('-')) {
      await handleWechatCommand(bot, msg)
    } else {
      await handleWechatShareLink(bot, msg)
    }
  })

  /**
   * 会话过期事件
   * SDK 会自动尝试重登录（auth.clearAll → login({ force: true })）
   * 这里只需通知用户，不要清凭证，否则会与 SDK 的自动重登录冲突
   */
  bot.on('session:expired', () => {
    log.warn('WeChat', '会话已过期，SDK 正在尝试自动重登录...')
    const state = getGlobalState()
    state.connectionState = 'disconnected'
    notifyViaTelegram('⚠️ 微信会话已过期，SDK 正在尝试自动重登录，如长时间未恢复请在设置页面重新扫码')
  })

  /**
   * 会话恢复事件
   * SDK 自动重登录成功后触发，更新本地状态和凭证
   */
  bot.on('session:restored', (creds: Credentials) => {
    log.success('WeChat', `会话已恢复，BotID: ${creds.accountId}`)
    const state = getGlobalState()
    state.connectionState = 'connected'
    state.botId = creds.accountId
    state.userId = creds.userId

    /* 同步凭证到数据库（兼容旧字段） */
    setSetting('wechat_token', creds.token)
    setSetting('wechat_bot_id', creds.accountId)
    setSetting('wechat_user_id', creds.userId)
  })

  /* 错误事件 */
  bot.on('error', (error: unknown) => {
    if (error instanceof ApiError && error.isSessionExpired) {
      log.warn('WeChat', 'API 返回会话过期')
      return
    }
    log.error('WeChat', `Bot 错误: ${error instanceof Error ? error.message : String(error)}`)
  })

  return bot
}

/**
 * 启动长轮询并监听状态变化
 * 如果 start() 失败，自动回退到 disconnected 状态
 *
 * @param bot - WeChatBot 实例
 */
function startBotPolling(bot: WeChatBot): void {
  const state = getGlobalState()

  bot.start().then(() => {
    /* start() 的 Promise 在 bot.stop() 后 resolve */
    if (state.bot === bot && state.connectionState === 'connected') {
      log.warn('WeChat', '长轮询意外停止')
      state.connectionState = 'disconnected'
    }
  }).catch((err: Error) => {
    log.error('WeChat', `长轮询启动失败: ${err.message}`)
    if (state.bot === bot) {
      state.connectionState = 'disconnected'
      state.bot = null
    }
  })
}

/**
 * 初始化微信客户端
 * 使用已保存的凭证恢复连接
 *
 * @returns 初始化结果
 */
export async function initWechatClient(): Promise<{ success: boolean; error?: string }> {
  const state = getGlobalState()

  if (state.connectionState === 'connected') {
    return { success: true }
  }

  if (state.initializing || state.connectionState === 'connecting') {
    return { success: false, error: '正在初始化中，请稍候' }
  }

  /* 检查是否有凭证（兼容旧字段和 SDK 存储） */
  const token = getSetting('wechat_token')
  const sdkCreds = getSetting('wechat_sdk_credentials')
  if (!token && !sdkCreds) {
    return { success: false, error: '未配置微信 Token，请先扫码登录' }
  }

  try {
    state.initializing = true
    state.connectionState = 'connecting'

    const bot = createBot()
    state.bot = bot

    /**
     * login() 会自动从 Storage 加载已保存的凭证
     * 如果凭证有效则直接返回，无需重新扫码
     */
    const creds = await bot.login()

    state.botId = creds.accountId
    state.userId = creds.userId
    state.qrcodeUrl = null

    /* 保存凭证到数据库（兼容旧字段） */
    setSetting('wechat_token', creds.token)
    setSetting('wechat_bot_id', creds.accountId)
    setSetting('wechat_user_id', creds.userId)
    if (!getSetting('wechat_notify_user_id')) {
      setSetting('wechat_notify_user_id', creds.userId)
    }

    /**
     * 启动长轮询（后台运行，失败时自动回退状态）
     * 长轮询本身就是保活——每次轮询请求都会保持会话活跃
     * SDK 的 ContextStore 在收到消息时自动更新 context_token 并持久化
     * 因此无需手动 sendTyping 保活
     */
    startBotPolling(bot)

    state.connectionState = 'connected'
    log.success('WeChat', `客户端初始化成功，BotID: ${creds.accountId}`)

    return { success: true }
  } catch (error: any) {
    resetWechatRuntimeState()
    log.error('WeChat', `初始化失败: ${error.message}`)
    return { success: false, error: error.message }
  } finally {
    state.initializing = false
  }
}

/**
 * 获取登录二维码
 * 生成二维码供用户扫码登录
 *
 * 关键设计：
 * bot.login() 是完整的登录流程（生成二维码 → 等待扫码 → 确认登录），
 * 整个 await 会一直阻塞到登录完成或超时。
 * 但前端只需要拿到二维码图片就返回，不需要等登录完成。
 * 因此 login() 在后台运行，函数在二维码生成后立即返回。
 *
 * @param forceRefresh - 是否强制刷新二维码
 * @returns 二维码获取结果
 */
export async function getLoginQRCode(forceRefresh = false): Promise<QRCodeResult> {
  const state = getGlobalState()

  if (!forceRefresh && state.initializing && state.qrcodeUrl) {
    return { success: true, qrcodeUrl: state.qrcodeUrl }
  }

  if (state.initializing && !forceRefresh) {
    return { success: false, error: '正在初始化中，请稍候' }
  }

  if (forceRefresh || state.connectionState === 'connecting') {
    resetWechatRuntimeState()
  }

  try {
    state.connectionState = 'connecting'
    state.initializing = true
    state.qrcodeUrl = null

    const bot = createBot()
    state.bot = bot

    /**
     * login({ force: true }) 在后台运行
     * onQrUrl 回调中生成二维码图片并保存到 state.qrcodeUrl
     * 登录成功后自动保存凭证、启动长轮询
     */
    bot.login({
      force: true,
      callbacks: {
        onQrUrl: (url: string) => {
          /**
           * 注意：不用 async，因为 SDK 的 QrLoginCallbacks.onQrUrl 签名是同步的
           * QRCode.toDataURL 是异步的，用 .then() 处理结果
           */
          QRCode.toDataURL(url, {
            width: 256,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          }).then((dataUrl) => {
            state.qrcodeUrl = dataUrl
            log.info('WeChat', '二维码已生成，请扫码登录')
          }).catch((err: any) => {
            log.error('WeChat', `生成二维码失败: ${err.message}`)
          })
        },
        onScanned: () => {
          log.info('WeChat', '已扫码，请在微信中确认...')
          state.connectionState = 'waiting_login'
          state.qrcodeUrl = null
        },
        onExpired: () => {
          log.info('WeChat', '二维码已过期，正在刷新...')
          /* 清除旧二维码，等待 SDK 自动请求新的 onQrUrl 回调 */
          state.qrcodeUrl = null
        }
      }
    }).then((creds) => {
      /* 登录成功，保存凭证 */
      setSetting('wechat_token', creds.token)
      setSetting('wechat_bot_id', creds.accountId)
      setSetting('wechat_user_id', creds.userId)
      setSetting('wechat_notify_user_id', creds.userId)

      state.botId = creds.accountId
      state.userId = creds.userId
      state.connectionState = 'connected'
      state.qrcodeUrl = null

      log.success('WeChat', `登录成功，BotID: ${creds.accountId}`)

      /* 启动长轮询（后台运行，失败时自动回退状态） */
      startBotPolling(bot)
    }).catch((error: Error) => {
      resetWechatRuntimeState()
      log.error('WeChat', `登录失败: ${error.message}`)
    }).finally(() => {
      state.initializing = false
    })

    /* 等待二维码生成（最多5秒） */
    const maxWait = 5000
    const startTime = Date.now()
    while (!state.qrcodeUrl && Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    if (state.qrcodeUrl) {
      return { success: true, qrcodeUrl: state.qrcodeUrl }
    }

    return { success: false, error: '获取二维码超时，请重试' }
  } catch (error: any) {
    resetWechatRuntimeState()
    log.error('WeChat', `获取二维码失败: ${error.message}`)
    return { success: false, error: error.message }
  }
}

/**
 * 移除 HTML 标签和实体，微信不支持富文本
 * 处理 Telegram 常用的所有标签和 HTML 实体
 *
 * @param message - 原始消息（可能包含 HTML）
 * @returns 纯文本消息
 */
function stripHtml(message: string): string {
  return message
    /* 移除 HTML 标签 */
    .replace(/<\/?(b|i|s|u|code|pre|a|em|strong|del|ins|mark|sub|sup|br|p|div|span)[^>]*>/gi, '')
    /* 替换常见 HTML 实体 */
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    /* 清理残留的 HTML 标签（兜底） */
    .replace(/<[^>]+>/g, '')
}

/**
 * 发送微信通知
 * 向配置的通知用户发送消息
 * 新 SDK 的 bot.send() 自动使用 ContextStore 缓存的 context_token
 * ContextStore 在收到消息时自动更新 token，无需手动保活
 *
 * @param message - 消息内容（可能包含 HTML 标签，会自动移除）
 * @param imageUrl - 可选的图片 URL
 * @returns 发送结果
 */
export async function sendWechatNotification(message: string, imageUrl?: string): Promise<{ success: boolean; error?: string }> {
  const state = getGlobalState()

  const notifyUserId = getSetting('wechat_notify_user_id')
  if (!notifyUserId) {
    log.info('WeChat', '未配置通知用户ID，跳过发送通知')
    return { success: false, error: '未配置通知用户ID' }
  }

  if (!state.bot || state.connectionState !== 'connected') {
    const initResult = await initWechatClient()
    if (!initResult.success) {
      log.error('WeChat', `客户端初始化失败: ${initResult.error}`)
      return { success: false, error: initResult.error }
    }
  }

  /* 二次检查：初始化成功后 bot 必须存在 */
  if (!state.bot) {
    return { success: false, error: '客户端初始化异常' }
  }

  const plainMessage = stripHtml(message)

  try {
    if (imageUrl) {
      /* 有图片时，发送图片+文字 */
      await state.bot.send(notifyUserId, { url: imageUrl, caption: plainMessage })
    } else {
      await state.bot.send(notifyUserId, plainMessage)
    }

    log.success('WeChat', '通知消息发送成功')
    return { success: true }
  } catch (error: any) {
    if (error instanceof NoContextError) {
      log.error('WeChat', `无法主动推送：用户 ${error.userId} 的 context_token 已过期，请先给 Bot 发送任意消息`)
      return { success: false, error: '该用户会话已过期，请先给 Bot 发送任意消息恢复。' }
    }
    if (error instanceof ApiError && error.isSessionExpired) {
      log.error('WeChat', '会话已过期，SDK 将尝试自动重登录')
      return { success: false, error: '会话已过期，正在尝试自动重登录' }
    }
    log.error('WeChat', `发送通知失败: ${error.message}`)
    return { success: false, error: error.message }
  }
}

/**
 * 获取微信登录状态
 *
 * @returns 登录状态信息
 */
export function getWechatLoginStatus(): WechatLoginStatus {
  const state = getGlobalState()

  return {
    connected: state.connectionState === 'connected',
    state: state.connectionState,
    botId: state.botId || undefined,
    userId: state.userId || undefined,
    qrcodeUrl: state.qrcodeUrl || undefined
  }
}

/**
 * 微信登出
 * 清除所有配置和状态
 *
 * @returns 登出结果
 */
export async function wechatLogout(): Promise<{ success: boolean; error?: string }> {
  const state = getGlobalState()

  /* 停止 Bot 实例 */
  if (state.bot) {
    try {
      state.bot.stop()
    } catch {}
  }

  clearStoredWechatSession()

  state.bot = null
  state.connectionState = 'disconnected'
  state.initializing = false
  state.botId = null
  state.userId = null
  state.qrcodeUrl = null

  log.info('WeChat', '已登出')

  return { success: true }
}

/**
 * 断开微信客户端连接
 * 仅断开连接，不清除配置
 */
export async function disconnectWechatClient(): Promise<void> {
  const state = getGlobalState()

  if (state.bot) {
    try {
      state.bot.stop()
    } catch {}
  }

  resetWechatRuntimeState(false)
}
