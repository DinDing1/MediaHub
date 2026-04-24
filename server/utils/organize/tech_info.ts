/**
 * 技术信息提取模块
 * 
 * 本模块负责从视频文件名中提取技术规格信息，包括：
 * - 视频格式（分辨率）：2160p、1080p、720p等
 * - 视频编码：H264、H265、AV1等
 * - 音频编码：DTS、DDP、TrueHD、Atmos等
 * - 发布组/压制组名称
 * - 版本信息：DC(导演剪辑版)、Extended(加长版)等
 * - WEB来源：Netflix、Disney+、Amazon等
 * - 特殊效果：HDR、DV(Dolby Vision)、Atmos等
 * 
 * 这些信息用于生成规范的文件名和分类标签
 */

import type { TechInfo } from './types'

/**
 * 内置发布组列表
 * 包含常见的压制组/发布组名称，用于从文件名中识别发布组
 */
export const BUILTIN_RELEASE_GROUPS: string[] = [
  'SiNNERS',
  'EVO',
  'AMIABLE',
  'SPARKS',
  'YIFY',
  'FXG',
  'LEGi0N',
  'HDMaNiAcS',
  'WiKi',
  'EuReKa',
  'BeAst',
  'HiDT',
  'CHD',
  'CtrlHD',
  'Esir',
  'DON',
  'Ebp',
  'FraMeSToR',
  'DEFLATE',
  'NTb',
  'LOL',
  'ASAP',
  'MySilu',
  'HDChina',
  'HDS',
  'QOQ',
  'NTG',
  'NAISU',
  'RARBG',
  'MKVTV',
  'blackTV',
  'GPTHD',
  'OurTV',
  'DreamHD',
  'CHDWEB',
  'Xiaomi',
  'HDCTV',
  'Huawei',
  'PTerWEB',
  'DDHDTV',
  'QHStudio',
  'SeeWeb',
  'TagWeb',
  'LeagueWEB',
  'SonyHD',
  'ADWEB',
  'MiniHD',
  'FRDS',
  'ALT',
  'TLF',
  'CMCT',
  'BHD',
  'TTG',
  'MTeam',
  'HDPT',
  'HDSky',
  'HDRoute',
  'HDHome',
  'HDTime',
  'HDArea',
  'HD4FANS',
  'TJUPT',
  'TJUPT2',
  'AUDiO',
  'VARYG',
  'FGT',
  'PAHE',
  'Ganool',
  'YTS',
  'ETRG',
  'JYK',
  'NhaNc3',
  'mHD',
  'MkvCage',
  'ShAaNiG',
  'PlayXD',
  'ION10',
  'RARBG',
  'Tigole',
  'Joy',
  'UTR',
  'Qman',
  'DHD',
  'HDS',
  'iFT',
  'SA89',
  'BMF',
  'SURCODE',
  'KiNGDOM',
  'MkvHub',
  'MkvCage',
  'PSA',
  'EVO',
  'STUTTERSHIT',
  'NERD',
  'TBS',
  'VYTO',
  'PAXA',
  'AOC',
  'BLOW',
  'CM8',
  'ROBOTS',
  'ROB',
  'TDP',
  'Grym',
  'BONE',
  'CRiSC',
  'SADPANDA',
  'NTb',
  'Kotenok',
  'Grym',
  'HiDt',
  'Geek',
  'CasStudio',
  'NewEdit',
  'NTG',
  'BiTOR',
  'DNL',
  'SANTi',
  'FASM',
  'ARNT',
  'SAPHiRE',
  'ALLiANCE',
  'COCAiNE',
  'DoNE',
  'DiAMOND',
  'SAPHiRE',
  'PUKKA',
  'NEPTUNE',
  'BESTHD',
  'SEPTiC',
  'WAF',
  'ESiR',
  'EbP',
  'CtrlHD',
  'DON',
  'PerfectionHD',
  'D-Z0N3',
  'HiDt',
  'CHD',
  'MySiLU',
  'WiKi',
  'BeAst',
  'ESiR',
  'HDS',
  'HDChina',
  'HDRoute',
  'HDSky',
  'MTeam',
  'TTG',
  'CMCT',
]

