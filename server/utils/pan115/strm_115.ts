/**
 * 115云盘 STRM 文件生成模块
 * 
 * 功能说明：
 * 扫描115云盘指定目录下的所有视频文件，生成本地 STRM 文件供 Emby/Jellyfin 等媒体服务器播放。
 * 
 * 核心流程：
 * 1. 解析媒体目录路径，获取目录 pickcode
 * 2. 使用 downfiles/downfolders API 获取文件和目录列表（每页5000条）
 * 3. 使用 /files/file API 批量获取文件名（每批100个，并发10）
 * 4. 过滤视频文件，构建目录结构
 * 5. 生成 STRM 文件，内容格式：{serverUrl}/api/d115/{pickcode}/{fileName}
 * 
 * API 说明：
 * - proapi.115.com/app/chrome/downfiles - 获取文件列表（返回 pickcode，不含文件名）
 * - proapi.115.com/app/chrome/downfolders - 获取目录列表
 * - webapi.115.com/files/file - 批量获取文件信息（通过 file_id 获取文件名）
 * 
 * pickcode 与 file_id 转换：
 * - downfiles API 返回的是 pickcode（如 abc123xyz）
 * - /files/file API 需要的是 file_id（数字字符串）
 * - 需要通过 pickcodeToId 函数将 pickcode 解密转换为 file_id
 * 
 * @module strm_115
 */

import { accessSync, constants, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, extname, basename, resolve } from 'path'
import { getSetting } from '../db'
import { log } from '../logger'
import { resolvePathToId } from '../organize/fs_115'
import { sendNotification } from '../telegram/client'
import { sendWechatNotification } from '../wechat/client'

/** 115 ProAPI 基础地址 */
const PROAPI_BASE = 'https://proapi.115.com'

/** 115 WebAPI 基础地址 */
const WEBAPI_BASE = 'https://webapi.115.com'

/** 支持的视频文件扩展名 */
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.ts', '.m2ts', '.mpg', '.mpeg', '.rmvb', '.rm']

/**
 * STRM 生成结果
 */
interface StrmGenerateResult {
  /** 是否成功 */
  success: boolean
  /** 视频文件总数 */
  totalFiles: number
  /** 成功生成的文件数 */
  generatedFiles: number
  /** 跳过的文件数（已存在） */
  skippedFiles: number
  /** 耗时（秒） */
  elapsed?: string
  /** 错误信息 */
  error?: string
}

/**
 * 文件信息
 * 从 downfiles API 获取的基本文件信息
 */
interface FileInfo {
  /** 文件 ID（由 pickcode 转换而来） */
  id: string
  /** 文件 pickcode（用于构建播放链接） */
  pickcode: string
  /** 父目录 ID */
  parentId: string
}

/**
 * 目录信息
 * 从 downfolders API 获取
 */
interface DirInfo {
  /** 目录 ID */
  id: string
  /** 目录名称 */
  name: string
  /** 父目录 ID */
  parentId: string
}

/** STRM 文件输出目录缓存 */
let mediaPath: string | null = null

function normalizePath(targetPath: string): string {
  return resolve(targetPath).replace(/[\\/]+$/, '')
}

