<!--
  目录选择器组件
  用于选择115云盘目录
-->
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="dir-picker-overlay" @click.self="close">
        <Transition name="zoom">
          <div v-if="show" class="dir-picker-modal" :class="{ dark: isDark }">
            <div class="dir-picker-header">
              <h3>选择目录</h3>
              <button class="btn-close" :class="{ dark: isDark }" @click="close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div class="dir-picker-breadcrumb" :class="{ dark: isDark }">
              <span
                class="breadcrumb-item"
                :class="{ dark: isDark }"
                @click="navigateTo('0')"
              >
                根目录
              </span>
              <span v-for="(item, index) in currentPath" :key="item.cid" class="breadcrumb-separator">/</span>
              <span
                v-for="(item, index) in currentPath"
                :key="item.cid"
                class="breadcrumb-item"
                :class="{ dark: isDark }"
                @click="navigateTo(item.cid)"
              >
                {{ item.name }}
              </span>
            </div>

            <div class="dir-picker-content">
              <div v-if="loading" class="dir-picker-loading">
                <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
                </svg>
                <p>加载中...</p>
              </div>

              <div v-else-if="error" class="dir-picker-error">
                <p>{{ error }}</p>
                <button class="btn btn-primary" @click="loadFiles">重试</button>
              </div>

              <div v-else-if="directories.length === 0" class="dir-picker-empty">
                <p>当前目录没有子目录</p>
              </div>

              <div v-else class="dir-picker-list">
                <div
                  v-for="dir in directories"
                  :key="dir.cid"
                  class="dir-item"
                  :class="{ dark: isDark }"
                  @click="selectDirectory(dir)"
                  @dblclick="enterDirectory(dir)"
                >
                  <svg class="dir-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                  </svg>
                  <span class="dir-name">{{ dir.name }}</span>
                  <svg class="dir-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </div>
            </div>

            <div class="dir-picker-footer">
              <div class="selected-path" :class="{ dark: isDark }">
                已选择: {{ selectedPath || '未选择' }}
              </div>
              <div class="footer-buttons">
                <button class="btn btn-secondary" :class="{ dark: isDark }" @click="close">取消</button>
                <button class="btn btn-primary" @click="confirm" :disabled="!selectedPath">确定</button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

interface Directory {
  cid: string
  name: string
  is_dir: boolean
}

interface PathItem {
  cid: string
  name: string
}

const props = defineProps<{
  show: boolean
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'update:modelValue', value: string): void
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

const loading = ref(false)
const error = ref('')
const directories = ref<Directory[]>([])
const currentPath = ref<PathItem[]>([])
const currentCid = ref('0')
const selectedPath = ref('')
const selectedCid = ref('')

watch(() => props.show, (newVal) => {
  if (newVal) {
    loadFiles()
  }
})

