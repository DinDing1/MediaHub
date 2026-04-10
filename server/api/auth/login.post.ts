import { defineEventHandler, readBody } from 'h3'
import { createAuthSession, hasSystemUsers, notifyAuthResult, verifySystemUser } from '../../utils/auth'

/**
 * 系统登录接口
 *
 * 处理流程：
 * 1. 读取用户名、密码、rememberMe
 * 2. 若系统尚未初始化账号，则拒绝登录并提示先注册
 * 3. 校验用户名和密码
 * 4. 成功后创建会话并返回当前用户名
 * 5. 无论成功或失败，异步发送认证结果通知
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event) as {
    username?: string
    password?: string
    rememberMe?: boolean
  }

  const username = body.username || ''

  try {
    /** 首次使用时不能登录，必须先注册系统账号。 */
    if (!hasSystemUsers()) {
      return {
        success: false,
        error: '系统未初始化账号，请先注册'
      }
    }

    /** 校验账号密码。 */
    const result = verifySystemUser(username, body.password || '')
    if (!result.success || !result.user) {
      void notifyAuthResult(event, 'login', username, false, result.error || '登录失败')
      return {
        success: false,
        error: result.error || '用户名或密码错误'
      }
    }

    /** 登录成功后创建会话。 */
    createAuthSession(event, result.user.id, !!body.rememberMe)
    void notifyAuthResult(event, 'login', result.user.username, true)

    return {
      success: true,
      data: {
        username: result.user.username
      }
    }
  } catch (error: any) {
    /**
     * 兜底异常：返回失败，同时也发失败通知。
     * 通知采用异步触发，不阻塞接口返回。
     */
    void notifyAuthResult(event, 'login', username, false, error.message || '登录失败')
    return {
      success: false,
      error: error.message || '登录失败'
    }
  }
})
