/**
 * 云盘整理主逻辑模块
 * 整合文件信息提取、技术信息提取、TMDB识别、分类策略、重命名模板等功能
 */

import { extractKeyInfo } from './file_info'
import { extractTechInfo, loadReleaseGroups } from './tech_info'
import { searchMedia, searchAndPick, getMediaDetails, getTvSeasonYear } from './tmdb'
import { classifyMedia } from './classify'
import { generateTargetPath } from './rename'
import { aiRecognizeFileName, isAIRecognizeEnabled } from './ai_recognize'
import type {
  FileInfo,
  TechInfo,
  TMDBSearchResult,
  TMDBDetails,
  TMDBMatchResult,
  RecognizeResult
} from './types'
import { log } from '../logger'

const AI_INVOKE_MIN_SCORE = 110
const AI_INVOKE_EXACT_YEAR_SCORE = 130

function normalizeCompareText(text: string): string {
  return text
    .replace(/[’']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isShortEnglishQuery(query: string): boolean {
  const normalized = normalizeCompareText(query)
  if (!normalized) return false
  if (!/^[a-z0-9\s]+$/i.test(normalized)) return false

  const words = normalized.split(/\s+/).filter(Boolean)
  const compactLength = normalized.replace(/\s+/g, '').length
  return words.length > 0 && words.length <= 3 && compactLength <= 14
}

function stripLeadingArticle(query: string): string {
  return query.replace(/^(the|a|an)\s+/i, '').trim()
}

function buildTraditionalSearchQueries(fileInfo: FileInfo): string[] {
  const rawCandidates = [
    fileInfo.title,
    fileInfo.fallbackQuery,
    fileInfo.title ? stripLeadingArticle(fileInfo.title) : '',
    fileInfo.fallbackQuery ? stripLeadingArticle(fileInfo.fallbackQuery) : '',
  ]

  const queries: string[] = []
  const seen = new Set<string>()

  for (const candidate of rawCandidates) {
    const trimmed = candidate?.trim()
    if (!trimmed) continue

    const normalized = normalizeCompareText(trimmed)
    if (!normalized || seen.has(normalized)) continue

    seen.add(normalized)
    queries.push(trimmed)
  }

  return queries
}

async function resolveTraditionalMatch(
  fileInfo: FileInfo,
  mediaType: 'movie' | 'tv'
): Promise<{ matchResult: TMDBMatchResult | null; query: string }> {
  const queries = buildTraditionalSearchQueries(fileInfo)

  for (const query of queries) {
    if (fileInfo.year) {
      log.info('整理', `传统TMDB搜索(年份优先): query="${query}", year=${fileInfo.year}, type=${mediaType}`)
      const yearMatch = await searchAndPick(query, mediaType, fileInfo.year)
      if (yearMatch) {
        return { matchResult: yearMatch, query }
      }

      const yearDetailMatch = await resolveTraditionalExactDetailMatch(query, mediaType, fileInfo.year)
      if (yearDetailMatch) {
        return { matchResult: yearDetailMatch, query }
      }
    }

    log.info('整理', `传统TMDB搜索(无年份): query="${query}", type=${mediaType}`)
    const fallbackMatch = await searchAndPick(query, mediaType)
    if (fallbackMatch) {
      return { matchResult: fallbackMatch, query }
    }

    const fallbackDetailMatch = await resolveTraditionalExactDetailMatch(query, mediaType)
    if (fallbackDetailMatch) {
      return { matchResult: fallbackDetailMatch, query }
    }
  }

  return { matchResult: null, query: queries[0] || '' }
}

type AIRecognizeCandidate = {
  title: string
  titleCn: string
  year: string
  mediaType: 'movie' | 'tv'
  tmdbId: number
}

type AIResolveResult = {
  details: TMDBDetails
  matchedBy: 'tmdbId' | 'title' | 'titleCn'
}

type AIHintConsistencyVerdict = 'consistent' | 'uncertain' | 'inconsistent'

type AIHintConsistencyResult = {
  verdict: AIHintConsistencyVerdict
  bestCoverage: number
  exactMatch: boolean
  reason: string
}

function normalizeYear(year?: string | null): string {
  return (year || '').trim()
}

function getComparableTitleTokens(text: string): string[] {
  return normalizeCompareText(text)
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => !/^(the|a|an)$/.test(token))
}

function getBestTokenCoverage(sourceTitles: string[], targetTitles: string[]): number {
  const sourceGroups = sourceTitles
    .filter(Boolean)
    .map(title => getComparableTitleTokens(title))
    .filter(tokens => tokens.length > 0)

  const targetGroups = targetTitles
    .filter(Boolean)
    .map(title => getComparableTitleTokens(title))
    .filter(tokens => tokens.length > 0)

  if (sourceGroups.length === 0 || targetGroups.length === 0) {
    return 0
  }

  return sourceGroups.reduce((best, sourceTokens) => {
    const maxCoverage = targetGroups.reduce((groupBest, targetTokens) => {
      const matchedCount = sourceTokens.filter(token => targetTokens.includes(token)).length
      return Math.max(groupBest, matchedCount / sourceTokens.length)
    }, 0)

    return Math.max(best, maxCoverage)
  }, 0)
}

function getTMDBDetailTitles(details: TMDBDetails): string[] {
  const seen = new Set<string>()

  return [
    details.title,
    details.titleCn || '',
    details.titleEn || '',
    details.originalTitle,
    ...(details.alternativeTitles || []),
  ]
    .map(title => title.trim())
    .filter(Boolean)
    .filter(title => {
      const normalized = normalizeCompareText(title)
      if (!normalized || seen.has(normalized)) {
        return false
      }
      seen.add(normalized)
      return true
    })
}

function isQueryCompatibleWithDetails(
  query: string,
  details: TMDBDetails,
  trustedYear?: string | null
): boolean {
  const normalizedQuery = normalizeCompareText(query)
  if (!normalizedQuery) {
    return false
  }

  const detailNormalizedTitles = getTMDBDetailTitles(details)
    .map(title => normalizeCompareText(title))
    .filter(Boolean)

  if (!detailNormalizedTitles.includes(normalizedQuery)) {
    return false
  }

  const expectedYear = normalizeYear(trustedYear)
  const detailsYear = normalizeYear(details.year)
  if (expectedYear && detailsYear && expectedYear !== detailsYear) {
    return false
  }

  return true
}

async function resolveTraditionalExactDetailMatch(
  query: string,
  mediaType: 'movie' | 'tv',
  year?: string | null
): Promise<TMDBMatchResult | null> {
  const results = await searchMedia(query, mediaType, year)
  if (!results.length) {
    return null
  }

  for (const result of results.slice(0, 5)) {
    const details = await getMediaDetails(result.id, mediaType)
    if (!details || !isQueryCompatibleWithDetails(query, details, year)) {
      continue
    }

    log.info('整理', `传统TMDB详情别名命中: query="${query}", year=${year || '—'}, candidate=${details.title} (${details.year}) [${mediaType}] TMDB=${details.id}`)
    return {
      result,
      score: year ? 130 : 100,
      yearMatched: !!(year && details.year === year),
      titleMatchType: 'exact',
      matchedBy: 'detail-alias',
    }
  }

  return null
}

function isAIResultCompatible(
  aiResult: AIRecognizeCandidate,
  details: TMDBDetails,
  trustedYear?: string | null
): boolean {
  const aiNormalizedTitles = [aiResult.title, aiResult.titleCn]
    .filter(Boolean)
    .map(title => normalizeCompareText(title))
    .filter(Boolean)

  const detailNormalizedTitles = getTMDBDetailTitles(details)
    .map(title => normalizeCompareText(title))
    .filter(Boolean)

  if (aiNormalizedTitles.length === 0 || detailNormalizedTitles.length === 0) {
    return false
  }

  const exactNormalizedMatch = aiNormalizedTitles.some(aiTitle =>
    detailNormalizedTitles.some(detailTitle => aiTitle === detailTitle)
  )

  if (!exactNormalizedMatch) {
    return false
  }

  const expectedYear = normalizeYear(trustedYear)
  const detailsYear = normalizeYear(details.year)
  if (expectedYear && detailsYear && expectedYear !== detailsYear) {
    return false
  }

  return true
}

function isAIResultConsistentWithHints(
  aiResult: AIRecognizeCandidate,
  hints: {
    title?: string
    fallbackQuery?: string | null
    year?: string | null
  }
): AIHintConsistencyResult {
  const hintTitles = [hints.title, hints.fallbackQuery].filter((title): title is string => Boolean(title))
  if (hintTitles.length === 0) {
    return {
      verdict: 'consistent',
      bestCoverage: 1,
      exactMatch: true,
      reason: 'missing_hints'
    }
  }

  const aiTitles = [aiResult.title, aiResult.titleCn].filter(Boolean)
  if (aiTitles.length === 0) {
    return {
      verdict: 'inconsistent',
      bestCoverage: 0,
      exactMatch: false,
      reason: 'missing_ai_titles'
    }
  }

  const hintNormalizedTitles = hintTitles
    .map(title => normalizeCompareText(title!))
    .filter(Boolean)

  const aiNormalizedTitles = aiTitles
    .map(title => normalizeCompareText(title))
    .filter(Boolean)

  const exactNormalizedMatch = hintNormalizedTitles.some(hintTitle =>
    aiNormalizedTitles.some(aiTitle => aiTitle === hintTitle)
  )

  const hintYear = normalizeYear(hints.year)
  const aiYear = normalizeYear(aiResult.year)
  if (hintYear && aiYear && hintYear !== aiYear) {
    return {
      verdict: 'inconsistent',
      bestCoverage: exactNormalizedMatch ? 1 : 0,
      exactMatch: exactNormalizedMatch,
      reason: 'year_conflict'
    }
  }

  if (exactNormalizedMatch) {
    return {
      verdict: 'consistent',
      bestCoverage: 1,
      exactMatch: true,
      reason: 'exact_normalized_match'
    }
  }

  const bestCoverage = getBestTokenCoverage(hintTitles, aiTitles)
  if (bestCoverage >= 0.85) {
    return {
      verdict: 'consistent',
      bestCoverage,
      exactMatch: false,
      reason: 'high_token_coverage'
    }
  }

  if (bestCoverage >= 0.45) {
    return {
      verdict: 'uncertain',
      bestCoverage,
      exactMatch: false,
      reason: 'partial_token_overlap'
    }
  }

  return {
    verdict: 'inconsistent',
    bestCoverage,
    exactMatch: false,
    reason: 'low_token_overlap'
  }
}

function shouldTrustAITmdbId(
  aiResult: AIRecognizeCandidate,
  details: TMDBDetails | null,
  trustedYear?: string | null
): boolean {
  if (!details) {
    return false
  }

  return isAIResultCompatible(aiResult, details, trustedYear)
}

function isReliableShortEnglishTraditionalMatch(
  matchResult: TMDBMatchResult,
  fileYear: string | null,
  searchQuery: string
): boolean {
  if (!isShortEnglishQuery(searchQuery)) {
    return false
  }

  const normalizedQuery = normalizeCompareText(searchQuery)
  const normalizedTitle = normalizeCompareText(matchResult.result.title)
  const normalizedOriginalTitle = normalizeCompareText(matchResult.result.originalTitle)
  const titleExactlyMatched = normalizedQuery === normalizedTitle || normalizedQuery === normalizedOriginalTitle

  if (matchResult.titleMatchType === 'exact') {
    return titleExactlyMatched && matchResult.score >= (fileYear ? 120 : 95)
  }

  if (matchResult.titleMatchType === 'contains') {
    return matchResult.score >= (fileYear ? 125 : 105)
  }

  return false
}

function isTraditionalMatchCloseEnoughToKeep(
  matchResult: TMDBMatchResult,
  fileYear: string | null,
  searchQuery: string
): boolean {
  if (isReliableShortEnglishTraditionalMatch(matchResult, fileYear, searchQuery)) {
    return true
  }

  const normalizedQuery = normalizeCompareText(searchQuery)
  const normalizedTitle = normalizeCompareText(matchResult.result.title)
  const normalizedOriginalTitle = normalizeCompareText(matchResult.result.originalTitle)
  const exactTitleMatched = normalizedQuery === normalizedTitle || normalizedQuery === normalizedOriginalTitle

  if (exactTitleMatched && (!fileYear || matchResult.yearMatched) && matchResult.score >= (fileYear ? 120 : 100)) {
    return true
  }

  return false
}

async function resolveAIResultToDetails(
  aiResult: AIRecognizeCandidate,
  mediaType: 'movie' | 'tv',
  trustedYear?: string | null
): Promise<AIResolveResult | null> {
  const candidates = [
    { query: aiResult.title, matchedBy: 'title' as const },
    { query: aiResult.titleCn, matchedBy: 'titleCn' as const },
  ].filter(candidate => candidate.query)

  const seenResultIds = new Set<number>()

  for (const candidate of candidates) {
    const queryVariants = [
      { query: candidate.query, year: aiResult.year, label: aiResult.year ? '年份优先' : '原始查询' },
      { query: candidate.query, year: null, label: '无年份' },
    ].filter((variant, index, variants) => {
      const key = `${variant.query}@@${variant.year || ''}`
      return variants.findIndex(item => `${item.query}@@${item.year || ''}` === key) === index
    })

    for (const variant of queryVariants) {
      const results = await searchMedia(variant.query, mediaType, variant.year)

      if (!results.length) {
        log.info('整理', `AI落地TMDB无结果: query="${variant.query}", year=${variant.year || '—'}, mediaType=${mediaType}, source=${candidate.matchedBy}`)
        continue
      }

      const summary = results
        .slice(0, 3)
        .map(result => `${result.title} (${result.year || '—'})#${result.id}`)
        .join(' | ')
      log.info('整理', `AI落地TMDB候选: query="${variant.query}", year=${variant.year || '—'}, mediaType=${mediaType}, source=${candidate.matchedBy}, mode=${variant.label}, results=${summary}`)

      for (const result of results) {
        if (seenResultIds.has(result.id)) {
          continue
        }
        seenResultIds.add(result.id)

        const details = await getMediaDetails(result.id, mediaType)
        if (details && isAIResultCompatible(aiResult, details, trustedYear)) {
          log.info('整理', `AI候选成功落地TMDB: ${details.title} (${details.year}) [${mediaType}] TMDB=${details.id}, source=${candidate.matchedBy}, mode=${variant.label}`)
          return { details, matchedBy: candidate.matchedBy }
        }

        if (details) {
          log.info('整理', `AI落地候选不兼容，跳过: ${details.title} (${details.year}) [${mediaType}] TMDB=${details.id}`)
        }
      }
    }
  }

  return null
}

function shouldInvokeAI(matchResult: TMDBMatchResult | null, fileYear: string | null, searchQuery: string): boolean {
  if (!matchResult) return true

  if (matchResult.matchedBy === 'detail-alias') {
    return false
  }

  if (isTraditionalMatchCloseEnoughToKeep(matchResult, fileYear, searchQuery)) {
    return false
  }

  if (matchResult.titleMatchType === 'fuzzy') return true

  if (fileYear && !matchResult.yearMatched) return true

  if (matchResult.score < AI_INVOKE_MIN_SCORE) return true

  if (matchResult.titleMatchType === 'partial' && matchResult.score < AI_INVOKE_EXACT_YEAR_SCORE) return true

  if (isShortEnglishQuery(searchQuery)) {
    const normalizedQuery = normalizeCompareText(searchQuery)
    const normalizedTitle = normalizeCompareText(matchResult.result.title)
    const normalizedOriginalTitle = normalizeCompareText(matchResult.result.originalTitle)

    if (normalizedQuery !== normalizedTitle && normalizedQuery !== normalizedOriginalTitle) {
      return true
    }

    if (matchResult.titleMatchType !== 'exact' && matchResult.titleMatchType !== 'contains') {
      return true
    }
  }

  return false
}

async function tryAIRecognize(
  fileName: string,
  defaultMediaType: 'movie' | 'tv',
  hints: {
    title?: string
    fallbackQuery?: string | null
    year?: string | null
    season?: number | null
    episode?: number | null
  } = {}
): Promise<{ details: TMDBDetails; mediaType: 'movie' | 'tv' } | null> {
  const aiResult = await aiRecognizeFileName(fileName, {
    title: hints.title,
    fallbackQuery: hints.fallbackQuery,
    year: hints.year,
    mediaType: defaultMediaType,
    season: hints.season,
    episode: hints.episode,
  })

  if (!aiResult) {
    log.info('整理', 'AI识别未返回可用结果')
    return null
  }

  const consistency = isAIResultConsistentWithHints(aiResult, hints)
  log.info('整理', `AI一致性检查: verdict=${consistency.verdict}, reason=${consistency.reason}, coverage=${consistency.bestCoverage.toFixed(2)}, parsedTitle="${hints.title || ''}", fallbackQuery="${hints.fallbackQuery || ''}"`)

  if (consistency.verdict === 'inconsistent') {
    log.warn('整理', `AI识别结果与已解析标题明显冲突，忽略本次AI结果: title="${aiResult.title}", titleCn="${aiResult.titleCn}", year=${aiResult.year}, coverage=${consistency.bestCoverage.toFixed(2)}, reason=${consistency.reason}`)
    return null
  }

  const mediaType = aiResult.mediaType || defaultMediaType
  log.info('整理', `AI识别候选: title="${aiResult.title}", titleCn="${aiResult.titleCn}", year=${aiResult.year}, mediaType=${mediaType}, tmdbId=${aiResult.tmdbId}`)

  if (aiResult.tmdbId > 0) {
    log.info('整理', `优先使用AI返回的TMDB ID: ${aiResult.tmdbId}`)
    const details = await getMediaDetails(aiResult.tmdbId, mediaType)
    if (details && shouldTrustAITmdbId(aiResult, details, hints.year)) {
      if (consistency.verdict === 'uncertain') {
        log.info('整理', `AI一致性存疑但TMDB ID校验通过，接受AI结果: ${details.title} (${details.year}) [${mediaType}] TMDB=${details.id}`)
      }
      return { details, mediaType }
    }
    if (details) {
      log.warn('整理', `AI返回的TMDB ID ${aiResult.tmdbId} 与标题/年份不一致，忽略该ID并回退到标题搜索: ${details.title} (${details.year})`)
    } else {
      log.warn('整理', `AI返回的TMDB ID ${aiResult.tmdbId} 获取详情失败，回退到标题搜索`)
    }
  }

  const resolved = await resolveAIResultToDetails(aiResult, mediaType, hints.year)
  if (resolved) {
    if (consistency.verdict === 'uncertain') {
      log.info('整理', `AI一致性存疑但TMDB落地成功，接受AI结果: ${resolved.details.title} (${resolved.details.year}) [${mediaType}] TMDB=${resolved.details.id}`)
    }
    return { details: resolved.details, mediaType }
  }

  if (consistency.verdict === 'uncertain') {
    log.warn('整理', `AI与已解析标题存在差异，且未能落地兼容TMDB结果，忽略本次AI结果: title="${aiResult.title}", titleCn="${aiResult.titleCn}", year=${aiResult.year}`)
    return null
  }

  log.warn('整理', `AI候选已识别成功，但未能在TMDB中找到兼容结果: title="${aiResult.title}", titleCn="${aiResult.titleCn}", year=${aiResult.year}, mediaType=${mediaType}`)
  return null
}

export async function recognizeFile(
  fileName: string,
  forceMediaType?: 'movie' | 'tv',
  forceTmdbId?: number,
  folderFiles?: string[],
  isFolder: boolean = false
): Promise<RecognizeResult | null> {
  const groups = loadReleaseGroups()
  
  let actualFileName = fileName
  let fileInfo: FileInfo
  let folderTmdbId: number | null = null
  
  if (isFolder) {
    const folderInfo = extractKeyInfo(fileName, folderFiles)
    folderTmdbId = folderInfo.tmdbId
    log.info('整理', `文件夹名中的TMDB ID: ${folderTmdbId}`)
  }
  
  if (isFolder && folderFiles && folderFiles.length > 0) {
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.ts', '.m2ts']
    const videoFile = folderFiles.find(f => {
      const ext = f.substring(f.lastIndexOf('.')).toLowerCase()
      return videoExtensions.includes(ext)
    })
    
    if (videoFile) {
      log.info('整理', `文件夹模式：优先使用内部视频文件名提取信息: ${videoFile}`)
      actualFileName = videoFile
      fileInfo = extractKeyInfo(videoFile, folderFiles)
      if (!fileInfo.tmdbId && folderTmdbId) {
        fileInfo.tmdbId = folderTmdbId
        log.info('整理', `使用文件夹名中的TMDB ID: ${folderTmdbId}`)
      }
    } else {
      fileInfo = extractKeyInfo(fileName, folderFiles)
    }
  } else {
    fileInfo = extractKeyInfo(fileName, folderFiles)
  }
  
  let techInfo: TechInfo = extractTechInfo(actualFileName, groups)

  log.info('整理', `提取信息: 标题="${fileInfo.title}", 年份=${fileInfo.year}, 类型=${fileInfo.mediaType}, 季=${fileInfo.season}, 集=${fileInfo.episode}${fileInfo.totalEpisodes ? `, 总集数=${fileInfo.totalEpisodes}` : ''}, TMDB ID=${fileInfo.tmdbId}`)
  log.info('整理', `解析搜索词: title="${fileInfo.title}", fallbackQuery="${fileInfo.fallbackQuery || ''}"`)
  
  if (folderFiles && folderFiles.length > 0) {
    log.info('整理', `文件夹内文件列表: ${folderFiles.slice(0, 5).join(', ')}${folderFiles.length > 5 ? '...' : ''} (共${folderFiles.length}个)`)
  }

  let details: TMDBDetails | null = null
  let mediaType: 'movie' | 'tv' = forceMediaType || fileInfo.mediaType
  const tmdbIdToUse = forceTmdbId || fileInfo.tmdbId

  if (tmdbIdToUse) {
    log.info('整理', `使用TMDB ID直接匹配: ${tmdbIdToUse}`)
    
    const [movieDetails, tvDetails] = await Promise.all([
      getMediaDetails(tmdbIdToUse, 'movie'),
      getMediaDetails(tmdbIdToUse, 'tv')
    ])
    
    if (movieDetails && tvDetails) {
      if (forceMediaType) {
        details = forceMediaType === 'tv' ? tvDetails : movieDetails
        mediaType = forceMediaType
        log.info('整理', `TMDB ID同时存在于电影和电视剧，使用强制指定的类型: ${forceMediaType}`)
      } else if (fileInfo.season && fileInfo.episode) {
        details = tvDetails
        mediaType = 'tv'
        log.info('整理', `TMDB ID同时存在于电影和电视剧，根据季集信息选择电视剧类型`)
      } else if (folderFiles && folderFiles.length > 0) {
        const hasSeasonPattern = folderFiles.some(f => {
          const base = f.replace(/\.[^.]+$/, '')
          return /\bS\d{1,2}E\d{1,3}\b/i.test(base) || 
                 /\bS\d{1,2}\b/i.test(base) ||
                 /第\d+集/i.test(base) ||
                 /Season\s*\d{1,2}/i.test(base)
        })
        
        if (hasSeasonPattern) {
          details = tvDetails
          mediaType = 'tv'
          log.info('整理', `TMDB ID同时存在于电影和电视剧，根据文件夹内季集标识选择电视剧类型`)
        } else {
          details = movieDetails
          mediaType = 'movie'
          log.info('整理', `TMDB ID同时存在于电影和电视剧，文件夹内无季集标识，选择电影类型`)
        }
      } else {
        details = movieDetails
        mediaType = 'movie'
        log.info('整理', `TMDB ID同时存在于电影和电视剧，默认选择电影类型`)
      }
    } else if (tvDetails) {
      details = tvDetails
      mediaType = 'tv'
      log.info('整理', `TMDB ID匹配为电视剧类型`)
    } else if (movieDetails) {
      details = movieDetails
      mediaType = 'movie'
      log.info('整理', `TMDB ID匹配为电影类型`)
    } else {
      log.warn('整理', `TMDB ID ${tmdbIdToUse} 在电影和电视剧中均未找到`)
    }
  }

  if (!details) {
    const searchQuery = fileInfo.title || fileInfo.fallbackQuery || ''
    if (!searchQuery) {
      log.warn('整理', `无法提取有效的搜索关键词: ${fileName}`)
      
      if (isAIRecognizeEnabled()) {
        const aiResult = await tryAIRecognize(fileName, mediaType, {
          title: fileInfo.title,
          fallbackQuery: fileInfo.fallbackQuery,
          year: fileInfo.year,
          season: fileInfo.season,
          episode: fileInfo.episode,
        })
        if (aiResult) {
          details = aiResult.details
          mediaType = aiResult.mediaType
        }
      }
      
      if (!details) {
        return null
      }
    } else {
      const { matchResult, query: matchedQuery } = await resolveTraditionalMatch(fileInfo, mediaType)
      const effectiveQuery = matchedQuery || searchQuery
      const needAI = shouldInvokeAI(matchResult, fileInfo.year, effectiveQuery)

      if (!matchResult) {
        log.warn('整理', `未找到TMDB匹配: ${fileName}`)

        if (isAIRecognizeEnabled()) {
          log.info('整理', `传统TMDB未命中，尝试使用AI识别接管: query="${effectiveQuery || fileName}"`)
          const aiResult = await tryAIRecognize(fileName, mediaType, {
            title: fileInfo.title,
            fallbackQuery: fileInfo.fallbackQuery,
            year: fileInfo.year,
            season: fileInfo.season,
            episode: fileInfo.episode,
          })
          if (aiResult) {
            details = aiResult.details
            mediaType = aiResult.mediaType
            log.info('整理', `最终采用AI识别结果: ${details.title} (${details.year}) [${mediaType}] TMDB=${details.id}`)
          }
        }

        if (!details) {
          return null
        }
      } else if (needAI && isAIRecognizeEnabled()) {
        log.info('整理', `传统TMDB结果可疑，尝试AI校正: query="${effectiveQuery}", candidate=${matchResult.result.title} (${matchResult.result.year}) 得分=${matchResult.score.toFixed(1)} 匹配=${matchResult.titleMatchType}`)
        const aiResult = await tryAIRecognize(fileName, mediaType, {
          title: fileInfo.title,
          fallbackQuery: fileInfo.fallbackQuery,
          year: fileInfo.year,
          season: fileInfo.season,
          episode: fileInfo.episode,
        })
        if (aiResult) {
          details = aiResult.details
          mediaType = aiResult.mediaType
          log.info('整理', `最终采用AI识别结果: ${details.title} (${details.year}) [${mediaType}] TMDB=${details.id}`)
        } else {
          details = await getMediaDetails(matchResult.result.id, mediaType)
          if (details) {
            log.info('整理', `AI未提供可用结果，回退采用传统TMDB结果: ${details.title} (${details.year}) [${mediaType}] TMDB=${details.id}`)
          }
        }
      } else {
        details = await getMediaDetails(matchResult.result.id, mediaType)
        if (details) {
          log.info('整理', `最终采用传统TMDB结果: query="${effectiveQuery}" -> ${details.title} (${details.year}) [${mediaType}] TMDB=${details.id}`)
        }
      }
    }
  }

  if (!details) {
    log.warn('整理', `获取TMDB详情失败`)
    return null
  }

  const category = classifyMedia(details, mediaType)

  let seasonYear: string | null = null
  if (mediaType === 'tv' && fileInfo.season) {
    seasonYear = await getTvSeasonYear(details.id, fileInfo.season)
  }

  let suggestedPath: string
  if (isFolder && mediaType === 'tv') {
    suggestedPath = `${category}/${details.title}${details.year ? ` (${details.year})` : ''} {tmdb=${details.id}}`
  } else {
    suggestedPath = generateTargetPath(
      details.title,
      details.year,
      details.id,
      mediaType,
      techInfo,
      fileInfo.season,
      fileInfo.episode,
      undefined,
      seasonYear
    )
    suggestedPath = `${category}/${suggestedPath}`
  }

  return {
    mediaType,
    tmdbId: details.id,
    title: details.title,
    originalTitle: details.originalTitle,
    year: details.year,
    posterUrl: details.posterUrl,
    backdropUrl: details.backdropUrl,
    overview: details.overview,
    genres: details.genres.map(g => g.name),
    originCountry: details.originCountry,
    voteAverage: details.voteAverage,
    category,
    destRootId: '',
    suggestedPath,
    tech: techInfo
  }
}
