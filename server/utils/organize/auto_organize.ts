/**
 * 自动整理模块
 * 定时扫描云盘保存目录，自动识别并整理到媒体库目录
 * 支持批量移动/复制操作，减少API调用
 */
import { getSetting, addOrganizeRecord } from '../db'
import { listFiles, resolvePathToId, ensurePath, moveFile, copyFile, renameFile, deleteEmptyFolders, batchMoveFiles, batchCopyFiles, batchRenameFiles } from './fs_115'
import { recognizeFile } from './index'
import { generateTargetPath, normalizePath } from './rename'
import { extractKeyInfo } from './file_info'
import { extractTechInfo, buildQualityLabel } from './tech_info'
import { getTvSeasonYear } from './tmdb'
import { log } from '../logger'
import { VIDEO_EXTENSIONS, SUBTITLE_EXTENSIONS, FileItem as CloudFileItem } from './types'
import { sendNotification } from '../telegram/client'
import { sendWechatNotification } from '../wechat/client'
import { getFsCache } from './fs_cache'

interface LocalFileItem {
  fileId: string
  name: string
  isDirectory: boolean
  size: number
}

interface VideoFileItem {
  fileId: string
  fileName: string
  parentId: string
  relPath: string
  size: number
}

interface OrganizeResult {
  success: boolean
  title: string
  year?: string
  mediaType: 'movie' | 'tv'
  episodeLabel?: string
  category?: string
  release?: string
  quality?: string
  size: number
  fileCount: number
  posterUrl?: string
  backdropUrl?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function sendOrganizeNotification(result: OrganizeResult): Promise<void> {
  const lines: string[] = [
    '✅ <b>整理完成</b>',
    '',
    `<b>${result.mediaType === 'tv' ? '📺' : '🎬'} ${escapeHtml(result.title)}${result.year ? ` (${result.year})` : ''}</b>`,
    ''
  ]
  
  if (result.mediaType === 'tv' && result.episodeLabel) {
    lines.push(`<b>📺 集数：</b>${escapeHtml(result.episodeLabel)}`)
  }
  
  if (result.category) {
    lines.push(`<b>🎭 类别：</b>${escapeHtml(result.category)}`)
  }
  
  if (result.release) {
    lines.push(`<b>👥 小组：</b>${escapeHtml(result.release)}`)
  }
  
  if (result.quality) {
    lines.push(`<b>🌟 质量：</b>${escapeHtml(result.quality)}`)
  }
  
  lines.push(`<b>💾 大小：</b>${formatSize(result.size)}`)
  
  if (result.fileCount > 1) {
    lines.push(`<b>📁 文件数：</b>${result.fileCount}`)
  }
  
  const message = lines.join('\n')
  const imageUrl = result.backdropUrl || result.posterUrl
  
  await Promise.all([
    sendNotification(message, imageUrl).catch(e => log.error('Telegram通知', e.message)),
    sendWechatNotification(message, imageUrl).catch(e => log.error('微信通知', e.message || e))
  ])
}

function getAutoOrganizeRunningState(): { isRunning: boolean } {
  if (!(globalThis as any).__autoOrganizeState__) {
    (globalThis as any).__autoOrganizeState__ = {
      isRunning: false
    }
  }
  return (globalThis as any).__autoOrganizeState__
}

export async function autoOrganize(): Promise<{ success: boolean; processed: number; successCount: number; failCount: number }> {
  const state = getAutoOrganizeRunningState()
  
  if (state.isRunning) {
    log.warn('自动整理', '上一次整理任务仍在执行中，跳过本次执行')
    return { success: false, processed: 0, successCount: 0, failCount: 0 }
  }
  
  state.isRunning = true
  
  try {
    const cookie = getSetting('pan115_cookie')
    if (!cookie) {
      log.error('自动整理', '未配置115云盘Cookie')
      return { success: false, processed: 0, successCount: 0, failCount: 1 }
    }

    const saveDir = getSetting('pan115_save_dir')
    const mediaDir = getSetting('pan115_media_dir')
    const action = (getSetting('auto_organize_action') || 'move') as 'move' | 'copy'

    if (!saveDir || !mediaDir) {
      log.error('自动整理', '未配置云盘保存目录或媒体库目录')
      return { success: false, processed: 0, successCount: 0, failCount: 1 }
    }

    let saveDirId = saveDir
    if (saveDir.startsWith('/')) {
      const resolveResult = await resolvePathToId(cookie, saveDir)
      if (!resolveResult.success) {
        log.error('自动整理', `解析保存目录失败: ${resolveResult.error}`)
        return { success: false, processed: 0, successCount: 0, failCount: 1 }
      }
      saveDirId = resolveResult.dirId!
    } else if (saveDir.includes('/')) {
      const resolveResult = await resolvePathToId(cookie, '/' + saveDir)
      if (!resolveResult.success) {
        log.error('自动整理', `解析保存目录失败: ${resolveResult.error}`)
        return { success: false, processed: 0, successCount: 0, failCount: 1 }
      }
      saveDirId = resolveResult.dirId!
    }

    let mediaDirId = mediaDir
    if (mediaDir.startsWith('/')) {
      const resolveResult = await resolvePathToId(cookie, mediaDir)
      if (!resolveResult.success) {
        log.error('自动整理', `解析媒体库目录失败: ${resolveResult.error}`)
        return { success: false, processed: 0, successCount: 0, failCount: 1 }
      }
      mediaDirId = resolveResult.dirId!
    } else if (mediaDir.includes('/')) {
      const resolveResult = await resolvePathToId(cookie, '/' + mediaDir)
      if (!resolveResult.success) {
        log.error('自动整理', `解析媒体库目录失败: ${resolveResult.error}`)
        return { success: false, processed: 0, successCount: 0, failCount: 1 }
      }
      mediaDirId = resolveResult.dirId!
    }

    const listResult = await listFiles(cookie, saveDirId, false)
    if (!listResult.success || !listResult.files) {
      log.error('自动整理', `获取保存目录文件列表失败`)
      return { success: false, processed: 0, successCount: 0, failCount: 1 }
    }

    const folders: LocalFileItem[] = listResult.files
      .filter((f: CloudFileItem) => f.is_dir)
      .map((f: CloudFileItem) => ({
        fileId: f.fileId,
        name: f.name,
        isDirectory: f.is_dir,
        size: f.size
      }))

    const rootVideos: VideoFileItem[] = listResult.files
      .filter((f: CloudFileItem) => !f.is_dir)
      .filter((f: CloudFileItem) => {
        const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'))
        return VIDEO_EXTENSIONS.includes(ext)
      })
      .map((f: CloudFileItem) => ({
        fileId: f.fileId,
        fileName: f.name,
        parentId: saveDirId,
        relPath: f.name,
        size: f.size || 0
      }))

    const rootSubtitles: VideoFileItem[] = listResult.files
      .filter((f: CloudFileItem) => !f.is_dir)
      .filter((f: CloudFileItem) => {
        const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'))
        return SUBTITLE_EXTENSIONS.includes(ext)
      })
      .map((f: CloudFileItem) => ({
        fileId: f.fileId,
        fileName: f.name,
        parentId: saveDirId,
        relPath: f.name,
        size: f.size || 0
      }))

    log.info('自动整理', `发现 ${folders.length} 个文件夹, ${rootVideos.length} 个根目录视频文件`)

    let processed = 0
    let successCount = 0
    let failCount = 0

    if (rootVideos.length > 0) {
      log.info('自动整理', `开始处理根目录视频文件`)
      const result = await processVideoFiles(cookie, rootVideos, rootSubtitles, mediaDirId, saveDirId, action)
      processed++
      if (result.success) {
        successCount++
      } else {
        failCount++
      }
    }

    for (const folder of folders) {
      try {
        const result = await processFolder(cookie, folder, mediaDirId, saveDirId, action)
        processed++
        if (result.success) {
          successCount++
        } else {
          failCount++
        }
      } catch (error: any) {
        log.error('自动整理', `处理文件夹 ${folder.name} 失败: ${error.message}`)
        failCount++
        processed++
      }
    }

    log.success('自动整理', `整理完成: 处理 ${processed} 个, 成功 ${successCount} 个, 失败 ${failCount} 个`)
    return { success: true, processed, successCount, failCount }
  } finally {
    const state = getAutoOrganizeRunningState()
    state.isRunning = false
  }
}

async function processVideoFiles(
  cookie: string,
  videos: VideoFileItem[],
  subtitles: VideoFileItem[],
  mediaDirId: string,
  saveDirId: string,
  action: 'move' | 'copy'
): Promise<{ success: boolean; error?: string }> {
  log.info('自动整理', `处理 ${videos.length} 个视频文件`)

  let successCount = 0
  let failCount = 0
  const processedVideoInfo: Map<string, { targetDirId: string; targetFileName: string }> = new Map()
  
  const organizeGroups: Map<number, {
    title: string
    year: string
    mediaType: 'movie' | 'tv'
    category: string
    posterUrl?: string
    backdropUrl?: string
    episodes: { season: number; episode: number }[]
    totalSize: number
    fileCount: number
    release: string
    quality: string
  }> = new Map()

  for (const videoFile of videos) {
    try {
      const recognizeResult = await recognizeFile(videoFile.fileName, undefined, undefined, [videoFile.fileName], true)
      if (!recognizeResult) {
        log.error('自动整理', `识别失败: ${videoFile.fileName}`)
        failCount++
        continue
      }

      const suggestedPath = recognizeResult.suggestedPath
      const mediaType = recognizeResult.mediaType
      const tmdbId = recognizeResult.tmdbId
      const title = recognizeResult.title
      const year = recognizeResult.year

      log.info('自动整理', `识别结果: ${title} (${year}) - ${mediaType} - ${suggestedPath}`)

      let fullTargetPath: string

      if (mediaType === 'movie') {
        fullTargetPath = suggestedPath
      } else {
        const fileInfo = extractKeyInfo(videoFile.fileName)
        const techInfo = extractTechInfo(videoFile.fileName)

        let seasonYear: string | null = null
        if (fileInfo.season) {
          seasonYear = await getTvSeasonYear(tmdbId, fileInfo.season)
        }

        const relativePath = generateTargetPath(
          title,
          year,
          tmdbId,
          mediaType,
          techInfo,
          fileInfo.season,
          fileInfo.episode,
          undefined,
          seasonYear
        )

        const relativePathParts = relativePath.split('/').filter(Boolean)
        const seasonAndFile = relativePathParts.slice(1).join('/')
        fullTargetPath = normalizePath(`${suggestedPath}/${seasonAndFile}`)
      }

      const targetPathParts = fullTargetPath.split('/').filter(Boolean)
      const targetFileName = targetPathParts[targetPathParts.length - 1]
      const targetDirParts = targetPathParts.slice(0, -1)

      let targetDirId: string
      const cache = getFsCache()
      
      if (mediaType === 'tv' && tmdbId) {
        const cachedDir = cache.getTmdbDir(tmdbId)
        if (cachedDir) {
          log.info('自动整理', `使用TMDB缓存: ${tmdbId} -> ${cachedDir.path}`)
          targetDirId = cachedDir.dirId
        } else {
          const ensureResult = await ensurePath(cookie, mediaDirId, targetDirParts)
          if (!ensureResult.success) {
            log.error('自动整理', `创建目录失败: ${ensureResult.error}`)
            failCount++
            continue
          }
          targetDirId = ensureResult.dirId!
          cache.setTmdbDir(tmdbId, targetDirId, targetDirParts.join('/'))
        }
      } else {
        const ensureResult = await ensurePath(cookie, mediaDirId, targetDirParts)
        if (!ensureResult.success) {
          log.error('自动整理', `创建目录失败: ${ensureResult.error}`)
          failCount++
          continue
        }
        targetDirId = ensureResult.dirId!
      }

      let targetFileId = videoFile.fileId

      if (action === 'copy') {
        const beforeFilesResult = await listFiles(cookie, targetDirId)
        const beforeIds = new Set<string>()
        if (beforeFilesResult.success && beforeFilesResult.files) {
          beforeFilesResult.files.forEach((f: CloudFileItem) => {
            if (f.fileId) beforeIds.add(f.fileId)
          })
        }

        const operationResult = await copyFile(cookie, videoFile.fileId, targetDirId)
        if (!operationResult.success) {
          log.error('自动整理', `复制失败: ${videoFile.fileName} - ${operationResult.error}`)
          failCount++
          continue
        }

        if (operationResult.newFileId) {
          targetFileId = operationResult.newFileId
        } else {
          let copiedId = ''
          for (let attempt = 0; attempt < 10; attempt++) {
            if (attempt > 0) {
              await new Promise(resolve => setTimeout(resolve, 400))
            }
            
            const afterFilesResult = await listFiles(cookie, targetDirId)
            if (!afterFilesResult.success || !afterFilesResult.files) continue
            
            const newFiles = afterFilesResult.files.filter((f: CloudFileItem) => f.fileId && !beforeIds.has(f.fileId))
            if (newFiles.length === 0) continue
            
            const scoreFile = (f: { name: string }): number => {
              const n = f.name
              if (targetFileName && n === targetFileName) return 3
              if (n === videoFile.fileName) return 2
              if (videoFile.fileName && n.startsWith(videoFile.fileName)) return 1
              return 0
            }
            
            newFiles.sort((a: { name: string }, b: { name: string }) => scoreFile(b) - scoreFile(a))
            const firstNewFile = newFiles[0]
            if (firstNewFile && firstNewFile.fileId) {
              copiedId = firstNewFile.fileId
              break
            }
          }

          if (!copiedId) {
            log.error('自动整理', `复制成功但无法定位新文件: ${videoFile.fileName}`)
            failCount++
            continue
          }

          targetFileId = copiedId
        }
      } else {
        const operationResult = await moveFile(cookie, videoFile.fileId, targetDirId)
        if (!operationResult.success) {
          log.error('自动整理', `移动失败: ${videoFile.fileName} - ${operationResult.error}`)
          failCount++
          continue
        }
      }

      if (targetFileName && targetFileName !== videoFile.fileName) {
        await renameFile(cookie, targetFileId, targetFileName)
      }

      processedVideoInfo.set(videoFile.fileId, { targetDirId, targetFileName: targetFileName || videoFile.fileName })
      successCount++
      
      const techInfo = extractTechInfo(videoFile.fileName)
      
      if (!organizeGroups.has(tmdbId)) {
        organizeGroups.set(tmdbId, {
          title,
          year,
          mediaType,
          category: recognizeResult.category,
          posterUrl: recognizeResult.posterUrl || undefined,
          backdropUrl: recognizeResult.backdropUrl || undefined,
          episodes: [],
          totalSize: 0,
          fileCount: 0,
          release: techInfo.releaseGroup,
          quality: buildQualityLabel(techInfo)
        })
      }
      
      const group = organizeGroups.get(tmdbId)!
      group.totalSize += videoFile.size
      group.fileCount++
      
      if (mediaType === 'tv') {
        const fileInfo = extractKeyInfo(videoFile.fileName)
        if (fileInfo.season && fileInfo.episode) {
          group.episodes.push({ season: fileInfo.season, episode: fileInfo.episode })
        }
      }
      
      addOrganizeRecord(
        title,
        videoFile.fileName,
        fullTargetPath,
        action,
        'success'
      )
      
      log.success('自动整理', `${action === 'move' ? '移动' : '复制'}: ${videoFile.fileName} -> ${fullTargetPath}`)
    } catch (error: any) {
      log.error('自动整理', `处理视频失败: ${videoFile.fileName} - ${error.message}`)
      failCount++
    }
  }

  if (subtitles.length > 0) {
    for (const subtitleFile of subtitles) {
      try {
        let matchedVideoInfo: { targetDirId: string; targetFileName: string } | null = null
        
        const subBaseName = subtitleFile.fileName.replace(/\.[^.]+$/, '')
        for (const info of processedVideoInfo.values()) {
          const videoBaseName = info.targetFileName.replace(/\.[^.]+$/, '')
          if (subBaseName === videoBaseName || subtitleFile.fileName.startsWith(videoBaseName)) {
            matchedVideoInfo = info
            break
          }
        }
        
        if (!matchedVideoInfo) {
          const firstVideoInfo = processedVideoInfo.values().next().value
          if (firstVideoInfo) {
            matchedVideoInfo = firstVideoInfo
          }
        }
        
        if (!matchedVideoInfo) {
          continue
        }
        
        const subtitleExt = subtitleFile.fileName.substring(subtitleFile.fileName.lastIndexOf('.'))
        const targetSubtitleName = matchedVideoInfo.targetFileName.replace(/\.[^.]+$/, '') + subtitleExt
        
        let targetSubtitleId = subtitleFile.fileId
        
        if (action === 'copy') {
          const operationResult = await copyFile(cookie, subtitleFile.fileId, matchedVideoInfo.targetDirId)
          if (!operationResult.success) {
            continue
          }
          if (operationResult.newFileId) {
            targetSubtitleId = operationResult.newFileId
          }
        } else {
          const operationResult = await moveFile(cookie, subtitleFile.fileId, matchedVideoInfo.targetDirId)
          if (!operationResult.success) {
            continue
          }
        }
        
        if (targetSubtitleName !== subtitleFile.fileName) {
          await renameFile(cookie, targetSubtitleId, targetSubtitleName)
        }
        
        log.success('自动整理', `字幕整理成功: ${subtitleFile.fileName}`)
      } catch (error: any) {
        log.error('自动整理', `处理字幕失败: ${subtitleFile.fileName}`)
      }
    }
  }

  for (const [tmdbId, group] of organizeGroups) {
    let episodeLabel = ''
    if (group.mediaType === 'tv' && group.episodes.length > 0) {
      group.episodes.sort((a, b) => a.season - b.season || a.episode - b.episode)
      const seasonMap = new Map<number, number[]>()
      for (const ep of group.episodes) {
        if (!seasonMap.has(ep.season)) {
          seasonMap.set(ep.season, [])
        }
        seasonMap.get(ep.season)!.push(ep.episode)
      }
      const parts: string[] = []
      for (const [season, eps] of seasonMap) {
        eps.sort((a, b) => a - b)
        if (eps.length === 1) {
          parts.push(`S${String(season).padStart(2, '0')}E${String(eps[0]).padStart(2, '0')}`)
        } else {
          const min = Math.min(...eps)
          const max = Math.max(...eps)
          parts.push(`S${String(season).padStart(2, '0')}E${String(min).padStart(2, '0')}-E${String(max).padStart(2, '0')}`)
        }
      }
      episodeLabel = parts.join(', ')
    }
    
    const organizeResult: OrganizeResult = {
      success: true,
      title: group.title,
      year: group.year,
      mediaType: group.mediaType,
      episodeLabel,
      category: group.category,
      release: group.release,
      quality: group.quality,
      size: group.totalSize,
      fileCount: group.fileCount,
      posterUrl: group.posterUrl,
      backdropUrl: group.backdropUrl
    }
    
    sendOrganizeNotification(organizeResult).catch(e => {
      log.error('自动整理', `发送通知失败: ${e.message}`)
    })
  }

  return { success: successCount > 0 }
}

async function processFolder(
  cookie: string,
  folder: LocalFileItem,
  mediaDirId: string,
  saveDirId: string,
  action: 'move' | 'copy'
): Promise<{ success: boolean; error?: string; result?: OrganizeResult }> {
  log.info('自动整理', `开始处理文件夹: ${folder.name}`)

  const { videos, subtitles } = await walkVideoFiles(cookie, folder.fileId)
  if (videos.length === 0) {
    log.info('自动整理', `文件夹 ${folder.name} 中没有视频文件，跳过`)
    return { success: false, error: '没有视频文件' }
  }

  const folderFileNames = videos.map(v => v.fileName)
  const firstVideo = videos[0]
  if (!firstVideo) {
    return { success: false, error: '没有视频文件' }
  }

  const recognizeResult = await recognizeFile(folder.name, undefined, undefined, folderFileNames, true)
  if (!recognizeResult) {
    log.error('自动整理', `识别失败: ${folder.name}`)
    return { success: false, error: '识别失败' }
  }

  const suggestedPath = recognizeResult.suggestedPath
  const mediaType = recognizeResult.mediaType
  const tmdbId = recognizeResult.tmdbId
  const title = recognizeResult.title
  const year = recognizeResult.year
  const category = recognizeResult.category
  const posterUrl = recognizeResult.posterUrl
  const backdropUrl = recognizeResult.backdropUrl

  log.info('自动整理', `识别结果: ${title} (${year}) - ${mediaType} - ${suggestedPath}`)

  const pathParts = suggestedPath.split('/').filter(Boolean)
  if (pathParts.length < 1) {
    return { success: false, error: '目标路径格式错误' }
  }

  interface FileTargetInfo {
    fileId: string
    fileName: string
    targetDirId: string
    targetDirPath: string
    targetFileName: string
    fullTargetPath: string
    size: number
    season?: number
    episode?: number
    techInfo: any
  }

  const fileTargets: FileTargetInfo[] = []
  const dirIdCache: Map<string, string> = new Map()
  const cache = getFsCache()
  
  const seasonDirCache: Map<number, { dirId: string; path: string }> = new Map()

  for (const videoFile of videos) {
    try {
      let fullTargetPath: string

      if (mediaType === 'movie') {
        fullTargetPath = suggestedPath
      } else {
        const fileInfo = extractKeyInfo(videoFile.fileName)
        const techInfo = extractTechInfo(videoFile.fileName)

        let seasonYear: string | null = null
        if (fileInfo.season) {
          seasonYear = await getTvSeasonYear(tmdbId, fileInfo.season)
        }

        const relativePath = generateTargetPath(
          title,
          year,
          tmdbId,
          mediaType,
          techInfo,
          fileInfo.season,
          fileInfo.episode,
          undefined,
          seasonYear
        )

        const relativePathParts = relativePath.split('/').filter(Boolean)
        const seasonAndFile = relativePathParts.slice(1).join('/')
        fullTargetPath = normalizePath(`${suggestedPath}/${seasonAndFile}`)
      }

      const targetPathParts = fullTargetPath.split('/').filter(Boolean)
      const targetFileName = targetPathParts[targetPathParts.length - 1]
      const targetDirParts = targetPathParts.slice(0, -1)
      const currentTargetDirPath = targetDirParts.join('/')
      
      const fileInfo = extractKeyInfo(videoFile.fileName)
      const season = fileInfo.season

      let currentTargetDirId: string
      
      if (mediaType === 'tv' && tmdbId && season) {
        const seasonCacheKey = season
        const cachedSeasonDir = seasonDirCache.get(seasonCacheKey)
        
        if (cachedSeasonDir) {
          currentTargetDirId = cachedSeasonDir.dirId
        } else {
          const cachedDir = cache.getTmdbDir(tmdbId)
          if (cachedDir && cachedDir.path === currentTargetDirPath) {
            currentTargetDirId = cachedDir.dirId
            seasonDirCache.set(seasonCacheKey, { dirId: cachedDir.dirId, path: cachedDir.path })
          } else {
            if (dirIdCache.has(currentTargetDirPath)) {
              currentTargetDirId = dirIdCache.get(currentTargetDirPath)!
            } else {
              const ensureResult = await ensurePath(cookie, mediaDirId, targetDirParts)
              if (!ensureResult.success) {
                log.error('自动整理', `创建目录失败: ${ensureResult.error}`)
                continue
              }
              currentTargetDirId = ensureResult.dirId!
              dirIdCache.set(currentTargetDirPath, currentTargetDirId)
            }
            seasonDirCache.set(seasonCacheKey, { dirId: currentTargetDirId, path: currentTargetDirPath })
          }
        }
      } else {
        if (dirIdCache.has(currentTargetDirPath)) {
          currentTargetDirId = dirIdCache.get(currentTargetDirPath)!
        } else {
          const ensureResult = await ensurePath(cookie, mediaDirId, targetDirParts)
          if (!ensureResult.success) {
            log.error('自动整理', `创建目录失败: ${ensureResult.error}`)
            continue
          }
          currentTargetDirId = ensureResult.dirId!
          dirIdCache.set(currentTargetDirPath, currentTargetDirId)
        }
      }

      fileTargets.push({
        fileId: videoFile.fileId,
        fileName: videoFile.fileName,
        targetDirId: currentTargetDirId,
        targetDirPath: currentTargetDirPath,
        targetFileName: targetFileName || videoFile.fileName,
        fullTargetPath,
        size: videoFile.size,
        season: fileInfo.season || undefined,
        episode: fileInfo.episode || undefined,
        techInfo: extractTechInfo(videoFile.fileName)
      })
    } catch (error: any) {
      log.error('自动整理', `计算目标路径失败: ${videoFile.fileName} - ${error.message}`)
    }
  }

  if (fileTargets.length === 0) {
    return { success: false, error: '没有可处理的文件' }
  }

  let successCount = 0
  let failCount = 0
  const processedVideoInfo: Map<string, { targetDirId: string; targetFileName: string; newFileId?: string }> = new Map()
  const episodes: { season: number; episode: number }[] = []
  let totalSize = 0
  let release = ''
  let quality = ''

  const filesByDir = new Map<string, FileTargetInfo[]>()
  for (const target of fileTargets) {
    const key = target.targetDirId
    if (!filesByDir.has(key)) {
      filesByDir.set(key, [])
    }
    filesByDir.get(key)!.push(target)
  }

  log.info('自动整理', `批量操作: ${fileTargets.length} 个文件, ${filesByDir.size} 个目标目录`)

  for (const [dirId, files] of filesByDir) {
    const fileIds = files.map(f => f.fileId)
    
    if (action === 'move') {
      const batchResult = await batchMoveFiles(fileIds, dirId)
      
      if (batchResult.success) {
        const firstFile = files[0]
        log.success('自动整理', `批量移动成功: ${files.length} 个文件 -> ${firstFile?.targetDirPath || dirId}`)
        
        const renameItems = files
          .filter(f => f.targetFileName !== f.fileName)
          .map(f => ({ fileId: f.fileId, newName: f.targetFileName }))
        
        if (renameItems.length > 0) {
          const renameResult = await batchRenameFiles(renameItems)
          if (renameResult.success) {
            log.success('自动整理', `批量重命名成功: ${renameItems.length} 个文件`)
          } else {
            log.warn('自动整理', `批量重命名部分失败: ${renameResult.error}`)
          }
        }
        
        for (const file of files) {
          processedVideoInfo.set(file.fileId, { 
            targetDirId: file.targetDirId, 
            targetFileName: file.targetFileName,
            newFileId: file.fileId
          })
          successCount++
          totalSize += file.size
          
          if (file.season && file.episode) {
            episodes.push({ season: file.season, episode: file.episode })
          }
          
          if (file.techInfo.releaseGroup && !release) release = file.techInfo.releaseGroup
          if (!quality) quality = buildQualityLabel(file.techInfo)
          
          addOrganizeRecord(title, file.fileName, file.fullTargetPath, action, 'success')
        }
      } else {
        log.warn('自动整理', `批量移动失败，尝试单独处理: ${batchResult.error}`)
        
        for (const file of files) {
          try {
            const moveResult = await moveFile(cookie, file.fileId, file.targetDirId)
            if (moveResult.success) {
              if (file.targetFileName !== file.fileName) {
                await renameFile(cookie, file.fileId, file.targetFileName)
              }
              
              processedVideoInfo.set(file.fileId, { 
                targetDirId: file.targetDirId, 
                targetFileName: file.targetFileName,
                newFileId: file.fileId
              })
              successCount++
              totalSize += file.size
              
              if (file.season && file.episode) {
                episodes.push({ season: file.season, episode: file.episode })
              }
              
              if (file.techInfo.releaseGroup && !release) release = file.techInfo.releaseGroup
              if (!quality) quality = buildQualityLabel(file.techInfo)
              
              addOrganizeRecord(title, file.fileName, file.fullTargetPath, action, 'success')
            } else {
              log.error('自动整理', `移动失败: ${file.fileName} - ${moveResult.error}`)
              failCount++
            }
          } catch (e: any) {
            log.error('自动整理', `处理失败: ${file.fileName} - ${e.message}`)
            failCount++
          }
        }
      }
    } else {
      const batchResult = await batchCopyFiles(fileIds, dirId)
      
      if (batchResult.success) {
        const firstFile = files[0]
        log.success('自动整理', `批量复制成功: ${files.length} 个文件 -> ${firstFile?.targetDirPath || dirId}`)
        
        const copiedFiles: { original: FileTargetInfo; newFileId: string }[] = files.map(f => ({
          original: f,
          newFileId: f.fileId
        }))
        
        const renameItems = copiedFiles
          .filter(f => f.original.targetFileName !== f.original.fileName)
          .map(f => ({ fileId: f.newFileId, newName: f.original.targetFileName }))
        
        if (renameItems.length > 0) {
          const renameResult = await batchRenameFiles(renameItems)
          if (renameResult.success) {
            log.success('自动整理', `批量重命名成功: ${renameItems.length} 个文件`)
          } else {
            log.warn('自动整理', `批量重命名部分失败: ${renameResult.error}`)
          }
        }
        
        for (const { original, newFileId } of copiedFiles) {
          processedVideoInfo.set(original.fileId, { 
            targetDirId: original.targetDirId, 
            targetFileName: original.targetFileName,
            newFileId
          })
          successCount++
          totalSize += original.size
          
          if (original.season && original.episode) {
            episodes.push({ season: original.season, episode: original.episode })
          }
          
          if (original.techInfo.releaseGroup && !release) release = original.techInfo.releaseGroup
          if (!quality) quality = buildQualityLabel(original.techInfo)
          
          addOrganizeRecord(title, original.fileName, original.fullTargetPath, action, 'success')
        }
      } else {
        log.warn('自动整理', `批量复制失败，尝试单独处理: ${batchResult.error}`)
        
        for (const file of files) {
          try {
            const copyResult = await copyFile(cookie, file.fileId, file.targetDirId)
            if (copyResult.success) {
              const newFileId = copyResult.newFileId || file.fileId
              
              if (file.targetFileName !== file.fileName) {
                await renameFile(cookie, newFileId, file.targetFileName)
              }
              
              processedVideoInfo.set(file.fileId, { 
                targetDirId: file.targetDirId, 
                targetFileName: file.targetFileName,
                newFileId
              })
              successCount++
              totalSize += file.size
              
              if (file.season && file.episode) {
                episodes.push({ season: file.season, episode: file.episode })
              }
              
              if (file.techInfo.releaseGroup && !release) release = file.techInfo.releaseGroup
              if (!quality) quality = buildQualityLabel(file.techInfo)
              
              addOrganizeRecord(title, file.fileName, file.fullTargetPath, action, 'success')
            } else {
              log.error('自动整理', `复制失败: ${file.fileName} - ${copyResult.error}`)
              failCount++
            }
          } catch (e: any) {
            log.error('自动整理', `复制异常: ${file.fileName} - ${e.message}`)
            failCount++
          }
        }
      }
    }
  }

  if (subtitles.length > 0 && processedVideoInfo.size > 0) {
    const subtitleTargets: { fileId: string; targetDirId: string; targetFileName: string }[] = []
    
    for (const subtitleFile of subtitles) {
      let matchedVideoInfo: { targetDirId: string; targetFileName: string } | null = null
      
      const subBaseName = subtitleFile.fileName.replace(/\.[^.]+$/, '')
      for (const info of processedVideoInfo.values()) {
        const videoBaseName = info.targetFileName.replace(/\.[^.]+$/, '')
        if (subBaseName === videoBaseName || subtitleFile.fileName.startsWith(videoBaseName)) {
          matchedVideoInfo = info
          break
        }
      }
      
      if (!matchedVideoInfo) {
        const firstVideoInfo = processedVideoInfo.values().next().value
        if (firstVideoInfo) {
          matchedVideoInfo = firstVideoInfo
        }
      }
      
      if (!matchedVideoInfo) {
        continue
      }
      
      const subtitleExt = subtitleFile.fileName.substring(subtitleFile.fileName.lastIndexOf('.'))
      const targetSubtitleName = matchedVideoInfo.targetFileName.replace(/\.[^.]+$/, '') + subtitleExt
      
      subtitleTargets.push({
        fileId: subtitleFile.fileId,
        targetDirId: matchedVideoInfo.targetDirId,
        targetFileName: targetSubtitleName
      })
    }
    
    if (subtitleTargets.length > 0) {
      const subtitlesByDir = new Map<string, { fileId: string; targetFileName: string }[]>()
      for (const sub of subtitleTargets) {
        if (!subtitlesByDir.has(sub.targetDirId)) {
          subtitlesByDir.set(sub.targetDirId, [])
        }
        subtitlesByDir.get(sub.targetDirId)!.push({ fileId: sub.fileId, targetFileName: sub.targetFileName })
      }
      
      for (const [dirId, subs] of subtitlesByDir) {
        const subFileIds = subs.map(s => s.fileId)
        
        if (action === 'move') {
          const batchResult = await batchMoveFiles(subFileIds, dirId)
          if (batchResult.success) {
            const renameItems = subs.map(s => ({ fileId: s.fileId, newName: s.targetFileName }))
            await batchRenameFiles(renameItems)
            log.success('自动整理', `批量处理字幕成功: ${subs.length} 个`)
          }
        } else {
          for (const sub of subs) {
            const copyResult = await copyFile(cookie, sub.fileId, dirId)
            if (copyResult.success) {
              const newFileId = copyResult.newFileId || sub.fileId
              await renameFile(cookie, newFileId, sub.targetFileName)
            }
          }
          log.success('自动整理', `处理字幕: ${subs.length} 个`)
        }
      }
    }
  }

  if (action === 'move' && successCount > 0) {
    const cleanResult = await deleteEmptyFolders(cookie, folder.fileId, saveDirId)
    if (cleanResult.deletedCount > 0) {
      log.success('自动整理', `清理空文件夹: ${cleanResult.deletedCount} 个`)
    }
  }

  if (successCount > 0) {
    let episodeLabel = ''
    if (mediaType === 'tv' && episodes.length > 0) {
      episodes.sort((a, b) => a.season - b.season || a.episode - b.episode)
      const seasonMap = new Map<number, number[]>()
      for (const ep of episodes) {
        if (!seasonMap.has(ep.season)) {
          seasonMap.set(ep.season, [])
        }
        seasonMap.get(ep.season)!.push(ep.episode)
      }
      const parts: string[] = []
      for (const [season, eps] of seasonMap) {
        eps.sort((a, b) => a - b)
        if (eps.length === 1) {
          parts.push(`S${String(season).padStart(2, '0')}E${String(eps[0]).padStart(2, '0')}`)
        } else {
          const min = Math.min(...eps)
          const max = Math.max(...eps)
          parts.push(`S${String(season).padStart(2, '0')}E${String(min).padStart(2, '0')}-E${String(max).padStart(2, '0')}`)
        }
      }
      episodeLabel = parts.join(', ')
    }
    
    const organizeResult: OrganizeResult = {
      success: true,
      title,
      year,
      mediaType,
      episodeLabel,
      category,
      release,
      quality,
      size: totalSize,
      fileCount: successCount,
      posterUrl: posterUrl || undefined,
      backdropUrl: backdropUrl || undefined
    }
    
    sendOrganizeNotification(organizeResult).catch(e => {
      log.error('自动整理', `发送通知失败: ${e.message}`)
    })
    
    return { success: true, result: organizeResult }
  }

  return { success: successCount > 0 }
}

async function walkVideoFiles(
  cookie: string,
  folderId: string,
  basePath: string = ''
): Promise<{ videos: VideoFileItem[]; subtitles: VideoFileItem[] }> {
  const videos: VideoFileItem[] = []
  const subtitles: VideoFileItem[] = []
  
  log.info('自动整理', `扫描目录: ${basePath || '根目录'}`)
  const listResult = await listFiles(cookie, folderId, false)
  if (!listResult.success || !listResult.files) {
    return { videos, subtitles }
  }

  for (const file of listResult.files) {
    const itemPath = basePath ? `${basePath}/${file.name}` : file.name
    
    if (file.is_dir) {
      const subResult = await walkVideoFiles(cookie, file.fileId, itemPath)
      videos.push(...subResult.videos)
      subtitles.push(...subResult.subtitles)
    } else {
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
      if (VIDEO_EXTENSIONS.includes(ext)) {
        videos.push({
          fileId: file.fileId,
          fileName: file.name,
          parentId: folderId,
          relPath: itemPath,
          size: file.size || 0
        })
      } else if (SUBTITLE_EXTENSIONS.includes(ext)) {
        subtitles.push({
          fileId: file.fileId,
          fileName: file.name,
          parentId: folderId,
          relPath: itemPath,
          size: file.size || 0
        })
      }
    }
  }

  return { videos, subtitles }
}