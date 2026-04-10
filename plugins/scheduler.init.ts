/**
 * 调度器初始化插件
 * 在Nuxt服务端启动时初始化定时任务调度器和Telegram客户端
 */
export default defineNuxtPlugin(() => {
  if (process.server) {
    import('~/server/utils/scheduler').then(({ initScheduler }) => {
      initScheduler()
    })
    import('~/server/utils/emby/media_info').then(({ initMediaInfoFollowQueue }) => {
      initMediaInfoFollowQueue()
    })
  }
})
