/**
 * Emby 缺失剧集检测工具
 * 
 * 功能说明：
 * 1. 获取 Emby 媒体库中的所有电视剧
 * 2. 从 TMDB 获取剧集的完整信息
 * 3. 对比 Emby 和 TMDB 的剧集数据
 * 4. 找出缺失的剧集并生成报告
 * 
 * @module server/utils/emby/missing_detection
 */

import { log } from '../logger'
import { getTvDetails } from '../organize/tmdb'
import { getTMDBCorrection } from '../db'
import { embyRequest, getLibraries as getSharedLibraries } from './emby'

/**
 * Emby 媒体库信息
 */
export interface EmbyLibrary {
  Name: string
  Id: string
  CollectionType: string
  Locations: string[]
}

/**
 * Emby 剧集信息
 */
export interface EmbySeries {
  Id: string
  Name: string
  ProviderIds?: {
    Tmdb?: string
    Imdb?: string
    Tvdb?: string
  }
  ProductionYear?: number
  ImageTags?: {
    Primary?: string
  }
}

/**
 * Emby 剧集分集信息
 */
export interface EmbyEpisode {
  Id: string
  Name: string
  ParentIndexNumber: number
  IndexNumber: number
}

/**
 * 缺失剧集信息
 */
export interface MissingEpisode {
  season: number
  episode: number
}

/**
 * 剧集缺失报告
 */
export interface SeriesMissingReport {
  name: string
  tmdb_id: string
  total_episodes: number
  existing_episode_count: number
  missing_episodes: MissingEpisode[]
  has_correction?: boolean
  corrected_total_episodes?: number
  original_missing_episodes?: MissingEpisode[]
  original_total_episodes?: number
}

/**
 * 媒体库缺失报告
 */
export interface LibraryMissingReport {
  [libraryName: string]: SeriesMissingReport[]
}

/**
 * 缺失检测进度回调
 */
export interface ProgressCallback {
  (progress: {
    message: string
    library?: string
    current_show?: string
    current_index?: number
    total_shows?: number
    result?: SeriesMissingReport
  }): void
}


/**
 * 获取所有媒体库
 */
export async function getMissingDetectionLibraries(): Promise<EmbyLibrary[]> {
  const libraries = await getSharedLibraries()

  return libraries.map(lib => ({
    Name: lib.name,
    Id: lib.id,
    CollectionType: lib.type,
    Locations: lib.locations
  }))
}

/**
 * 获取媒体库中的项目
 */
export async function getLibraryItems(
  parentId: string,
  itemTypes: string = 'Series'
): Promise<EmbySeries[]> {
  interface ItemsResponse {
    Items?: any[]
  }

  const data = await embyRequest<ItemsResponse>('/Items', {
    params: {
      ParentId: parentId,
      IncludeItemTypes: itemTypes,
      Recursive: 'true',
      Fields: 'ProviderIds,Path,Overview,ProductionYear,SortName,MediaSources,CommunityRating,PremiereDate,DateCreated'
    }
  })

  return data?.Items || []
}

/**
 * 获取剧集的所有分集
 */
export async function getEpisodes(seriesId: string): Promise<EmbyEpisode[]> {
  interface ItemsResponse {
    Items?: any[]
  }

  const data = await embyRequest<ItemsResponse>('/Items', {
    params: {
      ParentId: seriesId,
      IncludeItemTypes: 'Episode',
      Recursive: 'true',
      Fields: 'ProviderIds,ParentIndexNumber,IndexNumber,Path,MediaSources'
    }
  })

  return data?.Items || []
}

/**
 * 分析缺失剧集
 * 
 * @param libraryId - 媒体库 ID，不传则分析所有媒体库
 * @param progressCallback - 进度回调函数
 * @returns 缺失剧集报告
 */
