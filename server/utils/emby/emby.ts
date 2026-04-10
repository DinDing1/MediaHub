/**
 * Emby API 工具模块
 * 用于与Emby服务器进行交互
 */

import { log } from '../logger'
import { getShanghaiStartOfDay } from '~/utils/time'

// ==================== 类型定义 ====================

interface EmbyConfig {
  baseUrl: string
  apiKey: string
}

interface EmbyStatistics {
  movieCount: number
  tvCount: number
  episodeCount: number
  userCount: number
  libraryCount: number
}

interface RecentAddedStats {
  today: number
  week: number
  month: number
}

interface EmbyLibrary {
  id: string
  name: string
  type: string
  typeLabel: string
  locations: string[]
  imageTags: Record<string, string>
  imageUrl: string | null
}

export interface EmbyApiRequestOptions {
  params?: Record<string, string>
  method?: string
  headers?: Record<string, string>
  body?: BodyInit | null
  responseType?: 'json' | 'text' | 'buffer' | 'none'
  timeoutMs?: number
}

interface RecentItem {
  id: string
  name: string
  type: 'movie' | 'tv'
  typeLabel: string
  imageUrl: string | null
  dateCreated?: string
  episodeName?: string
}

// ==================== 配置缓存 ====================

let cachedConfig: EmbyConfig | null = null
let configLoaded = false

/**
 * 获取Emby配置
 * 从数据库读取配置并缓存
 */
export async function getEmbyConfig(): Promise<EmbyConfig | null> {
  if (configLoaded) {
    return cachedConfig
  }

  const { getSetting } = await import('../db')
  const baseUrl = getSetting('emby_base_url')
  const apiKey = getSetting('emby_api_key')

  if (baseUrl && apiKey) {
    cachedConfig = {
      baseUrl: baseUrl.trim().replace(/\/$/, ''),
      apiKey: apiKey.trim()
    }
  }

  configLoaded = true
  return cachedConfig
}

/**
 * 清除配置缓存
 * 配置更新后调用
 */
export function clearEmbyConfigCache(): void {
  cachedConfig = null
  configLoaded = false
}

// ==================== 连接测试 ====================

/**
 * 测试Emby服务器连接
 * @param config Emby配置
 * @returns 测试结果
 */
