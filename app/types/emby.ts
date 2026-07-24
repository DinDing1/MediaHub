/**
 * Emby 相关类型定义
 */

export interface EmbyConfig {
  baseUrl: string
  apiKey: string
}

export interface EmbyStatistics {
  movieCount: number
  tvCount: number
  episodeCount: number
  userCount: number
  libraryCount: number
}

export interface RecentAddedStats {
  today: number
  week: number
  month: number
}

export interface EmbyLibrary {
  id: string
  name: string
  type: string
  typeLabel: string
  locations: string[]
  imageTags: Record<string, string>
  imageUrl: string | null
}

export interface RecentItem {
  id: string
  name: string
  type: 'movie' | 'tv'
  typeLabel: string
  imageUrl: string | null
  dateCreated?: string
  episodeName?: string
}

export interface DashboardData {
  statistics: EmbyStatistics
  recentAddedStats: RecentAddedStats
  libraries: EmbyLibrary[]
  recentAdded: RecentItem[]
  recentPlayed: RecentItem[]
}
