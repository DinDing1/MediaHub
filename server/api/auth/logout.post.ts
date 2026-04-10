import { defineEventHandler } from 'h3'
import { clearAuthSession } from '../../utils/auth'

/**
 * 退出登录接口
 *
 * 作用：
 * - 删除数据库中的当前会话记录
 * - 清除浏览器中的登录 Cookie
 */
export default defineEventHandler((event) => {
  clearAuthSession(event)

  return {
    success: true,
    message: '已退出登录'
  }
})
