<template>
  <div class="duplicates-tab">
    <div class="section-box" :class="{ dark: isDark }">
      <div class="section-box-header">
        <h2 class="section-box-title">剧集查重</h2>
        <span class="section-box-desc" :class="{ dark: isDark }">扫描媒体库中的重复内容</span>
      </div>
      <div class="section-box-content">
        <div class="filter-section">
          <div class="filter-left">
            <div class="form-group">
              <label class="form-label" :class="{ dark: isDark }">选择媒体库</label>
              <select v-model="selectedLibrary" class="form-select" :class="{ dark: isDark }">
                <option value="">全部媒体库</option>
                <option v-for="lib in libraries" :key="lib.Id" :value="lib.Id">{{ lib.Name }} · {{ lib.TypeLabel }}</option>
              </select>
            </div>
          </div>
          <div class="filter-right">
            <button class="btn btn-outline btn-sm" @click="openSettings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              <span>查重设置</span>
            </button>
            <button class="btn btn-primary btn-sm" :disabled="isAnalyzing || isDeleting" @click="startAnalysis">
              <svg v-if="isAnalyzing || isDeleting" class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/></svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              <span>{{ isDeleting ? '删除中...' : (isAnalyzing ? '扫描中...' : '开始查重') }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="hasReport" class="section-box" :class="{ dark: isDark }">
      <div class="section-box-header">
        <h2 class="section-box-title">查重结果</h2>
        <div class="header-right">
          <span v-if="selectedCount > 0" class="selected-badge" :class="{ dark: isDark }">已选 {{ selectedCount }} 项待删除</span>
          <button class="btn btn-danger btn-sm" :disabled="isDeleting || selectedCount === 0" @click="batchDelete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            <span>批量删除</span>
          </button>
          <button class="btn btn-secondary btn-sm" @click="exportReport">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>导出报告</span>
          </button>
        </div>
      </div>
      <div class="section-box-content">
        <div class="stats-row">
          <div class="stat-item" :class="{ dark: isDark }">
            <div class="stat-icon red">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
            </div>
            <div class="stat-content">
              <span class="stat-value" :class="{ dark: isDark }">{{ totalDuplicates }}</span>
              <span class="stat-label" :class="{ dark: isDark }">重复项目</span>
            </div>
          </div>
          <div class="stat-item" :class="{ dark: isDark }">
            <div class="stat-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>
              </svg>
            </div>
            <div class="stat-content">
              <span class="stat-value" :class="{ dark: isDark }">{{ movieDuplicates }}</span>
              <span class="stat-label" :class="{ dark: isDark }">电影重复</span>
            </div>
          </div>
          <div class="stat-item" :class="{ dark: isDark }">
            <div class="stat-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                <polyline points="17 2 12 7 7 2"/>
              </svg>
            </div>
            <div class="stat-content">
              <span class="stat-value" :class="{ dark: isDark }">{{ seriesDuplicates }}</span>
              <span class="stat-label" :class="{ dark: isDark }">剧集重复</span>
            </div>
          </div>
          <div class="stat-item" :class="{ dark: isDark }">
            <div class="stat-icon orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div class="stat-content">
              <span class="stat-value" :class="{ dark: isDark }">{{ episodeDuplicates }}</span>
              <span class="stat-label" :class="{ dark: isDark }">集数重复</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isAnalyzing && currentMessage" class="section-box" :class="{ dark: isDark }">
      <div class="section-box-content">
        <div class="progress-container">
          <div class="progress-spinner">
            <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
            </svg>
          </div>
          <div class="progress-message">
            <span class="progress-text" :class="{ dark: isDark }">{{ currentMessage }}</span>
          </div>
        </div>
      </div>
    </div>

    <template v-if="hasReport">
      <div 
        v-for="(items, libName) in filteredReport" 
        :key="libName"
        class="section-box" 
        :class="{ dark: isDark }"
      >
        <div class="section-box-header">
          <h2 class="section-box-title">{{ libName }}</h2>
          <span class="count-tag" :class="{ dark: isDark }">{{ items.length }} 项</span>
        </div>
        <div class="section-box-content">
          <div v-if="groupedItems[libName]?.groups?.length" class="series-groups">
            <div v-for="group in groupedItems[libName].groups" :key="group.key" class="series-group" :class="({ dark: isDark } as Record<string, boolean>)">
              <div class="group-header" @click="toggleGroup(group.key)">
                <span class="group-toggle" :class="({ expanded: expandedGroups.has(group.key), dark: isDark } as Record<string, boolean>)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </span>
                <span class="kind-badge" :class="[group.kind]">
                  <svg v-if="group.kind === 'movie'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>
                  </svg>
                  <svg v-else-if="group.kind === 'series'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                    <polyline points="17 2 12 7 7 2"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {{ group.kind === 'movie' ? '电影' : group.kind === 'series' ? '剧集' : '集' }}
                </span>
                <h4 class="group-title" :class="{ dark: isDark }">{{ group.title }}</h4>
                <span v-if="group.year" class="duplicate-year" :class="{ dark: isDark }">({{ group.year }})</span>
                <span class="group-count" :class="{ dark: isDark }">{{ group.totalEpisodes }} {{ group.kind === 'episode' ? '集' : '项' }} · {{ group.totalVersions }} 个版本</span>
                <div class="group-actions" @click.stop>
                  <button class="group-action-btn toggle-group-btn" :class="({ active: isGroupInverted(group.key), 'inverted-flash': flashingGroup === group.key, dark: isDark } as Record<string, boolean>)" :title="isGroupInverted(group.key) ? '反选：改回删除质量差的' : '反选：改为删除质量好的'" @click="toggleGroupInvert(group.key)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                    <span>{{ isGroupInverted(group.key) ? '删优' : '删差' }}</span>
                  </button>
                  <button class="group-action-btn delete-group-btn" :class="{ dark: isDark }" :title="'删除选中版本'" :disabled="isDeleting" @click="deleteGroup(group)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    <span>删除</span>
                  </button>
                </div>
              </div>
              <transition name="collapse">
                <div v-show="expandedGroups.has(group.key)" class="group-body">
                  <div 
                    v-for="(item, itemIdx) in group.items" 
                    :key="item.id" 
                    class="duplicate-card"
                    :class="{ dark: isDark, [item.kind]: true }"
                  >
                    <div class="duplicate-header">
                      <div class="duplicate-info">
                        <h4 class="duplicate-title" :class="{ dark: isDark }">{{ item.title }}</h4>
                        <span v-if="item.episodeKey" class="episode-key" :class="{ dark: isDark }">{{ item.episodeKey }}</span>
                      </div>
                    </div>

                    <div class="duplicate-files">
                      <div 
                        v-for="(file, idx) in item.items" 
                        :key="idx" 
                        class="file-item"
                        :class="{ dark: isDark, ...getQualityByPosition(idx, item.items.length), 'will-delete': willDeleteInGroup(group.key, idx, item.items.length) }"
                      >
                        <div class="file-content">
                          <div class="file-header">
                            <span class="file-name" :class="{ dark: isDark }">{{ file.name }}</span>
                            <div class="file-tags">
                              <span v-for="tag in file.videoTags" :key="tag" class="video-tag" :class="{ dark: isDark }">{{ tag }}</span>
                            </div>
                          </div>
                          <div class="file-path" :class="{ dark: isDark }">
                            <span class="path-line path-folder" :title="file.folderPath">{{ file.folderPath }}</span>
                            <span class="path-line path-file" :title="file.fileName">{{ file.fileName }}</span>
                          </div>
                          <div class="file-meta">
                            <span class="quality-level" :class="getQualityClass(file.qualityScore)">{{ file.qualityLevel }}</span>
                            <span class="quality-score" :class="{ dark: isDark }">评分: {{ Math.round(file.qualityScore) }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else-if="!isAnalyzing" class="section-box" :class="{ dark: isDark }">
      <div class="section-box-content">
        <div class="empty-container" :class="{ 'empty-success': analyzedEmpty, dark: isDark }">
          <div class="empty-icon" :class="{ dark: isDark, success: analyzedEmpty }">
            <svg v-if="analyzedEmpty" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="9" y1="21" x2="9" y2="9"/>
            </svg>
          </div>
          <h3 class="empty-title" :class="{ dark: isDark, success: analyzedEmpty }">{{ analyzedEmpty ? '未发现重复' : '开始查重' }}</h3>
          <p class="empty-desc" :class="{ dark: isDark }">{{ analyzedEmpty ? '当前媒体库中没有检测到重复内容，非常整洁！' : '选择媒体库后点击"开始查重"进行扫描' }}</p>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showSettings" class="modal-overlay" :class="{ dark: isDark }" @click.self="showSettings = false">
        <div class="modal-box" :class="{ dark: isDark }">
          <div class="modal-head">
            <h3 class="modal-title" :class="{ dark: isDark }">查重设置</h3>
            <button class="modal-close-btn" :class="{ dark: isDark }" @click="showSettings = false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="modal-body-settings">
            <div class="setting-block">
              <p class="setting-label" :class="{ dark: isDark }">路径映射配置</p>
              <p class="setting-desc" :class="{ dark: isDark }">Emby 运行在 Docker 容器内，删除本地文件时需要将容器路径映射到本机路径。</p>
              <div v-for="(m, idx) in pathMappings" :key="idx" class="mapping-row" :class="{ dark: isDark }">
                <div class="mapping-fields">
                  <input v-model="m.containerPath" type="text" class="map-input" :class="{ dark: isDark }" placeholder="容器路径，如 /media" />
                  <span class="map-arrow">→</span>
                  <input v-model="m.localPath" type="text" class="map-input" :class="{ dark: isDark }" placeholder="本地路径，如 D:\media" />
                </div>
                <button class="map-remove" :class="{ dark: isDark }" @click="pathMappings.splice(idx, 1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
              <button class="add-map-btn" :class="{ dark: isDark }" @click="pathMappings.push({ containerPath: '', localPath: '' })">+ 添加映射</button>
            </div>

            <div class="helper-divider" :class="{ dark: isDark }"></div>

            <div class="setting-block helper-block" :class="{ dark: isDark, expanded: helperExpanded }">
              <button class="helper-toggle" :class="{ dark: isDark, expanded: helperExpanded }" type="button" @click="helperExpanded = !helperExpanded">
                <div class="helper-header">
                  <p class="setting-label" :class="{ dark: isDark }">路径映射助手</p>
                  <span class="helper-badge" :class="{ dark: isDark }">不知道怎么填？用这个工具自动提取</span>
                </div>
                <span class="helper-toggle-icon" :class="{ expanded: helperExpanded }" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
              </button>

              <transition name="collapse">
                <div v-show="helperExpanded" class="helper-panel">
                  <p class="setting-desc" :class="{ dark: isDark }">粘贴同一个文件在容器内的完整路径和在本地的完整路径，系统会自动分析出映射关系。</p>

                  <div class="helper-inputs">
                    <div class="helper-field" :class="{ dark: isDark }">
                      <label class="helper-label" :class="{ dark: isDark }">① 容器内完整路径（从 Emby 获取的文件路径）</label>
                      <input v-model="helperContainerPath" type="text" class="map-input helper-input" :class="{ dark: isDark }" placeholder="/Media115/电影/xxx/文件名.strm" />
                    </div>
                    <div class="helper-field" :class="{ dark: isDark }">
                      <label class="helper-label" :class="{ dark: isDark }">② 本地完整路径（同一文件的本地实际路径）</label>
                      <input v-model="helperLocalPath" type="text" class="map-input helper-input" :class="{ dark: isDark }" placeholder="D:/media/电影/xxx/文件名.strm 或 /vol2/1000/..." />
                    </div>
                  </div>

                  <button class="detect-btn" :class="{ dark: isDark }" :disabled="!helperContainerPath || !helperLocalPath || isDetecting" @click="detectMapping">
                    <svg v-if="isDetecting" class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/></svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <span>{{ isDetecting ? '分析中...' : '智能提取映射' }}</span>
                  </button>

                  <div v-if="helperResult" class="helper-result" :class="[helperResult.status, { dark: isDark }]">
                    <div class="result-top">
                      <span class="result-icon">{{ helperResult.status === 'success' ? '✅' : '❌' }}</span>
                      <span class="result-msg" :class="{ dark: isDark }">{{ helperResult.message.split('\n')[0] }}</span>
                    </div>
                    <div v-if="helperResult.status === 'success'" class="detected-mapping" :class="{ dark: isDark }">
                      <div class="detected-pair">
                        <div class="detected-item">
                          <span class="detected-tag container">容器前缀</span>
                          <code class="detected-value" :class="{ dark: isDark }" :title="helperResult.containerPrefix">{{ helperResult.containerPrefix }}</code>
                        </div>
                        <span class="detected-arrow">↘</span>
                        <div class="detected-item">
                          <span class="detected-tag local">本地前缀</span>
                          <code class="detected-value" :class="{ dark: isDark }" :title="helperResult.localPrefix">{{ helperResult.localPrefix }}</code>
                        </div>
                      </div>
                    </div>
                    <button v-if="helperResult.status === 'success'" class="apply-detected-btn" :class="{ dark: isDark }" @click="applyDetectedMapping">+ 添加到上方映射列表</button>
                  </div>
                </div>
              </transition>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-primary btn-sm" @click="saveSettings">保存设置</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSettings } from '~/composables/useSettings'

interface Props {
  isDark: boolean
}

const props = defineProps<Props>()

interface DuplicateItem {
  id: string
  path: string
  folderPath: string
  fileName: string
  name: string
  embyItemId: string
  mediaSourceId?: string
  deleteType: 'item' | 'media_source'
  qualityScore: number
  qualityLevel: string
  videoTags: string[]
  uniqueId: string
}

interface DuplicateReportItem {
  kind: 'movie' | 'series' | 'episode'
  title: string
  year?: number
  id: string
  show?: string
  episodeKey?: string
  items: DuplicateItem[]
}

interface ProgressInfo {
  message: string
  library?: string
  currentShow?: string
  progress?: number
  item?: DuplicateReportItem
  libraryComplete?: boolean
}

const { loadSettings, updateSettingsData } = useSettings()

const libraries = ref<any[]>([])
const selectedLibrary = ref('')
const isAnalyzing = ref(false)
const report = ref<Record<string, DuplicateReportItem[]>>({})
const currentMessage = ref('')
const expandedGroups = ref<Set<string>>(new Set())
const analyzedEmpty = ref(false)
const groupInverted = ref<Set<string>>(new Set())
const flashingGroup = ref<string | null>(null)
const isDeleting = ref(false)
const showSettings = ref(false)
const pathMappings = ref<Array<{ containerPath: string; localPath: string }>>([])
const helperContainerPath = ref('')
const helperLocalPath = ref('')
const isDetecting = ref(false)
const helperExpanded = ref(false)
const helperResult = ref<{ status: 'success' | 'error'; message: string; containerPrefix?: string; localPrefix?: string } | null>(null)
let uidCounter = 0
function genUid() { return `u_${Date.now()}_${++uidCounter}` }

const hasReport = computed(() => {
  const keys = Object.keys(report.value)
  if (keys.length === 0) return false
  for (const key of keys) {
    if (report.value[key] && report.value[key].length > 0) {
      return true
    }
  }
  return false
})

const filteredReport = computed(() => {
  const filtered: Record<string, DuplicateReportItem[]> = {}
  for (const [libName, items] of Object.entries(report.value)) {
    if (items && items.length > 0) {
      filtered[libName] = items
    }
  }
  return filtered
})

const totalDuplicates = computed(() => {
  let count = 0
  for (const items of Object.values(report.value)) {
    count += items?.length || 0
  }
  return count
})

const movieDuplicates = computed(() => {
  let count = 0
  for (const items of Object.values(report.value)) {
    if (items) {
      count += items.filter(item => item.kind === 'movie').length
    }
  }
  return count
})

const seriesDuplicates = computed(() => {
  const shows = new Set<string>()
  for (const items of Object.values(report.value)) {
    if (items) {
      for (const item of items) {
        if (item.kind === 'episode' && item.show) {
          shows.add(item.show)
        }
      }
    }
  }
  return shows.size
})

const episodeDuplicates = computed(() => {
  let count = 0
  for (const items of Object.values(report.value)) {
    if (items) {
      count += items.filter(item => item.kind === 'episode').length
    }
  }
  return count
})

const getQualityClass = (score: number): string => {
  if (score >= 4000) return 'top'
  if (score >= 3000) return 'high'
  if (score >= 2000) return 'medium'
  return 'low'
}

const getQualityBorderClass = (score: number): Record<string, boolean> => {
  if (score >= 4000) return { 'quality-best': true }
  if (score >= 2000) return { 'quality-good': true }
  return { 'quality-poor': true }
}

const getQualityByPosition = (index: number, total: number): Record<string, boolean> => {
  if (total <= 1) return { 'quality-best': true }
  if (index === 0) return { 'quality-best': true }
  if (index < Math.ceil(total / 2)) return { 'quality-good': true }
  return { 'quality-poor': true }
}

function splitPath(path: string): { folderPath: string; fileName: string } {
  if (!path) return { folderPath: '', fileName: '' }
  const normalized = path.replace(/\\/g, '/')
  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash === -1) {
    return { folderPath: '', fileName: path }
  }
  return {
    folderPath: normalized.substring(0, lastSlash),
    fileName: normalized.substring(lastSlash + 1)
  }
}

interface SeriesGroup {
  key: string
  kind: 'movie' | 'series' | 'episode'
  title: string
  year?: number
  show?: string
  items: DuplicateReportItem[]
  totalEpisodes: number
  totalVersions: number
}

const groupedItems = computed(() => {
  const result: { [key: string]: { groups: SeriesGroup[] } } = {}
  for (const [libName, items] of Object.entries(report.value)) {
    if (!items || items.length === 0) continue

    const episodeItems = items.filter(item => item.kind === 'episode')
    const otherItems = items.filter(item => item.kind !== 'episode')
    const allGroups: SeriesGroup[] = []

    if (episodeItems.length > 0) {
      const showMap = new Map<string, DuplicateReportItem[]>()
      for (const item of episodeItems) {
        const showKey = item.show || item.title
        if (!showMap.has(showKey)) {
          showMap.set(showKey, [])
        }
        showMap.get(showKey)!.push(item)
      }

      for (const [showName, groupItems] of showMap) {
        const first = groupItems[0]
        if (!first) continue
        let versions = 0
        for (const gi of groupItems) {
          versions += gi.items?.length || 0
        }
        allGroups.push({
          key: `${libName}::${showName}`,
          kind: first.kind,
          title: showName,
          year: first.year,
          show: first.show,
          items: groupItems.map(item => ({
            ...item,
            items: item.items.map(file => ({
              ...file,
              ...splitPath(file.path),
              uniqueId: (file as any).uniqueId || genUid()
            }))
          })),
          totalEpisodes: groupItems.length,
          totalVersions: versions
        })
      }
    }

    for (const item of otherItems) {
      allGroups.push({
        key: `${libName}::${item.id}`,
        kind: item.kind,
        title: item.title,
        year: item.year,
        items: [{
          ...item,
          items: item.items.map(file => ({
            ...file,
            ...splitPath(file.path),
            uniqueId: (file as any).uniqueId || genUid()
          }))
        }],
        totalEpisodes: 1,
        totalVersions: item.items?.length || 0
      })
    }

    if (allGroups.length > 0) {
      result[libName] = { groups: allGroups }
    }
  }
  return result
})

function toggleGroup(key: string) {
  const next = new Set(expandedGroups.value)
  if (next.has(key)) { next.delete(key) } else { next.add(key) }
  expandedGroups.value = next
}

function isGroupInverted(groupKey: string): boolean { return groupInverted.value.has(groupKey) }

function toggleGroupInvert(groupKey: string) {
  const n = new Set(groupInverted.value)
  n.has(groupKey) ? n.delete(groupKey) : n.add(groupKey)
  groupInverted.value = n
  flashingGroup.value = groupKey
  setTimeout(() => { flashingGroup.value = null }, 400)
}

function willDeleteInGroup(groupKey: string, idx: number, total: number): boolean {
  if (total <= 1) return false
  if (isGroupInverted(groupKey)) return idx === 0
  return idx > 0
}

const selectedCount = computed(() => {
  let count = 0
  for (const libData of Object.values(groupedItems.value)) {
    if (!libData?.groups) continue
    for (const g of libData.groups) {
      for (const item of g.items) {
        const len = item.items?.length || 0
        if (len <= 1) continue
        if (isGroupInverted(g.key)) count++
        else count += len - 1
      }
    }
  }
  return count
})

async function deleteGroup(group: SeriesGroup) {
  const items: Array<{ embyItemId: string; mediaSourceId?: string; deleteType: string; path?: string }> = []
  for (const item of group.items) {
    for (let i = 0; i < (item.items?.length || 0); i++) {
      if (willDeleteInGroup(group.key, i, item.items.length)) {
        const f = item.items[i]
        if (f) items.push({ embyItemId: f.embyItemId, mediaSourceId: f.mediaSourceId, deleteType: f.deleteType, path: f.path })
      }
    }
  }
  if (items.length === 0) return
  const inverted = isGroupInverted(group.key)
  const target = inverted ? '质量最好的' : '质量较差的'
  if (!confirm(`确认删除「${group.title}」的 ${target} 版本（共 ${items.length} 个文件）？\n将从 Emby 移除并尝试删除本地文件。`)) return
  await executeDelete(items)
}

async function batchDelete() {
  if (selectedCount.value === 0) return
  if (!confirm(`确认批量删除全部 ${selectedCount.value} 个选中版本？\n默认将删除每个重复组中质量较差的版本，已反选的组将删除质量好的版本。\n此操作将从 Emby 移除这些项目并尝试删除本地 STRM 文件。`)) return

  const allItems: Array<{ embyItemId: string; mediaSourceId?: string; deleteType: string; path?: string }> = []
  for (const libData of Object.values(groupedItems.value)) {
    if (!libData?.groups) continue
    for (const group of libData.groups) {
      for (const item of group.items) {
        for (let i = 0; i < (item.items?.length || 0); i++) {
          if (willDeleteInGroup(group.key, i, item.items.length)) {
            const f = item.items[i]
            if (f) allItems.push({ embyItemId: f.embyItemId, mediaSourceId: f.mediaSourceId, deleteType: f.deleteType, path: f.path })
          }
        }
      }
    }
  }
  await executeDelete(allItems)
}

async function executeDelete(items: Array<{ embyItemId: string; mediaSourceId?: string; deleteType: string; path?: string }>) {
  isDeleting.value = true
  try {
    const res = await fetch('/api/emby/delete_duplicates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) })
    const data = await res.json()
    if (data.success) alert(`删除完成！成功: ${data.summary.embySuccess}/${data.summary.total}，失败: ${data.summary.embyFail}`)
    else alert('删除失败: ' + (data.error || '未知错误'))
  } catch (e: any) { alert('删除请求异常: ' + e.message) } finally { isDeleting.value = false }
}

async function loadPathMappings() {
  try {
    const d = await loadSettings()
    if (d.success && d.data?.pathMapping) {
      try {
        const p = JSON.parse(d.data.pathMapping)
        if (Array.isArray(p)) pathMappings.value = p.filter((m: any) => m.containerPath && m.localPath).map((m: any) => ({ containerPath: m.containerPath, localPath: m.localPath }))
      } catch { pathMappings.value = [] }
    }
  } catch {}
}

function openSettings() {
  helperExpanded.value = false
  helperResult.value = null
  showSettings.value = true
}

async function saveSettings() {
  try {
    const normalizedMappings = pathMappings.value
      .filter(m => m.containerPath.trim() && m.localPath.trim())
      .map(m => ({
        containerPath: m.containerPath.trim(),
        localPath: m.localPath.trim()
      }))

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path_mapping: JSON.stringify(normalizedMappings) })
    })
    const d = await res.json()
    if (d.success) {
      updateSettingsData({ pathMapping: JSON.stringify(normalizedMappings) })
      showSettings.value = false
    }
    else alert('保存失败: ' + (d.error || '未知错误'))
  } catch (e: any) { alert('保存异常: ' + e.message) }
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
}

