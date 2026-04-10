<!--
  仪表盘页面
  展示媒体库统计、最近入库和最近播放
-->
<template>
  <div class="dashboard" :class="{ dark: isDark }">

    <!-- 未配置提示 -->
    <div v-if="!loading && !hasConfig" class="alert warning" :class="{ dark: isDark }">
      <div class="alert-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div class="alert-content">
        <p class="alert-title">Emby 未配置</p>
        <p class="alert-desc">请先前往参数配置页面设置 Emby 服务器地址和 API 密钥</p>
        <NuxtLink to="/settings" class="alert-link">前往配置</NuxtLink>
      </div>
    </div>

    <!-- 媒体库统计区块 -->
    <div class="section-box" :class="{ dark: isDark }">
      <div class="section-box-header">
        <h2 class="section-box-title">媒体库统计</h2>
      </div>
      <div class="section-box-content">
        <div class="stats-grid">
          <div class="stat-card" :class="{ dark: isDark }">
            <div class="stat-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                <line x1="7" y1="2" x2="7" y2="22"/>
                <line x1="17" y1="2" x2="17" y2="22"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <line x1="2" y1="7" x2="7" y2="7"/>
                <line x1="2" y1="17" x2="7" y2="17"/>
                <line x1="17" y1="17" x2="22" y2="17"/>
                <line x1="17" y1="7" x2="22" y2="7"/>
              </svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">电影</span>
              <span class="stat-value" :class="{ skeleton: loading }">{{ loading ? '' : formatNumber(data?.statistics?.movieCount || 0) }}</span>
            </div>
          </div>

          <div class="stat-card" :class="{ dark: isDark }">
            <div class="stat-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                <polyline points="17 2 12 7 7 2"/>
              </svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">电视剧</span>
              <span class="stat-value" :class="{ skeleton: loading }">{{ loading ? '' : formatNumber(data?.statistics?.tvCount || 0) }}</span>
            </div>
          </div>

          <div class="stat-card" :class="{ dark: isDark }">
            <div class="stat-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">剧集</span>
              <span class="stat-value" :class="{ skeleton: loading }">{{ loading ? '' : formatNumber(data?.statistics?.episodeCount || 0) }}</span>
            </div>
          </div>

          <div class="stat-card" :class="{ dark: isDark }">
            <div class="stat-icon orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">用户</span>
              <span class="stat-value" :class="{ skeleton: loading }">{{ loading ? '' : formatNumber(data?.statistics?.userCount || 0) }}</span>
            </div>
          </div>

          <div class="stat-card" :class="{ dark: isDark }">
            <div class="stat-icon cyan">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">最近入库</span>
              <span class="stat-value recent-stats" :class="{ skeleton: loading }">
                {{ loading ? '' : `${data?.recentAddedStats?.today || 0}-${data?.recentAddedStats?.week || 0}-${data?.recentAddedStats?.month || 0}` }}
              </span>
              <span class="stat-sub" :class="{ dark: isDark }">今日 - 7日 - 30日</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 我的媒体库区块 -->
    <div class="section-box" :class="{ dark: isDark }">
      <div class="section-box-header">
        <h2 class="section-box-title">我的媒体库</h2>
        <span class="section-count" :class="{ skeleton: loading }">{{ loading ? '' : (data?.libraries?.length || 0) + ' 个库' }}</span>
      </div>
      <div class="section-box-content">
        <div class="libraries-grid">
          <template v-if="loading">
            <div v-for="i in 4" :key="i" class="library-card skeleton-card" :class="{ dark: isDark }">
              <div class="skeleton-thumb"></div>
            </div>
          </template>
          <template v-else-if="data?.libraries?.length">
            <div v-for="lib in data.libraries" :key="lib.id" class="library-card" :class="{ dark: isDark }">
              <div class="library-thumb">
                <img v-if="lib.imageUrl && !brokenImages.has(lib.id)" :src="lib.imageUrl || undefined" :alt="lib.name" loading="lazy" @error="handleImageError(lib.id)" />
                <div v-if="!lib.imageUrl || brokenImages.has(lib.id)" class="no-library-image" :class="lib.type">
                  <svg v-if="lib.type === 'movies'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  <svg v-else-if="lib.type === 'tvshows'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <span class="type-badge library-badge" :class="lib.type">{{ lib.typeLabel }}</span>
                <div class="library-overlay">
                  <span class="library-name-overlay">{{ lib.name }}</span>
                </div>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="empty-state" :class="{ dark: isDark }">
              <span>暂无媒体库</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 最近入库和最近播放 - 1行2列 -->
    <div class="two-column-grid">
      <div
        v-for="section in recentSections"
        :key="section.key"
        class="section-box"
        :class="{ dark: isDark }"
      >
        <div class="section-box-header">
          <h2 class="section-box-title">{{ section.title }}</h2>
        </div>
        <div class="section-box-content">
          <div class="items-grid" :style="getItemsGridStyle(section.key)">
            <template v-if="loading">
              <div v-for="i in getRecentVisibleCount(section.key)" :key="`${section.key}-${i}`" class="media-card skeleton-card" :class="{ dark: isDark }">
                <div class="skeleton-poster"></div>
              </div>
            </template>
            <template v-else-if="section.items.length">
              <div v-for="item in section.visibleItems" :key="item.id" class="media-card" :class="{ dark: isDark }">
                <div class="media-poster">
                  <img v-if="item.imageUrl && !brokenImages.has(item.id)" :src="item.imageUrl || undefined" :alt="item.name" loading="lazy" @error="handleImageError(item.id)" />
                  <div v-else class="no-image" :class="item.type">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="2" y="3" width="20" height="14" rx="2"/>
                      <line x1="8" y1="21" x2="16" y2="21"/>
                      <line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                  </div>
                  <span class="type-badge media-badge" :class="item.type">{{ item.typeLabel }}</span>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="empty-state" :class="{ dark: isDark }">
                <span>暂无数据</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DashboardData } from '~/types/emby'

