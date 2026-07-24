/**
 * 前端日志：开发环境输出到控制台，生产环境默认静默（error 仍可上报到控制台一次）
 */
const isDev = import.meta.dev

function fmt(scope: string, args: unknown[]): unknown[] {
  return scope ? [`[${scope}]`, ...args] : args
}

export const clientLog = {
  debug(scope: string, ...args: unknown[]) {
    if (isDev) console.debug(...fmt(scope, args))
  },
  info(scope: string, ...args: unknown[]) {
    if (isDev) console.info(...fmt(scope, args))
  },
  warn(scope: string, ...args: unknown[]) {
    if (isDev) console.warn(...fmt(scope, args))
  },
  error(scope: string, ...args: unknown[]) {
    // 错误在生产也保留，便于用户反馈时从控制台截取
    console.error(...fmt(scope, args))
  }
}

export default clientLog
