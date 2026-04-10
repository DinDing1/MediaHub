import { getSetting } from '../db'
import { log } from '../logger'
import { enqueueRequest } from './request_queue'
import { resolvePathToId } from '../organize/fs_115'

const WEBAPI_BASE = 'https://webapi.115.com'

interface ShareInfo {
  shareCode: string
  receiveCode: string
}

interface SaveResult {
  success: boolean
  error?: string
  saveDir?: string
  saveDirId?: string
  fileCount?: number
  totalSize?: string
  message?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function getDefaultHeaders(cookie: string): Record<string, string> {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Cookie': cookie,
    'Referer': 'https://115.com/',
    'Content-Type': 'application/x-www-form-urlencoded',
  }
}

export function parseShareUrl(url: string): ShareInfo | null {
  if (!url) return null

  let u = url.trim()
  if (!u.startsWith('http')) {
    u = 'https://' + u
  }

  try {
    const parsedUrl = new URL(u)
    const host = parsedUrl.hostname.toLowerCase()
    const path = parsedUrl.pathname

    let shareCode: string | null = null

    if (path.includes('/s/')) {
      const parts = path.split('/s/')
      if (parts[1]) {
        const code = parts[1].split('/')[0]
        if (code) shareCode = code
      }
    } else {
      const segs = path.split('/').filter(s => s)
      if (segs.length > 0) {
        if (host.includes('115.com') && segs[0] === 's' && segs[1]) {
          shareCode = segs[1]
        } else if (segs[0]) {
          shareCode = segs[0]
        }
      }
    }

    let receiveCode: string | null = null
    const params = parsedUrl.searchParams
    for (const key of ['password', 'pwd', 'receive_code']) {
      const val = params.get(key)
      if (val) {
        receiveCode = val.trim()
        break
      }
    }

    if (!shareCode) return null

    return {
      shareCode: shareCode.trim(),
      receiveCode: receiveCode || ''
    }
  } catch {
    return null
  }
}

async function executeGetShareFiles(
  cookie: string,
  shareCode: string,
  receiveCode: string
): Promise<{ ids: string[]; totalSize: number }> {
  const ids: string[] = []
  let totalSize = 0
  let offset = 0
  const limit = 200

  while (true) {
    const params = new URLSearchParams({
      share_code: shareCode,
      receive_code: receiveCode,
      cid: '0',
      limit: String(limit),
      offset: String(offset)
    })

    const response = await fetch(`${WEBAPI_BASE}/share/snap?${params.toString()}`, {
      headers: getDefaultHeaders(cookie)
    })

    if (!response.ok) {
      throw new Error(`获取分享列表失败: ${response.status}`)
    }

    const result = await response.json()

    if (!result.state && result.errno !== 0) {
      throw new Error(result.error || result.errmsg || '获取分享列表失败')
    }

    const data = result.data || {}
    const items = data.list || []

    for (const item of items) {
      if (item.fid) {
        ids.push(String(item.fid))
      } else if (item.cid) {
        ids.push(String(item.cid))
      }

      const size = item.s || item.file_size || 0
      totalSize += parseInt(String(size), 10) || 0
    }

    const count = data.count || 0
    offset += limit

    if (items.length === 0 || (count && offset >= count) || offset >= 5000) {
      break
    }
  }

  return { ids, totalSize }
}

async function executeSaveShare(
  cookie: string,
  shareCode: string,
  receiveCode: string,
  fileIds: string[],
  saveCid: string
): Promise<{ success: boolean; error?: string }> {
  const params = new URLSearchParams({
    share_code: shareCode,
    receive_code: receiveCode,
    file_id: fileIds.join(','),
    cid: saveCid
  })

  const response = await fetch(`${WEBAPI_BASE}/share/receive`, {
    method: 'POST',
    headers: getDefaultHeaders(cookie),
    body: params.toString()
  })

  if (!response.ok) {
    return { success: false, error: `请求失败: ${response.status}` }
  }

  const result = await response.json()

  if (result.state !== true && result.errno !== 0) {
    return { success: false, error: result.error || result.errmsg || '转存失败' }
  }

  return { success: true }
}

