<template>
  <div class="tasks-page">
    <div class="tasks-grid">
      <div 
        v-for="task in tasks" 
        :key="task.id" 
        class="task-card" 
        :class="{ 
          dark: isDark, 
          enabled: task.enabled,
          running: task.running
        }"
      >
        <div class="task-header">
          <div class="task-icon-wrapper" :class="{ enabled: task.enabled && task.id !== 'glados_sign' }">
            <component :is="task.icon" class="task-icon-svg" />
          </div>
          
          <div class="task-info">
            <div class="task-title-row">
              <h3 class="task-name">{{ task.name }}</h3>
              <span class="task-status" :class="{ active: task.enabled }">
                {{ task.enabled ? '已启用' : '未启用' }}
              </span>
            </div>
            <p class="task-desc">{{ task.description }}</p>
          </div>
          
          <label class="toggle-switch">
            <input type="checkbox" v-model="task.enabled" @change="toggleTask(task)" />
            <span class="toggle-slider"></span>
          </label>
        </div>
        
        <div class="task-body" :class="{ expanded: task.enabled }">
          <div class="config-section">
            <div class="config-row schedule-main-row">
              <div class="config-item schedule-item schedule-item-frequency">
                <span class="config-label">执行频率</span>
                <select v-model="task.scheduleConfig.frequency" class="config-select" @change="onScheduleChange(task)">
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                  <option value="hourly">每小时</option>
                </select>
              </div>

              <div class="config-item schedule-item schedule-item-time" v-if="task.scheduleConfig.frequency === 'daily' || task.scheduleConfig.frequency === 'weekly'">
                <span class="config-label">执行时间</span>
                <div class="time-picker">
                  <select v-model="task.scheduleConfig.hour" class="time-select" @change="onScheduleChange(task)">
                    <option v-for="h in 24" :key="h" :value="h - 1">{{ String(h - 1).padStart(2, '0') }}</option>
                  </select>
                  <span class="time-separator">:</span>
                  <select v-model="task.scheduleConfig.minute" class="time-select" @change="onScheduleChange(task)">
                    <option v-for="m in [0, 15, 30, 45]" :key="m" :value="m">{{ String(m).padStart(2, '0') }}</option>
                  </select>
                </div>
              </div>

              <div class="config-item schedule-item schedule-item-interval" v-if="task.scheduleConfig.frequency === 'hourly'">
                <span class="config-label">间隔时间</span>
                <select v-model="task.scheduleConfig.interval" class="config-select" @change="onScheduleChange(task)">
                  <option :value="1">每 1 小时</option>
                  <option :value="2">每 2 小时</option>
                  <option :value="4">每 4 小时</option>
                  <option :value="6">每 6 小时</option>
                  <option :value="12">每 12 小时</option>
                </select>
              </div>
            </div>

            <div class="config-row schedule-detail-row">
              <div class="config-item schedule-detail-card full-width" :class="`mode-${task.scheduleConfig.frequency}`">
                <span class="config-label">调度详情</span>

                <div v-if="task.scheduleConfig.frequency === 'weekly'" class="schedule-detail-content">
                  <div class="weekday-picker">
                    <button
                      v-for="(day, index) in weekDays"
                      :key="index"
                      class="weekday-btn"
                      :class="{ active: task.scheduleConfig.weekday === index }"
                      @click="task.scheduleConfig.weekday = index; onScheduleChange(task)"
                    >
                      {{ day }}
                    </button>
                  </div>
                </div>

                <div v-else-if="task.scheduleConfig.frequency === 'daily'" class="schedule-detail-content schedule-detail-plain">
                  <span class="schedule-detail-text">每日固定时刻执行，适合常规自动任务。</span>
                </div>

                <div v-else class="schedule-detail-content schedule-detail-plain">
                  <span class="schedule-detail-text">按固定小时间隔循环执行，适合高频巡检任务。</span>
                </div>
              </div>
            </div>

            <div class="config-row info-row">
              <div class="config-item preview-item info-card">
                <span class="config-label">执行说明</span>
                <span class="schedule-preview info-card-text">{{ getScheduleDescription(task) }}</span>
              </div>

              <div class="config-item preview-item info-card info-card-meta" v-if="task.lastRun">
                <span class="config-label">上次执行</span>
                <span class="config-value info-card-text">{{ task.lastRun }}</span>
              </div>
            </div>
          </div>
          
          <div class="task-footer" :class="{ 'with-config': task.id === 'fnos_sign' || task.id === 'glados_sign' || task.id === 'hdhive_sign' || task.id === 'media_info' }">
            <button 
              v-if="task.id === 'fnos_sign'"
              class="btn-config"
              @click="openFnosConfig"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <span>配置</span>
            </button>
            <button 
              v-if="task.id === 'glados_sign'"
              class="btn-config"
              @click="openGladosConfig"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <span>配置</span>
            </button>
            <button 
              v-if="task.id === 'hdhive_sign'"
              class="btn-config"
              @click="openHdhiveConfig"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <span>配置</span>
            </button>
            <button
              v-if="task.id === 'media_info'"
              class="btn-config"
              @click="openMediaInfoConfig"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <span>配置</span>
            </button>
            <button
              class="btn-run"
              :class="{ running: task.running }"
              @click="runTaskNow(task)"
              :disabled="task.running"
            >
              <svg v-if="!task.running" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <svg v-else class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <span>{{ task.running ? '执行中' : '立即执行' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <Transition name="toast">
      <div v-if="message" class="toast" :class="messageType">
        <svg v-if="messageType === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <span>{{ message }}</span>
      </div>
    </Transition>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showFnosConfigModal" class="modal-overlay" @click.self="closeFnosConfig">
          <Transition name="zoom">
            <div v-if="showFnosConfigModal" class="modal-content" :class="{ dark: isDark }">
              <div class="modal-header">
                <h3>飞牛论坛配置</h3>
              </div>
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label" :class="{ dark: isDark }">论坛 Cookie</label>
                  <textarea
                    v-model="fnosCookie"
                    class="form-textarea"
                    :class="{ dark: isDark }"
                    placeholder="请输入飞牛论坛登录Cookie&#10;需要包含 pvRK_2132_saltkey 和 pvRK_2132_auth"
                    rows="4"
                  ></textarea>
                  <p class="form-hint" :class="{ dark: isDark }">
                    登录飞牛论坛后，从浏览器开发者工具中获取 Cookie
                  </p>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" @click="closeFnosConfig">取消</button>
                <button class="btn btn-primary" :disabled="fnosSaving" @click="saveFnosConfig">
                  {{ fnosSaving ? '保存中...' : '保存' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showGladosConfigModal" class="modal-overlay" @click.self="closeGladosConfig">
          <Transition name="zoom">
            <div v-if="showGladosConfigModal" class="modal-content" :class="{ dark: isDark }">
              <div class="modal-header">
                <h3>GlaDOS 配置</h3>
              </div>
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label" :class="{ dark: isDark }">GlaDOS Cookie</label>
                  <textarea
                    v-model="gladosCookie"
                    class="form-textarea"
                    :class="{ dark: isDark }"
                    placeholder="请输入GlaDOS登录Cookie"
                    rows="4"
                  ></textarea>
                  <p class="form-hint" :class="{ dark: isDark }">
                    登录 GlaDOS 后，从浏览器开发者工具中获取 Cookie
                  </p>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" @click="closeGladosConfig">取消</button>
                <button class="btn btn-primary" :disabled="gladosSaving" @click="saveGladosConfig">
                  {{ gladosSaving ? '保存中...' : '保存' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showHdhiveConfigModal" class="modal-overlay" @click.self="closeHdhiveConfig">
          <Transition name="zoom">
            <div v-if="showHdhiveConfigModal" class="modal-content" :class="{ dark: isDark }">
              <div class="modal-header">
                <h3>影巢配置</h3>
              </div>
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label" :class="{ dark: isDark }">影巢 Cookie</label>
                  <textarea
                    v-model="hdhiveCookie"
                    class="form-textarea"
                    :class="{ dark: isDark }"
                    placeholder="请输入影巢登录Cookie&#10;需要包含 token 和 csrf_access_token"
                    rows="4"
                  ></textarea>
                </div>
                <div class="form-group form-group-spaced">
                  <label class="form-label" :class="{ dark: isDark }">站点地址</label>
                  <input
                    v-model="hdhiveBaseUrl"
                    type="text"
                    class="form-input"
                    :class="{ dark: isDark }"
                    placeholder="留空则使用默认 https://hdhive.com"
                  />
                  <p class="form-hint" :class="{ dark: isDark }">
                    请输入浏览器中已登录影巢的 Cookie，系统将直接使用 Cookie 执行签到
                  </p>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" @click="closeHdhiveConfig">取消</button>
                <button class="btn btn-primary" :disabled="hdhiveSaving" @click="saveHdhiveConfig">
                  {{ hdhiveSaving ? '保存中...' : '保存' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showMediaInfoConfigModal" class="modal-overlay" @click.self="closeMediaInfoConfig">
          <Transition name="zoom">
            <div v-if="showMediaInfoConfigModal" class="modal-content" :class="{ dark: isDark }">
              <div class="modal-header">
                <h3>媒体信息提取配置</h3>
              </div>
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label" :class="{ dark: isDark }">媒体库</label>
                  <select v-model="mediaInfoLibraryId" class="form-select" :class="{ dark: isDark }">
                    <option value="all">全部媒体库</option>
                    <option v-for="library in mediaInfoLibraries" :key="library.id" :value="library.id">
                      {{ library.name }}
                    </option>
                  </select>
                </div>
                <div class="form-group form-group-spaced">
                  <label class="form-label" :class="{ dark: isDark }">线程数</label>
                  <input
                    v-model.number="mediaInfoConcurrency"
                    type="number"
                    min="1"
                    max="10"
                    class="form-input"
                    :class="{ dark: isDark }"
                  />
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" @click="closeMediaInfoConfig">取消</button>
                <button class="btn btn-primary" :disabled="mediaInfoSaving" @click="saveMediaInfoConfig">
                  {{ mediaInfoSaving ? '保存中...' : '保存' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { h } from 'vue'
import { useSettings } from '~/composables/useSettings'

const colorMode = useColorMode()
const isDark = ref(false)
const { loadSettings, updateSettingsData } = useSettings()

definePageMeta({
  layout: 'default'
})

watch(() => colorMode.value, (val) => {
  isDark.value = val === 'dark'
}, { immediate: true })

interface ScheduleConfig {
  frequency: 'daily' | 'weekly' | 'hourly'
  hour: number
  minute: number
  weekday: number
  interval: number
}

interface Task {
  id: string
  name: string
  description: string
  enabled: boolean
  schedule: string
  scheduleConfig: ScheduleConfig
  lastRun?: string
  nextRun?: string
  running: boolean
  icon: any
  libraryId?: string
  libraryName?: string
  concurrency?: number
}

interface MediaInfoLibrary {
  id: string
  name: string
  type: string
  typeLabel: string
}

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

const CheckInIcon = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('path', { d: 'M9 11l3 3L22 4' }),
      h('path', { d: 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' })
    ])
  }
}

const TrashIcon = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('polyline', { points: '3 6 5 6 21 6' }),
      h('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }),
      h('line', { x1: 10, y1: 11, x2: 10, y2: 17 }),
      h('line', { x1: 14, y1: 11, x2: 14, y2: 17 })
    ])
  }
}

const FnosIcon = {
  render() {
    return h('img', { 
      src: '/fnos.png', 
      alt: '飞牛',
      style: 'width: 100%; height: 100%; object-fit: contain;'
    })
  }
}

const GladosIcon = {
  render() {
    return h('img', { 
      src: '/glados.png', 
      alt: 'GlaDOS',
      style: 'width: 100%; height: 100%; object-fit: cover; border-radius: 10px;'
    })
  }
}

const HdhiveIcon = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('path', { d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }),
      h('polyline', { points: '9 22 9 12 15 12 15 22' })
    ])
  }
}

const MediaInfoIcon = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('rect', { x: '3', y: '5', width: '18', height: '14', rx: '2' }),
      h('polygon', { points: '10 9 16 12 10 15 10 9' }),
      h('line', { x1: '7', y1: '3', x2: '7', y2: '7' }),
      h('line', { x1: '17', y1: '3', x2: '17', y2: '7' })
    ])
  }
}

