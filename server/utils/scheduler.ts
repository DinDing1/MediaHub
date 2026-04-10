/**
 * 定时任务调度器
 * 
 * 功能说明：
 * - 管理自动整理、签到、清空回收站等定时任务
 * - 支持任务的启动、停止、更新调度时间
 * - 支持区分定时触发和手动触发
 * 
 * 架构说明：
 * - 采用配置驱动设计，所有任务配置集中在 TASK_CONFIGS 数组
 * - 通过通用函数处理任务的启动、停止、更新，减少重复代码
 * - 使用 globalThis 存储调度器状态，确保全局唯一
 * 
 * 新增任务步骤：
 * 1. 在 TASK_CONFIGS 数组中添加任务配置
 * 2. 创建任务模块文件（参考 checkin_115.ts）
 * 3. 任务函数签名：(triggerType: 'manual' | 'scheduled') => Promise<TaskResult>
 * 4. 如需手动触发支持，在 server/api/tasks/index.ts 中添加调用
 * 
 * @module scheduler
 */
import cron from 'node-cron'
import { getSetting, setSetting } from './db'
import { log } from './logger'
import { checkin115 } from './pan115/checkin_115'
import { cleanTrash115 } from './pan115/clean_trash_115'
import { fnosSign } from './tasks/fnos_sign'
import { gladosSign } from './tasks/glados_sign'
import { hdhiveSign } from './tasks/hdhive_sign'
import { executeConfiguredMediaInfoTask } from './emby/media_info'
import { formatShanghaiDateTime } from '~/utils/time'

const TASK_MODULES: Record<string, TaskFunction> = {
  checkin: checkin115,
  clean_trash: cleanTrash115,
  fnos_sign: fnosSign,
  glados_sign: gladosSign,
  hdhive_sign: hdhiveSign,
  media_info: executeConfiguredMediaInfoTask
}

/**
 * 任务执行结果类型
 * 所有任务函数应返回此类型
 */
type TaskResult = { 
  success: boolean
  message?: string 
  error?: string 
}

/**
 * 任务函数类型
 * @param triggerType - 触发类型：'manual' 手动触发 | 'scheduled' 定时触发
 */
type TaskFunction = (triggerType: 'manual' | 'scheduled') => Promise<TaskResult>

/**
 * 自动整理函数类型（特殊任务，返回值不同）
 */
type AutoOrganizeFunction = () => Promise<{ 
  success: boolean
  processed: number
  successCount: number
  failCount: number 
}>

/**
 * 任务配置接口
 * 用于定义一个定时任务的所有配置信息
 */
interface TaskConfig {
  /** 任务唯一标识符，用于内部引用 */
  id: string
  /** 任务显示名称，用于日志和通知 */
  name: string
  /** 启用状态的配置键名（存储在 settings 表） */
  enabledKey: string
  /** Cron表达式的配置键名 */
  cronKey: string
  /** 默认Cron表达式 */
  defaultCron: string
  /** 上次运行时间的配置键名 */
  lastRunKey: string
}

/**
 * 运行时任务信息
 * 存储在调度器状态中的任务运行时数据
 */
interface TaskInfo {
  /** 任务名称 */
  name: string
  /** Cron表达式 */
  cronExpression: string
  /** node-cron 任务实例 */
  task: ReturnType<typeof cron.schedule> | null
  /** 是否启用 */
  enabled: boolean
  /** 上次运行时间的配置键名 */
  lastRunKey?: string
}

/**
 * 调度器全局状态
 */
interface SchedulerGlobalState {
  /** 已调度的任务映射表 */
  scheduledTasks: Map<string, TaskInfo>
  /** 是否已初始化 */
  initialized: boolean
}

/**
 * 任务配置数组
 * 
 * 新增任务步骤：
 * 1. 在 TASK_MODULES 中导入任务函数并添加映射
 * 2. 在此数组添加配置项
 * 
 * 配置项说明：
 * - id - 唯一标识，对应 TASK_MODULES 的键名
 * - name - 中文显示名称
 * - enabledKey - 对应 settings 表中的键名
 * - cronKey - Cron表达式存储的键名
 * - defaultCron - 默认执行时间
 * - lastRunKey - 上次运行时间存储的键名
 */
