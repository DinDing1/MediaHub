/**
 * Emby初始化数据API
 * 获取仪表盘所需的统计数据、媒体库、最近入库和最近播放
 */
import { getEmbyConfig, getLibraries, getStatistics, getRecentlyAdded, getRecentlyPlayed, getRecentAddedStats } from '../../utils/emby/emby'
import { log } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method !== 'GET') {
    return { success: false, error: '不支持的请求方法: ' + method }
  }

  try {
    const config = await getEmbyConfig()

    // 检查配置是否存在
    if (!config || !config.baseUrl || !config.apiKey) {
      log.warn('仪表盘', 'Emby未配置，请先在参数配置中设置Emby连接信息')
      return {
        success: false,
        error: 'Emby未配置',
        hasConfig: false,
        data: null
      }
    }

    log.info('仪表盘', '正在加载仪表盘数据...')

    // 配置存在，尝试获取数据
    const [statistics, recentAddedStats, libraries, recentAdded, recentPlayed] = await Promise.all([
      getStatistics(),
      getRecentAddedStats(),
      getLibraries(),
      // 最近入库和最近播放预取更多数据，前端再按容器宽度自适应展示数量
      getRecentlyAdded(12),
      getRecentlyPlayed(12)
    ])

    log.success('仪表盘', `数据加载成功 - 媒体库: ${libraries.length}, 电影: ${statistics.movieCount}, 电视剧: ${statistics.tvCount}`)

    return {
      success: true,
      hasConfig: true,
      data: { statistics, recentAddedStats, libraries, recentAdded, recentPlayed }
    }
  } catch (error: any) {
    log.error('仪表盘', '获取Emby数据失败', error.message)
    // 连接失败但配置存在
    return {
      success: false,
      error: error.message || '获取Emby数据失败',
      hasConfig: true,
      data: null
    }
  }
})
