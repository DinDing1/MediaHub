<template>
  <div class="media-info-tab">
    <div class="section-box" :class="{ dark: isDark }">
      <div class="section-box-header">
        <div>
          <h2 class="section-box-title">媒体信息提取</h2>
          <span class="section-box-desc" :class="{ dark: isDark }">
            触发 Emby 补齐视频、音频、字幕轨道信息，不直接修改媒体文件
          </span>
        </div>
      </div>
      <div class="section-box-content">
        <div class="filter-section">
          <div class="config-layout">
            <div class="form-group config-card config-card-library">
              <label class="form-label" :class="{ dark: isDark }">选择媒体库</label>
              <div class="select-shell" :class="{ dark: isDark, disabled: isRunning || loadingLibraries || savingConfig }">
                <select
                  v-model="selectedLibrary"
                  class="form-select"
                  :class="{ dark: isDark }"
                  :disabled="isRunning || loadingLibraries || hasLibrariesError || savingConfig"
                  @change="saveTaskConfig"
                >
                  <option value="all">全部媒体库</option>
                  <option v-for="library in libraries" :key="library.id" :value="library.id">
                    {{ library.name }} · {{ library.typeLabel }}
                  </option>
                </select>
                <svg class="select-arrow" :class="{ dark: isDark }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </div>

            <div class="form-group config-card config-card-thread">
              <label class="form-label" :class="{ dark: isDark }">提取线程</label>
              <div class="thread-shell" :class="{ dark: isDark, disabled: isRunning || savingConfig }">
                <button
                  type="button"
                  class="thread-btn"
                  :class="{ dark: isDark }"
                  :disabled="isRunning || savingConfig || normalizedConcurrency <= 1"
                  @click="updateConcurrency(-1)"
                >
                  -
                </button>
                <input
                  v-model.number="concurrency"
                  type="number"
                  class="form-input thread-input"
                  :class="{ dark: isDark }"
                  :disabled="isRunning || savingConfig"
                  min="1"
                  max="10"
                  step="1"
                  @blur="saveTaskConfig"
                >
                <button
                  type="button"
                  class="thread-btn"
                  :class="{ dark: isDark }"
                  :disabled="isRunning || savingConfig || normalizedConcurrency >= 10"
                  @click="updateConcurrency(1)"
                >
                  +
                </button>
              </div>
            </div>

            <div class="form-group config-card">
              <label class="form-label" :class="{ dark: isDark }">追更模式</label>
              <div class="select-shell" :class="{ dark: isDark, disabled: savingFollowConfig }">
                <select
                  v-model="followEnabledValue"
                  class="form-select"
                  :class="{ dark: isDark }"
                  :disabled="savingFollowConfig"
                  @change="saveFollowConfig"
                >
                  <option :value="'true'">开启</option>
                  <option :value="'false'">关闭</option>
                </select>
                <svg class="select-arrow" :class="{ dark: isDark }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </div>

            <div class="config-action">
              <button class="btn btn-primary" :disabled="isStartDisabled" @click="startTask">
                <svg v-if="isRunning || starting || loadingLibraries || savingConfig" :class="{ spin: isRunning || starting || loadingLibraries || savingConfig }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
                </svg>
                <svg v-else-if="hasLibrariesError || !hasAvailableLibraries" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <span>{{ startButtonText }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="section-box" :class="{ dark: isDark }">
      <div class="section-box-header">
        <h2 class="section-box-title">运行状态</h2>
        <div class="status-head-right">
          <span class="follow-tag" :class="{ dark: isDark }">追更 {{ followEnabledText }}</span>
          <span class="concurrency-tag" :class="{ dark: isDark }">线程 {{ status.concurrency }}</span>
          <span class="status-tag" :class="[status.phase, { dark: isDark }]">{{ phaseText }}</span>
        </div>
      </div>
      <div class="section-box-content">
        <div class="stats-row">
          <div class="stat-item total" :class="{ dark: isDark }">
            <div class="stat-icon blue primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <path d="M9 9h6v6H9z"/>
              </svg>
            </div>
            <div class="stat-content">
              <span class="stat-value" :class="{ dark: isDark }">{{ status.total }}</span>
              <span class="stat-label" :class="{ dark: isDark }">总项目数</span>
            </div>
          </div>
          <div class="stat-item existing" :class="{ dark: isDark }">
            <div class="stat-icon purple primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            </div>
            <div class="stat-content">
              <span class="stat-value" :class="{ dark: isDark }">{{ status.existing }}</span>
              <span class="stat-label" :class="{ dark: isDark }">已有媒体信息</span>
            </div>
          </div>
          <div class="stat-item success" :class="{ dark: isDark }">
            <div class="stat-icon green primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div class="stat-content">
              <span class="stat-value" :class="{ dark: isDark }">{{ status.extracted }}</span>
              <span class="stat-label" :class="{ dark: isDark }">成功提取</span>
            </div>
          </div>
          <div class="stat-item failed" :class="{ dark: isDark }">
            <div class="stat-icon red primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <div class="stat-content">
              <span class="stat-value" :class="{ dark: isDark }">{{ status.failed }}</span>
              <span class="stat-label" :class="{ dark: isDark }">失败项目</span>
            </div>
          </div>
        </div>

        <div class="follow-secondary-row">
          <div class="stat-item stat-item-secondary follow-queue" :class="{ dark: isDark }">
            <div class="stat-icon cyan secondary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 7h18"/>
                <path d="M6 12h12"/>
                <path d="M10 17h4"/>
              </svg>
            </div>
            <div class="stat-content">
              <div class="stat-line">
                <span class="stat-value stat-value-secondary" :class="{ dark: isDark }">{{ followStatus.pending + followStatus.processing }}</span>
                <span class="stat-mini-tag" :class="{ dark: isDark }">处理中 {{ followStatus.processing }} / 失败 {{ followStatus.failed }}</span>
              </div>
              <span class="stat-label" :class="{ dark: isDark }">队列中</span>
            </div>
          </div>
          <div class="stat-item stat-item-secondary follow-latest" :class="{ dark: isDark }">
            <div class="stat-icon amber secondary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="9"/>
                <polyline points="12 7 12 12 15 15"/>
              </svg>
            </div>
            <div class="stat-content">
              <div class="stat-line">
                <span class="stat-value stat-value-text" :class="{ dark: isDark }">{{ followStatusText }}</span>
                <span class="stat-mini-tag" :class="{ dark: isDark }">{{ followStatus.currentItemName || '等待中' }}</span>
              </div>
              <span class="stat-label" :class="{ dark: isDark }">追更状态</span>
              <span class="stat-meta" :class="{ dark: isDark }">最近 {{ formatDateTime(followStatus.lastRunAt) }}</span>
            </div>
          </div>
        </div>

        <div class="progress-box" :class="{ dark: isDark }">
          <div class="progress-head progress-head-mobile-stack">
            <span class="progress-title" :class="{ dark: isDark }">{{ status.message || '等待开始' }}</span>
            <span class="progress-numbers" :class="{ dark: isDark }">{{ status.scanned }}/{{ status.total }}</span>
          </div>
          <div class="progress-track" :class="{ dark: isDark }">
            <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
          </div>
          <div class="progress-meta lifecycle-grid">
            <span class="progress-meta-item" :class="{ dark: isDark }">当前媒体库：{{ status.currentLibraryName || status.libraryName || '—' }}</span>
            <span class="progress-meta-item" :class="{ dark: isDark }">当前媒体：{{ status.currentItemName || '—' }}</span>
            <span class="progress-meta-item" :class="{ dark: isDark }">开始时间：{{ formatDateTime(status.startedAt) }}</span>
            <span class="progress-meta-item" :class="{ dark: isDark }">最后更新：{{ formatDateTime(status.lastUpdatedAt) }}</span>
            <span class="progress-meta-item" :class="{ dark: isDark }">结束时间：{{ formatDateTime(status.finishedAt) }}</span>
            <span class="progress-meta-item" :class="{ dark: isDark }">剩余项目：{{ status.pending }}</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { formatShanghaiDateTime } from '~/utils/time'

interface Props {
  isDark: boolean
}

interface MediaInfoLibraryOption {
  id: string
  name: string
  type: string
  typeLabel: string
}

interface MediaInfoTaskStatus {
  running: boolean
  phase: 'idle' | 'scanning' | 'extracting' | 'completed' | 'failed'
  mode: 'missing'
  concurrency: number
  selectedLibraryId: string
  libraryName: string
  message: string
  total: number
  scanned: number
  existing: number
  extracted: number
  failed: number
  pending: number
  currentItemName: string
  currentLibraryName: string
  startedAt: string | null
  finishedAt: string | null
  lastUpdatedAt: string | null
}

interface MediaInfoFollowTaskStatus {
  enabled: boolean
  running: boolean
  concurrency: number
  message: string
  pending: number
  processing: number
  failed: number
  currentItemName: string
  currentLibraryName: string
  lastRunAt: string | null
  lastUpdatedAt: string | null
}

defineProps<Props>()

const FOLLOW_IDLE_POLL_INTERVAL = 5000
const ACTIVE_POLL_INTERVAL = 1500

const libraries = ref<MediaInfoLibraryOption[]>([])
const selectedLibrary = ref('all')
const concurrency = ref(1)
const followEnabledValue = ref<'true' | 'false'>('false')
const starting = ref(false)
const savingConfig = ref(false)
const savingFollowConfig = ref(false)
const loadingLibraries = ref(false)
const loadingStatus = ref(false)
const loadingFollowStatus = ref(false)
const librariesError = ref('')
const pollTimer = ref<number | null>(null)
const currentPollInterval = ref<number | null>(null)

const status = ref<MediaInfoTaskStatus>({
  running: false,
  phase: 'idle',
  mode: 'missing',
  concurrency: 1,
  selectedLibraryId: 'all',
  libraryName: '',
  message: '等待开始',
  total: 0,
  scanned: 0,
  existing: 0,
  extracted: 0,
  failed: 0,
  pending: 0,
  currentItemName: '',
  currentLibraryName: '',
  startedAt: null,
  finishedAt: null,
  lastUpdatedAt: null
})

const followStatus = ref<MediaInfoFollowTaskStatus>({
  enabled: false,
  running: false,
  concurrency: 1,
  message: '等待新媒体入队',
  pending: 0,
  processing: 0,
  failed: 0,
  currentItemName: '',
  currentLibraryName: '',
  lastRunAt: null,
  lastUpdatedAt: null
})

const isRunning = computed(() => status.value.running)
const hasAvailableLibraries = computed(() => libraries.value.length > 0)
const hasLibrariesError = computed(() => Boolean(librariesError.value))
const isFollowActive = computed(() => followStatus.value.running || followStatus.value.pending > 0 || followStatus.value.processing > 0)
const followPollingInterval = computed(() => (status.value.running || isFollowActive.value) ? ACTIVE_POLL_INTERVAL : FOLLOW_IDLE_POLL_INTERVAL)

const isStartDisabled = computed(() => {
  return isRunning.value || starting.value || loadingLibraries.value || hasLibrariesError.value || !hasAvailableLibraries.value || savingConfig.value
})

const startButtonText = computed(() => {
  if (isRunning.value) return '提取中...'
  if (starting.value) return '启动中...'
  if (savingConfig.value) return '保存中...'
  if (loadingLibraries.value) return '加载中...'
  if (hasLibrariesError.value) return '加载失败'
  if (!hasAvailableLibraries.value) return '无可用媒体库'
  return '开始提取'
})

const normalizedConcurrency = computed(() => {
  const value = Number(concurrency.value)
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.min(10, Math.max(1, Math.floor(value)))
})

const progressPercent = computed(() => {
  if (status.value.total <= 0) return 0
  return Math.min(100, Math.round((status.value.scanned / status.value.total) * 100))
})

const phaseText = computed(() => {
  switch (status.value.phase) {
    case 'scanning':
      return '扫描中'
    case 'extracting':
      return '提取中'
    case 'completed':
      return '已完成'
    case 'failed':
      return '执行失败'
    default:
      return '空闲'
  }
})

const followEnabledText = computed(() => followStatus.value.enabled ? '已开启' : '已关闭')

const followStatusText = computed(() => {
  if (followStatus.value.running) return '处理中'
  if (followStatus.value.pending > 0 || followStatus.value.processing > 0) return '队列处理中'
  if (followStatus.value.enabled) return '监听中'
  return '未启用'
})

const formatDateTime = (value: string | null) => {
  return formatShanghaiDateTime(value) || (value || '—')
}

const loadLibraries = async () => {
  loadingLibraries.value = true
  librariesError.value = ''

  try {
    const response = await $fetch('/api/emby/media_info?action=libraries') as any
    if (response.success) {
      libraries.value = response.data || []
      return
    }

    libraries.value = []
    librariesError.value = response.error || '媒体库加载失败，请检查 Emby 配置或连接状态。'
  } catch (error: any) {
    libraries.value = []
    librariesError.value = error?.data?.error || error?.message || '媒体库加载失败，请检查 Emby 配置或连接状态。'
    console.error('加载媒体库失败:', error)
  } finally {
    loadingLibraries.value = false
  }
}

const loadTaskConfig = async () => {
  try {
    const response = await $fetch('/api/emby/media_info?action=config') as any
    if (response.success && response.data) {
      selectedLibrary.value = response.data.libraryId || 'all'
      concurrency.value = Number(response.data.concurrency) || 1

      if (!status.value.running) {
        status.value = {
          ...status.value,
          selectedLibraryId: selectedLibrary.value,
          concurrency: concurrency.value
        }
      }
    }
  } catch (error) {
    console.error('加载媒体信息配置失败:', error)
  }
}

const loadFollowConfig = async () => {
  try {
    const response = await $fetch('/api/emby/media_info?action=follow_config') as any
    if (response.success && response.data) {
      followEnabledValue.value = response.data.enabled === true ? 'true' : 'false'
    }
  } catch (error) {
    console.error('加载追更配置失败:', error)
  }
}

const syncConfigFromStatus = () => {
  if (!status.value.running) {
    return
  }

  selectedLibrary.value = status.value.selectedLibraryId || 'all'
  concurrency.value = status.value.concurrency || 1
}

const stopPolling = () => {
  if (pollTimer.value !== null) {
    window.clearInterval(pollTimer.value)
    pollTimer.value = null
  }

  currentPollInterval.value = null
}

const syncPollingState = () => {
  const interval = followPollingInterval.value

  if (pollTimer.value !== null && currentPollInterval.value === interval) {
    return
  }

  stopPolling()
  currentPollInterval.value = interval

  pollTimer.value = window.setInterval(() => {
    void loadFollowStatus()
    if (status.value.running || isFollowActive.value) {
      void loadStatus()
    }
  }, interval)
}


const loadStatus = async () => {
  if (loadingStatus.value) {
    return
  }

  loadingStatus.value = true
  try {
    const response = await $fetch('/api/emby/media_info?action=status') as any
    if (response.success && response.data) {
      status.value = response.data
      syncConfigFromStatus()
    }
  } catch (error) {
    console.error('加载媒体信息提取状态失败:', error)
  } finally {
    loadingStatus.value = false
  }
}

const loadFollowStatus = async () => {
  if (loadingFollowStatus.value) {
    return
  }

  loadingFollowStatus.value = true
  try {
    const response = await $fetch('/api/emby/media_info?action=follow_status') as any
    if (response.success && response.data) {
      followStatus.value = response.data
      followEnabledValue.value = response.data.enabled === true ? 'true' : 'false'
      syncPollingState()
    }
  } catch (error) {
    console.error('加载追更状态失败:', error)
  } finally {
    loadingFollowStatus.value = false
  }
}

const saveTaskConfig = async () => {
  if (savingConfig.value) {
    return
  }

  savingConfig.value = true
  concurrency.value = normalizedConcurrency.value

  try {
    const response = await $fetch('/api/emby/media_info', {
      method: 'POST',
      body: {
        action: 'config',
        libraryId: selectedLibrary.value,
        concurrency: normalizedConcurrency.value
      }
    }) as any

    if (!response.success) {
      alert(response.error || '保存失败')
      return
    }

    if (!status.value.running) {
      status.value = {
        ...status.value,
        selectedLibraryId: response.data?.libraryId || selectedLibrary.value,
        concurrency: Number(response.data?.concurrency) || normalizedConcurrency.value
      }
    }
  } catch (error: any) {
    alert(error?.data?.error || error?.message || '保存失败')
  } finally {
    savingConfig.value = false
  }
}

const saveFollowConfig = async () => {
  if (savingFollowConfig.value) {
    return
  }

  savingFollowConfig.value = true
  try {
    const response = await $fetch('/api/emby/media_info', {
      method: 'POST',
      body: {
        action: 'follow_config',
        enabled: followEnabledValue.value === 'true'
      }
    }) as any

    if (!response.success) {
      alert(response.error || '保存失败')
      return
    }

    await loadFollowStatus()
    syncPollingState()
  } catch (error: any) {
    alert(error?.data?.error || error?.message || '保存失败')
  } finally {
    savingFollowConfig.value = false
  }
}

const updateConcurrency = (delta: number) => {
  concurrency.value = Math.min(10, Math.max(1, normalizedConcurrency.value + delta))
  void saveTaskConfig()
}

const startTask = async () => {
  if (isStartDisabled.value) {
    return
  }

  await saveTaskConfig()
  concurrency.value = normalizedConcurrency.value
  starting.value = true

  try {
    const response = await $fetch('/api/emby/media_info', {
      method: 'POST',
      body: {
        library_id: selectedLibrary.value,
        concurrency: normalizedConcurrency.value
      }
    }) as any

    if (!response.success) {
      alert(response.error || '启动失败')
      return
    }

    await Promise.all([loadStatus(), loadFollowStatus()])
    syncPollingState()
  } catch (error: any) {
    alert(error?.data?.error || error?.message || '启动失败')
  } finally {
    starting.value = false
  }
}

onMounted(async () => {
  await loadLibraries()
  await Promise.all([loadTaskConfig(), loadFollowConfig(), loadStatus(), loadFollowStatus()])
  syncConfigFromStatus()
  syncPollingState()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.media-info-tab {
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
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.section-box.dark .section-box-title {
  color: #f8fafc;
}

.section-box-desc {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  color: #64748b;
}

.section-box-desc.dark {
  color: #94a3b8;
}

.section-box-content {
  padding: 18px;
}

.filter-section {
  display: block;
  overflow: hidden;
}

.config-layout {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1.52fr) minmax(112px, 0.92fr) minmax(92px, 0.72fr) minmax(96px, 0.74fr);
  gap: 10px;
  align-items: stretch;
}

.config-card {
  min-width: 0;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(226, 232, 240, 0.82);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.92) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.dark .config-card,
.config-card:has(.dark) {
  border-color: rgba(71, 85, 105, 0.52);
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.84) 0%, rgba(15, 23, 42, 0.92) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.config-action {
  min-width: 96px;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 10px;
}

.config-action .btn {
  width: 100%;
  min-width: 0;
  padding-inline: 10px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: #475569;
}

.form-label.dark {
  color: #cbd5e1;
}

.select-shell,
.thread-shell {
  position: relative;
  min-height: 46px;
  border-radius: 14px;
  border: 1px solid rgba(203, 213, 225, 0.88);
  background: rgba(255, 255, 255, 0.86);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.select-shell.dark,
.thread-shell.dark {
  border-color: rgba(71, 85, 105, 0.58);
  background: rgba(15, 23, 42, 0.84);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.select-shell.disabled,
.thread-shell.disabled {
  opacity: 0.72;
}

.form-select,
.form-input {
  min-height: 44px;
  padding: 0 14px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: #0f172a;
  font-size: 13px;
  outline: none;
}

.form-select {
  width: 100%;
  appearance: none;
  padding-right: 40px;
}

.config-card-library .form-select {
  font-size: 12px;
}

.config-card-thread .thread-shell {
  grid-template-columns: 40px minmax(0, 1fr) 40px;
}

.config-card-thread .thread-btn {
  width: 40px;
  height: 40px;
}

.form-select.dark,
.form-input.dark {
  color: #f8fafc;
}

.select-arrow {
  position: absolute;
  top: 50%;
  right: 14px;
  width: 16px;
  height: 16px;
  color: #94a3b8;
  pointer-events: none;
  transform: translateY(-50%);
}

.select-arrow.dark {
  color: #64748b;
}

.select-shell:focus-within,
.thread-shell:focus-within {
  border-color: rgba(96, 165, 250, 0.78);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.thread-shell {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 38px;
  align-items: center;
}

.thread-input {
  text-align: center;
  padding: 0 6px;
}

.thread-input::-webkit-outer-spin-button,
.thread-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.thread-input[type='number'] {
  -moz-appearance: textfield;
}

.thread-btn {
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #2563eb;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
}

.thread-btn.dark {
  color: #93c5fd;
}

.thread-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 42px;
  padding: 0 16px;
  border: 0;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
}

.btn svg {
  width: 16px;
  height: 16px;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-primary {
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 38%, #2563eb 100%);
  color: white;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.btn-primary:hover:not(:disabled) {
  box-shadow: 0 16px 28px rgba(37, 99, 235, 0.24);
}

.status-head-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.concurrency-tag,
.status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.follow-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.01em;
  background: rgba(236, 253, 245, 0.96);
  color: #047857;
}

.follow-tag.dark {
  background: rgba(6, 78, 59, 0.34);
  color: #a7f3d0;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.stat-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  justify-content: space-between;
  flex-wrap: wrap;
}

.stat-mini-tag {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  color: #475569;
  background: rgba(241, 245, 249, 0.96);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-mini-tag.dark {
  color: #cbd5e1;
  background: rgba(30, 41, 59, 0.92);
}

.follow-secondary-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.stat-item-secondary {
  min-height: 68px;
  padding: 10px 14px;
  border-radius: 16px;
  background: rgba(250, 252, 255, 0.82);
}

.stat-item-secondary.dark {
  background: rgba(15, 23, 42, 0.42);
}

.stat-item {
  min-width: 0;
  min-height: 86px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.78);
  background: rgba(248, 250, 252, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.64);
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-item.dark {
  border-color: rgba(71, 85, 105, 0.48);
  background: rgba(15, 23, 42, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.stat-item.total {
  border-color: rgba(191, 219, 254, 0.76);
}

.stat-item.existing {
  border-color: rgba(221, 214, 254, 0.76);
}

.stat-item.success {
  border-color: rgba(187, 247, 208, 0.76);
}

.stat-item.failed {
  border-color: rgba(254, 202, 202, 0.76);
}

.stat-item.total.dark {
  border-color: rgba(59, 130, 246, 0.28);
}

.stat-item.existing.dark {
  border-color: rgba(139, 92, 246, 0.26);
}

.stat-item.success.dark {
  border-color: rgba(34, 197, 94, 0.26);
}

.stat-item.follow-queue {
  border-color: rgba(167, 243, 208, 0.76);
}

.stat-item.follow-latest {
  border-color: rgba(253, 230, 138, 0.76);
}

.stat-item.follow-queue.dark {
  border-color: rgba(20, 184, 166, 0.28);
}

.stat-item.follow-latest.dark {
  border-color: rgba(245, 158, 11, 0.26);
}

.stat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #ffffff;
}

.stat-icon svg {
  width: 18px;
  height: 18px;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.stat-icon.cyan {
  background: linear-gradient(135deg, rgba(45, 212, 191, 0.88) 0%, rgba(8, 145, 178, 0.92) 100%);
  color: #ffffff;
}

.stat-icon.amber {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.9) 0%, rgba(245, 158, 11, 0.94) 100%);
  color: #ffffff;
}

.stat-icon.primary {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.28);
}

.stat-icon.secondary {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.22);
}

.stat-value-secondary {
  font-size: 18px;
  letter-spacing: -0.02em;
}

.stat-icon.blue {
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.88) 0%, rgba(37, 99, 235, 0.92) 100%);
  color: #ffffff;
}

.stat-icon.purple {
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.9) 0%, rgba(124, 58, 237, 0.92) 100%);
  color: #ffffff;
}

.stat-icon.green {
  background: linear-gradient(135deg, rgba(74, 222, 128, 0.88) 0%, rgba(22, 163, 74, 0.92) 100%);
  color: #ffffff;
}

.stat-icon.red {
  background: linear-gradient(135deg, rgba(248, 113, 113, 0.88) 0%, rgba(220, 38, 38, 0.92) 100%);
  color: #ffffff;
}

.stat-content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.stat-value {
  font-size: 22px;
  line-height: 1;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.03em;
}

.stat-value.dark {
  color: #f8fafc;
}

.stat-label {
  font-size: 11px;
  line-height: 1.35;
  font-weight: 700;
  color: #64748b;
}

.stat-label.dark {
  color: #94a3b8;
}

.stat-meta {
  font-size: 11px;
  line-height: 1.45;
  color: #64748b;
}

.stat-meta.dark {
  color: #94a3b8;
}

.stat-value-text {
  font-size: 16px;
  line-height: 1.35;
  letter-spacing: -0.01em;
}

.progress-box {
  margin-top: 14px;
  padding: 16px 18px;
  border-radius: 20px;
  border: 1px solid rgba(226, 232, 240, 0.82);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.96) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.progress-box.dark {
  border-color: rgba(51, 65, 85, 0.88);
  background: rgba(15, 23, 42, 0.86);
}

.progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.progress-title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.progress-title.dark,
.progress-numbers.dark,
.progress-meta-item.dark {
  color: #e2e8f0;
}

.progress-numbers {
  font-size: 12px;
  color: #64748b;
  flex-shrink: 0;
}

.progress-track {
  height: 10px;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.94);
  overflow: hidden;
}

