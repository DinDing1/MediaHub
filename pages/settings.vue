<!--
  参数配置页面
  用于配置Emby服务器和115云盘连接参数
-->
<template>
  <div class="settings" :class="{ dark: isDark }">

    <div class="settings-grid">
      <!-- Emby配置卡片 -->
      <div class="settings-card" :class="{ dark: isDark }">
        <div class="card-header">
          <div class="card-header-left">
            <div class="card-header-icon">
              <img src="/emby.svg" alt="Emby" />
            </div>
            <div class="card-header-info">
              <h3 class="card-title" :class="{ dark: isDark }">Emby 配置</h3>
            </div>
          </div>
          <div v-if="connectionStatus.show" class="connection-status" :class="connectionStatus.type">
            <span class="status-dot"></span>
            <span class="status-text">{{ connectionStatus.text }}</span>
          </div>
        </div>
        <div class="card-content">
          <div class="form-row">
            <div class="form-group half">
              <label class="form-label" :class="{ dark: isDark }">Emby 地址</label>
              <input
                v-model="embyForm.baseUrl"
                type="text"
                placeholder="https://emby.example.com"
                class="form-input"
                :class="{ dark: isDark, error: errors.baseUrl }"
              />
              <span v-if="errors.baseUrl" class="error-text">{{ errors.baseUrl }}</span>
            </div>

            <div class="form-group half">
              <label class="form-label" :class="{ dark: isDark }">API 密钥</label>
              <div class="input-with-icon">
                <input
                  v-model="embyForm.apiKey"
                  :type="showApiKey ? 'text' : 'password'"
                  placeholder="在Emby控制台生成"
                  class="form-input"
                  :class="{ dark: isDark, error: errors.apiKey }"
                />
                <button
                  type="button"
                  class="toggle-visibility"
                  :class="{ dark: isDark }"
                  @click="showApiKey = !showApiKey"
                >
                  <svg v-if="showApiKey" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
              <span v-if="errors.apiKey" class="error-text">{{ errors.apiKey }}</span>
            </div>
          </div>

          <div class="form-row proxy-row">
            <div class="form-group half toggle-center">
              <div class="toggle-row">
                <label class="form-label" :class="{ dark: isDark }">启用反代</label>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="embyForm.proxyEnabled" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div class="form-group half" v-if="embyForm.proxyEnabled">
              <label class="form-label" :class="{ dark: isDark }">反代端口</label>
              <input
                v-model.number="embyForm.proxyPort"
                type="number"
                placeholder="8097"
                class="form-input"
                :class="{ dark: isDark }"
                min="1"
                max="65535"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 115云盘配置卡片 -->
      <div class="settings-card" :class="{ dark: isDark }">
        <div class="card-header">
          <div class="card-header-left">
            <div class="card-header-icon">
              <img src="/logo115.png" alt="115云盘" />
            </div>
            <div class="card-header-info">
              <h3 class="card-title" :class="{ dark: isDark }">115云盘配置</h3>
            </div>
          </div>
          <div v-if="ckStatus.show" class="connection-status" :class="ckStatus.type">
            <span class="status-dot"></span>
            <span class="status-text">{{ ckStatus.text }}</span>
          </div>
        </div>
        <div class="card-content">
          <div class="form-group">
            <label class="form-label" :class="{ dark: isDark }">云盘 CK</label>
            <div class="input-with-btn">
              <input
                v-model="pan115Form.cookie"
                type="text"
                placeholder="通过扫码获取Cookie"
                class="form-input"
                :class="{ dark: isDark }"
                readonly
              />
              <button
                type="button"
                class="btn-scan"
                :class="{ dark: isDark }"
                @click="openQRCodeModal"
                :disabled="qrcodeLoading"
              >
                <svg v-if="qrcodeLoading" class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
                </svg>
                <span v-else>扫码</span>
              </button>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label class="form-label" :class="{ dark: isDark }">云盘保存目录</label>
              <div class="input-with-btn">
                <input
                  v-model="pan115Form.saveDir"
                  type="text"
                  placeholder="点击选择目录"
                  class="form-input"
                  :class="{ dark: isDark }"
                  readonly
                  @click="openSaveDirPicker"
                />
                <button
                  type="button"
                  class="btn-browse"
                  :class="{ dark: isDark }"
                  @click="openSaveDirPicker"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="form-group half">
              <label class="form-label" :class="{ dark: isDark }">云盘媒体库目录</label>
              <div class="input-with-btn">
                <input
                  v-model="pan115Form.mediaDir"
                  type="text"
                  placeholder="点击选择目录"
                  class="form-input"
                  :class="{ dark: isDark }"
                  readonly
                  @click="openMediaDirPicker"
                />
                <button
                  type="button"
                  class="btn-browse"
                  :class="{ dark: isDark }"
                  @click="openMediaDirPicker"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TMDB配置卡片 -->
      <div class="settings-card" :class="{ dark: isDark }">
        <div class="card-header">
          <div class="card-header-left">
            <div class="card-header-icon">
              <img src="/tmdb.svg" alt="TMDB" />
            </div>
            <div class="card-header-info">
              <h3 class="card-title" :class="{ dark: isDark }">TMDB 配置</h3>
            </div>
          </div>
        </div>
        <div class="card-content">
          <div class="form-group">
            <label class="form-label" :class="{ dark: isDark }">代理地址</label>
            <input
              v-model="tmdbForm.apiUrl"
              type="text"
              placeholder="默认: https://api.themoviedb.org"
              class="form-input"
              :class="{ dark: isDark }"
            />
          </div>

          <div class="form-group">
            <label class="form-label" :class="{ dark: isDark }">API 密钥</label>
            <div class="input-with-icon">
              <input
                v-model="tmdbForm.apiKey"
                :type="showTmdbKey ? 'text' : 'password'"
                placeholder="在 themoviedb.org 申请"
                class="form-input"
                :class="{ dark: isDark }"
              />
              <button
                type="button"
                class="toggle-visibility"
                :class="{ dark: isDark }"
                @click="showTmdbKey = !showTmdbKey"
              >
                <svg v-if="showTmdbKey" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- AI识别配置卡片 -->
      <div class="settings-card" :class="{ dark: isDark }">
        <div class="card-header">
          <div class="card-header-left">
            <div class="card-header-icon ai-icon-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
                <circle cx="8" cy="14" r="1"/>
                <circle cx="16" cy="14" r="1"/>
              </svg>
            </div>
            <div class="card-header-info">
              <h3 class="card-title" :class="{ dark: isDark }">AI 辅助识别</h3>
            </div>
          </div>
          <div class="card-header-actions">
            <a href="https://cloud.siliconflow.cn/i/3l7wW2vL" target="_blank" class="register-badge">点我注册</a>
          </div>
        </div>
        <div class="card-content">
          <div class="form-row proxy-row">
            <div class="form-group half toggle-center">
              <div class="toggle-row">
                <label class="form-label" :class="{ dark: isDark }">启用AI识别</label>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="aiForm.enabled" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div class="form-group half" v-if="aiForm.enabled">
              <label class="form-label" :class="{ dark: isDark }">API Key</label>
              <div class="input-with-icon">
                <input
                  v-model="aiForm.apiKey"
                  :type="showAiKey ? 'text' : 'password'"
                  placeholder="硅基流动 API Key"
                  class="form-input"
                  :class="{ dark: isDark }"
                />
                <button
                  type="button"
                  class="toggle-visibility"
                  :class="{ dark: isDark }"
                  @click="showAiKey = !showAiKey"
                >
                  <svg v-if="showAiKey" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div class="form-row" v-if="aiForm.enabled">
            <div class="form-group half">
              <label class="form-label" :class="{ dark: isDark }">API 地址</label>
              <input
                v-model="aiForm.apiUrl"
                type="text"
                placeholder="默认: https://api.siliconflow.cn/v1/chat/completions"
                class="form-input"
                :class="{ dark: isDark }"
              />
            </div>

            <div class="form-group half">
              <label class="form-label" :class="{ dark: isDark }">AI 模型</label>
              <select
                v-model="aiSelectedModel"
                class="form-select"
                :class="{ dark: isDark }"
                :disabled="aiModelsLoading || aiModelOptions.length === 0"
              >
                <option value="">{{ aiModelsLoading ? '加载中...' : aiModelPlaceholder }}</option>
                <option v-for="option in aiModelOptions" :key="option.id" :value="option.id">
                  {{ option.label }}
                </option>
              </select>
              <span v-if="aiModelsError" class="error-text">{{ aiModelsError }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Telegram配置卡片 -->
      <div class="settings-card" :class="{ dark: isDark }">
        <div class="card-header">
          <div class="card-header-left">
            <div class="card-header-icon telegram-icon-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 5L2 12.5l7 1M21 5l-2 14-8-6.5M21 5L9 13.5m0 0V19l3.5-3.5"/>
              </svg>
            </div>
            <div class="card-header-info">
              <h3 class="card-title" :class="{ dark: isDark }">Telegram 配置</h3>
            </div>
          </div>
          <div class="telegram-status-header compact-status-header">
            <div v-if="telegramStatus.connected && telegramStatus.user" class="telegram-header-connected">
              <div class="telegram-status-main">
                <div class="status-badge connected">
                  <span class="status-dot"></span>
                  <span class="status-text">已连接</span>
                </div>
              </div>
              <button class="btn btn-danger btn-xs btn-logout-compact" @click="telegramLogout" :disabled="telegramLoading">
                {{ telegramLoading ? '退出中...' : '登出' }}
              </button>
            </div>
            <div v-else class="telegram-header-disconnected">
              <div class="telegram-status-main">
                <div class="status-badge" :class="telegramStatus.status === 'connecting' ? 'warning' : 'disconnected'">
                  <span class="status-dot"></span>
                  <span class="status-text">{{ telegramStatusText }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="card-content">
          <div class="form-row">
            <div class="form-group half">
              <label class="form-label" :class="{ dark: isDark }">API ID</label>
              <input
                v-model="telegramForm.apiId"
                type="text"
                placeholder="从 my.telegram.org 获取"
                class="form-input"
                :class="{ dark: isDark }"
              />
            </div>
            <div class="form-group half">
              <label class="form-label" :class="{ dark: isDark }">API Hash</label>
              <div class="input-with-icon">
                <input
                  v-model="telegramForm.apiHash"
                  :type="showTelegramHash ? 'text' : 'password'"
                  placeholder="32位十六进制字符串"
                  class="form-input"
                  :class="{ dark: isDark }"
                />
                <button
                  type="button"
                  class="toggle-visibility"
                  :class="{ dark: isDark }"
                  @click="showTelegramHash = !showTelegramHash"
                >
                  <svg v-if="showTelegramHash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" :class="{ dark: isDark }">手机号</label>
            <div class="input-with-button">
              <input
                v-model="telegramForm.phone"
                type="text"
                placeholder="+8613800138000"
                class="form-input"
                :class="{ dark: isDark }"
                :disabled="telegramLoginStep !== 'phone'"
              />
              <button
                v-if="telegramLoginStep === 'phone' && !telegramStatus.connected"
                class="btn btn-secondary btn-sm"
                @click="sendTelegramCode"
                :disabled="telegramLoading || !telegramForm.phone"
              >
                {{ telegramLoading ? '发送中...' : '获取验证码' }}
              </button>
            </div>
          </div>

          <div class="proxy-inline">
            <div class="proxy-toggle">
              <label class="form-label" :class="{ dark: isDark }">代理</label>
              <label class="toggle-switch small">
                <input type="checkbox" v-model="telegramForm.proxyEnabled" />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <input
              v-model="telegramForm.proxyUrl"
              type="text"
              placeholder="socks5://user:pass@127.0.0.1:1080"
              class="form-input proxy-input"
              :class="{ dark: isDark }"
              :disabled="!telegramForm.proxyEnabled"
            />
          </div>

          <div v-if="!telegramStatus.connected" class="telegram-login-section">
            <div v-if="telegramLoginStep === 'code'" class="form-group">
              <label class="form-label" :class="{ dark: isDark }">验证码</label>
              <input
                v-model="telegramForm.code"
                type="text"
                placeholder="输入收到的验证码"
                class="form-input"
                :class="{ dark: isDark }"
              />
            </div>
            <div v-if="telegramLoginStep === 'password'" class="form-group">
              <label class="form-label" :class="{ dark: isDark }">两步验证密码</label>
              <input
                v-model="telegramForm.password"
                type="password"
                placeholder="输入两步验证密码"
                class="form-input"
                :class="{ dark: isDark }"
              />
            </div>
            <div v-if="telegramLoginStep !== 'phone'" class="telegram-actions">
              <button
                v-if="telegramLoginStep === 'code'"
                class="btn btn-primary"
                @click="signInTelegram"
                :disabled="telegramLoading || !telegramForm.code"
              >
                {{ telegramLoading ? '登录中...' : '确认登录' }}
              </button>
              <button
                v-if="telegramLoginStep === 'password'"
                class="btn btn-primary"
                @click="signInTelegramWithPassword"
                :disabled="telegramLoading || !telegramForm.password"
              >
                {{ telegramLoading ? '验证中...' : '提交验证' }}
              </button>
              <button class="btn btn-secondary" @click="resetTelegramLogin">
                返回
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Telegram权限配置卡片 -->
      <div class="settings-card" :class="{ dark: isDark }">
        <div class="card-header">
          <div class="card-header-left">
            <div class="card-header-icon telegram-icon-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div class="card-header-info">
              <h3 class="card-title" :class="{ dark: isDark }">Telegram 权限配置</h3>
            </div>
          </div>
        </div>
        <div class="card-content">
          <div class="form-group">
            <label class="form-label" :class="{ dark: isDark }">管理员 ID</label>
            <input
              v-model="telegramPermissionForm.adminIds"
              type="text"
              placeholder="多个ID用逗号分隔，如: 12345678,87654321"
              class="form-input"
              :class="{ dark: isDark }"
            />
          </div>

          <div class="form-group">
            <label class="form-label" :class="{ dark: isDark }">白名单群组/频道</label>
            <input
              v-model="telegramPermissionForm.whitelistChats"
              type="text"
              placeholder="多个ID用逗号分隔，如: -1001234567890,-1009876543210"
              class="form-input"
              :class="{ dark: isDark }"
            />
          </div>

          <div class="form-group">
            <label class="form-label" :class="{ dark: isDark }">通知群组</label>
            <input
              v-model="telegramPermissionForm.notifyChat"
              type="text"
              placeholder="如: -1001234567890"
              class="form-input"
              :class="{ dark: isDark }"
            />
          </div>
        </div>
      </div>

      <!-- 微信配置卡片 -->
      <div class="settings-card" :class="{ dark: isDark }">
        <div class="card-header">
          <div class="card-header-left">
            <div class="card-header-icon wechat-icon-header">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.269-.03-.406-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
              </svg>
            </div>
            <div class="card-header-info">
              <h3 class="card-title" :class="{ dark: isDark }">微信配置</h3>
            </div>
          </div>
          <div class="telegram-status-header">
            <div v-if="wechatStatus.connected" class="telegram-header-connected">
              <button class="btn btn-danger btn-xs btn-logout-compact" @click="wechatLogout" :disabled="wechatLoading">
                {{ wechatLoading ? '登出中...' : '登出' }}
              </button>
            </div>
            <div v-else class="telegram-header-disconnected">
              <div class="status-badge disconnected">
                <span class="status-dot"></span>
                <span class="status-text">未连接</span>
              </div>
            </div>
          </div>
        </div>
        <div class="card-content">
          <div v-if="wechatInitializing" class="wechat-login-section">
            <p class="wechat-hint" :class="{ dark: isDark }">正在连接微信...</p>
          </div>
          <div v-else-if="!wechatStatus.connected" class="wechat-login-section">
            <p v-if="!wechatQRCodeUrl" class="wechat-hint" :class="{ dark: isDark }">点击下方按钮获取登录二维码，使用微信扫码登录</p>
            <div v-if="wechatQRCodeUrl" class="wechat-qrcode-container">
              <img :src="wechatQRCodeUrl" alt="微信登录二维码" class="wechat-qrcode-img" />
              <p class="wechat-qrcode-hint" :class="{ dark: isDark }">请使用微信扫描二维码登录</p>
            </div>
            <button
              class="btn btn-primary wechat-login-btn"
              @click="getWechatQRCode"
              :disabled="wechatLoading"
            >
              <span v-if="wechatLoading" class="wechat-loading-text">获取中...</span>
              <span v-else>{{ wechatQRCodeUrl ? '刷新二维码' : '获取登录二维码' }}</span>
            </button>
          </div>
          <div v-else class="wechat-config-section">
            <div class="wechat-connected-info">
              <p class="wechat-connected-text" :class="{ dark: isDark }">
                ✅ 已连接 {{ wechatStatus.botId || 'Bot' }} 为您服务
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- STRM配置卡片 -->
      <div class="settings-card" :class="{ dark: isDark }">
        <div class="card-header">
          <div class="card-header-left">
            <div class="card-header-icon strm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div class="card-header-info">
              <h3 class="card-title" :class="{ dark: isDark }">STRM 配置</h3>
            </div>
          </div>
        </div>
        <div class="card-content">
          <div class="form-group">
            <label class="form-label" :class="{ dark: isDark }">服务器地址</label>
            <input
              v-model="strmForm.serverUrl"
              type="text"
              placeholder="如: http://192.168.1.100:3000"
              class="form-input"
              :class="{ dark: isDark }"
            />
          </div>

          <div class="form-group">
            <button
              type="button"
              class="btn btn-primary"
              :disabled="strmGenerating"
              @click="generateStrm"
            >
              <span v-if="strmGenerating">生成中...</span>
              <span v-else>生成STRM</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 全局保存按钮 -->
    <div class="save-bar" :class="{ dark: isDark }">
      <button
        class="btn btn-primary"
        :disabled="saving"
        @click="saveAllConfig"
      >
        <span v-if="saving">保存中...</span>
        <span v-else>保存配置</span>
      </button>
    </div>

    <!-- 状态提示 -->
    <Transition name="toast">
      <div v-if="message" class="alert" :class="[messageType, { dark: isDark }]">
        <svg v-if="messageType === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <svg v-else-if="messageType === 'warning'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <span>{{ message }}</span>
      </div>
    </Transition>

    <!-- 二维码弹窗 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showQRCodeModal" class="qrcode-modal-overlay" @click.self="closeQRCodeModal">
          <Transition name="zoom">
            <div v-if="showQRCodeModal" class="qrcode-modal" :class="{ dark: isDark }">
              <div class="qrcode-header">
                <h3>115云盘扫码登录</h3>
                <button class="btn-close" :class="{ dark: isDark }" @click="closeQRCodeModal">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div class="qrcode-content">
                <div class="device-select-row">
                  <div class="device-select">
                    <label class="form-label" :class="{ dark: isDark }">设备类型</label>
                    <select
                      v-model="selectedDevice"
                      class="form-select"
                      :class="{ dark: isDark }"
                      @change="onDeviceChange"
                    >
                      <option v-for="device in deviceTypes" :key="device.value" :value="device.value">
                        {{ device.label }}
                      </option>
                    </select>
                  </div>
                  <div class="device-select">
                    <label class="form-label" :class="{ dark: isDark }">AppID</label>
                    <select
                      v-model="pan115Form.appId"
                      class="form-select"
                      :class="{ dark: isDark }"
                    >
                      <option v-for="app in appIds" :key="app.value" :value="app.value">
                        {{ app.label }}
                      </option>
                    </select>
                  </div>
                </div>

                <div v-if="qrcodeLoading" class="qrcode-loading">
                  <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
                  </svg>
                  <p>正在获取二维码...</p>
                </div>
                <div v-else-if="qrcodeImage" class="qrcode-image">
                  <img :src="qrcodeImage" alt="QR Code" />
                  <p class="qrcode-tip">{{ qrcodeStatus }}</p>
                </div>
                <div v-else class="qrcode-error">
                  <p>{{ qrcodeError }}</p>
                  <button class="btn btn-primary" @click="getQRCode">重新获取</button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- 目录选择器 -->
    <DirectoryPicker
      v-model:show="showDirPicker"
      v-model="currentDirPickerValue"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted, onUnmounted, watch } from 'vue'
import { useSettings } from '~/composables/useSettings'

const { loadSettings: loadSharedSettings, updateSettingsData } = useSettings()

definePageMeta({
  layout: 'default'
})

interface AIModelOption {
  id: string
  label: string
}

interface SettingsResponse {
  success: boolean
  data?: {
    embyBaseUrl?: string
    embyApiKey?: string
    embyProxyEnabled?: boolean
    embyProxyPort?: number
    pan115Cookie?: string
    pan115SaveDir?: string
    pan115MediaDir?: string
    pan115AppId?: string
    pan115OpenToken?: string
    tmdbApiUrl?: string
    tmdbApiKey?: string
    strmServerUrl?: string
    aiRecognizeEnabled?: string
    aiApiKey?: string
    aiApiUrl?: string
    aiModel?: string
  }
}

interface TelegramConfigResponse {
  success: boolean
  data?: {
    configured: boolean
    connected: boolean
    status: string
    error?: string
    user?: {
      id: string
      username?: string
      phone?: string
    }
    apiId?: string
    apiHash?: string
    phone?: string
    proxyEnabled?: boolean
    proxyUrl?: string
    adminIds?: string
    whitelistChats?: string
    notifyChat?: string
  }
}

interface WechatConfigResponse {
  success: boolean
  data?: {
    configured: boolean
    connected: boolean
    status: string
    botId?: string
    userId?: string
  }
}

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

const embyForm = reactive({
  baseUrl: '',
  apiKey: '',
  proxyEnabled: false,
  proxyPort: 8097
})

const pan115Form = reactive({
  cookie: '',
  saveDir: '',
  mediaDir: '',
  appId: '',
  openToken: ''
})

const tmdbForm = reactive({
  apiUrl: '',
  apiKey: ''
})

const aiForm = reactive({
  enabled: false,
  apiKey: '',
  apiUrl: '',
  model: ''
})

const aiModelOptions = ref<AIModelOption[]>([])
const aiModelsLoading = ref(false)
const aiModelsError = ref('')
const aiSelectedModel = ref('')
const aiModelsRequestToken = ref(0)
let aiModelsLoadTimer: NodeJS.Timeout | null = null

const aiModelPlaceholder = computed(() => {
  if (!aiForm.apiUrl.trim()) {
    return '请先填写 AI API 地址'
  }

  if (!aiForm.apiKey.trim()) {
    return '请先填写 AI API Key'
  }

  if (aiForm.model.trim()) {
    return `当前：${aiForm.model.trim()}`
  }

  return '暂无模型列表'
})

const telegramForm = reactive({
  apiId: '',
  apiHash: '',
  phone: '',
  code: '',
  password: '',
  proxyEnabled: false,
  proxyUrl: ''
})

const telegramPermissionForm = reactive({
  adminIds: '',
  whitelistChats: '',
  notifyChat: ''
})

const telegramStatus = ref<{
  configured: boolean
  connected: boolean
  status: string
  error?: string
  user?: {
    id: string
    username?: string
    phone?: string
    firstName?: string
    lastName?: string
  }
}>({
  configured: false,
  connected: false,
  status: 'disconnected'
})

const telegramLoginStep = ref<'phone' | 'code' | 'password'>('phone')
const telegramLoading = ref(false)
const showTelegramHash = ref(false)

const telegramStatusText = computed(() => {
  switch (telegramStatus.value.status) {
    case 'connecting':
      return '连接中'
    case 'waiting_code':
      return '等待验证码'
    case 'waiting_password':
      return '等待两步验证'
    default:
      return '未连接'
  }
})

const wechatStatus = ref<{
  configured: boolean
  connected: boolean
  status: string
  botId?: string
  userId?: string
}>({
  configured: false,
  connected: false,
  status: 'disconnected'
})

const wechatLoading = ref(false)
const wechatQRCodeUrl = ref('')
const wechatInitializing = ref(false)

const strmForm = reactive({
  serverUrl: ''
})
const strmGenerating = ref(false)

const showDirPicker = ref(false)
const currentDirPickerTarget = ref<'save' | 'media'>('save')
const currentDirPickerValue = ref('')

const errors = reactive({
  baseUrl: '',
  apiKey: ''
})

const saving = ref(false)
const message = ref('')
const messageType = ref<'success' | 'warning' | 'error'>('success')
let messageTimer: NodeJS.Timeout | null = null

const showApiKey = ref(false)
const showTmdbKey = ref(false)
const showAiKey = ref(false)

const connectionStatus = reactive({
  show: false,
  type: 'success' as 'success' | 'error',
  text: ''
})

const ckStatus = reactive({
  show: false,
  type: 'success' as 'success' | 'error',
  text: ''
})

const showQRCodeModal = ref(false)
const qrcodeLoading = ref(false)
const qrcodeImage = ref('')
const qrcodeStatus = ref('请使用115手机APP扫描二维码')
const qrcodeError = ref('')
const selectedDevice = ref('web')
const deviceTypes = ref<{ value: string; label: string }[]>([])
let qrcodeCheckTimer: NodeJS.Timeout | null = null

function syncAiSelectedModel() {
  const matched = aiModelOptions.value.find(option => option.id === aiForm.model)
  aiSelectedModel.value = matched?.id || ''
}

function scheduleAiModelsLoad() {
  if (aiModelsLoadTimer) {
    clearTimeout(aiModelsLoadTimer)
  }

  aiModelsLoadTimer = setTimeout(() => {
    aiModelsLoadTimer = null
    loadAiModels()
  }, 300)
}

async function loadAiModels() {
  const apiUrl = aiForm.apiUrl.trim()
  const apiKey = aiForm.apiKey.trim()
  const requestToken = ++aiModelsRequestToken.value

  aiModelsError.value = ''

  if (!apiUrl || !apiKey) {
    aiModelsLoading.value = false
    aiModelOptions.value = []
    syncAiSelectedModel()
    return
  }

  aiModelsLoading.value = true

  try {
    const response = await $fetch<{ success: boolean; models?: AIModelOption[]; error?: string }>('/api/ai/models', {
      method: 'POST',
      body: {
        apiUrl,
        apiKey,
      }
    })

    if (requestToken !== aiModelsRequestToken.value) {
      return
    }

    if (!response.success || !response.models) {
      aiModelOptions.value = []
      aiModelsError.value = response.error || '获取模型列表失败'
      syncAiSelectedModel()
      return
    }

    aiModelOptions.value = response.models
    syncAiSelectedModel()
  } catch (e: any) {
    if (requestToken !== aiModelsRequestToken.value) {
      return
    }

    aiModelOptions.value = []
    aiModelsError.value = e.message || '获取模型列表失败'
    syncAiSelectedModel()
  } finally {
    if (requestToken === aiModelsRequestToken.value) {
      aiModelsLoading.value = false
    }
  }
}

watch(() => aiForm.model, () => {
  syncAiSelectedModel()
})

watch(aiSelectedModel, (value) => {
  if (value !== aiForm.model) {
    aiForm.model = value
  }
})

watch(
  () => [aiForm.apiUrl, aiForm.apiKey, aiForm.enabled] as const,
  ([apiUrl, apiKey, enabled], previousValues) => {
    const currentApiUrl = apiUrl.trim()
    const currentApiKey = apiKey.trim()
    const nextEnabled = !!enabled
    const previousApiUrl = previousValues?.[0]?.trim() || ''
    const previousApiKey = previousValues?.[1]?.trim() || ''
    const previousEnabled = !!previousValues?.[2]

    aiModelsRequestToken.value += 1
    aiModelsError.value = ''
    aiModelsLoading.value = false

    if (aiModelsLoadTimer) {
      clearTimeout(aiModelsLoadTimer)
      aiModelsLoadTimer = null
    }

    if (!nextEnabled || !currentApiUrl || !currentApiKey) {
      aiModelOptions.value = []
      syncAiSelectedModel()
      return
    }

    if (
      currentApiUrl === previousApiUrl
      && currentApiKey === previousApiKey
      && nextEnabled === previousEnabled
    ) {
      return
    }

    scheduleAiModelsLoad()
  },
  { immediate: true }
)

const appIds = [
  { value: '100195137', label: 'VidHub' },
  { value: '100195793', label: 'Senplayer' },
  { value: '100195145', label: 'Filebar' },
  { value: '100196987', label: 'CloudDrive2' },
  { value: '100195271', label: '飞牛私有云' },
  { value: '100195135', label: '网易爆米花' },
  { value: '100195199', label: '极空间' }
]

async function saveAppId() {
  const appId = pan115Form.appId.trim()
  try {
    await $fetch('/api/settings', {
      method: 'POST',
      body: {
        pan115AppId: appId
      }
    })
    updateSettingsData({ pan115AppId: appId })
  } catch (e: any) {
    console.error('保存AppID失败:', e)
  }
}

let telegramStatusPollingTimer: NodeJS.Timeout | null = null

async function loadTelegramConfig() {
  try {
    const tgResponse = await $fetch<TelegramConfigResponse>('/api/telegram/config')

    if (tgResponse.success && tgResponse.data) {
      telegramStatus.value = {
        configured: tgResponse.data.configured,
        connected: tgResponse.data.connected,
        status: tgResponse.data.status,
        error: tgResponse.data.error,
        user: tgResponse.data.user
      }
      telegramForm.apiId = tgResponse.data.apiId || ''
      telegramForm.apiHash = tgResponse.data.apiHash || ''
      telegramForm.phone = tgResponse.data.phone || ''
      telegramForm.proxyEnabled = tgResponse.data.proxyEnabled || false
      telegramForm.proxyUrl = tgResponse.data.proxyUrl || ''

      telegramPermissionForm.adminIds = tgResponse.data.adminIds || ''
      telegramPermissionForm.whitelistChats = tgResponse.data.whitelistChats || ''
      telegramPermissionForm.notifyChat = tgResponse.data.notifyChat || ''

      if (tgResponse.data.connected) {
        telegramLoginStep.value = 'phone'
        telegramForm.code = ''
        telegramForm.password = ''
        stopTelegramStatusPolling()
      } else if (tgResponse.data.status === 'waiting_password') {
        telegramLoginStep.value = 'password'
      } else if (tgResponse.data.status === 'waiting_code') {
        telegramLoginStep.value = 'phone'
      }
    }
  } catch (e: any) {
    console.error('加载 Telegram 配置失败:', e)
  }
}

function startTelegramStatusPolling() {
  if (telegramStatusPollingTimer) {
    clearInterval(telegramStatusPollingTimer)
  }

  telegramStatusPollingTimer = setInterval(async () => {
    await loadTelegramConfig()

    if (telegramStatus.value.connected || telegramStatus.value.status !== 'connecting') {
      stopTelegramStatusPolling()
    }
  }, 1500)

  setTimeout(() => {
    stopTelegramStatusPolling()
  }, 20000)
}

function stopTelegramStatusPolling() {
  if (telegramStatusPollingTimer) {
    clearInterval(telegramStatusPollingTimer)
    telegramStatusPollingTimer = null
  }
}

function clearMessageTimer() {
  if (messageTimer) {
    clearTimeout(messageTimer)
    messageTimer = null
  }
}

async function loadSettings() {
  try {
    const [settingsRes, wechatResponse] = await Promise.all([
      loadSharedSettings(),
      $fetch<WechatConfigResponse>('/api/wechat/config')
    ])

    if (settingsRes.success && settingsRes.data) {
      embyForm.baseUrl = settingsRes.data.embyBaseUrl || ''
      embyForm.apiKey = settingsRes.data.embyApiKey || ''
      embyForm.proxyEnabled = settingsRes.data.embyProxyEnabled || false
      embyForm.proxyPort = settingsRes.data.embyProxyPort || 8097
      pan115Form.cookie = settingsRes.data.pan115Cookie || ''
      pan115Form.saveDir = settingsRes.data.pan115SaveDir || ''
      pan115Form.mediaDir = settingsRes.data.pan115MediaDir || ''
      pan115Form.appId = settingsRes.data.pan115AppId || '100195137'
      pan115Form.openToken = settingsRes.data.pan115OpenToken || ''
      tmdbForm.apiUrl = settingsRes.data.tmdbApiUrl || ''
      tmdbForm.apiKey = settingsRes.data.tmdbApiKey || ''
      strmForm.serverUrl = settingsRes.data.strmServerUrl || ''
      aiForm.enabled = settingsRes.data.aiRecognizeEnabled === 'true'
      aiForm.apiKey = settingsRes.data.aiApiKey || ''
      aiForm.apiUrl = settingsRes.data.aiApiUrl || ''
      aiForm.model = settingsRes.data.aiModel || ''
      syncAiSelectedModel()

      if (embyForm.baseUrl && embyForm.apiKey) {
        testConnection(true).catch(() => {})
      }

      if (pan115Form.cookie) {
        checkCKStatus().catch(() => {})
      }
    }

    await loadTelegramConfig()

    if (telegramStatus.value.status === 'connecting') {
      startTelegramStatusPolling()
    }

    if (wechatResponse.success && wechatResponse.data) {
      wechatStatus.value = {
        configured: wechatResponse.data.configured,
        connected: wechatResponse.data.connected,
        status: wechatResponse.data.status,
        botId: wechatResponse.data.botId,
        userId: wechatResponse.data.userId
      }

      if (wechatResponse.data.configured && !wechatResponse.data.connected && !wechatInitializing.value) {
        wechatInitializing.value = true
        pollWechatStatus()
      }
    }
  } catch (e: any) {
    console.error('加载配置失败:', e)
  }
}

function pollWechatStatus() {
  const timer = setInterval(async () => {
    try {
      const response = await $fetch('/api/wechat/config') as any
      if (response.success && response.data) {
        wechatStatus.value = {
          configured: response.data.configured,
          connected: response.data.connected,
          status: response.data.status,
          botId: response.data.botId,
          userId: response.data.userId
        }
        if (response.data.connected) {
          wechatInitializing.value = false
          clearInterval(timer)
        }
      }
    } catch (e) {
      console.error('轮询微信状态失败:', e)
    }
  }, 2000)

  setTimeout(() => {
    clearInterval(timer)
    wechatInitializing.value = false
  }, 30000)
}

async function checkCKStatus() {
  if (!pan115Form.cookie.trim()) {
    ckStatus.show = false
    return
  }

  try {
    const response = await $fetch('/api/pan115/user_info_115') as any

    if (response.success && response.valid) {
      ckStatus.show = true
      ckStatus.type = 'success'
      ckStatus.text = `CK有效：${response.user_name || '未知用户'}`
    } else {
      ckStatus.show = true
      ckStatus.type = 'error'
      ckStatus.text = 'CK无效，请扫码登录'
    }
  } catch (e: any) {
    ckStatus.show = true
    ckStatus.type = 'error'
    ckStatus.text = 'CK无效，请扫码登录'
  }
}

async function loadDeviceTypes() {
  try {
    const response = await $fetch('/api/pan115/qrcode_115?action=devices') as any
    if (response.success && response.devices) {
      deviceTypes.value = response.devices
    }
  } catch (e: any) {
    console.error('加载设备类型失败:', e)
  }
}

function validateForm(): boolean {
  errors.baseUrl = ''
  errors.apiKey = ''
  let valid = true

  if (!embyForm.baseUrl.trim()) {
    errors.baseUrl = '请输入Emby地址'
    valid = false
  } else if (!embyForm.baseUrl.startsWith('http://') && !embyForm.baseUrl.startsWith('https://')) {
    errors.baseUrl = '地址必须以 http:// 或 https:// 开头'
    valid = false
  }

  if (!embyForm.apiKey.trim()) {
    errors.apiKey = '请输入API密钥'
    valid = false
  }

  return valid
}

async function testConnection(silent: boolean = false) {
  if (!embyForm.baseUrl.trim() || !embyForm.apiKey.trim()) {
    connectionStatus.show = false
    return
  }

  try {
    const response = await $fetch('/api/settings', {
      method: 'POST',
      body: {
        embyBaseUrl: embyForm.baseUrl.trim(),
        embyApiKey: embyForm.apiKey.trim(),
        testOnly: true
      }
    }) as any

    if (response.success) {
      connectionStatus.show = true
      connectionStatus.type = 'success'
      connectionStatus.text = `连接成功：${response.serverName || 'Emby服务器'}`
    } else {
      connectionStatus.show = true
      connectionStatus.type = 'error'
      connectionStatus.text = '连接失败'
    }
  } catch (e: any) {
    connectionStatus.show = true
    connectionStatus.type = 'error'
    connectionStatus.text = '连接失败'
  }
}

async function openQRCodeModal() {
  showQRCodeModal.value = true
  await loadDeviceTypes()
  await getQRCode()
}

function closeQRCodeModal() {
  showQRCodeModal.value = false
  qrcodeImage.value = ''
  qrcodeStatus.value = '请使用115手机APP扫描二维码'
  qrcodeError.value = ''
  if (qrcodeCheckTimer) {
    clearInterval(qrcodeCheckTimer)
    qrcodeCheckTimer = null
  }
}

async function onDeviceChange() {
  await getQRCode()
}

async function getQRCode() {
  qrcodeLoading.value = true
  qrcodeError.value = ''
  qrcodeImage.value = ''

  try {
    const response = await $fetch(`/api/pan115/qrcode_115?device=${selectedDevice.value}`) as any
    
    if (response.success && response.qrcode_image) {
      qrcodeImage.value = response.qrcode_image
      qrcodeStatus.value = '请使用115手机APP扫描二维码'
      startQRCodeCheck()
    } else {
      qrcodeError.value = response.error || '获取二维码失败'
    }
  } catch (e: any) {
    qrcodeError.value = e.message || '获取二维码失败'
  } finally {
    qrcodeLoading.value = false
  }
}

function startQRCodeCheck() {
  if (qrcodeCheckTimer) {
    clearInterval(qrcodeCheckTimer)
  }

  qrcodeCheckTimer = setInterval(async () => {
    try {
      const response = await $fetch('/api/pan115/qrcode_115', {
        method: 'POST'
      }) as any

      if (response.success) {
        if (response.status === 0) {
          qrcodeStatus.value = '请使用115手机APP扫描二维码'
        } else if (response.status === 1) {
          qrcodeStatus.value = '已扫码，请在手机端确认登录'
        } else if (response.status === 2 && response.cookie) {
          pan115Form.cookie = response.cookie
          closeQRCodeModal()
          await saveAppId()
          message.value = '115云盘登录成功，Cookie和AppID已自动保存'
          messageType.value = 'success'
          await checkCKStatus()
        }
      } else {
        if (response.status === -1) {
          qrcodeStatus.value = '二维码已过期，请重新获取'
          if (qrcodeCheckTimer) {
            clearInterval(qrcodeCheckTimer)
            qrcodeCheckTimer = null
          }
        } else if (response.status === -2) {
          qrcodeStatus.value = '登录已取消'
          if (qrcodeCheckTimer) {
            clearInterval(qrcodeCheckTimer)
            qrcodeCheckTimer = null
          }
        } else {
          qrcodeStatus.value = response.error || '检查状态失败'
        }
      }
    } catch (e: any) {
      // 忽略检查错误，继续轮询
    }
  }, 2000)
}

async function saveAllConfig() {
  saving.value = true
  message.value = ''

  const settingsPayload = {
    embyBaseUrl: embyForm.baseUrl.trim(),
    embyApiKey: embyForm.apiKey.trim(),
    embyProxyEnabled: embyForm.proxyEnabled,
    embyProxyPort: embyForm.proxyPort,
    pan115Cookie: pan115Form.cookie.trim(),
    pan115SaveDir: pan115Form.saveDir.trim(),
    pan115MediaDir: pan115Form.mediaDir.trim(),
    pan115AppId: pan115Form.appId.trim(),
    tmdbApiUrl: tmdbForm.apiUrl.trim(),
    tmdbApiKey: tmdbForm.apiKey.trim(),
    strmServerUrl: strmForm.serverUrl.trim(),
    aiRecognizeEnabled: aiForm.enabled ? 'true' : 'false',
    aiApiKey: aiForm.apiKey.trim(),
    aiApiUrl: aiForm.apiUrl.trim(),
    aiModel: aiForm.model.trim()
  }

  try {
    const response = await $fetch('/api/settings', {
      method: 'POST',
      body: settingsPayload
    }) as any

    if (response.success) {
      const tgResponse = await $fetch('/api/telegram/config', {
        method: 'POST',
        body: {
          action: 'saveConfig',
          apiId: telegramForm.apiId,
          apiHash: telegramForm.apiHash,
          phone: telegramForm.phone,
          proxyEnabled: telegramForm.proxyEnabled,
          proxyUrl: telegramForm.proxyUrl,
          adminIds: telegramPermissionForm.adminIds,
          whitelistChats: telegramPermissionForm.whitelistChats,
          notifyChat: telegramPermissionForm.notifyChat
        }
      }) as any

      if (!tgResponse.success) {
        message.value = tgResponse.error || 'Telegram 配置保存失败'
        messageType.value = 'error'
        saving.value = false
        return
      }

      updateSettingsData({
        ...settingsPayload,
        pan115OpenToken: pan115Form.openToken.trim()
      })

      telegramStatus.value.configured = !!(telegramForm.apiId && telegramForm.apiHash)

      message.value = '配置保存成功'
      messageType.value = 'success'

      if (response.serverName) {
        connectionStatus.show = true
        connectionStatus.type = 'success'
        connectionStatus.text = `连接成功：${response.serverName}`
      } else if (response.warning) {
        connectionStatus.show = true
        connectionStatus.type = 'error'
        connectionStatus.text = '连接失败'
        message.value = `配置已保存，但连接测试失败: ${response.error || '未知错误'}`
        messageType.value = 'warning'
      }
    } else {
      message.value = response.error || '保存失败'
      messageType.value = 'error'
      connectionStatus.show = true
      connectionStatus.type = 'error'
      connectionStatus.text = '连接失败'
    }
  } catch (e: any) {
    message.value = e.message || '保存失败'
    messageType.value = 'error'
    connectionStatus.show = true
    connectionStatus.type = 'error'
    connectionStatus.text = '连接失败'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadSettings()
})

watch(message, (value) => {
  clearMessageTimer()

  if (!value) return

  messageTimer = setTimeout(() => {
    message.value = ''
  }, 3000)
})

onUnmounted(() => {
  clearMessageTimer()
  if (qrcodeCheckTimer) {
    clearInterval(qrcodeCheckTimer)
  }
  if (aiModelsLoadTimer) {
    clearTimeout(aiModelsLoadTimer)
    aiModelsLoadTimer = null
  }
  stopTelegramStatusPolling()
  stopWechatLoginPolling()
})

async function sendTelegramCode() {
  if (!telegramForm.phone) {
    message.value = '请输入手机号'
    messageType.value = 'error'
    return
  }
  
  if (!telegramForm.apiId || !telegramForm.apiHash) {
    message.value = '请先配置 API ID 和 API Hash'
    messageType.value = 'error'
    return
  }
  
  telegramLoading.value = true
  try {
    const saveResponse = await $fetch('/api/telegram/config', {
      method: 'POST',
      body: {
        action: 'saveConfig',
        apiId: telegramForm.apiId,
        apiHash: telegramForm.apiHash,
        phone: telegramForm.phone,
        proxyEnabled: telegramForm.proxyEnabled,
        proxyUrl: telegramForm.proxyUrl
      }
    }) as any
    
    if (!saveResponse.success) {
      message.value = saveResponse.error || '保存配置失败'
      messageType.value = 'error'
      telegramLoading.value = false
      return
    }

    const codeResponse = await $fetch('/api/telegram/config', {
      method: 'POST',
      body: {
        action: 'sendCode',
        phone: telegramForm.phone
      }
    }) as any
    
    if (codeResponse.success) {
      message.value = '验证码已发送'
      messageType.value = 'success'
      telegramLoginStep.value = 'code'
    } else {
      message.value = codeResponse.error || '发送失败'
      messageType.value = 'error'
    }
  } catch (e: any) {
    message.value = e.message || '发送失败'
    messageType.value = 'error'
  } finally {
    telegramLoading.value = false
  }
}

async function signInTelegram() {
  if (!telegramForm.code) {
    message.value = '请输入验证码'
    messageType.value = 'error'
    return
  }
  
  telegramLoading.value = true
  try {
    const response = await $fetch('/api/telegram/config', {
      method: 'POST',
      body: {
        action: 'signIn',
        phone: telegramForm.phone,
        code: telegramForm.code
      }
    }) as any
    
    if (response.success) {
      message.value = '登录成功'
      messageType.value = 'success'
      telegramLoginStep.value = 'phone'
      telegramForm.code = ''
      await loadTelegramConfig()
    } else if (response.needPassword) {
      telegramLoginStep.value = 'password'
    } else {
      message.value = response.error || '登录失败'
      messageType.value = 'error'
    }
  } catch (e: any) {
    message.value = e.message || '登录失败'
    messageType.value = 'error'
  } finally {
    telegramLoading.value = false
  }
}

async function signInTelegramWithPassword() {
  if (!telegramForm.password) {
    message.value = '请输入密码'
    messageType.value = 'error'
    return
  }
  
  telegramLoading.value = true
  try {
    const response = await $fetch('/api/telegram/config', {
      method: 'POST',
      body: {
        action: 'signInWithPassword',
        password: telegramForm.password
      }
    }) as any
    
    if (response.success) {
      message.value = '登录成功'
      messageType.value = 'success'
      telegramLoginStep.value = 'phone'
      telegramForm.password = ''
      await loadTelegramConfig()
    } else {
      message.value = response.error || '验证失败'
      messageType.value = 'error'
    }
  } catch (e: any) {
    message.value = e.message || '验证失败'
    messageType.value = 'error'
  } finally {
    telegramLoading.value = false
  }
}

function resetTelegramLogin() {
  telegramLoginStep.value = 'phone'
  telegramForm.code = ''
  telegramForm.password = ''
}

async function generateStrm() {
  if (!strmForm.serverUrl.trim()) {
    message.value = '请填写服务器地址'
    messageType.value = 'error'
    return
  }
  
  strmGenerating.value = true
  message.value = ''
  
  try {
    const response = await $fetch('/api/pan115/strm115', {
      method: 'POST'
    }) as any
    
    if (response.success) {
      message.value = `✅ STRM 文件生成完成\n📁 总文件数: ${response.totalFiles}\n✅ 成功生成: ${response.generatedFiles}\n⏭️ 已跳过: ${response.skippedFiles}\n⏱️ 耗时: ${response.elapsed} 秒`
      messageType.value = 'success'
    } else {
      message.value = response.error || '生成失败'
      messageType.value = 'error'
    }
  } catch (e: any) {
    message.value = e.message || '生成失败'
    messageType.value = 'error'
  } finally {
    strmGenerating.value = false
  }
}

async function telegramLogout() {
  telegramLoading.value = true
  try {
    const response = await $fetch('/api/telegram/config', {
      method: 'POST',
      body: {
        action: 'logout'
      }
    }) as any
    
    if (response.success) {
      message.value = '已登出'
      messageType.value = 'success'
      telegramStatus.value = {
        configured: true,
        connected: false,
        status: 'disconnected'
      }
    } else {
      message.value = response.error || '登出失败'
      messageType.value = 'error'
    }
  } catch (e: any) {
    message.value = e.message || '登出失败'
    messageType.value = 'error'
  } finally {
    telegramLoading.value = false
  }
}

async function loadWechatConfig() {
  try {
    const response = await $fetch('/api/wechat/config') as any
    if (response.success && response.data) {
      wechatStatus.value = {
        configured: response.data.configured,
        connected: response.data.connected,
        status: response.data.status,
        botId: response.data.botId,
        userId: response.data.userId
      }
    }
  } catch (e: any) {
    console.error('加载微信配置失败:', e)
  }
}

async function getWechatQRCode() {
  wechatLoading.value = true
  try {
    const response = await $fetch('/api/wechat/config', {
      method: 'POST',
      body: {
        action: 'getQRCode',
        forceRefresh: !!wechatQRCodeUrl.value
      }
    }) as any
    
    if (response.success) {
      if (response.qrcodeUrl) {
        wechatQRCodeUrl.value = response.qrcodeUrl
        message.value = '请使用微信扫描二维码登录'
        messageType.value = 'success'
        startWechatLoginPolling()
      } else {
        message.value = '请在微信中扫码登录'
        messageType.value = 'success'
        await loadWechatConfig()
      }
    } else {
      message.value = response.error || '获取二维码失败'
      messageType.value = 'error'
    }
  } catch (e: any) {
    message.value = e.message || '获取二维码失败'
    messageType.value = 'error'
  } finally {
    wechatLoading.value = false
  }
}

let wechatLoginPollingTimer: NodeJS.Timeout | null = null

function startWechatLoginPolling() {
  if (wechatLoginPollingTimer) {
    clearInterval(wechatLoginPollingTimer)
  }
  
  wechatLoginPollingTimer = setInterval(async () => {
    try {
      const response = await $fetch('/api/wechat/config') as any
      if (response.success && response.data?.connected) {
        wechatStatus.value = {
          configured: response.data.configured,
          connected: response.data.connected,
          status: response.data.status,
          botId: response.data.botId,
          userId: response.data.userId
        }
        wechatQRCodeUrl.value = ''
        message.value = '微信登录成功'
        messageType.value = 'success'
        if (wechatLoginPollingTimer) {
          clearInterval(wechatLoginPollingTimer)
          wechatLoginPollingTimer = null
        }
      }
    } catch (e) {
      console.error('轮询微信登录状态失败:', e)
    }
  }, 2000)
}

function stopWechatLoginPolling() {
  if (wechatLoginPollingTimer) {
    clearInterval(wechatLoginPollingTimer)
    wechatLoginPollingTimer = null
  }
}

async function wechatLogout() {
  wechatLoading.value = true
  wechatInitializing.value = false
  try {
    const response = await $fetch('/api/wechat/config', {
      method: 'POST',
      body: {
        action: 'logout'
      }
    }) as any
    
    if (response.success) {
      message.value = '已登出'
      messageType.value = 'success'
      wechatStatus.value = {
        configured: false,
        connected: false,
        status: 'disconnected'
      }
    } else {
      message.value = response.error || '登出失败'
      messageType.value = 'error'
    }
  } catch (e: any) {
    message.value = e.message || '登出失败'
    messageType.value = 'error'
  } finally {
    wechatLoading.value = false
  }
}

function openSaveDirPicker() {
  if (!pan115Form.cookie.trim()) {
    message.value = '请先扫码登录115云盘'
    messageType.value = 'error'
    return
  }
  currentDirPickerTarget.value = 'save'
  currentDirPickerValue.value = pan115Form.saveDir
  showDirPicker.value = true
}

function openMediaDirPicker() {
  if (!pan115Form.cookie.trim()) {
    message.value = '请先扫码登录115云盘'
    messageType.value = 'error'
    return
  }
  currentDirPickerTarget.value = 'media'
  currentDirPickerValue.value = pan115Form.mediaDir
  showDirPicker.value = true
}

watch(currentDirPickerValue, (newVal) => {
  if (newVal) {
    if (currentDirPickerTarget.value === 'save') {
      pan115Form.saveDir = newVal
    } else {
      pan115Form.mediaDir = newVal
    }
  }
})
</script>

<style scoped>
.settings {
  width: 100%;
  padding-bottom: 96px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 16px;
  align-items: start;
  grid-auto-flow: row dense;
}

.settings-card {
  position: relative;
  width: 100%;
  min-width: 0;
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

.settings-card.dark {
  border-color: rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.56);
  box-shadow:
    0 22px 54px rgba(2, 6, 23, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.settings-card:hover {
  transform: translateY(-1px);
  border-color: rgba(96, 165, 250, 0.28);
  box-shadow:
    0 26px 58px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.settings-card.dark:hover {
  border-color: rgba(96, 165, 250, 0.24);
  box-shadow:
    0 26px 58px rgba(2, 6, 23, 0.36),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 16px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.62);
  min-height: 88px;
}

.card-header.dark {
  border-bottom-color: rgba(71, 85, 105, 0.4);
}

.card-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  flex: 1;
}

.card-header-info {
  min-width: 0;
  display: flex;
  align-items: center;
  flex: 1 1 auto;
}

.card-header-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}


.settings-card.dark .card-header-icon {
  background: rgba(30, 41, 59, 0.78);
  border-color: rgba(71, 85, 105, 0.52);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.card-header-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.card-header-icon.strm-icon {
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 12px 28px rgba(102, 126, 234, 0.28);
}

.card-header-icon.strm-icon svg {
  width: 20px;
  height: 20px;
  color: white;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
  line-height: 1.2;
  color: #0f172a;
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
}

.card-title.dark {
  color: #f8fafc;
}

.card-header-actions,
.telegram-status-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 30px;
  min-width: 118px;
  flex-shrink: 0;
}

.card-header-actions {
  flex-wrap: wrap;
}

.register-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(96, 165, 250, 0.2);
  background: rgba(59, 130, 246, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  color: #1d4ed8;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.register-badge:hover {
  background: rgba(59, 130, 246, 0.18);
  border-color: rgba(96, 165, 250, 0.28);
  color: #1d4ed8;
}

.settings-card.dark .register-badge {
  background: rgba(59, 130, 246, 0.16);
  border-color: rgba(96, 165, 250, 0.24);
  color: #bfdbfe;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.settings-card.dark .register-badge:hover {
  background: rgba(59, 130, 246, 0.22);
  border-color: rgba(96, 165, 250, 0.32);
  color: #dbeafe;
}

.connection-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  border: 1px solid transparent;
}

