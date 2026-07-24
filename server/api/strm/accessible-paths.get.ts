/**
 * GET /api/strm/accessible-paths
 * 获取飞牛授权目录列表
 */
import { getAccessiblePaths } from '../../utils/accessible_paths'

export default defineEventHandler(() => {
  const paths = getAccessiblePaths()
  return {
    success: true,
    data: { paths }
  }
})