function detectMapping() {
  isDetecting.value = true
  helperResult.value = null
  setTimeout(() => {
    const cPath = normalizePath(helperContainerPath.value)
    const lPath = normalizePath(helperLocalPath.value)

    if (!cPath || !lPath) {
      helperResult.value = { status: 'error', message: '请填写两个路径' }
      isDetecting.value = false
      return
    }

    const cParts = cPath.split('/')
    const lParts = lPath.split('/')

    let commonSuffixLen = 0
    const minLen = Math.min(cParts.length, lParts.length)
    for (let i = 1; i <= minLen; i++) {
      const cs = cParts.slice(-i).join('/')
      const ls = lParts.slice(-i).join('/')
      if (cs === ls && cs.length > 0) commonSuffixLen = i
      else break
    }

    if (commonSuffixLen < 2) {
      helperResult.value = { status: 'error', message: '无法找到共同路径部分，请确认两个路径指向同一个文件。提示：文件名和目录结构应完全一致，只有根路径前缀不同。\n\n例如：\n容器: /Media115/电影/xxx/文件.strm\n本地: /vol2/media/电影/xxx/文件.strm\n\n共同后缀: /电影/xxx/文件.strm' }
      isDetecting.value = false
      return
    }

    const cPrefix = cParts.slice(0, cParts.length - commonSuffixLen).join('/') || '/'
    const lPrefix = lParts.slice(0, lParts.length - commonSuffixLen).join('/') || '/'

    helperResult.value = {
      status: 'success',
      message: `检测成功！从路径中提取到映射关系（共同后缀: ${cParts.slice(-commonSuffixLen).join('/')}）`,
      containerPrefix: cPrefix,
      localPrefix: lPrefix
    }
    isDetecting.value = false
  }, 300)
}

