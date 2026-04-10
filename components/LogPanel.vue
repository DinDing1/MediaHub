<!--
  日志面板组件
  显示系统日志，居中弹窗显示，支持实时更新
-->
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="log-panel-overlay" @click.self="close">
        <Transition name="zoom">
          <div v-if="visible" class="log-panel" :class="{ dark: isDark }">
            <div class="log-header">
              <h3>日志中心</h3>
              <div class="log-actions">
                <label class="auto-refresh">
                  <input type="checkbox" v-model="autoRefresh" />
                  <span>自动刷新</span>
                </label>
                <button class="btn-clear" :class="{ dark: isDark }" @click="clearLogs">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  清空
                </button>
                <button class="btn-close" :class="{ dark: isDark }" @click="close">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div class="log-filter">
              <select v-model="filterLevel" class="filter-select" :class="{ dark: isDark }">
                <option value="all">全部</option>
                <option value="info">信息</option>
                <option value="success">成功</option>
                <option value="warn">警告</option>
                <option value="error">错误</option>
              </select>
              <select v-model="filterModule" class="filter-select" :class="{ dark: isDark }">
                <option value="all">全部模块</option>
                <option v-for="mod in modules" :key="mod" :value="mod">{{ mod }}</option>
              </select>
            </div>

            <div class="log-content" ref="logContent">
              <div v-if="filteredLogs.length === 0" class="log-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <p>暂无日志</p>
              </div>
              <div v-else class="log-list">
                <div 
                  v-for="log in filteredLogs" 
                  :key="log.id" 
                  class="log-item"
                  :class="[log.level, { dark: isDark }]"
                >
                  <div class="log-item-header">
                    <span class="log-level" :class="log.level">{{ levelText(log.level) }}</span>
                    <span class="log-module">{{ log.module }}</span>
                    <span class="log-time">{{ log.timestamp }}</span>
                  </div>
                  <div class="log-message">{{ log.message }}</div>
                  <div v-if="log.details" class="log-details">{{ log.details }}</div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'

interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'success'
  module: string
  message: string
  details?: string
}

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const colorMode = useColorMode()
const isDark = ref(false)

onMounted(() => {
  isDark.value = colorMode.value === 'dark'
})

watch(
  () => colorMode.value,
  (newVal) => {
    isDark.value = newVal === 'dark'
  }
)

const logs = ref<LogEntry[]>([])
const filterLevel = ref('all')
const filterModule = ref('all')
const logContent = ref<HTMLElement | null>(null)
const autoRefresh = ref(true)
let refreshTimer: NodeJS.Timeout | null = null

const modules = computed(() => {
  const mods = new Set(logs.value.map(l => l.module))
  return Array.from(mods)
})

const filteredLogs = computed(() => {
  let result = logs.value
  if (filterLevel.value !== 'all') {
    result = result.filter(l => l.level === filterLevel.value)
  }
  if (filterModule.value !== 'all') {
    result = result.filter(l => l.module === filterModule.value)
  }
  return result
})

function levelText(level: string): string {
  const map: Record<string, string> = {
    info: '信息',
    success: '成功',
    warn: '警告',
    error: '错误'
  }
  return map[level] || level
}

async function loadLogs(forceRefresh: boolean = false) {
  try {
    const url = forceRefresh ? '/api/logs?force=true' : '/api/logs'
    const response = await $fetch(url) as any
    if (response.success) {
      logs.value = response.data || []
    }
  } catch (e) {
    // 忽略错误
  }
}

async function clearLogs() {
  try {
    await $fetch('/api/logs', { method: 'DELETE' })
    logs.value = []
  } catch (e) {
    // 忽略错误
  }
}

function close() {
  emit('close')
}

function startAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
  if (autoRefresh.value) {
    refreshTimer = setInterval(() => {
      loadLogs()
    }, 2000)
  }
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    loadLogs(true)
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
})

