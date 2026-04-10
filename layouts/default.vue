<!--
  默认布局
  包含侧边栏和头部
  支持响应式设计：桌面端左侧边栏，移动端底部导航
-->
<template>
  <div class="layout" :class="{ dark: isDark }">
    <div class="layout-backdrop" aria-hidden="true">
      <span class="ambient-orb orb-primary"></span>
      <span class="ambient-orb orb-secondary"></span>
      <span class="ambient-orb orb-tertiary"></span>
    </div>

    <!-- 桌面端侧边栏 -->
    <Sidebar />

    <div class="main">
      <div class="main-shell">
        <Header />
        <main class="content">
          <slot />
        </main>
      </div>
    </div>

    <!-- 移动端底部导航 -->
    <nav class="mobile-nav" :class="{ dark: isDark }">
      <NuxtLink to="/" class="mobile-nav-item" :class="{ active: $route.path === '/', dark: isDark }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span>仪表盘</span>
      </NuxtLink>
      <NuxtLink to="/organize" class="mobile-nav-item" :class="{ active: $route.path === '/organize', dark: isDark }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          <line x1="12" y1="11" x2="12" y2="17"/>
          <polyline points="9 14 12 11 15 14"/>
        </svg>
        <span>云盘整理</span>
      </NuxtLink>

      <!-- 更多菜单弹出按钮 -->
      <div class="more-menu-wrapper">
        <button
          class="mobile-nav-item more-btn"
          :class="{ dark: isDark, active: isMoreMenuActive, 'menu-open': showMoreMenu }"
          @click="toggleMoreMenu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>

        <!-- 弹出菜单 -->
        <Transition name="fade">
          <div v-if="showMoreMenu" class="more-menu-popup" :class="{ dark: isDark }">
            <NuxtLink
              to="/emby-tools"
              class="more-menu-item"
              :class="{ dark: isDark }"
              @click="closeMoreMenu"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <span>Emby工具</span>
            </NuxtLink>
          </div>
        </Transition>

        <!-- 遮罩层 -->
        <Transition name="fade">
          <div v-if="showMoreMenu" class="more-menu-overlay" @click="closeMoreMenu"></div>
        </Transition>
      </div>

      <NuxtLink to="/tasks" class="mobile-nav-item" :class="{ active: $route.path === '/tasks', dark: isDark }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>定时任务</span>
      </NuxtLink>
      <NuxtLink to="/settings" class="mobile-nav-item" :class="{ active: $route.path === '/settings', dark: isDark }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <span>参数配置</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
// @ts-ignore
import Sidebar from '../components/layout/Sidebar.vue'
// @ts-ignore
import Header from '../components/layout/Header.vue'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const route = useRoute()
const showMoreMenu = ref(false)

const moreMenuPaths = ['/emby-tools']

const isMoreMenuActive = computed(() => {
  return moreMenuPaths.some(p => route.path.startsWith(p))
})

const toggleMoreMenu = () => {
  showMoreMenu.value = !showMoreMenu.value
}

const closeMoreMenu = () => {
  showMoreMenu.value = false
}

watch(
  () => route.path,
  () => {
    closeMoreMenu()
  }
)
</script>

<style>
.layout {
  position: relative;
  min-height: 100vh;
  display: flex;
  background:
    radial-gradient(circle at top left, rgba(96, 165, 250, 0.18), transparent 34%),
    radial-gradient(circle at top right, rgba(192, 132, 252, 0.14), transparent 30%),
    linear-gradient(180deg, #f6f8fc 0%, #eef2f8 52%, #e9eef6 100%);
  overflow: hidden;
}

.layout.dark {
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.18), transparent 34%),
    radial-gradient(circle at top right, rgba(99, 102, 241, 0.14), transparent 28%),
    linear-gradient(180deg, #020617 0%, #0b1120 48%, #0f172a 100%);
}

