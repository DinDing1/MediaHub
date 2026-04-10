/**
 * Emby 剧集查重工具模块
 * 
 * 功能说明：
 * 1. 扫描媒体库中的重复内容
 * 2. 支持电影和电视剧查重
 * 3. 检测多版本合并和未合并的重复项
 * 
 * @module server/utils/emby/duplicates
 */

import { log } from '../logger'
import { embyRequest, getLibraries } from './emby'

/**
 * 重复项接口
 */
export interface DuplicateItem {
  id: string
  path: string
  name: string
  embyItemId: string
  mediaSourceId?: string
  deleteType: 'item' | 'media_source'
  qualityScore: number
  qualityLevel: string
  videoTags: string[]
}

/**
 * 重复报告项接口
 */
export interface DuplicateReportItem {
  kind: 'movie' | 'series' | 'episode'
  title: string
  year?: number
  id: string
  show?: string
  episodeKey?: string
  items: DuplicateItem[]
}

/**
 * 查重报告接口
 */
export interface DuplicatesReport {
  data: Record<string, DuplicateReportItem[]>
  errors: string[]
}

/**
 * 进度回调接口
 */
export interface ProgressInfo {
  message: string
  library?: string
  currentShow?: string
  progress?: number
  item?: DuplicateReportItem
  libraryComplete?: boolean
}

/**
 * MediaSource 接口
 */
interface MediaSource {
  Id?: string
  Path?: string
  Size?: string
  Name?: string
}

interface EmbyLibrary {
  ItemId?: string
  Name?: string
  CollectionType?: string
}

/**
 * 获取媒体库列表
 */
async function getDuplicateLibraries(): Promise<EmbyLibrary[]> {
  const libraries = await getLibraries()
  return libraries.map(lib => ({
    ItemId: lib.id,
    Name: lib.name,
    CollectionType: lib.type
  }))
}

/**
 * 获取媒体库项目
 */
async function getLibraryItems(libraryId: string, includeItemTypes: string): Promise<any[]> {
  const data = await embyRequest('/Items', {
    params: {
      ParentId: libraryId,
      IncludeItemTypes: includeItemTypes,
      Recursive: 'true',
      Fields: 'ProviderIds,MediaSources,Path,ProductionYear'
    }
  })
  return data?.Items || []
}

/**
 * 获取剧集的所有集
 */
async function getEpisodes(seriesId: string): Promise<any[]> {
  const data = await embyRequest('/Items', {
    params: {
      ParentId: seriesId,
      IncludeItemTypes: 'Episode',
      Recursive: 'true',
      Fields: 'MediaSources,Path,ParentIndexNumber,IndexNumber,ProductionYear'
    }
  })
  return data?.Items || []
}

/**
 * 从文件名提取视频信息
 */