watch(autoRefresh, (val) => {
  if (val && props.visible) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.log-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.log-panel {
  width: 640px;
  max-width: 90vw;
  height: 70vh;
  max-height: 600px;
  background: #ffffff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.log-panel.dark {
  background: #1e293b;
}

.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.log-panel.dark .log-header {
  border-bottom-color: #334155;
}

.log-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.log-panel.dark .log-header h3 {
  color: #f1f5f9;
}

.log-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.auto-refresh {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #64748b;
  cursor: pointer;
}

.auto-refresh input {
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.btn-clear {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #ffffff;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-clear.dark {
  background: #334155;
  border-color: #475569;
  color: #94a3b8;
}

.btn-clear:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.btn-clear.dark:hover {
  background: #475569;
}

.btn-clear svg {
  width: 14px;
  height: 14px;
}

.btn-close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-close.dark {
  color: #94a3b8;
}

.btn-close:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.btn-close.dark:hover {
  background: #334155;
  color: #f1f5f9;
}

.btn-close svg {
  width: 18px;
  height: 18px;
}

.log-filter {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.log-panel.dark .log-filter {
  border-bottom-color: #334155;
}

.filter-select {
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #ffffff;
  color: #1e293b;
  font-size: 13px;
  cursor: pointer;
}

.filter-select.dark {
  background: #334155;
  border-color: #475569;
  color: #f1f5f9;
}

.log-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.log-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #94a3b8;
}

.log-empty svg {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.log-empty p {
  margin: 0;
  font-size: 14px;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-item {
  padding: 10px 12px;
  border-radius: 8px;
  background: #f8fafc;
  border-left: 3px solid #94a3b8;
}

.log-item.dark {
  background: #334155;
}

.log-item.info {
  border-left-color: #3b82f6;
}

.log-item.success {
  border-left-color: #10b981;
}

.log-item.warn {
  border-left-color: #f59e0b;
}

.log-item.error {
  border-left-color: #ef4444;
}

.log-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.log-level {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.log-level.info {
  background: #dbeafe;
  color: #1d4ed8;
}

.log-level.success {
  background: #d1fae5;
  color: #065f46;
}

.log-level.warn {
  background: #fef3c7;
  color: #92400e;
}

.log-level.error {
  background: #fee2e2;
  color: #991b1b;
}

.log-module {
  font-size: 12px;
  color: #64748b;
  background: #e2e8f0;
  padding: 2px 6px;
  border-radius: 4px;
}

.log-item.dark .log-module {
  background: #475569;
  color: #cbd5e1;
}

.log-time {
  font-size: 11px;
  color: #94a3b8;
  margin-left: auto;
}

.log-message {
  font-size: 13px;
  color: #1e293b;
  line-height: 1.5;
}

.log-item.dark .log-message {
  color: #f1f5f9;
}

.log-details {
  margin-top: 6px;
  padding: 8px;
  background: #ffffff;
  border-radius: 4px;
  font-size: 12px;
  color: #64748b;
  font-family: monospace;
  word-break: break-all;
}

.log-item.dark .log-details {
  background: #1e293b;
  color: #94a3b8;
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.zoom-enter-active,
.zoom-leave-active {
  transition: all 0.2s ease;
}

.zoom-enter-from,
.zoom-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* 移动端响应式 */
@media (max-width: 768px) {
  .log-panel {
    width: 95vw;
    height: 80vh;
    max-height: none;
    margin: 0 10px;
  }

  .log-header {
    padding: 12px 16px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .log-header h3 {
    font-size: 15px;
  }

  .log-actions {
    width: 100%;
    justify-content: space-between;
  }

  .log-filter {
    padding: 10px 16px;
    flex-wrap: wrap;
  }

  .filter-select {
    flex: 1;
    min-width: 100px;
  }

  .log-content {
    padding: 10px;
  }

  .log-item {
    padding: 8px 10px;
  }

  .log-item-header {
    flex-wrap: wrap;
    gap: 6px;
  }

  .log-time {
    margin-left: 0;
    width: 100%;
    margin-top: 4px;
  }
}
</style>
