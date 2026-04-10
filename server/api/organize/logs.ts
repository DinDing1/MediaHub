/**
 * 整理日志API
 * 使用Server-Sent Events实时推送日志
 */
import { logEmitter } from '../../utils/logger'

interface LogEntry {
  time: string
  level: 'info' | 'success' | 'warn' | 'error'
  tag: string
  message: string
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  
  if (query.sse === 'true') {
    setResponseHeaders(event, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    })
    
    const eventStream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        
        const sendLog = (entry: LogEntry) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`))
          } catch (e) {}
        }
        
        const unsubscribe = logEmitter.subscribe('整理', sendLog)
        
        logEmitter.getRecentLogs('整理').forEach(entry => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`))
          } catch (e) {}
        })
        
        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'))
          } catch (e) {
            clearInterval(keepAlive)
            unsubscribe()
          }
        }, 15000)
        
        const timeout = setTimeout(() => {
          clearInterval(keepAlive)
          unsubscribe()
          try {
            controller.close()
          } catch (e) {}
        }, 300000)
        
        event.node.req.on('close', () => {
          clearTimeout(timeout)
          clearInterval(keepAlive)
          unsubscribe()
        })
      }
    })
    
    return sendStream(event, eventStream)
  }
  
  return { logs: logEmitter.getRecentLogs('整理') }
})
