/**
 * Telegram 配置 API
 * 同时支持 Bot 模式和用户模式，两种模式可并行运行
 * 配置了哪个就启用哪个，都配置则都启用
 */
import { defineEventHandler, getMethod, readBody } from 'h3'
import { getSetting, setSetting } from '../../utils/db'
import {
  sendCode,
  signIn,
  signInWithPassword,
  logout,
  getLoginStatus,
  getMe,
  initTelegramClient
} from '../../utils/telegram/client'
import { initBot, disconnectBot, getBotLoginStatus } from '../../utils/telegram/bot'

const phoneCodeHashStore: Map<string, string> = new Map()
let cachedUser: any = null
let lastUserFetch = 0
const USER_CACHE_TTL = 60000

export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  if (method === 'GET') {
    const apiId = getSetting('telegram_api_id')
    const apiHash = getSetting('telegram_api_hash')
    const phone = getSetting('telegram_phone')
    const proxyEnabled = getSetting('telegram_proxy_enabled')
    const proxyUrl = getSetting('telegram_proxy_url')
    const adminIds = getSetting('telegram_admin_ids')
    const whitelistChats = getSetting('telegram_whitelist_chats')
    const notifyChat = getSetting('telegram_notify_chat')
    const sessionString = getSetting('telegram_session_string') || ''
    const botToken = getSetting('telegram_bot_token')

    /* Bot 模式状态 */
    const botStatus = getBotLoginStatus()
    const botInfo = botStatus.botInfo || null
    const botConfigured = !!botToken

    /* 如果 Bot 已配置但未连接，自动尝试初始化 */
    if (!botStatus.connected && botToken) {
      void initBot().catch(() => {})
    }

    /* User 模式状态 */
    const userStatus = getLoginStatus()
    let user = null

    /* 如果 User 已配置但未连接，自动尝试初始化 */
    if (!userStatus.connected && userStatus.state === 'disconnected' && apiId && apiHash && sessionString) {
      void initTelegramClient().catch(() => {})
    }

    /* 获取 User 信息（已连接时） */
    if (userStatus.connected) {
      const now = Date.now()
      if (cachedUser && (now - lastUserFetch) < USER_CACHE_TTL) {
        user = cachedUser
      } else {
        const meResult = await getMe()
        if (meResult.success) {
          user = meResult.user
          cachedUser = meResult.user
          lastUserFetch = now
        }
      }
    }

    return {
      success: true,
      data: {
        /* Bot 模式 */
        botConfigured,
        botConnected: botStatus.connected,
        botStatus: botStatus.state,
        botInfo,
        botToken: botToken || '',

        /* User 模式 */
        userConfigured: !!(apiId && apiHash),
        userConnected: userStatus.connected,
        userStatus: userStatus.state,
        userError: userStatus.error,
        user,
        apiId: apiId || '',
        apiHash: apiHash || '',
        apiHashConfigured: !!apiHash,
        phone: phone || '',

        /* 通用配置 */
        proxyEnabled: proxyEnabled === 'true',
        proxyUrl: proxyUrl || '',
        adminIds: adminIds || '',
        whitelistChats: whitelistChats || '',
        notifyChat: notifyChat || ''
      }
    }
  }

  if (method === 'POST') {
    try {
      const body = await readBody(event)
      const {
        action,
        apiId,
        apiHash,
        phone,
        code,
        password,
        botToken,
        proxyEnabled,
        proxyUrl,
        adminIds,
        whitelistChats,
        notifyChat
      } = body

      if (action === 'saveConfig') {
        if (apiId) {
          setSetting('telegram_api_id', apiId.toString())
        }
        setSetting('telegram_api_hash', apiHash || '')
        if (phone) {
          setSetting('telegram_phone', phone)
        }
        if (botToken !== undefined && botToken !== '') {
          setSetting('telegram_bot_token', botToken)
        }

        setSetting('telegram_proxy_enabled', proxyEnabled ? 'true' : 'false')
        setSetting('telegram_proxy_url', proxyUrl || '')

        if (adminIds !== undefined) {
          setSetting('telegram_admin_ids', adminIds || '')
        }
        if (whitelistChats !== undefined) {
          setSetting('telegram_whitelist_chats', whitelistChats || '')
        }
        if (notifyChat !== undefined) {
          setSetting('telegram_notify_chat', notifyChat || '')
        }

        return { success: true, message: '配置已保存' }
      }

      /* Bot 模式操作 */
      if (action === 'initBot') {
        const result = await initBot()
        return result
      }

      if (action === 'disconnectBot') {
        await disconnectBot()
        return { success: true }
      }

      /* User 模式操作 */
      if (action === 'init') {
        const result = await initTelegramClient()
        if (!result.success) {
          return result
        }
        return { success: true }
      }

      if (action === 'sendCode') {
        if (!phone) {
          return { success: false, error: '手机号不能为空' }
        }

        const result = await sendCode(phone)
        if (result.success && result.phoneCodeHash) {
          phoneCodeHashStore.set(phone, result.phoneCodeHash)
        }
        return result
      }

      if (action === 'signIn') {
        if (!phone || !code) {
          return { success: false, error: '手机号和验证码不能为空' }
        }

        const phoneCodeHash = phoneCodeHashStore.get(phone)
        if (!phoneCodeHash) {
          return { success: false, error: '请先发送验证码' }
        }

        const result = await signIn(phone, code)
        if (result.success) {
          cachedUser = null
          phoneCodeHashStore.delete(phone)
        }
        return result
      }

      if (action === 'signInWithPassword') {
        if (!password) {
          return { success: false, error: '密码不能为空' }
        }

        const result = await signInWithPassword(password)
        if (result.success) {
          cachedUser = null
        }
        return result
      }

      if (action === 'logout') {
        const result = await logout()
        if (result.success) {
          phoneCodeHashStore.clear()
          cachedUser = null
          lastUserFetch = 0
        }
        return result
      }

      return { success: false, error: '未知操作' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  return { success: false, error: '不支持的请求方法' }
})
