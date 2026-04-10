/**
 * 微信客户端模块
 *
 * 功能：
 * 1. 微信登录（二维码扫码登录）
 * 2. 消息监听与处理
 * 3. 发送通知消息
 * 4. 客户端状态管理
 *
 * 使用 @openilink/openilink-sdk-node 实现
 */

import { Client, extractText, APIError, NoContextTokenError } from '@openilink/openilink-sdk-node'
import QRCode from 'qrcode'
import { getSetting, setSetting } from '../db'
import { log } from '../logger'
import { handleWechatCommand, handleWechatShareLink } from './commands'

/**
 * 微信全局状态接口
 * 使用 globalThis 实现跨请求的状态持久化
 */
interface WechatGlobalState {
  /** 微信客户端实例 */
  client: Client | null
  /** 连接状态 */
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'waiting_login'
  /** 消息监听是否正在运行 */
  monitorRunning: boolean
  /** 是否正在初始化 */
  initializing: boolean
  /** Bot ID */
  botId: string | null
  /** 用户 ID */
  userId: string | null
  /** 二维码 URL（Base64 Data URL） */
  qrcodeUrl: string | null
  /** 登录 Promise，用于追踪登录过程 */
  loginPromise: Promise<void> | null
  /** 保活定时器 */
  keepaliveTimer: NodeJS.Timeout | null
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
      client: null,
      connectionState: 'disconnected' as const,
      monitorRunning: false,
      initializing: false,
      botId: null,
      userId: null,
      qrcodeUrl: null,
      loginPromise: null,
      keepaliveTimer: null
    }
  }
  return (globalThis as any).__wechatState__
}

/**
 * 微信配置接口
 */
export interface WechatConfig {
  /** 登录凭证 Token */
  token: string
  /** 通知接收用户 ID */
  notifyUserId: string
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
 * 获取微信配置
 * 从数据库读取已保存的 Token 和通知用户 ID
 *
 * @returns 微信配置对象，未配置时返回 null
 */
function getConfig(): WechatConfig | null {
  const token = getSetting('wechat_token')
  const notifyUserId = getSetting('wechat_notify_user_id') || ''

  if (!token) {
    return null
  }

  return {
    token,
    notifyUserId
  }
}

/**
 * 获取微信客户端实例
 *
 * @returns 微信客户端实例，未连接时返回 null
 */
export function getWechatClient(): Client | null {
  const state = getGlobalState()
  return state.client
}

/**
 * 重置当前微信运行时状态，但不清空数据库中的配置。
 * 主要用于会话过期、初始化失败、强制重新拉起二维码登录等场景。
 */
function resetWechatRuntimeState(clearQrcode = true): void {
  const state = getGlobalState()
  stopKeepalive()
  state.client = null
  state.connectionState = 'disconnected'
  state.monitorRunning = false
  state.initializing = false
  state.loginPromise = null

  if (clearQrcode) {
    state.qrcodeUrl = null
  }
}

/**
 * 使数据库中的登录凭证失效。
 * 当检测到 token 已过期时，必须清掉旧 token，避免后续仍不断尝试自动恢复。
 */
function clearStoredWechatSession(): void {
  setSetting('wechat_token', '')
  setSetting('wechat_bot_id', '')
  setSetting('wechat_user_id', '')
  setSetting('wechat_sync_buf', '')
}

/**
 * 初始化微信客户端
 * 使用已保存的 Token 恢复连接
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

  const config = getConfig()
  if (!config) {
    return { success: false, error: '未配置微信 Token，请先扫码登录' }
  }

  try {
    state.initializing = true
    state.connectionState = 'connecting'

    const client = new Client(config.token)
    state.client = client
    state.botId = getSetting('wechat_bot_id') || null
    state.userId = getSetting('wechat_user_id') || null
    state.qrcodeUrl = null

    /**
     * 消息监听是长连接行为，不能 await，否则 initializing 会一直不结束，
     * 前端再点“获取二维码”时就会永远得到“正在初始化中，请稍候”。
     */
    startMessageMonitor()
    startKeepalive()

    state.connectionState = 'connected'
    log.success('WeChat', `客户端初始化成功，BotID: ${state.botId || '未知'}`)

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

    const client = new Client('')

    state.loginPromise = client.loginWithQr({
      on_qrcode: async (imgContent: string) => {
        try {
          const dataUrl = await QRCode.toDataURL(imgContent, {
            width: 256,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          })
          state.qrcodeUrl = dataUrl
          log.info('WeChat', '二维码已生成，请扫码登录')
        } catch (err: any) {
          log.error('WeChat', `生成二维码失败: ${err.message}`)
        }
      },
      on_scanned: () => {
        log.info('WeChat', '已扫码，请在微信中确认...')
        state.connectionState = 'waiting_login'
        state.qrcodeUrl = null
      },
      on_expired: (attempt: number, max: number) => {
        log.info('WeChat', `二维码轮询刷新 (${attempt}/${max})`)
      }
    }).then((result) => {
      if (!result.connected) {
        resetWechatRuntimeState()
        log.error('WeChat', result.message || '登录失败')
        return
      }

      const token = (client as any).token || ''
      if (token) {
        setSetting('wechat_token', token)
      }
      if (result.bot_id) {
        setSetting('wechat_bot_id', result.bot_id)
        state.botId = result.bot_id
      }
      if (result.user_id) {
        setSetting('wechat_user_id', result.user_id)
        state.userId = result.user_id
        setSetting('wechat_notify_user_id', result.user_id)
      }

      state.client = client
      state.connectionState = 'connected'
      state.qrcodeUrl = null

      log.success('WeChat', `登录成功，BotID: ${result.bot_id || '未知'}`)

      startMessageMonitor()
      startKeepalive()
    }).catch((error: Error) => {
      resetWechatRuntimeState()
      log.error('WeChat', `登录失败: ${error.message}`)
    }).finally(() => {
      state.initializing = false
      state.loginPromise = null
    })

