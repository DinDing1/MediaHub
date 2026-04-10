/**
 * 115云盘用户信息API
 * 用于检测Cookie有效性
 */
import { getUserInfo } from '../../utils/pan115/user_info_115'
import { getSetting } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET') {
    const cookie = getSetting('pan115_cookie')
    if (!cookie) {
      return { success: true, valid: false, message: '未配置Cookie' }
    }
    
    const result = await getUserInfo(cookie)
    if (result.success) {
      return {
        success: true,
        valid: true,
        user_name: result.user_name,
        user_id: result.user_id,
        is_vip: result.is_vip
      }
    } else {
      return {
        success: true,
        valid: false,
        message: result.error || 'Cookie已失效'
      }
    }
  }

  return { success: false, error: '不支持的请求方法: ' + method }
})