export async function testEmbyConnection(config: EmbyConfig): Promise<{ success: boolean; serverName?: string; error?: string }> {
  try {
    const url = `${config.baseUrl}/System/Info`

    // 30秒超时控制
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(url, {
      headers: {
        'X-Emby-Token': config.apiKey,
        'Accept': 'application/json'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      return {
        success: true,
        serverName: data.ServerName || 'Emby Server'
      }
    } else {
      const errorText = await response.text()
      return {
        success: false,
        error: `连接失败: HTTP ${response.status} - ${errorText}`
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, error: '连接超时: 请求超过30秒未响应' }
    }
    return { success: false, error: `连接错误: ${error.message}` }
  }
}

// ==================== API 请求 ====================

const DEFAULT_REQUEST_TIMEOUT_MS = 30000

/**
 * 发送Emby API请求
 * @param endpoint API端点
 * @param options 请求选项
 */
export async function embyRequest<T = any>(endpoint: string, options: EmbyApiRequestOptions = {}): Promise<T> {
  const config = await getEmbyConfig()
  if (!config) {
    throw new Error('Emby未配置')
  }

  const url = new URL(`${config.baseUrl}${endpoint}`)
  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
  }

  const timeoutMs = Math.max(1000, Math.floor(options.timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS))
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers: {
        'X-Emby-Token': config.apiKey,
        'Accept': 'application/json',
        ...(options.headers || {})
      },
      body: options.body ?? null,
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(`Emby API错误: HTTP ${response.status}`)
    }

    if (options.responseType === 'none') {
      return undefined as T
    }

    if (options.responseType === 'text') {
      return await response.text() as T
    }

    if (options.responseType === 'buffer') {
      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer) as T
    }

    return await response.json() as T
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Emby API超时: ${timeoutMs}ms`)
      log.error('Emby', `API请求超时: ${endpoint}`, timeoutError.message)
      throw timeoutError
    }

    log.error('Emby', `API请求失败: ${endpoint}`, error.message)
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 构建Emby图片URL
 * 通过后端代理获取，避免跨域和认证信息暴露
 */
function buildImageUrl(itemId: string, imageTag: string, _config: EmbyConfig): string {
  return `/api/emby/image/${itemId}?tag=${encodeURIComponent(imageTag)}&type=Primary`
}

// ==================== 数据获取 ====================

/**
 * 获取媒体库列表
 */
export async function getLibraries(): Promise<EmbyLibrary[]> {
  const config = await getEmbyConfig()
  if (!config) {
    return []
  }

  const data = await embyRequest('/Library/VirtualFolders')
  if (!data || !Array.isArray(data)) {
    return []
  }

  const typeLabels: Record<string, string> = {
    movies: '电影',
    tvshows: '剧集',
    music: '音乐',
    books: '书籍',
    mixed: '混合',
    homevideos: '家庭视频',
    boxsets: '合集'
  }

  // 获取媒体库图片标签
  const ids = data.map((item: any) => item.ItemId).filter(Boolean)
  let imageTagsMap: Record<string, any> = {}

  if (ids.length > 0) {
    try {
      const itemsData = await embyRequest('/Items', { params: { Ids: ids.join(',') } })
      if (itemsData?.Items) {
        for (const item of itemsData.Items) {
          imageTagsMap[item.Id] = item.ImageTags || {}
        }
      }
    } catch (e) {
      // 忽略图片获取错误
    }
  }

  return data.map((item: any) => {
    const imageTag = imageTagsMap[item.ItemId]?.Primary
    return {
      id: item.ItemId,
      name: item.Name,
      type: item.CollectionType,
      typeLabel: typeLabels[item.CollectionType] || '其他',
      locations: item.Locations || [],
      imageTags: imageTagsMap[item.ItemId] || {},
      imageUrl: imageTag ? buildImageUrl(item.ItemId, imageTag, config) : null
    }
  })
}

/**
 * 获取统计数据
 */
export async function getStatistics(): Promise<EmbyStatistics> {
  const libraries = await getLibraries()

  let movieCount = 0
  let tvCount = 0
  let episodeCount = 0

  const movieLibIds: string[] = []
  const tvLibIds: string[] = []

  for (const lib of libraries) {
    if (lib.type === 'movies') {
      movieLibIds.push(lib.id)
    } else if (lib.type === 'tvshows') {
      tvLibIds.push(lib.id)
    }
  }

  // 获取电影数量
  for (const libId of movieLibIds) {
    try {
      const data = await embyRequest('/Items', {
        params: {
          ParentId: libId,
          IncludeItemTypes: 'Movie',
          Recursive: 'true',
          Limit: '0'
        }
      })
      movieCount += data.TotalRecordCount || 0
    } catch (e) {
      // 忽略错误
    }
  }

  // 获取电视剧和剧集数量
  for (const libId of tvLibIds) {
    try {
      const [seriesData, episodeData] = await Promise.all([
        embyRequest('/Items', {
          params: {
            ParentId: libId,
            IncludeItemTypes: 'Series',
            Recursive: 'true',
            Limit: '0'
          }
        }),
        embyRequest('/Items', {
          params: {
            ParentId: libId,
            IncludeItemTypes: 'Episode',
            Recursive: 'true',
            Limit: '0'
          }
        })
      ])
      tvCount += seriesData.TotalRecordCount || 0
      episodeCount += episodeData.TotalRecordCount || 0
    } catch (e) {
      // 忽略错误
    }
  }

  // 获取用户数量
  let userCount = 0
  try {
    const usersData = await embyRequest('/Users')
    userCount = usersData?.length || 0
  } catch (e) {
    // 忽略错误
  }

  return {
    movieCount,
    tvCount,
    episodeCount,
    userCount,
    libraryCount: libraries.length
  }
}

/**
 * 获取最近入库统计
 * 今日、7日、30日入库数量
 */
export async function getRecentAddedStats(): Promise<RecentAddedStats> {
  const now = new Date()
  const todayStart = getShanghaiStartOfDay(now)
  const day7Start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const day30Start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  let today = 0
  let week = 0
  let month = 0

  try {
    const data = await embyRequest('/Items', {
      params: {
        SortBy: 'DateCreated',
        SortOrder: 'Descending',
        Recursive: 'true',
        IncludeItemTypes: 'Movie,Series',
        Fields: 'DateCreated'
      }
    })

    if (data?.Items) {
      for (const item of data.Items) {
        const dateCreatedStr = item.DateCreated
        if (!dateCreatedStr) continue

        try {
          const dateCreatedStrClean = dateCreatedStr.replace(/\.(\d{7})Z$/, 'Z').replace('Z', '')
          const dateCreated = new Date(dateCreatedStrClean + 'Z')

          if (dateCreated >= todayStart) {
            today++
          }
          if (dateCreated >= day7Start) {
            week++
          }
          if (dateCreated >= day30Start) {
            month++
          }
        } catch (e) {
          // 忽略日期解析错误
        }
      }
    }
  } catch (e) {
    // 忽略错误
  }

  return { today, week, month }
}

/**
 * 获取最近入库内容
 * @param limit 返回数量
 */
export async function getRecentlyAdded(limit: number = 8): Promise<RecentItem[]> {
  const config = await getEmbyConfig()
  if (!config) {
    return []
  }

  try {
    const data = await embyRequest('/Items', {
      params: {
        SortBy: 'DateCreated',
        SortOrder: 'Descending',
        Recursive: 'true',
        IncludeItemTypes: 'Movie,Series',
        Fields: 'DateCreated,PrimaryImageAspectRatio',
        Limit: (limit * 3).toString()
      }
    })

    if (!data?.Items) {
      return []
    }

    const seen = new Set<string>()
    const items: RecentItem[] = []

    for (const item of data.Items) {
      if (seen.has(item.Name)) continue
      seen.add(item.Name)

      const imageTag = item.ImageTags?.Primary
      items.push({
        id: item.Id,
        name: item.Name,
        type: item.Type === 'Movie' ? 'movie' : 'tv',
        typeLabel: item.Type === 'Movie' ? '电影' : '剧集',
        imageUrl: imageTag ? buildImageUrl(item.Id, imageTag, config) : null,
        dateCreated: item.DateCreated
      })

      if (items.length >= limit) break
    }

    return items
  } catch (e) {
    return []
  }
}

/**
 * 获取最近播放内容
 * @param limit 返回数量
 */
export async function getRecentlyPlayed(limit: number = 8): Promise<RecentItem[]> {
  const config = await getEmbyConfig()
  if (!config) {
    return []
  }

  try {
    const usersData = await embyRequest('/Users')
    if (!usersData?.length) {
      return []
    }

    const userId = usersData[0].Id

    const data = await embyRequest(`/Users/${userId}/Items`, {
      params: {
        SortBy: 'DatePlayed',
        SortOrder: 'Descending',
        Recursive: 'true',
        IncludeItemTypes: 'Movie,Episode',
        Fields: 'SeriesName,SeriesId,SeriesPrimaryImageTag',
        Limit: (limit * 3).toString()
      }
    })

    if (!data?.Items) {
      return []
    }

    const seenSeries = new Set<string>()
    const items: RecentItem[] = []

    for (const item of data.Items) {
      if (items.length >= limit) break

      const seriesId = item.SeriesId
      if (seriesId && seenSeries.has(seriesId)) {
        continue
      }

      if (seriesId) {
        seenSeries.add(seriesId)
      }

      const isMovie = item.Type === 'Movie'
      let imageTag: string | undefined
      let imageId: string = item.Id

      if (isMovie) {
        imageTag = item.ImageTags?.Primary
      } else {
        imageTag = item.SeriesPrimaryImageTag
        imageId = item.SeriesId || item.Id
      }

      items.push({
        id: item.Id,
        name: isMovie ? item.Name : (item.SeriesName || item.Name),
        type: isMovie ? 'movie' : 'tv',
        typeLabel: isMovie ? '电影' : '剧集',
        imageUrl: imageTag ? buildImageUrl(imageId, imageTag, config) : null,
        episodeName: isMovie ? undefined : item.Name
      })
    }

    return items
  } catch (e) {
    return []
  }
}

/**
 * 获取媒体图片
 * @param itemId 媒体ID
 * @param tag 图片标签
 * @param type 图片类型
 */
export async function getImage(itemId: string, tag: string, type: string = 'Primary'): Promise<Buffer | null> {
  try {
    const config = await getEmbyConfig()
    if (!config) {
      return null
    }

    const url = `${config.baseUrl}/Items/${itemId}/Images/${type}?tag=${tag}&quality=100`

    const response = await fetch(url, {
      headers: {
        'X-Emby-Token': config.apiKey
      }
    })

    if (!response.ok) {
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (e) {
    return null
  }
}