function extractVideoInfo(path: string): {
  resolution: string | null
  videoCodec: string | null
  audioCodec: string | null
  hdrType: string | null
  dolbyVision: boolean
  atmos: boolean
  source: string | null
  bitDepth: number | null
  fps: number | null
  qualityTags: string[]
  hfr: boolean
  ultraHd: boolean
} {
  const result = {
    resolution: null as string | null,
    videoCodec: null as string | null,
    audioCodec: null as string | null,
    hdrType: null as string | null,
    dolbyVision: false,
    atmos: false,
    source: null as string | null,
    bitDepth: null as number | null,
    fps: null as number | null,
    qualityTags: [] as string[],
    hfr: false,
    ultraHd: false
  }

  if (!path) return result

  const lowerPath = path.toLowerCase()

  const resolutionPatterns: [RegExp, string][] = [
    [/7680x4320|4320p|\b8k\b/, '4320p'],
    [/3840x2160|2160p|\b4k\b|ultra\s*hd|uhd/, '2160p'],
    [/1920x1080p|1920x1080|1080p|\bhd1080p\b|bd1080p|1080i/, '1080p'],
    [/1440p|2k/, '1440p'],
    [/1280x720|1280\*720|720p|bd720p/, '720p'],
    [/1024x576|960x540|1024x560|1024x550|1024x554|1024x544/, '576p'],
    [/480p|480i|960x528/, '480p'],
    [/360p/, '360p']
  ]
  for (const [pattern, resolution] of resolutionPatterns) {
    if (pattern.test(lowerPath)) {
      result.resolution = resolution
      break
    }
  }

  if (/\bultrahd\b|\buhd\b/.test(lowerPath)) {
    result.ultraHd = true
  }

  const videoCodecPatterns: [RegExp, string][] = [
    [/prores/, 'ProRes'],
    [/hevc|x265|h\.?265/, 'H.265'],
    [/x264|h\.?264|avc/, 'H.264'],
    [/av1/, 'AV1'],
    [/vp9/, 'VP9'],
    [/xvid/, 'XviD'],
    [/divx/, 'DivX'],
    [/mpeg-2|mpeg2/, 'MPEG-2'],
    [/mpeg-4/, 'MPEG-4'],
    [/vc-1|vc1/, 'VC-1'],
    [/vp8/, 'VP8'],
    [/avs/, 'AVS'],
    [/realvideo|rv\d+/, 'RealVideo'],
    [/thora|theora/, 'Theora'],
    [/dirac/, 'Dirac']
  ]
  for (const [pattern, codec] of videoCodecPatterns) {
    if (pattern.test(lowerPath)) {
      result.videoCodec = codec
      break
    }
  }

  const audioCodecPatterns: [RegExp, string][] = [
    [/alac/, 'ALAC'],
    [/opus/, 'OPUS'],
    [/wav/, 'WAV'],
    [/pcm(\s*stereo|\.2\.0|\s*2\.0|\s*stereo)?/, 'PCM'],
    [/truehd|true-hd/, 'TrueHD'],
    [/dts[\s\-_.]*hd[\s\-_.]*ma/, 'DTS-HD MA'],
    [/dts[\s\-_.]*hd|dtshd/, 'DTS-HD'],
    [/dts[\s\-_.]*x|dtsx/, 'DTS:X'],
    [/dts/, 'DTS'],
    [/\bdd\+\b|\bddp\b|eac3/, 'DD+'],
    [/ddp\.2\.0|ddp2\.0/, 'DD+'],
    [/ddp\.5\.1|ddp5\.1/, 'DD+'],
    [/\bdd(?!p)(?=[^a-z]|$)|\bac3\b/, 'DD'],
    [/\baac\b/, 'AAC'],
    [/\bflac\b/, 'FLAC'],
    [/\bmp3\b/, 'MP3']
  ]
  const audioCodecs: string[] = []
  for (const [pattern, codec] of audioCodecPatterns) {
    if (pattern.test(lowerPath)) {
      audioCodecs.push(codec)
    }
  }
  if (audioCodecs.length > 0) {
    const filtered = audioCodecs.filter(c => {
      if (c === 'DTS-HD MA' || c === 'DTS:X') return true
      if (c === 'DTS-HD' && (audioCodecs.includes('DTS-HD MA') || audioCodecs.includes('DTS:X'))) return false
      if (c === 'DTS' && (audioCodecs.includes('DTS-HD MA') || audioCodecs.includes('DTS:X') || audioCodecs.includes('DTS-HD'))) return false
      return true
    })
    const seen = new Set<string>()
    const unique: string[] = []
    for (const c of filtered) {
      if (!seen.has(c)) {
        seen.add(c)
        unique.push(c)
      }
    }
    result.audioCodec = unique.join(' | ')
  }

  const hdrPatterns: [RegExp, string][] = [
    [/hdr10\+|hdr10plus/, 'HDR10+'],
    [/hdr10/, 'HDR10'],
    [/hdr/, 'HDR']
  ]
  for (const [pattern, hdrType] of hdrPatterns) {
    if (pattern.test(lowerPath)) {
      result.hdrType = hdrType
      break
    }
  }

  if (/\bdv\b|dolby\.?vision|dovi|doblyvison|dolby\.vision/.test(lowerPath)) {
    result.dolbyVision = true
  }

  if (/atmos|atomos|dolby.?atmos/.test(lowerPath)) {
    result.atmos = true
  }

  const fpsMatch = lowerPath.match(/(\d{2,3})\s*fps/)
  if (fpsMatch) {
    result.fps = parseInt(fpsMatch[1]!, 10)
  }

  if (/\bhfr\b/.test(lowerPath)) {
    result.hfr = true
  }

  const sourcePatterns: [RegExp, string][] = [
    [/bluray\.?remux|remux|蓝光原盘remux/, 'REMUX'],
    [/uhd\.?bluray|uhd\.?bd/, 'UHD BluRay'],
    [/blu[-\s]?ray|bluray|\bbd\b|blu-ray/, 'BluRay'],
    [/brrip/, 'BRRip'],
    [/hdrip/, 'HDRip'],
    [/hddvd/, 'HDDVD'],
    [/dvd\-?(5|9|10|14|18)|dvdrip|dvdscr|pdvd|\bdvd\b/, 'DVD'],
    [/web\.?dl|\bweb\b|webdl|amzn\.web\-?dl/, 'WEB-DL'],
    [/webrip/, 'WEBRip'],
    [/hr\-?hdtv|hdtvrip|tvrip|pdtv|\bhdtv\b/, 'HDTV'],
    [/\btv\b|dtv|pdtv/, 'TV'],
    [/vhsrip/, 'VHSRip'],
    [/vod/, 'VOD'],
    [/camrip|\bcam\b|camera/, 'CAM'],
    [/\bts\b|tc|hc/, 'TS/TC/HC'],
    [/\br5\b/, 'R5'],
    [/\bamzn\b/, 'AMZN'],
    [/\bnf\b/, 'NF'],
    [/\bp2p\b/, 'P2P']
  ]
  for (const [pattern, source] of sourcePatterns) {
    if (pattern.test(lowerPath)) {
      result.source = source
      break
    }
  }

  const qualityTags: string[] = []
  if (/remux/.test(lowerPath)) qualityTags.push('REMUX')
  if (/proper/.test(lowerPath)) qualityTags.push('PROPER')
  if (/repack/.test(lowerPath)) qualityTags.push('REPACK')
  if (/extended|director.?cut/.test(lowerPath)) qualityTags.push('EXTENDED')
  if (/imax/.test(lowerPath)) qualityTags.push('IMAX')
  if (/\bhq\b/.test(lowerPath)) qualityTags.push('HQ')
  if (result.ultraHd) qualityTags.push('ULTRAHD')
  if (result.hfr) qualityTags.push('HFR')
  if (/\bedr\b|edr10/.test(lowerPath)) qualityTags.push('EDR')
  result.qualityTags = qualityTags

  const bitDepthMatch = lowerPath.match(/(\d+)\s*bit/)
  if (bitDepthMatch) {
    result.bitDepth = parseInt(bitDepthMatch[1]!, 10)
  }

  return result
}

