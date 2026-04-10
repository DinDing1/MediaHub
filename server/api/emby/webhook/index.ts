/**
 * Emby Webhook API 端点
 * 
 * 功能说明：
 * 1. 接收 Emby 服务器发送的 Webhook 请求
 * 2. 解析 multipart/form-data 格式的数据
 * 3. 调用处理函数发送通知
 * 
 * 使用方法：
 * 1. 在 Emby 服务器设置中添加 Webhook URL: http://your-server:3030/api/emby/webhook
 * 2. 选择需要通知的事件类型
 * 3. 当事件触发时，系统会自动发送通知到已配置的 Telegram 和微信
 * 
 * 测试方法：
 * - GET /api/emby/webhook?action=test - 发送测试通知
 * - GET /api/emby/webhook?action=logs - 获取日志列表
 * - GET /api/emby/webhook - 查看支持的接口信息
 * 
 * @module server/api/emby/webhook/index
 */

import { defineEventHandler, readBody, getQuery, getHeader } from 'h3'
import { handleEmbyWebhook, EmbyWebhookEvent, getWebhookLogs } from '../../../utils/emby/webhook'
import { log } from '../../../utils/logger'

/**
 * 解析 multipart/form-data 格式的数据
 * Emby 发送的 Webhook 数据格式为 multipart/form-data
 * JSON 数据位于 data 字段中
 * 
 * @param body - 原始请求体字符串
 * @returns 解析后的 JSON 对象，解析失败返回 null
 */
function parseMultipartData(body: string): any {
  const jsonMatch = body.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch (e) {
      log.error('Emby Webhook', `JSON 解析失败: ${e}`)
      return null
    }
  }
  return null
}

export default defineEventHandler(async (event) => {
  const method = event.method
  const query = getQuery(event)
  const contentType = getHeader(event, 'content-type') || ''

  if (method === 'GET') {
    const action = query.action as string
    
    if (action === 'test') {
      log.info('Emby Webhook', '执行测试通知')
      
      const testEvent: EmbyWebhookEvent = {
        Event: 'system.notificationtest',
        Title: '测试通知',
        Description: '这是一条来自 Emby Webhook 的测试通知',
        Server: {
          Id: 'test',
          Name: 'Test Server',
          Version: '1.0.0'
        }
      }
      
      const result = await handleEmbyWebhook(testEvent)
      return {
        success: result.success,
        message: result.success ? '测试通知已发送' : result.error
      }
    }
    
    if (action === 'logs') {
      const logs = getWebhookLogs()
      return {
        success: true,
        data: logs
      }
    }
    
    return {
      success: true,
      message: 'Emby Webhook Endpoint',
      hint: '在 Emby 服务器设置中添加此 URL 作为 Webhook 目标',
      supportedEvents: [
        { event: 'library.new', title: '新增媒体', notify: true },
        { event: 'library.deleted', title: '删除媒体', notify: true },
        { event: 'playback.start', title: '开始播放', notify: true },
        { event: 'playback.stop', title: '停止播放', notify: true },
        { event: 'user.authenticated', title: '用户登录', notify: true },
        { event: 'user.authenticationfailed', title: '登录失败', notify: true }
      ]
    }
  }

  if (method === 'POST') {
    try {
      const body = await readBody(event)
      let webhookEvent: EmbyWebhookEvent
      
      if (contentType.includes('multipart/form-data')) {
        const parsedData = parseMultipartData(body)
        if (!parsedData) {
          log.error('Emby Webhook', '无法解析 multipart 数据')
          return { success: false, error: '无法解析请求数据' }
        }
        webhookEvent = parsedData
      } else {
        webhookEvent = body
      }
      
      const result = await handleEmbyWebhook(webhookEvent)
      
      return {
        success: result.success,
        error: result.error
      }
    } catch (e: any) {
      log.error('Emby Webhook', `处理失败: ${e.message}`)
      return {
        success: false,
        error: e.message
      }
    }
  }

  return {
    success: false,
    error: '不支持的请求方法'
  }
})
