/**
 * 日志API
 * GET: 获取日志列表（支持增量更新）
 * DELETE: 清空日志缓存
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { clearLogs, getLogFilePath as getLoggerLogFilePath } from '../utils/logger'

interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'success'
  module: string
  message: string
  details?: string
}

let cachedLogs: LogEntry[] = []
let lastLogTime: number = 0
const CACHE_TTL = 2000

function parseLogFile(content: string): LogEntry[] {
  const lines = content.split('\n').filter(line => line.trim())
  const logs: LogEntry[] = []

  const levelMap: Record<string, LogEntry['level']> = {
    'INFO': 'info',
    'WARN': 'warn',
    'ERROR': 'error',
    'SUCCESS': 'success'
  }

  for (const line of lines) {
    const match = line.match(/^\[([^\]]+)\]\s+\[(\w+)\]\s+\[([^\]]+)\]\s+([^\|]*?)(?:\s*\|\s*(.*))?$/)
    if (match && match[1] && match[2] && match[3] && match[4]) {
      const timestamp = match[1]
      const level = match[2]
      const module = match[3]
      const message = match[4]
      const details = match[5]
      logs.push({
        id: `${timestamp}-${module}-${Math.random().toString(36).substr(2, 6)}`,
        timestamp,
        level: levelMap[level] || 'info',
        module,
        message: message.trim(),
        details: details?.trim()
      })
    }
  }

  return logs
}

function findLatestLogFile(): string | null {
  const loggerFile = getLoggerLogFilePath()
  if (existsSync(loggerFile)) {
    return loggerFile
  }

  const logDir = dirname(loggerFile)
  if (!existsSync(logDir)) {
    return null
  }

  try {
    const files = readdirSync(logDir)
      .filter(f => f.startsWith('app-') && f.endsWith('.log'))
      .map(f => {
        const filePath = join(logDir, f)
        try {
          return { path: filePath, mtime: statSync(filePath).mtime.getTime() }
        } catch {
          return null
        }
      })
      .filter((f): f is { path: string; mtime: number } => f !== null)
      .sort((a, b) => b.mtime - a.mtime)

    const latest = files[0]
    if (latest) {
      return latest.path
    }
  } catch (e) {}

  return null
}

function getLogs(forceRefresh: boolean = false): LogEntry[] {
  const now = Date.now()

  if (!forceRefresh && cachedLogs.length > 0 && (now - lastLogTime) < CACHE_TTL) {
    return cachedLogs
  }

  try {
    const logFile = findLatestLogFile()

    if (!logFile) {
      lastLogTime = now
      return cachedLogs
    }

    const stats = statSync(logFile)
    const fileSize = stats.size

    if (fileSize > 500 * 1024) {
      const fd = require('fs').openSync(logFile, 'r')
      const buffer = Buffer.alloc(100 * 1024)
      const position = Math.max(0, fileSize - 100 * 1024)
      require('fs').readSync(fd, buffer, 0, buffer.length, position)
      require('fs').closeSync(fd)
      let content = buffer.toString('utf-8')
      const firstNewline = content.indexOf('\n')
      if (firstNewline > 0) {
        content = content.substring(firstNewline + 1)
      }
      const logs = parseLogFile(content)
      cachedLogs = logs.reverse().slice(0, 200)
    } else {
      const content = readFileSync(logFile, 'utf-8')
      const logs = parseLogFile(content)
      cachedLogs = logs.reverse().slice(0, 200)
    }

    lastLogTime = now
    return cachedLogs
  } catch (e) {
    return cachedLogs.length > 0 ? cachedLogs : []
  }
}

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET') {
    try {
      const query = getQuery(event)
      const forceRefresh = query.force === 'true'
      const logs = getLogs(forceRefresh)
      return { success: true, data: logs }
    } catch (error: any) {
      return { success: false, error: error.message || '获取日志失败' }
    }
  }

  if (method === 'DELETE') {
    try {
      clearLogs()
      cachedLogs = []
      lastLogTime = 0
      return { success: true, message: '日志缓存已清空' }
    } catch (error: any) {
      return { success: false, error: error.message || '清空日志失败' }
    }
  }

  return { success: false, error: '不支持的请求方法: ' + method }
})

