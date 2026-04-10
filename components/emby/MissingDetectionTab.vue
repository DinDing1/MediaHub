<template>
  <div class="missing-detection">
    <div class="section-box" :class="{ dark: isDark }">
      <div class="section-box-header">
        <h2 class="section-box-title">缺失剧集检测</h2>
        <span class="section-box-desc" :class="{ dark: isDark }">对比 Emby 媒体库与 TMDB 数据</span>
      </div>
      <div class="section-box-content">
        <div class="filter-section">
          <div class="filter-left">
            <div class="form-group">
              <label class="form-label" :class="{ dark: isDark }">选择媒体库</label>
              <select v-model="selectedLibrary" class="form-select" :class="{ dark: isDark }">
                <option value="">全部剧集库</option>
                <option v-for="lib in tvLibraries" :key="lib.id" :value="lib.id">
                  {{ lib.name }} · {{ lib.typeLabel }}
                </option>
              </select>
            </div>
          </div>
          <div class="filter-right">
            <button 
              class="btn btn-primary"
              :disabled="isAnalyzing"
              @click="startAnalysis"
            >
              <svg v-if="isAnalyzing" class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span>{{ isAnalyzing ? '检测中...' : '开始检测' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isAnalyzing || hasReport" class="section-box" :class="{ dark: isDark }">
      <div class="section-box-header">
        <h2 class="section-box-title">
          {{ isAnalyzing ? '检测进度' : '检测结果' }}
        </h2>
        <div class="header-right">
          <span v-if="isAnalyzing" class="progress-tag">
            {{ currentIndex }}/{{ totalShows }}
          </span>
          <button v-if="!isAnalyzing && hasReport" class="btn btn-secondary btn-sm" @click="exportReport">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>导出报告</span>
          </button>
        </div>
      </div>
      <div class="section-box-content">
        <div v-if="isAnalyzing" class="progress-section" :class="{ dark: isDark }">
          <div class="progress-header">
            <span class="current-show" :class="{ dark: isDark }">{{ currentShow || '准备中...' }}</span>
          </div>
          <div class="progress-bar-wrapper">
            <div class="progress-bar-track" :class="{ dark: isDark }">
              <div 
                class="progress-bar-fill"
                :style="{ width: `${progressPercent}%` }"
              ></div>
            </div>
            <span class="progress-percent" :class="{ dark: isDark }">{{ progressPercent }}%</span>
          </div>
        </div>

        <div class="stats-row">
          <div class="stat-item" :class="{ dark: isDark }">
            <div class="stat-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                <polyline points="17 2 12 7 7 2"/>
              </svg>
            </div>
            <div class="stat-content">
              <span class="stat-value" :class="{ dark: isDark }">{{ totalShowsInReport }}</span>
              <span class="stat-label" :class="{ dark: isDark }">剧集总数</span>
            </div>
          </div>
          <div class="stat-item" :class="{ dark: isDark }">
            <div class="stat-icon orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div class="stat-content">
              <span class="stat-value" :class="{ dark: isDark }">{{ incompleteShows }}</span>
              <span class="stat-label" :class="{ dark: isDark }">剧集不完整</span>
            </div>
          </div>
          <div class="stat-item" :class="{ dark: isDark }">
            <div class="stat-icon red">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
            <div class="stat-content">
              <span class="stat-value" :class="{ dark: isDark }">{{ totalMissingEpisodes }}</span>
              <span class="stat-label" :class="{ dark: isDark }">缺失集数</span>
            </div>
          </div>
          <div class="stat-item" :class="{ dark: isDark }">
            <div class="stat-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <div class="stat-content">
              <span class="stat-value" :class="{ dark: isDark }">{{ correctedShowsCount }}</span>
              <span class="stat-label" :class="{ dark: isDark }">已纠错</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template v-if="hasReport">
      <div 
        v-for="(shows, libName) in incompleteOnlyReport" 
        :key="libName"
        class="section-box" 
        :class="{ dark: isDark }"
      >
        <div class="section-box-header">
          <h2 class="section-box-title">{{ libName }}</h2>
          <span class="count-tag" :class="{ dark: isDark }">{{ shows.length }} 部不完整</span>
        </div>
        <div class="section-box-content">
          <div class="show-grid">
            <TransitionGroup name="show-item">
              <div 
                v-for="show in shows" 
                :key="show.tmdb_id"
                class="show-card"
                :class="{ 
                  dark: isDark, 
                  new: show._new,
                  corrected: show.has_correction 
                }"
              >
                <div class="show-header">
                  <div class="show-title-row">
                    <h4 class="show-name" :class="{ dark: isDark }">{{ show.name }}</h4>
                    <span v-if="show.has_correction" class="correction-badge" title="已纠错">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </span>
                  </div>
                  <span class="episode-badge" :class="{ dark: isDark, corrected: show.has_correction }">
                    {{ show.existing_episode_count }}/{{ show.has_correction ? show.corrected_total_episodes : show.total_episodes }}
                  </span>
                </div>
                
                <div class="show-progress">
                  <div class="progress-track" :class="{ dark: isDark }">
                    <div 
                      class="progress-bar"
                      :class="{ corrected: show.has_correction }"
                      :style="{ width: `${getProgress(show)}%` }"
                    ></div>
                  </div>
                  <span class="progress-text" :class="{ dark: isDark }">{{ getProgress(show) }}%</span>
                </div>
                
                <div class="missing-info" :class="{ corrected: show.has_correction }">
                  <div class="missing-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span v-if="show.has_correction && show.missing_episodes?.length === 0">已完整（纠错后）</span>
                    <span v-else>缺失 {{ show.missing_episodes?.length || 0 }} 集</span>
                  </div>
                  <div v-if="show.missing_episodes?.length > 0" class="missing-episodes" :class="{ dark: isDark }">
                    {{ formatMissingEpisodes(show.missing_episodes) }}
                  </div>
                  <div v-if="show.has_correction && show.original_missing_episodes && show.original_missing_episodes.length > 0" class="original-missing-note" :class="{ dark: isDark }">
                    原始缺失 {{ show.original_missing_episodes.length }} 集（TMDB: {{ show.original_total_episodes }} 集）
                  </div>
                </div>
                
                <div class="show-actions">
                  <button 
                    v-if="!show.has_correction"
                    class="btn btn-correction"
                    @click="openCorrectionDialog(show)"
                    title="TMDB 数据有误？点击纠错"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    <span>纠错</span>
                  </button>
                  <button 
                    v-else
                    class="btn btn-remove-correction"
                    @click="removeCorrection(show)"
                    title="取消纠错"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 6h18"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    <span>取消纠错</span>
                  </button>
                </div>
              </div>
            </TransitionGroup>
          </div>
        </div>
      </div>
      
      <div v-if="completeShowsCount > 0" class="complete-summary" :class="{ dark: isDark }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <span>{{ completeShowsCount }} 部剧集完整，已隐藏</span>
      </div>
    </template>

    <div v-if="!isAnalyzing && !hasReport" class="section-box" :class="{ dark: isDark }">
      <div class="section-box-content">
        <div class="empty-container">
          <div class="empty-icon" :class="{ dark: isDark }">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <h3 class="empty-title" :class="{ dark: isDark }">开始检测缺失剧集</h3>
          <p class="empty-desc" :class="{ dark: isDark }">选择媒体库后点击"开始检测"按钮进行分析</p>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showCorrectionDialog" class="modal-overlay" @click.self="closeCorrectionDialog">
        <div class="modal-content" :class="{ dark: isDark }">
          <div class="modal-header">
            <h3 class="modal-title" :class="{ dark: isDark }">TMDB 剧集纠错</h3>
            <button class="modal-close" @click="closeCorrectionDialog">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label" :class="{ dark: isDark }">剧集名称</label>
              <input 
                type="text" 
                class="form-input" 
                :class="{ dark: isDark }"
                :value="correctionShow?.name"
                disabled
              />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" :class="{ dark: isDark }">TMDB 总集数</label>
                <input 
                  type="number" 
                  class="form-input" 
                  :class="{ dark: isDark }"
                  :value="correctionShow?.total_episodes"
                  disabled
                />
              </div>
              <div class="form-group">
                <label class="form-label" :class="{ dark: isDark }">实际总集数</label>
                <input 
                  type="number" 
                  class="form-input" 
                  :class="{ dark: isDark }"
                  v-model.number="correctionEpisodes"
                  min="0"
                />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" :class="{ dark: isDark }">备注（可选）</label>
              <textarea 
                class="form-textarea" 
                :class="{ dark: isDark }"
                v-model="correctionNote"
                placeholder="例如：TMDB 数据有误，实际只有 12 集"
                rows="2"
              ></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="closeCorrectionDialog">取消</button>
            <button class="btn btn-primary" @click="saveCorrection" :disabled="correctionEpisodes < 0">
              保存纠错
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { formatShanghaiDateKey } from '~/utils/time'

interface Props {
  isDark: boolean
}

const props = defineProps<Props>()

interface MissingEpisode {
  season: number
  episode: number
}

interface ShowReport {
  name: string
  tmdb_id: string
  total_episodes: number
  existing_episode_count: number
  missing_episodes: MissingEpisode[]
  has_correction?: boolean
  corrected_total_episodes?: number
  original_missing_episodes?: MissingEpisode[]
  original_total_episodes?: number
  _new?: boolean
}

const libraries = ref<any[]>([])
const selectedLibrary = ref('')
const isAnalyzing = ref(false)
const report = ref<Record<string, ShowReport[]>>({})
const currentShow = ref('')
const currentIndex = ref(0)
const totalShows = ref(0)

const showCorrectionDialog = ref(false)
const correctionShow = ref<ShowReport | null>(null)
const correctionEpisodes = ref(0)
const correctionNote = ref('')

let eventSource: EventSource | null = null

const tvLibraries = computed(() => {
  return libraries.value.filter(lib => lib.type === 'tvshows')
})

const hasReport = computed(() => {
  return Object.keys(report.value).length > 0
})

const progressPercent = computed(() => {
  if (totalShows.value === 0) return 0
  return Math.round((currentIndex.value / totalShows.value) * 100)
})

const totalShowsInReport = computed(() => {
  return Object.values(report.value).reduce((sum, shows) => sum + shows.length, 0)
})

const incompleteShows = computed(() => {
  return Object.values(report.value).reduce((sum, shows) => {
    return sum + shows.filter(s => s.missing_episodes?.length > 0).length
  }, 0)
})

const totalMissingEpisodes = computed(() => {
  return Object.values(report.value).reduce((sum, shows) => {
    return sum + shows.reduce((s, show) => s + (show.missing_episodes?.length || 0), 0)
  }, 0)
})

const completeShowsCount = computed(() => {
  return Object.values(report.value).reduce((sum, shows) => {
    return sum + shows.filter(s => !s.missing_episodes?.length).length
  }, 0)
})

const correctedShowsCount = computed(() => {
  return Object.values(report.value).reduce((sum, shows) => {
    return sum + shows.filter(s => s.has_correction).length
  }, 0)
})

const incompleteOnlyReport = computed(() => {
  const result: Record<string, ShowReport[]> = {}
  for (const [libName, shows] of Object.entries(report.value)) {
    const incomplete = shows.filter(s => {
      if (s.has_correction) {
        return true
      }
      return s.missing_episodes?.length > 0
    })
    if (incomplete.length > 0) {
      result[libName] = incomplete.sort((a, b) => {
        if (a.has_correction !== b.has_correction) {
          return a.has_correction ? 1 : -1
        }
        return 0
      })
    }
  }
  return result
})

const getProgress = (show: ShowReport) => {
  const total = show.has_correction && show.corrected_total_episodes 
    ? show.corrected_total_episodes 
    : show.total_episodes
  if (!total) return 0
  return Math.round((show.existing_episode_count / total) * 100)
}

const formatMissingEpisodes = (missing: MissingEpisode[] | undefined) => {
  if (!missing || missing.length === 0) return ''
  
  const sorted = [...missing].sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season
    return a.episode - b.episode
  })
  
  const groups: string[] = []
  let current: MissingEpisode[] = []
  
  const flush = () => {
    if (current.length === 0) return
    const first = current[0]
    const last = current[current.length - 1]
    if (!first || !last) return
    if (current.length === 1) {
      groups.push(`S${first.season}E${first.episode}`)
    } else {
      groups.push(`S${first.season}E${first.episode}-E${last.episode}`)
    }
    current = []
  }
  
  for (const item of sorted) {
    if (current.length === 0) {
      current.push(item)
    } else {
      const last = current[current.length - 1]
      if (last && item.season === last.season && item.episode === last.episode + 1) {
        current.push(item)
      } else {
        flush()
        current.push(item)
      }
    }
  }
  flush()
  
  return groups.join(', ')
}

