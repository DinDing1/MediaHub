/**
 * 115云盘文件列表API
 * 用于获取目录文件列表
 * 用户浏览时需要获取最新数据，不使用缓存
 */
import { listFiles } from '../../utils/organize/fs_115'
import { getSetting } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET' || method === 'POST') {
    let cid = '0'
    
    if (method === 'GET') {
      const query = getQuery(event)
      cid = (query.cid as string) || '0'
    } else {
      const body = await readBody(event)
      cid = body?.cid || '0'
    }

    const cookie = getSetting('pan115_cookie')
    if (!cookie) {
      return { success: false, error: '未配置Cookie' }
    }

    const result = await listFiles(cookie, cid, false)
    return result
  }

  return { success: false, error: '不支持的请求方法: ' + method }
})
