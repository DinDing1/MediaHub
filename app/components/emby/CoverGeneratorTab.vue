<template>
  <div class="cover-tab">
    <div class="main-grid">
      <div class="config-panel">
        <div class="section-box" :class="{ dark: isDark }">
          <div class="section-box-header">
            <div class="header-left">
              <div class="header-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
              <div class="header-text">
                <h2 class="section-box-title">封面生成器</h2>
                <span class="section-box-desc" :class="{ dark: isDark }">为媒体库生成精美的自定义封面</span>
              </div>
            </div>
          </div>
          <div class="section-box-content">
            <div class="form-section compact">
              <div class="form-section-title" :class="{ dark: isDark }">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <span>媒体库</span>
              </div>
              <div class="form-group">
                <div class="select-wrapper">
                  <select v-model="selectedLibrary" class="form-select" :class="{ dark: isDark }" :disabled="isLoadingLibraries">
                    <option value="">{{ isLoadingLibraries ? '加载中...' : '选择媒体库' }}</option>
                    <option v-for="lib in libraries" :key="lib.Id" :value="lib.Id">
                      {{ lib.Name }} · {{ lib.TypeLabel }}
                    </option>
                  </select>
                  <svg v-if="!isLoadingLibraries" class="select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                  <svg v-else class="select-arrow spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
                  </svg>
                </div>
                <div v-if="configError" class="error-message" :class="{ dark: isDark }">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span>{{ configError }}</span>
                </div>
              </div>
            </div>

            <div class="form-section compact">
              <div class="form-section-title" :class="{ dark: isDark }">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 7V4h16v3"/>
                  <path d="M9 20h6"/>
                  <path d="M12 4v16"/>
                </svg>
                <span>标题</span>
              </div>
              <div class="form-row">
                <div class="form-group half">
                  <label class="form-label" :class="{ dark: isDark }">中文</label>
                  <input 
                    v-model="zhTitle" 
                    type="text" 
                    class="form-input" 
                    :class="{ dark: isDark }"
                    placeholder="留空则使用媒体库名称"
                  />
                </div>
                <div class="form-group half">
                  <label class="form-label" :class="{ dark: isDark }">英文</label>
                  <input 
                    v-model="enTitle" 
                    type="text" 
                    class="form-input" 
                    :class="{ dark: isDark }"
                    placeholder="可选"
                  />
                </div>
              </div>
            </div>

            <div class="form-section compact">
              <div class="form-section-title" :class="{ dark: isDark }">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                <span>字体</span>
              </div>
              <div v-if="fontError" class="error-message" :class="{ dark: isDark }">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{{ fontError }}</span>
              </div>
              <div class="form-row">
                <div class="form-group half">
                  <label class="form-label" :class="{ dark: isDark }">中文</label>
                  <div class="select-wrapper">
                    <select v-model="zhFont" class="form-select" :class="{ dark: isDark }" :disabled="isLoadingFonts || zhFonts.length === 0">
                      <option value="">{{ isLoadingFonts ? '加载中...' : (zhFonts.length === 0 ? '无可用字体' : '请选择') }}</option>
                      <option v-for="font in zhFonts" :key="font.id" :value="font.id">
                        {{ font.name }}
                      </option>
                    </select>
                    <svg v-if="!isLoadingFonts" class="select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                    <svg v-else class="select-arrow spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
                    </svg>
                  </div>
                </div>
                <div class="form-group half">
                  <label class="form-label" :class="{ dark: isDark }">英文</label>
                  <div class="select-wrapper">
                    <select v-model="enFont" class="form-select" :class="{ dark: isDark }" :disabled="isLoadingFonts || enFonts.length === 0">
                      <option value="">{{ isLoadingFonts ? '加载中...' : (enFonts.length === 0 ? '无可用字体' : '请选择') }}</option>
                      <option v-for="font in enFonts" :key="font.id" :value="font.id">
                        {{ font.name }}
                      </option>
                    </select>
                    <svg v-if="!isLoadingFonts" class="select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                    <svg v-else class="select-arrow spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-section compact">
              <div class="form-section-title" :class="{ dark: isDark }">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span>图片选择</span>
              </div>
              <div class="mode-chips">
                <label
                  v-for="m in modeOptions"
                  :key="m.value"
                  class="mode-chip"
                  :class="{ active: mode === m.value, dark: isDark }"
                  :title="m.desc"
                >
                  <input type="radio" v-model="mode" :value="m.value" />
                  <span class="chip-text">{{ m.label }}</span>
                </label>
              </div>
            </div>

            <div class="action-row">
              <button 
                class="btn btn-primary btn-lg"
                :disabled="isGenerating || !selectedLibrary"
                @click="generatePreview"
              >
                <svg v-if="isGenerating" class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <span>{{ isGenerating ? '生成中...' : '生成预览' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="preview-panel">
        <div class="section-box" :class="{ dark: isDark }">
          <div class="section-box-header">
            <div class="header-left">
              <div class="header-icon preview-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </div>
              <div class="header-text">
                <h2 class="section-box-title">封面预览</h2>
                <span class="section-box-desc" :class="{ dark: isDark }">实时预览生成的封面效果</span>
              </div>
            </div>
          </div>
          <div class="section-box-content">
            <div v-if="previewImage" class="preview-container">
              <div class="preview-image-wrapper">
                <img :src="`data:image/jpeg;base64,${previewImage}`" alt="封面预览" class="preview-image" />
                <div class="preview-overlay">
                  <button class="btn btn-icon" @click="generatePreview" title="重新生成" :disabled="isGenerating">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="23 4 23 10 17 10"/>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="preview-footer">
                <div class="preview-info" :class="{ dark: isDark }">
                  <div class="info-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    </svg>
                    <span>{{ imageSize.width }} x {{ imageSize.height }}</span>
                  </div>
                </div>
                <button class="btn btn-success" @click="saveCover" :disabled="isSaving">
                  <svg v-if="isSaving" class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                  </svg>
                  <span>{{ isSaving ? '保存中...' : '应用封面' }}</span>
                </button>
              </div>
            </div>
            
            <div v-else class="empty-container">
              <div class="empty-illustration">
                <div class="empty-bg" :class="{ dark: isDark }"></div>
                <div class="empty-icon-wrapper">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
              </div>
              <h3 class="empty-title" :class="{ dark: isDark }">准备生成封面</h3>
              <p class="empty-desc" :class="{ dark: isDark }">选择媒体库并配置参数后<br/>点击"生成预览"按钮</p>
              <div class="empty-steps" :class="{ dark: isDark }">
                <div class="step">
                  <span class="step-num">1</span>
                  <span class="step-text">选择媒体库</span>
                </div>
                <div class="step-line"></div>
                <div class="step">
                  <span class="step-num">2</span>
                  <span class="step-text">配置参数</span>
                </div>
                <div class="step-line"></div>
                <div class="step">
                  <span class="step-num">3</span>
                  <span class="step-text">生成预览</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Props {
  isDark: boolean
}

const props = defineProps<Props>()

const libraries = ref<any[]>([])
const selectedLibrary = ref('')
const zhTitle = ref('')
const enTitle = ref('')
const zhFont = ref('zh_lxgwwenkai')
const enFont = ref('en_montserrat_bold')
const mode = ref('random')

const zhFonts = ref<any[]>([])
const enFonts = ref<any[]>([])

const isGenerating = ref(false)
const isSaving = ref(false)
const previewImage = ref('')
const imageSize = ref({ width: 0, height: 0 })

const isLoadingLibraries = ref(false)
const isLoadingFonts = ref(false)
const configError = ref('')
const fontError = ref('')

const modeOptions = [
  {
    value: 'random',
    label: '随机选择',
    desc: '从媒体库随机选择图片'
  },
  {
    value: 'tmdb_rating',
    label: 'TMDB评分',
    desc: '按评分从高到低选择'
  },
  {
    value: 'premiere_date',
    label: '上映日期',
    desc: '按上映日期排序选择'
  },
  {
    value: 'recent_added',
    label: '最近添加',
    desc: '按添加时间排序选择'
  }
]

const loadLibraries = async () => {
  isLoadingLibraries.value = true
  configError.value = ''
  try {
    const res = await fetch('/api/emby/libraries')
    if (res.ok) {
      const data = await res.json()
      if (data.success) {
        libraries.value = data.data || []
        if (libraries.value.length === 0) {
          configError.value = '没有找到媒体库，请检查Emby配置'
        }
      } else {
        configError.value = data.error || '获取媒体库失败'
        if (data.error === 'Emby未配置' || !data.hasConfig) {
          configError.value = 'Emby未配置，请先在设置页面配置Emby连接信息'
        }
      }
    }
  } catch (e) {
    console.error('加载媒体库失败:', e)
    configError.value = '网络错误，请检查服务器连接'
  } finally {
    isLoadingLibraries.value = false
  }
}

const loadFonts = async () => {
  isLoadingFonts.value = true
  fontError.value = ''
  try {
    const res = await fetch('/api/emby/cover/fonts')
    if (res.ok) {
      const data = await res.json()
      if (data.success) {
        zhFonts.value = data.zh || []
        enFonts.value = data.en || []
        if (data.defaults) {
          zhFont.value = data.defaults.zh || 'zh_lxgwwenkai'
          enFont.value = data.defaults.en || 'en_montserrat_bold'
        }
        if (zhFonts.value.length === 0 && enFonts.value.length === 0) {
          fontError.value = '没有找到可用字体，请检查fonts目录'
        }
      }
    }
  } catch (e) {
    console.error('加载字体失败:', e)
    fontError.value = '网络错误，请检查服务器连接'
  } finally {
    isLoadingFonts.value = false
  }
}

const generatePreview = async () => {
  if (!selectedLibrary.value) return
  
  isGenerating.value = true
  previewImage.value = ''
  
  try {
    const res = await fetch('/api/emby/cover/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        library_id: selectedLibrary.value,
        zh_font: zhFont.value,
        en_font: enFont.value,
        zh_title: zhTitle.value,
        en_title: enTitle.value,
        mode: mode.value
      })
    })
    
    if (res.ok) {
      const data = await res.json()
      if (data.success && data.image) {
        previewImage.value = data.image
        imageSize.value = data.size || { width: 0, height: 0 }
      }
    }
  } catch (e) {
    console.error('生成封面失败:', e)
  } finally {
    isGenerating.value = false
  }
}

