/**
 * 115云盘扫码登录工具
 * 用于获取二维码、检查登录状态、获取Cookie
 */

import { log } from '../logger'

const BASE_URL = 'https://passportapi.115.com'

interface QRCodeToken {
  uid: string
  time: string
  sign: string
  qrcode: string
}

interface DeviceType {
  app: string
  name: string
}

const DEVICE_TYPES: Record<string, DeviceType> = {
  web: { app: 'web', name: '网页端' },
  android: { app: 'android', name: '安卓' },
  ios: { app: 'ios', name: 'iOS' },
  alipaymini: { app: 'alipaymini', name: '支付宝小程序' },
  wechatmini: { app: 'wechatmini', name: '微信小程序' }
}

let qrcodeToken: QRCodeToken | null = null
let currentDeviceType: string = 'web'

/**
 * 获取设备类型列表
 */
export function getDeviceTypes(): { value: string; label: string }[] {
  return Object.entries(DEVICE_TYPES).map(([key, value]) => ({
    value: key,
    label: value.name
  }))
}

/**
 * 设置设备类型
 */
export function setDeviceType(deviceType: string): void {
  if (DEVICE_TYPES[deviceType]) {
    currentDeviceType = deviceType
  }
}

/**
 * 检查是否有有效的二维码token
 */
export function hasQRCodeToken(): boolean {
  return qrcodeToken !== null
}

/**
 * 获取二维码登录token
 */
export async function getQRCodeToken(deviceType: string = 'web'): Promise<{ success: boolean; qrcode_url?: string; qrcode_image?: string; error?: string }> {
  try {
    const device = DEVICE_TYPES[deviceType]
    if (!device) {
      log.error('115云盘', `无效的设备类型: ${deviceType}`)
      return { success: false, error: '无效的设备类型' }
    }
    
    const app = device.app
    currentDeviceType = deviceType

    const response = await fetch(`${BASE_URL}/api/1.0/${app}/1.0/token/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://115.com/',
        'Origin': 'https://115.com'
      }
    })

    if (response.ok) {
      const result = await response.json()
      
      if (result.state === 1 && result.data) {
        const tokenData = result.data
        qrcodeToken = tokenData
        
        if (!tokenData.qrcode) {
          log.error('115云盘', '二维码数据为空')
          return { success: false, error: '二维码数据为空' }
        }
        
        const qrcodeImage = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(tokenData.qrcode)}`
        
        log.success('115云盘', '获取二维码成功')
        return {
          success: true,
          qrcode_url: tokenData.qrcode,
          qrcode_image: qrcodeImage
        }
      } else {
        const errorMsg = result.error || result.msg || '获取二维码token失败'
        log.error('115云盘', `获取二维码失败: ${errorMsg}`)
        return { success: false, error: errorMsg }
      }
    }
    
    log.error('115云盘', `获取二维码token失败，HTTP状态: ${response.status}`)
    return { success: false, error: `请求失败，状态码: ${response.status}` }
  } catch (e: any) {
    log.error('115云盘', `获取二维码异常: ${e.message}`)
    return { success: false, error: e.message }
  }
}

/**
 * 检查登录状态
 */
export async function checkLoginStatus(): Promise<{ status: number; cookie?: string; error?: string }> {
  if (!qrcodeToken) {
    return { status: 0, error: '等待获取二维码' }
  }

  try {
    const params = new URLSearchParams({
      uid: qrcodeToken.uid,
      time: qrcodeToken.time,
      sign: qrcodeToken.sign
    })

    const response = await fetch(`https://qrcodeapi.115.com/get/status/?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://115.com/'
      }
    })

    if (response.ok) {
      const result = await response.json()
      
      if (result.state === 1) {
        const status = result.data?.status
        
        if (status === 2) {
          const cookieResult = await getLoginResult(qrcodeToken.uid)
          if (cookieResult.success && cookieResult.cookie) {
            return { status: 2, cookie: cookieResult.cookie }
          } else {
            return { status: -1, error: cookieResult.error || '获取Cookie失败' }
          }
        }
        
        return { status }
      } else {
        return { status: 0, error: '状态检查中' }
      }
    }
    
    return { status: 0, error: '检查状态请求失败' }
  } catch (e: any) {
    log.error('115云盘', `检查登录状态异常: ${e.message}`)
    return { status: 0, error: `检查异常: ${e.message}` }
  }
}

/**
 * 获取登录结果
 */
async function getLoginResult(uid: string): Promise<{ success: boolean; cookie?: string; error?: string }> {
  try {
    const app = DEVICE_TYPES[currentDeviceType]?.app || 'web'
    
    const formData = new URLSearchParams({
      app: app,
      account: uid
    })

    const response = await fetch(`${BASE_URL}/app/1.0/${app}/1.0/login/qrcode/`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://115.com/',
        'Origin': 'https://115.com',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    })

    if (response.ok) {
      const result = await response.json()
      
      if (result.state === 1) {
        const data = result.data || {}
        const cookieObj = data.cookie || {}
        const cookieParts: string[] = []
        
        if (cookieObj.UID) cookieParts.push(`UID=${cookieObj.UID}`)
        if (cookieObj.CID) cookieParts.push(`CID=${cookieObj.CID}`)
        if (cookieObj.SEID) cookieParts.push(`SEID=${cookieObj.SEID}`)
        if (cookieObj.KID) cookieParts.push(`KID=${cookieObj.KID}`)
        
        const cookieStr = cookieParts.join('; ')
        
        if (cookieStr) {
          log.success('115云盘', `登录成功，用户: ${data.user_name || '未知'}`)
          return { success: true, cookie: cookieStr }
        } else {
          log.error('115云盘', 'Cookie为空')
          return { success: false, error: 'Cookie为空' }
        }
      } else {
        log.error('115云盘', `登录失败: ${result.error || '未知错误'}`)
      }
    }
    
    log.error('115云盘', '获取登录结果失败')
    return { success: false, error: '获取登录结果失败' }
  } catch (e: any) {
    log.error('115云盘', `获取登录结果异常: ${e.message}`)
    return { success: false, error: e.message }
  }
}

/**
 * 清除二维码token
 */
export function clearQRCodeToken(): void {
  qrcodeToken = null
}
