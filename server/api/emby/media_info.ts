/**
 * Emby 媒体信息提取 API
 *
 * 功能说明：
 * 1. 获取可提取媒体库与已保存配置
 * 2. 获取批量提取状态与追更状态
 * 3. 保存媒体信息提取配置与追更开关
 * 4. 手动启动媒体信息提取任务
 *
 * @module server/api/emby/media_info
 */

import { defineEventHandler, getQuery, readBody } from 'h3'
import { setSetting } from '../../utils/db'
import { getConfiguredMediaInfoFollowOptions, getConfiguredMediaInfoTaskOptions, getMediaInfoLibraries, getMediaInfoTaskStatus, getMediaInfoFollowTaskStatus, kickMediaInfoFollowQueue, startMediaInfoTask } from '../../utils/emby/media_info'
import { log } from '../../utils/logger'

const FOLLOW_ENABLED_SETTING_KEY = 'task_media_info_follow_enabled'
const TASK_LIBRARY_ID_SETTING_KEY = 'task_media_info_library_id'
const TASK_CONCURRENCY_SETTING_KEY = 'task_media_info_concurrency'

function normalizeConcurrency(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return 1
  }

  return Math.min(Math.max(Math.floor(num), 1), 10)
}

export default defineEventHandler(async (event) => {
  const method = event.method
  const query = getQuery(event)

  if (method === 'GET') {
    const action = query.action as string

    if (action === 'libraries') {
      try {
        const libraries = await getMediaInfoLibraries()
        return {
          success: true,
          data: libraries
        }
      } catch (error: any) {
        log.error('媒体信息提取', `获取媒体库失败: ${error.message}`)
        return {
          success: false,
          error: error.message
        }
      }
    }

    if (action === 'status') {
      return {
        success: true,
        data: getMediaInfoTaskStatus()
      }
    }

    if (action === 'config') {
      return {
        success: true,
        data: getConfiguredMediaInfoTaskOptions()
      }
    }

    if (action === 'follow_config') {
      return {
        success: true,
        data: {
          enabled: getConfiguredMediaInfoFollowOptions().enabled
        }
      }
    }

    if (action === 'follow_status') {
      return {
        success: true,
        data: getMediaInfoFollowTaskStatus()
      }
    }

    return {
      success: false,
      error: '未知的操作'
    }
  }

  if (method === 'POST') {
    try {
      const body = await readBody(event)
      const action = body?.action as string | undefined

      if (action === 'config') {
        const libraries = await getMediaInfoLibraries()
        const libraryId = String(body?.libraryId || body?.library_id || 'all')
        const concurrency = normalizeConcurrency(body?.concurrency)

        if (libraryId !== 'all' && !libraries.some(item => item.id === libraryId)) {
          return {
            success: false,
            error: '指定的媒体库不存在'
          }
        }

        setSetting(TASK_LIBRARY_ID_SETTING_KEY, libraryId)
        setSetting(TASK_CONCURRENCY_SETTING_KEY, String(concurrency))

        return {
          success: true,
          data: {
            libraryId,
            concurrency
          },
          message: '媒体信息配置已保存'
        }
      }

      if (action === 'follow_config') {
        const enabled = body?.enabled === true || body?.enabled === 'true'

        setSetting(FOLLOW_ENABLED_SETTING_KEY, enabled ? 'true' : 'false')

        if (enabled) {
          await kickMediaInfoFollowQueue()
        }

        return {
          success: true,
          data: {
            enabled
          },
          message: '追更模式配置已保存'
        }
      }

      const libraryId = body?.library_id || 'all'
      const concurrency = Number(body?.concurrency)

      const result = await startMediaInfoTask(libraryId, concurrency)
      return result
    } catch (error: any) {
      log.error('媒体信息提取', `启动任务失败: ${error.message}`)
      return {
        success: false,
        error: error.message
      }
    }
  }

  return {
    success: false,
    error: '不支持的请求方法'
  }
})
