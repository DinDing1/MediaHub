/**
 * 封面预览 API
 * 
 * 根据用户配置生成封面预览图片，返回 Base64 编码的图片数据
 * 
 * 功能说明：
 * - 接收用户选择的媒体库、字体、标题等参数
 * - 调用封面生成器生成封面图片
 * - 返回 Base64 编码的图片供前端预览显示
 * 
 * 请求参数：
 * - library_id: 媒体库ID（必填）
 * - zh_font: 中文字体ID（可选，默认霞鹜文楷）
 * - en_font: 英文字体ID（可选，默认Montserrat Bold）
 * - zh_title: 自定义中文标题（可选，默认使用媒体库名称）
 * - en_title: 自定义英文标题（可选）
 * - mode: 图片选择模式（可选，默认随机）
 *   - random: 随机选择
 *   - tmdb_rating: 按评分排序
 *   - premiere_date: 按上映日期排序
 *   - recent_added: 按添加时间排序
 * 
 * 返回数据：
 * - success: 是否成功
 * - image: Base64 编码的 JPEG 图片（成功时）
 * - size: 图片尺寸 { width, height }（成功时）
 * - error: 错误信息（失败时）
 * 
 * @module server/api/emby/cover/preview
 * @author FNOS Media Dashboard
 * @version 1.0.0
 */

import { defineEventHandler, readBody } from 'h3'
import { generateCover } from '../../../utils/emby/cover_generator'
import { getLibraries } from '../../../utils/emby/emby'
import { log } from '../../../utils/logger'

export default defineEventHandler(async (event) => {
  // 解析请求体
  const body = await readBody(event)
  const { library_id, zh_font, en_font, zh_title, en_title, mode } = body
  
  // 验证必填参数
  if (!library_id) {
    return { success: false, error: '缺少媒体库 ID' }
  }

  try {
    // 获取媒体库列表，查找对应的媒体库名称
    const libraries = await getLibraries()
    const library = libraries.find(lib => lib.id === library_id)

    if (!library) {
      return { success: false, error: '未找到媒体库' }
    }
    
    // 调用封面生成器
    const result = await generateCover({
      libraryId: library_id,
      libraryName: library.name,
      zhFont: zh_font || 'zh_lxgwwenkai',      // 默认使用霞鹜文楷
      enFont: en_font || 'en_montserrat_bold', // 默认使用 Montserrat Bold
      zhTitle: zh_title,
      enTitle: en_title,
      mode: mode || 'random'                    // 默认随机模式
    })
    
    if (!result) {
      return { success: false, error: '生成封面失败，媒体库中没有可用的图片' }
    }
    
    return {
      success: true,
      image: result.image,
      size: result.size
    }
  } catch (e: any) {
    log.error('封面生成', `预览失败: ${e.message}`)
    return { success: false, error: e.message }
  }
})
