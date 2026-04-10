/**
 * 封面生成器核心模块
 * 
 * 使用 Sharp 库为 Emby 媒体库生成精美的自定义封面
 * 参考 Python 版本的高级特性，实现以下功能：
 * 
 * 核心特性：
 * - 3x3 网格布局：9张海报按列分组排列
 * - 海报旋转效果：每列整体旋转-15.8度，形成倾斜视觉效果
 * - 圆角海报：62px圆角，更加柔和美观
 * - 阴影效果：20px偏移+20px模糊，增加立体感
 * - 渐变背景：基于海报主色调生成渐变
 * - 主色调提取：从海报中提取主要颜色
 * - 晕影效果：边缘暗角，增加电影感
 * 
 * 封面尺寸：2560x1440 (16:9 高清分辨率)
 * 海报尺寸：546x813 (2:3 标准海报比例)
 * 
 * @module server/utils/emby/cover_generator
 * @author FNOS Media Dashboard
 * @version 1.0.0
 */

import { log } from '../logger'
import { embyRequest, getEmbyConfig } from './emby'
import TextToSVG, { type GenerationOptions, type TextToSVG as TextToSVGType } from 'text-to-svg'
import sharp from 'sharp'
import * as path from 'path'
import * as fs from 'fs'

/**
 * 封面生成配置参数
 * 
 * 这些参数经过精心调整，参考 Python 版本的配置
 * 修改时请谨慎，可能影响整体视觉效果
 */
const COVER_CONFIG = {
  /** 画布宽度 (像素) */
  CANVAS_WIDTH: 2560,
  /** 画布高度 (像素) */
  CANVAS_HEIGHT: 1440,
  /** 海报行数 */
  ROWS: 3,
  /** 海报列数 */
  COLS: 3,
  /** 海报间距 (像素) */
  MARGIN: 30,
  /** 海报圆角半径 (像素) */
  CORNER_RADIUS: 62,
  /** 海报旋转角度 (度)，正数表示顺时针（向右倾斜），与Python版本的-15.8等效 */
  ROTATION_ANGLE: 15.8,
  /** 海报起始X坐标 (像素)，从右侧开始 */
  START_X: 850,
  /** 海报起始Y坐标 (像素)，负值表示向上偏移 */
  START_Y: -483,
  /** 列间距 (像素) */
  COLUMN_SPACING: 30,
  /** 单张海报宽度 (像素) */
  CELL_WIDTH: 546,
  /** 单张海报高度 (像素) */
  CELL_HEIGHT: 813,
  /** 中文标题字体大小 (像素) */
  ZH_FONT_SIZE: 220,
  /** 英文标题字体大小 (像素) */
  EN_FONT_SIZE: 100,
  /** 标题区域高度 (像素) */
  TITLE_AREA_HEIGHT: 400,
  /** 阴影偏移量 (像素) */
  SHADOW_OFFSET: 20,
  /** 阴影模糊半径 (像素) */
  SHADOW_BLUR: 20,
  /** 阴影透明度 (0-255) */
  SHADOW_ALPHA: 216,
  /** 晕影强度 (0-1) */
  VIGNETTE_STRENGTH: 0.20,
  /** 晕影模糊半径 (像素) */
  VIGNETTE_BLUR: 240,
  /** 缩放比例 X (基于1920宽度) */
  SCALE_X: 2560 / 1920,
  /** 缩放比例 Y (基于1080高度) */
  SCALE_Y: 1440 / 1080
}

/**
 * 封面生成选项接口
 */
interface CoverOptions {
  /** 媒体库ID */
  libraryId: string
  /** 媒体库名称 */
  libraryName: string
  /** 中文字体ID */
  zhFont: string
  /** 英文字体ID */
  enFont: string
  /** 自定义中文标题（可选） */
  zhTitle?: string
  /** 自定义英文标题（可选） */
  enTitle?: string
  /** 图片选择模式 */
  mode: 'random' | 'tmdb_rating' | 'premiere_date' | 'recent_added'
}

/**
 * 媒体项信息接口
 */
interface MediaItem {
  /** 媒体ID */
  id: string
  /** 媒体名称 */
  name: string
  /** 图片标签 */
  imageTag?: string
  /** 图片URL */
  imageUrl?: string
  /** TMDB评分 */
  tmdbRating?: number
  /** 上映日期 */
  premiereDate?: string
  /** 添加日期 */
  dateCreated?: string
}