/**
 * WEB来源映射表
 * 将文件名中的缩写映射为完整的平台名称
 * 例如：NF -> Netflix, AMZN -> Amazon
 */
const WEB_SOURCES: Record<string, string> = {
  'NF': 'Netflix',
  'NETFLIX': 'Netflix',
  'AMZN': 'Amazon',
  'AMAZON': 'Amazon',
  'PRIMEVIDEO': 'Amazon',
  'PRIME': 'Amazon',
  'DSNP': 'Disney+',
  'DISNEYPLUS': 'Disney+',
  'DISNEY': 'Disney+',
  'HMAX': 'HMAX',
  'HBOMAX': 'HMAX',
  'MAX': 'MAX',
  'MAXPLUS': 'MAXPLUS',
  'ATVP': 'AppleTV+',
  'APPLETVPLUS': 'AppleTV+',
  'APPLETV': 'AppleTV+',
  'PCOK': 'PCOK',
  'PEACOCK': 'PCOK',
  'PMTP': 'PMTP',
  'PARAMOUNT': 'PMTP',
  'PARAMOUNTPLUS': 'PMTP',
  'HBO': 'HBO',
  'HULU': 'Hulu',
  'IT': 'iTunes',
  'ITUNES': 'iTunes',
  'BILIBILI': 'BiliBili',
  'BGLOBAL': 'B-Global',
  'KKTV': 'KKTV',
  'BAHA': 'Baha',
  'MYVIDEO': 'MyVideo',
  'FRIDAY': 'friDay',
  'LINETV': 'LINETV',
  'VIU': 'Viu',
  'CRUNCHYROLL': 'Crunchyroll',
  'ABEMA': 'Abema',
  'CATCHPLAY': 'CatchPlay',
}

/**
 * 标准化WEB来源名称
 * 将缩写转换为完整平台名称
 * 
 * @param source - 原始来源字符串
 * @returns 标准化后的平台名称
 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeWebSource(source: string): string {
  const key = source.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
  return WEB_SOURCES[key] || source
}

function findSpecStartIndex(base: string): number {
  const patterns = [
    /(?:^|[.\s_\-])(?:19\d{2}|20\d{2})(?:$|[.\s_\-])/i,
    /(?:^|[.\s_\-])(?:2160p|1080p|720p|480p|4320p|4k|8k|uhd|ultra[.\s_-]*hd)(?:$|[.\s_\-])/i,
    /(?:^|[.\s_\-])(?:web[-.\s_]*dl|webrip|blu[-\s]?ray|bluray|remux|hdtv|dvdrip)(?:$|[.\s_\-])/i,
    /(?:^|[.\s_\-])(?:hevc|h265|x265|h264|x264|avc|av1)(?:$|[.\s_\-])/i,
  ]

  const indexes = patterns
    .map(pattern => base.search(pattern))
    .filter(index => index >= 0)

  return indexes.length > 0 ? Math.min(...indexes) : 0
}

function getSpecSegment(base: string): string {
  const specStartIndex = findSpecStartIndex(base)
  return specStartIndex > 0 ? base.slice(specStartIndex) : base
}

/**
 * 从文件名中提取视频格式（分辨率）
 * 
 * 支持识别的格式：
 * - 4320p (8K)
 * - 2160p (4K/UHD)
 * - 1440p (2K)
 * - 1080p (Full HD)
 * - 720p (HD)
 * - 576p (SD)
 * - 480p (SD)
 * - 360p
 * 
 * @param base - 文件名（不含扩展名）
 * @returns 视频格式字符串，未识别则返回空字符串
 */
