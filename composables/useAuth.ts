/**
 * 前端认证状态管理 composable
 *
 * 负责：
 * 1. 缓存当前登录状态
 * 2. 主动向服务端拉取认证状态
 * 3. 在登录/注册成功后更新本地状态
 * 4. 统一执行退出登录
 */
export interface AuthStatusData {
  hasUsers: boolean
  authenticated: boolean
  username: string | null
}

/** 认证状态接口返回结构。 */
interface AuthStatusResponse {
  success: boolean
  data: AuthStatusData
}

export function useAuth() {
  /**
   * 全局共享认证状态。
   * 使用 useState 后，页面、布局、middleware 都可以复用同一份结果。
   */
  const authStatus = useState<AuthStatusData | null>('auth-status', () => null)

  /**
   * 从服务端加载当前认证状态。
   *
   * @param force 是否强制重新请求服务端
   * - false：已有缓存时直接复用
   * - true：忽略缓存，重新请求最新状态
   */
  async function loadAuthStatus(force = false): Promise<AuthStatusData | null> {
    if (!force && authStatus.value) {
      return authStatus.value
    }

    try {
      /**
       * SSR 场景下要把当前请求的 cookie 一起转发给服务端，
       * 否则服务端无法识别当前登录态。
       */
      const headers = process.server ? useRequestHeaders(['cookie']) : undefined
      const response = await $fetch<AuthStatusResponse>('/api/auth/status', { headers })
      authStatus.value = response.data
      return response.data
    } catch {
      /**
       * 状态接口异常时，不主动抹掉本地缓存，
       * 避免页面短暂闪烁或出现无意义跳转。
       */
      return authStatus.value
    }
  }

  /** 手动写入认证状态，通常在登录/注册成功后调用。 */
  function setAuthStatus(status: AuthStatusData | null) {
    authStatus.value = status
  }

  /**
   * 退出登录。
   * 服务端会清理 session，前端同步把状态置为未登录。
   */
  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    authStatus.value = {
      hasUsers: true,
      authenticated: false,
      username: null
    }
  }

  return {
    authStatus,
    loadAuthStatus,
    setAuthStatus,
    logout
  }
}
