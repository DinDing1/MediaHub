/**
 * 云盘整理 - 文件列表API
 * 获取云盘保存目录下的文件列表
 * 用户浏览时需要获取最新数据，不使用缓存
 */
import { listFiles } from '../../utils/organize/fs_115'
import { getSetting } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET' || method === 'POST') {
    let cid = ''
    
    if (method === 'GET') {
      const query = getQuery(event)
      cid = (query.cid as string) || ''
    } else {
      const body = await readBody(event)
      cid = body?.cid || ''
    }

    const cookie = getSetting('pan115_cookie')
    if (!cookie) {
      return { success: false, error: '未配置115云盘Cookie' }
    }

    const saveDir = getSetting('pan115_save_dir')
    const mediaDir = getSetting('pan115_media_dir')

    const dirId = cid || saveDir || '0'

    const result = await listFiles(cookie, dirId, false)

    return {
      ...result,
      saveDir,
      mediaDir
    }
  }

  return { success: false, error: '不支持的请求方法' }
})
