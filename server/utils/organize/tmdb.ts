/**
 * TMDB识别模块
 * 
 * 本模块负责与TMDB (The Movie Database) API交互，实现媒体识别功能：
 * - 搜索电影和电视剧
 * - 获取媒体详细信息
 * - 智能匹配最佳搜索结果
 * 
 * TMDB是一个免费的电影和电视剧数据库，提供丰富的媒体信息
 * API文档: https://developers.themoviedb.org/3
 * 
 * 使用前需要在参数配置中设置TMDB API Key
 * 申请地址: https://www.themoviedb.org/settings/api
 * 
 * 支持配置TMDB代理地址，用于解决网络访问问题
 * 代理地址只需配置基础域名，如 https://tmdb-proxy.example.com
 * 系统会自动添加 /3 (API) 和 /t/p (图片) 路径
 */

import type { TMDBSearchResult, TMDBDetails, TMDBMatchResult } from './types'
import { addLog } from '../logger'
import { getSetting } from '../db'

/** 默认TMDB API域名 */
const DEFAULT_TMDB_API_HOST = 'https://api.themoviedb.org'

/** 默认TMDB图片域名 */
const DEFAULT_TMDB_IMAGE_HOST = 'https://image.tmdb.org'

/** TMDB API版本路径 */
const TMDB_API_VERSION = '/3'

/** TMDB图片路径前缀 */
const TMDB_IMAGE_PATH = '/t/p'

/**
 * 从数据库获取TMDB API Key
 * 
 * @returns API Key字符串，未配置则返回null
 */
function getTmdbApiKey(): string | null {
  return getSetting('tmdb_api_key') || null
}

/**
 * 从数据库获取TMDB代理地址
 * 如果用户配置了代理地址，则使用代理地址，否则使用默认地址
 * 
 * @returns TMDB代理基础域名
 */
function getTmdbProxyHost(): string | null {
  const customUrl = getSetting('tmdb_api_url')
  if (customUrl && customUrl.trim()) {
    return customUrl.trim().replace(/\/$/, '')
  }
  return null
}

/**
 * 获取TMDB API基础URL
 * 返回的URL已包含API版本路径 /3
 * 
 * @returns TMDB API完整URL（含/3路径）
 */
function getTmdbBaseUrl(): string {
  const proxyHost = getTmdbProxyHost()
  if (proxyHost) {
    return `${proxyHost}${TMDB_API_VERSION}`
  }
  return `${DEFAULT_TMDB_API_HOST}${TMDB_API_VERSION}`
}

/**
 * 获取TMDB图片基础URL
 * 如果配置了代理地址，则使用代理地址，否则使用默认图片域名
 * 返回的URL已包含图片路径 /t/p
 * 
 * @returns TMDB图片完整URL（含/t/p路径）
 */
function getTmdbImageBaseUrl(): string {
  const proxyHost = getTmdbProxyHost()
  if (proxyHost) {
    return `${proxyHost}${TMDB_IMAGE_PATH}`
  }
  return `${DEFAULT_TMDB_IMAGE_HOST}${TMDB_IMAGE_PATH}`
}

/**
 * 检测文本是否包含中日韩文字
 * 用于决定搜索时使用的语言
 * 
 * @param text - 待检测文本
 * @returns 是否包含CJK字符
 */
function hasCjk(text: string): boolean {
  return /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(text)
}

/**
 * 标准化查询字符串
 * 移除特殊字符，保留字母、数字、中文和连字符
 * 
 * @param query - 原始查询字符串
 * @returns 标准化后的查询字符串
 */