async function loadFiles() {
  loading.value = true
  error.value = ''

  try {
    const response = await $fetch(`/api/pan115/fs_files_115?cid=${currentCid.value}`) as any

    if (response.success && response.files) {
      directories.value = response.files.filter((f: Directory) => f.is_dir)
      if (response.path) {
        currentPath.value = response.path.slice(1)
      }
    } else {
      error.value = response.error || '加载失败'
    }
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function navigateTo(cid: string) {
  if (cid === '0') {
    currentCid.value = '0'
    currentPath.value = []
  } else {
    const index = currentPath.value.findIndex(p => p.cid === cid)
    if (index >= 0) {
      currentCid.value = cid
      currentPath.value = currentPath.value.slice(0, index + 1)
    }
  }
  selectedPath.value = ''
  selectedCid.value = ''
  loadFiles()
}

function selectDirectory(dir: Directory) {
  const pathParts = currentPath.value.map(p => p.name)
  pathParts.push(dir.name)
  selectedPath.value = '/' + pathParts.join('/')
  selectedCid.value = dir.cid
}

function enterDirectory(dir: Directory) {
  currentCid.value = dir.cid
  currentPath.value.push({ cid: dir.cid, name: dir.name })
  selectedPath.value = ''
  selectedCid.value = ''
  loadFiles()
}

function close() {
  emit('update:show', false)
}

function confirm() {
  if (selectedPath.value) {
    emit('update:modelValue', selectedPath.value)
    close()
  }
}
</script>

<style scoped>
.dir-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dir-picker-modal {
  background: white;
  border-radius: 12px;
  width: 500px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
}

.dir-picker-modal.dark {
  background: #1f2937;
}

.dir-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.dir-picker-modal.dark .dir-picker-header {
  border-bottom-color: #374151;
}

.dir-picker-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.dir-picker-modal.dark .dir-picker-header h3 {
  color: #f9fafb;
}

.btn-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #6b7280;
  transition: all 0.2s;
}

.btn-close:hover {
  background: #f3f4f6;
  color: #111827;
}

.btn-close.dark:hover {
  background: #374151;
  color: #f9fafb;
}

.btn-close svg {
  width: 18px;
  height: 18px;
}

.dir-picker-breadcrumb {
  padding: 12px 20px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  font-size: 14px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.dir-picker-breadcrumb.dark {
  background: #111827;
  border-bottom-color: #374151;
}

.breadcrumb-item {
  color: #3b82f6;
  cursor: pointer;
  transition: color 0.2s;
}

.breadcrumb-item:hover {
  color: #2563eb;
  text-decoration: underline;
}

.breadcrumb-item.dark {
  color: #60a5fa;
}

.breadcrumb-item.dark:hover {
  color: #93c5fd;
}

.breadcrumb-separator {
  color: #9ca3af;
}

.dir-picker-content {
  flex: 1;
  overflow-y: auto;
  min-height: 200px;
  max-height: 400px;
}

.dir-picker-loading,
.dir-picker-error,
.dir-picker-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #6b7280;
}

.dir-picker-loading p,
.dir-picker-error p,
.dir-picker-empty p {
  margin: 12px 0 0 0;
}

.spin {
  width: 32px;
  height: 32px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.dir-picker-list {
  padding: 8px;
}

.dir-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.dir-item:hover {
  background: #f3f4f6;
}

.dir-item.dark:hover {
  background: #374151;
}

.dir-icon {
  width: 20px;
  height: 20px;
  color: #fbbf24;
  flex-shrink: 0;
}

.dir-name {
  flex: 1;
  margin-left: 12px;
  font-size: 14px;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dir-item.dark .dir-name {
  color: #f9fafb;
}

.dir-arrow {
  width: 16px;
  height: 16px;
  color: #9ca3af;
  flex-shrink: 0;
}

.dir-picker-footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dir-picker-modal.dark .dir-picker-footer {
  border-top-color: #374151;
}

.selected-path {
  font-size: 13px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.selected-path.dark {
  color: #9ca3af;
}

.footer-buttons {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-secondary.dark {
  background: #374151;
  color: #f9fafb;
}

.btn-secondary.dark:hover {
  background: #4b5563;
}

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
  .dir-picker-modal {
    width: 95vw;
    max-height: 85vh;
    margin: 0 10px;
  }

  .dir-picker-header {
    padding: 12px 16px;
  }

  .dir-picker-header h3 {
    font-size: 16px;
  }

  .dir-picker-breadcrumb {
    padding: 10px 16px;
    font-size: 13px;
  }

  .dir-picker-content {
    min-height: 150px;
    max-height: 300px;
  }

  .dir-item {
    padding: 10px 12px;
  }

  .dir-name {
    font-size: 13px;
  }

  .dir-picker-footer {
    padding: 12px 16px;
    flex-direction: column;
    gap: 10px;
  }

  .selected-path {
    max-width: 100%;
    font-size: 12px;
  }

  .footer-buttons {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
