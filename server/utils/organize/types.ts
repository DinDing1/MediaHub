/**
 * 云盘整理模块类型定义
 * 
 * 本模块定义了云盘整理功能所需的所有TypeScript类型和接口
 * 包括文件信息、技术信息、TMDB搜索结果、分类规则、重命名模板等
 * 
 * 主要类型:
 * - FileInfo: 从文件名提取的基本信息（标题、年份、季集等）
 * - TechInfo: 视频技术信息（格式、编码、发布组等）
 * - TMDBSearchResult: TMDB搜索结果
 * - TMDBDetails: TMDB详细信息
 * - FileItem: 云盘文件/文件夹项
 * - OrganizeExecuteParams: 整理执行参数
 * - OrganizeExecuteResult: 整理执行结果
 */

/**
 * 文件基本信息
 * 从文件名中提取的关键信息，用于媒体识别
 */
export interface FileInfo {
  /** 媒体标题（电影名或剧集名） */
  title: string
  /** 发行年份 */
  year: string | null
  /** 季数（仅电视剧） */
  season: number | null
  /** 集数（仅电视剧） */
  episode: number | null
  /** 总集数（仅电视剧文件夹） */
  totalEpisodes: number | null
  /** 媒体类型：电影或电视剧 */
  mediaType: 'movie' | 'tv'
  /** 备用搜索查询字符串，当标题搜索失败时使用 */
  fallbackQuery: string | null
  /** TMDB ID（如果文件名中包含） */
  tmdbId: number | null
}

/**
 * 视频技术信息
 * 从文件名中提取的技术规格信息
 */
export interface TechInfo {
  /** 视频格式：2160p、1080p、720p等 */
  videoFormat: string
  /** 资源类型：WEB-DL、BluRay、HDTV等 */
  resourceType: string
  /** 视频编码：H264、H265、AV1等 */
  videoCodec: string
  /** 音频编码：DTS、DDP、TrueHD等 */
  audioCodec: string
  /** 发布组/压制组名称 */
  releaseGroup: string
  /** 版本信息：DC(导演剪辑版)、Extended(加长版)等 */
  edition: string
  /** WEB来源：Netflix、Disney+等 */
  webSource: string
  /** 文件扩展名 */
  fileExt: string
}

/**
 * TMDB搜索结果
 * 从TMDB API搜索返回的基本信息
 */
export interface TMDBSearchResult {
  /** TMDB ID */
  id: number
  /** 标题（本地化） */
  title: string
  /** 原始标题 */
  originalTitle: string
  /** 发行年份 */
  year: string
  /** 剧情简介 */
  overview: string
  /** 海报图片路径 */
  posterPath: string | null
  /** 背景图片路径 */
  backdropPath: string | null
  /** 媒体类型 */
  mediaType: 'movie' | 'tv'
  /** 评分 */
  voteAverage: number
  /** 类型ID列表 */
  genreIds: number[]
  /** 原产国列表 */
  originCountry: string[]
}

export interface TMDBMatchResult {
  result: TMDBSearchResult
  score: number
  yearMatched: boolean
  titleMatchType: 'exact' | 'contains' | 'partial' | 'fuzzy'
  matchedBy?: 'search' | 'detail-alias'
}

/**
 * TMDB季信息
 * 用于缺失检测等功能
 */
export interface TMDBSeason {
  /** 季数 */
  season_number: number
  /** 该季集数 */
  episode_count: number
  /** 季名称 */
  name: string
  /** 首播日期 */
  air_date?: string
}

/**
 * TMDB详细信息
 * 从TMDB API获取的完整媒体信息
 */
export interface TMDBDetails {
  /** TMDB ID */
  id: number
  /** 标题（本地化，优先中文） */
  title: string
  /** 中文标题（如果有） */
  titleCn: string | null
  /** 英文标题 */
  titleEn: string
  /** 原始标题 */
  originalTitle: string
  /** TMDB 记录中的别名列表（含地区别名） */
  alternativeTitles?: string[]
  /** 发行年份 */
  year: string
  /** 剧情简介 */
  overview: string
  /** 海报图片完整URL */
  posterUrl: string | null
  /** 背景图片完整URL */
  backdropUrl: string | null
  /** 类型列表 */
  genres: { id: number; name: string }[]
  /** 原产国列表 */
  originCountry: string[]
  /** 评分 */
  voteAverage: number
  /** 时长（分钟，仅电影） */
  runtime: number | null
  /** 季数（仅电视剧） */
  numberOfSeasons: number | null
  /** 集数（仅电视剧） */
  numberOfEpisodes: number | null
  /** 季信息列表（仅电视剧，用于缺失检测） */
  seasons?: TMDBSeason[]
}