    await new Promise(resolve => setTimeout(resolve, 2000))

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
 * 启动消息监听
 * 监听微信消息并分发到对应的处理器
 *
 * 功能：
 * 1. 处理命令消息（以 - 开头）
 * 2. 处理115分享链接
 * 3. 同步消息缓冲区以支持断点续传
 *
 * 注意：
 * monitor 是长连接行为，因此这里改为后台启动，
 * 不能让调用方 await 到它自然结束。
 */
export function startMessageMonitor(): void {
  const state = getGlobalState()

  if (!state.client || state.monitorRunning) {
    return
  }

  state.monitorRunning = true
  const activeClient = state.client
  const syncBuf = getSetting('wechat_sync_buf') || ''

  void activeClient.monitor(
    async (message) => {
      const text = extractText(message)
      if (!text) return

      if (text.startsWith('-')) {
        await handleWechatCommand(activeClient, message, text)
      } else {
        await handleWechatShareLink(activeClient, message, text)
      }
    },
    {
      initial_buf: syncBuf,
      on_buf_update: (buf: string) => {
        setSetting('wechat_sync_buf', buf)
      },
      on_error: (error: Error) => {
        log.error('WeChat', `消息监听错误: ${error.message}`)
      },
      on_session_expired: () => {
        log.warn('WeChat', '会话已过期，需要重新登录')
        clearStoredWechatSession()
        resetWechatRuntimeState()
      }
    }
  ).catch((error: any) => {
    log.error('WeChat', `消息监听启动失败: ${error.message}`)
    state.monitorRunning = false
  })
}

/**
 * 保活间隔（毫秒）
 * 微信 iLink Bot 要求用户每24小时内主动发送消息，否则会话过期
 * 设置为每12小时发送一次心跳消息
 */
const KEEPALIVE_INTERVAL_MS = 12 * 60 * 60 * 1000

/**
 * 启动保活定时器
 * 定期向 Bot 发送心跳消息，保持会话有效
 */
function startKeepalive(): void {
  const state = getGlobalState()

  if (state.keepaliveTimer) {
    clearInterval(state.keepaliveTimer)
  }

  state.keepaliveTimer = setInterval(async () => {
    const notifyUserId = getSetting('wechat_notify_user_id')
    if (!notifyUserId || !state.client || state.connectionState !== 'connected') {
      return
    }

    try {
      await state.client.push(notifyUserId, '💓 保活心跳')
      log.info('WeChat', '保活心跳发送成功')
    } catch (error: any) {
      log.error('WeChat', `保活心跳发送失败: ${error.message}`)
    }
  }, KEEPALIVE_INTERVAL_MS)

  log.info('WeChat', `保活定时器已启动，间隔 ${KEEPALIVE_INTERVAL_MS / 1000 / 60 / 60} 小时`)
}

/**
 * 停止保活定时器
 */
function stopKeepalive(): void {
  const state = getGlobalState()

  if (state.keepaliveTimer) {
    clearInterval(state.keepaliveTimer)
    state.keepaliveTimer = null
    log.info('WeChat', '保活定时器已停止')
  }
}

/**
 * 发送微信通知
 * 向配置的通知用户发送消息
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

  if (!state.client || state.connectionState !== 'connected') {
    const initResult = await initWechatClient()
    if (!initResult.success) {
      log.error('WeChat', `客户端初始化失败: ${initResult.error}`)
      return { success: false, error: initResult.error }
    }
  }

  const plainMessage = message
    .replace(/<b>/g, '')
    .replace(/<\/b>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

  try {
    await state.client!.push(notifyUserId, plainMessage)

    log.success('WeChat', '通知消息发送成功')
    return { success: true }
  } catch (error: any) {
    if (error instanceof NoContextTokenError) {
      log.error('WeChat', '无法主动推送：该用户尚未发送过消息')
      return { success: false, error: '该用户尚未发送过消息，无法主动推送。请先向 Bot 发送任意消息。' }
    }
    if (error instanceof APIError && error.isSessionExpired()) {
      log.error('WeChat', '会话已过期，需要重新登录')
      clearStoredWechatSession()
      resetWechatRuntimeState()
      return { success: false, error: '会话已过期，请重新登录' }
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
  stopKeepalive()

  clearStoredWechatSession()

  const state = getGlobalState()
  state.client = null
  state.connectionState = 'disconnected'
  state.monitorRunning = false
  state.initializing = false
  state.botId = null
  state.userId = null
  state.qrcodeUrl = null
  state.loginPromise = null

  log.info('WeChat', '已登出')

  return { success: true }
}

/**
 * 断开微信客户端连接
 * 仅断开连接，不清除配置
 */
export async function disconnectWechatClient(): Promise<void> {
  resetWechatRuntimeState(false)
}
