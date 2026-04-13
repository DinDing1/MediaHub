/**
 * Emby图片代理API
 * 用于获取Emby服务器上的媒体图片
 */
import { getImage } from '../../../utils/emby/emby'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    const query = getQuery(event)
    const tag = query.tag as string
    const type = (query.type as string) || 'Primary'

    if (!id || !tag) {
      return sendError(event, createError({ statusCode: 400, message: 'Missing parameters' }))
    }

    const imageData = await getImage(id, tag, type)

    if (!imageData) {
      return sendError(event, createError({ statusCode: 404, message: 'Image not found' }))
    }

    // 设置缓存头，缓存5分钟
    setResponseHeader(event, 'Content-Type', 'image/jpeg')
    setResponseHeader(event, 'Cache-Control', 'public, max-age=300')

    return imageData
  } catch (error: any) {
    return sendError(event, createError({ statusCode: 500, message: error.message }))
  }
})
