/**
 * Emby 媒体信息提取工具
 *
 * 功能说明：
 * 1. 扫描电影库与剧集库中的可播放媒体项
 * 2. 检查媒体项是否已有 MediaStreams
 * 3. 对缺失媒体信息的条目调用 PlaybackInfo，触发 Emby 自行分析
 * 4. 维护批量提取状态与追更队列状态
 *
 * 说明：
 * - 支持手动批量提取、定时批量提取、Webhook 追更与状态查看
 * - 追更模式使用 SQLite 持久化队列，避免新媒体同时入库时丢失处理
 * - 批量提取与追更队列共用统一线程配置
 *
 * @module server/utils/emby/media_info
 */

import { embyRequest, getLibraries } from './emby'
import { log } from '../logger'
import { sendNotification } from '../telegram/client'
import { sendWechatNotification } from '../wechat/client'
import { getSetting, enqueueMediaInfoFollowItem, claimPendingMediaInfoFollowQueueItems, finalizeMediaInfoFollowQueueItem, failMediaInfoFollowQueueItem, getMediaInfoFollowQueueStats, getOldestPendingMediaInfoFollowQueueItem, resetProcessingMediaInfoFollowQueueItems, setSetting, type MediaInfoFollowQueueRecord } from '../db'
import { formatShanghaiDateTime, parseUtcLikeTime } from '~/utils/time'

const FOLLOW_ENABLED_SETTING_KEY = 'task_media_info_follow_enabled'
const FOLLOW_LAST_RUN_SETTING_KEY = 'task_media_info_follow_last_run'

/**
 * 当前媒体信息提取模式。
 * 目前仅支持“仅提缺失”，保留该类型是为了让状态与通知语义更清晰。
 */
export type MediaInfoMode = 'missing'

/**
 * 前端可选的媒体库项。
 * 只返回当前模块支持处理的电影库和剧集库。
 */
export interface MediaInfoLibraryOption {
  id: string
  name: string
  type: string
  typeLabel: string
}

/**
 * 批量提取任务对前端暴露的完整状态。
 */
export interface MediaInfoTaskStatus {
  running: boolean
  phase: 'idle' | 'scanning' | 'extracting' | 'completed' | 'failed'
  mode: MediaInfoMode
  triggerType: 'manual' | 'scheduled'
  concurrency: number
  selectedLibraryId: string
  libraryName: string
  message: string
  total: number
  scanned: number
  existing: number
  extracted: number
  failed: number
  pending: number
  currentItemName: string
  currentLibraryName: string
  startedAt: string | null
  finishedAt: string | null
  lastUpdatedAt: string | null
}

/**
 * 单次媒体信息任务的通用返回结构。
 */
export interface MediaInfoTaskRunResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * 读取已保存默认配置后执行任务时，附带回传实际使用的配置。
 */
export interface MediaInfoConfiguredTaskResult extends MediaInfoTaskRunResult {
  libraryId?: string
  concurrency?: number
}

/**
 * 追更队列对前端暴露的运行状态。
 */
export interface MediaInfoFollowTaskStatus {
  enabled: boolean
  running: boolean
  concurrency: number
  message: string
  pending: number
  processing: number
  failed: number
  currentItemName: string
  currentLibraryName: string
  lastRunAt: string | null
  lastUpdatedAt: string | null
}

interface MediaInfoExtractionResult {
  action: 'existing' | 'extracted'
}

interface MediaInfoExtractionOptions {
  verifyMediaStreams?: boolean
}

interface MediaInfoFollowSeriesSummary {
  total: number
  existing: number
  extracted: number
  failed: number
}

interface EmbyUser {
  Id: string
}

interface EmbyItemListResponse<T = any> {
  Items?: T[]
}

interface EmbyMovieItem {
  Id: string
  Name: string
}

interface EmbySeriesItem {
  Id: string
  Name: string
}

interface EmbyEpisodeItem {
  Id: string
  Name: string
  ParentIndexNumber?: number
  IndexNumber?: number
}

interface EmbyItemDetail {
  MediaStreams?: Array<Record<string, any>>
}

interface MediaInfoTargetItem {
  id: string
  name: string
  libraryName: string
}


const DEFAULT_CONCURRENCY = 1
const MAX_CONCURRENCY = 10
const DEFAULT_LIBRARY_ID = 'all'
const FOLLOW_RETRY_DELAY_MS = 1500
const FOLLOW_EPISODE_DISCOVERY_RETRIES = 6
const FOLLOW_MEDIA_STREAM_VERIFY_RETRIES = 6
const FOLLOW_QUEUE_DELAY_MS = 30000

/**
 * 批量提取任务的内存态运行状态。
 * 仅用于当前进程内前端轮询展示，不做数据库持久化。
 */