/**
 * 根据字体ID获取字体文件路径
 * 
 * @param fontId - 字体标识符，如 'zh_lxgwwenkai'、'en_montserrat_bold'
 * @returns 字体文件绝对路径，如果字体不存在则返回 null
 */
function getFontPath(fontId: string): string | null {
  // 字体ID与文件名的映射关系
  const fontMap: Record<string, string> = {
    // 中文字体
    'zh_lxgwwenkai': 'LXGWWenKai-Regular.ttf',
    'zh_smileysans': 'SmileySans-Oblique.ttf',
    'zh_zcoolkuaile': 'ZCOOLKuaiLe-Regular.ttf',
    // 英文字体
    'en_montserrat_bold': 'Montserrat-Bold.ttf',
    'en_oswald_bold': 'Oswald-Bold.ttf',
    'en_roboto_bold': 'Roboto-Bold.ttf',
    'en_roboto': 'Roboto-Regular.ttf',
    'en_opensans_bold': 'OpenSans-Bold.ttf',
    'en_opensans': 'OpenSans-Regular.ttf',
    'en_bebasneue': 'BebasNeue-Regular.ttf'
  }
  
  const fontFile = fontMap[fontId]
  if (!fontFile) return null
  
  // 字体文件路径查找优先级：
  // 1. 开发环境：项目根目录下的 fonts/
  // 2. 打包后飞牛应用：server 目录的上级 public/ 目录
  const cwd = process.cwd()
  const possiblePaths = [
    path.join(cwd, 'fonts', fontFile),        // 开发环境
    path.join(cwd, '../public', fontFile),     // 打包后飞牛应用
    path.join(cwd, 'public', fontFile),        // 备选
    path.join(cwd, '../fonts', fontFile),       // 备选
  ]
  
  for (const fontPath of possiblePaths) {
    if (fs.existsSync(fontPath)) {
      return fontPath
    }
  }
  
  return null
}

/**
 * 从 Emby 媒体库获取媒体项列表
 * 
 * @param libraryId - 媒体库ID
 * @returns 带有图片的媒体项数组
 * @throws 如果 Emby 未配置或请求失败
 */
async function fetchLibraryItems(libraryId: string): Promise<MediaItem[]> {
  const config = await getEmbyConfig()
  if (!config) {
    throw new Error('Emby未配置')
  }

  try {
    const data = await embyRequest<any>('/Items', {
      params: {
        ParentId: libraryId,
        Recursive: 'true',
        Fields: 'ProviderIds,Overview,ProductionYear,PremiereDate,DateCreated,CommunityRating',
        IncludeItemTypes: 'Movie,Series',
        Limit: '100'
      }
    })
    const items: MediaItem[] = []

    // 只保留有主图片的媒体项
    if (data.Items && Array.isArray(data.Items)) {
      for (const item of data.Items) {
        if (item.ImageTags?.Primary) {
          items.push({
            id: item.Id,
            name: item.Name,
            imageTag: item.ImageTags.Primary,
            imageUrl: `${config.baseUrl}/Items/${item.Id}/Images/Primary?tag=${item.ImageTags.Primary}&quality=90&X-Emby-Token=${config.apiKey}`,
            tmdbRating: item.CommunityRating,
            premiereDate: item.PremiereDate,
            dateCreated: item.DateCreated
          })
        }
      }
    }

    return items
  } catch (e: any) {
    log.error('封面生成', `获取媒体项失败: ${e.message}`)
    throw e
  }
}

/**
 * 根据选择模式筛选媒体项
 * 
 * @param items - 媒体项数组
 * @param mode - 选择模式
 * @param count - 需要选择的数量，默认9张
 * @returns 筛选后的媒体项数组
 */