.layout-backdrop {
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

.layout.dark .orb-primary {
  background: rgba(30, 64, 175, 0.36);
}

.orb-secondary {
  top: 28%;
  left: -120px;
  width: 220px;
  height: 220px;
  background: rgba(196, 181, 253, 0.42);
}

.layout.dark .orb-secondary {
  background: rgba(79, 70, 229, 0.2);
}

.orb-tertiary {
  right: 18%;
  bottom: -120px;
  width: 280px;
  height: 280px;
  background: rgba(125, 211, 252, 0.26);
}

.layout.dark .orb-tertiary {
  background: rgba(8, 47, 73, 0.34);
}

.main {
  position: relative;
  z-index: 1;
  margin-left: 240px;
  flex: 1;
  min-height: 100vh;
  min-width: 0;
  width: calc(100% - 240px);
  padding: 18px 18px 18px 8px;
  box-sizing: border-box;
}

.main-shell {
  min-height: calc(100vh - 36px);
  display: flex;
  flex-direction: column;
  border-radius: 34px;
  background: rgba(255, 255, 255, 0.48);
  border: 1px solid rgba(255, 255, 255, 0.52);
  box-shadow:
    0 28px 70px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.62);
  backdrop-filter: blur(28px);
}

.layout.dark .main-shell {
  background: rgba(15, 23, 42, 0.48);
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow:
    0 28px 70px rgba(2, 6, 23, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.content {
  flex: 1;
  width: 100%;
  padding: 8px 28px 32px;
  box-sizing: border-box;
  overflow-y: auto;
}

/* 移动端底部导航 */
.mobile-nav {
  display: none;
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: max(12px, env(safe-area-inset-bottom, 0px));
  z-index: 120;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 20px 44px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(28px);
}

.mobile-nav.dark {
  background: rgba(15, 23, 42, 0.8);
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow: 0 20px 44px rgba(2, 6, 23, 0.42);
}

.mobile-nav-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 56px;
  padding: 8px 10px;
  border-radius: 18px;
  color: #64748b;
  text-decoration: none;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.1;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.mobile-nav-item.dark {
  color: #94a3b8;
}

.mobile-nav-item svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.mobile-nav-item:hover {
  background: rgba(255, 255, 255, 0.42);
  border-color: rgba(148, 163, 184, 0.16);
}

.mobile-nav-item.dark:hover {
  background: rgba(30, 41, 59, 0.72);
  border-color: rgba(71, 85, 105, 0.36);
}

.mobile-nav-item.active {
  color: #2563eb;
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(96, 165, 250, 0.22);
}

.mobile-nav-item.active.dark {
  color: #bfdbfe;
  background: rgba(59, 130, 246, 0.16);
  border-color: rgba(96, 165, 250, 0.24);
}

.more-menu-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.more-btn {
  min-width: 48px;
}

.more-btn svg {
  transition: transform 0.24s ease;
}

.more-btn.menu-open svg {
  transform: rotate(45deg);
}

.more-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 150;
  background: transparent;
}

.more-menu-popup {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 160;
  display: flex;
  flex-direction: column;
  min-width: 144px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 20px;
  box-shadow: 0 20px 44px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(24px);
}

.more-menu-popup.dark {
  background: rgba(15, 23, 42, 0.88);
  border-color: rgba(148, 163, 184, 0.2);
  box-shadow: 0 20px 44px rgba(2, 6, 23, 0.42);
}

.more-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border-radius: 14px;
  color: #475569;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.18s ease, color 0.18s ease;
  white-space: nowrap;
}

.more-menu-item.dark {
  color: #cbd5e1;
}

.more-menu-item svg {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
}

.more-menu-item:hover {
  background: rgba(59, 130, 246, 0.08);
  color: #2563eb;
}

.more-menu-item.dark:hover {
  background: rgba(59, 130, 246, 0.16);
  color: #bfdbfe;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

/* 响应式设计 - 移动端 */
@media (max-width: 768px) {
  .main {
    margin-left: 0;
    width: 100%;
    padding: 10px 10px 94px;
  }

  .main-shell {
    min-height: calc(100vh - 104px);
    border-radius: 28px;
  }

  .content {
    padding: 4px 16px 18px;
  }

  .mobile-nav {
    display: flex;
  }
}

@media (max-width: 480px) {
  .main {
    padding: 8px 8px 92px;
  }

  .main-shell {
    border-radius: 24px;
  }

  .content {
    padding: 2px 12px 16px;
  }

  .mobile-nav {
    left: 8px;
    right: 8px;
    bottom: max(8px, env(safe-area-inset-bottom, 0px));
    padding-left: 8px;
    padding-right: 8px;
  }

  .mobile-nav-item {
    min-width: 50px;
    padding: 8px 8px;
  }
}
</style>
