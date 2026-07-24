/**
 * SQLite 连接与表结构初始化
 */
import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let db: Database.Database | null = null

/**
 * 获取数据库单例。飞牛环境写入 TRIM_PKGVAR/data，本地默认 ./data
 */
export function getDB(): Database.Database {
  if (!db) {
    const dataPath = process.env.TRIM_PKGVAR
      ? join(process.env.TRIM_PKGVAR, 'data')
      : (process.env.DATABASE_PATH || join(process.cwd(), 'data'))
    if (!existsSync(dataPath)) {
      mkdirSync(dataPath, { recursive: true })
    }
    const filePath = join(dataPath, 'config.db')
    db = new Database(filePath) as Database.Database
    // 同步 API 下尽量降低写阻塞：WAL + 合理 busy 等待
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')
    db.pragma('busy_timeout = 5000')
    db.pragma('temp_store = MEMORY')
    db.pragma('foreign_keys = ON')
    initTables()
  }
  return db
}

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

  // 热路径索引：队列领取、记录列表、会话过期清理、直链过期
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_organize_115_created_at ON organize_115(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_organize_115_status ON organize_115(status);
    CREATE INDEX IF NOT EXISTS idx_direct_link_expire_ts ON direct_link_115(expire_ts);
    CREATE INDEX IF NOT EXISTS idx_media_info_queue_status_id ON media_info_follow_queue(status, id);
    CREATE INDEX IF NOT EXISTS idx_media_info_queue_item_status ON media_info_follow_queue(item_id, status);
    CREATE INDEX IF NOT EXISTS idx_media_info_queue_created_at ON media_info_follow_queue(created_at);
    CREATE INDEX IF NOT EXISTS idx_tmdb_correction_updated_at ON tmdb_correction(updated_at DESC);
  `)
}
