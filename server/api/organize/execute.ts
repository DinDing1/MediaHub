/**
 * 云盘整理 - 执行API
 * 执行文件整理操作（移动或复制）
 * 
 * 整理流程：
 * 1. 前端先调用识别API获取识别结果
 * 2. 用户确认后，前端调用此API，传递识别结果
 * 3. 后端直接使用传递的识别结果进行整理
 * 
 * 文件夹整理流程（优化版）：
 * 1. 递归遍历源文件夹内的所有视频文件和字幕文件
 * 2. 计算所有文件的目标路径
 * 3. 批量创建目标目录
 * 4. 批量移动/复制文件
 * 5. 批量重命名文件
 * 6. 处理字幕文件
 * 7. 清理空文件夹（移动操作时）
 */
import { 
  ensurePath, 
  moveFile, 
  copyFile, 
  renameFile, 
  listFiles, 
  resolvePathToId, 
  deleteEmptyFolders,
  batchMoveFiles,
  batchCopyFiles,
  batchRenameFiles
} from '../../utils/organize/fs_115'
import { getSetting, addOrganizeRecord } from '../../utils/db'
import { log } from '../../utils/logger'
import { extractKeyInfo } from '../../utils/organize/file_info'
import { extractTechInfo, buildQualityLabel } from '../../utils/organize/tech_info'
import { generateTargetPath, normalizePath } from '../../utils/organize/rename'
import { getTvSeasonYear } from '../../utils/organize/tmdb'
import { VIDEO_EXTENSIONS, SUBTITLE_EXTENSIONS } from '../../utils/organize/types'
import { sendNotification } from '../../utils/telegram/client'
import { sendWechatNotification } from '../../utils/wechat/client'
import { getFsCache } from '../../utils/organize/fs_cache'

interface OrganizeRequest {
  platform?: '115'
  action?: 'move' | 'copy'
  srcType: 'file' | 'folder'
  fileId?: string
  fileName?: string
  folderId?: string
  folderName?: string
  sizeBytesHint?: number
  mediaType: 'movie' | 'tv'
  tmdbId: number
  suggestedPath: string
  title: string
  year: string
  posterUrl?: string
  backdropUrl?: string
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

export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') {
    return { success: false, error: '不支持的请求方法' }
  }

  try {
    const body = await readBody(event) as OrganizeRequest
    const {
      action = 'move',
      srcType,
      fileId,
      fileName,
      folderId,
      folderName,
      mediaType,
      tmdbId,
      suggestedPath,
      title,
      year,
      sizeBytesHint,
      posterUrl,
      backdropUrl
    } = body

    const cookie = getSetting('pan115_cookie')
    if (!cookie) {
      return { success: false, error: '未配置115云盘Cookie' }
    }

    const mediaDir = getSetting('pan115_media_dir')
    if (!mediaDir) {
      return { success: false, error: '未配置云盘媒体库目录' }
    }

    const saveDir = getSetting('pan115_save_dir')

    let mediaDirId = mediaDir
    if (mediaDir.startsWith('/')) {
      const resolveResult = await resolvePathToId(cookie, mediaDir)
      if (!resolveResult.success) {
        return { success: false, error: `解析媒体库目录失败: ${resolveResult.error}` }
      }
      mediaDirId = resolveResult.dirId!
    }

    let saveDirId: string | undefined
    if (saveDir) {
      if (saveDir.startsWith('/')) {
        const resolveResult = await resolvePathToId(cookie, saveDir)
        if (resolveResult.success) {
          saveDirId = resolveResult.dirId
        }
      } else {
        saveDirId = saveDir
      }
    }

    if (!tmdbId || !suggestedPath) {
      return { success: false, error: '缺少识别结果，请先识别文件' }
    }

    if (srcType === 'file') {
      if (!fileId || !fileName) {
        return { success: false, error: '缺少文件信息' }
      }

      const result = await organizeSingleFile(
        cookie,
        mediaDirId,
        fileId,
        fileName,
        suggestedPath,
        action,
        title,
        year,
        mediaType,
        sizeBytesHint,
        posterUrl,
        backdropUrl
      )

      if (result.success) {
        log.success('整理', `文件整理完成: ${fileName} -> ${suggestedPath}`)
      }

      return result
    } else if (srcType === 'folder') {
      if (!folderId || !folderName) {
        return { success: false, error: '缺少文件夹信息' }
      }

      const result = await organizeFolder(
        cookie,
        mediaDirId,
        folderId,
        folderName,
        suggestedPath,
        action,
        mediaType,
        tmdbId,
        title,
        year,
        saveDirId,
        posterUrl,
        backdropUrl
      )

      return result
    }

    return { success: false, error: '未知的源类型' }
  } catch (error: any) {
    log.error('整理', `执行失败: ${error.message}`)
    return { success: false, error: error.message || '执行失败' }
  }
})

