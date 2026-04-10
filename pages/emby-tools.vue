<template>
  <div class="emby-tools-page" :class="{ dark: isDark }">
    <div class="content-shell" :class="{ dark: isDark }">
      <div class="tabs-toolbar" :class="{ dark: isDark }">
        <div class="tabs-nav" :class="{ dark: isDark }">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-btn"
            :class="{ active: activeTab === tab.id, dark: isDark }"
            @click="activeTab = tab.id"
          >
            <span class="tab-icon-wrap">
              <component :is="tab.icon" />
            </span>
            <span class="tab-labels">
              <span class="tab-name">{{ tab.name }}</span>
              <span class="tab-desc">{{ tab.desc }}</span>
            </span>
          </button>
        </div>
      </div>

      <div class="tabs-content" :class="{ dark: isDark }">
        <div v-if="activeTab === 'missing'" class="tab-panel">
          <MissingDetectionTab :is-dark="isDark" />
        </div>

        <div v-else-if="activeTab === 'duplicates'" class="tab-panel">
          <DuplicatesTab :is-dark="isDark" />
        </div>

        <div v-else-if="activeTab === 'cover'" class="tab-panel">
          <CoverGeneratorTab :is-dark="isDark" />
        </div>

        <div v-else-if="activeTab === 'media-info'" class="tab-panel">
          <MediaInfoTab :is-dark="isDark" />
        </div>

        <div v-else-if="activeTab === 'webhook'" class="tab-panel">
          <WebhookTab :is-dark="isDark" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, h } from 'vue'
import MissingDetectionTab from '~/components/emby/MissingDetectionTab.vue'
import DuplicatesTab from '~/components/emby/DuplicatesTab.vue'
import CoverGeneratorTab from '~/components/emby/CoverGeneratorTab.vue'
import MediaInfoTab from '~/components/emby/MediaInfoTab.vue'
import WebhookTab from '~/components/emby/WebhookTab.vue'

useHead({
  title: 'MediaHub'
})

const colorMode = useColorMode()
const isDark = ref(false)
const activeTab = ref('media-info')

const MissingIcon = () => h('svg', {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round'
}, [
  h('circle', { cx: '11', cy: '11', r: '8' }),
  h('line', { x1: '21', y1: '21', x2: '16.65', y2: '16.65' }),
  h('line', { x1: '8', y1: '11', x2: '14', y2: '11' })
])

const DuplicatesIcon = () => h('svg', {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round'
}, [
  h('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2', ry: '2' }),
  h('line', { x1: '3', y1: '9', x2: '21', y2: '9' }),
  h('line', { x1: '9', y1: '21', x2: '9', y2: '9' })
])

const CoverIcon = () => h('svg', {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round'
}, [
  h('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2', ry: '2' }),
  h('circle', { cx: '8.5', cy: '8.5', r: '1.5' }),
  h('polyline', { points: '21 15 16 10 5 21' })
])

const MediaInfoIcon = () => h('svg', {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round'
}, [
  h('circle', { cx: '12', cy: '12', r: '9' }),
  h('path', { d: 'M12 7v5l3 3' }),
  h('path', { d: 'M8 12h.01' }),
  h('path', { d: 'M12 16h.01' }),
  h('path', { d: 'M16 9h.01' })
])

const WebhookIcon = () => h('svg', {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round'
}, [
  h('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
  h('polyline', { points: '17 8 12 3 7 8' }),
  h('line', { x1: '12', y1: '3', x2: '12', y2: '15' })
])

const tabs = [
  { id: 'media-info', name: '媒体信息', desc: '流信息补齐', icon: MediaInfoIcon },
  { id: 'cover', name: '封面生成', desc: '库封美化', icon: CoverIcon },
  { id: 'duplicates', name: '剧集查重', desc: '重复清理', icon: DuplicatesIcon },
  { id: 'missing', name: '缺失检测', desc: '补剧排查', icon: MissingIcon },
  { id: 'webhook', name: 'Webhook', desc: '通知联动', icon: WebhookIcon }
]

onMounted(() => {
  isDark.value = colorMode.value === 'dark'
})

watch(
  () => colorMode.value,
  (newVal) => {
    isDark.value = newVal === 'dark'
  }
)
</script>

<style scoped>
.emby-tools-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.content-shell {
  border-radius: 30px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.58);
  box-shadow:
    0 22px 54px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(24px);
  overflow: hidden;
}

.content-shell.dark {
  border-color: rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.52);
  box-shadow:
    0 22px 54px rgba(2, 6, 23, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.tabs-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 14px 0;
}