.connection-status.success {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(96, 165, 250, 0.18);
  color: #1d4ed8;
}

.settings-card.dark .connection-status.success {
  background: rgba(59, 130, 246, 0.16);
  border-color: rgba(96, 165, 250, 0.22);
  color: #bfdbfe;
}

.connection-status.error {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(248, 113, 113, 0.2);
  color: #b91c1c;
}

.settings-card.dark .connection-status.error {
  background: rgba(239, 68, 68, 0.16);
  border-color: rgba(248, 113, 113, 0.22);
  color: #fecaca;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.24);
}

.connection-status.success .status-dot {
  background: #3b82f6;
}

.connection-status.error .status-dot {
  background: #ef4444;
}

.card-content {
  padding: 16px 20px 18px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group.half {
  flex: 1;
  margin-bottom: 0;
}

.toggle-center {
  display: flex;
  align-items: center;
}

.toggle-center .toggle-row {
  margin-bottom: 0;
  gap: 12px;
}

.form-group.third {
  flex: 1;
  margin-bottom: 0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.form-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.form-label.dark {
  color: #94a3b8;
}

.input-with-icon {
  position: relative;
}

.input-with-icon .form-input {
  padding-right: 42px;
}

.input-with-btn {
  position: relative;
  display: flex;
  gap: 10px;
}

.input-with-btn .form-input {
  flex: 1;
}

.btn-scan {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: rgba(255, 255, 255, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
  white-space: nowrap;
}

.btn-scan.dark {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
}

.btn-scan:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(255, 255, 255, 0.94);
  color: #2563eb;
}

.btn-scan.dark:hover:not(:disabled) {
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(51, 65, 85, 0.96);
  color: #bfdbfe;
}

.btn-scan:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-scan svg {
  width: 14px;
  height: 14px;
}

.btn-browse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  min-width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 14px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: rgba(255, 255, 255, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  color: #475569;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.btn-browse.dark {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
}

.btn-browse:hover {
  transform: translateY(-1px);
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(255, 255, 255, 0.94);
  color: #2563eb;
}

.btn-browse.dark:hover {
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(51, 65, 85, 0.96);
  color: #bfdbfe;
}

.btn-browse svg {
  width: 14px;
  height: 14px;
}

.toggle-visibility {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
}

.toggle-visibility:hover {
  color: #2563eb;
}

.toggle-visibility.dark {
  color: #64748b;
}

.toggle-visibility.dark:hover {
  color: #93c5fd;
}

.toggle-visibility svg {
  width: 16px;
  height: 16px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  font-size: 13px;
  color: #0f172a;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.form-input.dark {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #f8fafc;
}

.form-input:focus {
  outline: none;
  border-color: rgba(96, 165, 250, 0.42);
  box-shadow:
    0 0 0 3px rgba(59, 130, 246, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.form-input.error {
  border-color: rgba(248, 113, 113, 0.76);
}

.form-input[readonly] {
  background: rgba(248, 250, 252, 0.92);
  cursor: pointer;
}

.form-input[readonly].dark {
  background: rgba(30, 41, 59, 0.9);
}

.form-hint {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.5;
  color: #64748b;
}

.form-hint.dark {
  color: #94a3b8;
}

.form-select {
  width: 100%;
  min-width: 100px;
  padding: 10px 12px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  font-size: 13px;
  color: #0f172a;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  cursor: pointer;
}

.form-select.dark {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #f8fafc;
}

.form-select:focus {
  outline: none;
  border-color: rgba(96, 165, 250, 0.42);
  box-shadow:
    0 0 0 3px rgba(59, 130, 246, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.error-text {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: #dc2626;
}

.save-bar {
  position: sticky;
  bottom: 16px;
  margin-top: 24px;
  padding: 14px 16px;
  display: flex;
  justify-content: flex-end;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.74);
  background: rgba(255, 255, 255, 0.72);
  box-shadow:
    0 20px 44px rgba(15, 23, 42, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(22px);
  z-index: 30;
}

.save-bar.dark {
  background: rgba(15, 23, 42, 0.76);
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow:
    0 20px 44px rgba(2, 6, 23, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 42px;
  padding: 10px 18px;
  border-radius: 14px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.btn-secondary {
  border-color: rgba(226, 232, 240, 0.9);
  background: rgba(255, 255, 255, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  color: #475569;
}

.btn-secondary:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(255, 255, 255, 0.94);
  color: #1e293b;
}

.settings-card.dark .btn-secondary {
  border-color: rgba(71, 85, 105, 0.54);
  background: rgba(30, 41, 59, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
}

.alert {
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

.alert svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.alert.success {
  background: rgba(219, 234, 254, 0.92);
  color: #1d4ed8;
  border-color: rgba(96, 165, 250, 0.28);
}

.alert.success.dark {
  background: rgba(30, 64, 175, 0.22);
  color: #bfdbfe;
  border-color: rgba(96, 165, 250, 0.24);
}

.alert.warning {
  background: rgba(254, 243, 199, 0.92);
  color: #b45309;
  border-color: rgba(245, 158, 11, 0.24);
}

.alert.warning.dark {
  background: rgba(180, 83, 9, 0.2);
  color: #fcd34d;
  border-color: rgba(245, 158, 11, 0.22);
}

.alert.error {
  background: rgba(254, 226, 226, 0.92);
  color: #b91c1c;
  border-color: rgba(248, 113, 113, 0.24);
}

.alert.error.dark {
  background: rgba(127, 29, 29, 0.24);
  color: #fecaca;
  border-color: rgba(248, 113, 113, 0.22);
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

.qrcode-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.36);
  backdrop-filter: blur(16px);
  z-index: 1000;
}

.qrcode-modal {
  width: min(100%, 360px);
  overflow: hidden;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.76);
  box-shadow:
    0 28px 70px rgba(15, 23, 42, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(24px);
}

.qrcode-modal.dark {
  border-color: rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.82);
  box-shadow:
    0 28px 70px rgba(2, 6, 23, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.qrcode-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.62);
}

.qrcode-modal.dark .qrcode-header {
  border-bottom-color: rgba(71, 85, 105, 0.42);
}

.qrcode-header h3 {
  font-size: 16px;
  font-weight: 650;
  color: #0f172a;
  margin: 0;
}

.qrcode-modal.dark .qrcode-header h3 {
  color: #f8fafc;
}

.qrcode-content {
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 320px;
}

.device-select {
  flex: 1;
}

.device-select-row {
  display: flex;
  gap: 16px;
  width: 100%;
  margin-bottom: 20px;
}

.device-select-row .device-select {
  margin-bottom: 0;
}

.qrcode-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #64748b;
}


.qrcode-loading svg {
  width: 40px;
  height: 40px;
  margin-bottom: 12px;
}

.qrcode-image {
  text-align: center;
}

.qrcode-image img {
  width: 200px;
  height: 200px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.qrcode-modal.dark .qrcode-image img {
  border-color: #334155;
}

.qrcode-tip {
  margin-top: 16px;
  font-size: 13px;
  color: #64748b;
}

.qrcode-modal.dark .qrcode-tip {
  color: #94a3b8;
}

.qrcode-error {
  text-align: center;
  color: #ef4444;
}

.qrcode-error p {
  margin-bottom: 16px;
}

.btn-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  transition: color 0.2s;
}

.btn-close:hover {
  color: #1e293b;
}

.btn-close.dark {
  color: #94a3b8;
}

.btn-close.dark:hover {
  color: #f1f5f9;
}

.btn-close svg {
  width: 20px;
  height: 20px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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

@media (max-width: 1100px) {
  .settings-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
}

@media (max-width: 768px) {
  .settings {
    padding-bottom: 98px;
  }

  .settings-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .settings-card {
    border-radius: 22px;
  }

  .save-bar {
    bottom: 82px;
    margin-top: 16px;
    padding: 10px 12px;
    border-radius: 16px;
  }

  .alert {
    bottom: 116px;
    max-width: calc(100vw - 28px);
    padding: 11px 14px;
    border-radius: 16px;
    font-size: 12px;
  }

  .card-header {
    min-height: 76px;
  }


  .card-header-left {
    gap: 9px;
    min-width: 0;
    flex: 1 1 auto;
    align-items: center;
  }

  .card-header-info {
    min-width: 0;
    flex: 1 1 auto;
  }

  .card-header-icon {
    width: 36px;
    height: 36px;
    border-radius: 11px;
  }

  .card-header-icon.telegram-icon-header svg,
  .card-header-icon.ai-icon-header svg,
  .card-header-icon.wechat-icon-header svg {
    width: 16px;
    height: 16px;
  }

  .card-title {
    font-size: 13px;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-header-actions,
  .telegram-status-header {
    min-width: auto;
    max-width: 96px;
    min-height: 28px;
    flex: 0 0 auto;
  }

  .compact-status-header {
    max-width: none;
  }

  .compact-status-header .telegram-header-connected {
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    gap: 6px;
  }

  .compact-status-header .telegram-status-main {
    flex-shrink: 0;
  }

  .telegram-header-connected,
  .telegram-header-disconnected {
    justify-content: flex-end;
    align-items: flex-end;
    min-height: 28px;
    width: 100%;
  }

  .telegram-status-main {
    gap: 4px;
    min-height: 28px;
    align-items: center;
    justify-content: flex-end;
  }

  .telegram-header-connected {
    gap: 4px;
    flex-direction: column;
  }

  .status-badge,
  .connection-status,
  .register-badge {
    min-height: 27px;
    padding: 0 8px;
    font-size: 10px;
    gap: 4px;
    max-width: 100%;
  }

  .status-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-user-info {
    display: none;
  }

  .btn-xs {
    padding: 2px 6px;
    font-size: 10px;
  }

  .btn-logout-compact {
    min-height: 19px;
    padding: 0 6px;
    border-radius: 7px;
    font-size: 9px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .card-content {
    padding: 10px 14px 14px;
  }

  .form-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .form-group,
  .form-group.half {
    width: 100%;
    margin-bottom: 10px;
  }

  .form-group:last-child,
  .form-row:last-child,
  .telegram-login-section .form-group:last-child {
    margin-bottom: 0;
  }

  .form-label {
    font-size: 11px;
    margin-bottom: 5px;
  }

  .form-input,
  .form-select {
    font-size: 12px;
    padding: 8px 10px;
    border-radius: 11px;
  }

  .btn-scan,
  .btn-browse,
  .btn {
    border-radius: 11px;
  }

  .btn {
    min-height: 38px;
    padding: 8px 14px;
  }

  .btn-browse {
    width: 36px;
    min-width: 36px;
    height: 36px;
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

  .proxy-inline,
  .input-with-button {
    gap: 8px;
  }

  .telegram-login-section {
    margin-top: 12px;
    padding-top: 12px;
  }

  .telegram-actions {
    gap: 6px;
    margin-top: 8px;
  }

  .btn-sm {
    min-height: 34px;
    padding: 7px 10px;
    font-size: 11px;
  }
}

.proxy-config-section {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid rgba(226, 232, 240, 0.62);
}

.dark .proxy-config-section {
  border-top-color: rgba(71, 85, 105, 0.42);
}

.proxy-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.proxy-fields {
  margin-top: 12px;
}

.form-hint {
  display: block;
  font-size: 11px;
  color: #64748b;
  margin-top: 6px;
}

.dark .form-hint {
  color: #94a3b8;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toggle-row .form-label {
  margin-bottom: 0;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 42px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 999px;
  background: rgba(203, 213, 225, 0.9);
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.08);
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.settings-card.dark .toggle-slider {
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
  background: #ffffff;
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

.telegram-icon-header {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  box-shadow: 0 14px 28px rgba(59, 130, 246, 0.26);
}

.telegram-icon-header svg {
  width: 20px;
  height: 20px;
  color: white;
}

.ai-icon-header {
  background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
  border: none;
  box-shadow: 0 14px 28px rgba(139, 92, 246, 0.24);
}

.ai-icon-header svg {
  width: 20px;
  height: 20px;
  color: white;
}

.wechat-icon-header {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  box-shadow: 0 14px 28px rgba(16, 185, 129, 0.24);
}

.wechat-icon-header svg {
  width: 20px;
  height: 20px;
  color: white;
}

.wechat-login-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0 8px;
  gap: 16px;
}

.wechat-hint {
  font-size: 14px;
  line-height: 1.6;
  color: #64748b;
  text-align: center;
}

.wechat-hint.dark {
  color: #94a3b8;
}

.wechat-login-btn {
  min-width: 160px;
}

.wechat-loading-text {
  opacity: 0.72;
}

.wechat-qrcode-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 20px;
  border: 1px solid rgba(226, 232, 240, 0.72);
  background: rgba(248, 250, 252, 0.8);
}

.wechat-qrcode-container.dark {
  border-color: rgba(71, 85, 105, 0.48);
  background: rgba(30, 41, 59, 0.72);
}

.wechat-qrcode-img {
  width: 200px;
  height: 200px;
  object-fit: contain;
  border-radius: 14px;
}

.wechat-qrcode-hint {
  font-size: 13px;
  color: #64748b;
  text-align: center;
}

.wechat-qrcode-hint.dark {
  color: #94a3b8;
}

.wechat-config-section {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 120px;
}

.wechat-connected-info {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px 0;
}

.wechat-connected-text {
  font-size: 14px;
  color: #059669;
  text-align: center;
}

.wechat-connected-text.dark {
  color: #34d399;
}

.form-hint {
  font-size: 12px;
  color: #64748b;
  margin-top: 6px;
}

.form-hint.dark {
  color: #94a3b8;
}

.compact-status-header {
  flex-shrink: 0;
}

.telegram-header-connected,
.telegram-header-disconnected {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 30px;
  width: 100%;
}

.telegram-header-connected {
  gap: 8px;
  flex-wrap: wrap;
}

.telegram-status-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  min-width: 0;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.status-badge.connected {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(96, 165, 250, 0.18);
  color: #1d4ed8;
}

.dark .status-badge.connected {
  background: rgba(59, 130, 246, 0.16);
  border-color: rgba(96, 165, 250, 0.22);
  color: #bfdbfe;
}

.status-badge.disconnected {
  background: rgba(148, 163, 184, 0.14);
  border-color: rgba(148, 163, 184, 0.18);
  color: #64748b;
}

.dark .status-badge.disconnected {
  background: rgba(71, 85, 105, 0.46);
  border-color: rgba(100, 116, 139, 0.26);
  color: #cbd5e1;
}

.status-badge.warning {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.18);
  color: #b45309;
}

.dark .status-badge.warning {
  background: rgba(245, 158, 11, 0.16);
  border-color: rgba(245, 158, 11, 0.22);
  color: #fcd34d;
}

.status-badge .status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  box-shadow: none;
}

.status-badge.connected .status-dot {
  background: #3b82f6;
}

.status-badge.disconnected .status-dot {
  background: #94a3b8;
}

.status-badge.warning .status-dot {
  background: #f59e0b;
}

.header-user-info {
  display: flex;
  align-items: center;
  min-width: 0;
}

.header-username {
  font-size: 12px;
  font-weight: 500;
  color: #0f172a;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dark .header-username {
  color: #f8fafc;
}

.input-with-button {
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-with-button .form-input {
  flex: 1;
  min-width: 0;
}

.input-with-button .btn-sm {
  flex-shrink: 0;
  white-space: nowrap;
  padding: 8px 12px;
  font-size: 12px;
}

.proxy-inline {
  display: flex;
  align-items: center;
  gap: 12px;
}

.proxy-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.proxy-toggle .form-label {
  margin-bottom: 0;
}

.proxy-input {
  flex: 1;
}

.proxy-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-switch.small {
  width: 36px;
  height: 20px;
}

.toggle-switch.small .toggle-slider {
  width: 36px;
  height: 20px;
}

.toggle-switch.small .toggle-slider::before {
  width: 14px;
  height: 14px;
}

.toggle-switch.small input:checked + .toggle-slider::before {
  transform: translateX(16px);
}

.telegram-login-section {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(226, 232, 240, 0.62);
}

.dark .telegram-login-section {
  border-top-color: rgba(71, 85, 105, 0.42);
}

.telegram-login-section .form-group {
  margin-bottom: 8px;
}

.telegram-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.btn-sm {
  min-height: 36px;
  padding: 8px 12px;
  font-size: 12px;
}

.btn-danger {
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
  border: 1px solid rgba(248, 113, 113, 0.2);
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.14);
  color: #b91c1c;
}

.dark .btn-danger {
  background: rgba(127, 29, 29, 0.32);
  color: #fecaca;
  border-color: rgba(248, 113, 113, 0.2);
}

</style>
