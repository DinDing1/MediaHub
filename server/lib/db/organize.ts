/**
 * 115 整理记录
 */
import { getDB } from './connection'

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