const saveCover = async () => {
  if (!previewImage.value || !selectedLibrary.value) return
  
  isSaving.value = true
  
  try {
    const res = await fetch('/api/emby/cover/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        library_id: selectedLibrary.value,
        image: previewImage.value
      })
    })
    
    if (res.ok) {
      const data = await res.json()
      if (data.success) {
        alert('封面保存成功！')
      }
    }
  } catch (e) {
    console.error('保存封面失败:', e)
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  loadLibraries()
  loadFonts()
})
</script>

<style scoped>
.cover-tab {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
  gap: 14px;
  align-items: start;
}

@media (max-width: 1024px) {
  .main-grid {
    grid-template-columns: 1fr;
  }
}

.config-panel,
.preview-panel {
  min-width: 0;
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
}

.section-box.dark .section-box-header {
  border-bottom-color: rgba(51, 65, 85, 0.88);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 38%, #2563eb 100%);
  border-radius: 16px;
  flex-shrink: 0;
  box-shadow: 0 14px 24px rgba(37, 99, 235, 0.2);
}

.header-icon svg {
  width: 22px;
  height: 22px;
  color: white;
}

.header-icon.preview-icon {
  background: linear-gradient(135deg, #8b5cf6, #a855f7);
  box-shadow: 0 14px 24px rgba(139, 92, 246, 0.2);
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
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
  line-height: 1.5;
}

.section-box-desc.dark {
  color: #94a3b8;
}

.section-box-content {
  padding: 20px;
}

.form-section {
  margin-bottom: 14px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.78);
  border: 1px solid rgba(226, 232, 240, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.section-box.dark .form-section {
  background: rgba(15, 23, 42, 0.46);
  border-color: rgba(71, 85, 105, 0.48);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.form-section.compact {
  margin-bottom: 12px;
}

.form-section:last-of-type {
  margin-bottom: 0;
}

.form-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  margin-bottom: 10px;
}

.form-section-title.dark {
  color: #e2e8f0;
}

.form-section-title svg {
  width: 14px;
  height: 14px;
  color: #3b82f6;
}

.form-row {
  display: flex;
  gap: 10px;
}

.form-group {
  margin-bottom: 10px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group.half {
  flex: 1;
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 6px;
}

.form-label.dark {
  color: #94a3b8;
}

.form-input,
.form-select {
  width: 100%;
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid rgba(203, 213, 225, 0.92);
  border-radius: 12px;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.94);
  color: #1e293b;
  transition: all 0.2s;
}

.form-input.dark,
.form-select.dark {
  background: rgba(51, 65, 85, 0.92);
  border-color: rgba(71, 85, 105, 0.9);
  color: #f1f5f9;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.14);
}

.form-input::placeholder {
  color: #9ca3af;
}

.form-input.dark::placeholder {
  color: #64748b;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 9px 10px;
  background: rgba(254, 242, 242, 0.92);
  border: 1px solid rgba(252, 165, 165, 0.52);
  border-radius: 12px;
  font-size: 11px;
  color: #dc2626;
}

.error-message.dark {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.28);
  color: #f87171;
}

.error-message svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.select-wrapper {
  position: relative;
}

.select-arrow {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: #9ca3af;
  pointer-events: none;
}

.form-select {
  padding-right: 32px;
  appearance: none;
  cursor: pointer;
}

.mode-chips {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  padding: 3px;
  border-radius: 14px;
  background: rgba(241, 245, 249, 0.88);
  border: 1px solid rgba(226, 232, 240, 0.88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.76);
}

.mode-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
  color: #64748b;
  background: transparent;
  text-align: center;
}

