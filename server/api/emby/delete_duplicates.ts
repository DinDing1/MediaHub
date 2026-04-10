/**
 * 重复文件删除 API
 * =================
 *
 * 功能概述：
 *   接收前端传来的待删除列表，依次执行以下操作：
 *   1. 调用 Emby REST API 删除媒体项目（item 或 media_source 级别）
 *   2. （可选）将容器内路径映射为本地路径后删除本地 STRM/视频文件及附属文件
 *
 * 使用场景：
 *   用户在「剧集查重」页面发现重复的影视资源后，选择要删除的低质量版本，
 *   前端收集选中的条目信息，调用此接口完成 Emby + 本地文件的双重删除。
 *
 * 路径映射机制：
 *   Emby 运行在 Docker 容器中时，Emby 返回的文件路径是容器内的路径（如 /Media115/...），
 *   而实际文件存储在宿主机上（如 /vol2/1000/05-MediaHub/...）。
 *   本接口通过 settings 表中 path_mapping 配置项存储的映射规则，
 *   将容器路径自动转换为本地路径，从而实现跨容器的文件删除。
 *
 * 删除策略：
 *   - deleteType = 'item'：调用 Emby Items/{id} DELETE 接口，删除整个媒体项（含所有版本）
 *   - deleteType = 'media_source'：调用 Emby Videos/{id}/MediaSources/{sourceId} DELETE 接口，
 *     仅删除指定媒体源（保留同项目的其他版本），适用于同一影片有多个画质版本的场景
 *
 * 本地文件清理范围：
 *   - .strm 文件：仅删除 strm 本身（strm 是指向真实文件的引用，无需清理附属文件）
 *   - 视频文件（.mkv/.mp4 等）：同时清理附属文件：
 *     .nfo（元数据）、.jpg/.jpeg/.png（封面/剧照）、
 *     .srt/.ass/.ssa/.sub（字幕文件）
 *   - 空目录：检测并记录但不自动删除（安全考虑）
 *
 * API 请求格式 (POST)：
 *   Body: {
 *     items: [{
 *       embyItemId: string,        // Emby 项目 ID
 *       mediaSourceId?: string,    // 媒体源 ID（deleteType=media_source 时必填）
 *       deleteType: 'item' | 'media_source',  // 删除类型
 *       path?: string              // 文件在容器内的完整路径
 *     }],
 *     skip_local_delete?: boolean  // 是否跳过本地文件删除（默认 false）
 *   }
 *
 * API 响应格式：
 *   { success: boolean, results: [...], summary: { total, embySuccess, embyFail } }
 */

import { defineEventHandler, readBody } from 'h3'
import { getSetting } from '../../utils/db'
import { embyRequest, getEmbyConfig } from '../../utils/emby/emby'
import { log } from '../../utils/logger'
import { existsSync, unlinkSync, readdirSync, statSync } from 'fs'
import { join, normalize } from 'path'

interface PathMapping {
  containerPath: string
  localPath: string
}

interface DeleteItem {
  embyItemId: string
  mediaSourceId?: string
  deleteType: 'item' | 'media_source'
  path?: string
}

function parsePathMappings(): PathMapping[] {
  const raw = getSetting('path_mapping')
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((m: any) => ({
        containerPath: m.containerPath || '',
        localPath: m.localPath || ''
      })).filter((m: PathMapping) => m.containerPath && m.localPath)
    }
    return []
  } catch {
    return []
  }
}