function parseAccessiblePaths(): string[] {
  const raw = process.env.TRIM_DATA_ACCESSIBLE_PATHS?.trim()
  if (!raw) return []

  return raw
    .split(/[:;\n]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(normalizePath)
}

function isSubPath(targetPath: string, basePath: string): boolean {
  return targetPath === basePath || targetPath.startsWith(`${basePath}/`) || targetPath.startsWith(`${basePath}\\`)
}

function ensureAuthorizedMediaPath(targetPath: string): string {
  const normalizedTargetPath = normalizePath(targetPath)

  if (!process.env.MEDIA_PATH) {
    return normalizedTargetPath
  }

  const accessiblePaths = parseAccessiblePaths()
  if (accessiblePaths.length === 0) {
    throw new Error('当前未检测到飞牛外部文件授权目录，请先在应用设置中为目标目录授予读写权限')
  }

  if (!accessiblePaths.some(basePath => isSubPath(normalizedTargetPath, basePath))) {
    throw new Error(`媒体目录未获得飞牛外部文件访问权限: ${normalizedTargetPath}，请在应用设置中为该目录授予读写权限`)
  }

  return normalizedTargetPath
}

function ensureWritableDirectory(targetPath: string): void {
  try {
    mkdirSync(targetPath, { recursive: true })
  } catch (error: any) {
    throw new Error(`无法创建媒体目录: ${targetPath}，请确认目录已授权且应用用户可写 (${error.message})`)
  }

  try {
    accessSync(targetPath, constants.W_OK)
  } catch (error: any) {
    throw new Error(`媒体目录不可写: ${targetPath}，请在应用设置中授予读写权限并确认应用用户可写 (${error.message})`)
  }
}

/**
 * 获取 STRM 文件输出目录
 * 优先级：
 * 1. 环境变量 MEDIA_PATH（飞牛OS安装向导配置的自定义路径）
 * 2. 环境变量 TRIM_PKGVAR/media（飞牛OS应用目录）
 * 3. 当前工作目录下的 media 文件夹（本地开发）
 */
function getMediaPath(): string {
  if (!mediaPath) {
    const configuredPath = process.env.MEDIA_PATH || (process.env.TRIM_PKGVAR ? join(process.env.TRIM_PKGVAR, 'media') : join(process.cwd(), 'media'))
    mediaPath = ensureAuthorizedMediaPath(configuredPath)
    ensureWritableDirectory(mediaPath)
  }
  return mediaPath
}

/**
 * 构建默认请求头
 * 模拟 Chrome 客户端访问 115 API
 */
function getDefaultHeaders(cookie: string): Record<string, string> {
  return {
    'User-Agent': 'Mozilla/5.0 115disk/99.99.99.99 115Browser/99.99.99.99 115wangpan_android/99.99.99.99',
    'Cookie': cookie,
    'Referer': 'https://115.com/',
  }
}

/** 36进制字母表，用于 pickcode 解密 */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

/**
 * pickcode 解密映射表
 * 
 * pickcode 格式说明：
 * - 普通格式：{前缀1字符}{密文}{校验4字符}，如 "abc1234567xyz"
 * - 新格式：f{前缀1字符}{密文}{校验4字符}，如 "fbc1234567xyz"
 * 
 * 前缀决定解密表的选择，密文通过映射表解密后得到 36 进制 ID
 */
const PREFIX_TO_TRANSTAB_REV: Record<string, Record<string, string>> = {
  'a': { '0': 'f', '1': 'u', '2': 'l', '3': 'n', '4': '1', '5': 'y', '6': 't', '7': 'p', '8': 'j', '9': '3', 'a': 's', 'b': 'm', 'c': 'g', 'd': '8', 'e': 'd', 'f': '5', 'g': 'a', 'h': '0', 'i': '9', 'j': '4', 'k': 'q', 'l': 'h', 'm': '7', 'n': 'c', 'o': 'x', 'p': 'k', 'q': 'b', 'r': 'i', 's': '6', 't': '2', 'u': 'z', 'v': 'v', 'w': 'e', 'x': 'w', 'y': 'r', 'z': 'o' },
  'b': { '0': 's', '1': 'k', '2': '7', '3': '2', '4': '1', '5': 'n', '6': '9', '7': 'a', '8': '0', '9': 'e', 'a': 'm', 'b': 'l', 'c': 'f', 'd': 'p', 'e': 'c', 'f': 'r', 'g': 'z', 'h': 'b', 'i': 'q', 'j': 'd', 'k': 'w', 'l': '3', 'm': 'g', 'n': 'j', 'o': 'h', 'p': '6', 'q': 't', 'r': 'y', 's': '5', 't': 'x', 'u': 'u', 'v': 'i', 'w': '4', 'x': '8', 'y': 'v', 'z': 'o' },
  'c': { '0': 'y', '1': 'w', '2': 'c', '3': 'z', '4': '3', '5': 'h', '6': 'i', '7': 't', '8': 'e', '9': '6', 'a': 'f', 'b': '1', 'c': 'j', 'd': '0', 'e': 'g', 'f': 'u', 'g': 'o', 'h': 'a', 'i': 'k', 'j': 'v', 'k': 'd', 'l': 'b', 'm': '2', 'n': 'n', 'o': 's', 'p': '7', 'q': 'p', 'r': '8', 's': 'q', 't': 'r', 'u': '9', 'v': 'm', 'w': 'l', 'x': '5', 'y': 'x', 'z': '4' },
  'd': { '0': 'r', '1': 'q', '2': '2', '3': 'v', '4': 'l', '5': '5', '6': 'o', '7': '7', '8': 'w', '9': 's', 'a': 'k', 'b': 'e', 'c': 'n', 'd': '9', 'e': 'u', 'f': '8', 'g': 't', 'h': 'p', 'i': '4', 'j': 'j', 'k': 'g', 'l': '3', 'm': 'z', 'n': 'b', 'o': 'y', 'p': 'c', 'q': '6', 'r': 'x', 's': 'm', 't': 'h', 'u': 'i', 'v': 'f', 'w': 'd', 'x': '0', 'y': '1', 'z': 'a' },
  'e': { '0': 'l', '1': 'j', '2': 'm', '3': '9', '4': 'e', '5': 'q', '6': 'b', '7': 'c', '8': 'f', '9': 'h', 'a': 'w', 'b': '7', 'c': 'k', 'd': 't', 'e': 'v', 'f': '3', 'g': 'x', 'h': '1', 'i': 'd', 'j': 'g', 'k': 'p', 'l': '5', 'm': 'u', 'n': 'a', 'o': '8', 'p': 'y', 'q': '6', 'r': 's', 's': '4', 't': 'z', 'u': 'n', 'v': 'r', 'w': '2', 'x': 'i', 'y': 'o', 'z': '0' },
  'fa': { '0': 'f', '1': 'u', '2': 'm', '3': 'k', '4': '0', '5': 'y', '6': 't', '7': 'p', '8': 'j', '9': '3', 'a': 's', 'b': 'n', 'c': 'g', 'd': '8', 'e': 'd', 'f': '5', 'g': 'a', 'h': '1', 'i': '9', 'j': '4', 'k': 'q', 'l': 'h', 'm': '7', 'n': 'c', 'o': 'x', 'p': 'l', 'q': 'b', 'r': 'i', 's': '6', 't': '2', 'u': 'z', 'v': 'v', 'w': 'e', 'x': 'w', 'y': 'r', 'z': 'o' },
  'fb': { '0': 's', '1': 'k', '2': '7', '3': '3', '4': '2', '5': 'o', '6': '9', '7': 'a', '8': '1', '9': 'e', 'a': 'n', 'b': 'm', 'c': 'f', 'd': 'p', 'e': 'c', 'f': 'r', 'g': 'z', 'h': 'b', 'i': 'q', 'j': 'd', 'k': 'w', 'l': '4', 'm': 'g', 'n': 'j', 'o': 'h', 'p': '6', 'q': 't', 'r': 'y', 's': '5', 't': 'x', 'u': 'u', 'v': 'i', 'w': '0', 'x': '8', 'y': 'v', 'z': 'l' },
  'fc': { '0': 'y', '1': 'w', '2': 'c', '3': 'z', '4': '6', '5': 'h', '6': 'i', '7': 't', '8': 'e', '9': '9', 'a': 'f', 'b': '4', 'c': 'j', 'd': '3', 'e': 'g', 'f': 'u', 'g': 'p', 'h': '2', 'i': 'k', 'j': 'v', 'k': 'd', 'l': 'b', 'm': '5', 'n': 'o', 'o': 's', 'p': 'a', 'q': 'l', 'r': '0', 's': 'q', 't': 'r', 'u': '1', 'v': 'n', 'w': 'm', 'x': '8', 'y': 'x', 'z': '7' },
  'fd': { '0': 'o', '1': 'n', '2': '6', '3': 'v', '4': 'l', '5': '0', '6': 'r', '7': '2', '8': 'w', '9': 'p', 'a': 'k', 'b': 'e', 'c': 'q', 'd': '9', 'e': 'u', 'f': '3', 'g': 't', 'h': 's', 'i': '8', 'j': 'j', 'k': 'g', 'l': '7', 'm': 'z', 'n': 'b', 'o': 'y', 'p': 'c', 'q': '1', 'r': 'x', 's': 'm', 't': 'h', 'u': 'i', 'v': 'f', 'w': 'd', 'x': '4', 'y': '5', 'z': 'a' },
  'fe': { '0': 'l', '1': 'j', '2': 'm', '3': '0', '4': 'e', '5': 's', '6': '2', '7': 'c', '8': 'f', '9': 'h', 'a': 'w', 'b': 'a', 'c': 'k', 'd': 'q', 'e': 'v', 'f': '6', 'g': 'x', 'h': '4', 'i': 'd', 'j': 'g', 'k': 'p', 'l': '8', 'm': 'r', 'n': '1', 'o': 'b', 'p': 'y', 'q': '9', 'r': 'u', 's': '7', 't': 'z', 'u': 'n', 'v': 't', 'w': '5', 'x': 'i', 'y': 'o', 'z': '3' },
}

/**
 * 将 pickcode 转换为 file_id
 * 
 * 转换算法：
 * 1. 提取前缀（普通格式取第1字符，新格式取前2字符如 "fa"）
 * 2. 提取密文（去掉前缀和最后4位校验码）
 * 3. 通过映射表解密密文
 * 4. 将解密后的字符串从36进制转换为10进制
 * 
 * @param pickcode - 文件 pickcode
 * @returns file_id（数字字符串）
 */
function pickcodeToId(pickcode: string): string {
  if (!pickcode) return '0'
  
  // 提取前缀：新格式以 'f' 开头，取前2字符；普通格式取第1字符
  const prefix = pickcode.startsWith('f') ? pickcode.slice(0, 2) : pickcode.charAt(0)
  
  // 提取密文：去掉前缀和最后4位校验码
  const cipher = pickcode.startsWith('f') ? pickcode.slice(2, -4) : pickcode.slice(1, -4)
  
  const transtab = PREFIX_TO_TRANSTAB_REV[prefix]
  if (!transtab) return '0'
  
  // 解密：通过映射表转换每个字符
  let decrypted = ''
  for (const c of cipher) {
    decrypted += transtab[c] || c
  }
  
  // 将36进制字符串转换为10进制数字
  let id = BigInt(0)
  for (const c of decrypted) {
    const idx = ALPHABET.indexOf(c.toLowerCase())
    if (idx !== -1) {
      id = id * BigInt(36) + BigInt(idx)
    }
  }
  
  return id.toString()
}

/**
 * 获取文件列表（单页）
 * 
 * API: proapi.115.com/app/chrome/downfiles
 * 返回数据包含 pickcode 和父目录 ID，但不包含文件名
 * 
 * @param cookie - 115 登录 Cookie
 * @param pickcode - 目录 pickcode
 * @param page - 页码
 * @returns 文件列表和是否有下一页
 */
async function fetchDownloadFiles(cookie: string, pickcode: string, page: number): Promise<{ list: any[]; hasNextPage: boolean }> {
  const params = new URLSearchParams({ pickcode, page: String(page), per_page: '5000' })
  const response = await fetch(`${PROAPI_BASE}/app/chrome/downfiles?${params}`, { headers: getDefaultHeaders(cookie) })
  const result = await response.json()
  return {
    list: result.data?.list || [],
    hasNextPage: result.data?.has_next_page ?? false
  }
}

/**
 * 获取目录列表（单页）
 * 
 * API: proapi.115.com/app/chrome/downfolders
 * 返回数据包含目录 ID、名称和父目录 ID
 * 
 * @param cookie - 115 登录 Cookie
 * @param pickcode - 目录 pickcode
 * @param page - 页码
 * @returns 目录列表和是否有下一页
 */
async function fetchDownloadFolders(cookie: string, pickcode: string, page: number): Promise<{ list: any[]; hasNextPage: boolean }> {
  const params = new URLSearchParams({ pickcode, page: String(page), per_page: '5000' })
  const response = await fetch(`${PROAPI_BASE}/app/chrome/downfolders?${params}`, { headers: getDefaultHeaders(cookie) })
  const result = await response.json()
  return {
    list: result.data?.list || [],
    hasNextPage: result.data?.has_next_page ?? false
  }
}

/**
 * 批量获取文件名
 * 
 * API: webapi.115.com/files/file
 * 通过 file_id 批量查询文件信息，获取文件名
 * 
 * 性能优化：
 * - 每批100个文件ID
 * - 并发10个请求
 * 
 * @param cookie - 115 登录 Cookie
 * @param fileIds - 文件 ID 数组
 * @returns file_id -> file_name 映射
 */
async function fetchFileNames(cookie: string, fileIds: string[]): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>()
  if (fileIds.length === 0) return nameMap

  log.info('STRM', `正在获取 ${fileIds.length} 个文件名...`)

  const batchSize = 100      // 每批处理100个文件
  const concurrency = 10     // 并发10个请求
  const batches: string[][] = []
  
  // 分批
  for (let i = 0; i < fileIds.length; i += batchSize) {
    batches.push(fileIds.slice(i, i + batchSize))
  }

  let completed = 0

  // 处理单个批次
  const processBatch = async (batch: string[]): Promise<void> => {
    try {
      const response = await fetch(`${WEBAPI_BASE}/files/file?file_id=${batch.join(',')}`, {
        method: 'GET',
        headers: getDefaultHeaders(cookie)
      })
      const result = await response.json()
      
      if (result.state && result.data) {
        for (const item of result.data) {
          if (item.file_id && item.file_name) {
            nameMap.set(String(item.file_id), item.file_name)
          }
        }
      }
      
      completed++
      if (completed % 10 === 0 || completed === batches.length) {
        log.info('STRM', `获取文件名进度: ${completed}/${batches.length} 批次, ${nameMap.size} 个文件名`)
      }
    } catch (e: any) {
      log.error('STRM', `获取文件名失败: ${e.message}`)
    }
  }

  // 并发处理所有批次
  for (let i = 0; i < batches.length; i += concurrency) {
    await Promise.all(batches.slice(i, i + concurrency).map(processBatch))
  }

  return nameMap
}

