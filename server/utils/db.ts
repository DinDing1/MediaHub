/**
 * 数据库工具统一出口（兼容 from '../utils/db'）
 * 实现位于 server/lib/db/*，避免 Nitro 对 utils 子目录重复 auto-import
 */
export { CONFIG_DEFINITIONS } from '../lib/db/definitions'
export { getDB } from '../lib/db/connection'
export { getSetting, setSetting, getAllSettings } from '../lib/db/settings'
export {
  type OrganizeRecord,
  addOrganizeRecord,
  getOrganizeRecords,
  getOrganizeRecordsCount,
  deleteOrganizeRecord,
  clearOrganizeRecords
} from '../lib/db/organize'
export {
  type DirectLinkCache,
  getDirectLinkCache,
  saveDirectLinkCache
} from '../lib/db/direct_link'
export {
  type MediaInfoFollowQueueRecord,
  type MediaInfoFollowQueueStats,
  type EnqueueMediaInfoFollowItemInput,
  enqueueMediaInfoFollowItem,
  resetProcessingMediaInfoFollowQueueItems,
  claimPendingMediaInfoFollowQueueItems,
  getOldestPendingMediaInfoFollowQueueItem,
  finalizeMediaInfoFollowQueueItem,
  failMediaInfoFollowQueueItem,
  getMediaInfoFollowQueueStats
} from '../lib/db/media_info_queue'
export {
  type TMDBCorrection,
  getTMDBCorrection,
  getAllTMDBCorrections,
  setTMDBCorrection,
  deleteTMDBCorrection
} from '../lib/db/tmdb'
