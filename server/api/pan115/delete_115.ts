/**
 * 115云盘删除API
 * 用于删除文件或文件夹
 */
import { deleteItems } from '../../utils/organize/fs_115'
import { getSetting } from '../../utils/db'

export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') {
    return { success: false, error: '只支持POST请求' }
  }

  const body = await readBody(event)
  const { fileIds } = body

  if (!fileIds) {
    return { success: false, error: '缺少fileIds参数' }
  }

  const cookie = getSetting('pan115_cookie')
  if (!cookie) {
    return { success: false, error: '未配置Cookie' }
  }

  const result = await deleteItems(cookie, fileIds)
  return result
})
