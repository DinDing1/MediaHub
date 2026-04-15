/**
 * 文件名信息提取模块
 * 
 * 本模块负责从视频文件名中提取关键信息，包括：
 * - 媒体标题（电影名或剧集名）
 * - 发行年份
 * - 季数和集数（电视剧）
 * - 媒体类型（电影或电视剧）
 * - TMDB ID（如果文件名中包含）
 * 
 * 支持的文件名格式示例：
 * - 电影: "Avatar.2009.2160p.UHD.BluRay.x265.10bit.HDR.DTS-HD.MA.7.1.mkv"
 * - 电视剧: "Game.of.Thrones.S01E01.1080p.WEB-DL.DDP5.1.H.264.mkv"
 * - 包含TMDB ID: "The.Matrix.1999.{tmdb=603}.1080p.mkv"
 */

import type { FileInfo } from './types'

const SAFE_TITLE_ABBREVIATIONS = new Set([
  'FBI',
  'CSI',
  'NCIS',
  'SWAT',
  'SEAL',
  'CIA',
  'NYPD',
  'LAPD',
])

function isSuspiciousTrailingToken(token: string, totalTokens: number): boolean {
  if (totalTokens < 3) {
    return false
  }

  if (!/^[A-Z]{3,6}$/.test(token)) {
    return false
  }

  return !SAFE_TITLE_ABBREVIATIONS.has(token)
}

function stripTrailingNoiseTokens(text: string): string {
  const tokens = text.split(/\s+/).filter(Boolean)

  while (tokens.length > 0) {
    const lastToken = tokens[tokens.length - 1]
    if (!lastToken || !isSuspiciousTrailingToken(lastToken, tokens.length)) {
      break
    }
    tokens.pop()
  }

  return tokens.join(' ')
}

/**
 * 电视剧集数识别正则表达式模式列表
 * 支持多种常见的季集格式：
 * - S01E01: 标准格式
 * - S01.E01: 带点分隔
 * - 1x01: 交叉格式
 * - 第1集: 中文格式
 * - EP01/E01: 简化格式
 */
const TV_PATTERNS = [
  /S(\d{1,2})E(\d{1,3})/i,
  /S(\d{1,2})\.E(\d{1,3})/i,
  /(\d{1,2})x(\d{1,3})/i,
  /第(\d{1,3})集/i,
  /EP?(\d{1,3})/i,
  /E(\d{1,3})$/i,
]

const SEASON_ONLY_PATTERNS = [
  /\bS(\d{1,2})(?![E\d])/i,
  /Season\s*(\d{1,2})/i,
  /第(\d{1,2})季/i,
]

/**
 * 从文件名中检测电视剧季集信息
 * 
 * @param fileName - 文件名（不含扩展名）
 * @returns 包含季数和集数的对象，如果未检测到则返回null
 * 
 * @example
 * detectTvEpisode("Game.of.Thrones.S01E05")
 * // 返回: { season: 1, episode: 5 }
 */
function detectTvEpisode(fileName: string): { season: number | null; episode: number | null } {
  const base = fileName.replace(/\.[^.]+$/, '')
  
  for (const pattern of TV_PATTERNS) {
    const match = base.match(pattern)
    if (match) {
      if (pattern.source.includes('第')) {
        return { season: 1, episode: parseInt(match[1] || '0', 10) }
      }
      if (match[1] && match[2]) {
        return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) }
      }
      if (match[1]) {
        return { season: 1, episode: parseInt(match[1], 10) }
      }
    }
  }
  
  return { season: null, episode: null }
}

function detectSeasonOnly(fileName: string): number | null {
  const base = fileName.replace(/\.[^.]+$/, '')
  
  for (const pattern of SEASON_ONLY_PATTERNS) {
    const match = base.match(pattern)
    if (match && match[1]) {
      return parseInt(match[1], 10)
    }
  }
  
  return null
}

/**
 * 清理文件名中的无关信息，生成用于搜索的查询字符串
 * 
 * 移除的内容包括：
 * - 方括号、花括号、圆括号及其内容
 * - 季集标识（S01E01等）
 * - 视频规格信息（分辨率、来源、编码等）
 * - 音频规格信息（编码、声道等）
 * - 特效标识（HDR、DV等）
 * - 流媒体来源（Netflix、Disney+等）
 * - TMDB ID标识
 * 
 * @param text - 原始文件名
 * @returns 清理后的查询字符串
 * 
 * @example
 * cleanQuery("Avatar.2009.2160p.UHD.BluRay.x265")
 * // 返回: "Avatar 2009"
 */
