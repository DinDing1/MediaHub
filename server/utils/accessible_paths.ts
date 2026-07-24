/**
 * 飞牛授权目录工具
 *
 * 飞牛正式环境：
 *   用户在应用设置里授权存储目录后，系统会注入环境变量 TRIM_DATA_ACCESSIBLE_PATHS。
 *   本模块直接读取该环境变量，无需额外落盘文件。
 *
 * 本地开发（可选）：
 *   可设置 TRIM_DATA_ACCESSIBLE_PATHS，或在 data/accessible_paths.env 中写路径模拟。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { basename, join, resolve, sep } from 'path'

/**
 * 解析飞牛授权路径列表
 * - Linux/飞牛：冒号分隔多个路径，如 /vol1/media:/vol2/downloads
 * - Windows 本地：D:\xxx 不能按冒号拆分；多路径建议换行或分号
 */
export function splitAccessiblePaths(raw: string): string[] {
  if (!raw) return []

  const items: string[] = []
  for (const line of raw.replace(/\r/g, '\n').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const isWindowsDrivePath =
      trimmed.length >= 3 && trimmed[1] === ':' && (trimmed[2] === '\\' || trimmed[2] === '/')

    let parts: string[]
    if (isWindowsDrivePath) {
      parts = trimmed.includes(';') ? trimmed.split(';') : [trimmed]
    } else {
      const separator = trimmed.includes(';') ? ';' : ':'
      parts = trimmed.split(separator)
    }

    for (const part of parts) {
      const p = part.trim()
      if (p) items.push(p)
    }
  }

  const result: string[] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item)
      result.push(item)
    }
  }
  return result
}

function normalizePath(targetPath: string): string {
  return resolve(targetPath).replace(/[\\/]+$/, '')
}

/** 本地开发用的可选模拟文件（飞牛正式环境不会用到） */
function getLocalDevPathsFile(): string {
  return join(process.cwd(), 'data', 'accessible_paths.env')
}

/**
 * 获取飞牛授权可访问路径列表
 * 优先：TRIM_DATA_ACCESSIBLE_PATHS（飞牛正式来源）
 * 兜底：仅本地开发时的 data/accessible_paths.env
 */
export function getAccessiblePaths(): string[] {
  const envRaw = (process.env.TRIM_DATA_ACCESSIBLE_PATHS || '').trim()
  if (envRaw) {
    return splitAccessiblePaths(envRaw)
  }

  // 飞牛环境：没有授权就返回空，让前端提示用户去应用设置里授权
  // 不在飞牛时才读本地模拟文件
  if (process.env.TRIM_PKGVAR) {
    return []
  }

  const localFile = getLocalDevPathsFile()
  if (existsSync(localFile)) {
    try {
      const raw = readFileSync(localFile, 'utf-8').trim()
      if (raw) return splitAccessiblePaths(raw)
    } catch {
      // ignore
    }
  }

  return []
}

/** 校验路径是否位于某个授权目录下（等于或是子路径） */
export function isPathAuthorized(targetPath: string, accessible: string[] = getAccessiblePaths()): boolean {
  if (!targetPath?.trim()) return false

  let target: string
  try {
    target = normalizePath(targetPath)
  } catch {
    return false
  }

  for (const ap of accessible) {
    try {
      const base = normalizePath(ap)
      if (
        target === base ||
        target.startsWith(base + sep) ||
        target.startsWith(base + '/') ||
        target.startsWith(base + '\\')
      ) {
        return true
      }
    } catch {
      continue
    }
  }
  return false
}

/**
 * 列出指定授权路径下的一层子目录
 * path 为空时返回授权根目录列表
 */
export function listAccessibleChildren(path: string): { dirs: string[]; error?: string } {
  if (!path?.trim()) {
    return { dirs: getAccessiblePaths() }
  }

  const accessible = getAccessiblePaths()
  if (accessible.length > 0 && !isPathAuthorized(path, accessible)) {
    return { dirs: [], error: '路径不在授权范围内' }
  }

  try {
    const entries = readdirSync(path, { withFileTypes: true })
    const dirs: string[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const full = join(path, entry.name)
      try {
        if (!statSync(full).isDirectory()) continue
        JSON.stringify(full)
        dirs.push(full)
      } catch {
        continue
      }
    }
    dirs.sort((a, b) => basename(a).localeCompare(basename(b), undefined, { sensitivity: 'base' }))
    return { dirs }
  } catch (error: any) {
    return { dirs: [], error: error?.message || '列出子目录失败' }
  }
}