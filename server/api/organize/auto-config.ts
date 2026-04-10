/**
 * 自动整理配置API
 * 用于获取和设置自动整理配置
 */
import { defineEventHandler, getMethod, readBody } from 'h3'
import { getSetting, setSetting } from '../../utils/db'
import { updateAutoOrganizeSchedule, getSchedulerStatus } from '../../utils/scheduler'

export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  if (method === 'GET') {
    const enabled = getSetting('auto_organize_enabled') === 'true'
    const action = getSetting('auto_organize_action') || 'move'
    const cronExpr = getSetting('auto_organize_cron') || '0 3 * * *'
    const status = getSchedulerStatus()

    return {
      success: true,
      data: {
        enabled,
        action,
        cronExpression: cronExpr,
        isRunning: status !== null && status.enabled
      }
    }
  }

  if (method === 'POST') {
    try {
      const body = await readBody(event)
      const { enabled, action, cronExpression } = body

      if (typeof enabled !== 'boolean') {
        return { success: false, error: '无效的开关状态' }
      }

      if (action && !['move', 'copy'].includes(action)) {
        return { success: false, error: '无效的整理方式' }
      }

      if (enabled && cronExpression) {
        const cron = await import('node-cron')
        if (!cron.validate(cronExpression)) {
          return { success: false, error: '无效的Cron表达式' }
        }
      }

      setSetting('auto_organize_enabled', enabled ? 'true' : 'false')
      if (action) {
        setSetting('auto_organize_action', action)
      }
      if (cronExpression) {
        setSetting('auto_organize_cron', cronExpression)
      }

      const finalCron = cronExpression || getSetting('auto_organize_cron') || '0 3 * * *'
      await updateAutoOrganizeSchedule(enabled, finalCron)

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  return { success: false, error: '不支持的请求方法' }
})
