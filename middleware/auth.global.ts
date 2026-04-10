/**
 * 全局页面路由认证守卫
 *
 * 作用：
 * - 没有系统账号时，所有页面统一引导到注册页
 * - 已有系统账号但未登录时，所有业务页统一跳到登录页
 * - 已登录后再访问登录页/注册页时，自动回到首页
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { authStatus, loadAuthStatus } = useAuth()

  /**
   * 关键兼容点：
   * - SSR / 首次进入页面时，仍然强制向服务端取最新状态
   * - 客户端路由跳转时，优先信任刚写入的本地认证状态
   *
   * 这样可以避免：
   * 登录接口刚返回成功，前端立刻 navigateTo('/')，
   * 但路由守卫又马上强制请求 /api/auth/status，
   * 在某些打包 / 内嵌环境里触发会话写入与状态校验的时序竞争，
   * 最终被误判回登录页。
   */
  const status = process.server
    ? await loadAuthStatus(true)
    : (authStatus.value || await loadAuthStatus(true))

  /**
   * 如果状态接口异常，当前守卫不强行跳转，
   * 交由页面继续渲染，避免把用户卡死在循环跳转里。
   */
  if (!status) {
    return
  }

  /**
   * 系统还没有账号时，只允许进入注册页。
   */
  if (!status.hasUsers && to.path !== '/register') {
    return navigateTo('/register')
  }

  /**
   * 系统已有账号但当前未登录时，只允许进入登录页。
   */
  if (status.hasUsers && !status.authenticated && to.path !== '/login') {
    return navigateTo('/login')
  }

  /**
   * 已登录后访问登录页或注册页，直接回首页。
   */
  if (status.authenticated && (to.path === '/login' || to.path === '/register')) {
    return navigateTo('/')
  }

  /**
   * 已有账号的情况下，禁止再访问注册页。
   */
  if (status.hasUsers && !status.authenticated && to.path === '/register') {
    return navigateTo('/login')
  }

  /**
   * 未初始化账号时，不允许访问登录页，统一跳到注册页。
   */
  if (!status.hasUsers && to.path === '/login') {
    return navigateTo('/register')
  }
})