const taskStatus: MediaInfoTaskStatus = {
  running: false,
  phase: 'idle',
  mode: 'missing',
  triggerType: 'manual',
  concurrency: DEFAULT_CONCURRENCY,
  selectedLibraryId: DEFAULT_LIBRARY_ID,
  libraryName: '',
  message: '等待开始',
  total: 0,
  scanned: 0,
  existing: 0,
  extracted: 0,
  failed: 0,
  pending: 0,
  currentItemName: '',
  currentLibraryName: '',
  startedAt: null,
  finishedAt: null,
  lastUpdatedAt: null
}

/**
 * 追更队列的内存态状态。
 * 队列本体持久化在数据库中，这里只维护前端展示所需的运行快照。
 */
const followTaskStatus: MediaInfoFollowTaskStatus = {
  enabled: false,
  running: false,
  concurrency: DEFAULT_CONCURRENCY,
  message: '等待新媒体入队',
  pending: 0,
  processing: 0,
  failed: 0,
  currentItemName: '',
  currentLibraryName: '',
  lastRunAt: null,
  lastUpdatedAt: null
}

let currentTaskId = 0
let followQueueRunning = false
let followQueueInitialized = false

/**
 * 统一约束线程数范围，避免前端与数据库中的非法值影响执行。
 */
function normalizeConcurrency(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_CONCURRENCY
  }

  const integer = Math.floor(value as number)
  return Math.min(Math.max(integer, 1), MAX_CONCURRENCY)
}

/**
 * 刷新批量提取任务的派生状态字段。
 */
function touchStatus(): void {
  taskStatus.pending = Math.max(taskStatus.total - taskStatus.scanned, 0)
  taskStatus.lastUpdatedAt = new Date().toISOString()
}

/**
 * 刷新追更运行快照的最后更新时间。
 */
function touchFollowStatus(): void {
  followTaskStatus.lastUpdatedAt = new Date().toISOString()
}

/**
 * 从数据库与运行态重新汇总追更状态。
 * 注意：追更并发不单独配置，始终复用批量提取的统一线程数。
 */
function refreshFollowQueueStats(): void {
  const stats = getMediaInfoFollowQueueStats()
  followTaskStatus.pending = stats.pending
  followTaskStatus.processing = stats.processing
  followTaskStatus.failed = stats.failed
  followTaskStatus.enabled = getSetting(FOLLOW_ENABLED_SETTING_KEY) === 'true'
  followTaskStatus.concurrency = getConfiguredMediaInfoTaskOptions().concurrency
  followTaskStatus.lastRunAt = getSetting(FOLLOW_LAST_RUN_SETTING_KEY)
  touchFollowStatus()
}

function resetFollowCurrentItem(): void {
  followTaskStatus.currentItemName = ''
  followTaskStatus.currentLibraryName = ''
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getFollowQueueReadyBefore(): string {
  return new Date(Date.now() - FOLLOW_QUEUE_DELAY_MS).toISOString().slice(0, 19).replace('T', ' ')
}

function getFollowQueueDelayRemainingMs(createdAt: string): number {
  const createdDate = parseUtcLikeTime(createdAt)
  if (!createdDate) {
    return 0
  }

  return Math.max(FOLLOW_QUEUE_DELAY_MS - (Date.now() - createdDate.getTime()), 0)
}

async function waitForMediaStreams(itemId: string, userId: string, retries: number): Promise<boolean> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const detail = await getItemDetail(userId, itemId)
    if (hasMediaStreams(detail)) {
      return true
    }

    if (attempt < retries - 1) {
      await sleep(FOLLOW_RETRY_DELAY_MS)
    }
  }

  return false
}

async function listEpisodesForFollow(seriesId: string, seriesName: string): Promise<MediaInfoTargetItem[]> {
  let lastError: any = null

  for (let attempt = 0; attempt < FOLLOW_EPISODE_DISCOVERY_RETRIES; attempt += 1) {
    try {
      const episodes = await listEpisodes(seriesId, seriesName)
      if (episodes.length > 0) {
        return episodes
      }

      lastError = new Error('未找到可处理分集')
    } catch (error: any) {
      lastError = error
    }

    if (attempt < FOLLOW_EPISODE_DISCOVERY_RETRIES - 1) {
      log.info('媒体信息追更', `${seriesName} 暂未发现分集，等待重试 (${attempt + 1}/${FOLLOW_EPISODE_DISCOVERY_RETRIES})`)
      await sleep(FOLLOW_RETRY_DELAY_MS)
    }
  }

  throw lastError || new Error('未找到可处理分集')
}

/**
 * 对单个媒体项执行“仅提缺失”逻辑。
 * 若已存在 MediaStreams 则直接跳过，否则触发 PlaybackInfo。
 * userId 可由批量或剧集追更场景复用，避免逐集重复获取用户信息。
 */
