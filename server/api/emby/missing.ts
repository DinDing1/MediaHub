/**
 * 缺失剧集检测 API
 * 
 * 功能说明：
 * 1. 获取媒体库列表
 * 2. 执行缺失剧集检测（支持流式返回）
 * 3. 返回检测结果
 * 
 * @module server/api/emby/missing
 */

import { defineEventHandler, getQuery, setResponseHeaders } from 'h3'
import { getMissingDetectionLibraries, analyzeMissingEpisodes, EmbyLibrary } from '../../utils/emby/missing_detection'
import { log } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  const method = event.method
  const query = getQuery(event)
  
  if (method === 'GET') {
    const action = query.action as string
    
    if (action === 'libraries') {
      try {
        const libraries = await getMissingDetectionLibraries()
        
        const tvLibraries = libraries.filter((lib: EmbyLibrary) => lib.CollectionType === 'tvshows')
        
        return {
          success: true,
          data: tvLibraries.map((lib: EmbyLibrary) => ({
            id: lib.Id,
            name: lib.Name,
            type: lib.CollectionType,
            typeLabel: '剧集',
            locations: lib.Locations
          }))
        }
      } catch (error: any) {
        log.error('缺失检测', `获取媒体库失败: ${error.message}`)
        return {
          success: false,
          error: error.message
        }
      }
    }
    
    if (action === 'analyze') {
      const libraryId = query.library_id as string || 'all'
      const stream = query.stream as string === 'true'
      
      log.info('缺失检测', `开始分析缺失剧集，媒体库: ${libraryId}, 流式: ${stream}`)
      
      if (stream) {
        setResponseHeaders(event, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        })
        
        const res = event.node.res
        
        const sendEvent = (data: any) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`)
        }
        
        sendEvent({ type: 'connected' })
        
        const result = await analyzeMissingEpisodes(
          libraryId === 'all' ? undefined : libraryId,
          (progress) => {
            sendEvent({
              type: 'progress',
              data: progress
            })
          }
        )
        
        sendEvent({
          type: 'complete',
          data: result
        })
        
        res.end()
        return
      }
      
      const result = await analyzeMissingEpisodes(
        libraryId === 'all' ? undefined : libraryId
      )
      
      return result
    }
    
    return {
      success: false,
      error: '未知的操作'
    }
  }
  
  return {
    success: false,
    error: '不支持的请求方法'
  }
})