const TASK_CONFIGS: TaskConfig[] = [
  { 
    id: 'checkin', 
    name: '115签到', 
    enabledKey: 'task_checkin_enabled', 
    cronKey: 'task_checkin_schedule', 
    defaultCron: '0 8 * * *', 
    lastRunKey: 'task_checkin_last_run'
  },
  { 
    id: 'clean_trash', 
    name: '清空回收站', 
    enabledKey: 'task_clean_trash_enabled', 
    cronKey: 'task_clean_trash_schedule', 
    defaultCron: '0 8 * * *', 
    lastRunKey: 'task_clean_trash_last_run'
  },
  { 
    id: 'fnos_sign', 
    name: '飞牛签到', 
    enabledKey: 'task_fnos_sign_enabled', 
    cronKey: 'task_fnos_sign_schedule', 
    defaultCron: '0 8 * * *', 
    lastRunKey: 'task_fnos_sign_last_run'
  },
  { 
    id: 'glados_sign', 
    name: 'GlaDOS签到', 
    enabledKey: 'task_glados_sign_enabled', 
    cronKey: 'task_glados_sign_schedule', 
    defaultCron: '0 9 * * *', 
    lastRunKey: 'task_glados_sign_last_run'
  },
  {
    id: 'hdhive_sign',
    name: '影巢签到',
    enabledKey: 'task_hdhive_sign_enabled',
    cronKey: 'task_hdhive_sign_schedule',
    defaultCron: '0 10 * * *',
    lastRunKey: 'task_hdhive_sign_last_run'
  },
  {
    id: 'media_info',
    name: '媒体信息提取',
    enabledKey: 'task_media_info_enabled',
    cronKey: 'task_media_info_schedule',
    defaultCron: '0 4 * * *',
    lastRunKey: 'task_media_info_last_run'
  }
]

/**
 * 获取调度器全局状态
 * 使用单例模式，确保全局只有一个调度器实例
 * 
 * @returns 调度器状态对象
 */
function getSchedulerState(): SchedulerGlobalState {
  if (!(globalThis as any).__schedulerState__) {
    (globalThis as any).__schedulerState__ = {
      scheduledTasks: new Map(),
      initialized: false
    }
  }
  return (globalThis as any).__schedulerState__
}

/**
 * 更新任务上次运行时间
 * 将当前时间写入数据库配置
 * 
 * @param key - 配置键名
 */
function updateLastRunTime(key: string): void {
  if (key) {
    setSetting(key, formatShanghaiDateTime(new Date()))
  }
}

/**
 * 获取任务函数
 * 从静态导入的模块映射表中获取
 * 
 * @param config - 任务配置
 * @returns 任务函数，未找到返回 null
 */
function getTaskFunction(config: TaskConfig): TaskFunction | null {
  const fn = TASK_MODULES[config.id]
  if (!fn) {
    log.error('调度器', `任务函数未找到 [${config.name}]`)
    return null
  }
  return fn
}

/**
 * 启动定时任务（通用方法）
 * 
 * 执行流程：
 * 1. 验证 Cron 表达式
 * 2. 停止已存在的同名任务
 * 3. 创建新的定时任务
 * 4. 注册到调度器状态
 * 
 * @param config - 任务配置
 * @param taskFn - 任务执行函数
 * @param cronExpression - Cron 表达式
 * @returns 是否启动成功
 */
function startTask(config: TaskConfig, taskFn: TaskFunction, cronExpression: string): boolean {
  const state = getSchedulerState()
  
  // 验证 Cron 表达式有效性
  if (!cron.validate(cronExpression)) {
    log.error('调度器', `无效的Cron表达式: ${cronExpression}`)
    return false
  }

  // 先停止已存在的任务，避免重复
  stopTask(config.id)

  // 创建定时任务
  const task = cron.schedule(cronExpression, async () => {
    log.info('调度器', `开始执行${config.name}任务`)
    try {
      // 执行任务，传入 'scheduled' 表示定时触发
      const result = await taskFn('scheduled')
      if (result.success) {
        updateLastRunTime(config.lastRunKey)
        log.success('调度器', `${config.name}任务执行完成: ${result.message}`)
      } else {
        log.error('调度器', `${config.name}任务执行失败: ${result.error || result.message}`)
      }
    } catch (error: any) {
      log.error('调度器', `${config.name}任务执行异常: ${error.message}`)
    }
  })

  // 注册到调度器状态
  state.scheduledTasks.set(config.id, {
    name: config.name,
    cronExpression,
    task,
    enabled: true,
    lastRunKey: config.lastRunKey
  })

  log.success('调度器', `${config.name}任务已启动，Cron: ${cronExpression}`)
  return true
}

