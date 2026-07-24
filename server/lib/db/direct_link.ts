/**
 * 115 直链缓存
 */
import { getDB } from './connection'

export interface DirectLinkCache {
  pickcode: string
  file_id: number | null
  download_url: string
  expire_ts: number
  user_agent: string | null
  created_at: string
  updated_at: string
}

export function getDirectLinkCache(pickcode: string, userAgent?: string): DirectLinkCache | null {
  const database = getDB()
  const stmt = database.prepare('SELECT * FROM direct_link_115 WHERE pickcode = ?')
  const row = stmt.get(pickcode) as DirectLinkCache | undefined
  
  if (!row) return null
  
  if (Date.now() / 1000 >= row.expire_ts) {
    return null
  }
  
  if (userAgent && row.user_agent && row.user_agent !== userAgent) {
    return null
  }
  
  return row
}

export function saveDirectLinkCache(
  pickcode: string,
  fileId: number | null,
  downloadUrl: string,
  expireTs: number,
  userAgent?: string
): void {
  const database = getDB()
  const stmt = database.prepare(`
    INSERT INTO direct_link_115 (pickcode, file_id, download_url, expire_ts, user_agent, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(pickcode) DO UPDATE SET
      file_id = excluded.file_id,
      download_url = excluded.download_url,
      expire_ts = excluded.expire_ts,
      user_agent = excluded.user_agent,
      updated_at = CURRENT_TIMESTAMP
  `)
  stmt.run(pickcode, fileId, downloadUrl, expireTs, userAgent || null)
}


/**
 * 追更持久化队列中的单条记录。
 */
