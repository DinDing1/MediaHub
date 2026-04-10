/**
 * 115云盘回收站清理模块
 * 
 * API: POST https://webapi.115.com/rb/secret_del
 * 
 * 清理流程：
 * 1. 检查 Cookie 配置
 * 2. POST 请求清空回收站
 * 3. 发送通知到 Telegram 和微信
 * 
 * 注意：
 * - 需要在115设置中关闭"文件清空回收站需要安全密钥"选项
 * - 默认使用密码 000000
 */

import { getSetting } from '../db'
import { log } from '../logger'
import { sendNotification } from '../telegram/client'
import { sendWechatNotification } from '../wechat/client'
import { formatShanghaiDateTime } from '~/utils/time'

/** 清空回收站结果 */
interface CleanTrashResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * 发送清空回收站通知
 * 
 * @param result 清空结果
 * @param triggerType 触发类型
 */
async function sendCleanTrashNotification(result: CleanTrashResult, triggerType: 'manual' | 'scheduled' = 'manual'): Promise<void> {
  const now = new Date()
  const timeStr = formatShanghaiDateTime(now)
  
  const triggerText = triggerType === 'scheduled' ? '定时触发' : '手动触发'
  const statusIcon = result.success ? '✅' : '❌'
  const statusText = result.success ? '清空成功' : '清空失败'
  
  const lines: string[] = [
    `【${statusIcon} 115回收站${statusText}】`,
    '',
    '━━━━━━━━━━',
    `🕐 时间：${timeStr}`,
    `📍 方式：${triggerText}`,
    `✨ 状态：${result.success ? '回收站已清空' : result.error || '清空失败'}`,
    '━━━━━━━━━━'
  ]
  
  if (!result.success) {
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
 * 清空115回收站
 * 
 * @param triggerType 触发类型
 * @returns 清空结果
 */
export async function cleanTrash115(triggerType: 'manual' | 'scheduled' = 'manual'): Promise<CleanTrashResult> {
  const cookie = getSetting('pan115_cookie')
  
  if (!cookie) {
    log.error('清空回收站', '未配置Cookie')
    const result: CleanTrashResult = { success: false, error: '未配置115 Cookie' }
    await sendCleanTrashNotification(result, triggerType)
    return result
  }

  try {
    const response = await fetch('https://webapi.115.com/rb/secret_del', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookie,
        'Referer': 'https://115.com/'
      },
      body: 'password=000000'
    })

    const result = await response.json()
    
    if (result.state === true || result.errno === 0) {
      log.success('清空回收站', '回收站已清空')
      const cleanResult: CleanTrashResult = {
        success: true,
        message: '回收站已清空'
      }
      await sendCleanTrashNotification(cleanResult, triggerType)
      return cleanResult
    } else if (result.errno === 20003 || result.msg?.includes('安全密钥')) {
      log.error('清空回收站', '需要安全密钥')
      const cleanResult: CleanTrashResult = {
        success: false,
        error: '需要安全密钥，请在115设置中关闭"文件清空回收站需要安全密钥"选项'
      }
      await sendCleanTrashNotification(cleanResult, triggerType)
      return cleanResult
    } else {
      log.error('清空回收站', `清空失败: ${result.msg || JSON.stringify(result)}`)
      const cleanResult: CleanTrashResult = {
        success: false,
        error: result.msg || '清空失败'
      }
      await sendCleanTrashNotification(cleanResult, triggerType)
      return cleanResult
    }
  } catch (e: any) {
    log.error('清空回收站', `清空异常: ${e.message}`)
    const result: CleanTrashResult = { success: false, error: e.message }
    await sendCleanTrashNotification(result, triggerType)
    return result
  }
}