/**
 * 停止定时任务（通用方法）
 * 
 * @param taskId - 任务ID
 */
function stopTask(taskId: string): void {
  const state = getSchedulerState()
  const existing = state.scheduledTasks.get(taskId)
  if (existing && existing.task) {
    existing.task.stop()
    state.scheduledTasks.delete(taskId)
    log.info('调度器', `${existing.name}任务已停止`)
  }
}

/**
 * 初始化调度器
 * 
 * 执行流程：
 * 1. 检查是否已初始化，避免重复
 * 2. 初始化115开放平台Token
 * 3. 启动自动整理任务（特殊任务，单独处理）
 * 4. 遍历 TASK_CONFIGS 启动所有已启用的任务
 * 
 * 此函数应在应用启动时调用一次
 */
export async function initScheduler(): Promise<void> {
  const state = getSchedulerState()
  
  // 防止重复初始化
  if (state.initialized) {
    log.info('调度器', '调度器已初始化，跳过重复初始化')
    return
  }
  
  log.info('调度器', '初始化定时任务调度器')
  
  // 初始化115开放平台Token（用于直链等功能）
  const { autoCheckAndGetToken } = await import('./pan115/open115')
  await autoCheckAndGetToken()
  
  // 自动整理任务（特殊任务，返回值结构不同，单独处理）
  const autoOrganizeEnabled = getSetting('auto_organize_enabled')
  const autoOrganizeCron = getSetting('auto_organize_cron') || '0 3 * * *'
  
  if (autoOrganizeEnabled === 'true') {
    const { autoOrganize } = await import('./organize/auto_organize')
    startAutoOrganizeTask(autoOrganizeCron, autoOrganize)
  }
  
  // 遍历配置，启动所有已启用的任务
  for (const config of TASK_CONFIGS) {
    const enabled = getSetting(config.enabledKey) === 'true'
    if (enabled) {
      const taskFn = getTaskFunction(config)
      if (taskFn) {
        const cronExpr = getSetting(config.cronKey) || config.defaultCron
        startTask(config, taskFn, cronExpr)
      }
    }
  }
  
  state.initialized = true
  log.success('调度器', '定时任务调度器初始化完成')
}

/**
 * 启动自动整理任务
 * 自动整理任务比较特殊，返回值包含处理统计信息，因此单独处理
 * 
 * @param cronExpression - Cron表达式
 * @param autoOrganizeFn - 自动整理函数
 * @returns 是否启动成功
 */
export function startAutoOrganizeTask(cronExpression: string, autoOrganizeFn: AutoOrganizeFunction): boolean {
  const state = getSchedulerState()
  
  if (!cron.validate(cronExpression)) {
    log.error('调度器', `无效的Cron表达式: ${cronExpression}`)
    return false
  }

  stopAutoOrganizeTask()

  const task = cron.schedule(cronExpression, async () => {
    log.info('调度器', '开始执行自动整理任务')
    try {
      await autoOrganizeFn()
      log.success('调度器', '自动整理任务执行完成')
    } catch (error: any) {
      log.error('调度器', `自动整理任务执行失败: ${error.message}`)
    }
  })

  state.scheduledTasks.set('auto_organize', {
    name: '自动整理',
    cronExpression,
    task,
    enabled: true
  })

  log.success('调度器', `自动整理任务已启动，Cron: ${cronExpression}`)
  return true
}

/**
 * 停止自动整理任务
 */
export function stopAutoOrganizeTask(): void {
  stopTask('auto_organize')
}

/**
 * 启动115签到任务
 * @param cronExpression - Cron表达式
 * @param checkinFn - 签到函数
 * @returns 是否启动成功
 */
export function startCheckinTask(cronExpression: string, checkinFn: TaskFunction): boolean {
  const config = TASK_CONFIGS.find(c => c.id === 'checkin')!
  return startTask(config, checkinFn, cronExpression)
}

/**
 * 停止115签到任务
 */
