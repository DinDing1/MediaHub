import { defineEventHandler } from 'h3'
import { getAuthStatus } from '../../utils/auth'

/**
 * 获取当前认证状态。
 *
 * 前端会用这个接口判断：
 * - 系统是否已创建账号
 * - 当前请求是否已登录
 * - 当前登录用户名是什么
 */
export default defineEventHandler((event) => {
  return {
    success: true,
    data: getAuthStatus(event)
  }
})