function selectItemsByMode(items: MediaItem[], mode: string, count: number = 9): MediaItem[] {
  if (items.length === 0) return []

  let sorted = [...items]

  switch (mode) {
    case 'tmdb_rating':
      sorted.sort((a, b) => (b.tmdbRating || 0) - (a.tmdbRating || 0))
      break
    case 'premiere_date':
      sorted.sort((a, b) => {
        const dateA = a.premiereDate ? new Date(a.premiereDate).getTime() : 0
        const dateB = b.premiereDate ? new Date(b.premiereDate).getTime() : 0
        return dateB - dateA
      })
      break
    case 'recent_added':
      sorted.sort((a, b) => {
        const dateA = a.dateCreated ? new Date(a.dateCreated).getTime() : 0
        const dateB = b.dateCreated ? new Date(b.dateCreated).getTime() : 0
        return dateB - dateA
      })
      break
    case 'random':
    default:
      for (let i = sorted.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tempI = sorted[i]
        const tempJ = sorted[j]
        if (tempI !== undefined && tempJ !== undefined) {
          sorted[i] = tempJ
          sorted[j] = tempI
        }
      }
      break
  }

  if (sorted.length >= count) {
    return sorted.slice(0, count)
  }

  const selectedItems: MediaItem[] = []
  for (let i = 0; i < count; i++) {
    selectedItems.push(sorted[i % sorted.length]!)
  }

  return selectedItems
}

/**
 * 下载图片并转换为 Buffer
 * 
 * @param url - 图片URL
 * @returns 图片Buffer，下载失败返回 null
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (e) {
    return null
  }
}

/**
 * RGB 颜色空间转换为 HSV 颜色空间
 */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, v = max
  const d = max - min
  s = max === 0 ? 0 : d / max
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return [h, s, v]
}

/**
 * HSV 颜色空间转换为 RGB 颜色空间
 */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  let r = 0, g = 0, b = 0
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

/**
 * 判断颜色是否为黑、白、灰色
 */
function isNotBlackWhiteGray(r: number, g: number, b: number, threshold = 20): boolean {
  if ((r < threshold && g < threshold && b < threshold) ||
      (r > 255 - threshold && g > 255 - threshold && b > 255 - threshold)) {
    return false
  }
  if (Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && Math.abs(r - b) < 10) {
    return false
  }
  return true
}

/**
 * 将数值限制在指定范围内
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * 归一化背景色。
 *
 * 与旧实现相比，这里放宽了饱和度与明度的收敛范围：
 * - primary 保留更多原始主色特征，避免不同媒体库被压成同一色系
 * - secondary 允许更鲜明一些，用来拉开渐变层次
 */
function normalizePaletteColor(
  color: [number, number, number],
  role: 'primary' | 'secondary' = 'primary'
): [number, number, number] {
  const [h, s, v] = rgbToHsv(...color)
  const minS = role === 'primary' ? 0.32 : 0.42
  const maxS = role === 'primary' ? 0.88 : 0.92
  const minV = role === 'primary' ? 0.42 : 0.48
  const maxV = role === 'primary' ? 0.90 : 0.94

  const adjustedS = clamp(s < minS ? minS + (role === 'secondary' ? 0.06 : 0) : s, minS, maxS)
  const adjustedV = clamp(v, minV, maxV)

  return hsvToRgb(h, adjustedS, adjustedV)
}

/**
 * 计算两种颜色的距离，用于挑选差异足够明显的辅助色
 */
function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(a[0] - b[0], 2) +
    Math.pow(a[1] - b[1], 2) +
    Math.pow(a[2] - b[2], 2)
  )
}

/**
 * 计算两种颜色在色相上的最短距离
 */
function hueDistance(a: [number, number, number], b: [number, number, number]): number {
  const [h1] = rgbToHsv(...a)
  const [h2] = rgbToHsv(...b)
  const distance = Math.abs(h1 - h2)
  return Math.min(distance, 1 - distance)
}

/**
 * 判断两种颜色是否足够不同，避免 primary / secondary 过于接近
 */
function isDistinctPaletteColor(a: [number, number, number], b: [number, number, number]): boolean {
  return hueDistance(a, b) >= 0.10 || colorDistance(a, b) >= 92
}

/**
 * 当海报主色过于接近时，为背景生成一个更明显偏移的辅助色
 */
function deriveAccentColor(color: [number, number, number]): [number, number, number] {
  const [h, s, v] = rgbToHsv(...color)
  const hueShift = s < 0.28 ? 0.24 : s < 0.45 ? 0.18 : 0.14
  const shiftedHue = (h + hueShift) % 1
  const shiftedS = clamp(Math.max(s, 0.46) + 0.08, 0.46, 0.92)
  const shiftedV = clamp(v < 0.55 ? v + 0.16 : v * 0.92, 0.50, 0.95)

  return hsvToRgb(shiftedHue, shiftedS, shiftedV)
}

/**
 * 从单张海报中提取候选颜色列表。
 *
 * 这里会保留同一张图中更有代表性的多种颜色，而不是只取一个最高频色，
 * 为后续挑选更有区分度的 secondary 提供基础。
 */