function parseCronToConfig(cron: string): ScheduleConfig {
  const parts = cron.split(' ')
  const minute = parseInt(parts[0] || '0') || 0
  const hour = parseInt(parts[1] || '8') || 8
  const dayOfMonth = parts[2] || '*'
  const month = parts[3] || '*'
  const weekdayStr = parts[4] || '*'
  const weekday = parseInt(weekdayStr) || 0
  
  if (dayOfMonth === '*' && weekdayStr === '*') {
    return { frequency: 'daily', hour, minute, weekday: 0, interval: 1 }
  } else if (dayOfMonth === '*' && weekdayStr !== '*') {
    return { frequency: 'weekly', hour, minute, weekday, interval: 1 }
  } else if (parts[1] === '*') {
    return { frequency: 'hourly', hour: 0, minute, weekday: 0, interval: parseInt(dayOfMonth) || 1 }
  }
  
  return { frequency: 'daily', hour, minute, weekday: 0, interval: 1 }
}

function configToCron(config: ScheduleConfig): string {
  const { frequency, hour, minute, weekday, interval } = config
  
  if (frequency === 'daily') {
    return `${minute} ${hour} * * *`
  } else if (frequency === 'weekly') {
    return `${minute} ${hour} * * ${weekday}`
  } else if (frequency === 'hourly') {
    return `${minute} */${interval} * * *`
  }
  
  return `${minute} ${hour} * * *`
}

