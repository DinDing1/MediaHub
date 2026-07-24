/**
 * Telegram 用户客户端模块
 * 基于 GramJS 实现 Telegram 用户登录和消息处理
 */
import { TelegramClient } from 'telegram/index.js'
import { StringSession } from 'telegram/sessions/index.js'
import { NewMessage } from 'telegram/events/index.js'
import { getSetting, setSetting } from '../db'
import { log } from '../logger'
import { handleCommand, setCommandClient, handleShareLink } from './commands'
import { sendBotNotification, initBot } from './bot'
import { APP_VERSION } from '../app_version'

interface TelegramGlobalState {
  client: TelegramClient | null
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'waiting_code' | 'waiting_password'
  messageHandlerStarted: boolean
  initializing: boolean
  initPromise: Promise<{ success: boolean; error?: string }> | null
  lastError: string | null
}

function getGlobalState(): TelegramGlobalState {
  if (!(globalThis as any).__telegramState__) {
    (globalThis as any).__telegramState__ = {
      client: null,
      connectionState: 'disconnected' as const,
      messageHandlerStarted: false,
      initializing: false,
      initPromise: null,
      lastError: null
    }
  }
  return (globalThis as any).__telegramState__
}

let client: TelegramClient | null = null
let connectionState: 'disconnected' | 'connecting' | 'connected' | 'waiting_code' | 'waiting_password' = 'disconnected'
let messageHandlerStarted = false
let initializing = false
let initPromise: Promise<{ success: boolean; error?: string }> | null = null
let lastError: string | null = null

function getState(): TelegramGlobalState {
  const state = getGlobalState()
  client = state.client
  connectionState = state.connectionState
  messageHandlerStarted = state.messageHandlerStarted
  initializing = state.initializing
  initPromise = state.initPromise
  lastError = state.lastError
  return state
}

function saveState(): void {
  const state = getGlobalState()
  state.client = client
  state.connectionState = connectionState
  state.messageHandlerStarted = messageHandlerStarted
  state.initializing = initializing
  state.initPromise = initPromise
  state.lastError = lastError
}

export interface TelegramConfig {
  apiId: number
  apiHash: string
  phone: string
  sessionString: string
  proxyEnabled: boolean
  proxyUrl: string
}

export interface LoginStatus {
  connected: boolean
  state: 'disconnected' | 'connecting' | 'connected' | 'waiting_code' | 'waiting_password'
  phone?: string
  username?: string
  userId?: string
}

function parseProxyUrl(url: string): { ip: string; port: number; username?: string; password?: string } | null {
  if (!url) return null
  
  try {
    const match = url.match(/^socks5:\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/)
    if (match) {
      return {
        username: match[1] || undefined,
        password: match[2] || undefined,
        ip: match[3] || '',
        port: parseInt(match[4] || '1080', 10)
      }
    }
    return null
  } catch {
    return null
  }
}

function getConfig(): TelegramConfig | null {
  const apiIdStr = getSetting('telegram_api_id')
  const apiHash = getSetting('telegram_api_hash')
  const phone = getSetting('telegram_phone')
  const sessionString = getSetting('telegram_session_string') || ''
  const proxyEnabled = getSetting('telegram_proxy_enabled') === 'true'
  const proxyUrl = getSetting('telegram_proxy_url') || ''

  if (!apiIdStr || !apiHash) {
    return null
  }

  return {
    apiId: parseInt(apiIdStr, 10),
    apiHash,
    phone: phone || '',
    sessionString,
    proxyEnabled,
    proxyUrl
  }
}

function getProxyConfig(config: TelegramConfig): any | undefined {
  if (!config.proxyEnabled || !config.proxyUrl) {
    return undefined
  }

  const parsed = parseProxyUrl(config.proxyUrl)
  if (!parsed) {
    return undefined
  }

  const proxyConfig: any = {
    ip: parsed.ip,
    port: parsed.port,
    socksType: 5
  }

  if (parsed.username) {
    proxyConfig.username = parsed.username
  }
  if (parsed.password) {
    proxyConfig.password = parsed.password
  }

  return proxyConfig
}

function buildClient(config: TelegramConfig, sessionString: string): TelegramClient {
  const stringSession = new StringSession(sessionString)
  const proxyConfig = getProxyConfig(config)

  return new TelegramClient(stringSession, config.apiId, config.apiHash, {
    connectionRetries: 5,
    useWSS: false,
    proxy: proxyConfig,
    deviceModel: 'MediaHub',
    systemVersion: process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux',
    appVersion: APP_VERSION,
    langCode: 'zh',
    systemLangCode: 'zh'
  })
}