async function extractMediaInfoForItem(
  item: { id: string; name: string; libraryName?: string },
  userId?: string,
  options: MediaInfoExtractionOptions = {}
): Promise<MediaInfoExtractionResult> {
  const resolvedUserId = userId || await getMediaInfoUserId()
  const detail = await getItemDetail(resolvedUserId, item.id)
  if (hasMediaStreams(detail)) {
    return { action: 'existing' }
  }

  // 这里不直接写入媒体流信息，而是通过 PlaybackInfo 触发 Emby 自行分析媒体源。
  const success = await triggerPlaybackInfo(item.id, resolvedUserId)
  if (!success) {
    throw new Error('触发 PlaybackInfo 失败')
  }

  if (options.verifyMediaStreams) {
    const verified = await waitForMediaStreams(item.id, resolvedUserId, FOLLOW_MEDIA_STREAM_VERIFY_RETRIES)
    if (!verified) {
      throw new Error('触发 PlaybackInfo 后未检测到媒体流信息')
    }
  }

  return { action: 'extracted' }
}


/**
 * 处理整部电视剧的追更记录。
 * Webhook 对 Series 只会给到剧级别条目，这里负责展开到全部 Episode 并逐集提取，
 * 但最终只返回一份整剧汇总结果，供后续发送单条电视剧通知。
 */
async function processSeriesFollowQueueRecord(record: MediaInfoFollowQueueRecord, concurrency: number): Promise<MediaInfoFollowSeriesSummary> {
  const episodes = await listEpisodesForFollow(record.item_id, record.item_name)
  const userId = await getMediaInfoUserId()
  const summary: MediaInfoFollowSeriesSummary = {
    total: episodes.length,
    existing: 0,
    extracted: 0,
    failed: 0
  }

  await runWithConcurrency(episodes, async (episode) => {
    followTaskStatus.currentItemName = episode.name
    followTaskStatus.message = `正在处理：${episode.name}`
    touchFollowStatus()

    try {
      const result = await extractMediaInfoForItem({
        id: episode.id,
        name: episode.name,
        libraryName: record.item_name
      }, userId, {
        verifyMediaStreams: true
      })

      if (result.action === 'existing') {
        summary.existing += 1
      } else {
        summary.extracted += 1
      }
    } catch (error: any) {
      summary.failed += 1
      log.warn('媒体信息追更', `${episode.name} 处理失败: ${error?.message || error}`)
    }
  }, concurrency)

  return summary
}


/**
 * 处理单条追更队列记录。
 * 电影、单集按单条处理；电视剧会展开到全部分集执行，但通知按整部剧汇总发送。
 */
async function processFollowQueueRecord(record: MediaInfoFollowQueueRecord): Promise<void> {
  followTaskStatus.currentItemName = record.item_name
  followTaskStatus.currentLibraryName = record.library_name || ''
  followTaskStatus.message = `正在处理：${record.item_name}`
  touchFollowStatus()

  try {
    if (record.item_type === 'Series') {
      const summary = await processSeriesFollowQueueRecord(record, getConfiguredMediaInfoFollowOptions().concurrency)
      if (summary.failed > 0 && summary.extracted === 0 && summary.existing === 0) {
        throw new Error(`分集处理失败 ${summary.failed} 集`)
      }

      finalizeMediaInfoFollowQueueItem(record.id)
      const finishedAt = new Date().toISOString()
      setSetting(FOLLOW_LAST_RUN_SETTING_KEY, finishedAt)
      followTaskStatus.lastRunAt = finishedAt
      followTaskStatus.message = `处理完成：${record.item_name}（共 ${summary.total} 集，新增 ${summary.extracted} 集）`
      await sendMediaInfoFollowSeriesCompletionNotification(record, summary, finishedAt)
      return
    }

    const result = await extractMediaInfoForItem({
      id: record.item_id,
      name: record.item_name,
      libraryName: record.library_name || ''
    }, undefined, {
      verifyMediaStreams: true
    })
    finalizeMediaInfoFollowQueueItem(record.id)
    const finishedAt = new Date().toISOString()
    setSetting(FOLLOW_LAST_RUN_SETTING_KEY, finishedAt)
    followTaskStatus.lastRunAt = finishedAt
    followTaskStatus.message = result.action === 'existing'
      ? `已跳过已有媒体信息：${record.item_name}`
      : `处理完成：${record.item_name}`
    await sendMediaInfoFollowCompletionNotification(record, result, finishedAt)
  } catch (error: any) {
    const reason = error?.message || '提取失败'
    failMediaInfoFollowQueueItem(record.id, reason)
    followTaskStatus.message = `处理失败：${record.item_name}`
    log.warn('媒体信息追更', `${record.item_name} 处理失败: ${reason}`)
  } finally {
    resetFollowCurrentItem()
    refreshFollowQueueStats()
  }
}

