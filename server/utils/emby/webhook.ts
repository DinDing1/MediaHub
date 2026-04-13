/**
 * Emby Webhook 处理模块
 *
 * 功能说明：
 * 1. 接收 Emby 服务器发送的 Webhook 事件
 * 2. 解析事件内容并格式化为通知消息
 * 3. 通过 Telegram 和微信发送通知
 * 4. 在启用追更模式时，将新增媒体写入媒体信息追更队列
 *
 * 支持的事件类型：
 * - library.new: 新增媒体
 * - library.deleted: 删除媒体
 * - playback.start: 开始播放
 * - playback.stop: 停止播放
 * - user.authenticated: 用户登录成功
 * - user.authenticationfailed: 用户登录失败
 * - system.notificationtest: 测试通知
 * 
 * Emby Webhook 数据格式：
 * - Content-Type: multipart/form-data
 * - JSON 数据位于 data 字段中
 * 
 * @module server/utils/emby/webhook
 */

import { log } from '../logger'
import { sendNotification } from '../telegram/client'
import { sendWechatNotification } from '../wechat/client'
import { join } from 'path'
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, statSync } from 'fs'
import { getSetting } from '../db'
import { enqueueMediaInfoFollowQueueItem, kickMediaInfoFollowQueue } from './media_info'
import { formatShanghaiDateTime } from '~/utils/time'

/**
 * Webhook 日志接口
 */
export interface WebhookLog {
  timestamp: string
  event: string
  data: any
  success: boolean
  processed: boolean
}

const MAX_LOGS = 100
let webhooksLogDir: string | null = null

/**
 * 获取 Webhook 日志目录路径
 * 参照 logger.ts 的路径加载逻辑，确保在飞牛应用中正确加载
 */
function getWebhooksLogDir(): string {
  if (!webhooksLogDir) {
    // 路径优先级：TRIM_PKGVAR > LOG_PATH > 当前工作目录
    webhooksLogDir = process.env.TRIM_PKGVAR 
      ? join(process.env.TRIM_PKGVAR, 'logs')
      : (process.env.LOG_PATH || join(process.cwd(), 'logs'))
    
    if (!existsSync(webhooksLogDir)) {
      mkdirSync(webhooksLogDir, { recursive: true })
    }
  }
  return webhooksLogDir
}

/**
 * 获取 Webhook 日志文件路径
 */
function getWebhooksLogPath(): string {
  return join(getWebhooksLogDir(), 'webhooks.log')
}

/**
 * 添加 Webhook 日志到文件
 * 
 * @param event - 事件类型
 * @param data - 事件数据
 * @param success - 是否成功
 */
function addWebhookLog(event: string, data: any, success: boolean): void {
  try {
    const timestamp = formatShanghaiDateTime(new Date())
    const logEntry = {
      timestamp,
      event,
      data,
      success,
      processed: true
    }
    
    const logLine = JSON.stringify(logEntry) + '\n'
    const logFile = getWebhooksLogPath()
    appendFileSync(logFile, logLine, 'utf-8')
    
    // 清理旧日志，只保留最近 100 条
    cleanOldLogs()
  } catch (e) {
    log.error('Emby Webhook', `写入日志文件失败: ${e}`)
  }
}

/**
 * 清理旧日志，只保留最近 MAX_LOGS 条
 */
function cleanOldLogs(): void {
  try {
    const logFile = getWebhooksLogPath()
    if (!existsSync(logFile)) return
    
    const stats = statSync(logFile)
    // 如果文件小于 1MB，不清理
    if (stats.size < 1024 * 1024) return
    
    const content = readFileSync(logFile, 'utf-8')
    const lines = content.trim().split('\n')
    
    if (lines.length > MAX_LOGS) {
      const recentLines = lines.slice(-MAX_LOGS)
      // 使用写入而不是追加，先删除再重新写入
      unlinkSync(logFile)
      recentLines.forEach(line => {
        appendFileSync(logFile, line + '\n', 'utf-8')
      })
    }
  } catch (e) {
    // 忽略清理错误
  }
}

/**
 * 获取 Webhook 日志
 * 
 * @returns 日志列表
 */
