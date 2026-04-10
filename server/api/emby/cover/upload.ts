/**
 * 封面上传 API
 * 
 * 将生成的封面图片上传到 Emby 媒体库，设置为媒体库的主图片
 * 
 * 功能说明：
 * - 接收媒体库ID和Base64编码的图片数据
 * - 调用 Emby API 上传图片
 * - 上传成功后，Emby 会自动刷新媒体库显示
 * 
 * 请求参数：
 * - library_id: 媒体库ID（必填）
 * - image: Base64 编码的图片数据（必填）
 * 
 * 返回数据：
 * - success: 是否成功
 * - error: 错误信息（失败时）
 * 
 * 注意事项：
 * - 图片格式必须为 JPEG
 * - 上传会覆盖媒体库原有的封面图片
 * - 需要 Emby 管理员权限
 * 
 * @module server/api/emby/cover/upload
 * @author FNOS Media Dashboard
 * @version 1.0.0
 */

import { defineEventHandler, readBody } from 'h3'
import { uploadCoverToEmby } from '../../../utils/emby/cover_generator'
import { log } from '../../../utils/logger'

export default defineEventHandler(async (event) => {
  // 解析请求体
  const body = await readBody(event)
  const { library_id, image } = body
  
  // 验证必填参数
  if (!library_id) {
    return { success: false, error: '缺少媒体库 ID' }
  }
  
  if (!image) {
    return { success: false, error: '缺少图片数据' }
  }
  
  try {
    // 调用上传函数
    await uploadCoverToEmby(library_id, image)
    
    return { success: true }
  } catch (e: any) {
    log.error('封面生成', `上传失败: ${e.message}`)
    return { success: false, error: e.message }
  }
})
