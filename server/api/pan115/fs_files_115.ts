/**
 * 115 file list API
 */
import { listFiles } from '../../utils/organize/fs_115'
import { getSetting } from '../../utils/db'
import { log } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  setResponseStatus(event, 200)

  const method = event.method
  if (method !== 'GET' && method !== 'POST') {
    return { success: false, error: 'unsupported method: ' + method }
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
    return { success: false, error: "未配置 Cookie，请先扫码登录 115" }
  }

  try {
    const result = await listFiles(cookie, cid, false)
    if (!result.success) {
      log.warn('115', `list failed cid=${cid}: ${result.error}`)
    }
    return result
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    log.error('115', 'list exception: ' + message)
    return { success: false, error: message }
  }
})