/**
 * 收集所有文件（支持分页）
 * 
 * @param cookie - 115 登录 Cookie
 * @param pickcode - 目录 pickcode
 * @returns 所有文件信息
 */
async function collectAllFiles(cookie: string, pickcode: string): Promise<FileInfo[]> {
  const allFiles: FileInfo[] = []
  let page = 1

  while (true) {
    const { list, hasNextPage } = await fetchDownloadFiles(cookie, pickcode, page)
    
    for (const item of list) {
      allFiles.push({
        id: pickcodeToId(item.pc),  // pickcode 转 file_id
        pickcode: item.pc,           // 保留 pickcode 用于生成播放链接
        parentId: item.pid
      })
    }
    
    if (!hasNextPage) break
    page++
  }

  return allFiles
}

/**
 * 收集所有目录（支持分页）
 * 
 * @param cookie - 115 登录 Cookie
 * @param pickcode - 目录 pickcode
 * @returns 所有目录信息
 */
async function collectAllFolders(cookie: string, pickcode: string): Promise<DirInfo[]> {
  const allFolders: DirInfo[] = []
  let page = 1

  while (true) {
    const { list, hasNextPage } = await fetchDownloadFolders(cookie, pickcode, page)
    
    for (const item of list) {
      allFolders.push({
        id: item.fid,
        name: item.fn,
        parentId: item.pid
      })
    }
    
    if (!hasNextPage) break
    page++
  }

  return allFolders
}

