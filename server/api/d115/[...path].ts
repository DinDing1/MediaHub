/**
 * 115云盘直链API端点
 * 
 * 功能说明：
 * - 提供HTTP接口获取115云盘文件的直链下载地址
 * - 支持多种参数格式
 * - 返回307重定向到实际下载地址
 * 
 * 使用方式：
 * - GET /api/d115/pickcode={pickcode}         通过pickcode获取直链
 * - GET /api/d115/{pickcode}                  直接路径方式获取直链
 * - GET /api/d115?pickcode={pickcode}         查询参数方式获取直链
 * - GET /api/d115?refresh=true                强制刷新缓存
 * 
 * 响应：
 * - 成功：307重定向到115直链地址
 * - 失败：返回错误信息JSON
 */

import { getDirectLink } from '../../utils/pan115/direct_link_115'
import { log } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  const method = event.method
  const url = new URL(event.node.req.url || '', `http://${event.node.req.headers.host}`)
  
  /** 处理CORS预检请求 */
  if (method === 'OPTIONS') {
    setResponseHeaders(event, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    })
    return { state: true }
  }

  const path = event.context.params?.path || ''
  const query = url.searchParams
  
  let pickcode = ''
  let fileName = ''
  
  /** 是否强制刷新缓存 */
  const refresh = query.get('refresh')?.toLowerCase() === 'true' || query.get('refresh') === '1'

  /** 解析参数：支持多种格式 */
  if (path.startsWith('pickcode=')) {
    /** 格式：/api/d115/pickcode={pickcode}/文件名 */
    const parts = path.split('pickcode=')
    const afterPickcode = parts[1] || ''
    const segments = afterPickcode.split('/')
    pickcode = segments[0] || ''
    if (segments.length > 1) {
      fileName = decodeURIComponent(segments.slice(1).join('/'))
    }
  } else {
    /** 格式：/api/d115?pickcode={pickcode} 或 /api/d115/{pickcode}/文件名 */
    pickcode = query.get('pickcode') || ''
    
    /** 如果没有pickcode，尝试从路径中提取 */
    if (!pickcode) {
      const segments = path.split('/').filter(s => s)
      pickcode = segments[0] || ''
      if (segments.length > 1) {
        fileName = decodeURIComponent(segments.slice(1).join('/'))
      }
    }
  }

  /** 参数校验 */
  if (!pickcode) {
    return createError({
      statusCode: 400,
      message: 'Missing pickcode'
    })
  }

  const userAgent = getHeader(event, 'user-agent') || ''
  const displayName = fileName || pickcode
  log.info('115直链', `请求: ${displayName}`)

  /** 获取直链 */
  const result = await getDirectLink(pickcode, userAgent, refresh, displayName)

  /** 错误处理 */
  if (!result.success || !result.url) {
    log.error('115直链', `获取失败: ${displayName} - ${result.error}`)
    return createError({
      statusCode: 500,
      message: result.error || '获取直链失败'
    })
  }

  /** 设置响应头并重定向 */
  setResponseHeaders(event, {
    'Location': result.url,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Accel-Buffering': 'no',
    'X-Content-Type-Options': 'nosniff',
    'Connection': 'keep-alive',
    'Keep-Alive': 'timeout=60'
  })

  /** 307临时重定向到直链地址 */
  sendRedirect(event, result.url, 307)
})