const loadLibraries = async () => {
  try {
    const res = await fetch('/api/emby/missing?action=libraries')
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
  if (isAnalyzing.value) return
  
  isAnalyzing.value = true
  currentShow.value = '正在连接...'
  currentIndex.value = 0
  totalShows.value = 0
  report.value = {}
  
  const libraryId = selectedLibrary.value || 'all'
  const url = `/api/emby/missing?action=analyze&library_id=${libraryId}&stream=true`
  
  console.log('[缺失检测] 开始连接:', url)
  
  eventSource = new EventSource(url)
  
  eventSource.onopen = () => {
    console.log('[缺失检测] 连接已建立')
    currentShow.value = '已连接，等待数据...'
  }
  
  eventSource.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      console.log('[缺失检测] 收到消息:', msg.type)
      
      if (msg.type === 'connected') {
        currentShow.value = '已连接，开始分析...'
        return
      }
      
      if (msg.type === 'progress') {
        const data = msg.data
        currentShow.value = data.current_show || data.message
        currentIndex.value = data.current_index || 0
        totalShows.value = data.total_shows || 0
        
        if (data.result && data.library) {
          const libName = data.library as string
          if (!report.value[libName]) {
            report.value[libName] = []
          }
          const newResult: ShowReport = { ...data.result, _new: true }
          report.value[libName].push(newResult)
          
          setTimeout(() => {
            const libShows = report.value[libName]
            if (libShows && libShows.length > 0) {
              const idx = libShows.findIndex(
                (s) => s.tmdb_id === data.result.tmdb_id
              )
              if (idx >= 0 && libShows[idx]) {
                libShows[idx]._new = false
              }
            }
          }, 600)
        }
      } else if (msg.type === 'complete') {
        console.log('[缺失检测] 分析完成')
        isAnalyzing.value = false
        currentShow.value = '分析完成'
        if (eventSource) {
          eventSource.close()
          eventSource = null
        }
      }
    } catch (e) {
      console.error('[缺失检测] 解析消息失败:', e)
    }
  }
  
  eventSource.onerror = () => {
    console.error('[缺失检测] EventSource 错误')
    isAnalyzing.value = false
    currentShow.value = '连接失败，请重试'
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
  }
}