function extractVideoFormat(base: string): string {
  const patterns: [RegExp, string][] = [
    [/7680x4320|4320p|\b8k\b/i, '4320p'],
    [/3840x2160|2160p|\b4k\b|ultra\s*hd|\bultrahd\b|\buhd\b/i, '2160p'],
    [/1920x1080p|1920x1080|1080p|\bhd1080p\b|bd1080p|1080i/i, '1080p'],
    [/1280x720|1280\*720|720p|bd720p/i, '720p'],
    [/1440p|2k/i, '1440p'],
    [/1024x576|960x540|1024x560|1024x550|1024x554|1024x544/i, '576p'],
    [/480p|480i|960x528/i, '480p'],
    [/360p/i, '360p'],
  ]

  for (const [pattern, resolution] of patterns) {
    if (pattern.test(base)) {
      return resolution
    }
  }

  return ''
}

/**
 * 从文件名中提取资源类型（来源）
 * 
 * 支持识别的类型：
 * - BluRay REMUX: 蓝光原盘重封装
 * - UHD BluRay: 超高清蓝光
 * - BluRay: 蓝光
 * - WEB-DL: 网络下载源
 * - WEBRip: 网络录制源
 * - HDTV: 高清电视录制
 * - DVD: DVD源
 * - CAM/TS: 影院录制
 * 
 * @param base - 文件名（不含扩展名）
 * @returns 资源类型字符串，未识别则返回空字符串
 */
function extractResourceType(base: string): string {
  const patterns: [RegExp, string][] = [
    [/(?:uhd|ultra[.\s_-]*hd)[.\s_-]*blu[-\s]?ray[.\s_\-]*remux|blu[-\s]?ray[.\s_\-]*remux[.\s_-]*(?:uhd|ultra[.\s_-]*hd)|蓝光原盘remux/i, 'UHD BluRay REMUX'],
    [/blu[-\s]?ray[.\s_\-]*remux|bluray[.\s_\-]*remux/i, 'BluRay REMUX'],
    [/\bremux\b/i, 'REMUX'],
    [/(?:uhd|ultra[.\s_-]*hd)[.\s_-]*(?:blu[-\s]?ray|bd)|(?:blu[-\s]?ray|bd)[.\s_-]*(?:uhd|ultra[.\s_-]*hd)/i, 'UHD BluRay'],
    [/blu[-\s]?ray|bluray|\bbd\b|blu-ray/i, 'BluRay'],
    [/\bbrrip\b/i, 'BRRip'],
    [/\bhdrip\b/i, 'HDRip'],
    [/\bhddvd\b/i, 'HDDVD'],
    [/dvd\-?(5|9|10|14|18)|\bdvdrip\b|\bdvdscr\b|\bpdvd\b|\bdvd\b/i, 'DVD'],
    [/web\.?dl|\bwebdl\b|amzn\.web\-?dl|\bweb[- ]?dl\b/i, 'WEB-DL'],
    [/\bwebrip\b|\bweb[- ]?rip\b/i, 'WEBRip'],
    [/\bhr\-?hdtv\b|\bhdtvrip\b|\btvrip\b|\bpdtv\b|\bhdtv\b/i, 'HDTV'],
    [/\btv\b|\bdtv\b|\bpdtv\b/i, 'TV'],
    [/\bvhsrip\b/i, 'VHSRip'],
    [/\bvod\b/i, 'VOD'],
    [/\bcamrip\b|\bcam\b|camera/i, 'CAM'],
    [/\bts\b|\btc\b|\bhc\b/i, 'TS/TC/HC'],
    [/\br5\b/i, 'R5'],
    [/\bamzn\b/i, 'AMZN'],
    [/\bnf\b/i, 'NF'],
    [/\bp2p\b/i, 'P2P'],
  ]

  for (const [pattern, source] of patterns) {
    if (pattern.test(base)) {
      return source
    }
  }

  return ''
}

/**
 * 从文件名中提取视频编码
 * 
 * 支持识别的编码：
 * - H265/HEVC: 高效视频编码
 * - H264/AVC: 高级视频编码
 * - AV1: 开源视频编码
 * - VP9: Google视频编码
 * - MPEG-2/MPEG-4: 传统编码
 * - XVID/DIVX: 旧式编码
 * 
 * @param base - 文件名（不含扩展名）
 * @returns 视频编码字符串，未识别则返回空字符串
 */