async function extractPaletteCandidates(
  imageBuffer: Buffer,
  maxCandidates: number = 6
): Promise<Array<[number, number, number]>> {
  const colorCounts: Map<string, number> = new Map()
  const { data, info } = await sharp(imageBuffer)
    .resize(120, 180, { fit: 'cover' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const sampleStep = Math.max(info.channels * 4, info.channels)

  for (let i = 0; i <= data.length - info.channels; i += sampleStep) {
    const r = data[i] ?? 0
    const g = data[i + 1] ?? 0
    const b = data[i + 2] ?? 0
    const a = info.channels === 4 ? (data[i + 3] ?? 255) : 255

    if (a < 200) continue
    if (!isNotBlackWhiteGray(r, g, b)) continue

    const key = `${Math.floor(r / 24) * 24},${Math.floor(g / 24) * 24},${Math.floor(b / 24) * 24}`
    colorCounts.set(key, (colorCounts.get(key) || 0) + 1)
  }

  const rankedColors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => {
      const parts = key.split(',').map(Number)
      return [parts[0] || 0, parts[1] || 0, parts[2] || 0] as [number, number, number]
    })

  const distinctColors: Array<[number, number, number]> = []

  for (const color of rankedColors) {
    if (distinctColors.some(existing => !isDistinctPaletteColor(existing, color))) {
      continue
    }

    distinctColors.push(color)

    if (distinctColors.length >= maxCandidates) {
      break
    }
  }

  return distinctColors
}

/**
 * 从多张图片中提取背景主色与辅助色。
 *
 * 新策略：
 * - 优先使用首张海报（即当前选择结果中的锚点海报）决定 primary
 * - 再从其余海报里找差异足够明显的颜色作为 secondary
 * - 这样既保留媒体库整体风格，也避免所有背景都被“平均化”成相似色系
 */
async function extractBackgroundPalette(imageBuffers: Buffer[]): Promise<{ primary: [number, number, number]; secondary: [number, number, number] }> {
  try {
    const anchorCandidates = await extractPaletteCandidates(imageBuffers[0]!, 6)
    const supplementalGroups = await Promise.all(
      imageBuffers.slice(1, 5).map(buffer => extractPaletteCandidates(buffer, 4))
    )

    const supplementalCandidates = supplementalGroups.reduce(
      (all, group) => all.concat(group),
      [] as Array<[number, number, number]>
    )

    const allCandidates = [...anchorCandidates, ...supplementalCandidates]
    const primaryBase = anchorCandidates[0] || allCandidates[0] || [150, 100, 50]
    const secondaryBase = allCandidates.find(color => isDistinctPaletteColor(primaryBase, color)) || deriveAccentColor(primaryBase)

    return {
      primary: normalizePaletteColor(primaryBase, 'primary'),
      secondary: normalizePaletteColor(secondaryBase, 'secondary')
    }
  } catch (e) {
    const primary: [number, number, number] = [150, 100, 50]
    return {
      primary,
      secondary: normalizePaletteColor(deriveAccentColor(primary), 'secondary')
    }
  }
}

/**
 * 将颜色变暗
 */
function darkenColor(color: [number, number, number], factor: number): [number, number, number] {
  return [
    Math.round(color[0] * factor),
    Math.round(color[1] * factor),
    Math.round(color[2] * factor)
  ]
}

/**
 * 创建渐变背景
 */
async function createGradientBackground(width: number, height: number, primaryColor: [number, number, number], secondaryColor: [number, number, number]): Promise<Buffer> {
  const topColor = darkenColor(primaryColor, 0.90)
  const middleColor: [number, number, number] = [
    Math.min(255, Math.round(primaryColor[0] * 0.72 + secondaryColor[0] * 0.28)),
    Math.min(255, Math.round(primaryColor[1] * 0.72 + secondaryColor[1] * 0.28)),
    Math.min(255, Math.round(primaryColor[2] * 0.72 + secondaryColor[2] * 0.28))
  ]
  const bottomColor = darkenColor(secondaryColor, 0.56)

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="baseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(${topColor[0]},${topColor[1]},${topColor[2]});stop-opacity:1" />
          <stop offset="52%" style="stop-color:rgb(${middleColor[0]},${middleColor[1]},${middleColor[2]});stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgb(${bottomColor[0]},${bottomColor[1]},${bottomColor[2]});stop-opacity:1" />
        </linearGradient>
        <radialGradient id="accentGrad" cx="18%" cy="22%" r="70%">
          <stop offset="0%" style="stop-color:rgb(${primaryColor[0]},${primaryColor[1]},${primaryColor[2]});stop-opacity:0.30" />
          <stop offset="100%" style="stop-color:rgb(${secondaryColor[0]},${secondaryColor[1]},${secondaryColor[2]});stop-opacity:0" />
        </radialGradient>
        <radialGradient id="accentGradSecondary" cx="82%" cy="78%" r="60%">
          <stop offset="0%" style="stop-color:rgb(${secondaryColor[0]},${secondaryColor[1]},${secondaryColor[2]});stop-opacity:0.22" />
          <stop offset="100%" style="stop-color:rgb(${secondaryColor[0]},${secondaryColor[1]},${secondaryColor[2]});stop-opacity:0" />
        </radialGradient>
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
          <stop offset="0%" style="stop-color:black;stop-opacity:0" />
          <stop offset="100%" style="stop-color:black;stop-opacity:${COVER_CONFIG.VIGNETTE_STRENGTH}" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#baseGrad)"/>
      <rect width="100%" height="100%" fill="url(#accentGrad)"/>
      <rect width="100%" height="100%" fill="url(#accentGradSecondary)"/>
      <rect width="100%" height="100%" fill="url(#vignette)"/>
    </svg>
  `

  return sharp(Buffer.from(svg))
    .resize(width, height)
    .png()
    .toBuffer()
}

/**
 * 创建圆角海报
 */
async function createRoundedPoster(imageBuffer: Buffer, width: number, height: number, radius: number): Promise<Buffer> {
  const roundedCorner = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>`
  )
  
  const resizedImage = await sharp(imageBuffer)
    .resize(width, height, { fit: 'cover' })
    .toBuffer()
  
  return sharp(resizedImage)
    .composite([
      {
        input: roundedCorner,
        blend: 'dest-in'
      }
    ])
    .png()
    .toBuffer()
}

