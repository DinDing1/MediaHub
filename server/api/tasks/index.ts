/**
 * 定时任务 API
 * 
 * GET  - 获取任务列表和状态
 * POST - 执行任务操作（更新配置、立即执行）
 */

import { defineEventHandler, readBody } from 'h3'
import { getSetting, setSetting } from '../../utils/db'
import { checkin115 } from '../../utils/pan115/checkin_115'
import { cleanTrash115 } from '../../utils/pan115/clean_trash_115'
import { fnosSign } from '../../utils/tasks/fnos_sign'
import { gladosSign } from '../../utils/tasks/glados_sign'
import { hdhiveSign } from '../../utils/tasks/hdhive_sign'
import { executeConfiguredMediaInfoTask, getMediaInfoLibraries } from '../../utils/emby/media_info'
import { updateCheckinSchedule, updateCleanTrashSchedule, updateFnosSignSchedule, updateGladosSignSchedule, updateHdhiveSignSchedule, updateMediaInfoSchedule } from '../../utils/scheduler'
import { formatShanghaiDateTime } from '~/utils/time'

interface Task {
  id: string
  name: string
  description: string
  enabled: boolean
  schedule: string
  lastRun?: string
  nextRun?: string
  libraryId?: string
  libraryName?: string
  concurrency?: number
}

const TASK_SETTINGS = {
  checkin: {
    enabled: 'task_checkin_enabled',
    schedule: 'task_checkin_schedule',
    lastRun: 'task_checkin_last_run',
    defaultSchedule: '0 8 * * *'
  },
  clean_trash: {
    enabled: 'task_clean_trash_enabled',
    schedule: 'task_clean_trash_schedule',
    lastRun: 'task_clean_trash_last_run',
    defaultSchedule: '0 0 * * *'
  },
  fnos_sign: {
    enabled: 'task_fnos_sign_enabled',
    schedule: 'task_fnos_sign_schedule',
    lastRun: 'task_fnos_sign_last_run',
    defaultSchedule: '0 8 * * *'
  },
  glados_sign: {
    enabled: 'task_glados_sign_enabled',
    schedule: 'task_glados_sign_schedule',
    lastRun: 'task_glados_sign_last_run',
    defaultSchedule: '0 9 * * *'
  },
  hdhive_sign: {
    enabled: 'task_hdhive_sign_enabled',
    schedule: 'task_hdhive_sign_schedule',
    lastRun: 'task_hdhive_sign_last_run',
    defaultSchedule: '0 10 * * *'
  },
  media_info: {
    enabled: 'task_media_info_enabled',
    schedule: 'task_media_info_schedule',
    lastRun: 'task_media_info_last_run',
    libraryId: 'task_media_info_library_id',
    concurrency: 'task_media_info_concurrency',
    defaultSchedule: '0 4 * * *'
  }
}