export function stopCheckinTask(): void {
  stopTask('checkin')
}

/**
 * 启动清空回收站任务
 * @param cronExpression - Cron表达式
 * @param cleanTrashFn - 清空回收站函数
 * @returns 是否启动成功
 */
export function startCleanTrashTask(cronExpression: string, cleanTrashFn: TaskFunction): boolean {
  const config = TASK_CONFIGS.find(c => c.id === 'clean_trash')!
  return startTask(config, cleanTrashFn, cronExpression)
}

/**
 * 停止清空回收站任务
 */
export function stopCleanTrashTask(): void {
  stopTask('clean_trash')
}

/**
 * 启动飞牛签到任务
 * @param cronExpression - Cron表达式
 * @param fnosSignFn - 飞牛签到函数
 * @returns 是否启动成功
 */
export function startFnosSignTask(cronExpression: string, fnosSignFn: TaskFunction): boolean {
  const config = TASK_CONFIGS.find(c => c.id === 'fnos_sign')!
  return startTask(config, fnosSignFn, cronExpression)
}

/**
 * 停止飞牛签到任务
 */
export function stopFnosSignTask(): void {
  stopTask('fnos_sign')
}

/**
 * 启动GlaDOS签到任务
 * @param cronExpression - Cron表达式
 * @param gladosSignFn - GlaDOS签到函数
 * @returns 是否启动成功
 */
export function startGladosSignTask(cronExpression: string, gladosSignFn: TaskFunction): boolean {
  const config = TASK_CONFIGS.find(c => c.id === 'glados_sign')!
  return startTask(config, gladosSignFn, cronExpression)
}

/**
 * 停止GlaDOS签到任务
 */
export function stopGladosSignTask(): void {
  stopTask('glados_sign')
}

/**
 * 启动影巢签到任务
 * @param cronExpression - Cron表达式
 * @param hdhiveSignFn - 影巢签到函数
 * @returns 是否启动成功
 */
export function startHdhiveSignTask(cronExpression: string, hdhiveSignFn: TaskFunction): boolean {
  const config = TASK_CONFIGS.find(c => c.id === 'hdhive_sign')!
  return startTask(config, hdhiveSignFn, cronExpression)
}

/**
 * 停止影巢签到任务
 */
export function stopHdhiveSignTask(): void {
  stopTask('hdhive_sign')
}

export function startMediaInfoScheduledTask(cronExpression: string, mediaInfoTaskFn: TaskFunction): boolean {
  const config = TASK_CONFIGS.find(c => c.id === 'media_info')!
  return startTask(config, mediaInfoTaskFn, cronExpression)
}

/**
 * 停止媒体信息提取任务
 */
export function stopMediaInfoScheduledTask(): void {
  stopTask('media_info')
}

/**
 * 更新自动整理任务调度
 *
 * @param enabled - 是否启用
 * @param cronExpression - Cron表达式
 * @returns 是否更新成功
 */
export async function updateAutoOrganizeSchedule(enabled: boolean, cronExpression: string): Promise<boolean> {
  if (enabled) {
    if (!cron.validate(cronExpression)) {
      log.error('调度器', `无效的Cron表达式: ${cronExpression}`)
      return false
    }
    const { autoOrganize } = await import('./organize/auto_organize')
    return startAutoOrganizeTask(cronExpression, autoOrganize)
  } else {
    stopAutoOrganizeTask()
    return true
  }
}

/**
 * 更新任务调度（通用方法）
 * 
 * @param taskId - 任务ID
 * @param enabled - 是否启用
 * @param cronExpression - Cron表达式
 * @returns 是否更新成功
 */
export async function updateTaskSchedule(taskId: string, enabled: boolean, cronExpression: string): Promise<boolean> {
  const config = TASK_CONFIGS.find(c => c.id === taskId)
  if (!config) {
    log.error('调度器', `未知任务: ${taskId}`)
    return false
  }
  
  if (enabled) {
    if (!cron.validate(cronExpression)) {
      log.error('调度器', `无效的Cron表达式: ${cronExpression}`)
      return false
    }
    const taskFn = getTaskFunction(config)
    if (!taskFn) return false
    return startTask(config, taskFn, cronExpression)
  } else {
    stopTask(taskId)
    return true
  }
}