function applyDetectedMapping() {
  if (!helperResult.value || helperResult.value.status !== 'success') return
  pathMappings.value.push({ containerPath: helperResult.value.containerPrefix!, localPath: helperResult.value.localPrefix! })
  helperContainerPath.value = ''
  helperLocalPath.value = ''
  helperResult.value = null
}

const loadLibraries = async () => {
  try {
    const res = await fetch('/api/emby/libraries')
    if (res.ok) {
      const data = await res.json()
      if (data.success) {
        libraries.value = data.data || []
      }
    }
  } catch (e) {
    console.error('加载媒体库失败:', e)
  }
}

const startAnalysis = async () => {
  isAnalyzing.value = true
  analyzedEmpty.value = false
  report.value = {}
  currentMessage.value = '正在连接...'
  
  try {
    const payload = selectedLibrary.value 
      ? { library_id: selectedLibrary.value, stream: true } 
      : { stream: true }
    
    const res = await fetch('/api/emby/analyze_duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    if (!res.ok) {
      throw new Error('请求失败')
    }
    
    const reader = res.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应')
    }
    
    const decoder = new TextDecoder()
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            
            if (data.type === 'connected') {
              currentMessage.value = '已连接，开始扫描...'
            } else if (data.type === 'progress') {
              const info: ProgressInfo = data.data
              currentMessage.value = info.message
              
              if (info.item) {
                const libName = info.library || '未知媒体库'
                if (!report.value[libName]) {
                  report.value[libName] = []
                }
                report.value[libName].push(info.item)
              }
            } else if (data.type === 'complete') {
              currentMessage.value = ''
              if (data.data?.data) {
                report.value = data.data.data
                const hasAny = Object.values(data.data.data).some((items: any) => items && items.length > 0)
                analyzedEmpty.value = !hasAny
              } else {
                analyzedEmpty.value = true
              }
            }
          } catch (e) {
            console.error('解析数据失败:', e)
          }
        }
      }
    }
  } catch (e) {
    console.error('查重失败:', e)
    currentMessage.value = ''
  } finally {
    isAnalyzing.value = false
  }
}

