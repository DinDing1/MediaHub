/**
 * 调度器 / Telegram / 媒体信息队列初始化（Nitro 服务端插件）
 * 仅在服务端启动时执行。
 */
import { log } from '../utils/logger'

export default defineNitroPlugin(async () => {
  try {
    const { initScheduler } = await import('../utils/scheduler')
    initScheduler()
    log.info('bootstrap', '调度器初始化完成')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    log.error('bootstrap', `调度器初始化失败: ${message}`)
  }

  try {
    const { initMediaInfoFollowQueue } = await import('../utils/emby/media_info')
    initMediaInfoFollowQueue()
    log.info('bootstrap', '媒体信息追更队列初始化完成')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    log.error('bootstrap', `媒体信息追更队列初始化失败: ${message}`)
  }

  try {
    const { initBot } = await import('../utils/telegram/bot')
    await initBot()
    log.info('bootstrap', 'Telegram Bot 初始化完成')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    log.error('bootstrap', `Telegram Bot 初始化失败: ${message}`)
  }

  try {
    const { initTelegramClient } = await import('../utils/telegram/client')
    await initTelegramClient()
    log.info('bootstrap', 'Telegram Client 初始化完成')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    log.error('bootstrap', `Telegram Client 初始化失败: ${message}`)
  }
})