.tabs-nav {
  display: inline-flex;
  align-items: stretch;
  gap: 6px;
  width: 100%;
  max-width: 100%;
  padding: 6px;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.5);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    0 10px 24px rgba(15, 23, 42, 0.04);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.tabs-nav.dark {
  border-color: rgba(148, 163, 184, 0.14);
  background: rgba(15, 23, 42, 0.34);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 12px 28px rgba(2, 6, 23, 0.18);
}

.tabs-nav::-webkit-scrollbar {
  display: none;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 52px;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 16px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  white-space: nowrap;
}

.tab-btn.dark {
  color: #94a3b8;
}

.tab-btn:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.66);
  color: #0f172a;
}

.tab-btn.dark:hover {
  background: rgba(30, 41, 59, 0.68);
  color: #f8fafc;
}

.tab-btn.active {
  border-color: rgba(148, 163, 184, 0.14);
  background: rgba(255, 255, 255, 0.9);
  color: #0f172a;
  box-shadow:
    0 8px 18px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.tab-btn.active.dark {
  border-color: rgba(96, 165, 250, 0.18);
  background: rgba(30, 41, 59, 0.9);
  color: #eff6ff;
  box-shadow:
    0 12px 24px rgba(2, 6, 23, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.tab-icon-wrap {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background: rgba(226, 232, 240, 0.64);
  color: inherit;
  flex-shrink: 0;
}

.tab-btn.dark .tab-icon-wrap {
  background: rgba(51, 65, 85, 0.62);
}

.tab-btn.active .tab-icon-wrap {
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.88) 0%, rgba(37, 99, 235, 0.92) 100%);
  color: #ffffff;
  box-shadow: 0 8px 16px rgba(37, 99, 235, 0.18);
}

.tab-btn.active.dark .tab-icon-wrap {
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.94) 0%, rgba(29, 78, 216, 0.96) 100%);
}

.tab-icon-wrap :deep(svg) {
  width: 18px;
  height: 18px;
}

.tab-labels {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
}

.tab-name {
  font-size: 13px;
  font-weight: 650;
  line-height: 1.2;
}

.tab-desc {
  font-size: 10px;
  line-height: 1.2;
  color: #94a3b8;
}

.tab-btn.active .tab-desc {
  color: #64748b;
}

.tab-btn.active.dark .tab-desc {
  color: #94a3b8;
}

.tabs-content {
  padding: 16px;
}

.tabs-content.dark {
  color: #e2e8f0;
}

.tab-panel {
  min-height: 420px;
}

:deep(.section-box) {
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.74);
  background: rgba(255, 255, 255, 0.62);
  box-shadow:
    0 18px 42px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(22px);
  overflow: hidden;
}