const exportReport = () => {
  window.location.href = '/api/emby/export_duplicates_report'
}

onMounted(() => {
  loadLibraries()
  loadPathMappings()
})
</script>

<style scoped>
.duplicates-tab {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-box {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.section-box.dark {
  background: #1e293b;
  border-color: #334155;
}

.section-box-header {
  padding: 16px 18px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.section-box.dark .section-box-header {
  border-bottom-color: #334155;
}

.section-box-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.section-box.dark .section-box-title {
  color: #f8fafc;
}

.section-box-desc {
  font-size: 12px;
  color: #64748b;
}

.section-box-desc.dark {
  color: #94a3b8;
}

.section-box-content {
  padding: 18px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-section {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.filter-left {
  flex: 1;
  min-width: 220px;
}

.filter-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.form-group {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 6px;
}

.form-label.dark {
  color: #94a3b8;
}

.form-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  background: #ffffff;
  color: #1e293b;
  cursor: pointer;
  transition: all 0.2s;
}

.form-select.dark {
  background: #334155;
  border-color: #475569;
  color: #f1f5f9;
}

.form-select:focus {
  outline: none;
  border-color: #0072ff;
  box-shadow: 0 0 0 2px rgba(0, 114, 255, 0.1);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.btn-primary {
  background: linear-gradient(135deg, #0072ff, #00c6ff);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(0, 114, 255, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
}

.btn-sm {
  min-height: 36px;
  padding: 6px 12px;
  font-size: 12px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(96, 165, 250, 0.04));
  border-radius: 14px;
  border: 1px solid rgba(191, 219, 254, 0.6);
}

.section-box.dark .progress-container {
  background: linear-gradient(135deg, rgba(30, 64, 175, 0.14), rgba(59, 130, 246, 0.08));
  border-color: rgba(96, 165, 250, 0.18);
}

.progress-spinner svg {
  width: 24px;
  height: 24px;
  color: #0072ff;
}

.progress-message {
  flex: 1;
}

.progress-text {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
}

.progress-text.dark {
  color: #f1f5f9;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.stat-item {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.stat-item.dark {
  background: #0f172a;
  border-color: #334155;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon svg {
  width: 20px;
  height: 20px;
}

.stat-icon.red {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.stat-icon.blue {
  background: rgba(0, 114, 255, 0.1);
  color: #0072ff;
}

.stat-icon.purple {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.stat-icon.orange {
  background: rgba(234, 88, 12, 0.1);
  color: #ea580c;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
}

.stat-value.dark {
  color: #f8fafc;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
}

.stat-label.dark {
  color: #94a3b8;
}

.count-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 10px;
  background: rgba(220, 38, 38, 0.1);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  color: #dc2626;
  white-space: nowrap;
}

.count-tag.dark {
  background: rgba(220, 38, 38, 0.2);
  color: #f87171;
}

.duplicate-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 12px;
}

.duplicate-card {
  padding: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  transition: all 0.25s ease;
  animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.duplicate-card.dark {
  background: #0f172a;
  border-color: #334155;
}

.duplicate-card:hover {
  border-color: #0072ff;
  box-shadow: 0 4px 12px rgba(0, 114, 255, 0.1);
}

.duplicate-card.dark:hover {
  border-color: #60a5fa;
  box-shadow: 0 4px 12px rgba(96, 165, 250, 0.1);
}

.duplicate-card.movie {
  border-left: 3px solid #0072ff;
}

.duplicate-card.series {
  border-left: 3px solid #8b5cf6;
}

.duplicate-card.episode {
  border-left: 3px solid #ea580c;
}

.duplicate-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  gap: 8px;
}

.duplicate-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.kind-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.kind-badge svg {
  width: 12px;
  height: 12px;
}

.kind-badge.movie {
  background: rgba(0, 114, 255, 0.1);
  color: #0072ff;
}

.kind-badge.series {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.kind-badge.episode {
  background: rgba(234, 88, 12, 0.1);
  color: #ea580c;
}

.duplicate-title {
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
  margin: 0;
}

.duplicate-title.dark {
  color: #f8fafc;
}

.duplicate-year {
  color: #64748b;
  font-size: 13px;
}

.duplicate-year.dark {
  color: #94a3b8;
}

.duplicate-count {
  padding: 4px 10px;
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.duplicate-count.dark {
  background: rgba(220, 38, 38, 0.2);
  color: #f87171;
}

.duplicate-files {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.file-item.dark {
  background: #1e293b;
  border-color: #334155;
}

.file-item.quality-best {
  border: 2px solid #22c55e;
  box-shadow: 0 0 12px rgba(34, 197, 94, 0.35), 0 0 4px rgba(34, 197, 94, 0.2);
}

.file-item.quality-best.dark {
  background: rgba(34, 197, 94, 0.06);
  border-color: #22c55e;
  box-shadow: 0 0 14px rgba(34, 197, 94, 0.25), 0 0 4px rgba(34, 197, 94, 0.15);
}

.file-item.quality-good {
  border: 1.5px solid #3b82f6;
}

.file-item.quality-good.dark {
  border-color: #60a5fa;
}

.file-item.quality-poor {
  border: 2px solid #ef4444;
}

.file-item.quality-poor.dark {
  border-color: #f87171;
}

.file-content {
  flex: 1;
  min-width: 0;
}

.file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
  min-width: 0;
}

.file-name {
  font-weight: 500;
  color: #1e293b;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1 1 0;
  min-width: 0;
}

.file-name.dark {
  color: #f1f5f9;
}

.file-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.video-tag {
  padding: 2px 6px;
  background: rgba(0, 114, 255, 0.1);
  color: #0072ff;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.video-tag.dark {
  background: rgba(0, 114, 255, 0.2);
  color: #60a5fa;
}

.file-path {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: #64748b;
  font-size: 11px;
  margin-bottom: 6px;
}

.file-path.dark {
  color: #94a3b8;
}

.path-line {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.path-folder {
  color: #94a3b8;
}

.path-folder.dark {
  color: #64748b;
}

.path-file {
  color: #1e293b;
  font-weight: 500;
}

.path-file.dark {
  color: #e2e8f0;
}

.episode-key {
  padding: 2px 8px;
  background: rgba(234, 88, 12, 0.1);
  color: #ea580c;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.series-groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.series-group {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}

.series-group.dark {
  background: #0f172a;
  border-color: #334155;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
  border-bottom: 1px solid transparent;
}

.group-header:hover {
  background: rgba(0, 114, 255, 0.04);
}

.group-header.dark:hover {
  background: rgba(96, 165, 250, 0.06);
}

.group-toggle {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #e2e8f0;
  transition: transform 0.25s ease, background 0.15s;
}

.group-toggle.dark {
  background: #334155;
}

.group-toggle svg {
  width: 14px;
  height: 14px;
  color: #64748b;
  transition: transform 0.25s ease;
}

.group-toggle.expanded svg {
  transform: rotate(90deg);
}

.group-title {
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-title.dark {
  color: #f8fafc;
}

.group-count {
  padding: 2px 8px;
  background: rgba(220, 38, 38, 0.08);
  color: #dc2626;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  margin-left: auto;
  flex-shrink: 0;
}

.group-count.dark {
  background: rgba(220, 38, 38, 0.15);
  color: #f87171;
}

.group-body {
  border-top: 1px solid #e2e8f0;
  padding: 12px;
}

.group-body.dark {
  border-top-color: #334155;
}

.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.quality-level {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.quality-level.top {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: white;
}

.quality-level.high {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
}

.quality-level.medium {
  background: rgba(59, 130, 246, 0.15);
  color: #2563eb;
}

.quality-level.low {
  background: rgba(107, 114, 128, 0.15);
  color: #6b7280;
}

.quality-score {
  font-size: 11px;
  color: #64748b;
}

.quality-score.dark {
  color: #94a3b8;
}

.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  text-align: center;
}

.empty-container.empty-success {
  animation: fadeInUp 0.4s ease-out;
}

.empty-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border-radius: 14px;
  margin-bottom: 14px;
  transition: all 0.3s ease;
}

.empty-icon.dark {
  background: #334155;
}

.empty-icon.success {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(16, 185, 129, 0.08));
  border: 1px solid rgba(34, 197, 94, 0.2);
  animation: successPulse 2s ease-in-out infinite;
}

.empty-icon.success.dark {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(16, 185, 129, 0.08));
  border-color: rgba(34, 197, 94, 0.25);
}

@keyframes successPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
  50% { box-shadow: 0 0 20px 4px rgba(34, 197, 94, 0.12); }
}

.empty-icon svg {
  width: 26px;
  height: 26px;
  color: #94a3b8;
  transition: all 0.3s ease;
}

.empty-icon.success svg {
  color: #22c55e;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 6px 0;
  transition: color 0.3s ease;
}

.empty-title.dark {
  color: #f8fafc;
}

.empty-title.success {
  color: #16a34a;
}

.empty-title.success.dark {
  color: #4ade80;
}

.empty-desc {
  font-size: 13px;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

.empty-desc.dark {
  color: #94a3b8;
}

@media (max-width: 768px) {
  .filter-section {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-left {
    min-width: 100%;
  }

  .filter-right {
    width: 100%;
    justify-content: stretch;
    gap: 8px;
  }

  .filter-right .btn {
    flex: 1 1 0;
    width: auto;
  }

  .header-right {
    width: 100%;
    justify-content: flex-start;
  }

  .stats-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .duplicate-grid {
    grid-template-columns: 1fr;
    min-width: 0;
  }

  .duplicate-card {
    min-width: 0;
    overflow: hidden;
  }

  .group-body {
    padding: 8px;
  }

  .duplicate-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .group-header {
    flex-wrap: wrap;
    gap: 6px;
  }

  .group-count {
    margin-left: 0;
    order: -1;
    width: 100%;
    text-align: center;
  }

  .group-actions {
    width: 100%;
    margin-left: 0;
    justify-content: flex-start;
  }

  .file-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .file-tags {
    margin-top: 2px;
  }

  .file-item {
    break-inside: avoid;
  }
}

@media (max-width: 480px) {
  .section-box-header {
    padding: 12px 14px;
  }

  .section-box-content {
    padding: 10px 12px;
  }

  .section-box-title {
    font-size: 14px;
  }

  .filter-right {
    flex-direction: column;
  }

  .filter-right .btn {
    width: 100%;
  }

  .header-right {
    justify-content: space-between;
  }

  .selected-badge {
    width: 100%;
    text-align: center;
  }

  .duplicate-card {
    padding: 10px;
  }

  .duplicate-grid {
    gap: 8px;
  }

  .duplicate-title {
    font-size: 13px;
  }

  .group-header {
    padding: 10px 12px;
  }

  .group-body {
    padding: 6px;
  }

  .group-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .group-action-btn {
    width: 100%;
    justify-content: center;
  }

  .file-item {
    padding: 8px;
  }

  .stat-item {
    padding: 12px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
  }

  .stat-icon svg {
    width: 18px;
    height: 18px;
  }

  .stat-value {
    font-size: 18px;
  }

  .stats-row {
    grid-template-columns: 1fr;
  }

  .modal-overlay {
    padding: 12px;
  }

  .modal-box {
    max-height: calc(100vh - 24px);
    border-radius: 20px;
  }

  .modal-head,
  .modal-foot,
  .modal-body-settings {
    padding-left: 14px;
    padding-right: 14px;
  }

  .modal-body-settings {
    padding-top: 14px;
    padding-bottom: 14px;
  }

  .mapping-row {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .mapping-fields {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .map-input,
  .helper-input {
    font-size: 16px;
  }

  .map-arrow {
    width: 100%;
    height: 24px;
    transform: rotate(90deg);
  }

  .map-remove {
    width: 100%;
    height: 38px;
    border-radius: 12px;
  }

  .helper-toggle {
    align-items: flex-start;
  }

  .helper-toggle-icon {
    margin-top: 2px;
  }

  .detect-btn {
    width: 100%;
  }

  .detected-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .detected-arrow {
    padding-left: 0;
    align-self: center;
    transform: rotate(90deg);
  }
}

.selected-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 12px;
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}
.selected-badge.dark {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.btn-outline {
  background: transparent;
  color: #475569;
  border: 1px solid #d1d5db;
}
.btn-outline:hover:not(:disabled) { background: #f8fafc; border-color: #94a3b8; }
.btn-outline.dark { color: #94a3b8; border-color: #475569; }
.btn-outline.dark:hover:not(:disabled) { background: #1e293b; border-color: #60a5fa; }

.btn-danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
}
.btn-danger:hover:not(:disabled) { box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4); }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

.file-item {
  display: flex;
  align-items: stretch;
  gap: 0;
  padding: 0;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s ease;
  position: relative;
}
.file-item.will-delete {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.06), rgba(220, 38, 38, 0.03));
  box-shadow: inset 0 0 0 1.5px rgba(239, 68, 68, 0.25);
}
.file-item.will-delete.dark {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.05));
  box-shadow: inset 0 0 0 1.5px rgba(239, 68, 68, 0.35);
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s;
  flex-wrap: wrap;
}
.group-header:hover { background: #f8fafc; }
.group-header.dark:hover { background: #1e293b; }

.group-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.group-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}
.group-action-btn svg { width: 14px; height: 14px; }
.group-action-btn:hover { border-color: #94a3b8; background: #f8fafc; }
.group-action-btn.dark { border-color: #334155; background: #1e293b; color: #94a3b8; }
.group-action-btn.dark:hover { border-color: #475569; background: #334155; }

.toggle-group-btn.active {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
}
.toggle-group-btn.active.dark {
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.1);
}
.toggle-group-btn.inverted-flash {
  animation: invertFlash 0.4s ease-out;
}
@keyframes invertFlash {
  0% { transform: scale(1); }
  25% { transform: scale(1.08); box-shadow: 0 0 16px rgba(220, 38, 38, 0.4); }
  100% { transform: scale(1); }
}

.delete-group-btn {
  color: #ef4444;
  border-color: #fecaca;
}
.delete-group-btn:hover:not(:disabled) {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #dc2626;
}
.delete-group-btn.dark {
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.25);
}
.delete-group-btn.dark:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.4);
}
.delete-group-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.file-content {
  flex: 1;
  min-width: 0;
  padding: 10px;
}

.modal-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  animation: modalIn 0.2s ease-out;
}
.modal-overlay.dark { background: rgba(0, 0, 0, 0.7); }
@keyframes modalIn { from { opacity: 0; } to { opacity: 1; } }

.modal-box {
  width: 100%; max-width: 640px;
  max-height: 85vh;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 24px;
  box-shadow:
    0 28px 60px rgba(15, 23, 42, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px);
  overflow: hidden;
  display: flex; flex-direction: column;
  animation: modalUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-box.dark {
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(71, 85, 105, 0.48);
  box-shadow:
    0 28px 60px rgba(2, 6, 23, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
@keyframes modalUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.78);
}
.modal-box.dark .modal-head { border-bottom-color: rgba(51, 65, 85, 0.88); }
.modal-title { font-size: 17px; font-weight: 700; color: #0f172a; margin: 0; letter-spacing: -0.01em; }
.modal-title.dark { color: #f8fafc; }
.modal-close-btn {
  width: 34px; height: 34px;
  border: 1px solid rgba(226, 232, 240, 0.82); border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; background: rgba(248, 250, 252, 0.9); color: #64748b;
  transition: all 0.2s; padding: 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}
.modal-close-btn.dark { background: rgba(30, 41, 59, 0.86); border-color: rgba(71, 85, 105, 0.52); color: #94a3b8; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04); }
.modal-close-btn:hover { background: rgba(255, 255, 255, 0.98); color: #0f172a; transform: translateY(-1px); }
.modal-close-btn.dark:hover { background: rgba(51, 65, 85, 0.94); color: #f8fafc; }
.modal-close-btn svg { width: 16px; height: 16px; }

.modal-body-settings { padding: 22px; overflow-y: auto; flex: 1; }
.setting-block { display: flex; flex-direction: column; gap: 14px; }
.setting-label { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0; }
.setting-label.dark { color: #f8fafc; }
.setting-desc { font-size: 13px; color: #64748b; margin: 0; line-height: 1.6; }
.setting-desc.dark { color: #94a3b8; }

.mapping-row {
  display: flex; align-items: center; gap: 12px;
  padding: 14px;
  background: rgba(248, 250, 252, 0.9);
  border: 1px solid rgba(226, 232, 240, 0.78);
  border-radius: 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}
.mapping-row.dark { background: rgba(15, 23, 42, 0.76); border-color: rgba(51, 65, 85, 0.86); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04); }
.mapping-fields {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.map-input {
  flex: 1;
  min-width: 0;
  padding: 10px 13px;
  border: 1px solid rgba(203, 213, 225, 0.92);
  border-radius: 12px;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.94);
  color: #1e293b;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.map-input:focus { border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.14); }
.map-input.dark { background: rgba(51, 65, 85, 0.92); border-color: rgba(71, 85, 105, 0.9); color: #f1f5f9; }
.map-input::placeholder { color: #94a3b8; }

.map-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 16px;
  font-weight: 700;
  color: #94a3b8;
  flex-shrink: 0;
}

.map-remove {
  width: 34px; height: 34px;
  border: none; border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; background: rgba(254, 242, 242, 0.96); color: #ef4444;
  transition: all 0.2s; padding: 0; flex-shrink: 0;
}
.map-remove.dark { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.map-remove:hover { background: #fee2e2; transform: translateY(-1px); }
.map-remove.dark:hover { background: rgba(239, 68, 68, 0.25); }
.map-remove svg { width: 14px; height: 14px; }

.add-map-btn {
  align-self: flex-start;
  padding: 9px 16px;
  border: 1px dashed rgba(148, 163, 184, 0.7);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.56);
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.add-map-btn:hover { border-color: rgba(96, 165, 250, 0.68); color: #2563eb; background: rgba(239, 246, 255, 0.82); }
.add-map-btn.dark { border-color: rgba(71, 85, 105, 0.88); background: rgba(30, 41, 59, 0.52); color: #94a3b8; }
.add-map-btn.dark:hover { border-color: rgba(96, 165, 250, 0.72); color: #bfdbfe; background: rgba(30, 41, 59, 0.84); }

.helper-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(226, 232, 240, 0.92) 20%, rgba(226, 232, 240, 0.92) 80%, transparent);
  margin: 6px 0 18px;
}
.helper-divider.dark { background: linear-gradient(90deg, transparent, rgba(51, 65, 85, 0.96) 20%, rgba(51, 65, 85, 0.96) 80%, transparent); }

.helper-block {
  padding: 14px;
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.72);
  border: 1px solid rgba(226, 232, 240, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}
.helper-block.dark {
  background: rgba(15, 23, 42, 0.6);
  border-color: rgba(51, 65, 85, 0.84);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
.helper-block.expanded {
  background: rgba(239, 246, 255, 0.64);
  border-color: rgba(191, 219, 254, 0.9);
}
.helper-block.dark.expanded {
  background: rgba(15, 23, 42, 0.82);
  border-color: rgba(59, 130, 246, 0.28);
}
.helper-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
}
.helper-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.helper-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}
.helper-badge.dark { background: rgba(59, 130, 246, 0.18); color: #93c5fd; }
.helper-toggle-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(226, 232, 240, 0.82);
  color: #64748b;
  flex-shrink: 0;
  transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease;
}
.helper-toggle-icon.expanded { transform: rotate(180deg); }
.helper-toggle-icon svg { width: 15px; height: 15px; }
.helper-toggle.dark .helper-toggle-icon {
  background: rgba(30, 41, 59, 0.86);
  border-color: rgba(71, 85, 105, 0.52);
  color: #94a3b8;
}
.helper-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(226, 232, 240, 0.78);
}
.helper-block.dark .helper-panel { border-top-color: rgba(51, 65, 85, 0.84); }

.helper-inputs { display: flex; flex-direction: column; gap: 10px; }
.helper-field { display: flex; flex-direction: column; gap: 6px; }
.helper-label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}
.helper-label.dark { color: #94a3b8; }
.helper-input { width: 100%; font-size: 13px; }

.detect-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 2px;
  padding: 10px 18px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.2);
}
.detect-btn svg { width: 15px; height: 15px; flex-shrink: 0; }
.detect-btn:hover:not(:disabled) { box-shadow: 0 12px 26px rgba(37, 99, 235, 0.28); transform: translateY(-1px); }
.detect-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.detect-btn.dark { background: linear-gradient(135deg, #2563eb, #1d4ed8); }

.helper-result {
  margin-top: 2px;
  padding: 13px 14px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: resultIn 0.3s ease-out;
}
@keyframes resultIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.helper-result.success { background: #f0fdf4; border: 1px solid #bbf7d0; }
.helper-result.success.dark { background: rgba(22, 101, 52, 0.12); border-color: rgba(74, 222, 128, 0.25); }
.helper-result.error { background: #fef2f2; border: 1px solid #fecaca; }
.helper-result.error.dark { background: rgba(127, 29, 29, 0.12); border-color: rgba(248, 113, 113, 0.25); }

.result-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.result-icon { font-size: 16px; line-height: 1; flex-shrink: 0; }
.result-msg {
  font-size: 13px;
  color: #374151;
  line-height: 1.45;
}
.result-msg.dark { color: #d1d5db; }

.detected-mapping {
  padding: 0;
  background: transparent;
  border-radius: 6px;
}

.detected-pair {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detected-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 10px;
  border: 1px solid #e5e7eb;
}
.detected-item.dark { background: rgba(30, 41, 59, 0.5); border-color: #334155; }

.detected-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 22px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  padding: 0 8px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  white-space: nowrap;
  flex-shrink: 0;
}
.detected-tag.container { background: #dbeafe; color: #1d4ed8; }
.detected-tag.local { background: #fef3c7; color: #b45309; }

.detected-value {
  font-size: 12px;
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  padding: 2px 6px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #1f2937;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: default;
}
.detected-value.dark { color: #e2e8f0; }

.detected-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  color: #94a3b8;
  padding-left: 18px;
}

.apply-detected-btn {
  margin-top: 10px;
  width: 100%;
  padding: 9px 14px;
  border: 1px dashed #22c55e;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.58);
  color: #16a34a;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.apply-detected-btn:hover { background: #f0fdf4; border-color: #16a34a; }
.apply-detected-btn.dark { border-color: #4ade80; color: #4ade80; background: rgba(15, 23, 42, 0.46); }
.apply-detected-btn.dark:hover { background: rgba(34, 197, 94, 0.08); }

.modal-foot {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 16px 22px;
  border-top: 1px solid rgba(226, 232, 240, 0.78);
}
.modal-box.dark .modal-foot { border-top-color: rgba(51, 65, 85, 0.88); }
</style>