function extractVideoCodec(base: string): string {
  if (/\b(H\.?265|H265|X265|HEVC)\b/i.test(base)) {
    return 'H265'
  }
  if (/\b(H\.?264|H264|X264|AVC)\b/i.test(base)) {
    return 'H264'
  }
  
  const match = base.match(/\b(AV1|VP9|MPEG-?2|MPEG-?4|VC-?1|XVID|DIVX)\b/i)
  if (match && match[1]) {
    return match[1].toUpperCase()
  }

  return ''
}

/**
 * 从文件名中提取音频编码
 * 
 * 支持识别的编码：
 * - DTS:X.7.1: DTS:X
 * - DTS-HD.MA.5.1: DTS-HD Master Audio 5.1
 * - DTS-HD: DTS-HD High Resolution
 * - DTS: 标准DTS
 * - TrueHD.7.1.Atmos: Dolby TrueHD / Dolby Atmos
 * - DDP.5.1.Atmos: Dolby Digital Plus / E-AC-3
 * - DD.5.1 / AC3.5.1: Dolby Digital
 * - AAC.2.0: 高级音频编码
 * - FLAC.2.0 / LPCM.2.0 / PCM.2.0: 无损音频
 * - Atmos / Atmos.7.1: 独立杜比全景声
 * 
 * 同时识别声道配置：7.1、5.1、2.0等
 * 
 * @param base - 文件名（不含扩展名）
 * @returns 音频编码字符串，未识别则返回空字符串
 */
function extractAudioCodec(base: string): string {
  const audioTracks: string[] = []

  const formatAudioTrack = (codec: string, channels?: string, atmos?: boolean): string => {
    const parts = [codec]
    if (channels) {
      parts.push(channels)
    }
    if (atmos) {
      parts.push('Atmos')
    }
    return parts.join('.')
  }

  const pushAudioTrack = (codec: string, match: RegExpMatchArray | null, channelIndex: number = 1, atmosIndex?: number) => {
    if (!match) {
      return false
    }

    const channels = match[channelIndex] || ''
    const atmos = atmosIndex !== undefined
      ? Boolean(match[atmosIndex])
      : /\bATMOS\b/i.test(match[0] || '')

    audioTracks.push(formatAudioTrack(codec, channels, atmos))
    return true
  }

  if (pushAudioTrack('DTS-HD.MA', base.match(/\bDTS[- .]?HD[- .]?MA(?:[.\s]?(\d+\.\d+))?(?:[.\s]*(ATMOS))?\b/i), 1, 2)) {
    return audioTracks.join('.')
  }

  const trueHdSegmentMatch = base.match(/\bTRUEHD(?:[.\s-]+(?:DOLBY|ATMOS|\d+\.\d+)){0,3}\b/i)
  if (trueHdSegmentMatch) {
    const segment = trueHdSegmentMatch[0]
    const ch = segment.match(/(\d+\.\d+)/)?.[1] || ''
    const atmos = /\bATMOS\b/i.test(segment)
    audioTracks.push(formatAudioTrack('TrueHD', ch, atmos))
    return audioTracks.join('.')
  }

  pushAudioTrack('DTS:X', base.match(/\bDTS(?:[- .]?X|X)(?:[.\s]?(\d+\.\d+))?(?:[.\s]*(ATMOS))?\b/i), 1, 2)
  pushAudioTrack('DTS-HD', base.match(/\bDTS[- .]?HD(?:[.\s]?(\d+\.\d+))?(?:[.\s]*(ATMOS))?\b/i), 1, 2)
  pushAudioTrack('DTS', base.match(/\bDTS(?:[.\s]?(\d+\.\d+))?(?:[.\s]*(ATMOS))?\b/i), 1, 2)
  pushAudioTrack('DDP', base.match(/\b(?:DDP|DD\+|E-?AC-?3|DOLBY[.\s]*DIGITAL[.\s]*PLUS)(?:[.\s]?(\d+\.\d+))?(?:[.\s]*(ATMOS))?\b/i), 1, 2)
  pushAudioTrack('DD', base.match(/\bDD(?:[.\s]?(\d+\.\d+))?\b/i))
  pushAudioTrack('AC3', base.match(/\bAC[- ]?3(?:[.\s]?(\d+\.\d+))?\b/i))
  pushAudioTrack('FLAC', base.match(/\bFLAC(?:[.\s]?(\d+\.\d+))?\b/i))
  pushAudioTrack('AAC', base.match(/\bAAC(?:[.\s]?(\d+\.\d+))?\b/i))
  pushAudioTrack('LPCM', base.match(/\bLPCM(?:[.\s]?(\d+\.\d+))?\b/i))
  pushAudioTrack('PCM', base.match(/\bPCM(?:[.\s]?(\d+\.\d+))?\b/i))

  if (audioTracks.length === 0) {
    const atmosOnlyMatch = base.match(/\b(?:DOLBY[.\s]*)?ATMOS(?:[.\s]?(\d+\.\d+))?\b/i)
    if (atmosOnlyMatch) {
      audioTracks.push(formatAudioTrack('Atmos', atmosOnlyMatch[1] || ''))
    }
  }

  if (audioTracks.length > 0) {
    const filtered = audioTracks.filter(track => {
      if (track.startsWith('DTS-HD.MA')) return true
      if (track.startsWith('DTS:X')) return !audioTracks.some(item => item.startsWith('DTS-HD.MA'))
      if (track.startsWith('DTS-HD')) return !audioTracks.some(item => item.startsWith('DTS-HD.MA') || item.startsWith('DTS:X'))
      if (track.startsWith('DTS')) return !audioTracks.some(item => item.startsWith('DTS-HD') || item.startsWith('DTS-HD.MA') || item.startsWith('DTS:X'))
      if (track.startsWith('DDP')) return true
      if (track.startsWith('DD')) return !audioTracks.some(item => item.startsWith('DDP'))
      if (track.startsWith('AC3')) return !audioTracks.some(item => item.startsWith('DDP') || item.startsWith('DD'))
      if (track.startsWith('LPCM')) return true
      if (track.startsWith('PCM')) return !audioTracks.some(item => item.startsWith('LPCM'))
      return true
    })

    return Array.from(new Set(filtered)).slice(0, 2).join('.')
  }

  if (/\bOPUS\b/i.test(base)) {
    return 'OPUS'
  }
  if (/\bMP3\b/i.test(base)) {
    return 'MP3'
  }

  return ''
}

