/**
 * Emby 剧集查重 API 端点
 * 
 * 功能说明：
 * 1. 扫描媒体库中的重复内容
 * 2. 支持电影和电视剧查重
 * 3. 检测多版本合并和未合并的重复项
 * 4. 使用 SSE 实时推送查重结果
 * 
 * @module server/api/emby/analyze_duplicates
 */

import { defineEventHandler, readBody, setResponseHeaders } from 'h3'
import { analyzeDuplicates, setLastDuplicatesReport, ProgressInfo, DuplicateReportItem } from '../../utils/emby/duplicates'
import { log } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'POST') {
    try {
      const body = await readBody(event)
      const libraryId = body?.library_id || null
      const stream = body?.stream === true

      log.info('剧集查重', `开始查重分析: ${libraryId || '全部媒体库'}`)

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

        const result = await analyzeDuplicates(
          libraryId,
          (info: ProgressInfo & { library?: string; item?: DuplicateReportItem }) => {
            sendEvent({
              type: 'progress',
              data: info
            })
          }
        )

        setLastDuplicatesReport(result.data)

        sendEvent({
          type: 'complete',
          data: {
            success: true,
            data: result.data,
            errors: result.errors
          }
        })

        log.info('剧集查重', `查重完成: ${Object.keys(result.data).length} 个媒体库, ${result.errors.length} 个错误`)

        res.end()
        return
      }

      const progressCallback = (info: ProgressInfo) => {
        log.info('剧集查重', info.message)
      }

      const result = await analyzeDuplicates(libraryId, progressCallback)

      setLastDuplicatesReport(result.data)

      log.info('剧集查重', `查重完成: ${Object.keys(result.data).length} 个媒体库, ${result.errors.length} 个错误`)

      return {
        success: true,
        data: result.data,
        errors: result.errors
      }
    } catch (error: any) {
      log.error('剧集查重', `查重失败: ${error.message}`)
      return {
        success: false,
        error: error.message
      }
    }
  }

  return {
    success: false,
    error: '不支持的请求方法'
  }
})
