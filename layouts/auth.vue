<template>
  <div class="auth-layout" :class="{ dark: isDark }">
    <div class="auth-backdrop" aria-hidden="true">
      <span class="ambient-orb orb-primary"></span>
      <span class="ambient-orb orb-secondary"></span>
      <span class="ambient-orb orb-tertiary"></span>
    </div>

    <button
      class="theme-toggle"
      :class="{ dark: isDark }"
      type="button"
      aria-label="切换主题"
      @click="toggleTheme"
    >
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

    <main class="auth-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * 认证页独立布局
 *
 * 作用：
 * - 为登录页 / 注册页提供独立背景与居中容器
 * - 不复用主站 Header / Sidebar，避免进入业务壳
 * - 提供和主页面一致的主题切换能力
 */
const colorMode = useColorMode()

/** 当前是否为暗黑模式。 */
const isDark = computed(() => colorMode.value === 'dark')

/**
 * 切换浅色 / 暗黑主题。
 * 与主页面逻辑保持一致，保证认证页也能单独切换主题。
 */
const toggleTheme = () => {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script>

<style scoped>
.auth-layout {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(96, 165, 250, 0.18), transparent 34%),
    radial-gradient(circle at top right, rgba(192, 132, 252, 0.14), transparent 30%),
    linear-gradient(180deg, #f6f8fc 0%, #eef2f8 52%, #e9eef6 100%);
  overflow: hidden;
}

.auth-layout.dark {
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.18), transparent 34%),
    radial-gradient(circle at top right, rgba(99, 102, 241, 0.14), transparent 28%),
    linear-gradient(180deg, #020617 0%, #0b1120 48%, #0f172a 100%);
}

.auth-backdrop {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.ambient-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(18px);
  opacity: 0.8;
}

.orb-primary {
  top: -90px;
  right: -60px;
  width: 260px;
  height: 260px;
  background: rgba(191, 219, 254, 0.72);
}

.auth-layout.dark .orb-primary {
  background: rgba(30, 64, 175, 0.36);
}

.orb-secondary {
  top: 28%;
  left: -120px;
  width: 220px;
  height: 220px;
  background: rgba(196, 181, 253, 0.42);
}

.auth-layout.dark .orb-secondary {
  background: rgba(79, 70, 229, 0.2);
}

.orb-tertiary {
  right: 18%;
  bottom: -120px;
  width: 280px;
  height: 280px;
  background: rgba(125, 211, 252, 0.26);
}

.auth-layout.dark .orb-tertiary {
  background: rgba(8, 47, 73, 0.34);
}

.theme-toggle {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2;
  width: 40px;
  height: 40px;
  border-radius: 14px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: rgba(255, 255, 255, 0.78);
  color: #475569;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow:
    0 10px 24px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px);
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.theme-toggle.dark {
  border-color: rgba(71, 85, 105, 0.54);
  background: rgba(30, 41, 59, 0.84);
  color: #cbd5e1;
  box-shadow:
    0 12px 28px rgba(2, 6, 23, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.theme-toggle:hover {
  transform: translateY(-1px);
  background: rgba(241, 245, 249, 0.96);
  color: #0f172a;
}

.theme-toggle.dark:hover {
  background: rgba(51, 65, 85, 0.96);
  color: #f8fafc;
}

.theme-toggle svg {
  width: 18px;
  height: 18px;
}

.auth-main {
  position: relative;
  z-index: 1;
  width: min(100%, 460px);
}

@media (max-width: 768px) {
  .auth-layout {
    align-items: stretch;
    padding: 12px;
  }

  .theme-toggle {
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    border-radius: 12px;
  }

  .theme-toggle svg {
    width: 16px;
    height: 16px;
  }

  .auth-main {
    width: 100%;
    display: flex;
    align-items: center;
  }
}
</style>
