/**
 * 飞牛论坛签到模块
 * 
 * 功能：
 * - 自动完成飞牛论坛每日签到
 * - 获取签到后的积分信息（飞牛币、牛值、积分、登录天数）
 * - 签到完成后自动发送通知
 */

import { getSetting } from '../db'
import { log } from '../logger'
import { sendNotification } from '../telegram/client'
import { sendWechatNotification } from '../wechat/client'
import { formatShanghaiDateTime } from '~/utils/time'

const FNOS_BASE_URL = 'https://club.fnnas.com'
const SIGN_PAGE_URL = `${FNOS_BASE_URL}/plugin.php?id=zqlj_sign`
const CREDIT_INFO_URL = `${FNOS_BASE_URL}/home.php?mod=spacecp&ac=credit`

interface SignResult {
  success: boolean
  message: string
  fnb?: number
  nz?: number
  credit?: number
  loginDays?: number
}

interface CreditInfo {
  fnb: number
  nz: number
  jf: number
  ts: number
}

function getDefaultHeaders(): Record<string, string> {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.95 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Connection': 'keep-alive',
    'Referer': FNOS_BASE_URL,
    'DNT': '1'
  }
}

function parseCookies(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  for (const item of cookieString.split(';')) {
    const trimmed = item.trim()
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex > 0) {
      const name = trimmed.substring(0, eqIndex)
      const value = trimmed.substring(eqIndex + 1)
      cookies[name] = value
    }
  }
  return cookies
}

function validateCookies(cookies: Record<string, string>): { valid: boolean; missing: string[] } {
  const required = ['pvRK_2132_saltkey', 'pvRK_2132_auth']
  const missing = required.filter(key => !cookies[key])
  return { valid: missing.length === 0, missing }
}

async function checkCookieValid(cookie: string): Promise<boolean> {
  try {
    const response = await fetch(FNOS_BASE_URL, {
      method: 'GET',
      headers: {
        ...getDefaultHeaders(),
        'Cookie': cookie
      }
    })

    if (!response.ok) return false

    const html = await response.text()
    return html.includes('我的中心') || html.includes('退出') || !html.includes('请先登录')
  } catch {
    return false
  }
}

async function getCreditInfo(cookie: string): Promise<CreditInfo | null> {
  try {
    const response = await fetch(CREDIT_INFO_URL, {
      method: 'GET',
      headers: {
        ...getDefaultHeaders(),
        'Cookie': cookie
      }
    })

    if (!response.ok) return null

    const html = await response.text()
    
    const fnbMatch = html.match(/飞牛币[：:]\s*<\/em>\s*(\d+)/)
    const nzMatch = html.match(/牛值[：:]\s*<\/em>\s*(\d+)/)
    const jfMatch = html.match(/积分[：:]\s*<\/em>\s*(\d+)/)
    const tsMatch = html.match(/登陆天数[：:]\s*<\/em>\s*(\d+)/)
    
    const parseValue = (match: RegExpMatchArray | null): number => {
      if (!match || !match[1]) return 0
      const value = match[1].trim().replace(/,/g, '')
      return parseInt(value, 10) || 0
    }

    return {
      fnb: parseValue(fnbMatch),
      nz: parseValue(nzMatch),
      jf: parseValue(jfMatch),
      ts: parseValue(tsMatch)
    }
  } catch (e) {
    log.error('飞牛签到', `获取积分信息失败: ${e}`)
    return null
  }
}

function sendSignNotification(result: SignResult, triggerType: 'manual' | 'scheduled' = 'manual'): void {
  const statusIcon = result.success ? '✅' : '❌'
  const statusText = result.success ? '签到成功' : '签到失败'
  const now = new Date()
  const timeStr = formatShanghaiDateTime(now)
  
  const triggerText = triggerType === 'scheduled' ? '定时触发' : '手动触发'
  
  const lines: string[] = [
    `【${statusIcon} 飞牛论坛${statusText}】`,
    '',
    '━━━━━━━━━━',
    `🕐 时间：${timeStr}`,
    `📍 方式：${triggerText}`,
    `✨ 状态：${result.message}`,
    '━━━━━━━━━━'
  ]
  
  if (result.success && result.fnb !== undefined) {
    lines.push('📊 积分统计')
    lines.push(`💎 飞牛币：${result.fnb}`)
    lines.push(`🔥 牛  值：${result.nz}`)
    lines.push(`✨ 积  分：${result.credit}`)
    lines.push(`📆 登录天数：${result.loginDays}`)
    lines.push('━━━━━━━━━━')
  }
  
  const message = lines.join('\n')
  
  sendNotification(message).catch(e => log.error('Telegram通知', e.message || e))
  sendWechatNotification(message).catch(e => log.error('微信通知', e.message || e))
}

