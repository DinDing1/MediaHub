/**
 * 分类策略模块
 * 
 * 本模块负责根据媒体信息自动分类到对应目录：
 * - 根据类型（动画、纪录片等）分类
 * - 根据原产国（国产、日韩、欧美等）分类
 * - 支持自定义分类规则
 * 
 * 分类规则采用优先级匹配，先匹配的规则优先生效
 * 例如：动画类型 + 日本 = 日本番剧，而不是日韩剧
 */

import type { TMDBDetails, ClassificationRule, ClassificationStrategy } from './types'
import { getSetting } from '../db'

/**
 * 默认分类策略
 * 
 * 电影分类：
 * - 动画电影：类型包含动画(16)
 * - 国产电影：原产国为中国、台湾、香港
 * - 日韩电影：原产国为日本、朝鲜、韩国
 * - 欧美电影：其他所有电影
 * 
 * 电视剧分类：
 * - 国产动漫：动画类型 + 中港台
 * - 日本番剧：动画类型 + 日本
 * - 欧美动漫：动画类型 + 欧美国家
 * - 纪录片：类型包含纪录片(99)
 * - 综艺：类型包含真人秀(10764)或谈话(10767)
 * - 儿童：类型包含儿童(10762)
 * - 国产剧：原产国为中港台
 * - 日韩剧：原产国为日韩泰新印
 * - 欧美剧：其他所有剧集
 */
export const DEFAULT_STRATEGY: ClassificationStrategy = {
  movie: [
    { category: '电影/动画电影', conditions: { genreIds: '16' } },
    { category: '电影/国产电影', conditions: { originCountry: 'CN,TW,HK' } },
    { category: '电影/日韩电影', conditions: { originCountry: 'JP,KP,KR' } },
    { category: '电影/欧美电影', conditions: {} },
  ],
  tv: [
    { category: '剧集/国产动漫', conditions: { genreIds: '16', originCountry: 'CN,TW,HK' } },
    { category: '剧集/日本番剧', conditions: { genreIds: '16', originCountry: 'JP' } },
    { category: '剧集/欧美动漫', conditions: { genreIds: '16', originCountry: 'US,FR,GB,DE,ES,IT,NL,PT,RU,UK' } },
    { category: '其他/纪录片', conditions: { genreIds: '99' } },
    { category: '其他/综艺', conditions: { genreIds: '10764,10767' } },
    { category: '剧集/儿童', conditions: { genreIds: '10762' } },
    { category: '剧集/国产剧', conditions: { originCountry: 'CN,TW,HK' } },
    { category: '剧集/日韩剧', conditions: { originCountry: 'JP,KP,KR,TH,IN,SG' } },
    { category: '剧集/欧美剧', conditions: {} },
  ],
}

/**
 * TMDB类型ID到中文名称的映射表
 * 
 * 类型ID参考：
 * - 28: 动作
 * - 12: 冒险
 * - 16: 动画
 * - 35: 喜剧
 * - 80: 犯罪
 * - 99: 纪录片
 * - 18: 剧情
 * - 10751: 家庭
 * - 14: 奇幻
 * - 36: 历史
 * - 27: 恐怖
 * - 10402: 音乐
 * - 9648: 悬疑
 * - 10749: 爱情
 * - 878: 科幻
 * - 10770: 电视电影
 * - 53: 惊悚
 * - 10752: 战争
 * - 37: 西部
 * 
 * 电视剧专用类型：
 * - 10759: 动作冒险
 * - 10762: 儿童
 * - 10763: 新闻
 * - 10764: 真人秀
 * - 10765: 科幻奇幻
 * - 10766: 肥皂剧
 * - 10767: 谈话
 * - 10768: 战争政治
 */
const GENRE_MAP: Record<number, string> = {
  28: '动作',
  12: '冒险',
  16: '动画',
  35: '喜剧',
  80: '犯罪',
  99: '纪录片',
  18: '剧情',
  10751: '家庭',
  14: '奇幻',
  36: '历史',
  27: '恐怖',
  10402: '音乐',
  9648: '悬疑',
  10749: '爱情',
  878: '科幻',
  10770: '电视电影',
  53: '惊悚',
  10752: '战争',
  37: '西部',
  10759: '动作冒险',
  10762: '儿童',
  10763: '新闻',
  10764: '真人秀',
  10765: '科幻奇幻',
  10766: '肥皂剧',
  10767: '谈话',
  10768: '战争政治',
}

/**
 * 解析类型ID字符串
 * 
 * @param genreIdsStr - 逗号分隔的类型ID字符串，如 "16,28,35"
 * @returns 类型ID数字数组
 */
function parseGenreIds(genreIdsStr: string): number[] {
  return genreIdsStr
    .split(',')
    .map(id => parseInt(id.trim(), 10))
    .filter(id => !isNaN(id))
}

/**
 * 解析原产国字符串
 * 
 * @param countriesStr - 逗号分隔的国家代码字符串，如 "CN,JP,KR"
 * @returns 大写的国家代码数组
 */