function cleanQuery(text: string): string {
  let cleaned = text

  cleaned = cleaned.replace(/\[[^\]]*\]/g, ' ')
  cleaned = cleaned.replace(/\{[^}]*\}/g, ' ')
  cleaned = cleaned.replace(/\([^)]*\)/g, ' ')

  const tvPattern = cleaned.match(/^(.+?)[.\s\-_]*S\d{1,2}E\d{1,3}/i)
  if (tvPattern && tvPattern[1]) {
    cleaned = tvPattern[1]
  }

  cleaned = cleaned.replace(/S\d{1,2}E\d{1,3}/gi, ' ')
  cleaned = cleaned.replace(/\d{1,2}x\d{1,3}/gi, ' ')
  cleaned = cleaned.replace(/第\d+集/g, ' ')
  cleaned = cleaned.replace(/EP?\d{1,3}/gi, ' ')

  cleaned = cleaned.replace(/\b(2160p|1080p|720p|480p|360p|4K|8K|2K|UHD|HD|SD)\b/gi, ' ')
  cleaned = cleaned.replace(/\b(WEB-?DL|WEBRip|BluRay|BDRip|HDTV|DVDRip|REMUX)\b/gi, ' ')
  cleaned = cleaned.replace(/\b(H\.?26[45]|X\.?26[45]|HEVC|AVC|AV1)\b/gi, ' ')
  cleaned = cleaned.replace(/\b(DTS[-\s.]?HD[-\s.]?MA|DTS[-\s.]?HD|DTS|DDP\d*\.?\d*|DD\+?\d*\.?\d*|EAC3|E-AC-3|AC[-\s]?3|AAC\d*\.?\d*|TrueHD|Atmos|FLAC|LPCM|PCM|Dolby\s*Digital\s*Plus|Dolby\s*Atmos)\b/gi, ' ')
  cleaned = cleaned.replace(/\b(DV|HDR10\+|HDR10P|HDR10|HDR|HLG|SDR|Vivid)\b/gi, ' ')
  cleaned = cleaned.replace(/\b(Netflix|Amazon|Disney\+|HBO|Hulu|AppleTV|AMZN|NF|MAX|HMAX|DSNP|ATVP|MAXPLUS|Bilibili|CR|Funimation|iT|iTunes)\b/gi, ' ')
  cleaned = cleaned.replace(/\b\d+(bit|fps)\b/gi, ' ')
  cleaned = cleaned.replace(/\b\d{1,2}\.\d{1,2}\b/g, ' ')
  cleaned = cleaned.replace(/\btmdb[=＝]?\d+\b/gi, ' ')
  cleaned = cleaned.replace(/\b(tmdb|tmdbid)\s*[=－-]?\s*\d+\b/gi, ' ')
  cleaned = cleaned.replace(/\b(HiveWeb|RARBG|YTS|ETTV)\b/gi, ' ')
  cleaned = cleaned.replace(/@[A-Za-z0-9]+/gi, ' ')
  cleaned = cleaned.replace(/\bP\d+\b/g, ' ')

  cleaned = cleaned.replace(/[-][A-Za-z]+$/g, ' ')
  cleaned = cleaned.replace(/[._\-\[\]\(\)\{\}]/g, ' ')
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  cleaned = cleaned.replace(/\b(DDP|DD|DTS|AAC|AC3|FLAC|LPCM|PCM|TrueHD|Atmos|H|X|HEVC|AVC|AV1|HQ|UHD|WEB|DL|MA)\b/gi, ' ')
  cleaned = cleaned.replace(/\bDDP\d+\b/gi, ' ')
  cleaned = cleaned.replace(/\bDTS\d+\b/gi, ' ')
  cleaned = cleaned.replace(/\bAAC\d+\b/gi, ' ')
  cleaned = cleaned.replace(/\bAC3\d+\b/gi, ' ')
  cleaned = cleaned.replace(/\bFLAC\d+\b/gi, ' ')
  cleaned = cleaned.replace(/\bLPCM\d+\b/gi, ' ')
  cleaned = cleaned.replace(/\bPCM\d+\b/gi, ' ')
  cleaned = cleaned.replace(/\bTrueHD\d+\b/gi, ' ')
  cleaned = cleaned.replace(/\bAtmos\d+\b/gi, ' ')
  cleaned = cleaned.replace(/\bH\d+\b/gi, ' ')
  cleaned = cleaned.replace(/\bX\d+\b/gi, ' ')
  cleaned = cleaned.replace(/\bHEVC\d+\b/gi, ' ')
  cleaned = cleaned.replace(/\bAVC\d+\b/gi, ' ')
  cleaned = cleaned.replace(/\bAV1\d+\b/gi, ' ')
  cleaned = cleaned.replace(/\bS\d{2,}\b/gi, ' ')
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  cleaned = stripTrailingNoiseTokens(cleaned)

  return cleaned
}