/**
 * 计算质量分数
 */
function calculateQualityScore(path: string, size: number): number {
  const info = extractVideoInfo(path)
  let score = 0

  const resolutionScores: Record<string, number> = {
    '4320p': 2000,
    '2160p': 2000,
    '1440p': 1700,
    '1080p': 1500,
    '720p': 1000,
    '576p': 650,
    '480p': 600,
    '360p': 300
  }
  if (info.resolution) {
    score += resolutionScores[info.resolution] || 0
  }

  const videoCodecScores: Record<string, number> = {
    'AV1': 500,
    'H.265': 400,
    'H.264': 300,
    'VP9': 250,
    'ProRes': 350,
    'VC-1': 220,
    'VP8': 200,
    'Dirac': 200,
    'MPEG-2': 180,
    'MPEG-4': 160,
    'AVS': 150,
    'XviD': 150,
    'Theora': 120,
    'DivX': 100,
    'RealVideo': 80
  }
  if (info.videoCodec) {
    score += videoCodecScores[info.videoCodec] || 0
  }

  const audioCodecScores: Record<string, number> = {
    'TrueHD': 300,
    'DTS:X': 280,
    'DTS-HD MA': 260,
    'DTS-HD': 250,
    'DTS': 200,
    'DD+': 150,
    'DD': 120,
    'PCM': 120,
    'WAV': 110,
    'AAC': 100,
    'ALAC': 100,
    'FLAC': 90,
    'OPUS': 90,
    'MP3': 50
  }
  if (info.audioCodec) {
    const tokens = info.audioCodec.split('|').map(t => t.trim())
    let bestAudio = 0
    for (const token of tokens) {
      bestAudio = Math.max(bestAudio, audioCodecScores[token] || 0)
    }
    score += bestAudio
  }

  const hdrScores: Record<string, number> = {
    'HDR10+': 200,
    'HDR10': 150,
    'HDR': 100
  }
  if (info.hdrType) {
    score += hdrScores[info.hdrType] || 0
  }

  if (info.dolbyVision) score += 250
  if (info.atmos) score += 150

  if (info.bitDepth) {
    if (info.bitDepth >= 12) score += 80
    else if (info.bitDepth >= 10) score += 50
  }

  if (info.fps) {
    if (info.fps >= 50) score += 70
    else if (info.fps >= 30) score += 15
  }

  const sourceScores: Record<string, number> = {
    'REMUX': 400,
    'UHD BluRay': 350,
    'BluRay': 300,
    'HDDVD': 280,
    'WEB-DL': 250,
    'AMZN': 240,
    'NF': 230,
    'VOD': 220,
    'WEBRip': 200,
    'P2P': 200,
    'BRRip': 180,
    'HDTV': 150,
    'TV': 120,
    'DVDRip': 100,
    'DVD': 80,
    'R5': 70,
    'TS/TC/HC': 50,
    'CAM': 20,
    'VHSRip': 10
  }
  if (info.source) {
    score += sourceScores[info.source] || 0
  }

  const qualityTagScores: Record<string, number> = {
    'REMUX': 200,
    'PROPER': 50,
    'REPACK': 30,
    'EXTENDED': 40,
    'IMAX': 100,
    'ULTRAHD': 70,
    'HFR': 60,
    'HQ': 40,
    'EDR': 120
  }
  for (const tag of info.qualityTags) {
    score += qualityTagScores[tag] || 0
  }

  const sizeGB = size / (1024 * 1024 * 1024)
  if (sizeGB > 0) {
    let idealSize = 2
    if (info.resolution === '2160p' || info.resolution === '4320p') {
      idealSize = 25
    } else if (info.resolution === '1440p') {
      idealSize = 12
    } else if (info.resolution === '1080p') {
      idealSize = 8
    } else if (info.resolution === '720p') {
      idealSize = 4
    } else if (info.resolution === '576p') {
      idealSize = 2.5
    }
    const sizeRatio = sizeGB / idealSize
    let sizeScore = 0
    if (sizeRatio >= 0.5 && sizeRatio <= 2.0) {
      sizeScore = 200 - Math.abs(sizeRatio - 1.0) * 100
    } else {
      sizeScore = Math.max(0, 100 - Math.abs(sizeRatio - 1.0) * 50)
    }
    score += Math.round(sizeScore)
  }

  return Math.round(score)
}

