/**
 * 日志工具
 * 将日志写入本地文件，减少内存占用
 */
import { join } from 'path'
import { appendFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { formatShanghaiDateKey, formatShanghaiDateTime, getShanghaiDateParts } from '~/utils/time'

export interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'success'
  module: string
  message: string
  details?: string
}

interface SimpleLogEntry {
  time: string
  level: 'info' | 'success' | 'warn' | 'error'
  tag: string
  message: string
}

const MAX_LOG_FILES = 7
const MAX_SUBSCRIBERS_PER_TAG = 10
const logBuffer: SimpleLogEntry[] = []
const maxBufferSize = 100
const subscribers: Map<string, Set<(entry: SimpleLogEntry) => void>> = new Map()

let logPath: string | null = null
let lastCleanTime: number = 0

function getLogPath(): string {
  if (!logPath) {
    logPath = process.env.TRIM_PKGVAR ? join(process.env.TRIM_PKGVAR, 'logs') : (process.env.LOG_PATH || join(process.cwd(), 'logs'))
    if (!existsSync(logPath)) {
      mkdirSync(logPath, { recursive: true })
    }
  }
  return logPath
}

export function getLogFilePath(): string {
  return join(getLogPath(), `app-${formatShanghaiDateKey()}.log`)
}

function formatTimestamp(): string {
  return formatShanghaiDateTime(new Date())
}

function formatTime(): string {
  const now = getShanghaiDateParts(new Date())
  return `${now.hour}:${now.minute}:${now.second}`
}

function cleanOldLogs(): void {
  const now = Date.now()
  if (now - lastCleanTime < 3600000) {
    return
  }
  lastCleanTime = now

  try {
    const logDir = getLogPath()
    const files = readdirSync(logDir)
      .filter(f => f.startsWith('app-') && f.endsWith('.log'))
      .map(f => ({
        name: f,
        path: join(logDir, f),
        time: statSync(join(logDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time)

    if (files.length > MAX_LOG_FILES) {
      files.slice(MAX_LOG_FILES).forEach(f => {
        try {
          unlinkSync(f.path)
        } catch (e) {}
      })
    }
  } catch (e) {}
}

function writeToFile(level: string, module: string, message: string, details?: string): void {
  try {
    const timestamp = formatTimestamp()
    const logLine = `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}${details ? ` | ${details}` : ''}\n`
    const logFile = getLogFilePath()
    appendFileSync(logFile, logLine, 'utf-8')
    cleanOldLogs()
  } catch (e) {
    console.error('写入日志文件失败:', e)
  }
}

function emitLog(level: SimpleLogEntry['level'], tag: string, message: string) {
  const entry: SimpleLogEntry = {
    time: formatTime(),
    level,
    tag,
    message
  }
  
  logBuffer.push(entry)
  if (logBuffer.length > maxBufferSize) {
    logBuffer.shift()
  }
  
  const tagSubscribers = subscribers.get(tag)
  if (tagSubscribers) {
    tagSubscribers.forEach(callback => {
      try {
        callback(entry)
      } catch (e) {}
    })
  }
}

export function addLog(
  level: LogEntry['level'],
  module: string,
  message: string,
  details?: string
): LogEntry {
  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level,
    module,
    message,
    details
  }

  writeToFile(level, module, message, details)

  const levelMap: Record<string, SimpleLogEntry['level']> = {
    info: 'info',
    warn: 'warn',
    error: 'error',
    success: 'success'
  }
  
  emitLog(levelMap[level] || 'info', module, message)

  console.log(`[${level.toUpperCase()}] [${module}] ${message}`, details || '')

  return entry
}

export function clearLogs(): void {
  logBuffer.length = 0
}

export const log = {
  info: (module: string, message: string, details?: string) => 
    addLog('info', module, message, details),
  warn: (module: string, message: string, details?: string) => 
    addLog('warn', module, message, details),
  error: (module: string, message: string, details?: string) => 
    addLog('error', module, message, details),
  success: (module: string, message: string, details?: string) => 
    addLog('success', module, message, details)
}

export const logEmitter = {
  subscribe: (tag: string, callback: (entry: SimpleLogEntry) => void): (() => void) => {
    if (!subscribers.has(tag)) {
      subscribers.set(tag, new Set())
    }
    const tagSubscribers = subscribers.get(tag)!
    if (tagSubscribers.size >= MAX_SUBSCRIBERS_PER_TAG) {
      const firstCallback = tagSubscribers.values().next().value
      if (firstCallback) {
        tagSubscribers.delete(firstCallback)
      }
    }
    tagSubscribers.add(callback)
    return () => {
      subscribers.get(tag)?.delete(callback)
      if (subscribers.get(tag)?.size === 0) {
        subscribers.delete(tag)
      }
    }
  },
  
  getRecentLogs: (tag: string): SimpleLogEntry[] => {
    return logBuffer.filter(l => l.tag === tag).slice(-20)
  },
  
  clearAllSubscribers: () => {
    subscribers.clear()
  }
}