/**
 * 旋转图像
 * 
 * 使用 Sharp 自动扩展画布
 * 
 * @param imageBuffer - 列图像Buffer
 * @param angle - 旋转角度
 * @returns 旋转后的图像Buffer和新尺寸
 */
async function rotateColumnImage(imageBuffer: Buffer, angle: number): Promise<{ buffer: Buffer; width: number; height: number }> {
  const rotated = await sharp(imageBuffer)
    .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  
  const metadata = await sharp(rotated).metadata()
  const width = metadata.width || 100
  const height = metadata.height || 100
  
  return { buffer: rotated, width, height }
}

/**
 * 生成媒体库封面
 * 
 * 主函数：协调整个封面生成流程
 * 
 * 流程：
 * 1. 获取媒体库中的媒体项
 * 2. 根据模式选择9张海报
 * 3. 提取主色调生成渐变背景
 * 4. 按列处理海报（每列3张，整体旋转）
 * 5. 合成海报到背景
 * 6. 添加标题文字
 * 7. 输出 Base64 编码的 JPEG 图片
 */
export async function generateCover(options: CoverOptions): Promise<{ image: string; size: { width: number; height: number } } | null> {
  const { libraryId, libraryName, zhFont, enFont, zhTitle, enTitle, mode } = options
  
  log.info('封面生成', `开始生成封面: ${libraryName}, 模式: ${mode}`)
  
  const zhFontPath = getFontPath(zhFont)
  const enFontPath = getFontPath(enFont)
  
  // 步骤1：获取媒体项
  const items = await fetchLibraryItems(libraryId)
  if (items.length === 0) {
    log.warn('封面生成', '媒体库中没有带图片的媒体项')
    return null
  }
  
  // 步骤2：选择海报
  const selectedItems = selectItemsByMode(items, mode, 9)
  log.info('封面生成', `选择了 ${selectedItems.length} 个媒体项`)
  
  // 步骤3：提取背景色板（综合多张海报）
  let palette = {
    primary: [150, 100, 50] as [number, number, number],
    secondary: [186, 122, 76] as [number, number, number]
  }

  // 步骤4：下载所有海报图片
  const imagePromises = selectedItems.map(item =>
    item.imageUrl ? downloadImage(item.imageUrl) : Promise.resolve(null)
  )
  const images = await Promise.all(imagePromises)
  const validImages = images.filter((image): image is Buffer => Boolean(image))

  if (validImages.length > 0) {
    palette = await extractBackgroundPalette(validImages)
  }

  // 步骤5：创建渐变背景
  const background = await createGradientBackground(
    COVER_CONFIG.CANVAS_WIDTH,
    COVER_CONFIG.CANVAS_HEIGHT,
    palette.primary,
    palette.secondary
  )

  // 海报排列顺序：按照 3、1、4、5、2、6、8、9、7 的顺序排列
  // 对应 custom_order = "315426987"
  const customOrder = [2, 0, 3, 4, 1, 5, 7, 8, 6]
  const reorderedImages = customOrder.map(i => images[i]).filter(Boolean)

  // 步骤6：按列处理海报（参考Python版本的逻辑）
  const posterComposites: { input: Buffer; top: number; left: number }[] = []
  
  const posterWidth = COVER_CONFIG.CELL_WIDTH
  const posterHeight = COVER_CONFIG.CELL_HEIGHT
  const startX = COVER_CONFIG.START_X
  const startY = COVER_CONFIG.START_Y
  const colSpacing = COVER_CONFIG.COLUMN_SPACING
  const margin = COVER_CONFIG.MARGIN
  const rotation = COVER_CONFIG.ROTATION_ANGLE
  const scaleX = COVER_CONFIG.SCALE_X
  const scaleY = COVER_CONFIG.SCALE_Y
  
  // 步骤6：创建3x3海报网格并整体旋转
  // 6.1 计算整个海报区域的尺寸
  const totalWidth = posterWidth + 2 * (posterWidth + colSpacing)
  const totalHeight = posterHeight + 2 * (posterHeight + margin)
  
  // 6.2 创建海报区域画布
  let posterAreaCanvas = await sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).png().toBuffer()
  
  // 6.3 将9张海报放置到网格中
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 3; row++) {
      const idx = col * 3 + row
      const posterBuffer = reorderedImages[idx]
      if (!posterBuffer) continue
      
      try {
        const roundedPoster = await createRoundedPoster(posterBuffer, posterWidth, posterHeight, COVER_CONFIG.CORNER_RADIUS)
        const x = col * (posterWidth + (col > 0 ? colSpacing : 0))
        const y = row * (posterHeight + (row > 0 ? margin : 0))
        
        posterAreaCanvas = await sharp(posterAreaCanvas)
          .composite([{ input: roundedPoster, top: y, left: x }])
          .png()
          .toBuffer()
      } catch (e: any) {
        log.warn('封面生成', `处理海报${idx}失败: ${e.message}`)
      }
    }
  }
  
  // 6.4 整体旋转海报区域
  const { buffer: rotatedPosterArea, width: rotatedAreaWidth, height: rotatedAreaHeight } = await rotateColumnImage(posterAreaCanvas, rotation)
  
  // 6.5 计算放置位置（居中对齐到右侧区域）
  const areaCenterX = startX + Math.floor(totalWidth / 2)
  const areaCenterY = startY + Math.floor(totalHeight / 2)
  const finalX = Math.round(areaCenterX - rotatedAreaWidth / 2 + posterWidth / 2)
  const finalY = Math.round(areaCenterY - rotatedAreaHeight / 2)
  
  posterComposites.push({
    input: rotatedPosterArea,
    left: finalX,
    top: finalY
  })
  
  // 步骤7：合成海报到背景
  // 由于 START_Y 是负数，海报会超出画布上方，需要创建更大的工作画布
  const extraTopSpace = Math.abs(COVER_CONFIG.START_Y) + 1500 // 顶部空间
  const extraBottomSpace = 1000 // 底部空间
  const workCanvasWidth = COVER_CONFIG.CANVAS_WIDTH
  const workCanvasHeight = COVER_CONFIG.CANVAS_HEIGHT + extraTopSpace + extraBottomSpace
  
  // 创建扩展的工作画布
  let workCanvas = await sharp({
    create: {
      width: workCanvasWidth,
      height: workCanvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      // 将背景放置在正确位置（extraTopSpace 向下偏移）
      { input: background, top: extraTopSpace, left: 0 }
    ])
    .png()
    .toBuffer()
  
  // 调整海报合成位置（加上顶部偏移）
  const adjustedComposites = posterComposites.map(c => ({
    ...c,
    top: c.top + extraTopSpace
  }))
  
  // 合成海报到工作画布
  workCanvas = await sharp(workCanvas)
    .composite(adjustedComposites)
    .png()
    .toBuffer()
  
  // 从工作画布中提取最终区域
  let result = await sharp(workCanvas)
    .extract({
      left: 0,
      top: extraTopSpace,
      width: COVER_CONFIG.CANVAS_WIDTH,
      height: COVER_CONFIG.CANVAS_HEIGHT
    })
    .png()
    .toBuffer()
  
  // 步骤8：添加标题（使用 text-to-svg 渲染）
  const titleText = zhTitle || libraryName
  const zhFontPathResolved = zhFontPath && fs.existsSync(zhFontPath) ? zhFontPath : null
  const enFontPathResolved = enFontPath && fs.existsSync(enFontPath) ? enFontPath : null
  
  // 使用 text-to-svg 加载字体并渲染文本
  async function renderTextToSvg(
    text: string,
    fontPath: string | null,
    fontSize: number,
    x: number,
    y: number,
    color: string,
    shadowColor: string
  ): Promise<Buffer> {
    let textToSvg: TextToSVGType
    
    if (fontPath) {
      try {
        textToSvg = TextToSVG.loadSync(fontPath)
      } catch (e: any) {
        log.warn('封面生成', `加载字体失败: ${fontPath}`)
        textToSvg = TextToSVG.loadSync()
      }
    } else {
      textToSvg = TextToSVG.loadSync()
    }
    
    const options: GenerationOptions = {
      fontSize,
      anchor: 'top'
    }
    
    const pathD = textToSvg.getD(text, options)
    
    const svgContent = `<svg width="${COVER_CONFIG.CANVAS_WIDTH}" height="${COVER_CONFIG.CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="5" dy="5" stdDeviation="8" flood-color="${shadowColor}" flood-opacity="0.5"/>
        </filter>
      </defs>
      <g transform="translate(${x}, ${y})">
        <path d="${pathD}" fill="${color}" filter="url(#shadow)"/>
      </g>
    </svg>`
    
    return Buffer.from(svgContent)
  }
  
  // Python 版本的标题位置计算
  const hasEnTitle = enTitle && enTitle.trim().length > 0
  const baseZhX = 80
  const baseZhY = hasEnTitle ? 380 : 430
  const zhX = Math.round(baseZhX * scaleX)
  const zhY = Math.round(baseZhY * scaleY)
  
  // 添加中文标题
  const zhTitleSvg = await renderTextToSvg(
    titleText,
    zhFontPathResolved,
    COVER_CONFIG.ZH_FONT_SIZE,
    zhX,
    zhY,
    '#ffffff',
    'black'
  )
  
  result = await sharp(result)
    .composite([{ input: zhTitleSvg, top: 0, left: 0 }])
    .toBuffer()
  
  // 添加英文标题（如果有）
  if (hasEnTitle) {
    const enY = zhY + COVER_CONFIG.ZH_FONT_SIZE + 20
    const enX = zhX + 20
    
    const enTitleSvg = await renderTextToSvg(
      enTitle,
      enFontPathResolved,
      COVER_CONFIG.EN_FONT_SIZE,
      enX,
      enY,
      'rgba(255, 255, 255, 0.85)',
      'black'
    )
    
    result = await sharp(result)
      .composite([{ input: enTitleSvg, top: 0, left: 0 }])
      .toBuffer()
  }
  
  // 步骤11：转换为 JPEG 格式
  const finalBuffer = await sharp(result)
    .jpeg({ quality: 95 })
    .toBuffer()
  
  const base64 = finalBuffer.toString('base64')
  
  log.info('封面生成', `封面生成成功: ${COVER_CONFIG.CANVAS_WIDTH}x${COVER_CONFIG.CANVAS_HEIGHT}`)
  
  return {
    image: base64,
    size: { width: COVER_CONFIG.CANVAS_WIDTH, height: COVER_CONFIG.CANVAS_HEIGHT }
  }
}

/**
 * 上传封面到 Emby 媒体库
 */
export async function uploadCoverToEmby(libraryId: string, imageBase64: string): Promise<boolean> {
  try {
    await embyRequest(`/Items/${libraryId}/Images/Primary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg'
      },
      body: imageBase64,
      responseType: 'none'
    })

    log.info('封面生成', `封面上传成功: ${libraryId}`)
    return true
  } catch (e: any) {
    log.error('封面生成', `封面上传失败: ${e.message}`)
    throw e
  }
}