function getScheduleDescription(task: Task): string {
  const { frequency, hour, minute, weekday, interval } = task.scheduleConfig
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  
  if (frequency === 'daily') {
    return `每天 ${timeStr} 执行`
  } else if (frequency === 'weekly') {
    return `每周${weekDays[weekday]} ${timeStr} 执行`
  } else if (frequency === 'hourly') {
    return `每 ${interval} 小时执行一次`
  }
  
  return ''
}

const tasks = reactive<Task[]>([
  {
    id: 'checkin',
    name: '115签到',
    description: '每日自动签到领取奖励',
    enabled: false,
    schedule: '0 8 * * *',
    scheduleConfig: { frequency: 'daily', hour: 8, minute: 0, weekday: 0, interval: 1 },
    running: false,
    icon: CheckInIcon
  },
  {
    id: 'clean_trash',
    name: '清空回收站',
    description: '定时清空115云盘回收站',
    enabled: false,
    schedule: '0 0 * * *',
    scheduleConfig: { frequency: 'daily', hour: 0, minute: 0, weekday: 0, interval: 1 },
    running: false,
    icon: TrashIcon
  },
  {
    id: 'fnos_sign',
    name: '飞牛签到',
    description: '每日飞牛论坛自动签到',
    enabled: false,
    schedule: '0 8 * * *',
    scheduleConfig: { frequency: 'daily', hour: 8, minute: 0, weekday: 0, interval: 1 },
    running: false,
    icon: FnosIcon
  },
  {
    id: 'glados_sign',
    name: 'GlaDOS签到',
    description: '每日GlaDOS自动签到获取点数',
    enabled: false,
    schedule: '0 9 * * *',
    scheduleConfig: { frequency: 'daily', hour: 9, minute: 0, weekday: 0, interval: 1 },
    running: false,
    icon: GladosIcon
  },
  {
    id: 'hdhive_sign',
    name: '影巢签到',
    description: '每日影巢自动签到获取积分',
    enabled: false,
    schedule: '0 10 * * *',
    scheduleConfig: { frequency: 'daily', hour: 10, minute: 0, weekday: 0, interval: 1 },
    running: false,
    icon: HdhiveIcon
  },
  {
    id: 'media_info',
    name: '媒体信息提取',
    description: '定时补齐 Emby 缺失的媒体流信息',
    enabled: false,
    schedule: '0 4 * * *',
    scheduleConfig: { frequency: 'daily', hour: 4, minute: 0, weekday: 0, interval: 1 },
    running: false,
    icon: MediaInfoIcon,
    libraryId: 'all',
    libraryName: '全部媒体库',
    concurrency: 1
  }
])

const message = ref('')
const messageType = ref<'success' | 'error'>('success')

const showFnosConfigModal = ref(false)
const fnosCookie = ref('')
const fnosSaving = ref(false)