/**
 * 获取质量等级
 */
function getQualityLevel(score: number): string {
  if (score >= 4000) return '优秀'
  if (score >= 3000) return '良好'
  if (score >= 2000) return '一般'
  return '较差'
}

/**
 * 生成视频标签
 */
function generateVideoTags(info: ReturnType<typeof extractVideoInfo>): string[] {
  const tags: string[] = []

  if (info.resolution) tags.push(info.resolution)
  
  const qualitySection: string[] = []
  if (info.hdrType) qualitySection.push(info.hdrType)
  if (info.dolbyVision) qualitySection.push('Dolby Vision')
  if (info.atmos) qualitySection.push('Dolby Atmos')
  if (info.qualityTags.includes('REMUX')) qualitySection.push('REMUX')
  if (info.qualityTags.includes('IMAX')) qualitySection.push('IMAX')
  if (info.qualityTags.includes('ULTRAHD')) qualitySection.push('UHD')
  if (info.qualityTags.includes('HFR')) qualitySection.push('HFR')
  if (info.qualityTags.includes('HQ')) qualitySection.push('HQ')
  if (info.qualityTags.includes('EDR')) qualitySection.push('EDR')
  
  if (qualitySection.length > 0) {
    tags.push(qualitySection.join(' / '))
  }
  
  if (info.fps) tags.push(`${info.fps}fps`)
  if (info.bitDepth) tags.push(`${info.bitDepth}bit`)
  if (info.audioCodec) tags.push(info.audioCodec)
  if (info.source && info.source !== 'REMUX') tags.push(info.source)

  return tags
}

/**
 * 分析电影查重
 */
