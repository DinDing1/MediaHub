/**
 * 导出查重报告 API 端点
 * 
 * 功能说明：
 * 导出最近一次查重分析的结果为 CSV 文件
 * 
 * @module server/api/emby/export_duplicates_report
 */

import { defineEventHandler, setResponseHeader } from 'h3'
import { getLastDuplicatesReport, DuplicateReportItem, DuplicateItem } from '../../utils/emby/duplicates'
import { log } from '../../utils/logger'

export default defineEventHandler((event) => {
  try {
    const report = getLastDuplicatesReport()

    if (!report || Object.keys(report).length === 0) {
      return {
        success: false,
        error: '没有可导出的报告，请先执行查重分析'
      }
    }

    // 生成 CSV 内容
    const lines: string[] = []
    lines.push('媒体库,标题,年份,ID,类型,重复文件')

    for (const [libName, items] of Object.entries(report)) {
      for (const item of items as DuplicateReportItem[]) {
        const title = item.title || ''
        const year = item.year || ''
        const id = item.id || ''
        const kind = item.kind === 'movie' ? '电影' : item.kind === 'series' ? '剧集' : '集'

        const paths = (item.items || []).map((sub: DuplicateItem) => `${sub.name} (${sub.path})`).join('\n')

        // CSV 转义
        const escapeCSV = (str: string) => {
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        }

        lines.push([
          escapeCSV(libName),
          escapeCSV(title),
          year,
          escapeCSV(id),
          kind,
          escapeCSV(paths)
        ].join(','))
      }
    }

    const csvContent = '\uFEFF' + lines.join('\n')

    // 设置响应头
    setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
    setResponseHeader(event, 'Content-Disposition', 'attachment; filename="duplicates_report.csv"')

    log.info('Emby Duplicates', '导出查重报告成功')

    return csvContent
  } catch (error: any) {
    log.error('Emby Duplicates', `导出报告失败: ${error.message}`)
    return {
      success: false,
      error: error.message
    }
  }
})