definePageMeta({
  layout: 'default'
})

interface InitResponse {
  success: boolean
  hasConfig?: boolean
  error?: string
  data: DashboardData | null
}

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const loading = ref(true)
const hasConfig = ref(true)
const data = ref<DashboardData | null>(null)
const brokenImages = ref<Set<string>>(new Set())
const viewportWidth = ref(0)

function updateViewportWidth() {
  if (typeof window === 'undefined') return
  viewportWidth.value = window.innerWidth
}

function getRecentVisibleCount(_sectionKey: string): number {
  const width = viewportWidth.value

  if (width >= 1500) return 10
  if (width >= 920) return 8
  return 6
}

function getItemsGridStyle(sectionKey: string) {
  const columns = Math.max(3, Math.floor(getRecentVisibleCount(sectionKey) / 2))
  return {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`
  }
}

const recentSections = computed(() => {
  const recentAdded = data.value?.recentAdded ?? []
  const recentPlayed = data.value?.recentPlayed ?? []

  return [
    {
      key: 'recent-added',
      title: '最近入库',
      items: recentAdded,
      visibleItems: recentAdded.slice(0, getRecentVisibleCount('recent-added'))
    },
    {
      key: 'recent-played',
      title: '最近播放',
      items: recentPlayed,
      visibleItems: recentPlayed.slice(0, getRecentVisibleCount('recent-played'))
    }
  ]
})

function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万'
  }
  return num.toLocaleString()
}

function handleImageError(id: string) {
  if (!brokenImages.value.has(id)) {
    brokenImages.value = new Set([...brokenImages.value, id])
  }
}

async function loadData() {
  loading.value = true

  try {
    const response = await $fetch<InitResponse>('/api/emby/init')

    hasConfig.value = response.hasConfig ?? true

    if (response.success && response.data) {
      data.value = response.data
    } else {
      data.value = null
    }
  } catch (e: any) {
    hasConfig.value = true
    data.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  updateViewportWidth()
  window.addEventListener('resize', updateViewportWidth)
  loadData()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewportWidth)
})
</script>

<style scoped>
.dashboard {
  width: 100%;
  position: relative;
  padding-top: 4px;
}

.dashboard::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 220px;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent 78%);
}

.dashboard.dark::before {
  background: linear-gradient(180deg, rgba(148, 163, 184, 0.08), transparent 78%);
}

/* Alert */
.alert {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  border-radius: 24px;
  margin-bottom: 28px;
  border: 1px solid rgba(245, 158, 11, 0.18);
  background: rgba(255, 251, 235, 0.76);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
  backdrop-filter: blur(18px);
}

.alert.warning {
  background: rgba(255, 251, 235, 0.76);
  border-color: rgba(245, 158, 11, 0.18);
}

.alert.dark.warning {
  background: rgba(69, 26, 3, 0.58);
  border-color: rgba(245, 158, 11, 0.18);
  box-shadow: 0 18px 40px rgba(2, 6, 23, 0.22);
}

.alert-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.alert-icon svg {
  width: 100%;
  height: 100%;
}

.alert.warning .alert-icon {
  color: #d97706;
}

.alert.dark.warning .alert-icon {
  color: #fbbf24;
}

.alert-content {
  flex: 1;
}

.alert-title {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 4px;
}

.alert.dark .alert-title {
  color: #f8fafc;
}

.alert-desc {
  font-size: 14px;
  color: #64748b;
  margin-bottom: 12px;
}

.alert.dark .alert-desc {
  color: #94a3b8;
}

.alert-link {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  background: rgba(16, 185, 129, 0.9);
  color: white;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.alert-link:hover {
  background: #059669;
  transform: translateY(-1px);
}

/* Skeleton Loading */
.skeleton {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
  color: transparent !important;
  min-width: 60px;
  display: inline-block;
}

.dark .skeleton {
  background: linear-gradient(90deg, #334155 25%, #475569 50%, #334155 75%);
  background-size: 200% 100%;
}

.skeleton-card {
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 24px;
  overflow: hidden;
}

.skeleton-card.dark {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(71, 85, 105, 0.5);
}

.skeleton-poster {
  aspect-ratio: 2/3;
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.dark .skeleton-poster {
  background: linear-gradient(90deg, #334155 25%, #475569 50%, #334155 75%);
  background-size: 200% 100%;
}

.skeleton-thumb {
  aspect-ratio: 16/9;
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.dark .skeleton-thumb {
  background: linear-gradient(90deg, #334155 25%, #475569 50%, #334155 75%);
  background-size: 200% 100%;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Empty State */
.empty-state {
  grid-column: 1 / -1;
  padding: 40px 20px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}

.empty-state.dark {
  color: #64748b;
}

/* Section Box - 统一区块样式 */
.section-box {
  background: rgba(255, 255, 255, 0.64);
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 28px;
  margin-bottom: 28px;
  overflow: hidden;
  box-shadow:
    0 22px 54px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(24px);
}

.section-box.dark {
  background: rgba(15, 23, 42, 0.68);
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow:
    0 22px 54px rgba(2, 6, 23, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.section-box-header {
  padding: 18px 22px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.52);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-box.dark .section-box-header {
  border-bottom-color: rgba(71, 85, 105, 0.38);
}

.section-box-title {
  font-size: 15px;
  font-weight: 650;
  letter-spacing: 0.01em;
  color: #0f172a;
  margin: 0;
}

.section-box.dark .section-box-title {
  color: #f8fafc;
}

.section-count {
  font-size: 12px;
  color: #64748b;
  background: rgba(255, 255, 255, 0.64);
  border: 1px solid rgba(226, 232, 240, 0.78);
  padding: 5px 12px;
  border-radius: 999px;
}

.section-box.dark .section-count {
  color: #cbd5e1;
  background: rgba(30, 41, 59, 0.72);
  border-color: rgba(71, 85, 105, 0.52);
}

.section-box-content {
  padding: 22px;
}

@media (max-width: 768px) {
  .section-box {
    margin-bottom: 20px;
    border-radius: 22px;
  }

  .section-box-header {
    padding: 16px 18px;
  }

  .section-box-content {
    padding: 18px;
  }
}

@media (max-width: 480px) {
  .dashboard {
    padding-top: 0;
  }

  .alert {
    margin-bottom: 20px;
    border-radius: 20px;
  }

  .section-box {
    border-radius: 20px;
  }

  .section-box-header {
    padding: 14px 16px;
  }

  .section-box-content {
    padding: 16px;
  }
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .stats-grid .stat-card:last-child {
    grid-column: 1 / -1;
  }

  .stat-card {
    padding: 14px 12px;
    gap: 10px;
    min-height: 82px;
    border-radius: 20px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    border-radius: 12px;
  }

  .stat-icon svg {
    width: 18px;
    height: 18px;
  }

  .stat-label {
    font-size: 11px;
    margin-bottom: 3px;
  }

  .stat-value {
    font-size: 17px;
  }

  .stat-value.recent-stats {
    font-size: 13px;
  }

  .stat-sub {
    font-size: 10px;
  }
}

@media (max-width: 380px) {
  .stats-grid {
    gap: 8px;
  }

  .stats-grid .stat-card:last-child {
    grid-column: 1 / -1;
  }

  .stat-card {
    padding: 12px 10px;
    gap: 8px;
    min-height: 76px;
  }

  .stat-icon {
    width: 32px;
    height: 32px;
    border-radius: 11px;
  }

  .stat-icon svg {
    width: 16px;
    height: 16px;
  }

  .stat-value {
    font-size: 16px;
  }

  .stat-value.recent-stats {
    font-size: 12px;
  }

  .stat-sub {
    font-size: 9px;
  }
}

.stat-card {
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 24px;
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 92px;
  transition: box-shadow 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.64);
}

.stat-card.dark {
  background: rgba(15, 23, 42, 0.66);
  border-color: rgba(148, 163, 184, 0.16);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.stat-card:hover {
  border-color: rgba(148, 163, 184, 0.26);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.07);
  transform: translateY(-2px);
}

.stat-card.dark:hover {
  box-shadow: 0 16px 36px rgba(2, 6, 23, 0.22);
}

.stat-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.stat-icon svg {
  width: 20px;
  height: 20px;
}

.stat-icon.blue {
  background: rgba(96, 165, 250, 0.16);
  color: #2563eb;
}

.stat-icon.green {
  background: rgba(52, 211, 153, 0.16);
  color: #059669;
}

.stat-icon.purple {
  background: rgba(167, 139, 250, 0.16);
  color: #7c3aed;
}

.stat-icon.orange {
  background: rgba(251, 191, 36, 0.18);
  color: #d97706;
}

.stat-icon.cyan {
  background: rgba(34, 211, 238, 0.16);
  color: #0891b2;
}

.stat-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.stat-card.dark .stat-label {
  color: #94a3b8;
}

.stat-value {
  font-size: 20px;
  font-weight: 650;
  color: #0f172a;
  line-height: 1.1;
  white-space: nowrap;
  word-break: normal;
}

.stat-card.dark .stat-value {
  color: #f8fafc;
}

.stat-value.recent-stats {
  font-size: 17px;
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
}

.stat-sub {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
  white-space: nowrap;
}

.stat-sub.dark {
  color: #64748b;
}

/* Two Column Grid */
.two-column-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  margin-bottom: 28px;
}

@media (max-width: 1280px) {
  .two-column-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}

@media (max-width: 768px) {
  .two-column-grid {
    gap: 18px;
    margin-bottom: 20px;
  }
}

/* Type Badge */
.type-badge {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: calc(100% - 12px);
  border-radius: 999px;
  color: #fff;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  background: rgba(15, 23, 42, 0.54);
  border: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
}

.library-badge {
  top: 12px;
  left: 12px;
  padding: 0.34rem 0.62rem;
  font-size: clamp(0.64rem, 0.24vw + 0.58rem, 0.76rem);
}

.media-badge {
  top: 8px;
  left: 8px;
  padding: 0.24rem 0.48rem;
  font-size: clamp(0.54rem, 0.2vw + 0.5rem, 0.68rem);
  opacity: 1;
  visibility: visible;
  max-width: calc(100% - 16px);
  overflow: hidden;
  text-overflow: ellipsis;
}

.type-badge.movies,
.type-badge.movie {
  background: rgba(37, 99, 235, 0.72);
}

.type-badge.tvshows,
.type-badge.tv {
  background: rgba(124, 58, 237, 0.72);
}

.type-badge.music {
  background: rgba(219, 39, 119, 0.72);
}

@media (max-width: 768px) {
  .library-badge {
    top: 9px;
    left: 9px;
    padding: 0.28rem 0.52rem;
    font-size: 0.66rem;
  }

  .media-badge {
    top: 6px;
    left: 6px;
    padding: 0.2rem 0.4rem;
    font-size: 0.6rem;
    max-width: calc(100% - 12px);
  }
}

@media (max-width: 480px) {
  .type-badge {
    max-width: calc(100% - 8px);
  }

  .library-badge {
    top: 7px;
    left: 7px;
    padding: 0.24rem 0.44rem;
    font-size: 0.6rem;
  }

  .media-badge {
    top: 5px;
    left: 5px;
    padding: 0.18rem 0.36rem;
    font-size: 0.56rem;
    max-width: calc(100% - 10px);
  }
}

/* Libraries Grid */
.libraries-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 280px));
  justify-content: start;
  gap: 16px;
}

@media (max-width: 1400px) {
  .libraries-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
}

@media (max-width: 900px) {
  .libraries-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    justify-content: stretch;
    gap: 12px;
  }
}

@media (max-width: 560px) {
  .libraries-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
}

@media (max-width: 480px) {
  .libraries-grid {
    gap: 8px;
  }
}

.library-card {
  background: rgba(255, 255, 255, 0.54);
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 24px;
  overflow: hidden;
  transition: box-shadow 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

.library-card.dark {
  background: rgba(15, 23, 42, 0.66);
  border-color: rgba(148, 163, 184, 0.16);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.library-card:hover {
  border-color: rgba(148, 163, 184, 0.24);
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.08);
  transform: translateY(-2px);
}

@media (max-width: 1024px) {
  .library-card:hover {
    transform: none;
  }
}

@media (max-width: 768px) {
  .library-card {
    border-radius: 20px;
  }

  .no-library-image svg {
    width: 36px;
    height: 36px;
  }

  .library-overlay {
    padding: 10px 12px;
  }

  .library-name-overlay {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .library-card {
    border-radius: 18px;
  }

  .library-thumb {
    aspect-ratio: 4/3;
  }

  .no-library-image svg {
    width: 30px;
    height: 30px;
  }

  .library-overlay {
    padding: 8px 10px;
  }

  .library-name-overlay {
    font-size: 12px;
  }
}

.library-thumb {
  position: relative;
  aspect-ratio: 16/9;
  background: #e2e8f0;
  line-height: 0;
  font-size: 0;
}

.library-card.dark .library-thumb {
  background: #334155;
}

.library-thumb::after {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 55%;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0) 0%, rgba(15, 23, 42, 0.5) 100%);
  pointer-events: none;
}

.library-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border: none;
}

.no-library-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.no-library-image svg {
  width: 48px;
  height: 48px;
  color: #94a3b8;
}

.library-card.dark .no-library-image svg {
  color: #475569;
}

.library-overlay {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  padding: 12px 14px;
  background: transparent;
  opacity: 1;
}

.library-name-overlay {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  text-align: left;
  text-shadow: 0 3px 16px rgba(15, 23, 42, 0.6);
  letter-spacing: 0.01em;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Items Grid */
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(142px, 1fr));
  gap: 14px;
}

@media (min-width: 1380px) {
  .two-column-grid {
    gap: 22px;
  }

  .items-grid {
    gap: 12px;
  }

  .media-card {
    border-radius: 22px;
  }

  .media-badge {
    top: 7px;
    left: 7px;
    padding: 0.2rem 0.42rem;
    font-size: 0.6rem;
    max-width: calc(100% - 14px);
  }
}


@media (max-width: 1480px) {
  .items-grid {
    grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  }
}

@media (max-width: 1280px) {
  .items-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .items-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
}

@media (max-width: 560px) {
  .items-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
  }
}

@media (max-width: 380px) {
  .items-grid {
    gap: 8px;
  }
}

.media-card {
  background: rgba(255, 255, 255, 0.54);
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 24px;
  overflow: hidden;
  transition: box-shadow 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

.media-card.dark {
  background: rgba(15, 23, 42, 0.66);
  border-color: rgba(148, 163, 184, 0.16);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.media-card:hover {
  border-color: rgba(148, 163, 184, 0.24);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.08);
  transform: translateY(-2px);
}

@media (min-width: 1380px) {
  .media-card:hover {
    box-shadow: 0 14px 28px rgba(15, 23, 42, 0.07);
  }
}

@media (max-width: 768px) {
  .media-card {
    border-radius: 20px;
  }

  .media-card:hover {
    transform: none;
  }
}

.media-poster {
  position: relative;
  aspect-ratio: 2/3;
  background: #e2e8f0;
  line-height: 0;
  font-size: 0;
}

.media-card.dark .media-poster {
  background: #334155;
}

.media-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border: none;
}

.no-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.no-image svg {
  width: 32px;
  height: 32px;
  color: #94a3b8;
}

@media (max-width: 768px) {
  .no-image svg {
    width: 24px;
    height: 24px;
  }
}

.media-card.dark .no-image svg {
  color: #475569;
}

</style>