function normalizeQuery(query: string): string {
  return query
    .replace(/[&＆]/g, ' and ')
    .replace(/[^\w\s\u4e00-\u9fff\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getComparableTokens(text: string): string[] {
  return normalizeQuery(text)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

function hasTokenSequence(targetTokens: string[], queryTokens: string[]): boolean {
  if (queryTokens.length === 0 || queryTokens.length > targetTokens.length) {
    return false
  }

  for (let i = 0; i <= targetTokens.length - queryTokens.length; i++) {
    const matched = queryTokens.every((token, index) => targetTokens[i + index] === token)
    if (matched) {
      return true
    }
  }

  return false
}

function getTokenCoverage(sourceTokens: string[], targetTokens: string[]): number {
  if (sourceTokens.length === 0 || targetTokens.length === 0) {
    return 0
  }

  const matchedCount = sourceTokens.filter(token => targetTokens.includes(token)).length
  return matchedCount / sourceTokens.length
}

/**
 * 搜索电影或电视剧
 * 
 * 根据查询字符串在TMDB中搜索媒体信息
 * - 自动检测查询语言（中文/英文）
 * - 支持按年份过滤结果
 * 
 * @param query - 搜索关键词（通常是媒体标题）
 * @param mediaType - 媒体类型：'movie' 或 'tv'
 * @param year - 可选的年份过滤
 * @returns 搜索结果数组，无结果则返回空数组
 * @throws 未配置API Key时抛出错误
 * 
 * @example
 * const results = await searchMedia('Avatar', 'movie', '2009')
 * // 返回阿凡达的搜索结果
 */
export async function searchMedia(
  query: string,
  mediaType: 'movie' | 'tv' = 'movie',
  year?: string | null
): Promise<TMDBSearchResult[]> {
  const apiKey = getTmdbApiKey()
  if (!apiKey) {
    throw new Error('TMDB API Key未配置，请在参数配置中设置')
  }

  const baseUrl = getTmdbBaseUrl()
  const normalizedQuery = normalizeQuery(query)
  const language = hasCjk(normalizedQuery) ? 'zh-CN' : 'en-US'

  const params = new URLSearchParams({
    api_key: apiKey,
    query: normalizedQuery,
    language,
  })

  if (year) {
    if (mediaType === 'movie') {
      params.append('year', year)
    } else {
      params.append('first_air_date_year', year)
    }
  }

  const url = `${baseUrl}/search/${mediaType}?${params.toString()}`

  try {
    const response = await fetch(url, { method: 'GET' })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()

    if (!data.results || data.results.length === 0) {
      return []
    }

    return data.results.map((item: any) => ({
      id: item.id,
      title: item.title || item.name || '',
      originalTitle: item.original_title || item.original_name || '',
      year: (item.release_date || item.first_air_date || '').substring(0, 4),
      overview: item.overview || '',
      posterPath: item.poster_path || null,
      backdropPath: item.backdrop_path || null,
      mediaType,
      voteAverage: item.vote_average || 0,
      genreIds: item.genre_ids || [],
      originCountry: item.origin_country || [],
    }))
  } catch (error: any) {
    addLog('error', 'TMDB', `搜索失败: ${error.message}`)
    throw new Error(`TMDB搜索失败: ${error.message}`)
  }
}

/**
 * 获取电影详细信息
 * 
 * 根据TMDB ID获取电影的完整信息，包括：
 * - 标题、年份、简介
 * - 海报、背景图
 * - 类型、原产国
 * - 时长、评分
 * 
 * @param movieId - TMDB电影ID
 * @returns 电影详细信息，获取失败返回null
 */
export async function getMovieDetails(movieId: number): Promise<TMDBDetails | null> {
  const apiKey = getTmdbApiKey()
  if (!apiKey) {
    throw new Error('TMDB API Key未配置')
  }

  const baseUrl = getTmdbBaseUrl()
  const imageBaseUrl = getTmdbImageBaseUrl()
  const url = `${baseUrl}/movie/${movieId}?api_key=${apiKey}&language=zh-CN&append_to_response=credits,alternative_titles`

  try {
    const response = await fetch(url, { method: 'GET' })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json() as any

    if (!data || data.success === false) {
      return null
    }

    let titleCn: string | null = null
    let titleEn = data.original_title || ''
    let displayTitle = data.title || ''

    const alternativeTitles: string[] = Array.from(new Set<string>(
      (data.alternative_titles?.titles || [])
        .map((t: any) => typeof t?.title === 'string' ? t.title.trim() : '')
        .filter((title: string): title is string => Boolean(title))
    ))

    const isOriginalEnglish = !hasCjk(titleEn)

    if (isOriginalEnglish) {
      if (data.title && data.title !== data.original_title && hasCjk(data.title)) {
        titleCn = data.title
      } else if (data.alternative_titles?.titles) {
        const cnTitle = data.alternative_titles.titles.find(
          (t: any) => t.iso_3166_1 === 'CN' || t.iso_3166_1 === 'TW' || t.iso_3166_1 === 'HK'
        )
        if (cnTitle && hasCjk(cnTitle.title)) {
          titleCn = cnTitle.title
        }
      }

      if (titleCn) {
        displayTitle = titleCn
        addLog('info', 'TMDB', `使用中文标题: ${titleCn} (原名: ${titleEn})`)
      }
    }

    return {
      id: data.id,
      title: displayTitle,
      titleCn,
      titleEn,
      originalTitle: data.original_title || '',
      alternativeTitles,
      year: (data.release_date || '').substring(0, 4),
      overview: data.overview || '',
      posterUrl: data.poster_path ? `${imageBaseUrl}/w500${data.poster_path}` : null,
      backdropUrl: data.backdrop_path ? `${imageBaseUrl}/w1280${data.backdrop_path}` : null,
      genres: (data.genres || []).map((g: any) => ({ id: g.id, name: g.name })),
      originCountry: data.origin_country || data.production_countries?.map((c: any) => c.iso_3166_1) || [],
      voteAverage: data.vote_average || 0,
      runtime: data.runtime || null,
      numberOfSeasons: null,
      numberOfEpisodes: null,
    }
  } catch (error: any) {
    addLog('error', 'TMDB', `获取电影详情失败: ${error.message}`)
    return null
  }
}

/**
 * 获取电视剧详细信息
 * 
 * 根据TMDB ID获取电视剧的完整信息，包括：
 * - 标题、年份、简介
 * - 海报、背景图
 * - 类型、原产国
 * - 季数、集数、单集时长
 * 
 * @param tvId - TMDB电视剧ID
 * @returns 电视剧详细信息，获取失败返回null
 */
export async function getTvDetails(tvId: number): Promise<TMDBDetails | null> {
  const apiKey = getTmdbApiKey()
  if (!apiKey) {
    throw new Error('TMDB API Key未配置')
  }

  const baseUrl = getTmdbBaseUrl()
  const imageBaseUrl = getTmdbImageBaseUrl()
  const url = `${baseUrl}/tv/${tvId}?api_key=${apiKey}&language=zh-CN&append_to_response=credits,alternative_titles`

  try {
    const response = await fetch(url, { method: 'GET' })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json() as any

    if (!data || data.success === false) {
      return null
    }

    const alternativeTitles: string[] = Array.from(new Set<string>(
      (data.alternative_titles?.results || [])
        .map((t: any) => typeof t?.title === 'string' ? t.title.trim() : '')
        .filter((title: string): title is string => Boolean(title))
    ))

    let titleCn: string | null = null
    let titleEn = data.original_name || ''
    let displayTitle = data.name || ''

    const isOriginalEnglish = !hasCjk(titleEn)

    if (isOriginalEnglish) {
      if (data.name && data.name !== data.original_name && hasCjk(data.name)) {
        titleCn = data.name
      } else if (data.alternative_titles?.results) {
        const cnTitle = data.alternative_titles.results.find(
          (t: any) => t.iso_3166_1 === 'CN' || t.iso_3166_1 === 'TW' || t.iso_3166_1 === 'HK'
        )
        if (cnTitle && hasCjk(cnTitle.title)) {
          titleCn = cnTitle.title
        }
      }

      if (titleCn) {
        displayTitle = titleCn
        addLog('info', 'TMDB', `使用中文标题: ${titleCn} (原名: ${titleEn})`)
      }
    }

    return {
      id: data.id,
      title: displayTitle,
      titleCn,
      titleEn,
      originalTitle: data.original_name || '',
      alternativeTitles,
      year: (data.first_air_date || '').substring(0, 4),
      overview: data.overview || '',
      posterUrl: data.poster_path ? `${imageBaseUrl}/w500${data.poster_path}` : null,
      backdropUrl: data.backdrop_path ? `${imageBaseUrl}/w1280${data.backdrop_path}` : null,
      genres: (data.genres || []).map((g: any) => ({ id: g.id, name: g.name })),
      originCountry: data.origin_country || data.production_countries?.map((c: any) => c.iso_3166_1) || [],
      voteAverage: data.vote_average || 0,
      runtime: data.episode_run_time?.[0] || null,
      numberOfSeasons: data.number_of_seasons || null,
      numberOfEpisodes: data.number_of_episodes || null,
      seasons: (data.seasons || []).map((s: any) => ({
        season_number: s.season_number,
        episode_count: s.episode_count,
        name: s.name || '',
        air_date: s.air_date
      }))
    }
  } catch (error: any) {
    addLog('error', 'TMDB', `获取电视剧详情失败: ${error.message}`)
    return null
  }
}

/**
 * 获取电视剧特定季的播出年份
 * 
 * 根据TMDB ID和季数获取该季的首播年份
 * 用于电视剧文件重命名时显示正确的季年份
 * 
 * @param tvId - TMDB电视剧ID
 * @param seasonNumber - 季数
 * @returns 季年份字符串，获取失败返回null
 * 
 * @example
 * const year = await getTvSeasonYear(1429, 1)  // 进击的巨人第一季
 * // 返回: "2013"
 */
export async function getTvSeasonYear(tvId: number, seasonNumber: number): Promise<string | null> {
  const apiKey = getTmdbApiKey()
  if (!apiKey) {
    return null
  }

  const baseUrl = getTmdbBaseUrl()
  const url = `${baseUrl}/tv/${tvId}/season/${seasonNumber}?api_key=${apiKey}&language=zh-CN`

  try {
    const response = await fetch(url, { method: 'GET' })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json() as any

    if (!data || data.success === false) {
      return null
    }

    const seasonYear = (data.air_date || '').substring(0, 4)
    return seasonYear || null
  } catch (error: any) {
    addLog('error', 'TMDB', `获取季年份失败: ${error.message}`)
    return null
  }
}

/**
 * 获取媒体详细信息（统一接口）
 * 
 * 根据媒体类型自动调用对应的获取详情函数
 * 
 * @param tmdbId - TMDB ID
 * @param mediaType - 媒体类型：'movie' 或 'tv'
 * @returns 媒体详细信息，获取失败返回null
 */
export async function getMediaDetails(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<TMDBDetails | null> {
  if (mediaType === 'movie') {
    return getMovieDetails(tmdbId)
  }
  return getTvDetails(tmdbId)
}

/**
 * 搜索并智能选择最佳匹配结果
 * 
 * 执行搜索后，通过评分算法选择最匹配的结果：
 * 1. 完全匹配标题：100分
 * 2. 标题包含查询词：80分
 * 3. 查询词包含标题：60分
 * 4. 字符相似度：最高40分
 * 5. 年份匹配：+10分
 * 6. 评分加成：评分×2
 * 
 * @param query - 搜索关键词
 * @param mediaType - 媒体类型
 * @param year - 可选的年份
 * @returns 最佳匹配结果，无匹配返回null
 * 
 * @example
 * const result = await searchAndPick('Avatar', 'movie', '2009')
 * // 返回最匹配阿凡达的搜索结果
 */
export async function searchAndPick(
  query: string,
  mediaType: 'movie' | 'tv' = 'movie',
  year?: string | null
): Promise<TMDBMatchResult | null> {
  const results = await searchMedia(query, mediaType, year)

  if (!results || results.length === 0) {
    return null
  }

  const normalizedQuery = normalizeQuery(query).toLowerCase()
  const queryTokens = getComparableTokens(query)
  const normalizedQueryCompact = normalizedQuery.replace(/\s+/g, '')
  const isShortEnglishQuery = queryTokens.length > 0 && queryTokens.length <= 3 && /^[a-z0-9\s-]+$/i.test(normalizedQuery)

  let bestMatch: TMDBMatchResult | null = null
  let bestScore = 0
  const candidates: Array<{ result: TMDBSearchResult; score: number; breakdown: string; yearMatched: boolean; titleMatchType: 'exact' | 'contains' | 'partial' | 'fuzzy' }> = []

  for (const result of results) {
    const titleLower = normalizeQuery(result.title).toLowerCase()
    const originalLower = normalizeQuery(result.originalTitle).toLowerCase()
    const titleCompact = titleLower.replace(/\s+/g, '')
    const originalCompact = originalLower.replace(/\s+/g, '')
    const titleTokens = getComparableTokens(result.title)
    const originalTokens = getComparableTokens(result.originalTitle)

    const exactTokenMatch =
      (queryTokens.length > 0 && queryTokens.length === titleTokens.length && queryTokens.every((token, index) => token === titleTokens[index])) ||
      (queryTokens.length > 0 && queryTokens.length === originalTokens.length && queryTokens.every((token, index) => token === originalTokens[index]))
    const containsTokenMatch = hasTokenSequence(titleTokens, queryTokens) || hasTokenSequence(originalTokens, queryTokens)
    const partialTokenMatch = hasTokenSequence(queryTokens, titleTokens) || hasTokenSequence(queryTokens, originalTokens)
    const tokenCoverage = Math.max(
      getTokenCoverage(queryTokens, titleTokens),
      getTokenCoverage(queryTokens, originalTokens)
    )

    let score = 0
    let breakdown = ''
    let titleMatchType: 'exact' | 'contains' | 'partial' | 'fuzzy' = 'fuzzy'

    if (titleLower === normalizedQuery || originalLower === normalizedQuery || titleCompact === normalizedQueryCompact || originalCompact === normalizedQueryCompact || exactTokenMatch) {
      score = 100
      breakdown = '标题完全匹配: +100'
      titleMatchType = 'exact'
    } else if (containsTokenMatch) {
      score = 80
      breakdown = '标题包含查询词: +80'
      titleMatchType = 'contains'
    } else if (partialTokenMatch) {
      score = 60
      breakdown = '查询词包含标题: +60'
      titleMatchType = 'partial'
    } else {
      score = tokenCoverage * 40
      breakdown = `词元相似度: +${score.toFixed(1)}`
      titleMatchType = 'fuzzy'
    }

    const yearMatched = !!(year && result.year === year)
    if (yearMatched) {
      score += 30
      breakdown += ', 年份匹配: +30'
    }

    const ratingBonus = result.voteAverage * 2
    score += ratingBonus
    breakdown += `, 评分加成: +${ratingBonus.toFixed(1)}`

    candidates.push({ result, score, breakdown, yearMatched, titleMatchType })

    if (score > bestScore) {
      bestScore = score
      bestMatch = { result, score, yearMatched, titleMatchType }
    }
  }

  if (!bestMatch) {
    return null
  }

  const minReliableScore = isShortEnglishQuery
    ? (
        bestMatch.titleMatchType === 'exact'
          ? (year ? 120 : 95)
          : bestMatch.titleMatchType === 'contains'
            ? (year ? 125 : 105)
            : (year ? 125 : 135)
      )
    : (year ? 85 : 95)

  const seriesStyleQuery = /\bthe series\b/i.test(normalizedQuery) || /[:+]\s*the series\b/i.test(query)
  const hasStrongContainMatch = bestMatch.titleMatchType === 'contains' || bestMatch.titleMatchType === 'exact'
  const loweredReliableScore = !year && seriesStyleQuery && hasStrongContainMatch
    ? 110
    : minReliableScore

  if (bestMatch.score < loweredReliableScore) {
    addLog('info', 'TMDB', `搜索"${query}"最佳匹配 ${bestMatch.result.title} (${bestMatch.result.year}) 得分过低:${bestMatch.score.toFixed(1)}，视为不可靠结果`)
    return null
  }

  if (bestMatch && candidates.length > 1 && (!bestMatch.yearMatched || bestMatch.score < 120)) {
    addLog('info', 'TMDB', `搜索"${query}"找到${candidates.length}个结果，最佳匹配: ${bestMatch.result.title} (${bestMatch.result.year}) 得分:${bestMatch.score.toFixed(1)} 匹配:${bestMatch.titleMatchType}`)
  }

  return bestMatch
}

/**
 * 从文件名中提取TMDB ID
 * 支持多种格式：
 * - {tmdb=12345} 或 {tmdbid=12345}
 * - {tmdb-12345} 或 {tmdbid-12345}
 * - [tmdb=12345] 或 [tmdbid=12345]
 * - [tmdb-12345] 或 [tmdbid-12345]
 * - tmdb=12345 或 tmdbid=12345
 * 
 * @param fileName - 文件名
 * @returns TMDB ID数字，未找到返回null
 * 
 * @example
 * extractTmdbIdFromName("The.Matrix.1999.{tmdb=603}.mkv") // 返回: 603
 * extractTmdbIdFromName("Movie.2024.[tmdbid-12345].mkv") // 返回: 12345
 */
export function extractTmdbIdFromName(fileName: string): number | null {
  const patterns = [
    /[\{\[]\s*tmdbid?\s*[=－-]?\s*(\d+)\s*[\}\]]/i,
    /\b(tmdb|tmdbid)\s*[=－-]?\s*(\d+)\b/i,
  ]
  
  for (const pattern of patterns) {
    const match = fileName.match(pattern)
    if (match) {
      const id = match[2] || match[1]
      if (id && /^\d+$/.test(id)) {
        return parseInt(id, 10)
      }
    }
  }
  
  return null
}