/**
 * 构建文件相对路径
 * 
 * 通过递归查找父目录，构建完整的相对路径
 * 
 * @param parentId - 父目录 ID
 * @param idToDirNode - ID 到目录节点的映射
 * @returns 相对路径（如 "电影/动作/2024"）
 */
function buildPath(parentId: string, idToDirNode: Map<string, { name: string; parentId: string }>): string {
  const parts: string[] = []
  let currentId = parentId
  
  // 从当前目录向上追溯，直到根目录（ID 为 '0'）
  while (currentId && currentId !== '0') {
    const node = idToDirNode.get(currentId)
    if (!node) break
    parts.unshift(node.name)
    currentId = node.parentId
  }
  
  return parts.join('/')
}

/**
 * 生成 STRM 文件
 * 
 * 主流程：
 * 1. 检查配置（Cookie、媒体目录、服务器地址）
 * 2. 解析媒体目录路径，获取 pickcode
 * 3. 获取所有文件和目录信息
 * 4. 批量获取文件名
 * 5. 过滤视频文件
 * 6. 生成 STRM 文件（跳过已存在的）
 * 7. 发送通知
 * 
 * @returns 生成结果
 */
export async function generateStrmFiles(): Promise<StrmGenerateResult> {
  const startTime = Date.now()
  
  // 获取配置
  const cookie = getSetting('pan115_cookie')
  const mediaDir = getSetting('pan115_media_dir')
  const serverUrl = getSetting('strm_server_url')

  // 检查必要配置
  if (!cookie) {
    return { success: false, totalFiles: 0, generatedFiles: 0, skippedFiles: 0, error: '未配置 115 云盘 Cookie' }
  }
  if (!mediaDir) {
    return { success: false, totalFiles: 0, generatedFiles: 0, skippedFiles: 0, error: '未配置媒体库目录' }
  }
  if (!serverUrl) {
    return { success: false, totalFiles: 0, generatedFiles: 0, skippedFiles: 0, error: '未配置服务器地址' }
  }

  log.info('STRM', `开始生成 STRM 文件`)
  log.info('STRM', `媒体目录: ${mediaDir}`)

  // 解析媒体目录路径，获取目录 ID 和 pickcode
  const pathResult = await resolvePathToId(cookie, mediaDir)
  if (!pathResult.success || !pathResult.dirId || !pathResult.pickcode) {
    return { success: false, totalFiles: 0, generatedFiles: 0, skippedFiles: 0, error: `无法解析媒体目录: ${pathResult.error}` }
  }

  // 获取所有文件
  log.info('STRM', `正在获取文件列表...`)
  const allFiles = await collectAllFiles(cookie, pathResult.pickcode)
  log.info('STRM', `获取到 ${allFiles.length} 个文件`)

  // 获取所有目录
  log.info('STRM', `正在获取目录列表...`)
  const allFolders = await collectAllFolders(cookie, pathResult.pickcode)
  log.info('STRM', `获取到 ${allFolders.length} 个目录`)

  // 构建目录节点映射（用于构建路径）
  const idToDirNode = new Map<string, { name: string; parentId: string }>()
  for (const folder of allFolders) {
    idToDirNode.set(folder.id, { name: folder.name, parentId: folder.parentId })
  }

  // 批量获取文件名
  const fileNameMap = await fetchFileNames(cookie, allFiles.map(f => f.id))
  
  // 将文件信息也加入映射（文件名用于生成 STRM 文件名）
  for (const file of allFiles) {
    const name = fileNameMap.get(file.id)
    if (name) {
      idToDirNode.set(file.id, { name, parentId: file.parentId })
    }
  }

  // 过滤视频文件
  const videoFiles = allFiles.filter(f => {
    const node = idToDirNode.get(f.id)
    if (!node?.name) return false
    const ext = node.name.toLowerCase().slice(node.name.lastIndexOf('.'))
    return VIDEO_EXTENSIONS.includes(ext)
  })

  log.info('STRM', `发现 ${videoFiles.length} 个视频文件`)

  if (videoFiles.length === 0) {
    return { success: true, totalFiles: 0, generatedFiles: 0, skippedFiles: 0 }
  }

  // 准备输出目录
  let outputDir: string
  try {
    outputDir = getMediaPath()
  } catch (error: any) {
    return {
      success: false,
      totalFiles: videoFiles.length,
      generatedFiles: 0,
      skippedFiles: 0,
      error: error.message || 'STRM 输出目录校验失败'
    }
  }

  let generatedCount = 0
  let skippedCount = 0

  // 生成 STRM 文件
  for (const file of videoFiles) {
    const node = idToDirNode.get(file.id)
    if (!node?.name) {
      skippedCount++
      continue
    }

    // 构建相对路径和文件名
    const relativeDir = buildPath(file.parentId, idToDirNode)
    const fileName = basename(node.name, extname(node.name)) + '.strm'
    const targetDir = join(outputDir, relativeDir)
    const targetPath = join(targetDir, fileName)

    // 跳过已存在的文件
    if (existsSync(targetPath)) {
      skippedCount++
      continue
    }

    // 创建目录
    try {
      ensureWritableDirectory(targetDir)
    } catch (error: any) {
      return {
        success: false,
        totalFiles: videoFiles.length,
        generatedFiles: generatedCount,
        skippedFiles: skippedCount,
        error: error.message || `无法准备 STRM 输出目录: ${targetDir}`
      }
    }

    // 写入 STRM 文件
    // 内容格式：{serverUrl}/api/d115/{pickcode}/{fileName}
    const strmContent = `${serverUrl}/api/d115/${file.pickcode}/${node.name}`
    try {
      writeFileSync(targetPath, strmContent, 'utf-8')
    } catch (error: any) {
      return {
        success: false,
        totalFiles: videoFiles.length,
        generatedFiles: generatedCount,
        skippedFiles: skippedCount,
        error: `写入 STRM 文件失败: ${targetPath}，${error.message || error}`
      }
    }
    generatedCount++
    
    if (generatedCount % 100 === 0) {
      log.info('STRM', `已生成 ${generatedCount}/${videoFiles.length} 个 STRM 文件`)
    }
  }

  log.success('STRM', `生成完成: 共 ${videoFiles.length} 个文件, 成功 ${generatedCount} 个, 跳过 ${skippedCount} 个`)

  // 发送通知
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const lines: string[] = [
    '✅ <b>STRM 文件生成完成</b>',
    '',
    `<b>📁 总文件数：</b>${videoFiles.length}`,
    `<b>✅ 成功生成：</b>${generatedCount}`,
    `<b>⏭️ 已跳过：</b>${skippedCount}`,
    `<b>⏱️ 耗时：</b>${elapsed} 秒`
  ]
  const message = lines.join('\n')
  
  await Promise.all([
    sendNotification(message).catch(e => log.error('Telegram通知', e.message)),
    sendWechatNotification(message).catch(e => log.error('微信通知', e.message || e))
  ])

  return {
    success: true,
    totalFiles: videoFiles.length,
    generatedFiles: generatedCount,
    skippedFiles: skippedCount,
    elapsed
  }
}
