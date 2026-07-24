/**
 * 115云盘文件操作模块
 * 提供文件列表、移动、复制、重命名、创建目录、删除等操作
 * 使用请求队列控制API频率，避免触发风控
 * 集成缓存管理器，减少API调用
 * 支持批量移动和批量复制操作
 */

import { log } from '../logger'
import { enqueueRequest } from '../pan115/request_queue'
import { getFsCache } from './fs_cache'
import { getSetting, setSetting } from '../db'
import { tryRefreshToken, getAccessTokenByCookie, saveOpenToken } from '../pan115/open115'
import type { FileItem } from './types'

interface FsOperationResult {
  success: boolean
  error?: string
  data?: any
  newFileId?: string
}

interface DirectoryInfo {
  id: string
  name: string
  parentId: string
  pickcode?: string
}

interface ListFilesResult {
  success: boolean
  files?: FileItem[]
  error?: string
}

interface MkdirResult {
  success: boolean
  dirId?: string
  error?: string
}




/** webapi 备用域名（p115client 风控时轮换） */
const WEBAPI_ORIGINS = [
  'https://webapi.115.com',
  'http://web.api.115.com',
  'https://proapi.115.com',
  'https://115cdn.com/webapi',
  'https://115vod.com/webapi',
]

const APS_FILES_URL = 'https://aps.115.com/natsort/files.php'
const OPEN_FILES_URL = 'https://proapi.115.com/open/ufile/files'
const PROAPI_BASE = 'https://proapi.115.com'
const WEBAPI_BASE = 'https://webapi.115.com'

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function getDefaultHeaders(cookie: string, withFormContentType = false): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': BROWSER_UA,
    'Cookie': cookie,
    'Referer': 'https://115.com/',
    'Origin': 'https://115.com',
    'Accept': 'application/json, text/plain, */*',
  }
  if (withFormContentType) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
  }
  return headers
}

function isDirectoryItem(item: Record<string, any>): boolean {
  if (item == null) return false
  if (item.is_dir === true || item.is_dir === 1 || item.is_dir === '1') return true
  if (item.is_dir === false || item.is_dir === 0 || item.is_dir === '0') return false

  // open/app: fc/file_category  0=dir 1=file
  if (item.fc !== undefined && item.fc !== null && String(item.fc) !== '') {
    return String(item.fc) === '0'
  }
  if (item.file_category !== undefined && item.file_category !== null && String(item.file_category) !== '') {
    return String(item.file_category) === '0'
  }

  // webapi: file has fid; directory usually does not
  if (item.fid !== undefined && item.fid !== null && String(item.fid) !== '') {
    return false
  }
  if ((item.pick_code || item.pc || item.sha1 || item.sha) && (item.file_id || item.fid)) {
    if (item.cid && !item.fid && String(item.cid) === String(item.file_id || '')) {
      return true
    }
    return false
  }
  return true
}

function mapFileItem(item: Record<string, any>, parentCid: string): FileItem {
  const isFolder = isDirectoryItem(item)
  const fileId = isFolder
    ? String(item.cid ?? item.file_id ?? item.id ?? '')
    : String(item.fid ?? item.file_id ?? item.id ?? '')

  return {
    type: isFolder ? 'folder' : 'file',
    is_dir: isFolder,
    name: String(item.n || item.file_name || item.name || ''),
    fileId,
    cid: String(item.cid ?? item.file_id ?? item.fid ?? item.id ?? ''),
    parentId: String(item.pid ?? item.parent_id ?? parentCid),
    size: Number(item.s ?? item.file_size ?? item.size ?? 0) || 0,
    updatedAt: item.t || item.user_utime || item.date || null,
    pickcode: String(item.pc ?? item.pick_code ?? item.pickcode ?? '')
  }
}

// p115client default params
function buildDefaultListParams(cid: string, extra: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams({
    aid: '1',
    cid: String(cid || '0'),
    offset: '0',
    limit: '1000',
    show_dir: '1',
    count_folders: '1',
    record_open_time: '1',
    ...extra
  })
}

function extractListArray(body: any): any[] | null {
  if (!body) return null
  if (Array.isArray(body.data)) return body.data
  if (Array.isArray(body.data?.list)) return body.data.list
  if (Array.isArray(body.data?.data)) return body.data.data
  if (Array.isArray(body.list)) return body.list
  return null
}

function isListSuccess(body: any): boolean {
  if (!body || typeof body !== 'object') return false
  if (body.state === true) return true
  if (body.code === 0 || body.code === '0') return true
  if (body.errno === 0 || body.errNo === 0) return true
  if (extractListArray(body) && body.state == null && body.code == null && body.errno == null) {
    return true
  }
  return false
}

