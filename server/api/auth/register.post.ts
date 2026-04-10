import { defineEventHandler, readBody } from 'h3'
import { createAuthSession, notifyAuthResult, registerSystemUser } from '../../utils/auth'

/**
 * 系统首次注册接口
 *
 * 说明：
 * - 当前系统只允许创建首个系统账号
 * - 注册成功后会直接创建登录会话，用户无需再次手动登录
 * - 注册结果通知异步发送，失败不影响主流程
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event) as { username?: string; password?: string }
  const username = body.username || ''

  try {
    /** 创建系统账号，并立即建立登录会话。 */
    const user = registerSystemUser(username, body.password || '')
    createAuthSession(event, user.id, true)
    void notifyAuthResult(event, 'register', user.username, true)

    return {
      success: true,
      data: {
        username: user.username
      }
    }
  } catch (error: any) {
    /**
     * 注册失败时直接返回具体错误。
     * 例如：用户名不合法、密码过短、系统账号已存在等。
     */
    void notifyAuthResult(event, 'register', username, false, error.message || '注册失败')

    return {
      success: false,
      error: error.message || '注册失败'
    }
  }
})
