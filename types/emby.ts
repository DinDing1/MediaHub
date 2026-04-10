/**
 * Emby相关类型定义
 */

// Emby服务器配置
export interface EmbyConfig {
  baseUrl: string
  apiKey: string
}

// 媒体统计数据
export interface EmbyStatistics {
  movieCount: number
  tvCount: number
  episodeCount: number
  userCount: number
  libraryCount: number
}

// 最近入库统计
export interface RecentAddedStats {
  today: number
  week: number
  month: number
}

// 媒体库信息
export interface EmbyLibrary {
  id: string
  name: string
  type: string
  typeLabel: string
  locations: string[]
  imageTags: Record<string, string>
  imageUrl: string | null
}

// 最近项目
export interface RecentItem {
  id: string
  name: string
  type: 'movie' | 'tv'
  typeLabel: string
  imageUrl: string | null
  dateCreated?: string
  episodeName?: string
}

// 仪表盘数据
export interface DashboardData {
  statistics: EmbyStatistics
  recentAddedStats: RecentAddedStats
  libraries: EmbyLibrary[]
  recentAdded: RecentItem[]
  recentPlayed: RecentItem[]
}
