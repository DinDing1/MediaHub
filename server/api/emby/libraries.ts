/**
 * 媒体库列表 API
 * 
 * 返回 Emby 服务器上的所有媒体库信息
 * 
 * 功能说明：
 * - 检查 Emby 是否已配置
 * - 获取所有媒体库的列表
 * - 返回媒体库的基本信息（ID、名称、类型、路径）
 * 
 * 返回数据：
 * - success: 是否成功
 * - hasConfig: Emby 是否已配置
 * - data: 媒体库列表
 *   - Id: 媒体库唯一标识
 *   - Name: 媒体库名称
 *   - CollectionType: 媒体库类型（movies、tvshows、music等）
 *   - Locations: 媒体库路径列表
 * - error: 错误信息（失败时）
 * 
 * 使用场景：
 * - 封面生成器：选择要生成封面的媒体库
 * - 缺失检测：选择要检测的媒体库
 * - 其他需要媒体库列表的功能
 * 
 * @module server/api/emby/libraries
 * @author FNOS Media Dashboard
 * @version 1.0.0
 */

import { defineEventHandler } from 'h3'
import { getEmbyConfig, getLibraries } from '../../utils/emby/emby'
import { log } from '../../utils/logger'

export default defineEventHandler(async () => {
  try {
    // 检查 Emby 配置是否存在
    const config = await getEmbyConfig()
    
    // 如果没有配置，返回提示信息
    if (!config || !config.baseUrl || !config.apiKey) {
      return {
        success: false,
        error: 'Emby未配置',
        hasConfig: false,
        data: []
      }
    }
    
    // 获取媒体库列表
    const libraries = await getLibraries()
    
    // 转换为前端需要的格式
    return {
      success: true,
      hasConfig: true,
      data: libraries.map(lib => ({
        Id: lib.id,
        Name: lib.name,
        CollectionType: lib.type,
        TypeLabel: lib.typeLabel,
        Locations: lib.locations
      }))
    }
  } catch (e: any) {
    log.error('媒体库', `获取失败: ${e.message}`)
    return {
      success: false,
      error: e.message,
      hasConfig: true,
      data: []
    }
  }
})
