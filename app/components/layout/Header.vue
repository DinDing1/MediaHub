<!--
  头部组件
  包含页面标题、日志按钮和主题切换按钮
-->
<template>
  <header class="header" :class="{ dark: isDark }">
    <div class="header-surface">
      <div class="header-title">
        <span class="header-caption">MediaHub</span>
        <h1>{{ pageTitle }}</h1>
      </div>
      <div class="header-actions">
        <div v-if="authStatus?.authenticated && authStatus.username" class="user-chip" :class="{ dark: isDark }">
          <span class="user-name">{{ authStatus.username }}</span>
          <button class="logout-btn" :class="{ dark: isDark }" :disabled="loggingOut" @click="handleLogout">
            {{ loggingOut ? '退出中...' : '登出' }}
          </button>
        </div>
        <!-- 日志按钮 -->
        <button class="action-btn" :class="{ dark: isDark }" @click="showLogPanel = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </button>
        <!-- 主题切换按钮 -->
        <button class="action-btn" :class="{ dark: isDark }" @click="toggleTheme">
          <ClientOnly>
            <svg v-if="isDark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
            <template #fallback>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            </template>
          </ClientOnly>
        </button>
      </div>
    </div>

    <LogPanel :visible="showLogPanel" @close="showLogPanel = false" />
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const route = useRoute()
const { authStatus, logout } = useAuth()

const showLogPanel = ref(false)
const loggingOut = ref(false)

const pageTitle = computed(() => {
  if (route.path === '/') return '仪表盘'
  if (route.path === '/organize') return '云盘整理'
  if (route.path === '/tasks') return '定时任务'
  if (route.path === '/emby-tools') return 'EmbyTools'
  if (route.path === '/settings') return '参数配置'
  return 'MediaHub'
})

const toggleTheme = () => {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

const handleLogout = async () => {
  if (loggingOut.value) return
  loggingOut.value = true

  try {
    await logout()
    await navigateTo('/login')
  } finally {
    loggingOut.value = false
  }
}
</script>

<style scoped>
.header {
  padding: 20px 24px 12px;
  background: transparent;
}

.header-surface {
  min-height: 72px;
  padding: 14px 16px 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.54);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow:
    0 18px 40px rgba(15, 23, 42, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(24px);
}

.header.dark .header-surface {
  background: rgba(15, 23, 42, 0.54);
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow:
    0 18px 40px rgba(2, 6, 23, 0.26),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.header-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-caption {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.header.dark .header-caption {
  color: #94a3b8;
}

.header-title h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: #0f172a;
}

.header.dark .header-title h1 {
  color: #f8fafc;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 4px 4px 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(226, 232, 240, 0.88);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
}

.user-chip.dark {
  background: rgba(30, 41, 59, 0.84);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.user-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.user-chip.dark .user-name {
  color: #e2e8f0;
}

.logout-btn {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(226, 232, 240, 0.88);
  background: rgba(255, 255, 255, 0.92);
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.logout-btn.dark {
  border-color: rgba(71, 85, 105, 0.54);
  background: rgba(15, 23, 42, 0.84);
  color: #cbd5e1;
}

.logout-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(226, 232, 240, 0.88);
  background: rgba(255, 255, 255, 0.76);
  color: #475569;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.action-btn.dark {
  background: rgba(30, 41, 59, 0.84);
  border-color: rgba(71, 85, 105, 0.54);
  color: #cbd5e1;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.action-btn:hover {
  background: rgba(241, 245, 249, 0.96);
  border-color: rgba(148, 163, 184, 0.24);
  color: #0f172a;
  transform: translateY(-1px);
}

.action-btn.dark:hover {
  background: rgba(51, 65, 85, 0.96);
  color: #f8fafc;
}

.action-btn svg {
  width: 17px;
  height: 17px;
}

@media (max-width: 768px) {
  .header {
    padding: 14px 14px 10px;
  }

  .header-surface {
    min-height: 62px;
    padding: 12px 12px 12px 14px;
    border-radius: 20px;
  }

  .header-title h1 {
    font-size: 18px;
  }

  .header-caption {
    font-size: 10px;
  }

  .header-actions {
    gap: 8px;
  }

  .user-chip {
    max-width: 148px;
    padding-left: 8px;
  }

  .user-name {
    max-width: 64px;
  }

  .action-btn {
    width: 34px;
    height: 34px;
    border-radius: 11px;
  }

  .action-btn svg {
    width: 15px;
    height: 15px;
  }
}

@media (max-width: 420px) {
  .header-caption {
    display: none;
  }

  .header-title h1 {
    font-size: 17px;
  }

  .header-actions {
    gap: 6px;
  }

  .user-chip {
    display: inline-flex;
    max-width: 112px;
    padding: 3px 3px 3px 8px;
    gap: 6px;
  }

  .user-name {
    max-width: 40px;
    font-size: 11px;
  }

  .logout-btn {
    min-height: 24px;
    padding: 0 8px;
    font-size: 11px;
  }

  .action-btn {
    width: 32px;
    height: 32px;
  }
}
</style>