async function analyzeMovieDuplicates(
  libraryId: string,
  libraryName: string,
  progressCallback?: (info: ProgressInfo) => void
): Promise<DuplicateReportItem[]> {
  const duplicates: DuplicateReportItem[] = []

  if (progressCallback) {
    progressCallback({
      message: `正在获取媒体库 ${libraryName} 的电影列表...`,
      library: libraryName
    })
  }

  const items = await getLibraryItems(libraryId, 'Movie')

  // 按 ProviderIds 分组
  const groupedItems: Record<string, any[]> = {}

  for (const item of items) {
    const mediaSources = item.MediaSources || []
    if (mediaSources.length > 1) {
      const movieFiles: DuplicateItem[] = []

      for (const source of mediaSources) {
        const path = source.Path || ''
        const size = parseInt(source.Size || '0', 10)
        const qualityScore = path ? calculateQualityScore(path, size) : 0
        const videoInfo = extractVideoInfo(path)

        movieFiles.push({
          id: source.Id || item.Id,
          path,
          name: source.Name || item.Name,
          embyItemId: item.Id,
          mediaSourceId: source.Id,
          deleteType: 'media_source',
          qualityScore,
          qualityLevel: getQualityLevel(qualityScore),
          videoTags: generateVideoTags(videoInfo)
        })
      }

      movieFiles.sort((a, b) => b.qualityScore - a.qualityScore)

      const dupItem: DuplicateReportItem = {
        kind: 'movie',
        title: item.Name,
        year: item.ProductionYear,
        id: `${item.Id} (Multi-Version)`,
        items: movieFiles
      }
      
      if (progressCallback) {
        progressCallback({
          message: `发现电影重复: ${item.Name}`,
          library: libraryName,
          item: dupItem
        })
      }
      
      duplicates.push(dupItem)
      continue
    }

    // 未合并的项目按 ProviderIds 分组
    const providerIds = item.ProviderIds || {}
    const idKey = providerIds.Tmdb || providerIds.tmdb || providerIds.TMDB || 
                  providerIds.Imdb || providerIds.imdb || providerIds.IMDB || 
                  providerIds.Tvdb || providerIds.tvdb || providerIds.TVDB

    let groupKey = idKey
    if (!groupKey) {
      // 没有元数据的项目使用名称+年份
      const name = item.Name
      const year = item.ProductionYear
      if (name) {
        groupKey = `name:${name}|${year}`
      }
    }

    if (groupKey) {
      if (!groupedItems[groupKey]) {
        groupedItems[groupKey] = []
      }
      groupedItems[groupKey]!.push(item)
    }
  }

  // 检查未合并的重复项
  for (const [idKey, group] of Object.entries(groupedItems)) {
    if (group.length > 1) {
      const firstItem = group[0]
      const movieFiles: DuplicateItem[] = []

      for (const movie of group) {
        const path = movie.Path || ''
        let size = 0
        const sources = movie.MediaSources || []
        const firstSource = sources[0]
        if (firstSource) {
          size = parseInt(firstSource.Size || '0', 10)
        }

        const qualityScore = path ? calculateQualityScore(path, size) : 0
        const videoInfo = extractVideoInfo(path)

        movieFiles.push({
          id: movie.Id,
          path,
          name: movie.Name,
          embyItemId: movie.Id,
          deleteType: 'item',
          qualityScore,
          qualityLevel: getQualityLevel(qualityScore),
          videoTags: generateVideoTags(videoInfo)
        })
      }

      movieFiles.sort((a, b) => b.qualityScore - a.qualityScore)

      const dupItem: DuplicateReportItem = {
        kind: 'movie',
        title: firstItem.Name,
        year: firstItem.ProductionYear,
        id: idKey,
        items: movieFiles
      }
      
      if (progressCallback) {
        progressCallback({
          message: `发现电影重复: ${firstItem.Name}`,
          library: libraryName,
          item: dupItem
        })
      }
      
      duplicates.push(dupItem)
    }
  }

  return duplicates
}

/**
 * 分析电视剧查重
 */
