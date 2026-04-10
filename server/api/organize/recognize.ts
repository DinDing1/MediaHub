/**
 * 云盘整理 - 识别API
 * 根据文件名识别媒体信息
 */
import { recognizeFile } from '../../utils/organize'
import { getSetting } from '../../utils/db'
import { log } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'POST') {
    try {
      const body = await readBody(event)
      const { fileName, folderFiles, isFolder, forceMediaType, forceTmdbId } = body

      if (!fileName || !fileName.trim()) {
        return { success: false, error: '文件名不能为空' }
      }

      const tmdbApiKey = getSetting('tmdb_api_key')
      if (!tmdbApiKey) {
        return { success: false, error: '未配置TMDB API Key，请在参数配置中设置' }
      }

      const result = await recognizeFile(
        fileName.trim(), 
        forceMediaType || undefined, 
        forceTmdbId || undefined,
        folderFiles, 
        isFolder || false
      )

      if (!result) {
        return { success: false, error: '无法识别该文件，请检查文件名格式或TMDB API配置' }
      }

      log.success('整理', `识别成功: ${fileName} -> ${result.title}`)

      return {
        success: true,
        data: result
      }
    } catch (error: any) {
      log.error('整理', `识别失败: ${error.message}`)
      return { success: false, error: error.message || '识别失败' }
    }
  }

  return { success: false, error: '不支持的请求方法: ' + method }
})
