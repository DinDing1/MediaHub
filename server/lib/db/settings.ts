/**
 * settings 表读写
 */
import { getDB } from './connection'
import { CONFIG_DEFINITIONS } from './definitions'

export function getSetting(key: string): string | null {
  const database = getDB()
  const stmt = database.prepare('SELECT value FROM settings WHERE key = ?')
  const row = stmt.get(key) as { value: string } | undefined
  return row ? row.value : null
}

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
  stmt.run(key, value, def?.label ?? null, def?.description ?? null)
}

export function getAllSettings(): Record<string, string> {
  const database = getDB()
  const stmt = database.prepare('SELECT key, value FROM settings')
  const rows = stmt.all() as Array<{ key: string; value: string }>
  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
}
