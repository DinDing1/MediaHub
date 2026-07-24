/**
 * 115 file list API for directory picker
 */
import { listFiles } from '../../utils/organize/fs_115'
import { getSetting, setSetting } from '../../utils/db'
import { log } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  // Force business JSON to stay 200 so frontend never confuses auth/route status with 115 risk-control text
  const method = event.method
  console.log('[pan115/fs_files_115] hit', method, getRequestURL(event).pathname)

  if (method !== 'GET' && method !== 'POST') {
    setResponseStatus(event, 200)
    return { success: false, error: '????????: ' + method }
  }

  let cid = '0'
  let cookieFromClient = ''
  if (method === 'GET') {
    const query = getQuery(event)
    cid = String(query.cid || '0')
    cookieFromClient = String(query.cookie || '')
  } else {
    const body = await readBody(event).catch(() => ({} as any))
    cid = String(body?.cid || '0')
    cookieFromClient = String(body?.cookie || '')
  }

  let cookie = (getSetting('pan115_cookie') || '').trim()
  if (!cookie && cookieFromClient.trim()) {
    cookie = cookieFromClient.trim()
    // persist client cookie so subsequent calls work
    try { setSetting('pan115_cookie', cookie) } catch (e: any) {
      console.warn('[pan115/fs_files_115] persist cookie failed', e?.message || e)
    }
  }

  if (!cookie) {
    console.warn('[pan115/fs_files_115] no cookie in db/request')
    setResponseStatus(event, 200)
    return { success: false, error: '??? Cookie??????? 115' }
  }

  try {
    console.log('[pan115/fs_files_115] listing cid=', cid, 'cookieLen=', cookie.length)
    const result = await listFiles(cookie, cid, false)
    console.log('[pan115/fs_files_115] result success=', result.success, 'files=', result.files?.length, 'error=', result.error)
    if (!result.success) {
      log.warn('115??', '?????? cid=' + cid + ': ' + result.error)
    } else {
      log.info('115??', '?????? cid=' + cid + ' count=' + (result.files?.length || 0))
    }
    setResponseStatus(event, 200)
    return result
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[pan115/fs_files_115] exception', message)
    log.error('115??', '??????: ' + message)
    setResponseStatus(event, 200)
    return { success: false, error: message }
  }
})
