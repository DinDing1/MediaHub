/**
 * 115云盘文件系统缓存管理器
 * 用于减少API调用，避免触发风控
 * 
 * 缓存策略：
 * 1. 目录子文件缓存：缓存目录ID到子文件列表的映射
 * 2. 路径到ID缓存：缓存完整路径到目录ID的映射
 * 3. TMDB到目录缓存：缓存TMDB ID到目标目录ID的映射（整理专用）
 */

import { log } from '../logger'
import type { FileItem } from './types'

interface DirCacheItem {
  children: Map<string, FileItem>
  updatedAt: number
}

interface PathCacheItem {
  dirId: string
  pickcode: string
  updatedAt: number
}

interface TmdbCacheItem {
  dirId: string
  path: string
  updatedAt: number
}

interface CacheConfig {
  maxAge: number
  maxSize: number
  cleanupInterval: number
}

const DEFAULT_CONFIG: CacheConfig = {
  maxAge: 600000,
  maxSize: 1000,
  cleanupInterval: 60000
}

class FileSystemCache {
  private static instance: FileSystemCache | null = null
  
  private dirChildren: Map<string, DirCacheItem> = new Map()
  private pathToId: Map<string, PathCacheItem> = new Map()
  private tmdbToDir: Map<number, TmdbCacheItem> = new Map()
  private config: CacheConfig
  private lastCleanupAt: number

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.lastCleanupAt = Date.now()
  }
  
  static getInstance(config?: Partial<CacheConfig>): FileSystemCache {
    if (!FileSystemCache.instance) {
      FileSystemCache.instance = new FileSystemCache(config)
    }
    return FileSystemCache.instance
  }
  
  private ensureCleanup(): void {
    const now = Date.now()
    if (now - this.lastCleanupAt < this.config.cleanupInterval) {
      return
    }

    this.cleanup()
    this.lastCleanupAt = now
  }

  cleanup(): void {
    const now = Date.now()
    let cleaned = 0
    
    for (const [dirId, cache] of this.dirChildren) {
      if (now - cache.updatedAt > this.config.maxAge) {
        this.dirChildren.delete(dirId)
        cleaned++
      }
    }
    
    for (const [path, cache] of this.pathToId) {
      if (now - cache.updatedAt > this.config.maxAge) {
        this.pathToId.delete(path)
        cleaned++
      }
    }
    
    for (const [tmdbId, cache] of this.tmdbToDir) {
      if (now - cache.updatedAt > this.config.maxAge) {
        this.tmdbToDir.delete(tmdbId)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      log.info('缓存管理器', `清理了 ${cleaned} 个过期缓存项`)
    }
  }
  
  clearAll(): void {
    this.dirChildren.clear()
    this.pathToId.clear()
    this.tmdbToDir.clear()
    log.info('缓存管理器', '已清空所有缓存')
  }
  
  invalidateDir(dirId: string): void {
    this.dirChildren.delete(dirId)
    
    for (const [path, cache] of this.pathToId) {
      if (cache.dirId === dirId) {
        this.pathToId.delete(path)
      }
    }
  }
  
  getStats(): {
    dirCacheCount: number
    pathCacheCount: number
    tmdbCacheCount: number
  } {
    this.ensureCleanup()
    return {
      dirCacheCount: this.dirChildren.size,
      pathCacheCount: this.pathToId.size,
      tmdbCacheCount: this.tmdbToDir.size
    }
  }
  
  setDirChildren(dirId: string, children: FileItem[]): void {
    const childrenMap = new Map<string, FileItem>()
    for (const child of children) {
      childrenMap.set(child.name, child)
    }
    
    this.dirChildren.set(dirId, {
      children: childrenMap,
      updatedAt: Date.now()
    })
  }
  
  getDirChildren(dirId: string): FileItem[] | null {
    this.ensureCleanup()
    const cache = this.dirChildren.get(dirId)
    if (!cache) return null
    
    if (Date.now() - cache.updatedAt > this.config.maxAge) {
      this.dirChildren.delete(dirId)
      return null
    }
    
    return Array.from(cache.children.values())
  }
  
  getDirChild(dirId: string, name: string): FileItem | null {
    this.ensureCleanup()
    const cache = this.dirChildren.get(dirId)
    if (!cache) return null
    
    if (Date.now() - cache.updatedAt > this.config.maxAge) {
      this.dirChildren.delete(dirId)
      return null
    }
    
    return cache.children.get(name) || null
  }
  
  addDirChild(dirId: string, file: FileItem): void {
    let cache = this.dirChildren.get(dirId)
    if (!cache) {
      cache = {
        children: new Map(),
        updatedAt: Date.now()
      }
      this.dirChildren.set(dirId, cache)
    }
    cache.children.set(file.name, file)
    cache.updatedAt = Date.now()
  }
  
  removeDirChild(dirId: string, name: string): void {
    const cache = this.dirChildren.get(dirId)
    if (cache) {
      cache.children.delete(name)
      cache.updatedAt = Date.now()
    }
  }
  
  updateDirChildName(dirId: string, oldName: string, newName: string): void {
    const cache = this.dirChildren.get(dirId)
    if (cache) {
      const file = cache.children.get(oldName)
      if (file) {
        cache.children.delete(oldName)
        file.name = newName
        cache.children.set(newName, file)
        cache.updatedAt = Date.now()
      }
    }
  }
  
  moveDirChild(sourceDirId: string, targetDirId: string, fileName: string): void {
    const sourceCache = this.dirChildren.get(sourceDirId)
    const targetCache = this.dirChildren.get(targetDirId)
    
    if (sourceCache && targetCache) {
      const file = sourceCache.children.get(fileName)
      if (file) {
        sourceCache.children.delete(fileName)
        sourceCache.updatedAt = Date.now()
        
        targetCache.children.set(fileName, file)
        targetCache.updatedAt = Date.now()
      }
    }
  }
  
  setPathId(path: string, dirId: string, pickcode?: string): void {
    this.pathToId.set(path, {
      dirId,
      pickcode: pickcode || '',
      updatedAt: Date.now()
    })
  }

  getPathId(path: string): { dirId: string; pickcode: string } | null {
    this.ensureCleanup()
    const cache = this.pathToId.get(path)
    if (!cache) return null

    if (Date.now() - cache.updatedAt > this.config.maxAge) {
      this.pathToId.delete(path)
      return null
    }

    return { dirId: cache.dirId, pickcode: cache.pickcode }
  }
  
  invalidatePath(path: string): void {
    this.pathToId.delete(path)
  }
  
  setTmdbDir(tmdbId: number, dirId: string, path: string): void {
    this.tmdbToDir.set(tmdbId, {
      dirId,
      path,
      updatedAt: Date.now()
    })
    log.info('缓存管理器', `缓存 TMDB ${tmdbId} -> ${path}`)
  }
  
  getTmdbDir(tmdbId: number): { dirId: string; path: string } | null {
    this.ensureCleanup()
    const cache = this.tmdbToDir.get(tmdbId)
    if (!cache) return null
    
    if (Date.now() - cache.updatedAt > this.config.maxAge) {
      this.tmdbToDir.delete(tmdbId)
      return null
    }
    
    return {
      dirId: cache.dirId,
      path: cache.path
    }
  }
  
  invalidateTmdb(tmdbId: number): void {
    this.tmdbToDir.delete(tmdbId)
  }
  
  destroy(): void {
    this.clearAll()
    FileSystemCache.instance = null
  }
}

export const fsCache = FileSystemCache.getInstance()

export function getFsCache(): FileSystemCache {
  return FileSystemCache.getInstance()
}

export function clearFsCache(): void {
  fsCache.clearAll()
}

export function getFsCacheStats(): ReturnType<FileSystemCache['getStats']> {
  return fsCache.getStats()
}
