/**
 * Emby 反代短时缓存
 */
import { createHash } from 'crypto'
import type { CacheEntry, PlaybackInfoResponse } from './types'
import { CACHE_HIT_LOG_THROTTLE_MS, CACHE_KEY_HEADERS, MAX_CACHE_SIZE } from './constants'

export const playbackInfoCache = new Map<string, CacheEntry<PlaybackInfoResponse>>()
export const playbackUrlCache = new Map<string, CacheEntry<string>>()
export const strmSourceCache = new Map<string, CacheEntry<Record<string, string>>>()
const cacheHitLogTimestamps = new Map<string, number>()

export function getHeaderHash(requestHeaders: Record<string, string>): string {
  const parts: string[] = []

  for (const headerName of CACHE_KEY_HEADERS) {
    const matchedKey = Object.keys(requestHeaders).find(key => key.toLowerCase() === headerName)
    if (matchedKey && requestHeaders[matchedKey]) {
      parts.push(`${headerName}:${requestHeaders[matchedKey]}`)
    }
  }

  return createHash('sha256').update(parts.join('\n')).digest('hex')
}

export function getPlaybackInfoCacheKey(itemId: string, mediaSourceId: string, requestHeaders: Record<string, string>): string {
  return `${itemId}:${mediaSourceId}:${getHeaderHash(requestHeaders)}`
}

export function getPlaybackUrlCacheKey(itemId: string, mediaSourceId: string, requestHeaders: Record<string, string>): string {
  return `${itemId}:${mediaSourceId}:${getHeaderHash(requestHeaders)}`
}

export function getStrmSourceCacheKey(itemId: string, requestHeaders: Record<string, string>): string {
  return `${itemId}:${getHeaderHash(requestHeaders)}`
}

export function getCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key)
  if (!entry) {
    return undefined
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return undefined
  }

  return entry.value
}

export function setCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number): void {
  const now = Date.now()

  for (const [cacheKey, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(cacheKey)
    }
  }

  while (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value
    if (!oldestKey) {
      break
    }
    cache.delete(oldestKey)
  }

  cache.set(key, {
    value,
    expiresAt: now + ttlMs
  })
}

export function shouldLogCacheHit(key: string): boolean {
  const now = Date.now()
  const lastLoggedAt = cacheHitLogTimestamps.get(key) || 0

  if (now - lastLoggedAt < CACHE_HIT_LOG_THROTTLE_MS) {
    return false
  }

  cacheHitLogTimestamps.set(key, now)
  return true
}