function mapToLocalPath(containerPath: string): string | null {
  const mappings = parsePathMappings()
  for (const mapping of mappings) {
    const normalizedContainer = normalize(mapping.containerPath).replace(/\\/g, '/')
    const normalizedLocal = normalize(mapping.localPath).replace(/\\/g, '/')
    const normalizedInput = normalize(containerPath).replace(/\\/g, '/')

    if (normalizedInput.startsWith(normalizedContainer)) {
      const relative = normalizedInput.slice(normalizedContainer.length)
      let result = join(normalizedLocal, relative)
      if (process.platform === 'win32') {
        result = result.replace(/\//g, '\\')
      }
      return result
    }
  }
  return null
}

async function deleteFromEmby(embyItemId: string, mediaSourceId: string | undefined, deleteType: string): Promise<{ success: boolean; error?: string }> {
  const config = await getEmbyConfig()
  if (!config) {
    return { success: false, error: 'Emby未配置' }
  }

  try {
    if (deleteType === 'media_source' && mediaSourceId) {
      await embyRequest(`/Videos/${embyItemId}/MediaSources/${mediaSourceId}`, {
        method: 'DELETE',
        responseType: 'none'
      })
    } else {
      await embyRequest(`/Items/${embyItemId}`, {
        method: 'DELETE',
        responseType: 'none'
      })
    }
    return { success: true }
  } catch (error: any) {
    return { success: false, error: `Emby删除请求失败: ${error.message}` }
  }
}

function deleteLocalFile(filePath: string): { success: boolean; error?: string; deletedFiles: string[] } {
  const deletedFiles: string[] = []

  try {
    const normalizedName = filePath.toLowerCase()

    if (normalizedName.endsWith('.strm')) {
      if (existsSync(filePath)) {
        unlinkSync(filePath)
        deletedFiles.push(filePath)
      }
    } else {
      const extsToClean = ['.nfo', '.jpg', '.jpeg', '.png', '.srt', '.ass', '.ssa', '.sub']
      const baseNameNoExt = filePath.replace(/\.[^.]+$/, '')

      if (existsSync(filePath)) {
        unlinkSync(filePath)
        deletedFiles.push(filePath)
      }

      for (const ext of extsToClean) {
        const sidecarFile = baseNameNoExt + ext
        if (existsSync(sidecarFile)) {
          try {
            unlinkSync(sidecarFile)
            deletedFiles.push(sidecarFile)
          } catch {
          }
        }
      }

      const dirPath = join(filePath, '..')
      try {
        if (existsSync(dirPath)) {
          const entries = readdirSync(dirPath)
          if (entries.length === 0) {
            const dirStat = statSync(dirPath)
            if (dirStat.isDirectory()) {
            }
          }
        }
      } catch {
      }
    }

    return { success: true, deletedFiles }
  } catch (error: any) {
    return { success: false, error: `本地文件删除失败: ${error.message}`, deletedFiles }
  }
}

export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') {
    return { success: false, error: '不支持的请求方法' }
  }

  try {
    const body = await readBody(event)
    const items: DeleteItem[] = body.items || []

    const skipLocalDelete = body.skip_local_delete === true

    if (items.length === 0) {
      return { success: false, error: '没有提供要删除的项目' }
    }

    log.info('重复删除', `开始删除 ${items.length} 个项目`)

    const results: Array<{
      item: DeleteItem
      embySuccess: boolean
      embyError?: string
      localSuccess: boolean
      localError?: string
      deletedLocalFiles: string[]
    }> = []

    for (const item of items) {
      const result: typeof results[0] = {
        item,
        embySuccess: false,
        localSuccess: true,
        deletedLocalFiles: []
      }

      const embyResult = await deleteFromEmby(item.embyItemId, item.mediaSourceId, item.deleteType)
      result.embySuccess = embyResult.success
      if (!embyResult.success) {
        result.embyError = embyResult.error
      }

      if (!skipLocalDelete && item.path) {
        const localPath = mapToLocalPath(item.path)
        if (localPath) {
          log.info('重复删除', `路径映射: ${item.path} → ${localPath}`)
          const localResult = deleteLocalFile(localPath)
          result.localSuccess = localResult.success
          if (!localResult.success) {
            result.localError = localResult.error
          }
          result.deletedLocalFiles = localResult.deletedFiles
        } else {
          const mappings = parsePathMappings()
          log.warn('重复删除', `路径映射未找到，跳过本地删除。容器路径: ${item.path}，已配置 ${mappings.length} 条映射规则，请检查查重设置中的路径映射是否正确`)
        }
      }

      results.push(result)
    }

    const allEmbySuccess = results.every(r => r.embySuccess)
    const totalDeleted = results.filter(r => r.embySuccess).length

    log.info('重复删除', `删除完成: ${totalDeleted}/${items.length} 个Emby项目成功`)

    return {
      success: allEmbySuccess,
      results,
      summary: {
        total: items.length,
        embySuccess: totalDeleted,
        embyFail: items.length - totalDeleted
      }
    }
  } catch (error: any) {
    log.error('重复删除', `删除操作失败: ${error.message}`)
    return { success: false, error: error.message }
  }
})