async function openFnosConfig() {
  try {
    const response = await loadSettings()
    if (response.success && response.data) {
      fnosCookie.value = response.data.fnosCookie || ''
    }
  } catch (e) {
    console.error('获取配置失败:', e)
  }
  showFnosConfigModal.value = true
}

function closeFnosConfig() {
  showFnosConfigModal.value = false
}

async function saveFnosConfig() {
  fnosSaving.value = true
  try {
    const response = await $fetch('/api/settings', {
      method: 'POST',
      body: {
        fnosCookie: fnosCookie.value.trim()
      }
    }) as any

    if (response.success) {
      updateSettingsData({ fnosCookie: fnosCookie.value.trim() })
      showToast('飞牛论坛配置已保存', 'success')
      closeFnosConfig()
    } else {
      showToast(response.error || '保存失败', 'error')
    }
  } catch (e: any) {
    showToast(e.message || '保存失败', 'error')
  } finally {
    fnosSaving.value = false
  }
}

const showGladosConfigModal = ref(false)
const gladosCookie = ref('')
const gladosSaving = ref(false)

async function openGladosConfig() {
  try {
    const response = await loadSettings()
    if (response.success && response.data) {
      gladosCookie.value = response.data.gladosCookie || ''
    }
  } catch (e) {
    console.error('获取配置失败:', e)
  }
  showGladosConfigModal.value = true
}

function closeGladosConfig() {
  showGladosConfigModal.value = false
}

async function saveGladosConfig() {
  gladosSaving.value = true
  try {
    const response = await $fetch('/api/settings', {
      method: 'POST',
      body: {
        gladosCookie: gladosCookie.value.trim()
      }
    }) as any

    if (response.success) {
      updateSettingsData({ gladosCookie: gladosCookie.value.trim() })
      showToast('GlaDOS配置已保存', 'success')
      closeGladosConfig()
    } else {
      showToast(response.error || '保存失败', 'error')
    }
  } catch (e: any) {
    showToast(e.message || '保存失败', 'error')
  } finally {
    gladosSaving.value = false
  }
}

const showHdhiveConfigModal = ref(false)
const hdhiveCookie = ref('')
const hdhiveBaseUrl = ref('')
const hdhiveSaving = ref(false)

const showMediaInfoConfigModal = ref(false)
const mediaInfoLibraries = ref<MediaInfoLibrary[]>([])
const mediaInfoLibraryId = ref('all')
const mediaInfoConcurrency = ref(1)
const mediaInfoSaving = ref(false)

async function openMediaInfoConfig() {
  try {
    const response = await $fetch('/api/emby/media_info?action=libraries') as any
    if (response.success && response.data) {
      mediaInfoLibraries.value = response.data
    }

    const task = tasks.find(item => item.id === 'media_info')
    const options = [{ id: 'all' }, ...mediaInfoLibraries.value]
    const selectedLibraryId = task?.libraryId || 'all'
    mediaInfoLibraryId.value = options.some(item => item.id === selectedLibraryId) ? selectedLibraryId : 'all'
    mediaInfoConcurrency.value = Math.min(Math.max(Number(task?.concurrency || 1), 1), 10)
    showMediaInfoConfigModal.value = true
  } catch (e: any) {
    showToast(e.message || '加载媒体库失败', 'error')
  }
}

function closeMediaInfoConfig() {
  showMediaInfoConfigModal.value = false
}

async function saveMediaInfoConfig() {
  mediaInfoSaving.value = true
  try {
    const normalizedConcurrency = Math.min(Math.max(Number(mediaInfoConcurrency.value || 1), 1), 10)
    const response = await $fetch('/api/tasks', {
      method: 'POST',
      body: {
        action: 'update',
        taskId: 'media_info',
        libraryId: mediaInfoLibraryId.value,
        concurrency: normalizedConcurrency
      }
    }) as any

    if (response.success) {
      const task = tasks.find(item => item.id === 'media_info')
      if (task) {
        task.libraryId = mediaInfoLibraryId.value
        task.libraryName = mediaInfoLibraryId.value === 'all'
          ? '全部媒体库'
          : mediaInfoLibraries.value.find(item => item.id === mediaInfoLibraryId.value)?.name
        task.concurrency = normalizedConcurrency
      }
      mediaInfoConcurrency.value = normalizedConcurrency
      showToast('媒体信息提取配置已保存', 'success')
      closeMediaInfoConfig()
    } else {
      showToast(response.error || '保存失败', 'error')
    }
  } catch (e: any) {
    showToast(e.message || '保存失败', 'error')
  } finally {
    mediaInfoSaving.value = false
  }
}

async function openHdhiveConfig() {
  try {
    const response = await loadSettings()
    if (response.success && response.data) {
      hdhiveCookie.value = response.data.hdhiveCookie || ''
      hdhiveBaseUrl.value = response.data.hdhiveBaseUrl || ''
    }
  } catch (e) {
    console.error('获取配置失败:', e)
  }
  showHdhiveConfigModal.value = true
}

function closeHdhiveConfig() {
  showHdhiveConfigModal.value = false
}

async function saveHdhiveConfig() {
  hdhiveSaving.value = true
  try {
    const response = await $fetch('/api/settings', {
      method: 'POST',
      body: {
        hdhiveCookie: hdhiveCookie.value.trim(),
        hdhiveBaseUrl: hdhiveBaseUrl.value.trim()
      }
    }) as any

    if (response.success) {
      updateSettingsData({
        hdhiveCookie: hdhiveCookie.value.trim(),
        hdhiveBaseUrl: hdhiveBaseUrl.value.trim()
      })
      showToast('影巢配置已保存', 'success')
      closeHdhiveConfig()
    } else {
      showToast(response.error || '保存失败', 'error')
    }
  } catch (e: any) {
    showToast(e.message || '保存失败', 'error')
  } finally {
    hdhiveSaving.value = false
  }
}

