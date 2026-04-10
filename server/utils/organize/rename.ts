/**
 * 重命名模板模块
 * 
 * 本模块负责根据媒体信息生成规范的目标文件名和路径：
 * - 支持电影和电视剧的不同命名模板
 * - 支持Jinja2风格的模板语法
 * - 自动清理文件名中的非法字符
 * 
 * 默认模板格式：
 * - 电影: 标题 (年份) {tmdb=ID}/标题.年份.分辨率.来源.编码.扩展名
 * - 电视剧: 标题 (年份) {tmdb=ID}/Season XX/标题.年份.SXXEXX.分辨率.来源.编码.扩展名
 * 
 * 模板变量：
 * - {{title}}: 媒体标题
 * - {{year}}: 发行年份
 * - {{tmdbid}}: TMDB ID
 * - {{fileExt}}: 文件扩展名
 * - {{videoFormat}}: 视频格式（分辨率）
 * - {{webSource}}: WEB来源
 * - {{edition}}: 版本信息
 * - {{videoCodec}}: 视频编码
 * - {{audioCodec}}: 音频编码
 * - {{releaseGroup}}: 发布组
 * - {{season}}: 季数
 * - {{episode}}: 集数
 * - {{seasonEpisode}}: 季集标识（S01E01）
 */

import type { TechInfo } from './types'
import { getSetting } from '../db'

/**
 * 默认电影命名模板
 * 格式: 标题 (年份) {tmdb=ID}/标题.年份.分辨率.版本.编码.音频.WEB来源.发布组.扩展名
 */
export const DEFAULT_MOVIE_TEMPLATE = '{{title}}{% if year %} ({{year}}){% endif %} {tmdb={{tmdbid}}}/{{title}}{% if year %}.{{year}}{% endif %}{% if videoFormat %}.{{videoFormat}}{% endif %}{% if edition %}.{{edition}}{% endif %}{% if videoCodec %}.{{videoCodec}}{% endif %}{% if audioCodec %}.{{audioCodec}}{% endif %}{% if webSource %}.{{webSource}}{% endif %}{% if releaseGroup %}-{{releaseGroup}}{% endif %}{{fileExt}}'

/**
 * 默认电视剧命名模板
 * 格式: 标题 (年份) {tmdb=ID}/Season XX/标题.年份.SXXEXX.分辨率.版本.编码.音频.WEB来源.发布组.扩展名
 */
export const DEFAULT_TV_TEMPLATE = '{{title}}{% if year %} ({{year}}){% endif %} {tmdb={{tmdbid}}}/Season {{ "%02d" | format(season|int) }}/{{title}}{% if seasonYear %}.{{seasonYear}}{% endif %}.{{seasonEpisode}}{% if videoFormat %}.{{videoFormat}}{% endif %}{% if edition %}.{{edition}}{% endif %}{% if videoCodec %}.{{videoCodec}}{% endif %}{% if audioCodec %}.{{audioCodec}}{% endif %}{% if webSource %}.{{webSource}}{% endif %}{% if releaseGroup %}-{{releaseGroup}}{% endif %}{{fileExt}}'

/**
 * 模板变量接口
 * 定义模板中可用的所有变量
 */
interface TemplateVars {
  /** 媒体标题 */
  title: string
  /** 发行年份 */
  year: string
  /** TMDB ID */
  tmdbid: number
  /** 原始文件名 */
  originalName: string
  /** 文件扩展名 */
  fileExt: string
  /** 视频格式（分辨率） */
  videoFormat: string
  /** 资源类型：WEB-DL、BluRay等 */
  resourceType: string
  /** WEB来源 */
  webSource: string
  /** 版本信息 */
  edition: string
  /** 视频编码 */
  videoCodec: string
  /** 音频编码 */
  audioCodec: string
  /** 发布组 */
  releaseGroup: string
  /** 季数 */
  season: number
  /** 集数 */
  episode: number
  /** 季集标识（S01E01格式） */
  seasonEpisode: string
  /** 季年份 */
  seasonYear: string
}

/**
 * 清理文件名中的非法字符
 * 移除Windows文件系统不允许的字符: < > : " / \ | ? *
 * 
 * @param name - 原始文件名
 * @returns 清理后的文件名
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 清理路径部分中的非法字符
 * 与sanitizeFileName类似，但用于路径的目录部分
 * 
 * @param part - 路径部分
 * @returns 清理后的路径部分
 */
function sanitizePathPart(part: string): string {
  return part
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 渲染模板
 * 
 * 支持的模板语法：
 * - {{variable}}: 变量替换
 * - {% if variable %}content{% endif %}: 条件判断
 * - {% if variable %}if_content{% else %}else_content{% endif %}: 条件分支
 * - {{ "%02d" | format(value) }}: 格式化
 * - {{ "%02d" | format(variable|int) }}: 带类型转换的格式化
 * 
 * @param template - 模板字符串
 * @param vars - 变量对象
 * @returns 渲染后的字符串
 */
function renderTemplate(template: string, vars: TemplateVars): string {
  let result = template

  // 处理格式化过滤器 {{ "%02d" | format(variable|int) }}
  result = result.replace(/\{\{\s*"([^"]+)"\s*\|\s*format\s*\(\s*(\w+)(?:\s*\|\s*\w+)?\s*\)\s*\}\}/g, (_, formatStr: string, varName: string) => {
    const value = vars[varName as keyof TemplateVars]
    if (value !== undefined && value !== null && value !== '') {
      const numValue = typeof value === 'number' ? value : parseInt(String(value), 10)
      if (!isNaN(numValue)) {
        try {
          return formatStr.replace(/%0?\d*d/, String(numValue).padStart(2, '0'))
        } catch {
          return String(numValue)
        }
      }
    }
    return '01'
  })

  // 处理简单变量替换 {{ variable }}
  result = result.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    return String(vars[key as keyof TemplateVars] || '')
  })

  // 处理条件分支语句 {% if variable %}if_content{% else %}else_content{% endif %}
  result = result.replace(/\{%\s*if\s+(\w+)\s*%\}(.*?)\{%\s*else\s*%\}(.*?)\{%\s*endif\s*%\}/gs, (_, key: string, ifContent: string, elseContent: string) => {
    const value = vars[key as keyof TemplateVars]
    if (value && value !== '' && value !== '0') {
      return ifContent
    }
    return elseContent
  })

  // 处理简单条件语句 {% if variable %}content{% endif %}
  result = result.replace(/\{%\s*if\s+(\w+)\s*%\}(.*?)\{%\s*endif\s*%\}/gs, (_, key: string, content: string) => {
    const value = vars[key as keyof TemplateVars]
    if (value && value !== '' && value !== '0') {
      return content
    }
    return ''
  })

  // 清理多余空格
  result = result.replace(/\s+/g, ' ').trim()

  // 修复扩展名前的空格
  result = result.replace(/\s+(\.[A-Za-z0-9]{2,6})$/g, '$1')

  return result
}

