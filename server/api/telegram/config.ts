/**
 * Telegram 配置 API
 * 用于管理 Telegram 用户客户端的配置和登录
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

    let status = getLoginStatus()
    let user = null

    if (!status.connected && status.state === 'disconnected' && apiId && apiHash && sessionString) {
      void initTelegramClient().catch(() => {})
      status = {
        ...status,
        state: 'connecting',
        error: undefined
      }
    }

    if (status.connected) {
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
        configured: !!(apiId && apiHash),
        apiId: apiId || '',
        apiHash: apiHash || '',
        apiHashConfigured: !!apiHash,
        phone: phone || '',
        proxyEnabled: proxyEnabled === 'true',
        proxyUrl: proxyUrl || '',
        adminIds: adminIds || '',
        whitelistChats: whitelistChats || '',
        notifyChat: notifyChat || '',
        status: status.state,
        connected: status.connected,
        error: status.error,
        user
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