async function loadTasks() {
  try {
    const response = await $fetch('/api/tasks') as any
    if (response.success && response.data) {
      response.data.forEach((serverTask: any) => {
        const localTask = tasks.find(t => t.id === serverTask.id)
        if (localTask) {
          localTask.enabled = serverTask.enabled
          localTask.schedule = serverTask.schedule || localTask.schedule
          localTask.scheduleConfig = parseCronToConfig(localTask.schedule)
          localTask.lastRun = serverTask.lastRun
          localTask.nextRun = serverTask.nextRun
          localTask.libraryId = serverTask.libraryId
          localTask.libraryName = serverTask.libraryName
          localTask.concurrency = serverTask.concurrency
        }
      })
    }
  } catch (e) {
    console.error('加载任务失败:', e)
  }
}

async function toggleTask(task: Task) {
  try {
    await $fetch('/api/tasks', {
      method: 'POST',
      body: {
        action: 'update',
        taskId: task.id,
        enabled: task.enabled,
        libraryId: task.id === 'media_info' ? (task.libraryId || 'all') : undefined,
        concurrency: task.id === 'media_info' ? (task.concurrency || 1) : undefined
      }
    })
    showToast(task.enabled ? `${task.name} 已启用` : `${task.name} 已禁用`, 'success')
  } catch (e: any) {
    showToast(e.message || '操作失败', 'error')
    task.enabled = !task.enabled
  }
}

function onScheduleChange(task: Task) {
  task.schedule = configToCron(task.scheduleConfig)
  updateTask(task)
}

async function updateTask(task: Task) {
  try {
    await $fetch('/api/tasks', {
      method: 'POST',
      body: {
        action: 'update',
        taskId: task.id,
        schedule: task.schedule,
        libraryId: task.id === 'media_info' ? (task.libraryId || 'all') : undefined,
        concurrency: task.id === 'media_info' ? (task.concurrency || 1) : undefined
      }
    })
    showToast(`${task.name} 配置已更新`, 'success')
  } catch (e: any) {
    showToast(e.message || '更新失败', 'error')
  }
}

async function runTaskNow(task: Task) {
  task.running = true
  try {
    const response = await $fetch('/api/tasks', {
      method: 'POST',
      body: {
        action: 'run',
        taskId: task.id
      }
    }) as any
    
    if (response.success) {
      showToast(response.message || `${task.name} 执行成功`, 'success')
      await loadTasks()
    } else {
      showToast(response.error || '执行失败', 'error')
    }
  } catch (e: any) {
    showToast(e.message || '执行失败', 'error')
  } finally {
    task.running = false
  }
}

function showToast(msg: string, type: 'success' | 'error') {
  message.value = msg
  messageType.value = type
  setTimeout(() => { message.value = '' }, 3000)
}

onMounted(() => {
  loadTasks()
})
</script>
<style scoped>
.tasks-page {
  width: 100%;
  padding-bottom: 84px;
}

.tasks-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-card {
  overflow: hidden;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.62);
  box-shadow:
    0 22px 54px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(24px);
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.task-card.dark {
  border-color: rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.56);
  box-shadow:
    0 22px 54px rgba(2, 6, 23, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.task-card.enabled {
  border-color: rgba(96, 165, 250, 0.24);
  background: rgba(255, 255, 255, 0.68);
  box-shadow:
    0 24px 58px rgba(59, 130, 246, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.task-card.dark.enabled {
  border-color: rgba(96, 165, 250, 0.24);
  background: rgba(15, 23, 42, 0.6);
  box-shadow:
    0 26px 60px rgba(30, 64, 175, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.task-card.running {
  box-shadow:
    0 0 0 1px rgba(96, 165, 250, 0.22),
    0 26px 60px rgba(59, 130, 246, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.92; }
}

.task-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px 16px;
}

.task-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  overflow: hidden;
}

.task-card.dark .task-icon-wrapper {
  background: rgba(30, 41, 59, 0.8);
  border-color: rgba(71, 85, 105, 0.52);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.task-icon-wrapper.enabled {
  border: none;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  box-shadow: 0 14px 28px rgba(59, 130, 246, 0.24);
}

.task-icon-svg {
  width: 20px;
  height: 20px;
  color: #94a3b8;
  transition: color 0.2s ease;
}

.task-card.dark .task-icon-svg {
  color: #cbd5e1;
}

.task-icon-wrapper.enabled .task-icon-svg {
  color: white;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  flex-wrap: wrap;
}

.task-name {
  font-size: 16px;
  font-weight: 650;
  color: #0f172a;
  margin: 0;
}

.task-card.dark .task-name {
  color: #f8fafc;
}

.task-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(148, 163, 184, 0.12);
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}


.task-card.dark .task-status {
  border-color: rgba(100, 116, 139, 0.24);
  background: rgba(71, 85, 105, 0.44);
  color: #cbd5e1;
}

.task-status.active {
  border-color: rgba(96, 165, 250, 0.18);
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
}

.task-card.dark .task-status.active {
  border-color: rgba(96, 165, 250, 0.22);
  background: rgba(59, 130, 246, 0.16);
  color: #bfdbfe;
}

.task-desc {
  margin: 4px 0 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #64748b;
}

.task-card.dark .task-desc {
  color: #94a3b8;
}

.toggle-switch {
  position: relative;
  width: 42px;
  height: 24px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  border-radius: 999px;
  background: rgba(203, 213, 225, 0.9);
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.08);
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.task-card.dark .toggle-slider {
  background: rgba(71, 85, 105, 0.88);
  box-shadow: inset 0 1px 2px rgba(2, 6, 23, 0.26);
}

.toggle-slider:before {
  position: absolute;
  content: "";
  width: 18px;
  height: 18px;
  left: 3px;
  bottom: 3px;
  border-radius: 50%;
  background-color: white;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18);
  transition: transform 0.2s ease;
}

input:checked + .toggle-slider {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  box-shadow: 0 10px 22px rgba(59, 130, 246, 0.22);
}

input:checked + .toggle-slider:before {
  transform: translateX(18px);
}

.task-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.task-body.expanded {
  max-height: 388px;
}

.config-section {
  padding: 0 20px 12px;
  border-top: 1px solid rgba(226, 232, 240, 0.58);
}

.task-card.dark .config-section {
  border-top-color: rgba(71, 85, 105, 0.4);
}

.config-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 9px;
}

.config-row:last-child {
  margin-bottom: 0;
}

.config-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.config-item.full-width {
  grid-column: 1 / -1;
}

.schedule-main-row {
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  align-items: stretch;
}

.schedule-item {
  min-height: 72px;
  padding: 11px 13px;
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.72);
  background: rgba(248, 250, 252, 0.78);
  box-shadow:
    0 10px 28px rgba(15, 23, 42, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.66);
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 7px;
}

