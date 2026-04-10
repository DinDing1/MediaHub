/**
 * 缓存状态API
 * GET: 获取缓存统计信息
 * DELETE: 清空缓存
 */
import { getFsCache, clearFsCache, getFsCacheStats } from '../../utils/organize/fs_cache'
import { log } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET') {
    try {
      const stats = getFsCacheStats()
      return {
        success: true,
        data: {
          dirCacheCount: stats.dirCacheCount,
          pathCacheCount: stats.pathCacheCount,
          tmdbCacheCount: stats.tmdbCacheCount,
          message: `目录缓存: ${stats.dirCacheCount}, 路径缓存: ${stats.pathCacheCount}, TMDB缓存: ${stats.tmdbCacheCount}`
        }
      }
    } catch (error: any) {
      log.error('缓存', '获取缓存状态失败', error.message)
      return { success: false, error: error.message }
    }
  }

  if (method === 'DELETE') {
    try {
      clearFsCache()
      log.success('缓存', '缓存已清空')
      return {
        success: true,
        message: '缓存已清空'
      }
    } catch (error: any) {
      log.error('缓存', '清空缓存失败', error.message)
      return { success: false, error: error.message }
    }
  }

  return { success: false, error: '不支持的请求方法' }
})