:deep(.section-box.dark) {
  border-color: rgba(148, 163, 184, 0.14);
  background: rgba(15, 23, 42, 0.54);
  box-shadow:
    0 18px 42px rgba(2, 6, 23, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

:deep(.section-box-header) {
  padding: 16px 18px;
  border-bottom-color: rgba(226, 232, 240, 0.62);
}

:deep(.section-box.dark .section-box-header) {
  border-bottom-color: rgba(71, 85, 105, 0.38);
}

:deep(.section-box-title) {
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

:deep(.section-box-desc),
:deep(.section-box-desc.dark) {
  font-size: 12px;
  line-height: 1.5;
}

:deep(.section-box-content) {
  padding: 16px 18px;
}

:deep(.header-right),
:deep(.filter-right),
:deep(.action-row) {
  gap: 8px;
}

:deep(.header-left),
:deep(.header-text) {
  min-width: 0;
}

:deep(.form-input),
:deep(.form-select) {
  min-height: 38px;
  border-radius: 14px;
  border-color: rgba(226, 232, 240, 0.82);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
}

:deep(.form-input.dark),
:deep(.form-select.dark) {
  border-color: rgba(71, 85, 105, 0.54);
  background: rgba(30, 41, 59, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

:deep(.form-input:focus),
:deep(.form-select:focus) {
  border-color: rgba(96, 165, 250, 0.8);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

:deep(.btn) {
  min-height: 36px;
  padding: 0 13px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 600;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

:deep(.btn:hover:not(:disabled)) {
  transform: translateY(-1px);
}

:deep(.btn-primary),
:deep(.btn-success),
:deep(.btn-copy) {
  border: 1px solid rgba(147, 197, 253, 0.28);
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 38%, #2563eb 100%);
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

:deep(.btn-primary:hover:not(:disabled)),
:deep(.btn-success:hover:not(:disabled)),
:deep(.btn-copy:hover:not(:disabled)) {
  box-shadow: 0 16px 28px rgba(37, 99, 235, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.28);
}

:deep(.btn-secondary),
:deep(.btn-outline) {
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: rgba(255, 255, 255, 0.72);
  color: #475569;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
}

:deep(.btn-secondary:hover:not(:disabled)),
:deep(.btn-outline:hover:not(:disabled)) {
  border-color: rgba(96, 165, 250, 0.24);
  background: rgba(255, 255, 255, 0.92);
  color: #1e293b;
}

:deep(.btn-danger),
:deep(.btn-remove-correction) {
  border: 1px solid rgba(248, 113, 113, 0.2);
  background: rgba(254, 242, 242, 0.86);
  color: #dc2626;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

:deep(.btn-danger:hover:not(:disabled)),
:deep(.btn-remove-correction:hover:not(:disabled)) {
  background: rgba(254, 226, 226, 0.96);
  box-shadow: 0 12px 24px rgba(239, 68, 68, 0.14);
}

:deep(.btn-correction) {
  border: 1px solid rgba(167, 139, 250, 0.24);
  background: rgba(245, 243, 255, 0.88);
  color: #7c3aed;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
}

:deep(.btn-correction:hover:not(:disabled)) {
  background: rgba(237, 233, 254, 0.96);
  box-shadow: 0 12px 24px rgba(124, 58, 237, 0.12);
}

:deep(.btn-sm) {
  min-height: 34px;
  padding: 0 11px;
  font-size: 12px;
}

:deep(.btn-lg) {
  min-height: 38px;
  font-size: 13px;
}

:deep(.progress-tag),
:deep(.count-tag),
:deep(.selected-badge),
:deep(.status-tag) {
  min-height: 26px;
  padding: 0 11px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

:deep(.stat-item),
:deep(.status-card) {
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.76);
  background: rgba(248, 250, 252, 0.68);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.64);
}

:deep(.stat-item.dark),
:deep(.status-card.dark) {
  border-color: rgba(71, 85, 105, 0.48);
  background: rgba(15, 23, 42, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

:deep(.show-card),
:deep(.duplicate-card),
:deep(.series-group),
:deep(.log-card),
:deep(.url-box),
:deep(.preview-container),
:deep(.mode-chip) {
  border-radius: 18px;
}

:deep(.show-card),
:deep(.duplicate-card),
:deep(.series-group),
:deep(.log-card),
:deep(.url-box),
:deep(.preview-container) {
  border-color: rgba(226, 232, 240, 0.72);
  background: rgba(248, 250, 252, 0.7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

:deep(.show-card.dark),
:deep(.duplicate-card.dark),
:deep(.series-group.dark),
:deep(.log-card.dark),
:deep(.url-box.dark) {
  border-color: rgba(71, 85, 105, 0.44);
  background: rgba(15, 23, 42, 0.56);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

:deep(.empty-container) {
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.62) 0%, rgba(248, 250, 252, 0.82) 100%);
  border: 1px dashed rgba(191, 219, 254, 0.56);
}

:deep(.empty-container.dark) {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.46) 0%, rgba(2, 6, 23, 0.56) 100%);
  border-color: rgba(96, 165, 250, 0.18);
}

:deep(.mode-chip) {
  border-color: rgba(226, 232, 240, 0.82);
  background: rgba(255, 255, 255, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.64);
}

:deep(.mode-chip.dark) {
  border-color: rgba(71, 85, 105, 0.46);
  background: rgba(30, 41, 59, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

:deep(.mode-chip.active) {
  border-color: rgba(96, 165, 250, 0.22);
  background: rgba(239, 246, 255, 0.96);
  box-shadow: 0 12px 24px rgba(59, 130, 246, 0.12);
}

:deep(.header-icon),
:deep(.step-badge) {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

@media (max-width: 1024px) {
  .content-shell {
    border-radius: 26px;
  }
}

@media (max-width: 768px) {
  .emby-tools-page {
    gap: 14px;
  }

  .content-shell {
    border-radius: 24px;
  }

  .tabs-toolbar {
    padding: 12px 12px 0;
  }

  .tabs-nav {
    width: 100%;
    gap: 5px;
    padding: 5px;
    border-radius: 18px;
  }

  .tab-btn {
    min-height: 46px;
    padding: 7px 10px;
    border-radius: 14px;
    gap: 7px;
  }

  .tab-icon-wrap {
    width: 28px;
    height: 28px;
    border-radius: 9px;
  }

  .tab-icon-wrap :deep(svg) {
    width: 15px;
    height: 15px;
  }

  .tab-name {
    font-size: 12px;
  }

  .tab-desc {
    font-size: 10px;
  }

  .tabs-content {
    padding: 12px;
  }

  .tab-panel {
    min-height: 300px;
  }
}

@media (max-width: 520px) {
  .tabs-nav {
    justify-content: flex-start;
  }

  .tab-btn {
    min-width: 112px;
    padding: 7px 10px;
  }

  .tab-labels {
    gap: 1px;
  }

  .tab-desc {
    display: none;
  }
}
</style>