/**
 * 对外暴露追更运行快照。
 * 每次读取前先根据数据库中的真实队列状态刷新统计信息。
 */
export function getMediaInfoFollowTaskStatus(): MediaInfoFollowTaskStatus {
  refreshFollowQueueStats()
  return {
    ...followTaskStatus
  }
}

/**
 * 读取追更相关配置。
 * 追更只保留独立开关，并复用批量提取线程数作为消费者并发。
 */
export function getConfiguredMediaInfoFollowOptions(): { enabled: boolean; concurrency: number } {
  return {
    enabled: getSetting(FOLLOW_ENABLED_SETTING_KEY) === 'true',
    concurrency: getConfiguredMediaInfoTaskOptions().concurrency
  }
}

/**
 * 启动追更队列消费。
 * 默认仅在追更开关开启时运行，force 可用于服务启动后的恢复处理。
 */
export async function kickMediaInfoFollowQueue(force: boolean = false): Promise<void> {
  const { enabled, concurrency } = getConfiguredMediaInfoFollowOptions()
  if (!enabled && !force) {
    refreshFollowQueueStats()
    return
  }

  // 同一进程内只允许一个追更消费者运行，避免重复 claim 同一批记录。
  if (followQueueRunning) {
    refreshFollowQueueStats()
    return
  }

  followQueueRunning = true
  followTaskStatus.running = true
  followTaskStatus.enabled = enabled
  followTaskStatus.concurrency = concurrency
  followTaskStatus.message = '正在消费追更队列'
  touchFollowStatus()
  refreshFollowQueueStats()

  try {
    while (true) {
      const records = claimPendingMediaInfoFollowQueueItems(concurrency, getFollowQueueReadyBefore())
      if (records.length === 0) {
        const oldestPending = getOldestPendingMediaInfoFollowQueueItem()
        if (!oldestPending) {
          break
        }

        const waitMs = getFollowQueueDelayRemainingMs(oldestPending.created_at)
        if (waitMs <= 0) {
          continue
        }

        followTaskStatus.message = `等待入库稳定（${Math.ceil(waitMs / 1000)} 秒）`
        touchFollowStatus()
        await sleep(waitMs)
        refreshFollowQueueStats()
        continue
      }

      refreshFollowQueueStats()
      await runWithConcurrency(records, async (record) => {
        await processFollowQueueRecord(record)
      }, concurrency)
    }

    refreshFollowQueueStats()
    followTaskStatus.message = followTaskStatus.pending > 0 ? '等待继续处理队列' : '等待新媒体入队'
  } catch (error: any) {
    followTaskStatus.message = error?.message || '追更队列处理失败'
    touchFollowStatus()
    log.error('媒体信息追更', `队列消费失败: ${error?.message || error}`)
  } finally {
    followQueueRunning = false
    followTaskStatus.running = false
    resetFollowCurrentItem()
    refreshFollowQueueStats()
  }
}

/**
 * 初始化追更队列运行环境。
 * 服务启动时会重置遗留的 processing 记录，并尝试恢复消费。
 */
export async function initMediaInfoFollowQueue(): Promise<void> {
  if (followQueueInitialized) {
    refreshFollowQueueStats()
    return
  }

  followQueueInitialized = true
  // 服务重启后，上一轮遗留的 processing 记录需要回退为 pending，避免队列卡死。
  const resetCount = resetProcessingMediaInfoFollowQueueItems()
  if (resetCount > 0) {
    log.info('媒体信息追更', `已重置 ${resetCount} 条处理中队列项`)
  }

  refreshFollowQueueStats()
  await kickMediaInfoFollowQueue(true)
}

/**
 * 将媒体项写入追更持久化队列。
 * 是否去重由数据库层决定；这里仅负责入队后同步刷新内存态统计。
 */
export function enqueueMediaInfoFollowQueueItem(input: { itemId: string; itemName?: string; libraryName?: string; itemType?: string; source?: string }): { queued: boolean; recordId?: number } {
  const result = enqueueMediaInfoFollowItem({
    ...input,
    itemName: input.itemName || input.itemId
  })
  refreshFollowQueueStats()
  return result
}

/**
 * 重置批量提取任务状态，为新一轮执行做准备。
 */
