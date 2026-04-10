/**
 * TMDB 剧集纠错 API
 * 
 * 该模块提供了 TMDB 剧集数据的纠错功能 API 接口。
 * 由于 TMDB 上的剧集集数信息可能存在错误，用户可以手动纠错并持久化到数据库。
 * 
 * 功能说明：
 * - GET ?action=list - 获取所有纠错记录列表
 * - GET ?action=get&tmdb_id=xxx - 获取指定剧集的纠错记录
 * - POST - 添加或更新纠错记录
 * - DELETE ?tmdb_id=xxx - 删除纠错记录
 * 
 * 数据流程：
 * 1. 用户在前端点击"纠错"按钮，输入实际集数
 * 2. 前端调用 POST 接口保存纠错数据到数据库
 * 3. 下次缺失检测时，后端会自动读取纠错数据并应用
 * 4. 用户可以取消纠错，数据会从数据库中移除
 * 
 * @module server/api/emby/correction
 */

import { defineEventHandler, getQuery, readBody } from 'h3'
import { getTMDBCorrection, getAllTMDBCorrections, setTMDBCorrection, deleteTMDBCorrection } from '../../utils/db'
import { log } from '../../utils/logger'

/**
 * TMDB 剧集纠错 API 处理器
 * 
 * 支持的请求方法：
 * - GET: 查询纠错记录
 *   - action=list: 获取所有纠错记录
 *   - action=get&tmdb_id=xxx: 获取指定剧集的纠错记录
 * - POST: 添加或更新纠错记录
 *   - body: { tmdb_id, show_name, correct_total_episodes, note? }
 * - DELETE: 删除纠错记录
 *   - query: tmdb_id
 */
export default defineEventHandler(async (event) => {
  const method = event.method
  const query = getQuery(event)
  
  // ==================== GET 请求：查询纠错记录 ====================
  if (method === 'GET') {
    const action = query.action as string
    
    // 获取所有纠错记录列表
    // 用于管理页面展示所有已纠错的剧集
    if (action === 'list') {
      const corrections = getAllTMDBCorrections()
      return {
        success: true,
        data: corrections
      }
    }
    
    // 获取指定剧集的纠错记录
    // 用于检测剧集缺失时判断是否有纠错数据
    if (action === 'get') {
      const tmdbId = query.tmdb_id as string
      if (!tmdbId) {
        return { success: false, error: '缺少 tmdb_id 参数' }
      }
      const correction = getTMDBCorrection(tmdbId)
      return {
        success: true,
        data: correction
      }
    }
    
    return { success: false, error: '未知的操作' }
  }
  
  // ==================== POST 请求：添加/更新纠错记录 ====================
  if (method === 'POST') {
    try {
      const body = await readBody(event)
      const { tmdb_id, show_name, correct_total_episodes, note } = body
      
      // 参数校验：tmdb_id、show_name、correct_total_episodes 为必填项
      if (!tmdb_id || !show_name || correct_total_episodes === undefined) {
        return { success: false, error: '缺少必要参数' }
      }
      
      // 保存纠错记录到数据库（如果已存在则更新）
      setTMDBCorrection(tmdb_id, show_name, correct_total_episodes, note)
      log.info('TMDB纠错', `已添加纠错: ${show_name} (TMDB ID: ${tmdb_id}) -> ${correct_total_episodes} 集`)
      
      return { success: true }
    } catch (e: any) {
      log.error('TMDB纠错', `添加失败: ${e.message}`)
      return { success: false, error: e.message }
    }
  }
  
  // ==================== DELETE 请求：删除纠错记录 ====================
  if (method === 'DELETE') {
    try {
      const tmdbId = query.tmdb_id as string
      if (!tmdbId) {
        return { success: false, error: '缺少 tmdb_id 参数' }
      }
      
      // 从数据库中删除纠错记录
      const deleted = deleteTMDBCorrection(tmdbId)
      if (deleted) {
        log.info('TMDB纠错', `已移除纠错: ${tmdbId}`)
        return { success: true }
      } else {
        return { success: false, error: '未找到纠错记录' }
      }
    } catch (e: any) {
      log.error('TMDB纠错', `移除失败: ${e.message}`)
      return { success: false, error: e.message }
    }
  }
  
  return { success: false, error: '不支持的请求方法' }
})