/**
 * 生成目标文件路径
 * 
 * 根据媒体信息和模板生成规范的目标文件路径
 * 路径格式示例：
 * - 电影: 电影/国产电影/流浪地球 (2019) {tmdb=693134}/流浪地球.2019.2160p.UHD.BluRay.REMUX.mkv
 * - 电视剧: 剧集/日本番剧/进击的巨人 (2013) {tmdb=1429}/Season 01/进击的巨人.2013.S01E01.1080p.WEB-DL.mkv
 * 
 * @param title - 媒体标题
 * @param year - 发行年份
 * @param tmdbId - TMDB ID
 * @param mediaType - 媒体类型：'movie' 或 'tv'
 * @param tech - 技术信息对象
 * @param season - 季数（仅电视剧）
 * @param episode - 集数（仅电视剧）
 * @param template - 自定义模板（可选）
 * @returns 生成的目标路径（相对路径，不含分类目录）
 * 
 * @example
 * generateTargetPath('Avatar', '2009', 19995, 'movie', techInfo)
 * // 返回: "Avatar (2009) {tmdb=19995}/Avatar.2009.2160p.UHD.BluRay.REMUX.mkv"
 */
export function generateTargetPath(
  title: string,
  year: string,
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  tech: TechInfo,
  season?: number | null,
  episode?: number | null,
  template?: string,
  seasonYear?: string | null
): string {
  let tpl = template
  
  if (!tpl) {
    const savedTemplate = mediaType === 'movie' 
      ? getSetting('rename_movie_template') 
      : getSetting('rename_tv_template')
    tpl = savedTemplate || (mediaType === 'movie' ? DEFAULT_MOVIE_TEMPLATE : DEFAULT_TV_TEMPLATE)
  }

  const vars: TemplateVars = {
    title,
    year,
    tmdbid: tmdbId,
    originalName: '',
    fileExt: tech.fileExt || '',
    videoFormat: tech.videoFormat || '',
    resourceType: tech.resourceType || '',
    webSource: tech.webSource || '',
    edition: tech.edition || '',
    videoCodec: tech.videoCodec || '',
    audioCodec: tech.audioCodec || '',
    releaseGroup: tech.releaseGroup || '',
    season: season || 1,
    episode: episode || 1,
    seasonEpisode: season && episode ? `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}` : 'S01E01',
    seasonYear: seasonYear || year,
  }

  // 渲染模板
  let path = renderTemplate(tpl, vars)

  // 清理路径各部分
  const parts = path.split('/')
  const sanitizedParts = parts.map((part, index) => {
    // 最后一部分是文件名，其他是目录名
    if (index === parts.length - 1) {
      return sanitizeFileName(part)
    }
    return sanitizePathPart(part)
  })

  // 重新组装路径
  path = sanitizedParts.filter(p => p).join('/')

  return path
}

/**
 * 规范化路径
 * 移除多余的斜杠和点
 * 
 * @param path - 原始路径
 * @returns 规范化后的路径
 */
export function normalizePath(path: string): string {
  return path
    .replace(/\/+/g, '/')
    .replace(/\/\./g, '/')
    .trim()
}

/**
 * 获取默认电影模板
 * 
 * @returns 默认电影命名模板字符串
 */
export function getDefaultMovieTemplate(): string {
  return DEFAULT_MOVIE_TEMPLATE
}

/**
 * 获取默认电视剧模板
 * 
 * @returns 默认电视剧命名模板字符串
 */
export function getDefaultTvTemplate(): string {
  return DEFAULT_TV_TEMPLATE
}

/**
 * 分割路径
 * 将路径字符串分割为路径部分数组
 * 
 * @param path - 路径字符串
 * @returns 路径部分数组
 */
export function splitPath(path: string): string[] {
  return path.split('/').filter(p => p.trim())
}

/**
 * 构建最终路径
 * 将分类目录和相对路径合并为完整路径
 * 
 * @param category - 分类目录，如 "电影/国产电影"
 * @param relativePath - 相对路径，如 "标题 (年份) {tmdb=ID}/文件名.mkv"
 * @returns 完整路径
 * 
 * @example
 * buildFinalPath('电影/国产电影', '流浪地球 (2019) {tmdb=693134}/流浪地球.2019.mkv')
 * // 返回: "电影/国产电影/流浪地球 (2019) {tmdb=693134}/流浪地球.2019.mkv"
 */
export function buildFinalPath(category: string, relativePath: string): string {
  const parts = [category, relativePath].filter(p => p.trim())
  return normalizePath(parts.join('/'))
}
