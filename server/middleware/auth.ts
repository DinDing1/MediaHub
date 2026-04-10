import { defineEventHandler, getRequestURL, sendError } from 'h3'
import { createError } from 'h3'
import { getAuthenticatedUser, hasSystemUsers } from '../utils/auth'

/**
 * 不需要登录即可访问的公开认证接口。
 * 例如登录、注册、获取当前认证状态，以及外部系统回调入口。
 */
const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/emby/webhook',
  '/api/d115'
]

/**
 * 服务端 API 认证中间件
 *
 * 目标：
 * - 保护所有业务 API，防止只靠前端页面跳转形成“伪保护”
 * - 未初始化账号时，仅允许访问公开 API
 * - 已初始化账号后，只有已登录请求才能访问业务 API
 */
export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname

  /** 只处理 /api/ 请求，页面与静态资源不在这里拦截。 */
  if (!pathname.startsWith('/api/')) {
    return
  }

  /** 公开 API 直接放行。 */
  if (PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return
  }

  /**
   * 还没有任何系统账号时，所有业务 API 一律拒绝访问，
   * 用户必须先完成首次注册。
   */
  if (!hasSystemUsers()) {
    return sendError(event, createError({
      statusCode: 401,
      message: '系统未初始化账号，请先注册'
    }))
  }

  /**
   * 读取当前请求的登录用户。
   * 若存在，则挂到 event.context 上供后续接口直接使用。
   */
  const user = getAuthenticatedUser(event)
  if (user) {
    event.context.authUser = user
    return
  }

  /** 未登录或会话已失效，统一返回 401。 */
  return sendError(event, createError({
    statusCode: 401,
    message: '未登录或登录已失效'
  }))
})
