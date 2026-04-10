<template>
  <div class="auth-page" :class="{ dark: isDark }">
    <div class="auth-card" :class="{ dark: isDark }">
      <div class="auth-header">
        <div class="brand-chip" :class="{ dark: isDark }">
          <img src="/favicon.svg" alt="MediaHub" />
          <span>MediaHub</span>
        </div>
      </div>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label class="form-label" :class="{ dark: isDark }">用户名</label>
          <input
            v-model.trim="username"
            class="form-input"
            :class="{ dark: isDark }"
            type="text"
            autocomplete="username"
            maxlength="32"
            placeholder="请输入用户名"
          />
        </div>

        <div class="form-group">
          <label class="form-label" :class="{ dark: isDark }">密码</label>
          <input
            v-model="password"
            class="form-input"
            :class="{ dark: isDark }"
            :type="passwordFieldType"
            :autocomplete="passwordAutocomplete"
            maxlength="128"
            placeholder="请输入密码"
          />
        </div>

        <div v-if="showConfirmPassword" class="form-group">
          <label class="form-label" :class="{ dark: isDark }">确认密码</label>
          <input
            v-model="confirmPassword"
            class="form-input"
            :class="{ dark: isDark }"
            type="password"
            autocomplete="new-password"
            maxlength="128"
            placeholder="请再次输入密码"
          />
        </div>

        <label v-if="showRemember" class="remember-row" :class="{ dark: isDark }">
          <input v-model="rememberMe" type="checkbox" />
          <span>记住我</span>
        </label>

        <button class="btn btn-primary btn-submit" :disabled="submitting" type="submit">
          <span v-if="submitting">处理中...</span>
          <span v-else>{{ submitText }}</span>
        </button>
      </form>
    </div>

    <Transition name="toast">
      <div v-if="message" class="toast" :class="[messageType, { dark: isDark }]">
        <svg v-if="messageType === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>{{ message }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AuthStatusData } from '~/composables/useAuth'

/**
 * 登录 / 注册表单通用组件
 *
 * 负责：
 * - 根据 mode 渲染登录或注册表单
 * - 处理表单校验与提交
 * - 登录/注册成功后写入前端认证状态
 * - 以 toast 形式反馈操作结果
 */
interface AuthActionResponse {
  success: boolean
  data?: {
    username: string
  }
  error?: string
}

const props = withDefaults(defineProps<{
  mode: 'login' | 'register'
}>(), {
  mode: 'login'
})

const colorMode = useColorMode()

/**
 * 认证页是否处于暗黑模式。
 * 这里直接基于 colorMode 计算，确保主题切换时即时响应。
 */
const isDark = computed(() => colorMode.value === 'dark')

/** 用户名输入。 */
const username = ref('')

/** 密码输入。 */
const password = ref('')

/** 注册模式下的确认密码输入。 */
const confirmPassword = ref('')

/** 登录模式下是否启用持久会话。 */
const rememberMe = ref(true)

/** 当前是否正在提交，防止重复点击。 */
const submitting = ref(false)

/** toast 文案。 */
const message = ref('')

/** toast 类型。 */
const messageType = ref<'success' | 'error'>('success')

const { setAuthStatus } = useAuth()
let toastTimer: ReturnType<typeof setTimeout> | null = null

/** 注册页才显示确认密码。 */
const showConfirmPassword = computed(() => props.mode === 'register')

/** 登录页才显示“记住我”。 */
const showRemember = computed(() => props.mode === 'login')

/** 提交按钮文案随模式切换。 */
const submitText = computed(() => props.mode === 'register' ? '立即注册' : '立即登录')

/**
 * 通过标准 autocomplete 属性，让浏览器正确识别登录/注册表单。
 * 这样既能利用浏览器安全的自动填充，也不用自己明文保存密码。
 */
const passwordAutocomplete = computed(() => props.mode === 'register' ? 'new-password' : 'current-password')

/** 当前密码框类型，预留后续如“显示/隐藏密码”扩展。 */
const passwordFieldType = computed(() => 'password')

/**
 * 显示 toast，并自动在短时间后关闭。
 */
function showToast(type: 'success' | 'error', text: string) {
  messageType.value = type
  message.value = text

  if (toastTimer) {
    clearTimeout(toastTimer)
  }

  toastTimer = setTimeout(() => {
    message.value = ''
    toastTimer = null
  }, 2600)
}

/**
 * 提交登录 / 注册表单。
 *
 * 处理流程：
 * - 先做前端基础校验
 * - 根据 mode 调用不同接口
 * - 成功后更新全局认证状态并跳转首页
 * - 失败则展示错误提示
 */