/**
 * 从文件名中提取WEB来源
 * 识别文件名中的流媒体平台标识
 * 
 * @param base - 文件名（不含扩展名）
 * @returns WEB来源平台名称，未识别则返回空字符串
 */
function extractWebSource(base: string): string {
  const candidates = Object.keys(WEB_SOURCES)
  
  const sortedCandidates = candidates.sort((a, b) => b.length - a.length)
  
  for (const candidate of sortedCandidates) {
    if (!candidate) continue
    const pattern = new RegExp(`(?:^|[.\\s_\\-\\[\\(\\{])${candidate}(?:$|[.\\s_\\-\\]\\)\\}@])`, 'i')
    if (pattern.test(base)) {
      return normalizeWebSource(candidate)
    }
  }

  return ''
}

/**
 * 从文件名中提取版本信息
 * 
 * 支持识别的版本：
 * - DC: 导演剪辑版 (Director's Cut)
 * - Extended: 加长版
 * - Uncut: 未删减版
 * - Unrated: 未分级版
 * - Theatrical: 剧场版
 * - Remastered: 重制版
 * - Criterion: 标准收藏版
 * - IMAX: IMAX版本
 * - 3D: 3D版本
 * - PROPER/REPACK: 修正版
 * 
 * @param base - 文件名（不含扩展名）
 * @returns 版本信息字符串，多个版本用点号连接
 */
