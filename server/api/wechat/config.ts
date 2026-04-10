/**
 * 微信配置 API
 * 
 * GET  - 获取微信配置和连接状态
 * POST - 执行操作（获取二维码、登出、初始化等）
 */

import { defineEventHandler, getMethod, readBody } from 'h3'
import { getSetting, setSetting } from '../../utils/db'
import {
  getLoginQRCode,
  getWechatLoginStatus,
  wechatLogout,
  initWechatClient
} from '../../utils/wechat/client'

export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  /**
   * GET 请求：获取微信配置和连接状态
   */
  if (method === 'GET') {
    const token = getSetting('wechat_token')
    const botId = getSetting('wechat_bot_id')
    const userId = getSetting('wechat_user_id')
    const notifyUserId = getSetting('wechat_notify_user_id')

    let status = getWechatLoginStatus()

    if (!status.connected && token) {
      initWechatClient().catch(e => {
        console.error('后台初始化微信客户端失败:', e)
      })
    }

    return {
      success: true,
      data: {
        configured: !!token,
        token: token || '',
        tokenConfigured: !!token,
        botId: botId || '',
        userId: userId || '',
        notifyUserId: notifyUserId || '',
        status: status.state,
        connected: status.connected
      }
    }
  }

  /**
   * POST 请求：执行操作
   * 
   * action 参数：
   * - getQRCode: 获取登录二维码
   * - logout: 登出
   * - init: 初始化客户端
   */
  if (method === 'POST') {
    try {
      const body = await readBody(event)
      const { action } = body

      if (action === 'getQRCode') {
        const forceRefresh = body.forceRefresh === true
        const result = await getLoginQRCode(forceRefresh)
        return result
      }

      if (action === 'logout') {
        const result = await wechatLogout()
        return result
      }

      if (action === 'init') {
        const result = await initWechatClient()
        return result
      }

      return { success: false, error: '未知操作' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  return { success: false, error: '不支持的请求方法' }
})
