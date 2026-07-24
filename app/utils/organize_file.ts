/**
 * 云盘整理页通用文件工具
 */

export const VIDEO_EXTS = [
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'ts', 'm2ts', 'mpg', 'mpeg', '3gp', 'rmvb', 'rm'
]

export const SUBTITLE_EXTS = ['srt', 'ass', 'ssa', 'sub', 'idx', 'vtt', 'sup']

export function getFileExtension(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function isVideoFile(name: string): boolean {
  return VIDEO_EXTS.includes(getFileExtension(name))
}

export function isSubtitleFile(name: string): boolean {
  return SUBTITLE_EXTS.includes(getFileExtension(name))
}

export function formatSize(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}