.progress-track.dark {
  background: rgba(51, 65, 85, 0.92);
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #60a5fa 0%, #3b82f6 50%, #22c55e 100%);
  transition: width 0.2s ease;
}

.progress-meta {
  margin-top: 12px;
  display: grid;
  gap: 8px 12px;
}

.lifecycle-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.progress-meta-item {
  font-size: 12px;
  color: #64748b;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-tag.dark.idle {
  background: rgba(51, 65, 85, 0.92);
  color: #cbd5e1;
}

.status-tag.dark.scanning,
.status-tag.dark.extracting {
  background: rgba(30, 64, 175, 0.22);
  color: #bfdbfe;
}

.status-tag.dark.completed {
  background: rgba(20, 83, 45, 0.42);
  color: #bbf7d0;
}

.status-tag.dark.failed {
  background: rgba(127, 29, 29, 0.38);
  color: #fecaca;
}

.status-tag.idle {
  background: rgba(226, 232, 240, 0.96);
  color: #475569;
}

.status-tag.scanning,
.status-tag.extracting {
  background: rgba(219, 234, 254, 0.96);
  color: #1d4ed8;
}

.status-tag.completed {
  background: rgba(220, 252, 231, 0.96);
  color: #15803d;
}

.status-tag.failed {
  background: rgba(254, 226, 226, 0.96);
  color: #dc2626;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 1024px) {
  .config-layout {
    grid-template-columns: minmax(0, 1.16fr) minmax(118px, 1.06fr) minmax(88px, 0.68fr) minmax(90px, 0.72fr);
    gap: 8px;
  }

  .config-card {
    padding: 11px;
  }
}