function isInvalidSessionError(error: any): boolean {
  const code = error?.code
  const message = String(error?.errorMessage || error?.message || '').toUpperCase()

  if (code === 401) {
    return true
  }

  return [
    'AUTH_KEY_UNREGISTERED',
    'AUTH_KEY_INVALID',
    'SESSION_REVOKED',
    'SESSION_EXPIRED',
    'USER_DEACTIVATED',
    'USER_DEACTIVATED_BAN'
  ].some(token => message.includes(token))
}

async function clearInvalidSession(error?: string, nextState: 'disconnected' | 'waiting_code' = 'waiting_code'): Promise<void> {
  if (client) {
    try {
      await client.disconnect()
    } catch {
    }
  }

  client = null
  connectionState = nextState
  messageHandlerStarted = false
  lastError = error || null
  setSetting('telegram_session_string', '')
  saveState()
}

async function initializeFromSession(config: TelegramConfig): Promise<{ success: boolean; error?: string }> {
  if (!config.sessionString) {
    connectionState = 'waiting_code'
    lastError = '未登录，请先发送验证码登录'
    saveState()
    return { success: false, error: lastError }
  }

  client = buildClient(config, config.sessionString)
  connectionState = 'connecting'
  lastError = null
  saveState()

  try {
    await client.connect()

    if (!(await client.checkAuthorization())) {
      await clearInvalidSession('Session 已失效，请重新登录')
      return { success: false, error: 'Session 已失效，请重新登录' }
    }

    connectionState = 'connected'
    lastError = null
    saveState()

    const me = await client.getMe()
    log.success('Telegram', `客户端初始化成功，已登录用户: ${(me as any).username || (me as any).phone}`)

    void startMessageHandler().catch((handlerError: any) => {
      log.error('Telegram', `消息处理器启动失败: ${handlerError?.message || handlerError}`)
    })

    return { success: true }
  } catch (error: any) {
    const message = error?.message || '初始化失败'

    if (isInvalidSessionError(error)) {
      await clearInvalidSession('Session 已失效，请重新登录')
      return { success: false, error: 'Session 已失效，请重新登录' }
    }

    if (client) {
      try {
        await client.disconnect()
      } catch {
      }
    }

    client = null
    connectionState = 'disconnected'
    lastError = message
    saveState()
    log.error('Telegram', `初始化失败: ${message}`)
    return { success: false, error: message }
  }
}


export async function getTelegramClient(): Promise<TelegramClient | null> {
  getState()

  if (client?.connected) {
    return client
  }

  const config = getConfig()
  if (!config) {
    return null
  }

  if (!config.sessionString) {
    return null
  }

  const result = await initTelegramClient()
  if (!result.success) {
    return null
  }

  return client
}

export async function initTelegramClient(): Promise<{ success: boolean; error?: string }> {
  getState()

  if (client?.connected && connectionState === 'connected') {
    return { success: true }
  }

  const config = getConfig()
  if (!config) {
    connectionState = 'disconnected'
    lastError = '未配置 Telegram API 信息'
    saveState()
    return { success: false, error: lastError }
  }

  if (!config.sessionString) {
    connectionState = 'waiting_code'
    lastError = '未登录，请先发送验证码登录'
    saveState()
    return { success: false, error: lastError }
  }

  if (initPromise) {
    return initPromise
  }

  initializing = true
  initPromise = initializeFromSession(config).finally(() => {
    initializing = false
    initPromise = null
    saveState()
  })
  saveState()

  return initPromise
}

export async function sendCode(phone: string): Promise<{ success: boolean; error?: string; phoneCodeHash?: string }> {
  getState()

  const config = getConfig()
  if (!config) {
    return { success: false, error: '未配置 Telegram API 信息' }
  }

  if (client) {
    try {
      await client.disconnect()
    } catch {
    }
  }

  try {
    connectionState = 'connecting'
    lastError = null
    messageHandlerStarted = false
    client = buildClient(config, '')
    saveState()

    log.info('Telegram', `代理配置: proxyEnabled=${config.proxyEnabled}, proxyUrl=${config.proxyUrl}`)
    log.info('Telegram', `解析后的代理配置: ${JSON.stringify(getProxyConfig(config))}`)

    await client.connect()

    const result = await client.sendCode(
      {
        apiId: config.apiId,
        apiHash: config.apiHash
      },
      phone
    )

    setSetting('telegram_phone', phone)
    connectionState = 'waiting_code'
    saveState()

    log.info('Telegram', `验证码已发送到 ${phone}`)

    return {
      success: true,
      phoneCodeHash: (result as any).phoneCodeHash
    }
  } catch (error: any) {
    const message = error?.message || '发送验证码失败'
    connectionState = 'disconnected'
    lastError = message
    saveState()
    log.error('Telegram', `发送验证码失败: ${message}`)
    return { success: false, error: message }
  }
}