async function analyzeTVShowDuplicates(
  libraryId: string,
  libraryName: string,
  progressCallback?: (info: ProgressInfo) => void
): Promise<DuplicateReportItem[]> {
  const duplicates: DuplicateReportItem[] = []

  if (progressCallback) {
    progressCallback({
      message: `正在获取媒体库 ${libraryName} 的剧集列表...`,
      library: libraryName
    })
  }

  const items = await getLibraryItems(libraryId, 'Series')

  // 1. 检查未合并的剧集重复
  const groupedSeries: Record<string, any[]> = {}

  for (const show of items) {
    const providerIds = show.ProviderIds || {}
    const idKey = providerIds.Tmdb || providerIds.tmdb || providerIds.TMDB || 
                  providerIds.Imdb || providerIds.imdb || providerIds.IMDB || 
                  providerIds.Tvdb || providerIds.tvdb || providerIds.TVDB

    let groupKey = idKey
    if (!groupKey) {
      const name = show.Name
      const year = show.ProductionYear
      if (name) {
        groupKey = `name:${name}|${year}`
      }
    }

    if (groupKey) {
      if (!groupedSeries[groupKey]) {
        groupedSeries[groupKey] = []
      }
      groupedSeries[groupKey]!.push(show)
    }
  }

  // 检查未合并的剧集重复
  for (const [idKey, group] of Object.entries(groupedSeries)) {
    if (group.length > 1) {
      const firstItem = group[0]
      const seriesItems: DuplicateItem[] = []

      for (const series of group) {
        const path = series.Path || ''
        let size = 0
        const sources = series.MediaSources || []
        const firstSource = sources[0]
        if (firstSource) {
          size = parseInt(firstSource.Size || '0', 10)
        }

        const qualityScore = path ? calculateQualityScore(path, size) : 0
        const videoInfo = extractVideoInfo(path)

        seriesItems.push({
          id: series.Id,
          path,
          name: series.Name,
          embyItemId: series.Id,
          deleteType: 'item',
          qualityScore,
          qualityLevel: getQualityLevel(qualityScore),
          videoTags: generateVideoTags(videoInfo)
        })
      }

      seriesItems.sort((a, b) => b.qualityScore - a.qualityScore)

      const dupItem: DuplicateReportItem = {
        kind: 'series',
        title: firstItem.Name,
        year: firstItem.ProductionYear,
        id: idKey,
        items: seriesItems
      }
      
      if (progressCallback) {
        progressCallback({
          message: `发现剧集重复: ${firstItem.Name}`,
          library: libraryName,
          item: dupItem
        })
      }
      
      duplicates.push(dupItem)
    }
  }

  // 2. 检查剧集重复（多版本集）
  for (let i = 0; i < items.length; i++) {
    const show = items[i]
    const showName = show.Name

    if (progressCallback && i % 5 === 0) {
      progressCallback({
        message: `正在分析剧集重复: ${showName} (${i + 1}/${items.length})`,
        currentShow: showName,
        library: libraryName
      })
    }

    const episodes = await getEpisodes(show.Id)

    const groupedEpisodes: Record<string, any[]> = {}

    for (const ep of episodes) {
      const mediaSources = ep.MediaSources || []
      if (mediaSources.length > 1) {
        const season = ep.ParentIndexNumber || 0
        const episodeNum = ep.IndexNumber || 0
        let episodeKey: string

        if (ep.ParentIndexNumber != null && ep.IndexNumber != null) {
          episodeKey = `S${ep.ParentIndexNumber}E${ep.IndexNumber}`
        } else {
          episodeKey = `Name:${ep.Name}`
        }

        const episodeItems: DuplicateItem[] = mediaSources.map((source: MediaSource) => {
          const path = source.Path || ''
          const size = parseInt(source.Size || '0', 10)
          const qualityScore = path ? calculateQualityScore(path, size) : 0

          return {
            id: source.Id || ep.Id,
            path,
            name: source.Name || ep.Name,
            embyItemId: ep.Id,
            mediaSourceId: source.Id,
            deleteType: 'media_source' as const,
            qualityScore,
            qualityLevel: getQualityLevel(qualityScore),
            videoTags: generateVideoTags(extractVideoInfo(path))
          }
        })

        episodeItems.sort((a, b) => b.qualityScore - a.qualityScore)

        const dupItem: DuplicateReportItem = {
          kind: 'episode',
          show: showName,
          episodeKey,
          title: `${showName} S${season}E${episodeNum}`,
          year: show.ProductionYear,
          id: `${ep.Id} (Multi-Version)`,
          items: episodeItems
        }
        
        if (progressCallback) {
          progressCallback({
            message: `发现集数重复: ${showName} S${season}E${episodeNum}`,
            library: libraryName,
            item: dupItem
          })
        }
        
        duplicates.push(dupItem)
        continue
      }

      const season = ep.ParentIndexNumber
      const episodeNum = ep.IndexNumber
      let key: string | null = null

      if (season != null && episodeNum != null) {
        key = `S${season}E${episodeNum}`
      } else {
        const epName = ep.Name
        if (epName) {
          key = `Name:${epName}`
        }
      }

      if (key) {
        if (!groupedEpisodes[key]) {
          groupedEpisodes[key] = []
        }
        groupedEpisodes[key]!.push(ep)
      }
    }

    for (const [key, group] of Object.entries(groupedEpisodes)) {
      if (group.length > 1) {
        const firstEp = group[0]
        const episodeItems: DuplicateItem[] = []

        for (const episode of group) {
          const path = episode.Path || ''
          let size = 0
          const sources = episode.MediaSources || []
          const firstSource = sources[0]
          if (firstSource) {
            size = parseInt(firstSource.Size || '0', 10)
          }

          const qualityScore = path ? calculateQualityScore(path, size) : 0
          const videoInfo = extractVideoInfo(path)

          episodeItems.push({
            id: episode.Id,
            path,
            name: episode.Name,
            embyItemId: episode.Id,
            deleteType: 'item',
            qualityScore,
            qualityLevel: getQualityLevel(qualityScore),
            videoTags: generateVideoTags(videoInfo)
          })
        }

        episodeItems.sort((a, b) => b.qualityScore - a.qualityScore)

        const dupItem: DuplicateReportItem = {
          kind: 'episode',
          show: showName,
          episodeKey: key,
          title: `${showName} ${key}`,
          year: show.ProductionYear,
          id: key,
          items: episodeItems
        }
        
        if (progressCallback) {
          progressCallback({
            message: `发现集数重复: ${showName} ${key}`,
            library: libraryName,
            item: dupItem
          })
        }
        
        duplicates.push(dupItem)
      }
    }
  }

  return duplicates
}