function resetTaskStatus(
  libraryId: string,
  libraryName: string,
  mode: MediaInfoMode,
  concurrency: number,
  triggerType: 'manual' | 'scheduled'
): void {
  taskStatus.running = true
  taskStatus.phase = 'scanning'
  taskStatus.mode = mode
  taskStatus.triggerType = triggerType
  taskStatus.concurrency = concurrency
  taskStatus.selectedLibraryId = libraryId
  taskStatus.libraryName = libraryName
  taskStatus.message = '正在扫描媒体库...'
  taskStatus.total = 0
  taskStatus.scanned = 0
  taskStatus.existing = 0
  taskStatus.extracted = 0
  taskStatus.failed = 0
  taskStatus.pending = 0
  taskStatus.currentItemName = ''
  taskStatus.currentLibraryName = ''
  taskStatus.startedAt = new Date().toISOString()
  taskStatus.finishedAt = null
  touchStatus()
}

/**
 * 将批量提取任务标记为完成。
 */
function markTaskCompleted(message: string): void {
  taskStatus.running = false
  taskStatus.phase = 'completed'
  taskStatus.message = message
  taskStatus.currentItemName = ''
  taskStatus.currentLibraryName = ''
  taskStatus.finishedAt = new Date().toISOString()
  touchStatus()
}

/**
 * 将批量提取任务标记为失败。
 */
function markTaskFailed(message: string): void {
  taskStatus.running = false
  taskStatus.phase = 'failed'
  taskStatus.message = message
  taskStatus.currentItemName = ''
  taskStatus.currentLibraryName = ''
  taskStatus.finishedAt = new Date().toISOString()
  touchStatus()
}

function formatNotificationTime(value: string | null): string {
  return formatShanghaiDateTime(value) || (value || '—')
}

function getModeLabel(_mode: MediaInfoMode): string {
  return '仅提缺失'
}

/**
 * 构建媒体信息任务完成通知内容。
 * 成功与失败共用同一模板，失败仅体现数量，不展开逐项明细。
 */
function buildMediaInfoCompletionMessage(): string {
  const success = taskStatus.phase !== 'failed'
  const statusIcon = success ? '✅' : '❌'
  const statusText = success ? '任务完成' : '任务失败'
  const triggerText = taskStatus.triggerType === 'scheduled' ? '定时触发' : '手动触发'

  const lines: string[] = [
    `【${statusIcon} 媒体信息提取${statusText}】`,
    '',
    '━━━━━━━━━━',
    `🕐 时间：${formatNotificationTime(taskStatus.finishedAt || taskStatus.lastUpdatedAt || taskStatus.startedAt)}`,
    `📍 方式：${triggerText}`,
    `🎬 媒体库：${taskStatus.libraryName || '全部媒体库'}`,
    `⚙️ 模式：${getModeLabel(taskStatus.mode)} / ${taskStatus.concurrency} 线程`,
    `✨ 状态：${taskStatus.message}`,
    '━━━━━━━━━━',
    `📊 总数：${taskStatus.total}`,
    `✅ 成功提取：${taskStatus.extracted}`,
    `📁 已有信息：${taskStatus.existing}`,
    `❌ 失败数量：${taskStatus.failed}`
  ]

  return lines.join('\n')
}

function getMediaInfoFollowItemTypeLabel(itemType: string | null | undefined): string {
  switch (itemType) {
    case 'Movie':
      return '电影'
    case 'Episode':
      return '单集'
    case 'Series':
      return '电视剧'
    case 'Season':
      return '季'
    case 'Video':
      return '视频'
    default:
      return itemType || '未知类型'
  }
}

function buildMediaInfoFollowCompletionMessage(record: MediaInfoFollowQueueRecord, result: MediaInfoExtractionResult, finishedAt: string): string {
  const completed = result.action === 'extracted'
  const statusIcon = completed ? '✅' : 'ℹ️'
  const statusText = completed ? '已完成提取' : '已有媒体信息，已跳过'

  const lines: string[] = [
    `【${statusIcon} 媒体信息追更完成】`,
    '',
    '━━━━━━━━━━',
    `🎬 媒体：${record.item_name}`,
    `🎞️ 类型：${getMediaInfoFollowItemTypeLabel(record.item_type)}`,
    `✨ 结果：${statusText}`,
    `🕐 时间：${formatNotificationTime(finishedAt)}`
  ]

  return lines.join('\n')
}

function buildMediaInfoFollowSeriesCompletionMessage(record: MediaInfoFollowQueueRecord, summary: MediaInfoFollowSeriesSummary, finishedAt: string): string {
  const success = summary.failed === 0
  const statusIcon = success ? '✅' : '⚠️'
  const statusText = success ? '电视剧追更完成' : '电视剧追更完成（部分分集失败）'

  const lines: string[] = [
    `【${statusIcon} ${statusText}】`,
    '',
    '━━━━━━━━━━',
    `🎬 剧名：${record.item_name}`,
    `📺 总集数：${summary.total}`,
    `✅ 新提取：${summary.extracted}`,
    `📁 已有信息：${summary.existing}`,
    `❌ 失败数量：${summary.failed}`,
    `🕐 时间：${formatNotificationTime(finishedAt)}`
  ]

  return lines.join('\n')
}