const exportReport = () => {
  const exportData: Record<string, any[]> = {}
  for (const [libName, shows] of Object.entries(report.value)) {
    const incomplete = shows.filter(s => s.missing_episodes && s.missing_episodes.length > 0)
    if (incomplete.length > 0) {
      exportData[libName] = incomplete.map(s => ({
        name: s.name,
        tmdb_id: s.tmdb_id,
        total_episodes: s.total_episodes,
        existing_episode_count: s.existing_episode_count,
        missing_episodes: s.missing_episodes,
        has_correction: s.has_correction,
        corrected_total_episodes: s.corrected_total_episodes
      }))
    }
  }
  
  const reportText = JSON.stringify(exportData, null, 2)
  const blob = new Blob([reportText], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const shanghaiDate = formatShanghaiDateKey()
  a.download = `缺失剧集报告_${shanghaiDate}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const openCorrectionDialog = (show: ShowReport) => {
  correctionShow.value = show
  correctionEpisodes.value = show.total_episodes
  correctionNote.value = ''
  showCorrectionDialog.value = true
}

const closeCorrectionDialog = () => {
  showCorrectionDialog.value = false
  correctionShow.value = null
  correctionEpisodes.value = 0
  correctionNote.value = ''
}

const saveCorrection = async () => {
  if (!correctionShow.value) return
  
  try {
    const res = await fetch('/api/emby/correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tmdb_id: correctionShow.value.tmdb_id,
        show_name: correctionShow.value.name,
        correct_total_episodes: correctionEpisodes.value,
        note: correctionNote.value || undefined
      })
    })
    
    const data = await res.json()
    if (data.success) {
      if (correctionShow.value) {
        if (!correctionShow.value.original_missing_episodes) {
          correctionShow.value.original_missing_episodes = [...correctionShow.value.missing_episodes]
          correctionShow.value.original_total_episodes = correctionShow.value.total_episodes
        }
        
        correctionShow.value.has_correction = true
        correctionShow.value.corrected_total_episodes = correctionEpisodes.value
        
        const actualMissing = Math.max(0, correctionEpisodes.value - correctionShow.value.existing_episode_count)
        if (correctionShow.value.missing_episodes && correctionShow.value.missing_episodes.length > actualMissing) {
          correctionShow.value.missing_episodes = correctionShow.value.missing_episodes.slice(0, actualMissing)
        }
      }
      closeCorrectionDialog()
    }
  } catch (e) {
    console.error('保存纠错失败:', e)
  }
}

const removeCorrection = async (show: ShowReport) => {
  try {
    const res = await fetch(`/api/emby/correction?tmdb_id=${show.tmdb_id}`, {
      method: 'DELETE'
    })
    
    const data = await res.json()
    if (data.success) {
      show.has_correction = false
      show.corrected_total_episodes = undefined
      
      if (show.original_missing_episodes) {
        show.missing_episodes = [...show.original_missing_episodes]
      }
      if (show.original_total_episodes) {
        show.total_episodes = show.original_total_episodes
      }
    }
  } catch (e) {
    console.error('移除纠错失败:', e)
  }
}

onMounted(() => {
  loadLibraries()
})

onUnmounted(() => {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
})
</script>

<style scoped>
.missing-detection {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-box {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 24px;
  overflow: hidden;
  box-shadow:
    0 24px 56px rgba(15, 23, 42, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px);
}

.section-box.dark {
  background: rgba(15, 23, 42, 0.88);
  border-color: rgba(71, 85, 105, 0.42);
  box-shadow:
    0 24px 56px rgba(2, 6, 23, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.section-box-header {
  padding: 18px 20px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.82);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.section-box.dark .section-box-header {
  border-bottom-color: rgba(51, 65, 85, 0.88);
}

.section-box-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  letter-spacing: -0.02em;
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
  padding: 20px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.progress-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 10px;
  background: linear-gradient(135deg, #0072ff, #00c6ff);
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.progress-section {
  margin-bottom: 18px;
  padding: 14px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(96, 165, 250, 0.04));
  border: 1px solid rgba(191, 219, 254, 0.62);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.progress-section.dark {
  background: linear-gradient(135deg, rgba(30, 64, 175, 0.16), rgba(59, 130, 246, 0.08));
  border-color: rgba(96, 165, 250, 0.22);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.progress-header {
  margin-bottom: 8px;
}

.current-show {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
}

.current-show.dark {
  color: #f8fafc;
}

.progress-bar-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar-track {
  flex: 1;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-track.dark {
  background: #334155;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #0072ff, #00c6ff);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-percent {
  font-size: 13px;
  font-weight: 600;
  color: #0072ff;
  min-width: 40px;
  text-align: right;
}

.progress-percent.dark {
  color: #60a5fa;
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
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
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
  min-height: 40px;
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 650;
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
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 38%, #2563eb 100%);
  color: white;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.btn-primary:hover:not(:disabled) {
  box-shadow: 0 16px 28px rgba(37, 99, 235, 0.24);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: rgba(248, 250, 252, 0.9);
  color: #475569;
  border-color: rgba(226, 232, 240, 0.9);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.74);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(241, 245, 249, 0.98);
  border-color: #cbd5e1;
  transform: translateY(-1px);
}

.btn-sm {
  min-height: 36px;
  padding: 6px 12px;
  font-size: 12px;
}

.btn-correction {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
  border-color: rgba(139, 92, 246, 0.24);
  padding: 6px 12px;
  font-size: 12px;
}

.btn-correction:hover {
  background: rgba(139, 92, 246, 0.18);
  transform: translateY(-1px);
}

.btn-remove-correction {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.22);
  padding: 6px 12px;
  font-size: 12px;
}

.btn-remove-correction:hover {
  background: rgba(239, 68, 68, 0.16);
  transform: translateY(-1px);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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
  background: rgba(248, 250, 252, 0.84);
  border: 1px solid rgba(226, 232, 240, 0.78);
  border-radius: 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.stat-item.dark {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(51, 65, 85, 0.86);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
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

.stat-icon.blue {
  background: rgba(0, 114, 255, 0.1);
  color: #0072ff;
}

.stat-icon.orange {
  background: rgba(234, 88, 12, 0.1);
  color: #ea580c;
}

.stat-icon.red {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.stat-icon.purple {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
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
  background: rgba(234, 88, 12, 0.1);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  color: #ea580c;
  white-space: nowrap;
}

.count-tag.dark {
  background: rgba(234, 88, 12, 0.2);
  color: #fb923c;
}

.show-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

.show-card {
  padding: 14px;
  background: rgba(248, 250, 252, 0.86);
  border: 1px solid rgba(226, 232, 240, 0.82);
  border-radius: 18px;
  transition: all 0.25s ease;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.show-card.dark {
  background: rgba(15, 23, 42, 0.74);
  border-color: rgba(51, 65, 85, 0.86);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.show-card:hover {
  border-color: rgba(96, 165, 250, 0.7);
  box-shadow: 0 16px 30px rgba(37, 99, 235, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.show-card.dark:hover {
  border-color: #60a5fa;
  box-shadow: 0 16px 30px rgba(96, 165, 250, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.show-card.corrected {
  border-color: rgba(139, 92, 246, 0.4);
  background: rgba(139, 92, 246, 0.04);
}

.show-card.corrected.dark {
  border-color: rgba(167, 139, 250, 0.5);
  background: rgba(139, 92, 246, 0.1);
}

.show-card.new {
  animation: card-highlight 0.6s ease;
}

@keyframes card-highlight {
  0% {
    background: rgba(0, 114, 255, 0.15);
    transform: scale(1.02);
    box-shadow: 0 8px 24px rgba(0, 114, 255, 0.2);
  }
  100% {
    background: #f8fafc;
    transform: scale(1);
    box-shadow: none;
  }
}

.show-card.new.dark {
  animation: card-highlight-dark 0.6s ease;
}

@keyframes card-highlight-dark {
  0% {
    background: rgba(0, 114, 255, 0.25);
    transform: scale(1.02);
    box-shadow: 0 8px 24px rgba(96, 165, 250, 0.2);
  }
  100% {
    background: #0f172a;
    transform: scale(1);
    box-shadow: none;
  }
}

.show-item-enter-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.show-item-enter-from {
  opacity: 0;
  transform: translateY(-12px) scale(0.95);
}

.show-item-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.show-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.show-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.show-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  line-height: 1.4;
  word-break: break-word;
}

.show-name.dark {
  color: #f8fafc;
}

.correction-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: rgba(139, 92, 246, 0.15);
  border-radius: 4px;
  color: #8b5cf6;
  flex-shrink: 0;
}

.correction-badge svg {
  width: 12px;
  height: 12px;
}

.episode-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 22px;
  padding: 0 8px;
  background: rgba(234, 88, 12, 0.1);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  color: #ea580c;
  white-space: nowrap;
  flex-shrink: 0;
}

.episode-badge.dark {
  background: rgba(234, 88, 12, 0.2);
  color: #fb923c;
}

.episode-badge.corrected {
  background: rgba(139, 92, 246, 0.15);
  color: #8b5cf6;
}

.show-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.show-progress .progress-track {
  flex: 1;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.show-progress .progress-track.dark {
  background: #334155;
}

.show-progress .progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.show-progress .progress-bar.corrected {
  background: linear-gradient(90deg, #8b5cf6, #a78bfa);
}

.progress-text {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  min-width: 32px;
  text-align: right;
}

.progress-text.dark {
  color: #94a3b8;
}

.missing-info {
  background: rgba(234, 88, 12, 0.06);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 10px;
}

.missing-info.corrected {
  background: rgba(139, 92, 246, 0.06);
}

.missing-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: #ea580c;
  margin-bottom: 6px;
}

.missing-info.corrected .missing-label {
  color: #8b5cf6;
}

.missing-label svg {
  width: 14px;
  height: 14px;
}

.missing-episodes {
  font-size: 12px;
  color: #374151;
  line-height: 1.6;
  word-break: break-word;
}

.missing-episodes.dark {
  color: #cbd5e1;
}

.original-missing-note {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed #e2e8f0;
}

.original-missing-note.dark {
  color: #64748b;
  border-top-color: #334155;
}

.show-actions {
  display: flex;
  justify-content: flex-end;
}

.complete-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: rgba(16, 185, 129, 0.08);
  border-radius: 10px;
  color: #10b981;
  font-size: 13px;
  font-weight: 500;
}

.complete-summary.dark {
  background: rgba(16, 185, 129, 0.15);
}

.complete-summary svg {
  width: 18px;
  height: 18px;
}

.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  text-align: center;
}

.empty-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border-radius: 12px;
  margin-bottom: 12px;
}

.empty-icon.dark {
  background: #334155;
}

.empty-icon svg {
  width: 24px;
  height: 24px;
  color: #94a3b8;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 6px 0;
}

.empty-title.dark {
  color: #f8fafc;
}

.empty-desc {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}

.empty-desc.dark {
  color: #94a3b8;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-content {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 24px;
  width: 100%;
  max-width: 460px;
  box-shadow:
    0 28px 60px rgba(15, 23, 42, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px);
  overflow: hidden;
}

.modal-content.dark {
  background: rgba(15, 23, 42, 0.92);
  border-color: rgba(71, 85, 105, 0.48);
  box-shadow:
    0 28px 60px rgba(2, 6, 23, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.78);
}

.modal-content.dark .modal-header {
  border-bottom-color: rgba(51, 65, 85, 0.88);
}

.modal-title {
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  letter-spacing: -0.01em;
}

.modal-title.dark {
  color: #f8fafc;
}

.modal-close {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(248, 250, 252, 0.9);
  border: 1px solid rgba(226, 232, 240, 0.82);
  border-radius: 12px;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.98);
  color: #0f172a;
  transform: translateY(-1px);
}

.modal-close svg {
  width: 18px;
  height: 18px;
}

.modal-body {
  padding: 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-body .form-group {
  margin-bottom: 0;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group {
  flex: 1;
}

.form-input {
  width: 100%;
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid rgba(203, 213, 225, 0.92);
  border-radius: 12px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.94);
  color: #1e293b;
  transition: all 0.2s;
}

.form-input.dark {
  background: rgba(51, 65, 85, 0.92);
  border-color: rgba(71, 85, 105, 0.9);
  color: #f1f5f9;
}

.form-input:disabled {
  background: rgba(241, 245, 249, 0.9);
  cursor: not-allowed;
}

.form-input.dark:disabled {
  background: rgba(30, 41, 59, 0.88);
}

.form-input:focus {
  outline: none;
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.14);
}

.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(203, 213, 225, 0.92);
  border-radius: 12px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.94);
  color: #1e293b;
  resize: vertical;
  min-height: 72px;
  font-family: inherit;
  transition: all 0.2s;
}

.form-textarea.dark {
  background: rgba(51, 65, 85, 0.92);
  border-color: rgba(71, 85, 105, 0.9);
  color: #f1f5f9;
}

.form-textarea:focus {
  outline: none;
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.14);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 18px 22px;
  border-top: 1px solid rgba(226, 232, 240, 0.78);
}

.modal-content.dark .modal-footer {
  border-top-color: rgba(51, 65, 85, 0.88);
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
  }

  .filter-right .btn {
    width: 100%;
  }

  .stats-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .show-grid {
    grid-template-columns: 1fr;
  }

  .form-row {
    flex-direction: column;
  }

  .form-select,
  .form-input,
  .form-textarea {
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  .section-box {
    border-radius: 20px;
  }

  .section-box-header {
    padding: 14px;
  }

  .section-box-content {
    padding: 14px;
  }

  .section-box-title {
    font-size: 15px;
  }

  .header-right {
    width: 100%;
    justify-content: space-between;
  }

  .progress-section {
    margin-bottom: 14px;
    padding: 12px;
    border-radius: 16px;
  }

  .progress-bar-wrapper {
    gap: 10px;
  }

  .show-card {
    padding: 12px;
    border-radius: 16px;
  }

  .show-name {
    font-size: 13px;
  }

  .show-actions .btn {
    width: 100%;
  }

  .stat-item {
    padding: 12px;
    border-radius: 16px;
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

  .modal-content {
    border-radius: 20px;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding-left: 14px;
    padding-right: 14px;
  }

  .modal-footer {
    flex-direction: column-reverse;
  }

  .modal-footer .btn {
    width: 100%;
  }
}

</style>