export async function fnosSign(triggerType: 'manual' | 'scheduled' = 'manual'): Promise<SignResult> {
  const cookie = getSetting('fnos_cookie')
  
  if (!cookie) {
    log.error('飞牛签到', '未配置Cookie')
    const result: SignResult = { success: false, message: '未配置Cookie' }
    sendSignNotification(result, triggerType)
    return result
  }
  
  const cookies = parseCookies(cookie)
  const { valid, missing } = validateCookies(cookies)
  
  if (!valid) {
    log.error('飞牛签到', `Cookie缺少必要值: ${missing.join(', ')}`)
    const result: SignResult = { success: false, message: `Cookie缺少必要值: ${missing.join(', ')}` }
    sendSignNotification(result, triggerType)
    return result
  }
  
  const cookieValid = await checkCookieValid(cookie)
  if (!cookieValid) {
    log.error('飞牛签到', 'Cookie无效或已过期')
    const result: SignResult = { success: false, message: 'Cookie无效或已过期' }
    sendSignNotification(result, triggerType)
    return result
  }
  
  try {
    const signPageResponse = await fetch(SIGN_PAGE_URL, {
      method: 'GET',
      headers: {
        ...getDefaultHeaders(),
        'Cookie': cookie
      }
    })
    
    if (!signPageResponse.ok) {
      log.error('飞牛签到', `访问签到页面失败: ${signPageResponse.status}`)
      const result: SignResult = { success: false, message: `访问签到页面失败: ${signPageResponse.status}` }
      sendSignNotification(result, triggerType)
      return result
    }
    
    const htmlContent = await signPageResponse.text()
    
    if (htmlContent.includes('您今天已经打过卡了')) {
      log.info('飞牛签到', '今日已签到')
      
      const creditInfo = await getCreditInfo(cookie)
      const result: SignResult = {
        success: true,
        message: '今日已签到',
        fnb: creditInfo?.fnb,
        nz: creditInfo?.nz,
        credit: creditInfo?.jf,
        loginDays: creditInfo?.ts
      }
      
      sendSignNotification(result, triggerType)
      return result
    }
    
    const signMatch = htmlContent.match(/sign&sign=([^"]+)"\s*class="btna/)
    if (!signMatch) {
      log.error('飞牛签到', '未找到签到参数')
      const result: SignResult = { success: false, message: '未找到签到参数' }
      sendSignNotification(result, triggerType)
      return result
    }
    
    const signParam = signMatch[1]
    log.info('飞牛签到', '找到签到按钮，正在执行签到...')
    
    const signUrl = `${FNOS_BASE_URL}/plugin.php?id=zqlj_sign&sign=${signParam}`
    const signResponse = await fetch(signUrl, {
      method: 'GET',
      headers: {
        ...getDefaultHeaders(),
        'Cookie': cookie,
        'Referer': SIGN_PAGE_URL
      }
    })
    
    if (!signResponse.ok) {
      log.error('飞牛签到', `签到请求失败: ${signResponse.status}`)
      const result: SignResult = { success: false, message: `签到请求失败: ${signResponse.status}` }
      sendSignNotification(result, triggerType)
      return result
    }
    
    const signResultHtml = await signResponse.text()
    
    if (signResultHtml.includes('恭喜您，打卡成功') || signResultHtml.includes('打卡成功')) {
      log.success('飞牛签到', '签到成功')
      
      const creditInfo = await getCreditInfo(cookie)
      const result: SignResult = {
        success: true,
        message: '签到成功',
        fnb: creditInfo?.fnb,
        nz: creditInfo?.nz,
        credit: creditInfo?.jf,
        loginDays: creditInfo?.ts
      }
      
      sendSignNotification(result, triggerType)
      return result
    }
    
    if (signResultHtml.includes('您今天已经打过卡了')) {
      log.info('飞牛签到', '今日已签到')
      
      const creditInfo = await getCreditInfo(cookie)
      const result: SignResult = {
        success: true,
        message: '今日已签到',
        fnb: creditInfo?.fnb,
        nz: creditInfo?.nz,
        credit: creditInfo?.jf,
        loginDays: creditInfo?.ts
      }
      
      sendSignNotification(result, triggerType)
      return result
    }
    
    log.error('飞牛签到', '签到结果未知')
    const result: SignResult = { success: false, message: '签到结果未知' }
    sendSignNotification(result, triggerType)
    return result
    
  } catch (e: any) {
    log.error('飞牛签到', `签到异常: ${e.message}`)
    const result: SignResult = { success: false, message: `签到异常: ${e.message}` }
    sendSignNotification(result, triggerType)
    return result
  }
}