.mode-chip.dark {
  color: #94a3b8;
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}

.mode-chip:hover {
  color: #2563eb;
  background: rgba(255, 255, 255, 0.66);
}

.mode-chip.dark:hover {
  color: #dbeafe;
  background: rgba(51, 65, 85, 0.7);
}

.mode-chip.active {
  border-color: rgba(191, 219, 254, 0.88);
  background: rgba(255, 255, 255, 0.96);
  color: #1d4ed8;
  box-shadow:
    0 4px 12px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.mode-chip.dark.active {
  border-color: rgba(71, 85, 105, 0.8);
  background: rgba(15, 23, 42, 0.92);
  color: #f8fafc;
  box-shadow:
    0 6px 14px rgba(2, 6, 23, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.mode-chip input {
  display: none;
}

.chip-text {
  min-width: 0;
  font-weight: 600;
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
}

.section-box.dark .mode-chips {
  background: rgba(30, 41, 59, 0.8);
  border-color: rgba(71, 85, 105, 0.7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.action-row {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(226, 232, 240, 0.76);
  display: flex;
}

.section-box.dark .action-row {
  border-top-color: rgba(51, 65, 85, 0.88);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-lg {
  width: 100%;
  min-height: 42px;
  padding: 10px 16px;
  font-size: 13px;
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
  transform: none;
}

.btn-success {
  background: linear-gradient(135deg, #34d399, #10b981);
  color: white;
  box-shadow: 0 12px 24px rgba(16, 185, 129, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.btn-success:hover:not(:disabled) {
  box-shadow: 0 16px 28px rgba(16, 185, 129, 0.24);
  transform: translateY(-1px);
}

.btn-icon {
  width: 40px;
  height: 40px;
  padding: 0;
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(226, 232, 240, 0.82);
  border-radius: 14px;
  color: #374151;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.74);
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.98);
  transform: translateY(-1px);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.preview-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.preview-image-wrapper {
  position: relative;
  width: 100%;
  max-width: 100%;
  display: flex;
  justify-content: center;
  border-radius: 18px;
  overflow: hidden;
  background: rgba(248, 250, 252, 0.78);
  border: 1px solid rgba(226, 232, 240, 0.82);
}

.section-box.dark .preview-image-wrapper {
  background: rgba(15, 23, 42, 0.42);
  border-color: rgba(71, 85, 105, 0.48);
}

.preview-image {
  max-width: 100%;
  max-height: 400px;
  border-radius: 14px;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.18);
}

.preview-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  opacity: 0;
  transition: opacity 0.2s;
}

.preview-image-wrapper:hover .preview-overlay {
  opacity: 1;
}

.preview-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
}

.preview-info {
  display: flex;
  gap: 16px;
  padding: 10px 12px;
  background: rgba(248, 250, 252, 0.9);
  border: 1px solid rgba(226, 232, 240, 0.78);
  border-radius: 14px;
}

.preview-info.dark {
  background: rgba(51, 65, 85, 0.88);
  border-color: rgba(71, 85, 105, 0.64);
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
}

.info-item svg {
  width: 14px;
  height: 14px;
}

.preview-info.dark .info-item {
  color: #cbd5e1;
}

.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-illustration {
  position: relative;
  width: 120px;
  height: 120px;
  margin-bottom: 20px;
}

.empty-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #dbeafe, #bfdbfe);
  border-radius: 28px;
  transform: rotate(-6deg);
}

.empty-bg.dark {
  background: linear-gradient(135deg, #334155, #475569);
}

.empty-icon-wrapper {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 28px;
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.12);
}

.empty-icon-wrapper svg {
  width: 48px;
  height: 48px;
  color: #3b82f6;
}

.empty-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 8px 0;
}

.empty-title.dark {
  color: #f8fafc;
}

.empty-desc {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 24px 0;
  line-height: 1.6;
}

.empty-desc.dark {
  color: #94a3b8;
}

.empty-steps {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 18px;
}

.empty-steps.dark {
  background: rgba(51, 65, 85, 0.88);
  border-color: rgba(71, 85, 105, 0.64);
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-num {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 38%, #2563eb 100%);
  color: white;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  border-radius: 999px;
}

.step-text {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.empty-steps.dark .step-text {
  color: #e2e8f0;
}

.step-line {
  width: 20px;
  height: 2px;
  background: #cbd5e1;
  border-radius: 999px;
}

.empty-steps.dark .step-line {
  background: #475569;
}

@media (max-width: 768px) {
  .section-box-header {
    padding: 16px;
  }

  .section-box-content {
    padding: 16px;
  }

  .header-left {
    gap: 12px;
  }

  .form-section {
    padding: 12px;
  }

  .form-row {
    flex-direction: column;
    gap: 12px;
  }

  .form-group.half {
    width: 100%;
  }

  .mode-chips {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mode-chip {
    min-height: 32px;
    padding: 0 8px;
  }

  .chip-text {
    font-size: 10px;
    white-space: normal;
    line-height: 1.1;
  }

  .preview-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .preview-info {
    width: 100%;
    justify-content: center;
  }

  .btn-success {
    width: 100%;
  }

  .empty-container {
    padding: 32px 16px;
  }

  .empty-steps {
    flex-direction: column;
    gap: 10px;
  }

  .step-line {
    width: 2px;
    height: 16px;
  }

  .form-input,
  .form-select {
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  .section-box {
    border-radius: 20px;
  }

  .header-icon {
    width: 38px;
    height: 38px;
    border-radius: 14px;
  }

  .header-icon svg {
    width: 18px;
    height: 18px;
  }

  .section-box-title {
    font-size: 15px;
  }

  .section-box-header {
    padding: 14px;
  }

  .section-box-content {
    padding: 14px;
  }

  .form-section {
    padding: 10px;
    margin-bottom: 10px;
    border-radius: 16px;
  }

  .mode-chips {
    gap: 4px;
    padding: 3px;
  }

  .mode-chip {
    min-height: 30px;
    padding: 0 6px;
    border-radius: 10px;
  }

  .chip-text {
    font-size: 9px;
  }

  .btn-lg {
    min-height: 40px;
  }

  .preview-image {
    max-height: 250px;
  }

  .empty-illustration {
    width: 96px;
    height: 96px;
    margin-bottom: 16px;
  }

  .empty-icon-wrapper svg {
    width: 40px;
    height: 40px;
  }

  .empty-title {
    font-size: 16px;
  }

  .empty-desc {
    font-size: 13px;
    margin-bottom: 18px;
  }
}

</style>