export async function analyzeMissingEpisodes(
  libraryId?: string,
  progressCallback?: ProgressCallback
): Promise<{
  success: boolean
  data?: LibraryMissingReport
  errors?: string[]
}> {
  try {
    log.info('缺失检测', '开始分析缺失剧集')
    
    const libraries = await getMissingDetectionLibraries()
    const report: LibraryMissingReport = {}
    const errors: string[] = []
    
    const targetLibraries = libraries.filter((lib: EmbyLibrary) => {
      if (libraryId && libraryId !== 'all' && lib.Id !== libraryId) {
        return false
      }
      return lib.CollectionType === 'tvshows'
    })
    
    log.info('缺失检测', `找到 ${targetLibraries.length} 个电视剧媒体库`)
    
    for (const lib of targetLibraries) {
      const libName = lib.Name
      report[libName] = []
      
      if (progressCallback) {
        progressCallback({
          message: `正在获取媒体库 ${libName} 的剧集列表...`,
          library: libName
        })
      }
      
      const shows = await getLibraryItems(lib.Id, 'Series')
      const totalShows = shows.length
      
      log.info('缺失检测', `媒体库 ${libName} 有 ${totalShows} 个剧集`)
      
      for (let i = 0; i < shows.length; i++) {
        const show = shows[i]
        if (!show) continue
        
        const showName = show.Name
        
        if (progressCallback) {
          progressCallback({
            message: `正在分析剧集: ${showName} (${i + 1}/${totalShows})`,
            current_show: showName,
            current_index: i + 1,
            total_shows: totalShows,
            library: libName
          })
        }
        
        const tmdbId = show.ProviderIds?.Tmdb
        
        if (!tmdbId) {
          errors.push(`剧集 ${showName} 没有 TMDB ID，跳过`)
          continue
        }
        
        const [embyEpisodes, tmdbShow] = await Promise.all([
          getEpisodes(show.Id),
          getTvDetails(parseInt(tmdbId))
        ])
        
        if (!tmdbShow || !tmdbShow.seasons) {
          errors.push(`无法获取 ${showName} 的 TMDB 数据 (ID: ${tmdbId})`)
          continue
        }
        
        const existingEpisodes = new Set<string>()
        for (const ep of embyEpisodes) {
          const seasonNum = ep.ParentIndexNumber
          const episodeNum = ep.IndexNumber
          if (seasonNum !== undefined && episodeNum !== undefined) {
            existingEpisodes.add(`${seasonNum}-${episodeNum}`)
          }
        }
        
        const missingEpisodes: MissingEpisode[] = []
        let totalEpisodesCount = 0
        
        const correction = getTMDBCorrection(tmdbId)
        
        for (const season of tmdbShow.seasons) {
          const seasonNumber = season.season_number
          const episodeCount = season.episode_count
          
          if (seasonNumber === 0) {
            continue
          }
          
          for (let epNum = 1; epNum <= episodeCount; epNum++) {
            if (!existingEpisodes.has(`${seasonNumber}-${epNum}`)) {
              missingEpisodes.push({
                season: seasonNumber,
                episode: epNum
              })
            }
          }
          
          totalEpisodesCount += episodeCount
        }
        
        const seriesReport: SeriesMissingReport = {
          name: showName,
          tmdb_id: tmdbId,
          total_episodes: totalEpisodesCount,
          existing_episode_count: existingEpisodes.size,
          missing_episodes: missingEpisodes,
          has_correction: !!correction,
          corrected_total_episodes: correction?.correct_total_episodes
        }
        
        if (correction) {
          seriesReport.original_missing_episodes = [...missingEpisodes]
          seriesReport.original_total_episodes = totalEpisodesCount
          
          const correctedTotal = correction.correct_total_episodes
          const actualMissing = Math.max(0, correctedTotal - existingEpisodes.size)
          if (missingEpisodes.length > actualMissing) {
            seriesReport.missing_episodes = missingEpisodes.slice(0, actualMissing)
          }
          log.info('缺失检测', `${showName}: 使用纠错数据 ${correctedTotal} 集 (TMDB: ${totalEpisodesCount} 集)`)
        }
        
        report[libName].push(seriesReport)
        
        if (progressCallback) {
          progressCallback({
            message: `已完成: ${showName}`,
            current_show: showName,
            current_index: i + 1,
            total_shows: totalShows,
            library: libName,
            result: seriesReport
          })
        }
        
        log.info('缺失检测', `${showName}: 总共 ${totalEpisodesCount} 集, 现有 ${existingEpisodes.size} 集, 缺失 ${missingEpisodes.length} 集`)
      }
    }
    
    const totalMissing = Object.values(report).reduce((sum, lib) => sum + lib.length, 0)
    log.info('缺失检测', `分析完成，共找到 ${totalMissing} 个有缺失剧集的电视剧`)
    
    return {
      success: true,
      data: report,
      errors: errors.length > 0 ? errors : undefined
    }
  } catch (error: any) {
    log.error('缺失检测', `分析失败: ${error.message}`)
    return {
      success: false,
      errors: [error.message]
    }
  }
}
