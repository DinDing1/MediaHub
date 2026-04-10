/**
 * 清除 Webhook 日志 API
 * 
 * 功能说明：
 * 清除所有 Webhook 日志记录
 * 
 * @module server/api/emby/webhook/clear
 */

import { defineEventHandler } from 'h3'
import { clearWebhookLogs } from '../../../utils/emby/webhook'

export default defineEventHandler(() => {
  clearWebhookLogs()
  
  return {
    success: true,
    message: '日志已清除'
  }
})