/**
 * 更新115签到任务调度
 */
export async function updateCheckinSchedule(enabled: boolean, cronExpression: string): Promise<boolean> {
  return updateTaskSchedule('checkin', enabled, cronExpression)
}

/**
 * 更新清空回收站任务调度
 */
export async function updateCleanTrashSchedule(enabled: boolean, cronExpression: string): Promise<boolean> {
  return updateTaskSchedule('clean_trash', enabled, cronExpression)
}

/**
 * 更新飞牛签到任务调度
 */
export async function updateFnosSignSchedule(enabled: boolean, cronExpression: string): Promise<boolean> {
  return updateTaskSchedule('fnos_sign', enabled, cronExpression)
}

/**
 * 更新GlaDOS签到任务调度
 */
export async function updateGladosSignSchedule(enabled: boolean, cronExpression: string): Promise<boolean> {
  return updateTaskSchedule('glados_sign', enabled, cronExpression)
}

/**
 * 更新影巢签到任务调度
 */
export async function updateHdhiveSignSchedule(enabled: boolean, cronExpression: string): Promise<boolean> {
  return updateTaskSchedule('hdhive_sign', enabled, cronExpression)
}

/**
 * 更新媒体信息提取任务调度
 */
export async function updateMediaInfoSchedule(enabled: boolean, cronExpression: string): Promise<boolean> {
  return updateTaskSchedule('media_info', enabled, cronExpression)
}

/**
 * 获取所有任务状态
 * 用于前端展示任务列表
 * 
 * @returns 任务状态数组
 */
export function getAllTasksStatus(): { id: string; name: string; enabled: boolean; cronExpression: string }[] {
  const state = getSchedulerState()
  const result: { id: string; name: string; enabled: boolean; cronExpression: string }[] = []
  
  // 自动整理任务（特殊任务，单独处理）
  const autoOrganizeTask = state.scheduledTasks.get('auto_organize')
  const autoOrganizeEnabled = getSetting('auto_organize_enabled') === 'true'
  const autoOrganizeCron = getSetting('auto_organize_cron') || '0 3 * * *'
  result.push({
    id: 'auto_organize',
    name: autoOrganizeTask?.name || '自动整理',
    enabled: autoOrganizeTask ? autoOrganizeTask.enabled : autoOrganizeEnabled,
    cronExpression: autoOrganizeTask?.cronExpression || autoOrganizeCron
  })
  
  // 遍历配置获取所有任务状态
  for (const config of TASK_CONFIGS) {
    const scheduledTask = state.scheduledTasks.get(config.id)
    if (scheduledTask) {
      // 任务已调度，使用运行时状态
      result.push({
        id: config.id,
        name: scheduledTask.name,
        enabled: scheduledTask.enabled,
        cronExpression: scheduledTask.cronExpression
      })
    } else {
      // 任务未调度，使用数据库配置
      const enabled = getSetting(config.enabledKey) === 'true'
      const cronExpr = getSetting(config.cronKey) || config.defaultCron
      result.push({
        id: config.id,
        name: config.name,
        enabled,
        cronExpression: cronExpr
      })
    }
  }
  
  return result
}

/**
 * 停止所有定时任务
 * 用于应用关闭时清理资源
 */
export function stopAllTasks(): void {
  const state = getSchedulerState()
  for (const [key, task] of state.scheduledTasks) {
    if (task.task) {
      task.task.stop()
    }
    state.scheduledTasks.delete(key)
  }
  log.info('调度器', '所有定时任务已停止')
}

/**
 * 获取自动整理任务状态
 * 用于自动整理配置页面
 * 
 * @returns 任务状态，未启用时返回 null
 */
export function getSchedulerStatus(): { name: string; enabled: boolean; cronExpression: string } | null {
  const state = getSchedulerState()
  const task = state.scheduledTasks.get('auto_organize')
  if (task) {
    return {
      name: task.name,
      enabled: task.enabled,
      cronExpression: task.cronExpression
    }
  }
  
  const enabled = getSetting('auto_organize_enabled') === 'true'
  const cronExpr = getSetting('auto_organize_cron') || '0 3 * * *'
  
  if (enabled) {
    return {
      name: '自动整理',
      enabled: true,
      cronExpression: cronExpr
    }
  }
  
  return null
}