function parseOriginCountries(countriesStr: string): string[] {
  return countriesStr
    .split(',')
    .map(c => c.trim().toUpperCase())
    .filter(c => c.length > 0)
}

/**
 * 检查媒体信息是否匹配分类规则
 * 
 * 匹配逻辑：
 * 1. 如果规则指定了类型ID，则媒体必须包含至少一个指定类型
 * 2. 如果规则指定了原产国，则媒体必须包含至少一个指定国家
 * 3. 所有指定的条件都必须满足
 * 
 * @param details - TMDB媒体详情
 * @param rule - 分类规则
 * @returns 是否匹配
 */
function matchRule(details: TMDBDetails, rule: ClassificationRule): boolean {
  const conditions = rule.conditions

  if (conditions.genreIds) {
    const requiredGenreIds = parseGenreIds(conditions.genreIds)
    const mediaGenreIds = details.genres.map(g => g.id)
    const hasMatchingGenre = requiredGenreIds.some(id => mediaGenreIds.includes(id))
    if (!hasMatchingGenre) {
      return false
    }
  }

  if (conditions.originCountry) {
    const requiredCountries = parseOriginCountries(conditions.originCountry)
    const mediaCountries = (details.originCountry || []).map(c => c.toUpperCase())
    const hasMatchingCountry = requiredCountries.some(c => mediaCountries.includes(c))
    if (!hasMatchingCountry) {
      return false
    }
  }

  return true
}

/**
 * 从数据库获取自定义分类策略
 * 
 * @returns 自定义策略对象，未设置则返回null
 */
function getCustomStrategy(): ClassificationStrategy | null {
  const savedStrategy = getSetting('classification_strategy')
  if (savedStrategy) {
    try {
      return JSON.parse(savedStrategy)
    } catch (e) {
      return null
    }
  }
  return null
}

/**
 * 根据媒体信息进行分类
 * 
 * 按照策略中的规则顺序依次匹配，返回第一个匹配的规则对应的分类
 * 如果没有匹配的规则，返回默认分类
 * 
 * @param details - TMDB媒体详情
 * @param mediaType - 媒体类型：'movie' 或 'tv'
 * @param strategy - 可选的自定义分类策略，默认使用数据库中的策略或DEFAULT_STRATEGY
 * @returns 分类目录路径，如 "电影/国产电影"
 * 
 * @example
 * const details = { genres: [{ id: 16 }], originCountry: ['JP'], ... }
 * classifyMedia(details, 'tv') // 返回: "剧集/日本番剧"
 */
export function classifyMedia(
  details: TMDBDetails,
  mediaType: 'movie' | 'tv',
  strategy?: ClassificationStrategy
): string {
  let activeStrategy = strategy
  
  if (!activeStrategy) {
    activeStrategy = getCustomStrategy() || DEFAULT_STRATEGY
  }
  
  const rules = activeStrategy[mediaType] || []

  for (const rule of rules) {
    if (matchRule(details, rule)) {
      return rule.category
    }
  }

  return mediaType === 'movie' ? '电影/其他' : '剧集/其他'
}

/**
 * 根据类型ID获取类型名称
 * 
 * @param genreId - TMDB类型ID
 * @returns 类型中文名称，未知类型返回"未知"
 */
export function getGenreName(genreId: number): string {
  return GENRE_MAP[genreId] || '未知'
}

/**
 * 批量获取类型名称
 * 
 * @param genreIds - 类型ID数组
 * @returns 类型名称数组
 */
export function getGenreNames(genreIds: number[]): string[] {
  return genreIds.map(id => getGenreName(id))
}

/**
 * 获取默认分类策略
 * 
 * @returns 默认分类策略对象
 */
export function getDefaultStrategy(): ClassificationStrategy {
  return DEFAULT_STRATEGY
}

/**
 * 根据国家代码获取国家名称
 * 
 * @param code - ISO 3166-1国家代码
 * @returns 国家中文名称，未知国家返回原代码
 */
export function getCountryName(code: string): string {
  const countryMap: Record<string, string> = {
    CN: '中国',
    TW: '台湾',
    HK: '香港',
    JP: '日本',
    KP: '朝鲜',
    KR: '韩国',
    TH: '泰国',
    IN: '印度',
    SG: '新加坡',
    US: '美国',
    FR: '法国',
    GB: '英国',
    UK: '英国',
    DE: '德国',
    ES: '西班牙',
    IT: '意大利',
    NL: '荷兰',
    PT: '葡萄牙',
    RU: '俄罗斯',
  }
  return countryMap[code.toUpperCase()] || code
}

/**
 * 批量获取国家名称
 * 
 * @param codes - 国家代码数组
 * @returns 用 " / " 连接的国家名称字符串
 */
export function getCountriesName(codes: string[]): string {
  return codes.map(c => getCountryName(c)).join(' / ')
}