async function sendMediaInfoFollowCompletionNotification(record: MediaInfoFollowQueueRecord, result: MediaInfoExtractionResult, finishedAt: string): Promise<void> {
  const message = buildMediaInfoFollowCompletionMessage(record, result, finishedAt)

  await Promise.all([
    sendNotification(message).catch(error => log.error('Telegram通知', error?.message || error)),
    sendWechatNotification(message).catch(error => log.error('微信通知', error?.message || error))
  ])
}

async function sendMediaInfoFollowSeriesCompletionNotification(record: MediaInfoFollowQueueRecord, summary: MediaInfoFollowSeriesSummary, finishedAt: string): Promise<void> {
  const message = buildMediaInfoFollowSeriesCompletionMessage(record, summary, finishedAt)

  await Promise.all([
    sendNotification(message).catch(error => log.error('Telegram通知', error?.message || error)),
    sendWechatNotification(message).catch(error => log.error('微信通知', error?.message || error))
  ])
}

/**
 * 向 Telegram 与微信发送统一的媒体信息完成通知。
 */
async function sendMediaInfoCompletionNotification(): Promise<void> {
  const message = buildMediaInfoCompletionMessage()

  await Promise.all([
    sendNotification(message).catch(error => log.error('Telegram通知', error?.message || error)),
    sendWechatNotification(message).catch(error => log.error('微信通知', error?.message || error))
  ])
}

/**
 * 获取当前 Emby 首个用户 ID。
 * 当前 PlaybackInfo 调用依赖 UserId，因此这里统一从 /Users 读取。
 */
async function getMediaInfoUserId(): Promise<string> {
  const users = await embyRequest<EmbyUser[]>('/Users')
  if (!Array.isArray(users) || users.length === 0 || !users[0]?.Id) {
    throw new Error('无法获取 Emby 用户信息')
  }
  return users[0].Id
}

/**
 * 列出电影库中的电影条目。
 */
async function listMovies(libraryId: string): Promise<MediaInfoTargetItem[]> {
  const data = await embyRequest<EmbyItemListResponse<EmbyMovieItem>>('/Items', {
    params: {
      ParentId: libraryId,
      IncludeItemTypes: 'Movie',
      Recursive: 'true',
      Fields: 'MediaSources'
    }
  })

  return (data.Items || []).filter(item => item?.Id).map(item => ({
    id: item.Id,
    name: item.Name || `电影 ${item.Id}`,
    libraryName: ''
  }))
}

/**
 * 列出剧集库中的剧集条目，后续再按剧集展开分集。
 */
async function listSeries(libraryId: string): Promise<EmbySeriesItem[]> {
  const data = await embyRequest<EmbyItemListResponse<EmbySeriesItem>>('/Items', {
    params: {
      ParentId: libraryId,
      IncludeItemTypes: 'Series',
      Recursive: 'true'
    }
  })

  return (data.Items || []).filter(item => item?.Id)
}

/**
 * 列出单个剧集下的所有分集，并生成前端展示所需的名称。
 */