/**
 * 从文本中提取年份
 * 支持识别1900-2099范围内的年份
 * 
 * @param text - 包含年份的文本
 * @returns 提取到的年份字符串，未找到则返回null
 * 
 * @example
 * extractYear("Avatar.2009.2160p") // 返回: "2009"
 */
function extractYear(text: string): string | null {
  const match = text.match(/\b(19\d{2}|20\d{2})\b/)
  return match && match[1] ? match[1] : null
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
 * @param text - 包含TMDB ID的文本
 * @returns TMDB ID数字，未找到则返回null
 * 
 * @example
 * extractTmdbId("The.Matrix.1999.{tmdb=603}") // 返回: 603
 * extractTmdbId("Movie.2024.[tmdbid-12345]") // 返回: 12345
 */
function extractTmdbId(text: string): number | null {
  const patterns = [
    /[\{\[]\s*tmdb(id)?\s*[=\-－]?\s*(\d+)\s*[\}\]]/i,
    /\btmdb(id)?\s*[=\-－]?\s*(\d+)\b/i,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const id = match[2]
      if (id && /^\d+$/.test(id)) {
        return parseInt(id, 10)
      }
    }
  }
  
  return null
}

/**
 * 从文件名中提取关键信息
 * 
 * 这是本模块的主函数，整合所有提取逻辑：
 * 1. 检测是否为电视剧（通过季集模式）
 * 2. 提取年份
 * 3. 清理文件名获取标题
 * 4. 提取TMDB ID（如果有）
 * 
 * @param fileName - 完整文件名（含扩展名）
 * @returns FileInfo对象，包含提取的所有信息
 * 
 * @example
 * extractKeyInfo("Game.of.Thrones.S01E01.1080p.WEB-DL.mkv")
 * // 返回: {
 * //   title: "Game of Thrones",
 * //   year: null,
 * //   season: 1,
 * //   episode: 1,
 * //   mediaType: "tv",
 * //   fallbackQuery: "Game of Thrones"
 * // }
 */
export function extractKeyInfo(fileName: string, folderFiles?: string[]): FileInfo {
  const base = fileName.replace(/\.[^.]+$/, '').trim()
  
  let { season, episode } = detectTvEpisode(base)
  let mediaType: 'movie' | 'tv' = season && episode ? 'tv' : 'movie'
  let totalEpisodes: number | null = null
  
  if (!season && !episode) {
    const seasonOnly = detectSeasonOnly(base)
    if (seasonOnly) {
      season = seasonOnly
      mediaType = 'tv'
    }
  }
  
  if (mediaType === 'tv' && folderFiles && folderFiles.length > 0) {
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.ts', '.m2ts']
    const videoFiles = folderFiles.filter(f => {
      const ext = f.substring(f.lastIndexOf('.')).toLowerCase()
      return videoExtensions.includes(ext)
    })
    totalEpisodes = videoFiles.length
  }
  
  if (!season && !episode && folderFiles && folderFiles.length > 0) {
    const hasSeasonPattern = folderFiles.some(f => {
      const fileBase = f.replace(/\.[^.]+$/, '')
      return /\bS\d{1,2}E\d{1,3}\b/i.test(fileBase) || 
             /\bSeason\s*\d{1,2}\b/i.test(f) ||
             /第\d+集/i.test(fileBase)
    })
    
    if (hasSeasonPattern) {
      mediaType = 'tv'
      season = season || 1
    }
  }
  
  let title = ''
  let year: string | null = null
  
  const tmdbId = extractTmdbId(base)
  
  year = extractYear(base)
  
  const cleaned = cleanQuery(base)

  const parts = cleaned.split(/\s+/).filter(p => p.length > 0)
  const titleParts: string[] = []

  for (const part of parts) {
    if (/^\d{4}$/.test(part) && !year) {
      year = part
      continue
    }
    if (year && part === year) {
      continue
    }
    if (/^(p|fps|bit|k|hd|uhd|sdr|hdr|dv|atmos|truehd|flac|aac|ac3|dd|ddp|dts|hevc|avc|h264|h265|x264|x265|av1|web|dl|bluray|remux|hdtv|dvd|netflix|amazon|disney|hbo|hulu|apple|amzn|nf|max|hmax|dsnp|atvp)$/i.test(part)) {
      continue
    }
    titleParts.push(part)
  }
  
  title = titleParts.join(' ').trim()
  
  if (!title) {
    title = cleaned.split(/\s+/)[0] || ''
  }
  
  title = title.replace(/\s+/g, ' ').trim()
  if (year && title.includes(year)) {
    title = title.replace(new RegExp(`\\s*${year}\\s*`, 'g'), ' ').trim()
  }
  
  return {
    title,
    year,
    season,
    episode,
    totalEpisodes,
    mediaType,
    fallbackQuery: cleanQuery(base),
    tmdbId,
  }
}
