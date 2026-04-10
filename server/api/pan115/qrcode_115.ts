/**
 * 115云盘登录API
 * GET: 获取二维码或设备类型列表
 * POST: 检查登录状态
 */
import { getQRCodeToken, checkLoginStatus, clearQRCodeToken, getDeviceTypes, hasQRCodeToken } from '../../utils/pan115/qrcode_115'
import { setSetting, getSetting } from '../../utils/db'
import { log } from '../../utils/logger'
import { getAccessTokenByCookie, saveOpenToken } from '../../utils/pan115/open115'

export default defineEventHandler(async (event) => {
  const method = event.method
  const url = new URL(event.node.req.url || '', `http://${event.node.req.headers.host}`)
  const action = url.searchParams.get('action')

  if (method === 'GET') {
    try {
      if (action === 'devices') {
        const devices = getDeviceTypes()
        return { success: true, devices }
      }

      const deviceType = url.searchParams.get('device') || 'web'
      const result = await getQRCodeToken(deviceType)
      if (result.success && result.qrcode_image) {
        return {
          success: true,
          qrcode_url: result.qrcode_url,
          qrcode_image: result.qrcode_image
        }
      } else {
        return { success: false, error: result.error || '获取二维码失败' }
      }
    } catch (error: any) {
      log.error('115云盘', '获取二维码失败', error.message)
      return { success: false, error: error.message }
    }
  }

  // POST - 检查登录状态
  if (method === 'POST') {
    try {
      if (!hasQRCodeToken()) {
        return { success: true, status: 0, message: '等待扫码' }
      }
      
      const result = await checkLoginStatus()
      
      if (result.status === 2 && result.cookie) {
        setSetting('pan115_cookie', result.cookie)
        log.success('115云盘', '扫码登录成功，Cookie已自动保存到数据库')
        
        const appId = getSetting('pan115_app_id')
        if (appId) {
          const tokenResult = await getAccessTokenByCookie(result.cookie, appId)
          if (tokenResult.success && tokenResult.openToken && tokenResult.refreshToken && tokenResult.expiresIn) {
            saveOpenToken(tokenResult.openToken, tokenResult.refreshToken, tokenResult.expiresIn)
            log.success('115开放平台', '自动获取访问令牌成功')
          } else {
            log.warn('115开放平台', `自动获取访问令牌失败: ${tokenResult.error}`)
          }
        }
        
        return {
          success: true,
          status: 2,
          cookie: result.cookie
        }
      } else if (result.status === 1) {
        return { success: true, status: 1, message: '已扫码，请确认登录' }
      } else if (result.status === 0) {
        return { success: true, status: 0, message: '等待扫码' }
      } else if (result.status === -1) {
        clearQRCodeToken()
        return { success: false, status: -1, error: '二维码已过期' }
      } else if (result.status === -2) {
        clearQRCodeToken()
        return { success: false, status: -2, error: '登录已取消' }
      }
      
      return { success: false, error: result.error || '未知状态' }
    } catch (error: any) {
      log.error('115云盘', '检查登录状态失败', error.message)
      return { success: false, error: error.message }
    }
  }

  return { success: false, error: '不支持的请求方法: ' + method }
})