async function listEpisodes(seriesId: string, seriesName: string): Promise<MediaInfoTargetItem[]> {
  const data = await embyRequest<EmbyItemListResponse<EmbyEpisodeItem>>('/Items', {
    params: {
      ParentId: seriesId,
      IncludeItemTypes: 'Episode',
      Recursive: 'true',
      Fields: 'MediaSources'
    }
  })

  return (data.Items || []).filter(item => item?.Id).map(item => {
    const season = item.ParentIndexNumber ?? 0
    const episode = item.IndexNumber ?? 0
    const indexLabel = season > 0 || episode > 0
      ? `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
      : '分集'

    return {
      id: item.Id,
      name: `${seriesName} - ${indexLabel}${item.Name ? ` ${item.Name}` : ''}`,
      libraryName: ''
    }
  })
}

/**
 * 获取单个媒体项详情，用于判断是否已存在 MediaStreams。
 */
function getTargetLibraries(libraryId: string) {
  return getLibraries().then(libraries => {
    const supportedLibraries = libraries.filter(lib => lib.type === 'movies' || lib.type === 'tvshows')

    const targets = libraryId === 'all'
      ? supportedLibraries
      : supportedLibraries.filter(lib => lib.id === libraryId)

    if (targets.length === 0) {
      throw new Error('未找到可提取的电影库或剧集库')
    }

    const libraryName = libraryId === 'all'
      ? '全部媒体库'
      : targets.map(lib => lib.name).join('、')

    return { libraryName, targets }
  })
}

async function estimateTargetItemTotal(targets: Array<{ id: string; name: string; type: string }>): Promise<number> {
  let total = 0

  for (const library of targets) {
    taskStatus.currentLibraryName = library.name
    taskStatus.message = `正在统计媒体库：${library.name}`
    touchStatus()

    try {
      const includeItemTypes = library.type === 'movies' ? 'Movie' : 'Episode'
      const data = await embyRequest<{ TotalRecordCount?: number }>('/Items', {
        params: {
          ParentId: library.id,
          IncludeItemTypes: includeItemTypes,
          Recursive: 'true',
          Limit: '0'
        },
        timeoutMs: 45000
      })
      total += data?.TotalRecordCount || 0
    } catch (error: any) {
      log.warn('媒体信息提取', `统计媒体库失败，继续按实际处理量执行: ${library.name} - ${error?.message || error}`)
    }
  }

  return total
}

async function processLibraryItems(
  library: { id: string; name: string; type: string },
  userId: string,
  taskId: number,
  concurrency: number
): Promise<void> {
  if (taskId !== currentTaskId) {
    return
  }

  taskStatus.currentLibraryName = library.name
  taskStatus.message = `正在扫描媒体库：${library.name}`
  touchStatus()

  if (library.type === 'movies') {
    const movies = await listMovies(library.id)
    movies.forEach(item => {
      item.libraryName = library.name
    })

    await runWithConcurrency(movies, async (item) => {
      await processTargetItem(item, userId, taskId)
    }, concurrency)
    return
  }

  const seriesList = await listSeries(library.id)
  for (const series of seriesList) {
    if (taskId !== currentTaskId) {
      return
    }

    taskStatus.currentLibraryName = library.name
    taskStatus.message = `正在扫描剧集：${library.name} / ${series.Name}`
    touchStatus()

    const episodes = await listEpisodes(series.Id, series.Name || '未知剧集')
    episodes.forEach(item => {
      item.libraryName = library.name
    })

    await runWithConcurrency(episodes, async (item) => {
      await processTargetItem(item, userId, taskId)
    }, concurrency)
  }
}
async function getItemDetail(userId: string, itemId: string): Promise<EmbyItemDetail> {
  return await embyRequest<EmbyItemDetail>(`/Users/${userId}/Items/${itemId}`)
}

/**
 * 判断媒体项详情中是否已经存在媒体流信息。
 */
function hasMediaStreams(detail: EmbyItemDetail | null | undefined): boolean {
  return Array.isArray(detail?.MediaStreams) && detail!.MediaStreams.length > 0
}

/**
 * 通过 PlaybackInfo 触发 Emby 对媒体项执行媒体流分析。
 */
async function triggerPlaybackInfo(itemId: string, userId: string): Promise<boolean> {
  try {
    await embyRequest(`/Items/${itemId}/PlaybackInfo`, {
      params: {
        UserId: userId,
        EnableDirectPlay: 'true',
        EnableDirectStream: 'true',
        EnableTranscoding: 'true',
        AllowVideoStreamCopy: 'true',
        AllowAudioStreamCopy: 'true',
        AutoOpenLiveStream: 'true'
      }
    })
    return true
  } catch (error: any) {
    log.warn('媒体信息提取', `触发 PlaybackInfo 失败: ${itemId} - ${error.message}`)
    return false
  }
}

/**
 * 处理批量提取中的单个媒体项，并同步更新任务进度。
 */
async function processTargetItem(item: MediaInfoTargetItem, userId: string, taskId: number): Promise<void> {
  if (taskId !== currentTaskId) {
    return
  }

  taskStatus.currentLibraryName = item.libraryName
  taskStatus.currentItemName = item.name
  taskStatus.message = `正在提取：${item.name}`
  touchStatus()

  try {
    const detail = await getItemDetail(userId, item.id)
    const detailHasMediaStreams = hasMediaStreams(detail)

    if (detailHasMediaStreams) {
      taskStatus.existing += 1
      return
    }

    const success = await triggerPlaybackInfo(item.id, userId)
    if (success) {
      taskStatus.extracted += 1
    } else {
      taskStatus.failed += 1
    }
  } catch {
    taskStatus.failed += 1
  } finally {
    taskStatus.scanned += 1
    touchStatus()
  }
}

/**
 * 以限定并发执行异步任务列表。
 */
async function runWithConcurrency<T>(items: T[], worker: (item: T) => Promise<void>, concurrency: number): Promise<void> {
  let index = 0

  const workers = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
    while (index < items.length) {
      const currentIndex = index
      index += 1
      const item = items[currentIndex]
      if (!item) {
        continue
      }
      await worker(item)
    }
  })

  await Promise.all(workers)
}

/**
 * 执行一轮完整的批量媒体信息提取任务。
 */
async function executeMediaInfoTask(taskId: number, libraryId: string, concurrency: number): Promise<void> {
  try {
    const { libraryName, targets } = await getTargetLibraries(libraryId)

    if (taskId !== currentTaskId) {
      return
    }

    taskStatus.libraryName = libraryName
    taskStatus.phase = 'scanning'
    taskStatus.message = '正在统计待处理媒体项...'
    touchStatus()

    const estimatedTotal = await estimateTargetItemTotal(targets)

    if (taskId !== currentTaskId) {
      return
    }

    taskStatus.phase = 'extracting'
    taskStatus.total = estimatedTotal
    taskStatus.message = estimatedTotal > 0
      ? `统计完成，开始处理约 ${estimatedTotal} 个媒体项`
      : '没有找到可处理的媒体项'
    touchStatus()

    if (estimatedTotal === 0) {
      markTaskCompleted('没有找到可处理的媒体项')
      await sendMediaInfoCompletionNotification()
      return
    }

    const userId = await getMediaInfoUserId()

    for (const library of targets) {
      if (taskId !== currentTaskId) {
        return
      }

      await processLibraryItems(library, userId, taskId, concurrency)
    }

    if (taskId !== currentTaskId) {
      return
    }

    markTaskCompleted(`媒体信息提取完成，共处理 ${taskStatus.scanned} 个媒体项`)
    await sendMediaInfoCompletionNotification()
  } catch (error: any) {
    log.error('媒体信息提取', `任务执行失败: ${error.message}`)
    if (taskId === currentTaskId) {
      markTaskFailed(error.message || '媒体信息提取失败')
      await sendMediaInfoCompletionNotification()
    }
  }
}

/**
 * 获取当前可用于媒体信息提取的媒体库列表。
 */
export async function getMediaInfoLibraries(): Promise<MediaInfoLibraryOption[]> {
  const libraries = await getLibraries()

  return libraries
    .filter(lib => lib.type === 'movies' || lib.type === 'tvshows')
    .map(lib => ({
      id: lib.id,
      name: lib.name,
      type: lib.type,
      typeLabel: lib.typeLabel
    }))
}

/**
 * 获取当前批量提取任务状态。
 */
export function getMediaInfoTaskStatus(): MediaInfoTaskStatus {
  touchStatus()

  if (!taskStatus.running) {
    const { libraryId, concurrency } = getConfiguredMediaInfoTaskOptions()
    taskStatus.selectedLibraryId = libraryId
    taskStatus.concurrency = concurrency
  }

  return {
    ...taskStatus
  }
}

/**
 * 启动一轮批量媒体信息提取。
 * 该函数只负责校验与切换状态，真正执行在后台异步继续进行。
 */
export async function startMediaInfoTask(
  libraryId: string = DEFAULT_LIBRARY_ID,
  concurrency: number = DEFAULT_CONCURRENCY,
  triggerType: 'manual' | 'scheduled' = 'manual'
): Promise<MediaInfoTaskRunResult> {
  if (taskStatus.running) {
    return {
      success: false,
      error: '已有媒体信息提取任务正在运行'
    }
  }

  const libraries = await getMediaInfoLibraries()
  if (libraries.length === 0) {
    return {
      success: false,
      error: '未找到可用的电影库或剧集库'
    }
  }

  const selectedLibraryName = libraryId === DEFAULT_LIBRARY_ID
    ? '全部媒体库'
    : libraries.find(item => item.id === libraryId)?.name

  if (!selectedLibraryName) {
    return {
      success: false,
      error: '指定的媒体库不存在'
    }
  }

  const normalizedConcurrency = normalizeConcurrency(concurrency)
  resetTaskStatus(libraryId, selectedLibraryName, 'missing', normalizedConcurrency, triggerType)

  const taskId = ++currentTaskId
  void executeMediaInfoTask(taskId, libraryId, normalizedConcurrency)

  return {
    success: true,
    message: `已开始提取 ${selectedLibraryName} 的媒体信息`
  }
}

/**
 * 读取媒体信息默认配置。
 * 该配置同时服务于媒体信息页、定时批量提取与追更队列并发控制。
 */
export function getConfiguredMediaInfoTaskOptions(): { libraryId: string; concurrency: number } {
  const libraryId = getSetting('task_media_info_library_id') || DEFAULT_LIBRARY_ID
  const concurrency = normalizeConcurrency(Number(getSetting('task_media_info_concurrency')))

  return {
    libraryId,
    concurrency
  }
}

/**
 * 使用已保存的默认配置执行一轮批量提取。
 * 主要供定时任务与任务页手动执行复用。
 */
export async function executeConfiguredMediaInfoTask(triggerType: 'manual' | 'scheduled' = 'manual'): Promise<MediaInfoConfiguredTaskResult> {
  const { libraryId, concurrency } = getConfiguredMediaInfoTaskOptions()
  const result = await startMediaInfoTask(libraryId, concurrency, triggerType)

  return {
    ...result,
    libraryId,
    concurrency
  }
}
