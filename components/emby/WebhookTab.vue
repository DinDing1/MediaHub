<template>
  <div class="webhook-tab">
    <div class="section-box" :class="{ dark: isDark }">
      <div class="section-box-header">
        <h2 class="section-box-title">Webhook 配置说明</h2>
      </div>
      <div class="section-box-content">
        <div class="steps-container">
          <div class="step-item">
            <div class="step-badge">1</div>
            <div class="step-info">
              <h4 :class="{ dark: isDark }">复制 Webhook 地址</h4>
              <p :class="{ dark: isDark }">将下方的 Webhook 地址复制到剪贴板</p>
            </div>
          </div>

          <div class="url-box" :class="{ dark: isDark }">
            <div class="url-content">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <code>{{ webhookUrl || '请在参数配置中设置服务器地址' }}</code>
            </div>
            <button 
              class="btn btn-copy" 
              @click="copyWebhookUrl"
              :disabled="!webhookUrl"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              <span>复制</span>
            </button>
          </div>

          <div class="step-item">
            <div class="step-badge">2</div>
            <div class="step-info">
              <h4 :class="{ dark: isDark }">在 Emby 中配置 Webhook</h4>
              <p :class="{ dark: isDark }">打开 Emby 服务器设置 → 通知 → Webhook，添加上述地址</p>
            </div>
          </div>

          <div class="step-item">
            <div class="step-badge">3</div>
            <div class="step-info">
              <h4 :class="{ dark: isDark }">测试连接</h4>
              <p :class="{ dark: isDark }">配置完成后，点击下方"发送测试通知"按钮验证服务是否正常</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="section-box" :class="{ dark: isDark }">
      <div class="section-box-header">
        <h2 class="section-box-title">连接状态</h2>
        <span class="status-tag" :class="connectionStatus">
          {{ getStatusText() }}
        </span>
      </div>
      <div class="section-box-content">
        <div class="status-grid">
          <div class="status-card" :class="{ dark: isDark }">
            <span class="status-label" :class="{ dark: isDark }">服务器地址</span>
            <span class="status-value" :class="{ dark: isDark }">{{ serverUrl || '未配置' }}</span>
          </div>
          <div class="status-card" :class="{ dark: isDark }">
            <span class="status-label" :class="{ dark: isDark }">最近接收</span>
            <span class="status-value" :class="{ dark: isDark }">{{ lastReceivedTime || '暂无记录' }}</span>
          </div>
          <div class="status-card" :class="{ dark: isDark }">
            <span class="status-label" :class="{ dark: isDark }">接收次数</span>
            <span class="status-value" :class="{ dark: isDark }">{{ totalReceived }} 次</span>
          </div>
        </div>

        <div class="action-row">
          <button class="btn btn-primary" @click="testWebhook" :disabled="isTesting || !webhookUrl">
            <svg v-if="isTesting" class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span>{{ isTesting ? '测试中...' : '发送测试通知' }}</span>
          </button>
          <button class="btn btn-secondary" @click="refreshLogs" :disabled="isClearing">
            <svg v-if="isClearing" class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            <span>{{ isClearing ? '刷新中...' : '刷新日志' }}</span>
          </button>
          <button class="btn btn-danger" @click="clearLogs" :disabled="isClearing || logs.length === 0">
            <svg v-if="isClearing" class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span>{{ isClearing ? '清除中...' : '清除日志' }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="section-box" :class="{ dark: isDark }">
      <div class="section-box-header">
        <h2 class="section-box-title">Webhook 日志</h2>
        <span class="count-tag" :class="{ dark: isDark }">共 {{ logs.length }} 条</span>
      </div>
      <div class="section-box-content">
        <div v-if="logs.length === 0" class="empty-container">
          <div class="empty-icon" :class="{ dark: isDark }">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <h3 class="empty-title" :class="{ dark: isDark }">暂无 Webhook 日志</h3>
          <p class="empty-desc" :class="{ dark: isDark }">配置完成后，Emby 的事件将显示在这里</p>
        </div>

        <div v-else class="logs-list">
          <div 
            v-for="(log, index) in logs" 
            :key="index" 
            class="log-card"
            :class="{ dark: isDark, success: log.success, error: !log.success }"
          >
            <div class="log-header">
              <span class="log-event" :class="getEventClass(log.event)">
                {{ getEventLabel(log.event) }}
              </span>
              <span class="log-time" :class="{ dark: isDark }">{{ log.timestamp }}</span>
            </div>
            <div class="log-body">
              <div v-if="log.data" class="log-data">
                <span class="log-data-label" :class="{ dark: isDark }">数据:</span>
                <code>{{ JSON.stringify(log.data, null, 2) }}</code>
              </div>
              <div class="log-status">
                <svg v-if="log.success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <span :class="{ dark: isDark }">{{ log.success ? '处理成功' : '处理失败' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSettings } from '~/composables/useSettings'

interface Props {
  isDark: boolean
}

const props = defineProps<Props>()

interface WebhookLog {
  timestamp: string
  event: string
  data: any
  success: boolean
  processed: boolean
}

const { loadSettings } = useSettings()

const serverUrl = ref('')
const webhookUrl = ref('')
const isTesting = ref(false)
const isClearing = ref(false)
const logs = ref<WebhookLog[]>([])
const lastReceivedTime = ref('')
const totalReceived = ref(0)

const connectionStatus = computed(() => {
  if (!serverUrl.value) return 'unconfigured'
  if (logs.value.length > 0) return 'active'
  return 'configured'
})

const getStatusText = () => {
  switch (connectionStatus.value) {
    case 'unconfigured':
      return '未配置'
    case 'configured':
      return '已配置'
    case 'active':
      return '工作中'
    default:
      return '未知'
  }
}

const copyWebhookUrl = async () => {
  if (!webhookUrl.value) return
  
  try {
    await navigator.clipboard.writeText(webhookUrl.value)
    alert('Webhook 地址已复制到剪贴板')
  } catch (error) {
    alert('复制失败，请手动复制')
  }
}

const testWebhook = async () => {
  isTesting.value = true
  try {
    const response = await $fetch('/api/emby/webhook?action=test', {
      method: 'GET'
    }) as any
    
    if (response.success) {
      alert('测试通知已发送，请检查推送群组')
      await loadLogs()
    } else {
      alert('测试失败: ' + (response.error || '未知错误'))
    }
  } catch (error: any) {
    alert('测试出错: ' + error.message)
  } finally {
    isTesting.value = false
  }
}

const refreshLogs = async () => {
  isClearing.value = true
  try {
    await loadLogs()
  } finally {
    isClearing.value = false
  }
}

const clearLogs = async () => {
  if (!confirm('确定要清除所有 Webhook 日志吗？')) return
  
  isClearing.value = true
  try {
    const response = await $fetch('/api/emby/webhook/clear', {
      method: 'POST'
    }) as any
    
    if (response.success) {
      logs.value = []
      lastReceivedTime.value = ''
      totalReceived.value = 0
    }
  } catch (error: any) {
    alert('清除失败: ' + error.message)
  } finally {
    isClearing.value = false
  }
}

const loadLogs = async () => {
  try {
    const response = await $fetch('/api/emby/webhook?action=logs') as any
    if (response.success) {
      logs.value = response.data || []
      totalReceived.value = logs.value.length
      
      if (logs.value.length > 0 && logs.value[0]) {
        lastReceivedTime.value = logs.value[0].timestamp
      }
    }
  } catch (error) {
    console.error('Failed to load webhook logs:', error)
  }
}

const loadConfig = async () => {
  try {
    const config = await loadSettings()
    if (config.success && config.data) {
      serverUrl.value = config.data.strmServerUrl || ''
      if (serverUrl.value) {
        webhookUrl.value = `${serverUrl.value}/api/emby/webhook`
      }
    }
  } catch (error) {
    console.error('Failed to load webhook config:', error)
  }
}

const getEventClass = (event: string) => {
  const eventMap: Record<string, string> = {
    'library.new': 'library',
    'library.deleted': 'library',
    'playback.start': 'playback',
    'playback.stop': 'playback',
    'user.authenticated': 'user',
    'user.authenticationfailed': 'user',
    'system.notificationtest': 'system'
  }
  return eventMap[event] || 'system'
}

const getEventLabel = (event: string) => {
  const labelMap: Record<string, string> = {
    'library.new': '入库',
    'library.deleted': '删除',
    'playback.start': '播放',
    'playback.stop': '停止',
    'user.authenticated': '登录',
    'user.authenticationfailed': '登录失败',
    'system.notificationtest': '测试'
  }
  return labelMap[event] || event
}

onMounted(() => {
  loadConfig()
  loadLogs()
})
</script>

<style scoped>
.webhook-tab {
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

.section-box-content {
  padding: 20px;
}

.steps-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.step-badge {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 38%, #2563eb 100%);
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  flex-shrink: 0;
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.2);
}

.step-info {
  flex: 1;
}

.step-info h4 {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 4px 0;
}

.step-info h4.dark {
  color: #f8fafc;
}

.step-info p {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}

.step-info p.dark {
  color: #94a3b8;
}

.url-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: rgba(248, 250, 252, 0.9);
  border: 1px solid rgba(226, 232, 240, 0.78);
  border-radius: 18px;
  margin-left: 40px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.url-box.dark {
  background: rgba(15, 23, 42, 0.76);
  border-color: rgba(51, 65, 85, 0.86);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.url-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(226, 232, 240, 0.7);
}

.url-box.dark .url-content {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
}

.url-content svg {
  width: 18px;
  height: 18px;
  color: #64748b;
  flex-shrink: 0;
}

.url-content code {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.55;
  color: #334155;
  background: transparent;
  word-break: break-all;
}

.url-box.dark .url-content code {
  color: #cbd5e1;
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

.btn-danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
  box-shadow: 0 12px 24px rgba(239, 68, 68, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.btn-danger:hover:not(:disabled) {
  box-shadow: 0 16px 28px rgba(239, 68, 68, 0.22);
  transform: translateY(-1px);
}

.btn-copy {
  background: linear-gradient(135deg, #34d399, #10b981);
  color: white;
  min-height: 42px;
  padding: 0 16px;
  font-size: 13px;
  box-shadow: 0 12px 24px rgba(16, 185, 129, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.btn-copy:hover:not(:disabled) {
  box-shadow: 0 16px 28px rgba(16, 185, 129, 0.22);
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.status-tag.unconfigured {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}

.status-tag.configured {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}

.status-tag.active {
  background: rgba(16, 185, 129, 0.14);
  color: #059669;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.status-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  background: rgba(248, 250, 252, 0.84);
  border: 1px solid rgba(226, 232, 240, 0.78);
  border-radius: 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.status-card.dark {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(51, 65, 85, 0.86);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.status-label {
  font-size: 12px;
  color: #64748b;
}

.status-label.dark {
  color: #94a3b8;
}

.status-value {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.45;
  word-break: break-word;
}

.status-value.dark {
  color: #f8fafc;
}

.action-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.action-row .btn {
  flex: 1 1 180px;
}

.count-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 0 10px;
  background: rgba(148, 163, 184, 0.14);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: #64748b;
  white-space: nowrap;
}

.count-tag.dark {
  background: rgba(71, 85, 105, 0.6);
  color: #cbd5e1;
}

.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 36px 18px;
  text-align: center;
}

.empty-icon {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(248, 250, 252, 0.9);
  border: 1px solid rgba(226, 232, 240, 0.82);
  border-radius: 18px;
  margin-bottom: 14px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.74);
}

.empty-icon.dark {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.46);
}

.empty-icon svg {
  width: 24px;
  height: 24px;
  color: #94a3b8;
}

.empty-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 6px 0;
}

.empty-title.dark {
  color: #f8fafc;
}

.empty-desc {
  font-size: 13px;
  color: #64748b;
  margin: 0;
  line-height: 1.6;
}

.empty-desc.dark {
  color: #94a3b8;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
}

.log-card {
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.82);
  background: rgba(248, 250, 252, 0.86);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.log-card.dark {
  background: rgba(15, 23, 42, 0.74);
  border-color: rgba(51, 65, 85, 0.86);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.log-card.success {
  border-left: 3px solid #10b981;
}

.log-card.error {
  border-left: 3px solid #ef4444;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.log-event {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.log-event.library {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}

.log-event.playback {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.log-event.user {
  background: rgba(249, 115, 22, 0.12);
  color: #ea580c;
}

.log-event.system {
  background: rgba(139, 92, 246, 0.12);
  color: #7c3aed;
}

.log-time {
  font-size: 12px;
  color: #94a3b8;
}

.log-time.dark {
  color: #64748b;
}

.log-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-data {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-data-label {
  font-size: 12px;
  color: #64748b;
}

.log-data-label.dark {
  color: #94a3b8;
}

.log-data code {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #334155;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(226, 232, 240, 0.78);
  padding: 10px;
  border-radius: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}

.log-card.dark .log-data code {
  color: #cbd5e1;
  background: rgba(30, 41, 59, 0.76);
  border-color: rgba(71, 85, 105, 0.52);
}

.log-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}

.log-status svg {
  width: 16px;
  height: 16px;
}

.log-card.success .log-status {
  color: #10b981;
}

.log-card.error .log-status {
  color: #ef4444;
}

.log-status span.dark {
  color: inherit;
}

@media (max-width: 768px) {
  .section-box-header {
    padding: 16px;
  }

  .section-box-content {
    padding: 16px;
  }

  .url-box {
    margin-left: 0;
    flex-direction: column;
    align-items: stretch;
  }

  .url-content {
    flex-wrap: wrap;
  }

  .btn-copy {
    width: 100%;
  }

  .status-grid {
    grid-template-columns: 1fr;
  }

  .action-row {
    flex-direction: column;
  }

  .action-row .btn {
    width: 100%;
    flex: none;
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

  .status-tag,
  .count-tag {
    width: 100%;
    text-align: center;
  }

  .step-badge {
    width: 26px;
    height: 26px;
    font-size: 12px;
  }

  .step-info h4 {
    font-size: 13px;
  }

  .step-info p {
    font-size: 12px;
  }

  .url-content code {
    font-size: 12px;
  }

  .log-card {
    padding: 12px;
    border-radius: 16px;
  }
}

</style>
