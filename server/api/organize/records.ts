/**
 * 整理记录 API
 * GET: 获取整理记录列表
 * DELETE: 删除记录或清空
 */
import { 
  getOrganizeRecords, 
  getOrganizeRecordsCount, 
  deleteOrganizeRecord, 
  clearOrganizeRecords,
  OrganizeRecord 
} from '../../utils/db'

export default defineEventHandler(async (event) => {
  const method = event.method
  const query = getQuery(event)

  if (method === 'GET') {
    try {
      const rawLimit = Number(query.limit)
      const rawOffset = Number(query.offset)
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 200) : 100
      const offset = Number.isFinite(rawOffset) ? Math.max(Math.floor(rawOffset), 0) : 0
      const records = getOrganizeRecords(limit, offset)
      const total = getOrganizeRecordsCount()
      return { 
        success: true, 
        data: records,
        total 
      }
    } catch (error: any) {
      return { success: false, error: error.message || '获取记录失败' }
    }
  }

  if (method === 'DELETE') {
    try {
      if (query.id) {
        const id = parseInt(query.id as string)
        if (isNaN(id)) {
          return { success: false, error: '无效的记录ID' }
        }
        const deleted = deleteOrganizeRecord(id)
        return { 
          success: deleted, 
          message: deleted ? '记录已删除' : '记录不存在' 
        }
      } else if (query.clear === 'true') {
        const count = clearOrganizeRecords()
        return { 
          success: true, 
          message: `已清空 ${count} 条记录` 
        }
      }
      return { success: false, error: '缺少参数' }
    } catch (error: any) {
      return { success: false, error: error.message || '操作失败' }
    }
  }

  return { success: false, error: '不支持的请求方法: ' + method }
})