.task-card.dark .schedule-item {
  border-color: rgba(71, 85, 105, 0.46);
  background: rgba(30, 41, 59, 0.72);
  box-shadow:
    0 14px 34px rgba(2, 6, 23, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.schedule-item .config-select,
.schedule-item .time-picker {
  width: 100%;
}

.schedule-item-time .time-picker {
  justify-content: flex-start;
  width: 100%;
  min-width: 0;
}

.schedule-item-time .time-select {
  flex: 1 1 0;
  min-width: 0;
}

.schedule-item-interval .config-select,
.schedule-item-frequency .config-select {
  min-width: 0;
}

.schedule-detail-row {
  grid-template-columns: 1fr;
}

.schedule-detail-card {
  min-height: 88px;
  padding: 11px 13px;
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.72);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(248, 250, 252, 0.82) 100%);
  box-shadow:
    0 14px 32px rgba(15, 23, 42, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 5px;
}

.task-card.dark .schedule-detail-card {
  border-color: rgba(71, 85, 105, 0.46);
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.82) 100%);
  box-shadow:
    0 16px 36px rgba(2, 6, 23, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.schedule-detail-card.mode-weekly {
  min-height: 88px;
}

.schedule-detail-content {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.schedule-detail-card.mode-weekly .schedule-detail-content {
  min-height: 44px;
  align-items: center;
  justify-content: flex-start;
  gap: 0;
}

.schedule-detail-plain {
  justify-content: flex-start;
}

.schedule-detail-text {
  font-size: 12px;
  line-height: 1.5;
  color: #475569;
}

.task-card.dark .schedule-detail-text {
  color: #cbd5e1;
}

.info-row {
  align-items: stretch;
}

.info-card {
  min-height: 62px;
  padding: 7px 11px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2px;
  border-radius: 14px;
  border: 1px solid rgba(226, 232, 240, 0.72);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, rgba(248, 250, 252, 0.86) 100%);
  box-shadow:
    0 10px 24px rgba(15, 23, 42, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
}

.info-card-accent {
  border-color: rgba(96, 165, 250, 0.2);
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.84) 0%, rgba(248, 250, 252, 0.88) 100%);
}

.info-card-meta {
  min-height: 62px;
}

.info-card-text {
  display: block;
  width: 100%;
  line-height: 1.45;
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  word-break: break-word;
}

.task-card.dark .info-card {
  border-color: rgba(71, 85, 105, 0.48);
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.78) 0%, rgba(15, 23, 42, 0.82) 100%);
  box-shadow:
    0 14px 28px rgba(2, 6, 23, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.task-card.dark .info-card-accent {
  border-color: rgba(96, 165, 250, 0.22);
  background: linear-gradient(180deg, rgba(30, 64, 175, 0.18) 0%, rgba(15, 23, 42, 0.84) 100%);
}

.config-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  flex-shrink: 0;
}

.task-card.dark .config-label {
  color: #94a3b8;
}

.config-select {
  min-width: 96px;
  padding: 10px 12px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  font-size: 13px;
  color: #0f172a;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.config-select:hover {
  border-color: rgba(96, 165, 250, 0.28);
}