export async function signIn(
  phone: string,
  code: string
): Promise<{ success: boolean; error?: string; needPassword?: boolean }> {
  getState()

  const config = getConfig()
  if (!client || !config) {
    return { success: false, error: '客户端未初始化' }
  }

  try {
    const result = await client.signInUser(
      { apiId: config.apiId, apiHash: config.apiHash },
      {
        phoneNumber: phone,
        phoneCode: async () => code,
        onError: (err: Error) => {
          log.error('Telegram', `登录错误: ${err.message}`)
        }
      }
    )

    const session = client.session
    const sessionString = (session as StringSession).save() as unknown as string

    setSetting('telegram_session_string', sessionString)
    connectionState = 'connected'
    lastError = null
    saveState()

    const me = result as any
    log.success('Telegram', `登录成功: ${me.username || me.phone}`)

    void startMessageHandler().catch((handlerError: any) => {
      log.error('Telegram', `消息处理器启动失败: ${handlerError?.message || handlerError}`)
    })

    return { success: true }
  } catch (error: any) {
    if (error.message?.includes('PASSWORD') || error.message?.includes('2FA')) {
      connectionState = 'waiting_password'
      lastError = null
      saveState()
      return { success: false, needPassword: true, error: '需要两步验证密码' }
    }

    const message = error?.message || '登录失败'
    lastError = message
    log.error('Telegram', `登录失败: ${message}`)
    return { success: false, error: message }
  }
}

export async function signInWithPassword(password: string): Promise<{ success: boolean; error?: string }> {
  getState()

  const config = getConfig()
  if (!client || !config) {
    return { success: false, error: '客户端未初始化' }
  }

  try {
    const result = await client.signInUser(
      { apiId: config.apiId, apiHash: config.apiHash },
      {
        phoneNumber: config.phone,
        phoneCode: async () => '',
        password: async () => password,
        onError: (err: Error) => {
          log.error('Telegram', `两步验证错误: ${err.message}`)
        }
      }
    )

    const session = client.session
    const sessionString = (session as StringSession).save() as unknown as string

    setSetting('telegram_session_string', sessionString)
    connectionState = 'connected'
    lastError = null
    saveState()

    const me = result as any
    log.success('Telegram', `两步验证登录成功: ${me.username || me.phone}`)

    void startMessageHandler().catch((handlerError: any) => {
      log.error('Telegram', `消息处理器启动失败: ${handlerError?.message || handlerError}`)
    })

    return { success: true }
  } catch (error: any) {
    const message = error?.message || '两步验证登录失败'
    lastError = message
    log.error('Telegram', `两步验证登录失败: ${message}`)
    return { success: false, error: message }
  }
}

export async function logout(): Promise<{ success: boolean; error?: string }> {
  getState()

  try {
    if (client?.connected) {
      try {
        await client.disconnect()
      } catch {
      }
    }

    client = null
    connectionState = 'disconnected'
    messageHandlerStarted = false
    lastError = null
    initPromise = null
    saveState()

    setSetting('telegram_session_string', '')
    setSetting('telegram_phone', '')

    log.info('Telegram', '已登出')

    return { success: true }
  } catch (error: any) {
    log.error('Telegram', `登出失败: ${error.message}`)
    return { success: false, error: error.message }
  }
}

export function getLoginStatus(): LoginStatus & { error?: string } {
  getState()

  const status: LoginStatus & { error?: string } = {
    connected: connectionState === 'connected',
    state: connectionState,
    error: lastError || undefined
  }

  const phone = getSetting('telegram_phone')
  if (phone) {
    status.phone = phone
  }

  return status
}