function extractEdition(base: string): string {
  const editions: string[] = []

  if (/\bDC\b|Director'?s?\s*Cut/i.test(base)) {
    editions.push('DC')
  }
  if (/\bExtended\b|加长版/i.test(base)) {
    editions.push('Extended')
  }
  if (/\bUncut\b|未删减/i.test(base)) {
    editions.push('Uncut')
  }
  if (/\bUnrated\b/i.test(base)) {
    editions.push('Unrated')
  }
  if (/\bTheatrical\b|剧场版/i.test(base)) {
    editions.push('Theatrical')
  }
  if (/\bRemastered\b|重制/i.test(base)) {
    editions.push('Remastered')
  }
  if (/\bCriterion\b|\bCC\b/i.test(base)) {
    editions.push('Criterion')
  }
  if (/\bIMAX/i.test(base)) {
    editions.push('IMAX')
  }
  if (/\b3D\b/i.test(base)) {
    editions.push('3D')
  }
  if (/\bPROPER/i.test(base)) {
    editions.push('PROPER')
  }
  if (/\bREPACK/i.test(base)) {
    editions.push('REPACK')
  }

  return editions.join('.')
}

/**
 * 从文件名中提取特效信息
 * 
 * 支持识别的特效：
 * - DV: Dolby Vision
 * - HDR10+: HDR10 Plus
 * - HDR10: 标准HDR10
 * - HDR: 通用HDR
 * - HLG: Hybrid Log-Gamma
 * - SDR: 标准动态范围
 * - UHD: 超高清标识
 * - 8bit/10bit/12bit: 色深
 * - fps: 帧率
 * 
 * @param base - 文件名（不含扩展名）
 * @returns 特效信息字符串，多个特效用空格分隔
 */
function extractEffects(base: string): string {
  const effects: string[] = []

  if (/\b(DV|DOVI|DOLBY[ .-]?VISION)\b/i.test(base)) {
    effects.push('DV')
  }
  if (/\bHDR10\+\b|\bHDR10PLUS\b|\bHDR10P\b/i.test(base)) {
    effects.push('HDR10+')
  } else if (/\bHDR10\b/i.test(base)) {
    effects.push('HDR10')
  } else if (/\bHDR\b/i.test(base) && !/\bHDR10/.test(base)) {
    effects.push('HDR')
  }
  if (/\bHLG\b/i.test(base)) {
    effects.push('HLG')
  }
  if (/\bSDR\b/i.test(base) && effects.length === 0) {
    effects.push('SDR')
  }
  if (/\bUHD\b|\bULTRA[.\s_-]*HD\b/i.test(base)) {
    effects.push('UHD')
  }
  if (/\bHQ\b/i.test(base)) {
    effects.push('HQ')
  }

  const bitMatch = base.match(/\b(8|10|12)\s*bit\b/i)
  if (bitMatch) {
    effects.push(`${bitMatch[1]}bit`)
  }

  const fpsMatch = base.match(/\b(\d{2,3})\s*fps\b/i)
  if (fpsMatch) {
    effects.push(`${fpsMatch[1]}fps`)
  }

  return effects.join(' ')
}

/**
 * 从文件名中提取完整的技术信息
 * 
 * 这是本模块的主函数，整合所有技术信息提取逻辑：
 * 1. 提取视频格式（分辨率）
 * 2. 提取视频编码
 * 3. 提取音频编码
 * 4. 提取WEB来源
 * 5. 提取版本信息
 * 6. 提取特效信息
 * 7. 提取发布组名称
 * 
 * @param fileName - 完整文件名（含扩展名）
 * @param releaseGroups - 可选的发布组列表，用于优先匹配
 * @returns TechInfo对象，包含所有提取的技术信息
 * 
 * @example
 * extractTechInfo("Avatar.2009.2160p.UHD.BluRay.REMUX.DV.HDR10.DTS-HD.MA.7.1.mkv")
 * // 返回: {
 * //   videoFormat: "2160p",
 * //   videoCodec: "",
 * //   audioCodec: "DTS-HD.MA.7.1",
 * //   releaseGroup: "",
 * //   edition: "UHD BluRay REMUX DV HDR10",
 * //   webSource: "",
 * //   fileExt: ".mkv"
 * // }
 */
