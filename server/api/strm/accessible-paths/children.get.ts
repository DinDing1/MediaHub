/**
 * GET /api/strm/accessible-paths/children?path=
 * 列出授权目录下的一层子目录；path 为空时返回授权根目录列表
 */
import { listAccessibleChildren } from '../../../utils/accessible_paths'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const path = typeof query.path === 'string' ? query.path : ''
  const result = listAccessibleChildren(path)
  return {
    success: true,
    data: result
  }
})