.config-select:focus {
  outline: none;
  border-color: rgba(96, 165, 250, 0.42);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.task-card.dark .config-select {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #f8fafc;
}

.task-card.dark .config-select:hover {
  border-color: rgba(96, 165, 250, 0.28);
}

.task-card.dark .config-select option {
  background: #1e293b;
  color: #f8fafc;
}

.time-picker {
  display: flex;
  align-items: center;
  gap: 4px;
}

.time-select {
  min-width: 52px;
  padding: 10px 8px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  font-size: 13px;
  color: #0f172a;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  text-align: center;
}

.time-select:hover {
  border-color: rgba(96, 165, 250, 0.28);
}

.time-select:focus {
  outline: none;
  border-color: rgba(96, 165, 250, 0.42);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.task-card.dark .time-select {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #f8fafc;
}

.task-card.dark .time-select option {
  background: #1e293b;
  color: #f8fafc;
}

.time-separator {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
}

.task-card.dark .time-separator {
  color: #94a3b8;
}

.weekday-picker {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.weekday-btn {
  min-width: 0;
  height: 34px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.weekday-btn:hover {
  transform: translateY(-1px);
  border-color: rgba(96, 165, 250, 0.28);
  color: #2563eb;
}

.weekday-btn.active {
  border-color: rgba(96, 165, 250, 0.2);
  background: rgba(59, 130, 246, 0.14);
  color: #1d4ed8;
}

.task-card.dark .weekday-btn {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
}

.task-card.dark .weekday-btn:hover {
  border-color: rgba(96, 165, 250, 0.28);
  color: #bfdbfe;
}

.task-card.dark .weekday-btn.active {
  border-color: rgba(96, 165, 250, 0.22);
  background: rgba(59, 130, 246, 0.16);
  color: #dbeafe;
}

.schedule-preview {
  font-size: 12px;
  font-weight: 600;
  color: #2563eb;
}

.task-card.dark .schedule-preview {
  color: #bfdbfe;
}

.config-value {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.task-card.dark .config-value {
  color: #e2e8f0;
}

.task-footer {
  padding: 14px 20px 18px;
  border-top: 1px solid rgba(226, 232, 240, 0.58);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, rgba(248, 250, 252, 0.22) 100%);
}

.task-footer.with-config {
  justify-content: space-between;
}

.task-card.dark .task-footer {
  border-top-color: rgba(71, 85, 105, 0.4);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.04) 0%, rgba(15, 23, 42, 0.18) 100%);
}

.btn-run {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 40px;
  min-width: 108px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(59, 130, 246, 0.18);
  background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%);
  box-shadow:
    0 12px 24px rgba(59, 130, 246, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  white-space: nowrap;
  flex: 0 0 auto;
}

.btn-run:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(59, 130, 246, 0.26);
  box-shadow:
    0 16px 28px rgba(59, 130, 246, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
  color: #ffffff;
}

.btn-run:disabled {
  opacity: 0.72;
  cursor: not-allowed;
}

.btn-run.running {
  border-color: rgba(96, 165, 250, 0.32);
}

.task-card.dark .btn-run {
  border-color: rgba(96, 165, 250, 0.24);
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  box-shadow:
    0 14px 28px rgba(30, 64, 175, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
  color: #eff6ff;
}

.task-card.dark .btn-run:hover:not(:disabled) {
  border-color: rgba(147, 197, 253, 0.34);
  box-shadow:
    0 18px 32px rgba(30, 64, 175, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  color: #ffffff;
}

.btn-run svg {
  width: 12px;
  height: 12px;
}

.btn-config {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 40px;
  min-width: 72px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: rgba(255, 255, 255, 0.76);
  box-shadow:
    0 8px 18px rgba(15, 23, 42, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  white-space: nowrap;
  flex: 0 0 auto;
}

.btn-config:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.94);
  border-color: rgba(245, 158, 11, 0.24);
  box-shadow:
    0 10px 22px rgba(245, 158, 11, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.76);
  color: #d97706;
}

.task-card.dark .btn-config {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow:
    0 10px 20px rgba(2, 6, 23, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
}

.task-card.dark .btn-config:hover {
  background: rgba(51, 65, 85, 0.96);
  border-color: rgba(245, 158, 11, 0.24);
  box-shadow:
    0 12px 24px rgba(245, 158, 11, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  color: #fbbf24;
}

.btn-config svg {
  width: 12px;
  height: 12px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  background: rgba(15, 23, 42, 0.36);
  backdrop-filter: blur(16px);
}

.modal-content {
  width: 100%;
  max-width: 520px;
  overflow: hidden;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.78);
  box-shadow:
    0 28px 70px rgba(15, 23, 42, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(24px);
}

.modal-content.dark {
  border-color: rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.84);
  box-shadow:
    0 28px 70px rgba(2, 6, 23, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.62);
}

.modal-content.dark .modal-header {
  border-bottom-color: rgba(71, 85, 105, 0.42);
}

.modal-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 650;
  color: #0f172a;
}

.modal-content.dark .modal-header h3 {
  color: #f8fafc;
}

.modal-body {
  padding: 22px;
}

.form-group {
  margin-bottom: 0;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

.form-label.dark {
  color: #cbd5e1;
}

.form-textarea {
  width: 100%;
  min-height: 108px;
  padding: 12px 14px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  font-size: 13px;
  line-height: 1.6;
  color: #0f172a;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.form-textarea:focus {
  outline: none;
  border-color: rgba(96, 165, 250, 0.42);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea.dark {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #f8fafc;
}

.form-textarea.dark:focus {
  border-color: rgba(96, 165, 250, 0.42);
}


.form-group-spaced {
  margin-top: 18px;
}

.form-select,
.form-input {
  width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  font-size: 13px;
  color: #0f172a;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: rgba(96, 165, 250, 0.42);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-select.dark,
.form-input.dark {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #f8fafc;
}

.form-select.dark option {
  background: #1e293b;
  color: #f8fafc;
}

.form-hint {
  font-size: 12px;
  line-height: 1.6;
  color: #64748b;
  margin: 8px 0 0 0;
}

.form-hint.dark {
  color: #94a3b8;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 18px 22px;
  border-top: 1px solid rgba(226, 232, 240, 0.62);
}

.modal-content.dark .modal-footer {
  border-top-color: rgba(71, 85, 105, 0.42);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 42px;
  padding: 10px 16px;
  border-radius: 14px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  box-shadow: 0 14px 28px rgba(59, 130, 246, 0.2);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 18px 32px rgba(59, 130, 246, 0.28);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  border-color: rgba(226, 232, 240, 0.9);
  background: rgba(255, 255, 255, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  color: #475569;
}

.btn-secondary:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.94);
  border-color: rgba(96, 165, 250, 0.28);
  color: #1e293b;
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
  transform: scale(0.96);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: fit-content;
  max-width: min(calc(100vw - 32px), 460px);
  padding: 13px 18px;
  border-radius: 18px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.45;
  white-space: pre-line;
  z-index: 1000;
  backdrop-filter: blur(20px);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
}

.toast svg {
  width: 18px;
  height: 18px;
}

.toast.success {
  background: rgba(219, 234, 254, 0.94);
  border-color: rgba(96, 165, 250, 0.28);
  color: #1d4ed8;
}

.toast.error {
  background: rgba(254, 226, 226, 0.94);
  border-color: rgba(248, 113, 113, 0.24);
  color: #b91c1c;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(16px);
}

@media (max-width: 640px) {
  .tasks-page {
    padding-bottom: 100px;
  }

  .tasks-grid {
    gap: 12px;
  }

  .task-card {
    border-radius: 22px;
  }

  .task-header {
    padding: 13px 14px 12px;
    gap: 10px;
    align-items: flex-start;
  }

  .task-icon-wrapper {
    width: 36px;
    height: 36px;
    border-radius: 11px;
  }

  .task-icon-svg {
    width: 16px;
    height: 16px;
  }

  .task-info {
    min-width: 0;
    padding-top: 1px;
  }

  .task-title-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px;
    min-height: 28px;
  }

  .task-name {
    font-size: 13px;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .task-status {
    min-height: 27px;
    padding: 0 8px;
    font-size: 10px;
  }

  .task-desc {
    margin-top: 2px;
    font-size: 11px;
  }

  .toggle-switch {
    width: 38px;
    height: 22px;
  }

  .toggle-slider:before {
    width: 16px;
    height: 16px;
  }

  input:checked + .toggle-slider:before {
    transform: translateX(16px);
  }

  .task-body.expanded {
    max-height: 500px;
  }

  .config-section {
    padding: 0 14px 12px;
  }

  .config-row {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 10px;
    align-items: stretch;
  }

  .schedule-main-row {
    grid-template-columns: 1fr;
  }

  .config-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }

  .config-item:not(.preview-item) {
    padding: 8px 10px;
    border-radius: 14px;
    border: 1px solid rgba(226, 232, 240, 0.68);
    background: rgba(248, 250, 252, 0.74);
  }

  .config-item.full-width {
    grid-column: 1 / -1;
  }

  .task-card.dark .config-item:not(.preview-item) {
    border-color: rgba(71, 85, 105, 0.44);
    background: rgba(30, 41, 59, 0.68);
  }

  .config-item.preview-item {
    padding: 8px 10px;
    border-radius: 14px;
  }

  .info-card {
    min-height: 60px;
    padding: 7px 10px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    border-radius: 14px;
    gap: 2px;
  }

  .info-card-meta.full-width {
    grid-column: 1 / -1;
  }

  .info-card-text {
    line-height: 1.45;
  }

  .schedule-item,
  .schedule-detail-card {
    min-height: 84px;
    padding: 9px 11px;
    border-radius: 15px;
    gap: 5px;
  }

  .schedule-detail-card.mode-weekly {
    min-height: 84px;
  }

  .config-label,
  .schedule-preview,
  .config-value,
  .schedule-detail-text {
    font-size: 11px;
  }

  .config-select {
    width: 100%;
    min-width: auto;
    font-size: 12px;
    padding: 8px 10px;
    border-radius: 11px;
  }

  .time-picker {
    width: 100%;
  }

  .schedule-item-time .time-picker {
    justify-content: flex-start;
    width: 100%;
    min-width: 0;
  }

  .schedule-item-time .time-select {
    flex: 1 1 0;
    min-width: 0;
  }

  .time-select {
    font-size: 12px;
    padding: 8px 6px;
    border-radius: 11px;
  }

  .weekday-picker {
    width: 100%;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
  }

  .weekday-btn {
    height: 28px;
    font-size: 10px;
    border-radius: 9px;
  }

  .task-footer {
    padding: 10px 14px 14px;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .task-footer.with-config {
    justify-content: space-between;
  }

  .btn-run,
  .btn-config {
    min-height: 34px;
    border-radius: 10px;
    font-size: 11px;
    gap: 5px;
  }

  .btn-run {
    flex: 1 1 112px;
    justify-content: center;
    max-width: 132px;
    padding: 0 10px;
  }

  .btn-config {
    flex: 0 0 auto;
    justify-content: center;
    min-width: 66px;
    max-width: 78px;
    padding: 0 10px;
  }

  .modal-overlay {
    padding: 12px;
  }

  .modal-content {
    border-radius: 22px;
  }

  .modal-header {
    padding: 16px 16px 14px;
  }

  .modal-body {
    padding: 16px;
  }

  .modal-footer {
    padding: 14px 16px 16px;
    flex-wrap: wrap;
  }

  .form-select,
  .form-input {
    min-height: 40px;
    padding: 9px 12px;
    border-radius: 12px;
    font-size: 12px;
  }

  .form-group-spaced {
    margin-top: 14px;
  }

  .modal-footer .btn {
    flex: 1;
    min-height: 38px;
    border-radius: 11px;
  }

  .toast {
    bottom: 100px;
    max-width: calc(100vw - 28px);
    padding: 11px 14px;
    border-radius: 16px;
    font-size: 12px;
  }

  .toast-enter-from,
  .toast-leave-to {
    transform: translateY(16px);
  }
}


@media (min-width: 641px) {
  .tasks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: 16px;
  }

  .task-card {
    width: 100%;
    max-width: none;
  }
}
</style>
