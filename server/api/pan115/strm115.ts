/**
 * STRM 文件生成 API 端点
 * 
 * POST /api/pan115/strm115
 * 触发 STRM 文件生成
 */

import { generateStrmFiles } from '../../utils/pan115/strm_115'

export default defineEventHandler(async (event) => {
  const method = event.method
  
  if (method !== 'POST') {
    return createError({
      statusCode: 405,
      message: 'Method not allowed'
    })
  }
  
  const result = await generateStrmFiles()
  
  if (result.success) {
    return {
      success: true,
      totalFiles: result.totalFiles,
      generatedFiles: result.generatedFiles,
      skippedFiles: result.skippedFiles,
      elapsed: result.elapsed
    }
  } else {
    return {
      success: false,
      error: result.error
    }
  }
})