function listErrorMessage(body: any, status: number): string {
  if (!body) return 'HTTP ' + status
  const msg = body.error || body.message || body.msg || body.error_msg
  const code = body.errno ?? body.errNo ?? body.code ?? body.msg_code
  if (msg) return code != null ? String(msg) + ' (code=' + code + ')' : String(msg)
  return 'HTTP ' + status
}

function isRiskControl(status: number, body: any, errText: string): boolean {
  if (status === 405 || status === 403) return true
  const text = ((errText || '') + ' ' + JSON.stringify(body || {})).toLowerCase()
  return /405|too many|forbidden|风控|拒绝访问|频繁|禁止/i.test(text)
}

function isAuthError(status: number, body: any, errText: string): boolean {
  if (status === 401) return true
  const text = (errText || '') + ' ' + JSON.stringify(body || {})
  return /99|token|unauthorized|login/i.test(text)
    || /重新登录|请先登录|登录失效|未登录/.test(text)
}

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs = 10000
): Promise<{ ok: boolean; status: number; body?: any; error?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { redirect: 'follow', ...init, signal: controller.signal })
    const status = response.status
    const text = await response.text()
    let body: any = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      return {
        ok: false,
        status,
        error: 'non-json(' + status + '): ' + text.replace(/\s+/g, ' ').slice(0, 120)
      }
    }
    if (!response.ok) {
      return { ok: false, status, body, error: listErrorMessage(body, status) }
    }
    return { ok: true, status, body }
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? ('timeout ' + timeoutMs + 'ms') : (e?.message || String(e))
    return { ok: false, status: 0, error: msg }
  } finally {
    clearTimeout(timer)
  }
}

function getOpenTokenIfValid(): string | null {
  const token = (getSetting('pan115_open_token') || '').trim()
  return token || null
}

async function ensureOpenToken(cookie: string): Promise<string | null> {
  const existing = getOpenTokenIfValid()
  if (existing) return existing

  const appId = ((getSetting('pan115_app_id') || '').trim() || '100195137')
  if (!cookie?.trim()) return null

  try {
    if (!(getSetting('pan115_app_id') || '').trim()) {
      setSetting('pan115_app_id', appId)
    }
    console.log('[115-list] ensure open token, appId=', appId)
    log.info('115??', '????????????? Token')
    const result = await getAccessTokenByCookie(cookie, appId)
    if (result.success && result.openToken && result.refreshToken && result.expiresIn) {
      saveOpenToken(result.openToken, result.refreshToken, result.expiresIn)
      console.log('[115-list] open token acquired')
      log.success('115????', '??????')
      return result.openToken
    }
    console.warn('[115-list] open token failed:', result.error || 'unknown')
    log.warn('115????', '??????: ' + (result.error || 'unknown'))
  } catch (e: any) {
    log.warn('115-open', 'auto auth error: ' + (e?.message || e))
  }
  return null
}

