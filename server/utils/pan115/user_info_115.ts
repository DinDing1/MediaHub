/**
 * 115云盘用户信息工具
 * 用于验证Cookie有效性和获取用户信息
 */

import { log } from '../logger'

const LOGIN_STATUS_URL = 'https://my.115.com/?ct=guide&ac=status'
const USER_INFO_URL = 'https://my.115.com/?ct=ajax&ac=get_user_aq'

interface UserInfoResult {
  success: boolean
  user_name?: string
  user_id?: number
  is_vip?: number
  error?: string
}

/**
 * 检查登录状态
 */
async function checkLoginStatus(cookie: string): Promise<boolean> {
  try {
    const response = await fetch(LOGIN_STATUS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookie,
        'Referer': 'https://115.com/'
      }
    })

    if (response.ok) {
      const result = await response.json()
      return result.state === true
    }
    return false
  } catch (e: any) {
    log.error('115云盘', `检查登录状态异常: ${e.message}`)
    return false
  }
}

/**
 * 获取用户信息
 */
export async function getUserInfo(cookie: string): Promise<UserInfoResult> {
  if (!cookie || !cookie.trim()) {
    log.error('115云盘', 'Cookie为空')
    return { success: false, error: 'Cookie为空' }
  }

  const isLoggedIn = await checkLoginStatus(cookie)
  if (!isLoggedIn) {
    log.error('115云盘', 'Cookie已失效')
    return { success: false, error: 'Cookie已失效' }
  }

  try {
    const response = await fetch(USER_INFO_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookie,
        'Referer': 'https://115.com/'
      }
    })

    if (response.ok) {
      const result = await response.json()
      
      if (result.state && result.data) {
        const data = result.data
        log.success('115云盘', `Cookie有效，用户: ${data.uname || '未知'}`)
        return {
          success: true,
          user_name: data.uname,
          user_id: data.uid,
          is_vip: data.vip?.is_vip ? 1 : 0
        }
      } else {
        log.error('115云盘', `获取用户信息失败: ${JSON.stringify(result)}`)
        return { success: false, error: '获取用户信息失败' }
      }
    }
    
    log.error('115云盘', `获取用户信息请求失败: ${response.status}`)
    return { success: false, error: '请求失败' }
  } catch (e: any) {
    log.error('115云盘', `获取用户信息异常: ${e.message}`)
    return { success: false, error: e.message }
  }
}