export async function getMe(): Promise<{ success: boolean; user?: any; error?: string }> {
  getState()
  
  if (!client || !client.connected) {
    return { success: false, error: '客户端未连接' }
  }

  try {
    const me = await client.getMe()
    return {
      success: true,
      user: {
        id: (me as any).id?.toString(),
        username: (me as any).username,
        phone: (me as any).phone,
        firstName: (me as any).firstName,
        lastName: (me as any).lastName
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function disconnectClient(): Promise<void> {
  getState()
  
  if (client && client.connected) {
    await client.disconnect()
  }
  client = null
  connectionState = 'disconnected'
  messageHandlerStarted = false
  saveState()
}

/**
 * 发送通知消息（双模式独立并行）
 * Bot 模式和 User 模式独立运行，互不影响：
 * - Bot 模式：私聊发给管理员，如果配置了群组则同时发群组
 * - User 模式：推送到指定群组
 * 两种模式都配置时并行发送，任一成功即返回成功
 */
export async function sendNotification(message: string, imageUrl?: string): Promise<{ success: boolean; error?: string }> {
  const botStatus = getBotLoginStatus()
  const userAvailable = !!(client?.connected) || !!(getSetting('telegram_session_string'))

  /* 如果两种模式都不可用，直接返回 */
  if (!botStatus.connected && !userAvailable) {
    return { success: false, error: 'Telegram 未配置' }
  }

  /* 收集发送结果 */
  const results: Promise<{ success: boolean; error?: string }>[] = []

  /* Bot 模式独立发送 */
  if (botStatus.connected) {
    results.push(sendBotNotification(message, imageUrl))
  }

  /* User 模式独立发送 */
  if (userAvailable) {
    results.push(sendUserNotification(message, imageUrl))
  }

  /* 并行发送，任一成功即返回成功 */
  const settled = await Promise.allSettled(results)
  const anySuccess = settled.some(r => r.status === 'fulfilled' && r.value.success)
  const errors = settled
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map(r => String(r.reason))
    .concat(
      settled
        .filter((r): r is PromiseFulfilledResult<{ success: boolean; error?: string }> => r.status === 'fulfilled' && !r.value.success)
        .map(r => r.value.error || '未知错误')
    )

  if (anySuccess) {
    return { success: true }
  }

  return { success: false, error: errors.join('; ') || '所有渠道发送失败' }
}

/**
 * 通过 User 模式发送通知
 * 推送到指定的通知群组
 */
async function sendUserNotification(message: string, imageUrl?: string): Promise<{ success: boolean; error?: string }> {
  getState()

  const notifyChat = getSetting('telegram_notify_chat')
  if (!notifyChat) {
    return { success: false, error: '未配置通知群组' }
  }

  if (!client || !client.connected) {
    if (initializing) {
      let retries = 0
      const maxRetries = 10
      while (initializing && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        getState()
        retries++
      }
      if (initializing) {
        return { success: false, error: '客户端初始化超时' }
      }
    }

    if (!client || !client.connected) {
      const initResult = await initTelegramClient()
      if (!initResult.success) {
        return { success: false, error: initResult.error }
      }
    }
  }

  try {
    /* 解析通知目标实体，解决 CHANNEL_INVALID 问题
     * GramJS 需要先获取实体信息才能发送消息，
     * 刚登录时缓存中没有频道数据，需要主动获取 */
    let entity: any
    try {
      entity = await client!.getEntity(notifyChat)
    } catch (entityError: any) {
      log.warn('Telegram', `获取通知目标实体失败: ${entityError.message}`)
      return { success: false, error: `无法找到通知目标: ${entityError.message}` }
    }

    if (imageUrl) {
      try {
        await client!.sendFile(entity, {
          file: imageUrl,
          caption: message,
          parseMode: 'html'
        })
      } catch (fileError: any) {
        /* 图片发送失败（如 URL 无效、404），回退到纯文字发送 */
        log.warn('Telegram', `图片发送失败，回退到纯文字: ${fileError.message}`)
        await client!.sendMessage(entity, {
          message,
          parseMode: 'html'
        })
      }
    } else {
      await client!.sendMessage(entity, {
        message,
        parseMode: 'html'
      })
    }
    log.success('Telegram', 'User 模式通知消息发送成功')
    return { success: true }
  } catch (error: any) {
    log.error('Telegram', `User 模式发送通知失败: ${error.message}`)
    return { success: false, error: error.message }
  }
}

export async function startMessageHandler(): Promise<void> {
  getState()
  
  if (!client) {
    log.error('Telegram', '客户端未初始化，无法启动消息处理器')
    return
  }
  
  if (messageHandlerStarted) {
    return
  }
  
  setCommandClient(client)
  
  client.addEventHandler(async (event: any) => {
    const text = event.message?.message || ''
    if (text.startsWith('-')) {
      await handleCommand(event.message)
    } else {
      await handleShareLink(event.message)
    }
  }, new NewMessage({}))
  
  messageHandlerStarted = true
  saveState()
  log.info('Telegram', '消息处理器已启动')
}