async function handleSubmit() {
  if (!username.value) {
    showToast('error', '请输入用户名')
    return
  }

  if (!password.value) {
    showToast('error', '请输入密码')
    return
  }

  if (props.mode === 'register' && password.value !== confirmPassword.value) {
    showToast('error', '两次输入的密码不一致')
    return
  }

  submitting.value = true

  try {
    const response = await $fetch<AuthActionResponse>(props.mode === 'register' ? '/api/auth/register' : '/api/auth/login', {
      method: 'POST',
      body: props.mode === 'register'
        ? {
            username: username.value,
            password: password.value
          }
        : {
            username: username.value,
            password: password.value,
            rememberMe: rememberMe.value
          }
    })

    if (!response.success || !response.data) {
      showToast('error', response.error || (props.mode === 'register' ? '注册失败' : '登录失败'))
      return
    }

    const status: AuthStatusData = {
      hasUsers: true,
      authenticated: true,
      username: response.data.username
    }

    setAuthStatus(status)
    showToast('success', props.mode === 'register' ? '注册成功，正在进入系统' : '登录成功，正在进入系统')
    await navigateTo('/')
  } catch (error: any) {
    showToast('error', error?.data?.error || error?.message || (props.mode === 'register' ? '注册失败' : '登录失败'))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.auth-page {
  width: 100%;
}

.auth-card {
  border-radius: 32px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.76);
  box-shadow:
    0 28px 70px rgba(15, 23, 42, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(24px);
  padding: 28px;
}

.auth-card.dark {
  border-color: rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.8);
  box-shadow:
    0 28px 70px rgba(2, 6, 23, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.auth-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 18px;
  margin-bottom: 28px;
}

.brand-chip {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  width: fit-content;
  padding: 11px 18px;
  border-radius: 999px;
  border: 1px solid rgba(226, 232, 240, 0.82);
  background: rgba(255, 255, 255, 0.82);
  color: #0f172a;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.015em;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.28),
    0 0 24px rgba(96, 165, 250, 0.18),
    0 10px 28px rgba(15, 23, 42, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.78);
}

.brand-chip.dark {
  border-color: rgba(71, 85, 105, 0.46);
  background: rgba(30, 41, 59, 0.88);
  color: #f8fafc;
  box-shadow:
    0 0 0 1px rgba(148, 163, 184, 0.08),
    0 0 26px rgba(96, 165, 250, 0.22),
    0 12px 30px rgba(2, 6, 23, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.brand-chip img {
  width: 24px;
  height: 24px;
}


.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 12px;
  font-weight: 650;
  color: #334155;
}

.form-label.dark {
  color: #cbd5e1;
}

.form-input {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 16px;
  border: 1px solid rgba(226, 232, 240, 0.82);
  background: rgba(255, 255, 255, 0.78);
  color: #0f172a;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.form-input.dark {
  border-color: rgba(71, 85, 105, 0.54);
  background: rgba(30, 41, 59, 0.82);
  color: #f8fafc;
}

.form-input:focus {
  border-color: rgba(96, 165, 250, 0.8);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.remember-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.remember-row.dark {
  color: #cbd5e1;
}

.btn {
  min-height: 42px;
  border: none;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  border: 1px solid rgba(147, 197, 253, 0.28);
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 38%, #2563eb 100%);
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.btn-submit {
  margin-top: 4px;
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
  z-index: 1001;
  backdrop-filter: blur(20px);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
}

.toast svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.toast.success {
  background: rgba(219, 234, 254, 0.94);
  border-color: rgba(96, 165, 250, 0.28);
  color: #1d4ed8;
}

.toast.success.dark {
  background: rgba(30, 64, 175, 0.22);
  border-color: rgba(96, 165, 250, 0.24);
  color: #bfdbfe;
}

.toast.error {
  background: rgba(254, 226, 226, 0.94);
  border-color: rgba(248, 113, 113, 0.24);
  color: #b91c1c;
}

.toast.error.dark {
  background: rgba(127, 29, 29, 0.24);
  border-color: rgba(248, 113, 113, 0.22);
  color: #fecaca;
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

@media (max-width: 768px) {
  .auth-card {
    border-radius: 28px;
    padding: 22px 18px;
  }

  .auth-header {
    gap: 16px;
    margin-bottom: 24px;
  }

  .brand-chip {
    gap: 10px;
    padding: 10px 15px;
    font-size: 15px;
  }

  .brand-chip img {
    width: 22px;
    height: 22px;
  }

  .form-input {
    font-size: 16px;
  }
}
</style>
