/**
 * 应用版本信息（唯一源：config/version.json）
 * 前端组件请从这里读取，避免硬编码版本号。
 */
import versionInfo from '~~/config/version.json'

export interface AppVersionInfo {
  version: string
  author: string
  year: number
  github?: string
}

export const appVersionInfo = versionInfo as AppVersionInfo

/** 语义化版本号，如 1.1.3 */
export const APP_VERSION = appVersionInfo.version

/** 展示用版本号，如 v1.1.3 */
export const APP_VERSION_LABEL = `v${APP_VERSION}`

export const APP_AUTHOR = appVersionInfo.author
export const APP_YEAR = appVersionInfo.year
export const APP_GITHUB = appVersionInfo.github || ''

export default appVersionInfo