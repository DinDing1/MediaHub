/**
 * 调度器 / Telegram 初始化（Nitro 服务端插件）
 * 仅在服务端启动时执行，避免从前端插件动态 import server 模块。
 */
export default defineNitroPlugin(() => {
  import('../utils/scheduler').then(({ initScheduler }) => {
    initScheduler()
  }).catch(() => {})

  import('../utils/emby/media_info').then(({ initMediaInfoFollowQueue }) => {
    initMediaInfoFollowQueue()
  }).catch(() => {})

  import('../utils/telegram/bot').then(({ initBot }) => {
    initBot().catch(() => {})
  }).catch(() => {})

  import('../utils/telegram/client').then(({ initTelegramClient }) => {
    initTelegramClient().catch(() => {})
  }).catch(() => {})
})
