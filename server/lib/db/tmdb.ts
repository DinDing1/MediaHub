/**
 * TMDB 剧集纠错记录
 */
import { getDB } from './connection'

export interface TMDBCorrection {
  tmdb_id: string
  show_name: string
  correct_total_episodes: number
  note: string | null
  created_at: string
  updated_at: string
}

export function getTMDBCorrection(tmdbId: string): TMDBCorrection | null {
  const database = getDB()
  const stmt = database.prepare('SELECT * FROM tmdb_correction WHERE tmdb_id = ?')
  return (stmt.get(tmdbId) as TMDBCorrection | undefined) || null
}

export function getAllTMDBCorrections(): TMDBCorrection[] {
  const database = getDB()
  const stmt = database.prepare('SELECT * FROM tmdb_correction ORDER BY updated_at DESC')
  return stmt.all() as TMDBCorrection[]
}

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

export function deleteTMDBCorrection(tmdbId: string): boolean {
  const database = getDB()
  const stmt = database.prepare('DELETE FROM tmdb_correction WHERE tmdb_id = ?')
  const result = stmt.run(tmdbId)
  return result.changes > 0
}
