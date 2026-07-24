/**
 * Emby 反代常量与路由规则
 */

export const API_TIMEOUT = 30000
export const REDIRECT_RESOLVE_TIMEOUT = 10000
export const PLAYBACK_INFO_CACHE_TTL_MS = 90000
export const PLAYBACK_URL_CACHE_TTL_MS = 45000
export const PLAYBACK_STRM_CACHE_TTL_MS = 300000
export const CACHE_HIT_LOG_THROTTLE_MS = 5000
export const MAX_CACHE_SIZE = 500

/** 可能进入播放链路的媒体路由 */
export const MEDIA_ROUTE_PATTERNS = [
  /^\/audio\/([^/]+)\/([^/?#]+)/i,
  /^\/emby\/audio\/([^/]+)\/([^/?#]+)/i,
  /^\/videos\/([^/]+)\/([^/?#]+)/i,
  /^\/emby\/videos\/([^/]+)\/([^/?#]+)/i,
  /^\/items\/([^/]+)\/download$/i,
  /^\/emby\/items\/([^/]+)\/download$/i,
  /^\/items\/([^/]+)\/file$/i,
  /^\/emby\/items\/([^/]+)\/file$/i,
  /^\/sync\/jobitems\/([^/]+)\/file$/i,
  /^\/emby\/sync\/jobitems\/([^/]+)\/file$/i
]

export const NON_MEDIA_NAMES = new Set([
  'additionalparts',
  'subtitles',
  'similar',
  'thememedia',
  'themevideos',
  'themesongs',
  'specialfeatures',
  'linkeditems'
])

export const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade'
])

export const CACHE_KEY_HEADERS = [
  'authorization',
  'cookie',
  'x-emby-token',
  'x-emby-authorization',
  'user-agent',
  'x-emby-device-id',
  'x-emby-device-name',
  'x-emby-client',
  'x-emby-client-version',
  'x-device-id',
  'x-device-name',
  'x-client'
]

export const EMBY_AUTH_TOKEN_RE = /Token="([^"]+)"/i