/**
 * 分析重复内容
 * 主入口函数
 */
export async function analyzeDuplicates(
  libraryId?: string,
  progressCallback?: (info: ProgressInfo) => void
): Promise<DuplicatesReport> {
  const report: Record<string, DuplicateReportItem[]> = {}
  const errors: string[] = []

  try {
    const libraries = await getDuplicateLibraries()

    const targetLibraries = libraries.filter(lib => {
      const libraryItemId = lib.ItemId
      const libraryType = lib.CollectionType
      if (!libraryItemId || !libraryType) {
        return false
      }
      if (libraryId && libraryId !== 'all' && libraryItemId !== libraryId) {
        return false
      }
      return ['movies', 'tvshows'].includes(libraryType)
    })

    for (const lib of targetLibraries) {
      const libName = lib.Name || '未知媒体库'
      const libType = lib.CollectionType
      const libraryItemId = lib.ItemId

      if (!libType || !libraryItemId) {
        continue
      }

      report[libName] = []

      try {
        if (libType === 'movies') {
          report[libName] = await analyzeMovieDuplicates(libraryItemId, libName, progressCallback)
        } else if (libType === 'tvshows') {
          report[libName] = await analyzeTVShowDuplicates(libraryItemId, libName, progressCallback)
        }
        
        if (progressCallback) {
          progressCallback({
            message: `媒体库 ${libName} 查重完成`,
            library: libName,
            libraryComplete: true
          })
        }
      } catch (e: any) {
        errors.push(`${libName}: ${e.message}`)
        log.error('剧集查重', `分析媒体库 ${libName} 失败`, e.message)
      }
    }

    if (progressCallback) {
      progressCallback({
        message: '查重完成'
      })
    }

    return { data: report, errors }
  } catch (e: any) {
    log.error('剧集查重', '查重失败', e.message)
    throw e
  }
}

// 缓存最近的查重报告用于导出
let lastDuplicatesReport: Record<string, DuplicateReportItem[]> = {}

/**
 * 获取缓存的查重报告
 */
export function getLastDuplicatesReport(): Record<string, DuplicateReportItem[]> {
  return lastDuplicatesReport
}

/**
 * 设置缓存的查重报告
 */
export function setLastDuplicatesReport(report: Record<string, DuplicateReportItem[]>): void {
  lastDuplicatesReport = report
}
