/**
 * 应用版本信息（唯一实现：config/version.json）
 */
import versionInfo from './version.json'

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
