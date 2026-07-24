<!--
  侧边栏组件
  包含Logo和导航菜单
-->
<template>
  <aside class="sidebar" :class="{ dark: isDark }">
    <!-- Logo区域 -->
    <div class="sidebar-header">
      <div class="logo">
        <div class="logo-icon">
          <img src="/favicon.svg" alt="MediaHub" />
        </div>
        <span class="logo-text">Media<span class="logo-highlight">Hub</span></span>
      </div>
    </div>

    <!-- 导航菜单 -->
    <nav class="sidebar-nav">
      <NuxtLink to="/" class="nav-link" :class="{ active: $route.path === '/', dark: isDark }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span>仪表盘</span>
      </NuxtLink>
      <NuxtLink to="/organize" class="nav-link" :class="{ active: $route.path === '/organize', dark: isDark }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          <line x1="12" y1="11" x2="12" y2="17"/>
          <polyline points="9 14 12 11 15 14"/>
        </svg>
        <span>云盘整理</span>
      </NuxtLink>
      <NuxtLink to="/tasks" class="nav-link" :class="{ active: $route.path === '/tasks', dark: isDark }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>定时任务</span>
      </NuxtLink>
      <NuxtLink to="/emby-tools" class="nav-link" :class="{ active: $route.path === '/emby-tools', dark: isDark }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <span>EmbyTools</span>
      </NuxtLink>
      <NuxtLink to="/settings" class="nav-link" :class="{ active: $route.path === '/settings', dark: isDark }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <span>参数配置</span>
      </NuxtLink>
    </nav>

    <!-- 底部版权信息 -->
    <div class="sidebar-footer" :class="{ dark: isDark }">
      <div class="footer-brand">
        <span>MediaHub</span>
        <span v-if="systemArch" class="arch-badge" :class="archClass">{{ systemArch }}</span>
      </div>
      <div class="footer-info">
        <span class="footer-version">{{ appVersion }}</span>
        <span class="footer-divider">·</span>
        <span class="footer-author">© {{ appYear }} {{ appAuthor }}</span>
        <a
          v-if="githubUrl"
          :href="githubUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-github"
          :class="{ dark: isDark }"
          aria-label="GitHub"
          title="GitHub"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.78 1.19 1.78 1.19 1.03 1.76 2.71 1.25 3.37.95.1-.75.4-1.25.73-1.53-2.55-.29-5.23-1.27-5.23-5.67 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.45.11-3.03 0 0 .96-.31 3.14 1.17A10.9 10.9 0 0 1 12 6.03c.98 0 1.97.13 2.89.38 2.18-1.48 3.14-1.17 3.14-1.17.62 1.58.23 2.74.11 3.03.74.8 1.18 1.82 1.18 3.07 0 4.41-2.69 5.38-5.25 5.66.41.35.78 1.04.78 2.11 0 1.52-.01 2.74-.01 3.12 0 .31.2.66.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/>
          </svg>
        </a>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import versionInfo from '../../config/version.json'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const systemArch = ref('')

const appVersion = `v${versionInfo.version}`
const appAuthor = versionInfo.author
const appYear = versionInfo.year
const githubUrl = versionInfo.github || ''

const archClass = computed(() => {
  if (systemArch.value === 'Arm') return 'arch-arm'
  if (systemArch.value === 'X86') return 'arch-x86'
  return ''
})

const fetchSystemArch = async () => {
  try {
    const response = await fetch('/api/system/arch')
    const data = await response.json()
    systemArch.value = data.arch || ''
  } catch (e) {
    systemArch.value = ''
  }
}

onMounted(() => {
  fetchSystemArch()
})
</script>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 240px;
  height: 100vh;
  padding: 18px 14px 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: transparent;
  z-index: 100;
}

.sidebar::before {
  content: '';
  position: absolute;
  inset: 12px 6px 12px 12px;
  border-radius: 30px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow:
    0 24px 56px rgba(15, 23, 42, 0.07),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(26px);
}

.sidebar.dark::before {
  background: rgba(15, 23, 42, 0.64);
  border-color: rgba(148, 163, 184, 0.16);
  box-shadow:
    0 24px 56px rgba(2, 6, 23, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.sidebar-header,
.sidebar-nav,
.sidebar-footer {
  position: relative;
  z-index: 1;
}

/* 移动端隐藏侧边栏 */
@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
}

.sidebar-header {
  padding: 12px 14px 16px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.62);
}

.sidebar.dark .sidebar-header {
  border-bottom-color: rgba(71, 85, 105, 0.42);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 40px;
  height: 40px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(226, 232, 240, 0.92);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.sidebar.dark .logo-icon {
  background: rgba(30, 41, 59, 0.78);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.logo-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.logo-text {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
  font-size: 21px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.04em;
}

.logo-text .logo-highlight {
  color: #2563eb;
}

.sidebar.dark .logo-text {
  color: #f8fafc;
}

.sidebar.dark .logo-text .logo-highlight {
  color: #93c5fd;
}

.sidebar-nav {
  padding: 18px 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid transparent;
  color: #475569;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.nav-link.dark {
  color: #94a3b8;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.44);
  border-color: rgba(226, 232, 240, 0.64);
  color: #0f172a;
}

.nav-link.dark:hover {
  background: rgba(30, 41, 59, 0.72);
  border-color: rgba(71, 85, 105, 0.38);
  color: #f8fafc;
}

.nav-link.active {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(96, 165, 250, 0.2);
  color: #1d4ed8;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.46);
}

.nav-link.active.dark {
  background: rgba(59, 130, 246, 0.16);
  border-color: rgba(96, 165, 250, 0.22);
  color: #dbeafe;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.nav-link svg {
  width: 19px;
  height: 19px;
  flex-shrink: 0;
}

.sidebar-footer {
  margin-top: auto;
  padding: 16px 12px 10px;
  border-top: 1px solid rgba(226, 232, 240, 0.56);
}

.sidebar-footer.dark {
  border-top-color: rgba(71, 85, 105, 0.4);
}

.footer-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.sidebar-footer.dark .footer-brand {
  color: #f8fafc;
}

.arch-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: white;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
}

.arch-badge.arch-arm {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.arch-badge.arch-x86 {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
}

.footer-info {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11px;
  color: #64748b;
}

.sidebar-footer.dark .footer-info {
  color: #94a3b8;
}

.footer-version {
  padding: 3px 8px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(226, 232, 240, 0.82);
  border-radius: 999px;
  font-weight: 600;
  color: #475569;
}

.sidebar-footer.dark .footer-version {
  background: rgba(30, 41, 59, 0.78);
  border-color: rgba(71, 85, 105, 0.52);
  color: #cbd5e1;
}

.footer-divider {
  color: #cbd5e1;
}

.sidebar-footer.dark .footer-divider {
  color: #475569;
}

.footer-github {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-left: 2px;
  color: #64748b;
  text-decoration: none;
  transition: color 0.2s ease, transform 0.2s ease;
}

.footer-github.dark {
  color: #94a3b8;
}

.footer-github:hover {
  transform: translateY(-1px);
  color: #111827;
}

.footer-github.dark:hover {
  color: #f8fafc;
}

.footer-github svg {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}
</style>