/**
 * 整理单个文件
 */
async function organizeSingleFile(
  cookie: string,
  mediaDirId: string,
  fileId: string,
  fileName: string,
  suggestedPath: string,
  action: 'move' | 'copy',
  title: string,
  year: string,
  mediaType: 'movie' | 'tv',
  fileSize?: number,
  posterUrl?: string,
  backdropUrl?: string
): Promise<{ success: boolean; error?: string; data?: any }> {
  const pathParts = suggestedPath.split('/').filter(Boolean)

  if (pathParts.length < 2) {
    return { success: false, error: '目标路径格式错误' }
  }

  const targetDirPath = pathParts.slice(0, -1)
  const targetFileName = pathParts[pathParts.length - 1] || ''

  if (!targetFileName) {
    return { success: false, error: '目标文件名无效' }
  }

  const ensureResult = await ensurePath(cookie, mediaDirId, targetDirPath)
  if (!ensureResult.success) {
    return { success: false, error: `创建目标目录失败: ${ensureResult.error}` }
  }

  const targetDirId = ensureResult.dirId!
  let targetFileId = fileId

  if (action === 'copy') {
    const beforeFilesResult = await listFiles(cookie, targetDirId)
    const beforeIds = new Set<string>()
    if (beforeFilesResult.success && beforeFilesResult.files) {
      beforeFilesResult.files.forEach(f => {
        if (f.fileId) beforeIds.add(f.fileId)
      })
    }

    const operationResult = await copyFile(cookie, fileId, targetDirId)
    if (!operationResult.success) {
      return { success: false, error: operationResult.error }
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
        
        const newFiles = afterFilesResult.files.filter(f => f.fileId && !beforeIds.has(f.fileId))
        if (newFiles.length === 0) continue
        
        const scoreFile = (f: { name: string }): number => {
          const n = f.name
          if (targetFileName && n === targetFileName) return 3
          if (n === fileName) return 2
          if (fileName && n.startsWith(fileName)) return 1
          return 0
        }
        
        newFiles.sort((a, b) => scoreFile(b) - scoreFile(a))
        const firstFile = newFiles[0]
        if (firstFile && firstFile.fileId) {
          copiedId = firstFile.fileId
          break
        }
      }

      if (!copiedId) {
        return { success: false, error: '复制成功但无法定位新文件' }
      }

      targetFileId = copiedId
    }
  } else {
    const operationResult = await moveFile(cookie, fileId, targetDirId)
    if (!operationResult.success) {
      return { success: false, error: operationResult.error }
    }
  }

  if (targetFileName !== fileName) {
    await renameFile(cookie, targetFileId, targetFileName)
  }

  const techInfo = extractTechInfo(fileName)
  let episodeLabel = ''
  if (mediaType === 'tv') {
    const fileInfo = extractKeyInfo(fileName)
    if (fileInfo.season && fileInfo.episode) {
      episodeLabel = `S${String(fileInfo.season).padStart(2, '0')}E${String(fileInfo.episode).padStart(2, '0')}`
    }
  }

  let category = ''
  const suggestedPathParts = suggestedPath.split('/').filter(Boolean)
  if (suggestedPathParts.length >= 2) {
    const firstPart = suggestedPathParts[0] || ''
    const secondPart = suggestedPathParts[1] || ''
    if (['电影', '剧集', '其他'].includes(firstPart)) {
      category = `${firstPart}/${secondPart}`
    }
  }

  const organizeResult: OrganizeResult = {
    success: true,
    title,
    year,
    mediaType,
    episodeLabel,
    category,
    release: techInfo.releaseGroup,
    quality: buildQualityLabel(techInfo),
    size: fileSize || 0,
    fileCount: 1,
    posterUrl,
    backdropUrl
  }
  
  sendOrganizeNotification(organizeResult).catch(e => {
    log.error('整理', `发送通知失败: ${e.message}`)
  })

  addOrganizeRecord(
    title,
    fileName,
    suggestedPath,
    action,
    'success'
  )

  return {
    success: true,
    data: {
      originalPath: fileName,
      targetPath: suggestedPath,
      action
    }
  }
}

