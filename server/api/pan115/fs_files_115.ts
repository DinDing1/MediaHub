/**
 * 115 云盘文件列表 API
 * 用于目录选择器获取子目录
 */
import { listFiles } from '../../utils/organize/fs_115'
import { getSetting } from '../../utils/db'
import { log } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method !== 'GET' && method !== 'POST') {
    setResponseStatus(event, 405)
    return { success: false, error: '不支持的请求方法: ' + method }
  }

  let cid = '0'
  if (method === 'GET') {
    const query = getQuery(event)
    cid = String(query.cid || '0')
  } else {
    const body = await readBody(event).catch(() => ({} as any))
    cid = String(body?.cid || '0')
  }

  const cookie = getSetting('pan115_cookie')
  if (!cookie) {
    return { success: false, error: '未配置 Cookie，请先扫码登录 115' }
  }

  try {
    const result = await listFiles(cookie, cid, false)
    if (!result.success) {
      log.warn('115云盘', `目录列表失败 cid=${cid}: ${result.error}`)
    }
    return result
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    log.error('115云盘', `目录列表异常: ${message}`)
    return { success: false, error: message }
  }
})
