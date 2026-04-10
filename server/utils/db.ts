/**
 * 数据库工具模块
 * 用于管理SQLite数据库连接和配置存储
 */
import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

// 数据库实例
let db: Database.Database | null = null

/**
 * 配置项定义
 * key: 配置键名
 * label: 显示名称
 * description: 配置描述
 */
export const CONFIG_DEFINITIONS: Record<string, { label: string; description?: string }> = {
  emby_base_url: { label: 'Emby 地址', description: 'Emby服务器的URL地址' },
  emby_api_key: { label: 'API 密钥', description: '用于访问Emby API的密钥' },
  emby_proxy_enabled: { label: '启用反代', description: '是否启用Emby反代服务' },
  emby_proxy_port: { label: '反代端口', description: 'Emby反代服务监听端口' },
  pan115_cookie: { label: '云盘 CK', description: '115云盘Cookie凭证' },
  pan115_save_dir: { label: '云盘保存目录', description: '115云盘保存目录' },
  pan115_media_dir: { label: '云盘媒体库目录', description: '115云盘媒体库目录' },
  pan115_app_id: { label: '115开放平台AppID', description: '115开放平台应用ID，用于直链服务' },
  pan115_open_token: { label: '115开放平台Token', description: '115开放平台访问令牌' },
  pan115_refresh_token: { label: '115开放平台RefreshToken', description: '115开放平台刷新令牌，有效期1年' },
  pan115_token_expire: { label: '115开放平台Token过期时间', description: 'access_token过期时间戳' },
  tmdb_api_url: { label: 'TMDB API 地址', description: 'TMDB API代理地址，用于解决网络访问问题' },
  tmdb_api_key: { label: 'TMDB API 密钥', description: '用于访问TMDB API的密钥' },
  rename_movie_template: { label: '电影命名模板', description: '电影文件重命名模板' },
  rename_tv_template: { label: '电视剧命名模板', description: '电视剧文件重命名模板' },
  classification_strategy: { label: '分类策略', description: '媒体文件分类策略配置' },
  custom_release_groups: { label: '自定义发布组', description: '补充的发布组列表' },
  auto_organize_enabled: { label: '自动整理开关', description: '是否启用自动整理功能' },
  auto_organize_action: { label: '自动整理方式', description: '自动整理操作方式：move或copy' },
  auto_organize_cron: { label: '自动整理时间', description: 'Cron表达式，定义自动整理执行时间' },
  telegram_api_id: { label: 'Telegram API ID', description: '从 my.telegram.org 获取的 API ID' },
  telegram_api_hash: { label: 'Telegram API Hash', description: '从 my.telegram.org 获取的 API Hash' },
  telegram_phone: { label: 'Telegram 手机号', description: 'Telegram 账号手机号（含国际区号）' },
  telegram_session_string: { label: 'Telegram Session', description: 'Telegram 登录会话字符串' },
  telegram_proxy_enabled: { label: 'Telegram 代理开关', description: '是否启用代理连接 Telegram' },
  telegram_proxy_url: { label: 'Telegram 代理地址', description: 'SOCKS5 代理地址，格式: socks5://[用户名:密码@]地址:端口' },
  telegram_admin_ids: { label: 'Telegram 管理员ID', description: '管理员用户ID列表，多个用逗号分隔' },
  telegram_whitelist_chats: { label: 'Telegram 白名单群组', description: '允许响应命令的群组/频道ID列表，多个用逗号分隔' },
  telegram_notify_chat: { label: 'Telegram 通知群组', description: '接收通知消息的群组ID' },
  wechat_token: { label: '微信 Token', description: '微信 iLink Bot Token' },
  wechat_bot_id: { label: '微信 Bot ID', description: '微信 Bot 账户ID' },
  wechat_user_id: { label: '微信用户ID', description: '扫码登录的微信用户ID' },
  wechat_notify_user_id: { label: '微信通知用户ID', description: '接收通知消息的微信用户ID' },
  wechat_sync_buf: { label: '微信同步缓冲', description: '消息同步游标' },
  strm_server_url: { label: 'STRM服务器地址', description: 'STRM文件中的服务器地址，如 http://192.168.1.100:3000' },
  task_checkin_enabled: { label: '签到任务开关', description: '是否启用115自动签到' },
  task_checkin_schedule: { label: '签到任务时间', description: '签到任务执行时间' },
  task_checkin_last_run: { label: '签到上次执行', description: '签到任务上次执行时间' },
  task_clean_trash_enabled: { label: '清空回收站开关', description: '是否启用自动清空回收站' },
  task_clean_trash_schedule: { label: '清空回收站时间', description: '清空回收站任务执行时间' },
  task_clean_trash_last_run: { label: '清空回收站上次执行', description: '清空回收站任务上次执行时间' },
  fnos_cookie: { label: '飞牛论坛Cookie', description: '飞牛论坛登录Cookie' },
  task_fnos_sign_enabled: { label: '飞牛签到开关', description: '是否启用飞牛论坛自动签到' },
  task_fnos_sign_schedule: { label: '飞牛签到时间', description: '飞牛签到任务执行时间' },
  task_fnos_sign_last_run: { label: '飞牛签到上次执行', description: '飞牛签到任务上次执行时间' },
  glados_cookie: { label: 'GlaDOS Cookie', description: 'GlaDOS登录Cookie' },
  task_glados_sign_enabled: { label: 'GlaDOS签到开关', description: '是否启用GlaDOS自动签到' },
  task_glados_sign_schedule: { label: 'GlaDOS签到时间', description: 'GlaDOS签到任务执行时间' },
  task_glados_sign_last_run: { label: 'GlaDOS签到上次执行', description: 'GlaDOS签到任务上次执行时间' },
  hdhive_cookie: { label: '影巢Cookie', description: '影巢登录Cookie' },
  task_hdhive_sign_enabled: { label: '影巢签到开关', description: '是否启用影巢自动签到' },
  task_hdhive_sign_schedule: { label: '影巢签到时间', description: '影巢签到任务执行时间' },
  task_hdhive_sign_last_run: { label: '影巢签到上次执行', description: '影巢签到任务上次执行时间' },
  task_media_info_enabled: { label: '媒体信息提取开关', description: '是否启用定时批量媒体信息提取' },
  task_media_info_schedule: { label: '媒体信息提取时间', description: '定时批量媒体信息提取的执行时间' },
  task_media_info_last_run: { label: '媒体信息提取上次执行', description: '定时批量媒体信息提取上次执行时间' },
  task_media_info_library_id: { label: '媒体信息提取媒体库', description: '媒体信息提取默认作用的媒体库ID，all 表示全部媒体库' },
  task_media_info_concurrency: { label: '媒体信息提取线程数', description: '批量提取与追更队列共用的并发线程数' },
  task_media_info_follow_enabled: { label: '媒体信息追更开关', description: '是否启用新媒体入库后的自动媒体信息提取' },
  task_media_info_follow_last_run: { label: '媒体信息追更上次执行', description: '媒体信息追更队列最近一次完成处理的时间' },
  ai_recognize_enabled: { label: 'AI识别开关', description: '是否启用AI辅助识别' },
  ai_api_key: { label: 'AI API Key', description: '硅基流动API Key' },
  ai_api_url: { label: 'AI API地址', description: 'AI服务API地址，默认为硅基流动' },
  ai_model: { label: 'AI模型', description: '使用的AI模型，如Qwen/Qwen2.5-7B-Instruct' },
  path_mapping: { label: '路径映射', description: 'Emby容器路径与本地路径的映射关系，JSON数组格式' }
}