/**
 * 递归遍历文件夹内的所有视频文件和字幕文件
 */
async function walkVideoFiles(
  cookie: string,
  folderId: string,
  basePath: string = ''
): Promise<{ videos: VideoFileItem[]; subtitles: VideoFileItem[] }> {
  const videos: VideoFileItem[] = []
  const subtitles: VideoFileItem[] = []
  
  const listResult = await listFiles(cookie, folderId, false)
  if (!listResult.success || !listResult.files) {
    return { videos, subtitles }
  }

  for (const item of listResult.files) {
    const itemPath = basePath ? `${basePath}/${item.name}` : item.name
    
    if (item.type === 'folder') {
      const subResult = await walkVideoFiles(cookie, item.fileId, itemPath)
      videos.push(...subResult.videos)
      subtitles.push(...subResult.subtitles)
    } else if (item.type === 'file') {
      const ext = item.name.substring(item.name.lastIndexOf('.')).toLowerCase()
      if (VIDEO_EXTENSIONS.includes(ext)) {
        videos.push({
          fileId: item.fileId,
          fileName: item.name,
          parentId: folderId,
          relPath: itemPath,
          size: item.size || 0
        })
      } else if (SUBTITLE_EXTENSIONS.includes(ext)) {
        subtitles.push({
          fileId: item.fileId,
          fileName: item.name,
          parentId: folderId,
          relPath: itemPath,
          size: item.size || 0
        })
      }
    }
  }

  return { videos, subtitles }
}

/**
 * 整理文件夹（优化版 - 批量操作）
 */
