/**
 * 115云盘签到模块
 * 
 * API 说明：
 * - GET  https://proapi.115.com/android/2.0/user/points_sign 获取签到信息
 * - POST https://proapi.115.com/android/2.0/user/points_sign 执行签到
 * 
 * API 返回结构（实际测试）：
 * GET 响应：
 * {
 *   "state": true,
 *   "code": 0,
 *   "data": {
 *     "is_sign_today": 1,           // 1=已签到, 0=未签到
 *     "continuous_day": 3,          // 连续签到天数
 *     "sign_list": [                // 签到列表（最近几天）
 *       {
 *         "points_num": "3",        // 获得的枫叶数（字符串）
 *         "sign_day": "20260331",   // 签到日期
 *         "device_name": ""         // 设备名称
 *       }
 *     ]
 *   }
 * }
 * 
 * POST 响应：
 * {
 *   "state": true,
 *   "data": { "points": 3 }         // 本次获得的枫叶数
 * }
 * 
 * 注意：API不返回当前总积分，只有签到相关信息
 */

import { createHash } from 'crypto'
import { getSetting } from '../db'
import { log } from '../logger'
import { sendNotification } from '../telegram/client'
import { sendWechatNotification } from '../wechat/client'
import { formatShanghaiDateTime } from '~/utils/time'

/** 签到结果 */
interface CheckinResult {
  success: boolean
  message?: string
  /** 获得的积分（本次签到） */
  points?: number
  /** 是否今日已签到（重复签到） */
  alreadySigned?: boolean
  /** 连续签到天数 */
  continuousDay?: number
  error?: string
}

/** 签到信息 */
interface SignInfo {
  /** 今日是否已签到 (1=已签到, 0=未签到) */
  is_sign_today: number
  /** 连续签到天数 */
  continuous_day: number
  /** 今日获得的枫叶数 */
  today_points?: number
  /** 签到列表 */
  sign_list?: Array<{
    points_num: string
    sign_day: string
    device_name: string
  }>
}

/**
 * 从 Cookie 中解析用户 ID
 * 
 * UID 格式: {user_id}_{login_ssoent}_{login_timestamp}
 * 例如: UID=123456789_A1_1704067200000
 * 
 * @param cookie Cookie 字符串
 * @returns 用户 ID，解析失败返回 null
 */
function getUserIdFromCookie(cookie: string): number | null {
  const uidMatch = cookie.match(/UID=([0-9]+)/i)
  if (uidMatch && uidMatch[1]) {
    const uidValue = uidMatch[1]
    const parts = uidValue.split('_')
    const firstPart = parts[0]
    if (firstPart) {
      const userId = parseInt(firstPart, 10)
      if (!isNaN(userId) && userId > 0) {
        return userId
      }
    }
  }
  return null
}

/**
 * 生成签到 Token
 * 
 * 格式: sha1("{user_id}-Points_Sign@#115-{timestamp}")
 * 
 * @param userId 用户 ID
 * @returns token 和 token_time
 */
function generateSignToken(userId: number): { token: string; tokenTime: number } {
  const tokenTime = Math.floor(Date.now() / 1000)
  const raw = `${userId}-Points_Sign@#115-${tokenTime}`
  const token = createHash('sha1').update(raw).digest('hex')
  return { token, tokenTime }
}

/**
 * 获取签到信息（检查今日是否已签到）
 * 
 * @param cookie Cookie 字符串
 * @returns 签到信息，失败返回 null
 */
async function getSignInfo(cookie: string): Promise<SignInfo | null> {
  try {
    const response = await fetch('https://proapi.115.com/android/2.0/user/points_sign', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36',
        'Cookie': cookie,
        'Referer': 'https://115.com/'
      }
    })

    const result = await response.json() as any
    
    if (result.state === true && result.data) {
      const data = result.data
      const signList = data.sign_list || []
      const todayPoints = signList.length > 0 ? parseInt(signList[0]?.points_num || '0', 10) : 0
      
      return {
        is_sign_today: data.is_sign_today || 0,
        continuous_day: data.continuous_day || 0,
        today_points: todayPoints,
        sign_list: signList
      }
    }
    return null
  } catch (e: any) {
    log.error('115签到', `获取签到信息失败: ${e.message}`)
    return null
  }
}

/**
 * 发送签到通知
 * 
 * @param result 签到结果
 */