async function tryOpenApiList(cid: string, tokenHint?: string | null): Promise<ListFilesResult | null> {
  let token = (tokenHint || getOpenTokenIfValid() || '').trim()
  if (!token) return null

  const params = buildDefaultListParams(cid)
  const url = OPEN_FILES_URL + '?' + params.toString()
  const headers: Record<string, string> = {
    'User-Agent': BROWSER_UA,
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json, text/plain, */*'
  }

  let result = await fetchJson(url, { method: 'GET', headers })
  if (!isListSuccess(result.body)) {
    const msg = result.error || listErrorMessage(result.body, result.status)
    if (isAuthError(result.status, result.body, msg) || /token|401|403|99/i.test(msg)) {
      const refreshed = await tryRefreshToken().catch(() => false)
      if (refreshed) {
        token = getOpenTokenIfValid() || ''
        if (token) {
          headers.Authorization = 'Bearer ' + token
          result = await fetchJson(url, { method: 'GET', headers })
        }
      }
    }
  }

  if (isListSuccess(result.body)) {
    const arr = extractListArray(result.body)
    if (arr) {
      console.log('[115-list] open api OK count=', arr.length)
      log.info('115??', '???????? count=' + arr.length)
      return { success: true, files: arr.map((item) => mapFileItem(item, cid)) }
    }
  }

  console.warn('[115-list] open api failed:', result.error || listErrorMessage(result.body, result.status))
  log.warn('115??', '????????: ' + (result.error || listErrorMessage(result.body, result.status)))
  return null
}

type ListCandidate = {
  name: string
  url: string
  headers: Record<string, string>
  method?: 'GET' | 'POST'
  body?: string
}

async function tryCookieList(cookie: string, cid: string): Promise<ListFilesResult> {
  const loginApp = (getSetting('pan115_login_app') || 'web').trim() || 'web'
  const headers = getDefaultHeaders(cookie, false)
  const formHeaders = getDefaultHeaders(cookie, true)

  const paramsDefault = buildDefaultListParams(cid)
  const paramsDirsOnly = buildDefaultListParams(cid, { nf: '1', show_dir: '1', cur: '1' })
  
  const candidates: ListCandidate[] = []

  // Keep a short prioritized list (first success wins). Order matters under 115 risk-control.
  candidates.push({ name: 'aps:default', url: APS_FILES_URL + '?' + paramsDefault.toString(), headers })
  candidates.push({ name: 'aps:bare', url: APS_FILES_URL + '?' + new URLSearchParams({ cid: String(cid || '0'), show_dir: '1' }).toString(), headers })
  candidates.push({
    name: 'proapi:' + loginApp + '/2.0/ufile/files',
    url: PROAPI_BASE + '/' + loginApp + '/2.0/ufile/files?' + paramsDefault.toString(),
    headers
  })
  candidates.push({
    name: 'proapi:android/2.0/ufile/files',
    url: PROAPI_BASE + '/android/2.0/ufile/files?' + paramsDefault.toString(),
    headers
  })
  candidates.push({ name: 'webapi:main', url: WEBAPI_BASE + '/files?' + paramsDefault.toString(), headers })
  candidates.push({ name: 'webapi:bare', url: WEBAPI_BASE + '/files?' + new URLSearchParams({ cid: String(cid || '0'), show_dir: '1' }).toString(), headers })
  candidates.push({ name: 'aps:dirs', url: APS_FILES_URL + '?' + paramsDirsOnly.toString(), headers })
  candidates.push({
    name: 'proapi:' + loginApp + '/files',
    url: PROAPI_BASE + '/' + loginApp + '/files?' + paramsDefault.toString(),
    headers
  })
  candidates.push({
    name: 'webapi:POST',
    url: WEBAPI_BASE + '/files',
    headers: formHeaders,
    method: 'POST',
    body: paramsDefault.toString()
  })
  candidates.push({
    name: 'aps:POST',
    url: APS_FILES_URL,
    headers: formHeaders,
    method: 'POST',
    body: paramsDefault.toString()
  })
  // extra origins last
  for (const origin of WEBAPI_ORIGINS) {
    if (origin === WEBAPI_BASE || origin === PROAPI_BASE) continue
    candidates.push({
      name: 'webapi:' + origin,
      url: origin.replace(/\/$/, '') + '/files?' + paramsDefault.toString(),
      headers
    })
  }

  const errors: string[] = []
  let riskHits = 0

  // Prefer first successful channel; log every attempt for diagnose
  const maxAttempts = Math.min(candidates.length, 14)
  for (let i = 0; i < maxAttempts; i++) {
    const c = candidates[i]
    console.log('[115-list] try', i + 1 + '/' + maxAttempts, c.name)
    const result = await fetchJson(c.url, {
      method: c.method || 'GET',
      headers: c.headers,
      body: c.body
    }, 8000)

    if (isListSuccess(result.body)) {
      const arr = extractListArray(result.body)
      if (arr) {
        console.log('[115-list] OK via', c.name, 'count=', arr.length)
        log.info('115云盘', '列表成功 via ' + c.name + ', count=' + arr.length)
        return { success: true, files: arr.map((item) => mapFileItem(item, cid)) }
      }
      errors.push(c.name + ' => success but no data array')
      console.warn('[115-list] success body without array:', c.name)
      continue
    }

    const msg = result.error || listErrorMessage(result.body, result.status)
    console.warn('[115-list] fail', c.name, '=>', msg)
    if (isRiskControl(result.status, result.body, msg)) riskHits++
    errors.push(c.name + ' => ' + msg)
  }

  log.error('115云盘', 'Cookie 通道列表全部失败: ' + errors.slice(0, 12).join(' | '))
  console.error('[115-list] all cookie channels failed', errors.slice(0, 8))

  if (riskHits > 0 && riskHits >= Math.min(3, errors.length)) {
    return {
      success: false,
      error: "115 接口风控(HTTP 405)?Cookie 仍可能有效，但 /files 通道被限制。请确认开放平台 AppID，重新扫码登录以获取 Token；或改用 android 设备类型扫码后重试。" + '(共尝试 ' + errors.length + ' 路)'
    }
  }

  const prefer = errors.find(e => /405|risk|风控/.test(e)) || errors[errors.length - 1] || "获取文件列表失败"
  return {
    success: false,
    error: prefer + (errors.length > 1 ? ('(共尝试 ' + errors.length + ' 路)') : '')
  }
}

async function executeListFiles(
  cookie: string,
  cid: string
): Promise<ListFilesResult> {
  if (!cookie || !cookie.trim()) {
    return { success: false, error: "Cookie为空" }
  }

  console.log('[115-list] executeListFiles cid=', cid, 'cookieLen=', cookie.length)
  const openToken = await ensureOpenToken(cookie)
  console.log('[115-list] openToken present=', !!openToken)
  const openResult = await tryOpenApiList(cid, openToken)
  if (openResult?.success) return openResult

  console.log('[115-list] fallback to cookie channels')
  return tryCookieList(cookie, cid)
}


export async function listFiles(
  cookie: string,
  cid: string = '0',
  useCache: boolean = true
): Promise<ListFilesResult> {
  const cache = getFsCache()
  
  if (useCache) {
    const cachedFiles = cache.getDirChildren(cid)
    if (cachedFiles) {
      log.info('115云盘', `使用缓存: 目录 ${cid} (${cachedFiles.length} 个文件)`)
      return { success: true, files: cachedFiles }
    }
  }
  
  try {
    const result = await enqueueRequest(
      () => executeListFiles(cookie, cid),
      `获取文件列表(cid=${cid})`
    )
    
    if (result.success && result.files) {
      cache.setDirChildren(cid, result.files)
    }
    
    return result
  } catch (e: any) {
    log.error('115云盘', `获取文件列表异常: ${e.message}`)
    return { success: false, error: e.message }
  }
}

async function executeMkdir(
  cookie: string,
  parentId: string,
  name: string
): Promise<MkdirResult> {
  if (!cookie || !cookie.trim()) {
    return { success: false, error: 'Cookie为空' }
  }

  if (!name || !name.trim()) {
    return { success: false, error: '目录名不能为空' }
  }

  const params = new URLSearchParams({
    cname: name.trim(),
    pid: parentId
  })

  const response = await fetch(`${WEBAPI_BASE}/files/add`, {
    method: 'POST',
    headers: getDefaultHeaders(cookie, true),
    body: params.toString()
  })

  if (!response.ok) {
    return { success: false, error: `${response.status} ${response.statusText}` }
  }

  const result = await response.json()

  if (result.state !== true && result.errno !== 0) {
    const errorMsg = result.error || result.errmsg || '创建目录失败'
    return { success: false, error: errorMsg }
  }

  const dirId = result.cid || result.file_id || result.data?.category_id || result.data?.id || result.category_id || result.id

  return { success: true, dirId: String(dirId) }
}

export async function mkdir(
  cookie: string,
  parentId: string,
  name: string
): Promise<MkdirResult> {
  try {
    const result = await enqueueRequest(
      () => executeMkdir(cookie, parentId, name),
      `创建目录: ${name}`
    )
    
    if (result.success && result.dirId) {
      const cache = getFsCache()
      const newDir: FileItem = {
        type: 'folder',
        is_dir: true,
        name: name.trim(),
        fileId: result.dirId,
        cid: result.dirId,
        parentId: parentId,
        size: 0,
        updatedAt: null,
        pickcode: ''
      }
      cache.addDirChild(parentId, newDir)
    }
    
    return result
  } catch (e: any) {
    log.error('115云盘', `创建目录异常: ${e.message}`)
    return { success: false, error: e.message }
  }
}

async function executeMoveFile(
  cookie: string,
  fileId: string,
  targetDirId: string
): Promise<FsOperationResult> {
  if (!cookie || !cookie.trim()) {
    return { success: false, error: 'Cookie为空' }
  }

  const params = new URLSearchParams({
    fid: fileId,
    pid: targetDirId
  })

  const response = await fetch(`${WEBAPI_BASE}/files/move`, {
    method: 'POST',
    headers: getDefaultHeaders(cookie, true),
    body: params.toString()
  })

  if (!response.ok) {
    return { success: false, error: `请求失败: ${response.status}` }
  }

  const result = await response.json()

  if (result.state !== true && result.errno !== 0) {
    const errorMsg = result.error || result.errmsg || '移动失败'
    return { success: false, error: errorMsg }
  }

  return { success: true, data: result }
}

export async function moveFile(
  cookie: string,
  fileId: string,
  targetDirId: string,
  sourceDirId?: string,
  fileName?: string
): Promise<FsOperationResult> {
  try {
    const result = await enqueueRequest(
      () => executeMoveFile(cookie, fileId, targetDirId),
      `移动文件: ${fileId} -> ${targetDirId}`
    )
    
    if (result.success && sourceDirId && fileName) {
      const cache = getFsCache()
      const cachedFile = cache.getDirChild(sourceDirId, fileName)
      if (cachedFile) {
        cache.removeDirChild(sourceDirId, fileName)
        cache.addDirChild(targetDirId, cachedFile)
      }
    }
    
    return result
  } catch (e: any) {
    log.error('115云盘', `移动文件异常: ${e.message}`)
    return { success: false, error: e.message }
  }
}

async function executeCopyFile(
  cookie: string,
  fileId: string,
  targetDirId: string
): Promise<FsOperationResult> {
  if (!cookie || !cookie.trim()) {
    return { success: false, error: 'Cookie为空' }
  }

  const params = new URLSearchParams({
    fid: fileId,
    pid: targetDirId
  })

  const response = await fetch(`${WEBAPI_BASE}/files/copy`, {
    method: 'POST',
    headers: getDefaultHeaders(cookie, true),
    body: params.toString()
  })

  if (!response.ok) {
    return { success: false, error: `请求失败: ${response.status}` }
  }

  const result = await response.json()

  if (result.state !== true && result.errno !== 0) {
    const errorMsg = result.error || result.errmsg || '复制失败'
    return { success: false, error: errorMsg }
  }

  const newFileId = result.data?.file_id || result.file_id || result.data?.fid || result.fid
  
  return { success: true, data: result, newFileId: newFileId ? String(newFileId) : undefined }
}

export async function copyFile(
  cookie: string,
  fileId: string,
  targetDirId: string,
  fileName?: string,
  newFileName?: string
): Promise<FsOperationResult> {
  try {
    const result = await enqueueRequest(
      () => executeCopyFile(cookie, fileId, targetDirId),
      `复制文件: ${fileId} -> ${targetDirId}`
    )
    
    if (result.success && fileName) {
      const cache = getFsCache()
      const newFile: FileItem = {
        type: 'file',
        is_dir: false,
        name: newFileName || fileName,
        fileId: result.newFileId || fileId,
        cid: result.newFileId || fileId,
        parentId: targetDirId,
        size: 0,
        updatedAt: null,
        pickcode: ''
      }
      cache.addDirChild(targetDirId, newFile)
    }
    
    return result
  } catch (e: any) {
    log.error('115云盘', `复制文件异常: ${e.message}`)
    return { success: false, error: e.message }
  }
}

async function executeRenameFile(
  cookie: string,
  fileId: string,
  newName: string
): Promise<FsOperationResult> {
  if (!cookie || !cookie.trim()) {
    return { success: false, error: 'Cookie为空' }
  }

  if (!newName || !newName.trim()) {
    return { success: false, error: '新名称不能为空' }
  }

  const params = new URLSearchParams({
    [`files_new_name[${fileId}]`]: newName.trim()
  })

  const response = await fetch(`${WEBAPI_BASE}/files/batch_rename`, {
    method: 'POST',
    headers: getDefaultHeaders(cookie, true),
    body: params.toString()
  })

  if (!response.ok) {
    return { success: false, error: `请求失败: ${response.status}` }
  }

  const result = await response.json()

  if (result.state !== true && result.errno !== 0) {
    const errorMsg = result.error || result.errmsg || '重命名失败'
    return { success: false, error: errorMsg }
  }

  return { success: true, data: result }
}

export async function renameFile(
  cookie: string,
  fileId: string,
  newName: string,
  parentDirId?: string,
  oldName?: string
): Promise<FsOperationResult> {
  try {
    const result = await enqueueRequest(
      () => executeRenameFile(cookie, fileId, newName),
      `重命名: ${fileId} -> ${newName}`
    )
    
    if (result.success && parentDirId && oldName) {
      const cache = getFsCache()
      cache.updateDirChildName(parentDirId, oldName, newName.trim())
    }
    
    return result
  } catch (e: any) {
    log.error('115云盘', `重命名文件异常: ${e.message}`)
    return { success: false, error: e.message }
  }
}

interface BatchMoveResult {
  success: boolean
  error?: string
  movedCount?: number
  data?: any
}

function isOpenTokenExpired(result: any): boolean {
  const errorCode = result.code || result.errno
  return errorCode === 40140125 || 
         (result.msg && result.msg.includes('token')) ||
         (result.error && result.error.includes('token'))
}

async function executeBatchMove(
  fileIds: string[],
  targetDirId: string
): Promise<BatchMoveResult> {
  let openToken = getSetting('pan115_open_token')
  if (!openToken) {
    return { success: false, error: '未配置开放平台Token，无法使用批量移动功能' }
  }

  const response = await fetch(`${PROAPI_BASE}/open/ufile/move`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${openToken}`
    },
    body: new URLSearchParams({
      file_ids: fileIds.join(','),
      to_cid: targetDirId
    }).toString()
  })

  if (!response.ok) {
    return { success: false, error: `请求失败: ${response.status}` }
  }

  const result = await response.json()

  if (result.code !== 0 && result.errno !== 0) {
    if (isOpenTokenExpired(result)) {
      log.info('115云盘', '批量移动Token已过期，尝试刷新')
      const refreshed = await tryRefreshToken()
      if (refreshed) {
        openToken = getSetting('pan115_open_token')
        const retryResponse = await fetch(`${PROAPI_BASE}/open/ufile/move`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${openToken}`
          },
          body: new URLSearchParams({
            file_ids: fileIds.join(','),
            to_cid: targetDirId
          }).toString()
        })
        
        if (retryResponse.ok) {
          const retryResult = await retryResponse.json()
          if (retryResult.code === 0 || retryResult.errno === 0) {
            return { 
              success: true, 
              movedCount: fileIds.length,
              data: retryResult 
            }
          }
        }
      }
    }
    
    const errorMsg = result.msg || result.error || '批量移动失败'
    return { success: false, error: errorMsg }
  }

  return { 
    success: true, 
    movedCount: fileIds.length,
    data: result 
  }
}

export async function batchMoveFiles(
  fileIds: string[],
  targetDirId: string
): Promise<BatchMoveResult> {
  if (!fileIds || fileIds.length === 0) {
    return { success: false, error: '文件ID列表为空' }
  }

  try {
    const result = await enqueueRequest(
      () => executeBatchMove(fileIds, targetDirId),
      `批量移动: ${fileIds.length} 个文件 -> ${targetDirId}`
    )
    
    return result
  } catch (e: any) {
    log.error('115云盘', `批量移动异常: ${e.message}`)
    return { success: false, error: e.message }
  }
}

interface BatchCopyResult {
  success: boolean
  error?: string
  copiedCount?: number
  data?: any
}

async function executeBatchCopy(
  fileIds: string[],
  targetDirId: string
): Promise<BatchCopyResult> {
  let openToken = getSetting('pan115_open_token')
  if (!openToken) {
    return { success: false, error: '未配置开放平台Token，无法使用批量复制功能' }
  }

  const response = await fetch(`${PROAPI_BASE}/open/ufile/copy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${openToken}`
    },
    body: new URLSearchParams({
      file_id: fileIds.join(','),
      pid: targetDirId
    }).toString()
  })

  if (!response.ok) {
    return { success: false, error: `请求失败: ${response.status}` }
  }

  const result = await response.json()
  
  log.info('115云盘', `批量复制响应: ${JSON.stringify(result)}`)

  if (result.code !== 0 && result.errno !== 0) {
    if (isOpenTokenExpired(result)) {
      log.info('115云盘', '批量复制Token已过期，尝试刷新')
      const refreshed = await tryRefreshToken()
      if (refreshed) {
        openToken = getSetting('pan115_open_token')
        const retryResponse = await fetch(`${PROAPI_BASE}/open/ufile/copy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${openToken}`
          },
          body: new URLSearchParams({
            file_id: fileIds.join(','),
            pid: targetDirId
          }).toString()
        })
        
        if (retryResponse.ok) {
          const retryResult = await retryResponse.json()
          if (retryResult.code === 0 || retryResult.errno === 0) {
            return { 
              success: true, 
              copiedCount: fileIds.length,
              data: retryResult 
            }
          }
        }
      }
    }
    
    const errorMsg = result.msg || result.error || '批量复制失败'
    return { success: false, error: errorMsg }
  }

  return { 
    success: true, 
    copiedCount: fileIds.length,
    data: result 
  }
}

export async function batchCopyFiles(
  fileIds: string[],
  targetDirId: string
): Promise<BatchCopyResult> {
  if (!fileIds || fileIds.length === 0) {
    return { success: false, error: '文件ID列表为空' }
  }

  try {
    const result = await enqueueRequest(
      () => executeBatchCopy(fileIds, targetDirId),
      `批量复制: ${fileIds.length} 个文件 -> ${targetDirId}`
    )
    
    return result
  } catch (e: any) {
    log.error('115云盘', `批量复制异常: ${e.message}`)
    return { success: false, error: e.message }
  }
}

interface BatchRenameItem {
  fileId: string
  newName: string
}

interface BatchRenameResult {
  success: boolean
  error?: string
  renamedCount?: number
  data?: any
}

async function executeBatchRename(
  items: BatchRenameItem[]
): Promise<BatchRenameResult> {
  const cookie = getSetting('pan115_cookie')
  if (!cookie) {
    return { success: false, error: '未配置Cookie，无法使用批量重命名功能' }
  }

  const params = new URLSearchParams()
  for (const item of items) {
    params.append(`files_new_name[${item.fileId}]`, item.newName)
  }

  const response = await fetch(`${WEBAPI_BASE}/files/batch_rename`, {
    method: 'POST',
    headers: getDefaultHeaders(cookie, true),
    body: params.toString()
  })

  if (!response.ok) {
    return { success: false, error: `请求失败: ${response.status}` }
  }

  const result = await response.json()

  if (result.state !== true && result.errno !== 0) {
    const errorMsg = result.error || result.errmsg || '批量重命名失败'
    return { success: false, error: errorMsg }
  }

  return { 
    success: true, 
    renamedCount: items.length,
    data: result 
  }
}

export async function batchRenameFiles(
  items: BatchRenameItem[]
): Promise<BatchRenameResult> {
  if (!items || items.length === 0) {
    return { success: false, error: '重命名列表为空' }
  }

  try {
    const result = await enqueueRequest(
      () => executeBatchRename(items),
      `批量重命名: ${items.length} 个文件`
    )
    
    return result
  } catch (e: any) {
    log.error('115云盘', `批量重命名异常: ${e.message}`)
    return { success: false, error: e.message }
  }
}

export async function findDirectory(
  cookie: string,
  parentId: string,
  name: string,
  useCache: boolean = true
): Promise<DirectoryInfo | null> {
  const cache = getFsCache()
  
  if (useCache) {
    const cachedDir = cache.getDirChild(parentId, name)
    if (cachedDir && cachedDir.is_dir) {
      return {
        id: cachedDir.fileId,
        name: cachedDir.name,
        parentId: cachedDir.parentId,
        pickcode: cachedDir.pickcode
      }
    }
  }

  const listResult = await listFiles(cookie, parentId, false)

  if (!listResult.success || !listResult.files) {
    return null
  }

  const found = listResult.files.find(
    f => f.type === 'folder' && f.name.toLowerCase() === name.toLowerCase()
  )

  if (found) {
    return {
      id: found.fileId,
      name: found.name,
      parentId: found.parentId,
      pickcode: found.pickcode
    }
  }

  return null
}

export async function ensureDirectory(
  cookie: string,
  parentId: string,
  name: string,
  currentPath?: string
): Promise<MkdirResult> {
  const existing = await findDirectory(cookie, parentId, name)

  if (existing) {
    if (currentPath) {
      const cache = getFsCache()
      cache.setPathId(currentPath, existing.id, existing.pickcode)
    }
    return { success: true, dirId: existing.id }
  }

  const result = await mkdir(cookie, parentId, name)

  if (result.success && result.dirId && currentPath) {
    const cache = getFsCache()
    cache.setPathId(currentPath, result.dirId)
  }
  
  if (!result.success) {
    const cache = getFsCache()
    cache.invalidatePath(currentPath || '')
    cache.invalidateDir(parentId)
  }
  
  return result
}

export async function ensurePath(
  cookie: string,
  rootId: string,
  pathParts: string[]
): Promise<MkdirResult> {
  const cache = getFsCache()
  let currentId = rootId
  let currentPath = ''

  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i]
    if (!part || !part.trim()) {
      continue
    }

    const trimmedPart = part.trim()
    currentPath = currentPath ? `${currentPath}/${trimmedPart}` : trimmedPart
    
    const cached = cache.getPathId(currentPath)
    if (cached) {
      currentId = cached.dirId
      continue
    }

    const result = await ensureDirectory(cookie, currentId, trimmedPart, currentPath)

    if (!result.success) {
      cache.invalidatePath(currentPath)
      
      const findResult = await findDirectory(cookie, currentId, trimmedPart, false)
      if (findResult) {
        cache.setPathId(currentPath, findResult.id, findResult.pickcode)
        currentId = findResult.id
        continue
      }
      
      const retryResult = await ensureDirectory(cookie, currentId, trimmedPart, currentPath)
      if (!retryResult.success) {
        return retryResult
      }
      currentId = retryResult.dirId!
      continue
    }

    currentId = result.dirId!
  }

  return { success: true, dirId: currentId }
}

interface DeleteResult {
  success: boolean
  error?: string
}

async function executeDeleteItems(
  cookie: string,
  fileIds: string[]
): Promise<DeleteResult> {
  if (!cookie || !cookie.trim()) {
    return { success: false, error: 'Cookie为空' }
  }

  if (!fileIds || fileIds.length === 0) {
    return { success: false, error: '文件ID不能为空' }
  }

  const params = new URLSearchParams()
  fileIds.forEach((id, index) => {
    params.append(`fid[${index}]`, id)
  })

  const response = await fetch(`${WEBAPI_BASE}/rb/delete`, {
    method: 'POST',
    headers: getDefaultHeaders(cookie, true),
    body: params.toString()
  })

  if (!response.ok) {
    return { success: false, error: `请求失败: ${response.status}` }
  }

  const result = await response.json()

  if (result.state !== true && result.errno !== 0) {
    const errorMsg = result.error || result.errmsg || '删除失败'
    return { success: false, error: errorMsg }
  }

  return { success: true }
}

export async function deleteItems(
  cookie: string,
  fileIds: string | string[]
): Promise<DeleteResult> {
  const ids = Array.isArray(fileIds) ? fileIds : [fileIds]
  
  try {
    return await enqueueRequest(
      () => executeDeleteItems(cookie, ids),
      `删除: ${ids.join(', ')}`
    )
  } catch (e: any) {
    log.error('115云盘', `删除异常: ${e.message}`)
    return { success: false, error: e.message }
  }
}

async function executeDeleteFolder(
  cookie: string,
  folderId: string
): Promise<DeleteResult> {
  if (!cookie || !cookie.trim()) {
    return { success: false, error: 'Cookie为空' }
  }

  if (!folderId) {
    return { success: false, error: '文件夹ID不能为空' }
  }

  const params = new URLSearchParams()
  params.append('fid[0]', folderId)

  const response = await fetch(`${WEBAPI_BASE}/rb/delete`, {
    method: 'POST',
    headers: getDefaultHeaders(cookie, true),
    body: params.toString()
  })

  if (!response.ok) {
    return { success: false, error: `请求失败: ${response.status}` }
  }

  const result = await response.json()

  if (result.state !== true && result.errno !== 0) {
    const errorMsg = result.error || result.errmsg || '删除失败'
    return { success: false, error: errorMsg }
  }

  return { success: true }
}

export async function deleteEmptyFolders(
  cookie: string,
  folderId: string,
  protectedFolderId?: string
): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
  const errors: string[] = []

  async function cleanEmptyFolders(
    currentId: string,
    isRoot: boolean,
    protectedId?: string
  ): Promise<number> {
    let count = 0

    const listResult = await listFiles(cookie, currentId, false)
    if (!listResult.success || !listResult.files) {
      return count
    }

    for (const item of listResult.files) {
      if (item.type === 'folder') {
        count += await cleanEmptyFolders(item.fileId, false, protectedId)
      }
    }

    if (currentId === protectedId) {
      return count
    }

    const recheckResult = await listFiles(cookie, currentId, false)
    if (recheckResult.success && recheckResult.files && recheckResult.files.length === 0) {
      const deleteResult = await enqueueRequest(
        () => executeDeleteFolder(cookie, currentId),
        `删除空文件夹: ${currentId}`
      )
      
      if (deleteResult.success) {
        count++
      } else {
        errors.push(`删除空文件夹 ${currentId} 失败: ${deleteResult.error}`)
      }
    }

    return count
  }

  const count = await cleanEmptyFolders(folderId, true, protectedFolderId)

  return { success: true, deletedCount: count, errors }
}

export async function resolvePathToId(
  cookie: string,
  path: string
): Promise<{ success: boolean; dirId?: string; pickcode?: string; error?: string }> {
  if (!path || !path.trim()) {
    return { success: false, error: '路径为空' }
  }

  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  const parts = cleanPath.split('/').filter(p => p.trim())

  if (parts.length === 0) {
    return { success: true, dirId: '0' }
  }

  const cache = getFsCache()
  const fullPath = parts.join('/')
  const cached = cache.getPathId(fullPath)
  if (cached) {
    log.info('115云盘', `使用路径缓存: ${fullPath} -> ${cached.dirId} (pickcode=${cached.pickcode || '无'})`)
    return { success: true, dirId: cached.dirId, pickcode: cached.pickcode || undefined }
  }

  let currentId = '0'
  let currentPath = ''
  let lastFound: DirectoryInfo | null = null

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part

    const cachedPart = cache.getPathId(currentPath)
    if (cachedPart) {
      currentId = cachedPart.dirId
      continue
    }

    const found = await findDirectory(cookie, currentId, part)

    if (!found) {
      return { success: false, error: `找不到目录: ${part}` }
    }

    currentId = found.id
    lastFound = found
    cache.setPathId(currentPath, currentId, found.pickcode)
  }

  return { success: true, dirId: currentId, pickcode: lastFound?.pickcode }
}