/**
 * 获取数据库实例
 * 单例模式，确保全局只有一个数据库连接
 */
export function getDB(): Database.Database {
  if (!db) {
    const dataPath = process.env.TRIM_PKGVAR ? join(process.env.TRIM_PKGVAR, 'data') : (process.env.DATABASE_PATH || join(process.cwd(), 'data'))
    if (!existsSync(dataPath)) {
      mkdirSync(dataPath, { recursive: true })
    }
    const dbPath = join(dataPath, 'config.db')
    db = new Database(dbPath) as Database.Database
    db.pragma('journal_mode = WAL')
    initTables()
  }
  return db
}

/**
 * 初始化数据库表结构
 */
function initTables(): void {
  const database = getDB()

  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      label TEXT,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  database.exec(`
    CREATE TABLE IF NOT EXISTS system_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    )
  `)

  database.exec(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      session_token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      remember_me INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES system_users(id) ON DELETE CASCADE
    )
  `)

  database.exec(`
    CREATE TABLE IF NOT EXISTS organize_115 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      original_path TEXT NOT NULL,
      target_path TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  database.exec(`
    CREATE TABLE IF NOT EXISTS direct_link_115 (
      pickcode TEXT PRIMARY KEY,
      file_id INTEGER,
      download_url TEXT NOT NULL,
      expire_ts INTEGER NOT NULL,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // TMDB 剧集纠错表
  // 用于存储用户对 TMDB 剧集集数信息的纠错数据
  // 当 TMDB 数据不准确时，用户可以手动纠错，系统会使用纠正后的集数进行缺失检测
  database.exec(`
    CREATE TABLE IF NOT EXISTS tmdb_correction (
      tmdb_id TEXT PRIMARY KEY,
      show_name TEXT NOT NULL,
      correct_total_episodes INTEGER NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  database.exec(`
    CREATE TABLE IF NOT EXISTS media_info_follow_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      library_name TEXT,
      item_type TEXT,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      fail_reason TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME
    )
  `)
}

/**
 * 获取单个配置值
 * @param key 配置键名
 * @returns 配置值，不存在则返回null
 */
export function getSetting(key: string): string | null {
  const database = getDB()
  const stmt = database.prepare('SELECT value FROM settings WHERE key = ?')
  const row = stmt.get(key) as { value: string } | undefined
  return row ? row.value : null
}

/**
 * 设置配置值
 * @param key 配置键名
 * @param value 配置值
 */
export function setSetting(key: string, value: string): void {
  const database = getDB()
  const def = CONFIG_DEFINITIONS[key]
  const stmt = database.prepare(`
    INSERT INTO settings (key, value, label, description, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      label = COALESCE(excluded.label, settings.label),
      description = COALESCE(excluded.description, settings.description),
      updated_at = CURRENT_TIMESTAMP
  `)
  stmt.run(key, value, def?.label || null, def?.description || null)
}

/**
 * 获取所有配置
 * @returns 配置键值对对象
 */
export function getAllSettings(): Record<string, string> {
  const database = getDB()
  const stmt = database.prepare('SELECT key, value FROM settings')
  const rows = stmt.all() as { key: string; value: string }[]
  const settings: Record<string, string> = {}
  for (const row of rows) {
    settings[row.key] = row.value
  }
  return settings
}

/**
 * 获取带元数据的所有配置
 * @returns 配置数组，包含key、value、label、description
 */
export function getAllSettingsWithMeta(): Array<{ key: string; value: string; label?: string; description?: string }> {
  const database = getDB()
  const stmt = database.prepare('SELECT key, value, label, description FROM settings ORDER BY key')
  return stmt.all() as Array<{ key: string; value: string; label?: string; description?: string }>
}

export interface OrganizeRecord {
  id: number
  name: string
  original_path: string
  target_path: string
  action: 'move' | 'copy'
  status: 'success' | 'failed'
  created_at: string
}

export function addOrganizeRecord(
  name: string,
  originalPath: string,
  targetPath: string,
  action: 'move' | 'copy',
  status: 'success' | 'failed'
): number {
  const database = getDB()
  const stmt = database.prepare(`
    INSERT INTO organize_115 (name, original_path, target_path, action, status)
    VALUES (?, ?, ?, ?, ?)
  `)
  const result = stmt.run(name, originalPath, targetPath, action, status)
  return result.lastInsertRowid as number
}

export function getOrganizeRecords(limit: number = 100, offset: number = 0): OrganizeRecord[] {
  const database = getDB()
  const stmt = database.prepare(`
    SELECT id, name, original_path, target_path, action, status, created_at
    FROM organize_115
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `)
  return stmt.all(limit, offset) as OrganizeRecord[]
}

export function getOrganizeRecordsCount(): number {
  const database = getDB()
  const stmt = database.prepare('SELECT COUNT(*) as count FROM organize_115')
  const row = stmt.get() as { count: number }
  return row.count
}

export function deleteOrganizeRecord(id: number): boolean {
  const database = getDB()
  const stmt = database.prepare('DELETE FROM organize_115 WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

export function clearOrganizeRecords(): number {
  const database = getDB()
  const stmt = database.prepare('DELETE FROM organize_115')
  const result = stmt.run()
  return result.changes
}

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

export function cleanExpiredDirectLinkCache(): number {
  const database = getDB()
  const now = Math.floor(Date.now() / 1000)
  const stmt = database.prepare('DELETE FROM direct_link_115 WHERE expire_ts < ?')
  const result = stmt.run(now)
  return result.changes
}

/**
 * 追更持久化队列中的单条记录。
 */
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


export interface TMDBCorrection {
  tmdb_id: string
  show_name: string
  correct_total_episodes: number
  note: string | null
  created_at: string
  updated_at: string
}

/**
 * 获取指定剧集的纠错记录
 * 
 * 在缺失检测时调用，用于判断该剧集是否有纠错数据。
 * 如果存在纠错记录，则使用纠正后的集数进行缺失计算。
 * 
 * @param tmdbId - TMDB 剧集 ID
 * @returns 纠错记录，不存在则返回 null
 * 
 * @example
 * const correction = getTMDBCorrection('1396')
 * if (correction) {
 *   // 使用 correction.correct_total_episodes 作为实际集数
 * }
 */
export function getTMDBCorrection(tmdbId: string): TMDBCorrection | null {
  const database = getDB()
  const stmt = database.prepare('SELECT * FROM tmdb_correction WHERE tmdb_id = ?')
  return stmt.get(tmdbId) as TMDBCorrection | undefined || null
}

/**
 * 获取所有纠错记录列表
 * 
 * 用于管理页面展示所有已纠错的剧集，按更新时间倒序排列。
 * 
 * @returns 所有纠错记录数组
 * 
 * @example
 * const corrections = getAllTMDBCorrections()
 * // 返回 [{ tmdb_id: '1396', show_name: '剧集名', ... }, ...]
 */
export function getAllTMDBCorrections(): TMDBCorrection[] {
  const database = getDB()
  const stmt = database.prepare('SELECT * FROM tmdb_correction ORDER BY updated_at DESC')
  return stmt.all() as TMDBCorrection[]
}

/**
 * 添加或更新纠错记录
 * 
 * 保存用户输入的纠错数据到数据库。如果该剧集已有纠错记录，则更新。
 * 使用 UPSERT 语法（INSERT ... ON CONFLICT DO UPDATE）实现。
 * 
 * @param tmdbId - TMDB 剧集 ID
 * @param showName - 剧集名称
 * @param correctTotalEpisodes - 纠正后的总集数
 * @param note - 备注信息（可选）
 * 
 * @example
 * // 添加新纠错
 * setTMDBCorrection('1396', '绝命毒师', 62, 'TMDB 数据有误，实际共 62 集')
 * 
 * // 更新已有纠错
 * setTMDBCorrection('1396', '绝命毒师', 63, '修正为 63 集')
 */
export function setTMDBCorrection(
  tmdbId: string,
  showName: string,
  correctTotalEpisodes: number,
  note?: string
): void {
  const database = getDB()
  const stmt = database.prepare(`
    INSERT INTO tmdb_correction (tmdb_id, show_name, correct_total_episodes, note, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(tmdb_id) DO UPDATE SET
      show_name = excluded.show_name,
      correct_total_episodes = excluded.correct_total_episodes,
      note = excluded.note,
      updated_at = CURRENT_TIMESTAMP
  `)
  stmt.run(tmdbId, showName, correctTotalEpisodes, note || null)
}

/**
 * 删除纠错记录
 * 
 * 当用户取消纠错时调用，从数据库中移除纠错记录。
 * 删除后，下次缺失检测将使用 TMDB 原始数据。
 * 
 * @param tmdbId - TMDB 剧集 ID
 * @returns 是否删除成功（true: 删除了记录，false: 记录不存在）
 * 
 * @example
 * const deleted = deleteTMDBCorrection('1396')
 * if (deleted) {
 *   console.log('纠错已取消')
 * }
 */
export function deleteTMDBCorrection(tmdbId: string): boolean {
  const database = getDB()
  const stmt = database.prepare('DELETE FROM tmdb_correction WHERE tmdb_id = ?')
  const result = stmt.run(tmdbId)
  return result.changes > 0
}