export function extractTechInfo(fileName: string, releaseGroups: string[] = []): TechInfo {
  const name = fileName.trim()
  const base = name.replace(/\.[^.]+$/, '')
  const ext = name.includes('.') ? '.' + name.split('.').pop() : ''

  const videoFormat = extractVideoFormat(base)
  const specSegment = getSpecSegment(base)
  const resourceType = extractResourceType(specSegment)
  const videoCodec = extractVideoCodec(specSegment)
  const audioCodec = extractAudioCodec(specSegment)
  const webSource = extractWebSource(specSegment)
  const editionBase = extractEdition(specSegment)
  const effects = extractEffects(specSegment)
  const normalizedEffects = effects
    .split(/\s+/)
    .filter(effect => effect && !(resourceType.includes('UHD') && effect === 'UHD'))
    .join(' ')

  let edition = ''
  if (resourceType && normalizedEffects) {
    edition = `${resourceType} ${normalizedEffects}`
  } else {
    edition = resourceType || normalizedEffects || ''
  }
  if (editionBase) {
    edition = edition ? `${edition} ${editionBase}` : editionBase
  }

  let releaseGroup = ''

  if (releaseGroups.length > 0) {
    for (const group of releaseGroups) {
      const escapedGroup = escapeRegExp(group)
      const pattern = new RegExp(`(?:^|[.\\s_\\-\\[\\(\\{@])${escapedGroup}(?:$|[.\\s_\\-\\]\\)\\}@])`, 'i')
      if (pattern.test(specSegment)) {
        releaseGroup = group
        break
      }
    }
  }

  if (!releaseGroup) {
    const match = specSegment.match(/[-@]([A-Za-z0-9]+)$/)
    if (match && match[1]) {
      const candidate = match[1]
      const badGroups = ['DL', 'WEB', 'WEBDL', 'WEBRIP', 'BLURAY', 'REMUX', 'BD', 'H264', 'H265', 'X264', 'X265']
      if (!badGroups.includes(candidate.toUpperCase())) {
        releaseGroup = candidate
      }
    }
  }

  return {
    videoFormat,
    resourceType,
    videoCodec,
    audioCodec,
    releaseGroup,
    edition,
    webSource,
    fileExt: ext,
  }
}

/**
 * 构建质量标签字符串
 * 将技术信息组合成可读的质量标签
 * 
 * @param tech - 技术信息对象
 * @returns 质量标签字符串
 * 
 * @example
 * buildQualityLabel({ videoFormat: "2160p", webSource: "Netflix", ... })
 * // 返回: "2160p Netflix ..."
 */
export function buildQualityLabel(tech: TechInfo): string {
  const parts: string[] = []

  if (tech.videoFormat) {
    parts.push(tech.videoFormat)
  }
  if (tech.webSource) {
    parts.push(tech.webSource)
  }
  if (tech.edition) {
    parts.push(tech.edition)
  }
  if (tech.videoCodec) {
    parts.push(tech.videoCodec)
  }
  if (tech.audioCodec) {
    parts.push(tech.audioCodec)
  }

  return parts.join(' ')
}

/**
 * 获取内置发布组列表
 * 返回预设的常见发布组名称
 * 
 * @returns 内置发布组列表
 */
export function getBuiltinReleaseGroups(): string[] {
  return [...BUILTIN_RELEASE_GROUPS]
}

/**
 * 获取完整的发布组列表
 * 合并内置发布组和自定义发布组
 * 
 * @returns 发布组列表
 */
export function loadReleaseGroups(): string[] {
  const builtin = getBuiltinReleaseGroups()
  try {
    const { getSetting } = require('../db')
    const customGroupsStr = getSetting('custom_release_groups')
    if (customGroupsStr) {
      const customGroups = JSON.parse(customGroupsStr) as string[]
      if (Array.isArray(customGroups) && customGroups.length > 0) {
        const combined = [...builtin]
        for (const group of customGroups) {
          if (group && typeof group === 'string' && !combined.includes(group)) {
            combined.push(group)
          }
        }
        return combined
      }
    }
  } catch (e) {
    // 忽略错误，返回内置列表
  }
  return builtin
}