async function sendCheckinNotification(result: CheckinResult, triggerType: 'manual' | 'scheduled' = 'manual'): Promise<void> {
  const now = new Date()
  const timeStr = formatShanghaiDateTime(now)
  
  const triggerText = triggerType === 'scheduled' ? '定时触发' : '手动触发'
  const statusIcon = result.success ? '✅' : '❌'
  const statusText = result.success ? '签到成功' : '签到失败'
  
  const lines: string[] = [
    `【${statusIcon} 115云盘${statusText}】`,
    '',
    '━━━━━━━━━━',
    `🕐 时间：${timeStr}`,
    `📍 方式：${triggerText}`,
    `✨ 状态：${result.alreadySigned ? '今日已签到' : result.message || '签到成功'}`,
    '━━━━━━━━━━'
  ]
  
  if (result.success) {
    lines.push('📊 签到统计')
    if (result.points && !result.alreadySigned) {
      lines.push(`🎁 本次获得：${result.points} 枫叶`)
    } else if (result.alreadySigned && result.points) {
      lines.push(`📊 今日获得：${result.points} 枫叶`)
    }
    if (result.continuousDay) {
      lines.push(`🔥 连续签到：${result.continuousDay} 天`)
    }
    lines.push('━━━━━━━━━━')
  } else {
    lines.push(`❌ 错误：${result.error}`)
    lines.push('━━━━━━━━━━')
  }
  
  const message = lines.join('\n')
  
  await Promise.all([
    sendNotification(message).catch(e => log.error('Telegram通知', e.message)),
    sendWechatNotification(message).catch(e => log.error('微信通知', e.message || e))
  ])
}

/**
 * 执行115签到
 * 
 * @returns 签到结果
 */
export async function checkin115(triggerType: 'manual' | 'scheduled' = 'manual'): Promise<CheckinResult> {
  const cookie = getSetting('pan115_cookie')
  
  if (!cookie) {
    log.error('115签到', '未配置Cookie')
    const result: CheckinResult = { success: false, error: '未配置115 Cookie' }
    await sendCheckinNotification(result, triggerType)
    return result
  }

  const userId = getUserIdFromCookie(cookie)
  if (!userId) {
    log.error('115签到', '无法从Cookie解析用户ID')
    const result: CheckinResult = { success: false, error: 'Cookie格式错误，无法解析用户ID' }
    await sendCheckinNotification(result, triggerType)
    return result
  }

  log.info('115签到', `用户ID: ${userId}`)

  const signInfo = await getSignInfo(cookie)
  if (signInfo && signInfo.is_sign_today === 1) {
    log.info('115签到', `今日已签到，连续签到 ${signInfo.continuous_day} 天`)
    const result: CheckinResult = {
      success: true,
      message: `今日已签到，连续签到 ${signInfo.continuous_day} 天`,
      alreadySigned: true,
      continuousDay: signInfo.continuous_day,
      points: signInfo.today_points
    }
    await sendCheckinNotification(result, triggerType)
    return result
  }

  const { token, tokenTime } = generateSignToken(userId)

  try {
    const response = await fetch('https://proapi.115.com/android/2.0/user/points_sign', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookie,
        'Referer': 'https://115.com/'
      },
      body: `token=${token}&token_time=${tokenTime}`
    })

    const respResult = await response.json() as any
    
    if (respResult.state === true || respResult.errno === 0) {
      const postPoints = respResult.data?.points_num || respResult.points || 0
      log.success('115签到', `签到成功，获得 ${postPoints} 枫叶`)
      
      const newSignInfo = await getSignInfo(cookie)
      const result: CheckinResult = {
        success: true,
        message: `签到成功，获得 ${postPoints} 枫叶`,
        points: postPoints,
        continuousDay: newSignInfo?.continuous_day
      }
      await sendCheckinNotification(result, triggerType)
      return result
    } else {
      log.error('115签到', `签到失败: ${respResult.msg || JSON.stringify(respResult)}`)
      const result: CheckinResult = {
        success: false,
        error: respResult.msg || '签到失败'
      }
      await sendCheckinNotification(result, triggerType)
      return result
    }
  } catch (e: any) {
    log.error('115签到', `签到异常: ${e.message}`)
    const result: CheckinResult = { success: false, error: e.message }
    await sendCheckinNotification(result, triggerType)
    return result
  }
}
