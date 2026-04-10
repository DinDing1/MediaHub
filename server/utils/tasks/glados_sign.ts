/**
 * GlaDOS 签到模块
 * 
 * 功能：
 * - 自动完成 GlaDOS 每日签到
 * - 获取签到后的点数信息
 * - 签到完成后自动发送通知
 */

import { getSetting } from '../db'
import { log } from '../logger'
import { sendNotification } from '../telegram/client'
import { sendWechatNotification } from '../wechat/client'
import { formatShanghaiDateTime } from '~/utils/time'

const GLADOS_BASE_URL = 'https://glados.cloud'

interface SignResult {
  success: boolean
  message: string
  pointsGain?: number
  currentPoints?: number
  leftDays?: number
  email?: string
}

interface PointsResponse {
  code: number
  message: string
  points?: number
  list?: Array<{
    user_id: number
    balance: number
    time: number
    points?: number
  }>
}

interface StatusResponse {
  code: number
  data?: {
    userId?: number
    email?: string
    days?: number
    leftDays?: number
  }
}

function getDefaultHeaders(cookie: string): Record<string, string> {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.95 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Content-Type': 'application/json;charset=UTF-8',
    'Origin': GLADOS_BASE_URL,
    'Referer': `${GLADOS_BASE_URL}/`,
    'Cookie': cookie
  }
}

async function checkin(cookie: string): Promise<SignResult> {
  const url = `${GLADOS_BASE_URL}/api/user/checkin`
  const headers = getDefaultHeaders(cookie)
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token: 'glados.cloud' }),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        success: false,
        message: `请求失败: ${response.status}`
      }
    }

    const data: PointsResponse = await response.json()
    const code = data.code || -1
    const pointsGain = data.points || 0
    const message = data.message || ''
    
    const list = data.list || []
    const item = list[0] as { balance?: number } | undefined
    const balance = item?.balance || 0

    if (code === 0 || message.toLowerCase().includes('got') || message.toLowerCase().includes('points')) {
      const actualPoints = pointsGain || parseInt(message.match(/\d+/)?.[0] || '0', 10)
      log.success('GlaDOS签到', `签到成功，获得 ${actualPoints} 点数`)
      return {
        success: true,
        message: `签到成功，获得 ${actualPoints} 点数`,
        pointsGain: actualPoints,
        currentPoints: balance
      }
    }
    
    if (code === 1 || message.includes('Repeats') || message.includes('Try Tomorrow')) {
      log.info('GlaDOS签到', '今日已签到')
      return {
        success: true,
        message: '今日已签到',
        currentPoints: balance
      }
    }

    return {
      success: false,
      message: message || '签到失败'
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      log.error('GlaDOS签到', '请求超时')
      return {
        success: false,
        message: '请求超时，请检查网络连接'
      }
    }
    log.error('GlaDOS签到', `签到异常: ${e.message}`)
    return {
      success: false,
      message: `签到异常: ${e.message}`
    }
  }
}

async function getUserStatus(cookie: string): Promise<{ leftDays?: number; email?: string }> {
  const url = `${GLADOS_BASE_URL}/api/user/status`
  const headers = getDefaultHeaders(cookie)
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers
    })

    if (!response.ok) {
      return {}
    }

    const data: StatusResponse = await response.json()
    
    if (data.code === 0 && data.data) {
      return {
        leftDays: data.data.leftDays,
        email: data.data.email
      }
    }
    
    return {}
  } catch {
    return {}
  }
}

function sendSignNotification(result: SignResult, triggerType: 'manual' | 'scheduled' = 'manual'): void {
  const statusIcon = result.success ? '✅' : '❌'
  const statusText = result.success ? '签到成功' : '签到失败'
  const now = new Date()
  const timeStr = formatShanghaiDateTime(now)
  
  const triggerText = triggerType === 'scheduled' ? '定时触发' : '手动触发'
  
  const lines: string[] = [
    `【${statusIcon} GlaDOS${statusText}】`,
    '',
    '━━━━━━━━━━',
    `🕐 时间：${timeStr}`,
    `📍 方式：${triggerText}`,
    `✨ 状态：${result.message}`,
    '━━━━━━━━━━'
  ]
  
  if (result.success) {
    if (result.pointsGain !== undefined && result.pointsGain > 0) {
      lines.push(`📈 本次点数：${result.pointsGain}`)
    }
    if (result.currentPoints !== undefined) {
      lines.push(`💰 当前点数：${Math.round(result.currentPoints)}`)
    }
    if (result.leftDays !== undefined) {
      lines.push(`🕒 剩余天数：${Math.round(result.leftDays)}`)
    }
    if (result.email) {
      lines.push(`📧 邮箱：${result.email}`)
    }
    lines.push('━━━━━━━━━━')
  }
  
  const message = lines.join('\n')
  
  sendNotification(message).catch(e => log.error('Telegram通知', e.message || e))
  sendWechatNotification(message).catch(e => log.error('微信通知', e.message || e))
}

export async function gladosSign(triggerType: 'manual' | 'scheduled' = 'manual'): Promise<SignResult> {
  const cookie = getSetting('glados_cookie')
  
  if (!cookie) {
    log.error('GlaDOS签到', '未配置Cookie')
    const result: SignResult = { success: false, message: '未配置Cookie' }
    sendSignNotification(result, triggerType)
    return result
  }
  
  const checkinResult = await checkin(cookie)
  
  if (checkinResult.success) {
    const status = await getUserStatus(cookie)
    checkinResult.leftDays = status.leftDays
    checkinResult.email = status.email
  }
  
  sendSignNotification(checkinResult, triggerType)
  return checkinResult
}