async function getTasks(): Promise<Task[]> {
  const mediaInfoLibraryId = getSetting(TASK_SETTINGS.media_info.libraryId) || 'all'
  const mediaInfoConcurrency = Math.min(Math.max(Number(getSetting(TASK_SETTINGS.media_info.concurrency) || '1') || 1, 1), 10)
  const libraries = await getMediaInfoLibraries().catch(() => [])
  const mediaInfoLibraryName = mediaInfoLibraryId === 'all'
    ? '全部媒体库'
    : libraries.find(item => item.id === mediaInfoLibraryId)?.name

  return [
    {
      id: 'checkin',
      name: '115签到',
      description: '每日自动签到领取奖励',
      enabled: getSetting(TASK_SETTINGS.checkin.enabled) === 'true',
      schedule: getSetting(TASK_SETTINGS.checkin.schedule) || '0 8 * * *',
      lastRun: getSetting(TASK_SETTINGS.checkin.lastRun) || undefined
    },
    {
      id: 'clean_trash',
      name: '清空回收站',
      description: '定时清空115云盘回收站',
      enabled: getSetting(TASK_SETTINGS.clean_trash.enabled) === 'true',
      schedule: getSetting(TASK_SETTINGS.clean_trash.schedule) || '0 0 * * *',
      lastRun: getSetting(TASK_SETTINGS.clean_trash.lastRun) || undefined
    },
    {
      id: 'fnos_sign',
      name: '飞牛签到',
      description: '每日飞牛论坛自动签到',
      enabled: getSetting(TASK_SETTINGS.fnos_sign.enabled) === 'true',
      schedule: getSetting(TASK_SETTINGS.fnos_sign.schedule) || '0 8 * * *',
      lastRun: getSetting(TASK_SETTINGS.fnos_sign.lastRun) || undefined
    },
    {
      id: 'glados_sign',
      name: 'GlaDOS签到',
      description: '每日GlaDOS自动签到获取点数',
      enabled: getSetting(TASK_SETTINGS.glados_sign.enabled) === 'true',
      schedule: getSetting(TASK_SETTINGS.glados_sign.schedule) || '0 9 * * *',
      lastRun: getSetting(TASK_SETTINGS.glados_sign.lastRun) || undefined
    },
    {
      id: 'hdhive_sign',
      name: '影巢签到',
      description: '每日影巢自动签到获取积分',
      enabled: getSetting(TASK_SETTINGS.hdhive_sign.enabled) === 'true',
      schedule: getSetting(TASK_SETTINGS.hdhive_sign.schedule) || '0 10 * * *',
      lastRun: getSetting(TASK_SETTINGS.hdhive_sign.lastRun) || undefined
    },
    {
      id: 'media_info',
      name: '媒体信息提取',
      description: '定时补齐 Emby 缺失的媒体流信息',
      enabled: getSetting(TASK_SETTINGS.media_info.enabled) === 'true',
      schedule: getSetting(TASK_SETTINGS.media_info.schedule) || '0 4 * * *',
      lastRun: getSetting(TASK_SETTINGS.media_info.lastRun) || undefined,
      libraryId: mediaInfoLibraryId,
      libraryName: mediaInfoLibraryName,
      concurrency: mediaInfoConcurrency
    }
  ]
}

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET') {
    const tasks = await getTasks()
    return {
      success: true,
      data: tasks
    }
  }

  if (method === 'POST') {
    try {
      const body = await readBody(event)
      const { action, taskId, enabled, schedule, libraryId, concurrency } = body

      if (action === 'update') {
        const settings = TASK_SETTINGS[taskId as keyof typeof TASK_SETTINGS]
        if (!settings) {
          return { success: false, error: '未知任务' }
        }

        if (enabled !== undefined) {
          setSetting(settings.enabled, enabled ? 'true' : 'false')
        }
        if (schedule !== undefined) {
          setSetting(settings.schedule, schedule)
        }
        if (taskId === 'media_info') {
          const libraries = await getMediaInfoLibraries()
          const finalLibraryId = libraryId !== undefined ? String(libraryId || 'all') : getSetting(TASK_SETTINGS.media_info.libraryId) || 'all'
          const finalConcurrency = concurrency !== undefined
            ? Math.min(Math.max(Number(concurrency) || 1, 1), 10)
            : Math.min(Math.max(Number(getSetting(TASK_SETTINGS.media_info.concurrency) || '1') || 1, 1), 10)

          if (finalLibraryId !== 'all' && !libraries.some(item => item.id === finalLibraryId)) {
            return { success: false, error: '指定的媒体库不存在' }
          }

          setSetting(TASK_SETTINGS.media_info.libraryId, finalLibraryId)
          setSetting(TASK_SETTINGS.media_info.concurrency, String(finalConcurrency))
        }

        const finalEnabled = enabled !== undefined ? enabled : getSetting(settings.enabled) === 'true'
        const finalSchedule = schedule !== undefined ? schedule : getSetting(settings.schedule) || settings.defaultSchedule

        if (taskId === 'checkin') {
          await updateCheckinSchedule(finalEnabled, finalSchedule)
        } else if (taskId === 'clean_trash') {
          await updateCleanTrashSchedule(finalEnabled, finalSchedule)
        } else if (taskId === 'fnos_sign') {
          await updateFnosSignSchedule(finalEnabled, finalSchedule)
        } else if (taskId === 'glados_sign') {
          await updateGladosSignSchedule(finalEnabled, finalSchedule)
        } else if (taskId === 'hdhive_sign') {
          await updateHdhiveSignSchedule(finalEnabled, finalSchedule)
        } else if (taskId === 'media_info') {
          await updateMediaInfoSchedule(finalEnabled, finalSchedule)
        }

        return { success: true, message: '配置已更新' }
      }

      if (action === 'run') {
        let result
        
        if (taskId === 'checkin') {
          result = await checkin115('manual')
        } else if (taskId === 'clean_trash') {
          result = await cleanTrash115('manual')
        } else if (taskId === 'fnos_sign') {
          result = await fnosSign('manual')
        } else if (taskId === 'glados_sign') {
          result = await gladosSign('manual')
        } else if (taskId === 'hdhive_sign') {
          result = await hdhiveSign('manual')
        } else if (taskId === 'media_info') {
          result = await executeConfiguredMediaInfoTask('manual')
        } else {
          return { success: false, error: '未知任务' }
        }

        if (result.success) {
          const settings = TASK_SETTINGS[taskId as keyof typeof TASK_SETTINGS]
          setSetting(settings.lastRun, formatShanghaiDateTime(new Date()))
        }

        return result
      }

      return { success: false, error: '未知操作' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  return { success: false, error: '不支持的请求方法' }
})
