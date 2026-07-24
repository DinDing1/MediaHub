/**
 * 媒体信息追更持久化队列
 */
import { getDB } from './connection'

export interface MediaInfoFollowQueueRecord {
  id: number
  item_id: string
  item_name: string
  library_name: string | null
  item_type: string | null
  source: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  fail_reason: string | null
  retry_count: number
  last_error_at: string | null
  created_at: string
  updated_at: string
  processed_at: string | null
}

/**
 * 追更队列按状态汇总后的统计结果。
 */
export interface MediaInfoFollowQueueStats {
  pending: number
  processing: number
  failed: number
}

/**
 * 新媒体入队时写入数据库的字段。
 */
export interface EnqueueMediaInfoFollowItemInput {
  itemId: string
  itemName: string
  libraryName?: string
  itemType?: string
  source?: string
}

/**
 * 将媒体项写入追更持久化队列。
 * 若同一媒体仍处于待处理或处理中，则直接复用已有记录，避免重复入队。
 */
export function enqueueMediaInfoFollowItem(input: EnqueueMediaInfoFollowItemInput): { queued: boolean; recordId?: number } {
  const database = getDB()
  const existingStmt = database.prepare(`
    SELECT id FROM media_info_follow_queue
    WHERE item_id = ? AND status IN ('pending', 'processing')
    ORDER BY id DESC
    LIMIT 1
  `)
  const existing = existingStmt.get(input.itemId) as { id: number } | undefined
  if (existing) {
    return { queued: false, recordId: existing.id }
  }

  const insertStmt = database.prepare(`
    INSERT INTO media_info_follow_queue (
      item_id,
      item_name,
      library_name,
      item_type,
      source,
      status,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
  `)
  const result = insertStmt.run(
    input.itemId,
    input.itemName,
    input.libraryName || null,
    input.itemType || null,
    input.source || 'emby_webhook'
  )

  return { queued: true, recordId: result.lastInsertRowid as number }
}

/**
 * 服务启动时重置遗留的 processing 记录。
 * 避免异常退出后队列卡在“处理中”。
 */
export function resetProcessingMediaInfoFollowQueueItems(): number {
  const database = getDB()
  const stmt = database.prepare(`
    UPDATE media_info_follow_queue
    SET status = 'pending',
        updated_at = CURRENT_TIMESTAMP,
        fail_reason = COALESCE(fail_reason, '服务重启后重置为待处理')
    WHERE status = 'processing'
  `)
  const result = stmt.run()
  return result.changes
}

/**
 * 领取一批待处理队列项，并原子地标记为 processing。
 */
export function claimPendingMediaInfoFollowQueueItems(limit: number, readyBefore?: string): MediaInfoFollowQueueRecord[] {
  const database = getDB()
  const count = Math.max(1, Math.floor(limit || 1))
  const selectStmt = readyBefore
    ? database.prepare(`
      SELECT * FROM media_info_follow_queue
      WHERE status = 'pending' AND created_at <= ?
      ORDER BY id ASC
      LIMIT ?
    `)
    : database.prepare(`
      SELECT * FROM media_info_follow_queue
      WHERE status = 'pending'
      ORDER BY id ASC
      LIMIT ?
    `)
  const rows = (readyBefore
    ? selectStmt.all(readyBefore, count)
    : selectStmt.all(count)) as MediaInfoFollowQueueRecord[]

  const claimStmt = database.prepare(`
    UPDATE media_info_follow_queue
    SET status = 'processing',
        updated_at = CURRENT_TIMESTAMP,
        fail_reason = NULL
    WHERE id = ? AND status = 'pending'
  `)

  const claimed: MediaInfoFollowQueueRecord[] = []
  for (const row of rows) {
    const result = claimStmt.run(row.id)
    if (result.changes > 0) {
      claimed.push({
        ...row,
        status: 'processing',
        fail_reason: null,
        updated_at: new Date().toISOString()
      })
    }
  }

  return claimed
}

export function getOldestPendingMediaInfoFollowQueueItem(): Pick<MediaInfoFollowQueueRecord, 'id' | 'created_at'> | null {
  const database = getDB()
  const stmt = database.prepare(`
    SELECT id, created_at
    FROM media_info_follow_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC, id ASC
    LIMIT 1
  `)
  return (stmt.get() as Pick<MediaInfoFollowQueueRecord, 'id' | 'created_at'> | undefined) || null
}

/**
 * 处理成功后直接删除追更队列记录，避免完成记录持续累积。
 */
export function finalizeMediaInfoFollowQueueItem(id: number): void {
  const database = getDB()
  const stmt = database.prepare(`
    DELETE FROM media_info_follow_queue
    WHERE id = ?
  `)
  stmt.run(id)
}

/**
 * 将队列项标记为失败，并累计失败次数。
 */
export function failMediaInfoFollowQueueItem(id: number, reason: string): void {
  const database = getDB()
  const stmt = database.prepare(`
    UPDATE media_info_follow_queue
    SET status = 'failed',
        fail_reason = ?,
        retry_count = retry_count + 1,
        last_error_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  stmt.run(reason, id)
}

/**
 * 汇总追更队列各状态数量。
 */
export function getMediaInfoFollowQueueStats(): MediaInfoFollowQueueStats {
  const database = getDB()
  const stmt = database.prepare(`
    SELECT status, COUNT(*) as count
    FROM media_info_follow_queue
    GROUP BY status
  `)
  const rows = stmt.all() as Array<{ status: string; count: number }>

  return rows.reduce<MediaInfoFollowQueueStats>((acc, row) => {
    if (row.status === 'pending' || row.status === 'processing' || row.status === 'failed') {
      acc[row.status] = row.count
    }
    return acc
  }, {
    pending: 0,
    processing: 0,
    failed: 0
  })
}