/**
 * 分类规则条件
 * 用于判断媒体应归类到哪个目录
 */
export interface ClassificationRule {
  /** 分类目录名称 */
  category: string
  /** 匹配条件 */
  conditions: {
    /** 类型ID（逗号分隔） */
    genreIds?: string
    /** 原产国（逗号分隔） */
    originCountry?: string
  }
}

/**
 * 分类策略配置
 * 定义电影和电视剧的分类规则
 */
export interface ClassificationStrategy {
  /** 电影分类规则 */
  movie: ClassificationRule[]
  /** 电视剧分类规则 */
  tv: ClassificationRule[]
}

/**
 * 重命名模板配置
 * 定义文件重命名的格式模板
 */
export interface RenameTemplate {
  /** 电影重命名模板 */
  movie: string
  /** 电视剧重命名模板 */
  tv: string
}

/**
 * 识别结果
 * 文件识别后返回的完整信息
 */
export interface RecognizeResult {
  /** 媒体类型 */
  mediaType: 'movie' | 'tv'
  /** TMDB ID */
  tmdbId: number
  /** 标题 */
  title: string
  /** 原始标题 */
  originalTitle: string
  /** 年份 */
  year: string
  /** 海报URL */
  posterUrl: string | null
  /** 背景图URL */
  backdropUrl: string | null
  /** 简介 */
  overview: string
  /** 类型列表 */
  genres: string[]
  /** 原产国 */
  originCountry: string[]
  /** 评分 */
  voteAverage: number
  /** 分类目录 */
  category: string
  /** 目标目录ID */
  destRootId: string
  /** 建议的目标路径 */
  suggestedPath: string
  /** 技术信息 */
  tech: TechInfo
}

/**
 * 云盘文件/文件夹项
 * 从115云盘API返回的文件信息
 */
export interface FileItem {
  /** 类型：文件或文件夹 */
  type: 'file' | 'folder'
  /** 是否为文件夹 */
  is_dir: boolean
  /** 文件名 */
  name: string
  /** 文件ID */
  fileId: string
  /** 目录ID（用于目录选择器） */
  cid: string
  /** 父目录ID */
  parentId: string
  /** 文件大小（字节） */
  size: number
  /** 更新时间 */
  updatedAt: string | null
  /** 提取码 */
  pickcode?: string
}

/**
 * 整理执行参数
 * 执行整理操作时传递的参数
 */
export interface OrganizeExecuteParams {
  /** 平台：目前仅支持115云盘 */
  platform: '115'
  /** 源类型：文件或文件夹 */
  srcType: 'file' | 'folder'
  /** 操作类型：移动或复制 */
  action: 'move' | 'copy'
  /** 文件ID（srcType为file时必填） */
  fileId?: string
  /** 文件名（srcType为file时必填） */
  fileName?: string
  /** 文件夹ID（srcType为folder时必填） */
  folderId?: string
  /** 文件夹名（srcType为folder时必填） */
  folderName?: string
  /** 文件大小提示（字节） */
  sizeBytesHint?: number
  /** 媒体类型（可选，用于覆盖自动识别） */
  mediaType?: 'movie' | 'tv'
  /** TMDB ID（可选，用于覆盖自动识别） */
  tmdbId?: number
  /** 建议的目标路径（可选，用于覆盖自动生成） */
  suggestedPath?: string
}

/**
 * 整理执行结果
 * 整理操作执行后返回的结果
 */
export interface OrganizeExecuteResult {
  /** 是否成功 */
  success: boolean
  /** 错误信息（失败时） */
  error?: string
  /** 详细数据 */
  data?: {
    /** 原始路径 */
    originalPath: string
    /** 目标路径 */
    targetPath: string
    /** 操作类型 */
    action: string
  }
}

/**
 * 支持的视频文件扩展名列表
 */
export const VIDEO_EXTENSIONS = [
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v',
  '.ts', '.m2ts', '.mpg', '.mpeg', '.rmvb', '.rm', '.vob', '.iso'
]

/**
 * 支持的字幕文件扩展名列表
 */
export const SUBTITLE_EXTENSIONS = [
  '.srt', '.ass', '.ssa', '.sub', '.vtt', '.idx', '.sup', '.smi'
]