export function getWebhookLogs(): WebhookLog[] {
  try {
    const logFile = getWebhooksLogPath()
    if (!existsSync(logFile)) return []
    
    const content = readFileSync(logFile, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    
    // 倒序返回，最新的在前面
    const logs = lines.map(line => {
      try {
        return JSON.parse(line) as WebhookLog
      } catch {
        return null
      }
    }).filter(Boolean) as WebhookLog[]
    
    return logs.reverse()
  } catch (e) {
    return []
  }
}

/**
 * 清除 Webhook 日志
 */
export function clearWebhookLogs(): void {
  try {
    const logFile = getWebhooksLogPath()
    if (existsSync(logFile)) {
      unlinkSync(logFile)
    }
  } catch (e) {
    // 忽略清除错误
  }
}

/**
 * Emby Webhook 事件接口
 * 定义 Emby 发送的 Webhook 数据结构
 */
export interface EmbyWebhookEvent {
  Event?: string
  Title?: string
  Description?: string
  Date?: string
  User?: {
    Id: string
    Name: string
  }
  Item?: {
    Id: string
    Name: string
    Type: string
    ProductionYear?: number
    RunTimeTicks?: number
    SeriesName?: string
    SeasonName?: string
    IndexNumber?: number
    ParentIndexNumber?: number
    Overview?: string
    Size?: number
    CommunityRating?: number
    Width?: number
    Height?: number
    Container?: string
    IsFolder?: boolean
    Status?: string
    Genres?: string[]
    ProviderIds?: {
      Tmdb?: string
      Imdb?: string
    }
  }
  Server?: {
    Id: string
    Name: string
    Version: string
  }
  Session?: {
    DeviceName?: string
    Client?: string
    RemoteEndPoint?: string
  }
}

/**
 * 事件类型定义
 */
type EventType =
  | 'library.new'
  | 'library.deleted'
  | 'playback.start'
  | 'playback.stop'
  | 'user.authenticated'
  | 'user.authenticationfailed'
  | 'system.notificationtest'

/**
 * 事件配置
 * 定义每种事件类型的显示信息和是否发送通知
 */
interface EventConfig {
  icon: string
  title: string
  notify: boolean
}

/**
 * 事件类型配置表
 * 用于配置每种事件的图标、标题和是否启用通知
 */
const EVENT_CONFIGS: Record<EventType, EventConfig> = {
  'library.new': { icon: '📚', title: '新增媒体', notify: true },
  'library.deleted': { icon: '🗑️', title: '删除媒体', notify: true },
  'playback.start': { icon: '▶️', title: '开始播放', notify: true },
  'playback.stop': { icon: '⏹️', title: '停止播放', notify: true },
  'user.authenticated': { icon: '🔐', title: '用户登录', notify: true },
  'user.authenticationfailed': { icon: '🚫', title: '登录失败', notify: true },
  'system.notificationtest': { icon: '🔔', title: '测试通知', notify: true }
}

/**
 * 媒体类型中文映射表
 */
const ITEM_TYPE_LABELS: Record<string, string> = {
  Movie: '电影',
  Episode: '剧集',
  Series: '电视剧',
  Season: '季',
  Audio: '音频',
  MusicAlbum: '音乐专辑',
  MusicVideo: 'MV',
  Video: '视频',
  Folder: '文件夹',
  BoxSet: '合集'
}

/**
 * 事件名称规范化映射表
 * 将 Emby 发送的事件名称转换为内部标准格式
 */
const EVENT_NAME_MAPPING: Record<string, EventType> = {
  'library.new': 'library.new',
  'library.deleted': 'library.deleted',
  'playback.start': 'playback.start',
  'playback.stop': 'playback.stop',
  'user.authenticated': 'user.authenticated',
  'user.authenticationfailed': 'user.authenticationfailed',
  'system.notificationtest': 'system.notificationtest'
}

/**
 * 规范化事件类型
 * 将 Emby 发送的事件名称转换为内部标准格式
 * 
 * @param eventName - Emby 发送的原始事件名称
 * @returns 规范化后的事件类型，如果不在支持列表中则返回 null
 */
function normalizeEventType(eventName: string): EventType | null {
  if (!eventName) return null
  
  const normalized = eventName.toLowerCase().trim()
  return EVENT_NAME_MAPPING[normalized] || null
}

/**
 * 格式化时长
 * 将 Emby 的 Ticks（100纳秒为单位）转换为可读的时长格式
 * 
 * @param ticks - Emby 时长单位（1秒 = 10,000,000 ticks）
 * @returns 格式化后的时长字符串
 */
function formatDuration(ticks: number): string {
  const totalSeconds = Math.floor(ticks / 10000000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  }
  if (minutes > 0) {
    return `${minutes}分钟${seconds}秒`
  }
  return `${seconds}秒`
}

/**
 * 格式化文件大小
 * 将字节数转换为可读的大小格式
 * 
 * @param bytes - 文件大小（字节）
 * @returns 格式化后的大小字符串
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`
}

/**
 * 格式化分辨率
 * 根据宽高生成分辨率标签
 * 
 * @param width - 视频宽度
 * @param height - 视频高度
 * @returns 分辨率标签
 */
function formatResolution(width?: number, height?: number): string {
  if (!width || !height) return ''
  
  if (width >= 3800 || height >= 2100) return '4K'
  if (width >= 1900 || height >= 1000) return '1080p'
  if (width >= 1200 || height >= 700) return '720p'
  return `${width}x${height}`
}

/**
 * 解析 Emby Title 字段中的添加数量
 * Title 格式示例: "OES 上已添加了 12 项到 立功·东北旧事"
 * 
 * @param title - Emby 发送的 Title 字段
 * @returns 添加数量，解析失败返回 null
 */
function parseAddedCount(title: string): number | null {
  if (!title) return null
  
  const match = title.match(/已添加了\s*(\d+)\s*项/)
  if (match && match[1]) {
    return parseInt(match[1], 10)
  }
  return null
}

/**
 * 获取媒体类型中文名称
 * 
 * @param type - Emby 媒体类型
 * @returns 中文名称
 */
function getItemTypeLabel(type: string): string {
  return ITEM_TYPE_LABELS[type] || type
}

/**
 * 获取媒体显示名称
 * 优先显示：剧集名称 + 季集信息，否则显示电影名称 + 年份
 * 
 * @param item - 媒体项信息
 * @returns 格式化后的媒体名称
 */
function getItemDisplayName(item: EmbyWebhookEvent['Item']): string {
  if (!item) return '未知媒体'

  if (item.Type === 'Episode' && item.SeriesName) {
    const season = item.ParentIndexNumber || 1
    const episode = item.IndexNumber || 1
    return `${item.SeriesName} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
  }

  if (item.ProductionYear) {
    return `${item.Name} (${item.ProductionYear})`
  }

  return item.Name || '未知媒体'
}

function shouldEnqueueMediaInfoFollow(event: EmbyWebhookEvent, eventType: EventType): boolean {
  // 追更只处理 library.new，避免删除、播放等事件误触发媒体信息提取。
  // 电视剧入库时 Emby 常发送 Series 级别事件，因此这里需要放行 Series，
  // 后续由媒体信息追更模块再展开到全部 Episode 逐集处理。
  if (eventType !== 'library.new') {
    return false
  }

  if (getSetting('task_media_info_follow_enabled') !== 'true') {
    return false
  }

  const item = event.Item
  if (!item?.Id || !item?.Type) {
    return false
  }

  return item.Type === 'Movie' || item.Type === 'Episode' || item.Type === 'Video' || item.Type === 'Series'
}


/**
 * 将符合条件的 library.new 事件写入追更队列，并立即尝试启动消费者。
 * 入队去重由数据库层负责，这里只负责事件到队列的桥接。
 */
async function handleMediaInfoFollowEnqueue(event: EmbyWebhookEvent, eventType: EventType): Promise<void> {
  if (!shouldEnqueueMediaInfoFollow(event, eventType)) {
    return
  }

  const item = event.Item!
  const itemDisplayName = getItemDisplayName(item)
  const result = enqueueMediaInfoFollowQueueItem({
    itemId: item.Id,
    itemName: itemDisplayName,
    libraryName: itemDisplayName,
    itemType: item.Type,
    source: 'emby_webhook'
  })

  if (result.queued) {
    log.info('媒体信息追更', `已入队: ${item.Name || item.Id}`)
  }

  void kickMediaInfoFollowQueue().catch(error => {
    log.error('媒体信息追更', `启动追更队列失败: ${error?.message || error}`)
  })
}

/**
 * 构建通知消息
 * 根据事件类型构建不同格式的通知消息
 * 
 * @param event - Webhook 事件数据
 * @param eventType - 事件类型
 * @returns 格式化后的通知消息
 */
function buildNotificationMessage(event: EmbyWebhookEvent, eventType: EventType): string {
  const config = EVENT_CONFIGS[eventType]
  if (!config) return ''
  
  const lines: string[] = []
  
  lines.push(`${config.icon} <b>${config.title}</b>`)
  lines.push('')
  
  const serverInfo = event.Server?.Name || 'Emby Server'
  const serverVersion = event.Server?.Version || ''
  lines.push(`🖥️ 服务器：${serverInfo}${serverVersion ? ` (v${serverVersion})` : ''}`)
  
  if (eventType === 'system.notificationtest') {
    if (event.Title) lines.push(`📢 标题：${event.Title}`)
    if (event.Description) lines.push(`📝 描述：${event.Description}`)
    return lines.join('\n')
  }
  
  if (event.User) {
    lines.push(`👤 用户：${event.User.Name}`)
  }
  
  if (event.Item) {
    lines.push('')
    lines.push(`🎬 类型：${getItemTypeLabel(event.Item.Type)}`)
    lines.push(`📺 名称：${getItemDisplayName(event.Item)}`)
    
    const isSeriesFolder = event.Item.Type === 'Series' && event.Item.IsFolder
    const addedCount = parseAddedCount(event.Title || '')
    
    if (eventType === 'library.new') {
      if (isSeriesFolder && addedCount) {
        lines.push(`📊 新增：${addedCount} 集`)
      } else if (!isSeriesFolder) {
        if (event.Item.RunTimeTicks) {
          lines.push(`⏱️ 时长：${formatDuration(event.Item.RunTimeTicks)}`)
        }
        if (event.Item.Size) {
          lines.push(`📦 大小：${formatSize(event.Item.Size)}`)
        }
        const resolution = formatResolution(event.Item.Width, event.Item.Height)
        if (resolution) {
          lines.push(`📐 分辨率：${resolution}`)
        }
      }
    } else if (eventType === 'library.deleted') {
      if (!isSeriesFolder) {
        if (event.Item.RunTimeTicks) {
          lines.push(`⏱️ 时长：${formatDuration(event.Item.RunTimeTicks)}`)
        }
        if (event.Item.Size) {
          lines.push(`📦 大小：${formatSize(event.Item.Size)}`)
        }
        const resolution = formatResolution(event.Item.Width, event.Item.Height)
        if (resolution) {
          lines.push(`📐 分辨率：${resolution}`)
        }
      }
    }
    
    if (event.Item.CommunityRating) {
      lines.push(`⭐ 评分：${event.Item.CommunityRating.toFixed(1)}`)
    }
    
    if (event.Item.Genres && event.Item.Genres.length > 0) {
      lines.push(`🎭 分类：${event.Item.Genres.join(' / ')}`)
    }
    
    if (event.Item.Overview) {
      const overview = event.Item.Overview.length > 150 
        ? event.Item.Overview.substring(0, 150) + '...' 
        : event.Item.Overview
      lines.push(`📝 简介：${overview}`)
    }
  }
  
  if (event.Session) {
    const device = event.Session.DeviceName || '未知设备'
    const client = event.Session.Client || '未知客户端'
    lines.push(`📱 设备：${device} (${client})`)
    if (event.Session.RemoteEndPoint) {
      lines.push(`🌐 IP：${event.Session.RemoteEndPoint}`)
    }
  }
  
  return lines.join('\n')
}

/**
 * 处理 Emby Webhook 事件
 * 主入口函数，接收事件并发送通知
 * 
 * @param event - Emby Webhook 事件数据
 * @returns 处理结果
 */
export async function handleEmbyWebhook(event: EmbyWebhookEvent): Promise<{ success: boolean; error?: string }> {
  const rawEvent = event.Event || ''
  const eventType = normalizeEventType(rawEvent)
  
  if (!eventType) {
    log.warn('Emby Webhook', `不支持的事件类型: ${rawEvent}`)
    addWebhookLog(rawEvent, event, false)
    return { success: true }
  }
  
  const config = EVENT_CONFIGS[eventType]
  await handleMediaInfoFollowEnqueue(event, eventType)
  if (!config?.notify) {
    addWebhookLog(eventType, event, true)
    return { success: true }
  }
  
  const message = buildNotificationMessage(event, eventType)
  if (!message) {
    log.warn('Emby Webhook', '消息内容为空')
    addWebhookLog(eventType, event, false)
    return { success: true }
  }
  
  const results = await Promise.allSettled([
    sendNotification(message).catch(e => ({ success: false, error: e.message })),
    sendWechatNotification(message).catch(e => ({ success: false, error: e.message }))
  ])
  
  const telegramResult = results[0].status === 'fulfilled' ? results[0].value : { success: false, error: '异常' }
  const wechatResult = results[1].status === 'fulfilled' ? results[1].value : { success: false, error: '异常' }
  
  const itemName = event.Item?.Name || '未知'
  log.info('Emby Webhook', `${config.title}: ${itemName} | Telegram: ${telegramResult.success ? '成功' : '失败'} | 微信: ${wechatResult.success ? '成功' : '失败'}`)
  
  const success = telegramResult.success || wechatResult.success
  addWebhookLog(eventType, event, success)
  
  if (!success) {
    const errors = [telegramResult.error, wechatResult.error].filter(Boolean).join(', ')
    return { success: false, error: errors || '通知发送失败' }
  }
  
  return { success: true }
}