async function executeGetPath(
  cookie: string,
  cid: string
): Promise<string> {
  const params = new URLSearchParams({
    file_id: cid,
    type: 'path'
  })

  const response = await fetch(`${WEBAPI_BASE}/files/getpath?${params.toString()}`, {
    headers: getDefaultHeaders(cookie)
  })

  if (!response.ok) {
    return cid
  }

  const result = await response.json()

  if (result.state !== true || !result.path) {
    return cid
  }

  return result.path.replace(/^\//, '')
}

export async function saveShareLink(shareUrl: string): Promise<SaveResult> {
  try {
    const shareInfo = parseShareUrl(shareUrl)
    if (!shareInfo) {
      return { success: false, error: '无效的115分享链接' }
    }

    if (!shareInfo.receiveCode) {
      return { success: false, error: '缺少提取码(password)' }
    }

    const cookie = getSetting('pan115_cookie')
    if (!cookie) {
      return { success: false, error: '未配置115云盘Cookie' }
    }

    const saveDirSetting = getSetting('pan115_save_dir')
    if (!saveDirSetting) {
      return { success: false, error: '未配置115保存目录' }
    }

    let saveCid = saveDirSetting
    if (!/^\d+$/.test(saveDirSetting)) {
      const resolveResult = await resolvePathToId(cookie, saveDirSetting)
      if (!resolveResult.success || !resolveResult.dirId) {
        return { success: false, error: `无法解析目录路径: ${resolveResult.error || '目录不存在'}` }
      }
      saveCid = resolveResult.dirId
    }

    const { ids, totalSize } = await enqueueRequest(
      () => executeGetShareFiles(cookie, shareInfo.shareCode, shareInfo.receiveCode),
      '获取分享文件列表'
    )
    log.info('115分享转存', `获取到 ${ids.length} 个文件，总大小: ${formatSize(totalSize)}`)

    if (ids.length === 0) {
      return { success: false, error: '分享为空或无法获取分享列表' }
    }

    const saveResult = await enqueueRequest(
      () => executeSaveShare(cookie, shareInfo.shareCode, shareInfo.receiveCode, ids, saveCid),
      '转存分享文件'
    )

    if (!saveResult.success) {
      return { success: false, error: saveResult.error }
    }

    let saveDirPath = saveDirSetting
    try {
      saveDirPath = await executeGetPath(cookie, saveCid)
    } catch {
      saveDirPath = saveDirSetting
    }

    log.info('115分享转存', `转存成功: ${saveDirPath}, ${ids.length}个文件`)

    return {
      success: true,
      saveDir: saveDirPath,
      saveDirId: saveCid,
      fileCount: ids.length,
      totalSize: formatSize(totalSize),
      message: `成功转存 ${ids.length} 个文件/目录`
    }
  } catch (e: any) {
    log.error('115分享转存', `转存失败: ${e.message}`)
    return { success: false, error: e.message }
  }
}

export function is115ShareUrl(text: string): string | null {
  const patterns = [
    /https?:\/\/115cdn\.com\/s\/[A-Za-z0-9]+[^\s]*/i,
    /https?:\/\/115\.com\/s\/[A-Za-z0-9]+[^\s]*/i,
    /https?:\/\/share\.115\.com\/[A-Za-z0-9]+[^\s]*/i,
    /115cdn\.com\/s\/[A-Za-z0-9]+[^\s]*/i,
    /115\.com\/s\/[A-Za-z0-9]+[^\s]*/i,
    /share\.115\.com\/[A-Za-z0-9]+[^\s]*/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      let url = match[0]
      if (!url.startsWith('http')) {
        url = 'https://' + url
      }
      url = url.trim().replace(/[).\],，。】》\"']+$/, '')
      if (url.startsWith('http://')) {
        url = 'https://' + url.substring(7)
      }
      return url
    }
  }

  return null
}