async function organizeFolder(
  cookie: string,
  mediaDirId: string,
  folderId: string,
  folderName: string,
  suggestedPath: string,
  action: 'move' | 'copy',
  mediaType: 'movie' | 'tv',
  tmdbId: number,
  title: string,
  year: string,
  protectedFolderId?: string,
  posterUrl?: string,
  backdropUrl?: string
): Promise<{ success: boolean; error?: string; data?: any }> {
  log.info('整理', `开始整理: ${folderName} -> ${suggestedPath}`)

  const pathParts = suggestedPath.split('/').filter(Boolean)
  if (pathParts.length < 1) {
    return { success: false, error: '目标路径格式错误' }
  }

  const cache = getFsCache()
  
  const cachedDir = cache.getTmdbDir(tmdbId)
  if (cachedDir) {
    log.info('整理', `使用TMDB缓存: ${tmdbId} -> ${cachedDir.path}`)
  }

  const { videos: videoFiles, subtitles: subtitleFiles } = await walkVideoFiles(cookie, folderId)
  log.info('整理', `发现 ${videoFiles.length} 个视频文件, ${subtitleFiles.length} 个字幕文件`)

  if (videoFiles.length === 0) {
    return { success: false, error: '源文件夹内没有找到视频文件' }
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
    techInfo: ReturnType<typeof extractTechInfo>
  }

  const fileTargets: FileTargetInfo[] = []
  const seasonDirCache: Map<number, { dirId: string; path: string }> = new Map()
  
  let category = ''
  const suggestedPathParts = suggestedPath.split('/').filter(Boolean)
  if (suggestedPathParts.length >= 2) {
    const firstPart = suggestedPathParts[0] || ''
    const secondPart = suggestedPathParts[1] || ''
    if (['电影', '剧集', '其他'].includes(firstPart)) {
      category = `${firstPart}/${secondPart}`
    }
  }

  for (const videoFile of videoFiles) {
    let fullTargetPath: string
    let targetSeason: number | undefined

    if (mediaType === 'movie') {
      fullTargetPath = suggestedPath
    } else {
      const fileInfo = extractKeyInfo(videoFile.fileName)
      targetSeason = fileInfo.season ?? undefined
      
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
    let targetDirPath: string

    if (mediaType === 'tv' && targetSeason && seasonDirCache.has(targetSeason)) {
      const cached = seasonDirCache.get(targetSeason)!
      targetDirId = cached.dirId
      targetDirPath = cached.path
    } else {
      const ensureResult = await ensurePath(cookie, mediaDirId, targetDirParts)
      if (!ensureResult.success) {
        log.error('整理', `创建目录失败: ${ensureResult.error}`)
        continue
      }
      targetDirId = ensureResult.dirId!
      targetDirPath = targetDirParts.join('/')
      
      if (mediaType === 'tv' && targetSeason) {
        seasonDirCache.set(targetSeason, { dirId: targetDirId, path: targetDirPath })
      }
    }

    fileTargets.push({
      fileId: videoFile.fileId,
      fileName: videoFile.fileName,
      targetDirId,
      targetDirPath,
      targetFileName: targetFileName || videoFile.fileName,
      fullTargetPath,
      size: videoFile.size,
      season: targetSeason,
      techInfo: extractTechInfo(videoFile.fileName)
    })
    
    const fileInfo = extractKeyInfo(videoFile.fileName)
    const lastTarget = fileTargets[fileTargets.length - 1]
    if (lastTarget && fileInfo.season && fileInfo.episode) {
      lastTarget.episode = fileInfo.episode
    }
  }

  if (fileTargets.length === 0) {
    return { success: false, error: '没有可处理的文件' }
  }

  let successCount = 0
  let failCount = 0
  const processedFiles: string[] = []
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

  log.info('整理', `批量操作: ${fileTargets.length} 个文件, ${filesByDir.size} 个目标目录`)

  for (const [dirId, files] of filesByDir) {
    const fileIds = files.map(f => f.fileId)
    
    if (action === 'move') {
      const batchResult = await batchMoveFiles(fileIds, dirId)
      
      if (batchResult.success) {
        const firstFile = files[0]
        log.success('整理', `批量移动成功: ${files.length} 个文件 -> ${firstFile?.targetDirPath || dirId}`)
        
        const renameItems = files
          .filter(f => f.targetFileName !== f.fileName)
          .map(f => ({ fileId: f.fileId, newName: f.targetFileName }))
        
        if (renameItems.length > 0) {
          const renameResult = await batchRenameFiles(renameItems)
          if (renameResult.success) {
            log.success('整理', `批量重命名成功: ${renameItems.length} 个文件`)
          } else {
            log.warn('整理', `批量重命名部分失败: ${renameResult.error}`)
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
          processedFiles.push(file.fileName)
          
          if (file.season && file.episode) {
            episodes.push({ season: file.season, episode: file.episode })
          }
          
          if (file.techInfo.releaseGroup && !release) release = file.techInfo.releaseGroup
          if (!quality) quality = buildQualityLabel(file.techInfo)
          
          addOrganizeRecord(title, file.fileName, file.fullTargetPath, action, 'success')
          log.success('整理', `移动: ${file.fileName} -> ${file.fullTargetPath}`)
        }
      } else {
        log.warn('整理', `批量移动失败，尝试单独处理: ${batchResult.error}`)
        
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
              processedFiles.push(file.fileName)
              
              if (file.season && file.episode) {
                episodes.push({ season: file.season, episode: file.episode })
              }
              
              if (file.techInfo.releaseGroup && !release) release = file.techInfo.releaseGroup
              if (!quality) quality = buildQualityLabel(file.techInfo)
              
              addOrganizeRecord(title, file.fileName, file.fullTargetPath, action, 'success')
              log.success('整理', `移动: ${file.fileName} -> ${file.fullTargetPath}`)
            } else {
              log.error('整理', `移动失败: ${file.fileName} - ${moveResult.error}`)
              failCount++
            }
          } catch (e: any) {
            log.error('整理', `处理失败: ${file.fileName} - ${e.message}`)
            failCount++
          }
        }
      }
    } else {
      const batchResult = await batchCopyFiles(fileIds, dirId)
      
      if (batchResult.success) {
        const firstFile = files[0]
        log.success('整理', `批量复制成功: ${files.length} 个文件 -> ${firstFile?.targetDirPath || dirId}`)
        
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
            log.success('整理', `批量重命名成功: ${renameItems.length} 个文件`)
          } else {
            log.warn('整理', `批量重命名部分失败: ${renameResult.error}`)
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
          processedFiles.push(original.fileName)
          
          if (original.season && original.episode) {
            episodes.push({ season: original.season, episode: original.episode })
          }
          
          if (original.techInfo.releaseGroup && !release) release = original.techInfo.releaseGroup
          if (!quality) quality = buildQualityLabel(original.techInfo)
          
          addOrganizeRecord(title, original.fileName, original.fullTargetPath, action, 'success')
          log.success('整理', `复制: ${original.fileName} -> ${original.fullTargetPath}`)
        }
      } else {
        log.warn('整理', `批量复制失败，尝试单独处理: ${batchResult.error}`)
        
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
              processedFiles.push(file.fileName)
              
              if (file.season && file.episode) {
                episodes.push({ season: file.season, episode: file.episode })
              }
              
              if (file.techInfo.releaseGroup && !release) release = file.techInfo.releaseGroup
              if (!quality) quality = buildQualityLabel(file.techInfo)
              
              addOrganizeRecord(title, file.fileName, file.fullTargetPath, action, 'success')
              log.success('整理', `复制: ${file.fileName} -> ${file.fullTargetPath}`)
            } else {
              log.error('整理', `复制失败: ${file.fileName} - ${copyResult.error}`)
              failCount++
            }
          } catch (e: any) {
            log.error('整理', `复制异常: ${file.fileName} - ${e.message}`)
            failCount++
          }
        }
      }
    }
  }

  if (subtitleFiles.length > 0 && processedVideoInfo.size > 0) {
    const subtitleTargets: { fileId: string; targetDirId: string; targetFileName: string }[] = []
    
    for (const subtitleFile of subtitleFiles) {
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
      const subsByDir = new Map<string, typeof subtitleTargets>()
      for (const sub of subtitleTargets) {
        const key = sub.targetDirId
        if (!subsByDir.has(key)) {
          subsByDir.set(key, [])
        }
        subsByDir.get(key)!.push(sub)
      }
      
      for (const [dirId, subs] of subsByDir) {
        if (action === 'move') {
          const subFileIds = subs.map(s => s.fileId)
          const batchResult = await batchMoveFiles(subFileIds, dirId)
          
          if (batchResult.success) {
            const renameItems = subs
              .filter(s => s.targetFileName)
              .map(s => ({ fileId: s.fileId, newName: s.targetFileName }))
            
            if (renameItems.length > 0) {
              await batchRenameFiles(renameItems)
            }
            
            log.success('整理', `批量处理字幕成功: ${subs.length} 个`)
          } else {
            for (const sub of subs) {
              const moveResult = await moveFile(cookie, sub.fileId, sub.targetDirId)
              if (moveResult.success && sub.targetFileName) {
                await renameFile(cookie, sub.fileId, sub.targetFileName)
              }
            }
          }
        } else {
          for (const sub of subs) {
            const copyResult = await copyFile(cookie, sub.fileId, sub.targetDirId)
            if (copyResult.success && sub.targetFileName) {
              const newFileId = copyResult.newFileId || sub.fileId
              await renameFile(cookie, newFileId, sub.targetFileName)
            }
          }
          log.success('整理', `处理字幕: ${subs.length} 个`)
        }
      }
    }
  }

  if (action === 'move' && successCount > 0) {
    const cleanResult = await deleteEmptyFolders(cookie, folderId, protectedFolderId)
    if (cleanResult.deletedCount > 0) {
      log.success('整理', `清理空文件夹: ${cleanResult.deletedCount} 个`)
    }
  }

  if (successCount > 0 && !cachedDir) {
    const firstTarget = fileTargets[0]
    if (firstTarget) {
      const targetDirParts = firstTarget.fullTargetPath.split('/').filter(Boolean).slice(0, -1)
      cache.setTmdbDir(tmdbId, mediaDirId, targetDirParts.join('/'))
    }
  }

  log.success('整理', `整理完成: 成功 ${successCount} 个, 失败 ${failCount} 个`)

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
      posterUrl,
      backdropUrl
    }
    
    sendOrganizeNotification(organizeResult).catch(e => {
      log.error('整理', `发送通知失败: ${e.message}`)
    })
    
    addOrganizeRecord(
      title,
      folderName,
      suggestedPath,
      action,
      'success'
    )
  }

  return {
    success: successCount > 0,
    data: {
      successCount,
      failCount,
      totalFiles: videoFiles.length,
      processedFiles,
      targetPath: suggestedPath
    }
  }
}