@media (max-width: 900px) {
  .config-layout {
    grid-template-columns: minmax(0, 0.98fr) minmax(124px, 1.08fr) minmax(82px, 0.64fr) minmax(86px, 0.68fr);
    gap: 7px;
  }

  .config-card {
    padding: 10px;
    border-radius: 14px;
  }

  .config-action {
    min-width: 86px;
  }

  .form-label {
    font-size: 11px;
  }

  .form-select,
  .form-input {
    min-height: 40px;
    padding: 0 12px;
    font-size: 12px;
  }

  .form-select {
    padding-right: 34px;
  }

  .select-arrow {
    right: 12px;
    width: 14px;
    height: 14px;
  }

  .thread-shell {
    grid-template-columns: 32px minmax(0, 1fr) 32px;
  }

  .thread-btn {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    font-size: 16px;
  }

  .btn {
    height: 40px;
    padding: 0 10px;
    font-size: 12px;
  }

  .btn svg {
    width: 14px;
    height: 14px;
  }
}

@media (max-width: 640px) {
  .section-box-content,
  .section-box-header {
    padding: 12px;
  }

  .stats-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .progress-meta,
  .follow-secondary-row {
    grid-template-columns: 1fr;
  }

  .config-layout {
    grid-template-columns: 1fr;
    gap: 9px;
  }

  .config-card {
    padding: 11px;
    border-radius: 15px;
  }

  .config-action {
    min-width: 0;
  }

  .config-action .btn {
    min-height: 44px;
    padding: 0 14px;
    border-radius: 14px;
  }

  .form-label {
    font-size: 11px;
  }

  .select-shell,
  .thread-shell,
  .btn {
    min-height: 40px;
  }

  .form-select,
  .form-input {
    min-height: 40px;
    padding: 0 12px;
    font-size: 12px;
  }

  .form-select {
    padding-right: 34px;
  }

  .select-arrow {
    right: 12px;
    width: 14px;
    height: 14px;
  }

  .config-card-library .form-select {
    font-size: 11px;
  }

  .config-card-thread .thread-shell {
    grid-template-columns: 34px minmax(0, 1fr) 34px;
  }

  .config-card-thread .thread-btn {
    width: 34px;
    height: 34px;
  }

  .thread-shell {
    grid-template-columns: 32px minmax(0, 1fr) 32px;
  }

  .thread-btn {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    font-size: 16px;
  }

  .btn svg {
    width: 14px;
    height: 14px;
  }

  .status-head-right {
    width: 100%;
    justify-content: flex-start;
    gap: 6px;
  }

  .concurrency-tag,
  .status-tag,
  .follow-tag {
    min-height: 26px;
    padding: 0 10px;
  }

  .stat-item {
    min-height: 74px;
    padding: 11px 12px;
    gap: 10px;
  }

  .stat-item-secondary {
    min-height: 64px;
    padding: 10px 12px;
  }

  .stat-icon.primary {
    width: 34px;
    height: 34px;
  }

  .stat-icon.secondary {
    width: 30px;
    height: 30px;
  }

  .stat-icon svg {
    width: 16px;
    height: 16px;
  }

  .stat-value {
    font-size: 18px;
  }

  .stat-value-secondary,
  .stat-value-text {
    font-size: 14px;
  }

  .stat-label {
    font-size: 10px;
  }

  .stat-mini-tag,
  .stat-meta {
    font-size: 10px;
  }

  .progress-box {
    margin-top: 12px;
    padding: 13px 14px;
    border-radius: 16px;
  }

  .progress-head-mobile-stack {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    margin-bottom: 8px;
  }

  .progress-title {
    font-size: 12px;
    line-height: 1.45;
  }

  .progress-numbers {
    font-size: 11px;
  }

  .progress-meta {
    gap: 6px;
  }

  .lifecycle-grid {
    grid-template-columns: 1fr;
  }

  .progress-meta-item {
    font-size: 11px;
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    line-height: 1.45;
  }
}
</style>
