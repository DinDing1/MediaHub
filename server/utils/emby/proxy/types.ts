/**
 * Emby 反代类型
 */
export interface ProxySettings {
  embyUrl: string
  embyApiKey: string
  enabled: boolean
}

export interface MediaSource {
  Id?: string
  Path?: string
  DirectStreamUrl?: string
  [key: string]: any
}

export interface PlaybackInfoResponse {
  MediaSources?: MediaSource[]
  [key: string]: any
}

export interface CacheEntry<T> {
  value: T
  expiresAt: number
}
