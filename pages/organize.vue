<template>
  <div class="organize" :class="{ dark: isDark }">
    <div class="page-header" :class="{ dark: isDark }">
    </div>

    <div v-if="configChecking" class="loading-state" :class="{ dark: isDark }">
      <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10"/>
      </svg>
      <span>检查配置中...</span>
    </div>
    <div v-else-if="!configReady" class="config-warning" :class="{ dark: isDark }">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>请先在参数配置中设置115云盘Cookie、保存目录和媒体库目录</span>
    </div>

    <template v-else>
      <div class="toolbar" :class="{ dark: isDark }">
        <div class="toolbar-left">
          <div class="breadcrumb" :class="{ dark: isDark }">
            <span class="breadcrumb-item" @click="navigateTo('')">根目录</span>
            <template v-for="(part, index) in pathParts" :key="index">
              <span class="breadcrumb-sep">/</span>
              <span class="breadcrumb-item" @click="navigateToPath(index)">{{ part.name }}</span>
            </template>
          </div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-refresh" :class="{ dark: isDark }" @click="loadFiles" :disabled="loading">
            <svg :class="{ spin: loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            <span>刷新</span>
          </button>
          <button class="btn btn-settings" :class="{ dark: isDark }" @click="openSettingsModal" title="设置">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>设置</span>
          </button>
          <button class="btn btn-records" :class="{ dark: isDark }" @click="openRecordsModal" title="记录">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="17"/>
              <line x1="16" y1="17" x2="8" y2="16"/>
            </svg>
            <span>记录</span>
          </button>
        </div>
      </div>

      <div class="content-area" :class="{ dark: isDark }" @touchstart.capture="handlePageTouchStart($event)" @scroll.passive="handlePageScroll">
        <div v-if="loading" class="loading-state">
          <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10"/>
          </svg>
          <span>加载中...</span>
        </div>

        <div v-else-if="files.length === 0 && folders.length === 0" class="empty-state" :class="{ dark: isDark }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <p>目录为空</p>
        </div>

        <template v-else>
          <div v-if="folders.length > 0" class="section">
            <div class="section-header" :class="{ dark: isDark }">
              <h3>文件夹</h3>
              <span class="count">{{ folders.length }}</span>
            </div>
            <div class="file-list">
              <div
                v-for="folder in folders"
                :key="folder.fileId"
                class="swipe-row"
                :class="{ open: mobileSwipeOpenKey === getSwipeKey(folder, 'folder') }"
                @touchstart.passive="handleRowTouchStart($event, folder, 'folder')"
                @touchmove="handleRowTouchMove($event, folder, 'folder')"
                @touchend="handleRowTouchEnd(folder, 'folder')"
                @touchcancel="handleRowTouchCancel"
              >
                <div
                  class="swipe-actions"
                  :class="{ dark: isDark }"
                >
                  <button
                    class="swipe-action-btn recognize"
                    @click.stop="handleSwipeAction(() => recognizeItem(folder, 'folder'))"
                    title="识别"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="m21 21-4.35-4.35"/>
                    </svg>
                  </button>
                  <button
                    class="swipe-action-btn"
                    @click.stop="handleSwipeAction(() => organizeItem(folder, 'folder'))"
                    title="整理"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                      <path d="M12 11v6M9 14l3-3 3 3"/>
                    </svg>
                  </button>
                  <button
                    class="swipe-action-btn delete"
                    @click.stop="handleSwipeAction(() => confirmDelete(folder, 'folder'))"
                    title="删除"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      <line x1="10" y1="11" x2="10" y2="17"/>
                      <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                  </button>
                </div>
                <div
                  class="file-item file-item-shell folder"
                  :class="{ dark: isDark, 'swipe-active': mobileSwipeActiveKey === getSwipeKey(folder, 'folder') || mobileSwipeOpenKey === getSwipeKey(folder, 'folder') }"
                  :style="getSwipeItemStyle(folder, 'folder')"
                >
                  <div class="file-icon folder-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                    </svg>
                  </div>
                  <div class="file-info folder-info" @click="handleFolderInfoClick(folder)">
                    <span class="file-name">{{ folder.name }}</span>
                  </div>
                  <div class="file-actions">
                    <button class="btn-action recognize" @click.stop="recognizeItem(folder, 'folder')" title="识别">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="m21 21-4.35-4.35"/>
                      </svg>
                    </button>
                    <button class="btn-action" @click.stop="organizeItem(folder, 'folder')" title="整理">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        <path d="M12 11v6M9 14l3-3 3 3"/>
                      </svg>
                    </button>
                    <button class="btn-action delete" @click.stop="confirmDelete(folder, 'folder')" title="删除">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/>
                        <line x1="14" y1="11" x2="14" y2="17"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="files.length > 0" class="section">
            <div class="section-header" :class="{ dark: isDark }">
              <h3>文件</h3>
              <span class="count">{{ files.length }}</span>
            </div>
            <div class="file-list">
              <div
                v-for="file in files"
                :key="file.fileId"
                class="swipe-row"
                :class="{ open: mobileSwipeOpenKey === getSwipeKey(file, 'file') }"
                @touchstart.passive="handleRowTouchStart($event, file, 'file')"
                @touchmove="handleRowTouchMove($event, file, 'file')"
                @touchend="handleRowTouchEnd(file, 'file')"
                @touchcancel="handleRowTouchCancel"
              >
                <div
                  class="swipe-actions"
                  :class="{ dark: isDark, compact: !canShowRecognizeAction(file, 'file') }"
                >
                  <button
                    v-if="canShowRecognizeAction(file, 'file')"
                    class="swipe-action-btn recognize"
                    @click.stop="handleSwipeAction(() => recognizeItem(file, 'file'))"
                    title="识别"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="m21 21-4.35-4.35"/>
                    </svg>
                  </button>
                  <button
                    v-if="canShowRecognizeAction(file, 'file')"
                    class="swipe-action-btn"
                    @click.stop="handleSwipeAction(() => organizeItem(file, 'file'))"
                    title="整理"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                      <path d="M12 11v6M9 14l3-3 3 3"/>
                    </svg>
                  </button>
                  <button
                    class="swipe-action-btn delete"
                    @click.stop="handleSwipeAction(() => confirmDelete(file, 'file'))"
                    title="删除"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      <line x1="10" y1="11" x2="10" y2="17"/>
                      <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                  </button>
                </div>
                <div
                  class="file-item file-item-shell"
                  :class="{ dark: isDark, video: isVideoFile(file.name), 'swipe-active': mobileSwipeActiveKey === getSwipeKey(file, 'file') || mobileSwipeOpenKey === getSwipeKey(file, 'file') }"
                  :style="getSwipeItemStyle(file, 'file')"
                >
                  <div class="file-icon" :class="{ video: isVideoFile(file.name), subtitle: isSubtitleFile(file.name) }">
                    <svg v-if="isVideoFile(file.name)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="23 7 16 12 23 17 23 7"/>
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                    <svg v-else-if="isSubtitleFile(file.name)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div class="file-info" @click="handleFileInfoClick(file)">
                    <span class="file-name">{{ file.name }}</span>
                    <span class="file-meta">{{ formatSize(file.size) }}</span>
                  </div>
                  <div class="file-actions">
                    <button
                      v-if="canShowRecognizeAction(file, 'file')"
                      class="btn-action recognize"
                      @click.stop="recognizeItem(file, 'file')"
                      title="识别"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="m21 21-4.35-4.35"/>
                      </svg>
                    </button>
                    <button
                      v-if="canShowRecognizeAction(file, 'file')"
                      class="btn-action"
                      @click.stop="organizeItem(file, 'file')"
                      title="整理"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        <path d="M12 11v6M9 14l3-3 3 3"/>
                      </svg>
                    </button>
                    <button class="btn-action delete" @click.stop="confirmDelete(file, 'file')" title="删除">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/>
                        <line x1="14" y1="11" x2="14" y2="17"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showOrganizeModal" class="modal-overlay" @click.self="closeOrganizeModal">
          <Transition name="zoom">
            <div v-if="showOrganizeModal" class="modal organize-modal" :class="{ dark: isDark }">
              <div class="modal-header">
                <h3>整理确认</h3>
                <button class="btn-close" @click="closeOrganizeModal">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div class="modal-body">
                <div v-if="organizeLoading" class="organize-progress">
                  <div class="progress-header">
                    <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                      <path d="M12 2a10 10 0 0 1 10 10"/>
                    </svg>
                    <span class="progress-title">{{ organizeStatus }}</span>
                  </div>
                  <div v-if="organizeProgress.total > 0" class="progress-bar-container">
                    <div class="progress-bar">
                      <div class="progress-fill" :style="{ width: `${(organizeProgress.current / organizeProgress.total) * 100}%` }"></div>
                    </div>
                    <div class="progress-text">{{ organizeProgress.current }} / {{ organizeProgress.total }}</div>
                  </div>
                  <div v-if="organizeProgress.currentFile" class="progress-file">
                    {{ organizeProgress.currentFile }}
                  </div>
                </div>
                <template v-else>
                  <div v-if="!recognizeResult" class="recognize-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p>无法识别此文件，请检查文件名格式</p>
                    <p class="recognize-empty-hint">您可以使用下方纠错功能手动填写媒体信息</p>
                    <div class="correct-section recognize-fail-correct">
                      <button
                        type="button"
                        class="correct-toggle-btn"
                        :class="{ dark: isDark, active: showCorrectForm }"
                        @click="showCorrectForm = !showCorrectForm"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        <span>{{ showCorrectForm ? '收起纠错' : '识别纠错' }}</span>
                      </button>

                      <Transition name="slide">
                        <div v-if="showCorrectForm" class="correct-form compact" :class="{ dark: isDark }">
                          <div class="correct-form-row correct-form-main-row">
                            <div class="correct-inline-group type-group">
                              <span class="correct-inline-label">媒体类型</span>
                              <div class="type-selector compact">
                                <button
                                  type="button"
                                  class="type-btn"
                                  :class="{ active: correctMediaType === 'movie', dark: isDark }"
                                  @click="correctMediaType = 'movie'"
                                >
                                  电影
                                </button>
                                <button
                                  type="button"
                                  class="type-btn"
                                  :class="{ active: correctMediaType === 'tv', dark: isDark }"
                                  @click="correctMediaType = 'tv'"
                                >
                                  电视剧
                                </button>
                              </div>
                            </div>
                            <div class="correct-inline-group tmdb-group">
                              <span class="correct-inline-label">TMDB ID</span>
                              <input
                                type="text"
                                v-model="correctTmdbId"
                                placeholder="输入 TMDB ID"
                                class="form-input"
                                :class="{ dark: isDark }"
                              />
                            </div>
                            <button
                              type="button"
                              class="btn btn-primary btn-sm correct-submit-btn"
                              @click="applyCorrection"
                              :disabled="!correctTmdbId"
                            >
                              重新识别
                            </button>
                          </div>
                        </div>
                      </Transition>
                    </div>
                  </div>
                  <template v-if="recognizeResult">
                    <div class="organize-result-card">
                      <div class="result-media">
                        <div v-if="recognizeResult.posterUrl" class="result-poster">
                          <img :src="recognizeResult.posterUrl" alt="海报" />
                        </div>
                        <div class="result-info">
                          <div class="result-header">
                            <span class="result-type-tag" :class="recognizeResult.mediaType">
                              {{ recognizeResult.mediaType === 'movie' ? '电影' : '电视剧' }}
                            </span>
                            <div class="result-rating" v-if="recognizeResult.voteAverage">
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                              </svg>
                              <span>{{ recognizeResult.voteAverage.toFixed(1) }}</span>
                            </div>
                            <span class="result-tmdb-tag" v-if="recognizeResult.tmdbId">
                              {{ recognizeResult.tmdbId }}
                            </span>
                          </div>
                          
                          <h4 class="result-title">{{ recognizeResult.title }}</h4>
                          <p class="result-original-title" v-if="recognizeResult.originalTitle && recognizeResult.originalTitle !== recognizeResult.title">
                            {{ recognizeResult.originalTitle }}
                          </p>
                          
                          <div class="result-meta">
                            <span class="meta-year">{{ recognizeResult.year }}</span>
                            <span class="meta-divider" v-if="recognizeResult.originCountry?.length">·</span>
                            <span class="meta-country" v-if="recognizeResult.originCountry?.length">
                              {{ recognizeResult.originCountry.join(', ') }}
                            </span>
                          </div>

                          <div class="result-genres" v-if="recognizeResult.genres?.length">
                            <span 
                              v-for="genre in recognizeResult.genres.slice(0, 4)" 
                              :key="genre" 
                              class="genre-tag"
                            >
                              {{ genre }}
                            </span>
                          </div>

                          <div class="result-quality-tags" v-if="recognizeResult.tech">
                            <span class="quality-tag category-tag">{{ recognizeResult.category }}</span>
                            <span v-if="recognizeResult.tech.webSource" class="quality-tag web-source-tag">{{ recognizeResult.tech.webSource }}</span>
                            <span v-if="recognizeResult.tech.videoFormat" class="quality-tag format-tag">{{ recognizeResult.tech.videoFormat }}</span>
                            <span v-if="recognizeResult.tech.edition" class="quality-tag effect-tag" v-for="effect in recognizeResult.tech.edition.split(' ')" :key="effect">{{ effect }}</span>
                            <span v-if="recognizeResult.tech.videoCodec" class="quality-tag codec-tag">{{ recognizeResult.tech.videoCodec }}</span>
                            <span v-if="recognizeResult.tech.audioCodec" class="quality-tag audio-tag">{{ recognizeResult.tech.audioCodec }}</span>
                            <span v-if="recognizeResult.tech.releaseGroup" class="quality-tag group-tag">{{ recognizeResult.tech.releaseGroup }}</span>
                          </div>
                        </div>
                      </div>

                      <div class="result-overview-section" v-if="recognizeResult.overview">
                        <p class="result-overview-text">{{ recognizeResult.overview }}</p>
                      </div>

                      <div class="result-details">
                        <div class="detail-item">
                          <span class="detail-label">原始文件</span>
                          <span class="detail-value file-name">{{ currentItem?.name }}</span>
                        </div>
                        <div class="detail-item">
                          <span class="detail-label">目标路径</span>
                          <span class="detail-value path-value">{{ recognizeResult.suggestedPath }}</span>
                        </div>
                      </div>

                    <div class="organize-options">
                        <div class="action-type-selector">
                          <button
                            type="button"
                            class="action-btn"
                            :class="{ active: organizeAction === 'move', dark: isDark }"
                            @click="organizeAction = 'move'"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M5 9l-3 3 3 3"/>
                              <path d="M9 5l3-3 3 3"/>
                              <path d="M15 19l-3 3-3-3"/>
                              <path d="M19 9l3 3-3 3"/>
                              <line x1="2" y1="12" x2="22" y2="12"/>
                              <line x1="12" y1="2" x2="12" y2="22"/>
                            </svg>
                            <span>移动</span>
                          </button>
                          <button
                            type="button"
                            class="action-btn"
                            :class="{ active: organizeAction === 'copy', dark: isDark }"
                            @click="organizeAction = 'copy'"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                            <span>复制</span>
                          </button>
                        </div>
                      </div>

                      <div class="correct-section">
                        <button
                          type="button"
                          class="correct-toggle-btn"
                          :class="{ dark: isDark, active: showCorrectForm }"
                          @click="showCorrectForm = !showCorrectForm"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                          <span>{{ showCorrectForm ? '收起纠错' : '识别纠错' }}</span>
                        </button>

                        <Transition name="slide">
                          <div v-if="showCorrectForm" class="correct-form compact" :class="{ dark: isDark }">
                            <div class="correct-form-row correct-form-main-row">
                              <div class="correct-inline-group type-group">
                                <span class="correct-inline-label">媒体类型</span>
                                <div class="type-selector compact">
                                  <button
                                    type="button"
                                    class="type-btn"
                                    :class="{ active: correctMediaType === 'movie', dark: isDark }"
                                    @click="correctMediaType = 'movie'"
                                  >
                                    电影
                                  </button>
                                  <button
                                    type="button"
                                    class="type-btn"
                                    :class="{ active: correctMediaType === 'tv', dark: isDark }"
                                    @click="correctMediaType = 'tv'"
                                  >
                                    电视剧
                                  </button>
                                </div>
                              </div>
                              <div class="correct-inline-group tmdb-group">
                                <span class="correct-inline-label">TMDB ID</span>
                                <input
                                  type="text"
                                  v-model="correctTmdbId"
                                  placeholder="输入 TMDB ID"
                                  class="form-input"
                                  :class="{ dark: isDark }"
                                />
                              </div>
                              <button
                                type="button"
                                class="btn btn-primary btn-sm correct-submit-btn"
                                @click="applyCorrection"
                                :disabled="!correctTmdbId"
                              >
                                重新识别
                              </button>
                            </div>
                          </div>
                        </Transition>
                      </div>
                    </div>
                  </template>
                </template>
              </div>
              <div v-if="!organizeLoading && recognizeResult" class="modal-footer modal-footer-organize">
                <button class="btn btn-primary btn-block organize-confirm-btn" @click="executeOrganize">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12l5 5L20 7"/>
                  </svg>
                  <span>确认整理</span>
                </button>
              </div>
              <div v-if="!organizeLoading && !recognizeResult" class="modal-footer">
                <button class="btn btn-secondary btn-block" @click="closeOrganizeModal">关闭</button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showRecognizeModal" class="modal-overlay" @click.self="closeRecognizeModal">
          <Transition name="zoom">
            <div v-if="showRecognizeModal" class="modal recognize-modal" :class="{ dark: isDark }">
              <div class="modal-header">
                <h3>识别结果</h3>
                <button class="btn-close" @click="closeRecognizeModal">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div class="modal-body">
                <div v-if="recognizeLoading" class="recognize-loading">
                  <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                  <span>正在识别...</span>
                </div>
                <template v-else-if="recognizeModalResult">
                  <div class="recognize-result-card">
                    <div class="result-media">
                      <div v-if="recognizeModalResult.posterUrl" class="result-poster">
                        <img :src="recognizeModalResult.posterUrl" alt="海报" />
                      </div>
                      <div class="result-info">
                        <div class="result-header">
                          <span class="result-type-tag" :class="recognizeModalResult.mediaType">
                            {{ recognizeModalResult.mediaType === 'movie' ? '电影' : '电视剧' }}
                          </span>
                          <div class="result-rating" v-if="recognizeModalResult.voteAverage">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                            <span>{{ recognizeModalResult.voteAverage.toFixed(1) }}</span>
                          </div>
                          <span class="result-tmdb-tag" v-if="recognizeModalResult.tmdbId">
                            {{ recognizeModalResult.tmdbId }}
                          </span>
                        </div>
                        
                        <h4 class="result-title">{{ recognizeModalResult.title }}</h4>
                        <p class="result-original-title" v-if="recognizeModalResult.originalTitle && recognizeModalResult.originalTitle !== recognizeModalResult.title">
                          {{ recognizeModalResult.originalTitle }}
                        </p>
                        
                        <div class="result-meta">
                          <span class="meta-year">{{ recognizeModalResult.year }}</span>
                          <span class="meta-divider" v-if="recognizeModalResult.originCountry?.length">·</span>
                          <span class="meta-country" v-if="recognizeModalResult.originCountry?.length">
                            {{ recognizeModalResult.originCountry.join(', ') }}
                          </span>
                        </div>

                        <div class="result-genres" v-if="recognizeModalResult.genres?.length">
                          <span 
                            v-for="genre in recognizeModalResult.genres.slice(0, 4)" 
                            :key="genre" 
                            class="genre-tag"
                          >
                            {{ genre }}
                          </span>
                        </div>

                        <div class="result-quality-tags" v-if="recognizeModalResult.tech">
                          <span class="quality-tag category-tag">{{ recognizeModalResult.category }}</span>
                          <span v-if="recognizeModalResult.tech.webSource" class="quality-tag web-source-tag">{{ recognizeModalResult.tech.webSource }}</span>
                          <span v-if="recognizeModalResult.tech.videoFormat" class="quality-tag format-tag">{{ recognizeModalResult.tech.videoFormat }}</span>
                          <span v-if="recognizeModalResult.tech.edition" class="quality-tag effect-tag" v-for="effect in recognizeModalResult.tech.edition.split(' ')" :key="effect">{{ effect }}</span>
                          <span v-if="recognizeModalResult.tech.videoCodec" class="quality-tag codec-tag">{{ recognizeModalResult.tech.videoCodec }}</span>
                          <span v-if="recognizeModalResult.tech.audioCodec" class="quality-tag audio-tag">{{ recognizeModalResult.tech.audioCodec }}</span>
                          <span v-if="recognizeModalResult.tech.releaseGroup" class="quality-tag group-tag">{{ recognizeModalResult.tech.releaseGroup }}</span>
                        </div>
                      </div>
                    </div>

                    <div class="result-overview-section" v-if="recognizeModalResult.overview">
                      <p class="result-overview-text">{{ recognizeModalResult.overview }}</p>
                    </div>

                    <div class="result-details">
                      <div class="detail-item">
                        <span class="detail-label">原始文件</span>
                        <span class="detail-value file-name">{{ recognizeModalItem?.name }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">目标路径</span>
                        <span class="detail-value path-value">{{ recognizeModalResult.suggestedPath }}</span>
                      </div>
                    </div>
                  </div>
                </template>
                <div v-else class="recognize-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p>无法识别此文件</p>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showSettingsModal" class="modal-overlay" @click.self="closeSettingsModal">
          <Transition name="zoom">
            <div v-if="showSettingsModal" class="modal settings-modal" :class="{ dark: isDark }">
              <div class="modal-header">
                <h3>设置</h3>
                <button class="btn-close" @click="closeSettingsModal">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              
              <div class="settings-tabs">
                <button 
                  class="tab-btn" 
                  :class="{ active: settingsTab === 'rename', dark: isDark }"
                  @click="settingsTab = 'rename'"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  <span>重命名</span>
                </button>
                <button 
                  class="tab-btn" 
                  :class="{ active: settingsTab === 'classify', dark: isDark }"
                  @click="settingsTab = 'classify'"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span>分类策略</span>
                </button>
                <button 
                  class="tab-btn" 
                  :class="{ active: settingsTab === 'groups', dark: isDark }"
                  @click="settingsTab = 'groups'"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <span>发布组</span>
                </button>
                <button 
                  class="tab-btn" 
                  :class="{ active: settingsTab === 'auto', dark: isDark }"
                  @click="settingsTab = 'auto'"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>自动整理</span>
                </button>
              </div>
              
              <div class="modal-body">
                <div v-if="settingsTab === 'rename'" class="settings-section">
                  <div class="form-group">
                    <label>电影命名模板</label>
                    <textarea 
                      v-model="settingsForm.movieTemplate" 
                      class="form-textarea" 
                      :class="{ dark: isDark }"
                      rows="3"
                      placeholder="输入电影命名模板"
                    ></textarea>
                    <div class="field-hint">
                      <button class="btn-link" @click="resetMovieTemplate">恢复默认</button>
                    </div>
                  </div>
                  
                  <div class="form-group">
                    <label>电视剧命名模板</label>
                    <textarea 
                      v-model="settingsForm.tvTemplate" 
                      class="form-textarea" 
                      :class="{ dark: isDark }"
                      rows="3"
                      placeholder="输入电视剧命名模板"
                    ></textarea>
                    <div class="field-hint">
                      <button class="btn-link" @click="resetTvTemplate">恢复默认</button>
                    </div>
                  </div>
                </div>
                
                <div v-if="settingsTab === 'classify'" class="settings-section">
                  <div class="form-group">
                    <label>电影分类规则</label>
                    <textarea 
                      v-model="settingsForm.movieRules" 
                      class="form-textarea code-textarea" 
                      :class="{ dark: isDark }"
                      rows="6"
                      placeholder="输入电影分类规则JSON"
                    ></textarea>
                    <div class="field-hint">
                      <button class="btn-link" @click="resetMovieRules">恢复默认</button>
                    </div>
                  </div>
                  
                  <div class="form-group">
                    <label>电视剧分类规则</label>
                    <textarea 
                      v-model="settingsForm.tvRules" 
                      class="form-textarea code-textarea" 
                      :class="{ dark: isDark }"
                      rows="8"
                      placeholder="输入电视剧分类规则JSON"
                    ></textarea>
                    <div class="field-hint">
                      <button class="btn-link" @click="resetTvRules">恢复默认</button>
                    </div>
                  </div>
                </div>
                
                <div v-if="settingsTab === 'groups'" class="settings-section">
                  <div class="form-group">
                    <div class="section-header-row">
                      <label>内置发布组</label>
                      <button class="btn-toggle" @click="showBuiltinGroups = !showBuiltinGroups">
                        <svg :class="{ rotated: showBuiltinGroups }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                        <span>{{ showBuiltinGroups ? '收起' : '展开' }} ({{ builtinGroups.length }}个)</span>
                      </button>
                    </div>
                    <Transition name="slide">
                      <div v-if="showBuiltinGroups" class="groups-container" :class="{ dark: isDark }">
                        <span v-for="group in builtinGroups" :key="group" class="group-tag builtin">
                          {{ group }}
                        </span>
                      </div>
                    </Transition>
                  </div>
                  
                  <div class="form-group">
                    <label>补充发布组</label>
                    <div class="custom-groups-input" :class="{ dark: isDark }">
                      <div class="groups-container custom" :class="{ dark: isDark }">
                        <TransitionGroup name="tag">
                          <span v-for="(group, index) in customGroups" :key="group" class="group-tag custom">
                            {{ group }}
                            <button class="tag-remove" @click="removeCustomGroup(index)">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </span>
                        </TransitionGroup>
                        <input 
                          v-model="newGroupInput"
                          class="group-input"
                          :class="{ dark: isDark }"
                          placeholder="输入发布组名称后按回车添加"
                          @keydown.enter.prevent="addCustomGroup"
                          @keydown.backspace="handleBackspace"
                        />
                      </div>
                    </div>
                    <div class="field-hint">
                      <span class="hint-text">输入发布组名称后按回车添加，支持补充内置列表中没有的发布组</span>
                    </div>
                  </div>
                </div>
                
                <div v-if="settingsTab === 'auto'" class="settings-section auto-organize-section">
                  <div class="auto-header">
                    <div class="auto-title-row">
                      <div class="auto-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                      </div>
                      <div class="auto-title-info">
                        <h4>自动整理</h4>
                        <p class="auto-desc">定时扫描保存目录并自动整理</p>
                      </div>
                      <button 
                        class="toggle-switch large" 
                        :class="{ active: autoOrganizeForm.enabled, dark: isDark }"
                        @click="autoOrganizeForm.enabled = !autoOrganizeForm.enabled"
                      >
                        <span class="toggle-slider"></span>
                      </button>
                    </div>
                  </div>

                  <div class="auto-config-grid" :class="{ disabled: !autoOrganizeForm.enabled }">
                    <div class="config-card">
                      <div class="config-card-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M5 9l-3 3 3 3"/>
                          <path d="M9 5l3-3 3 3"/>
                          <path d="M15 19l-3 3-3-3"/>
                          <path d="M19 9l3 3-3 3"/>
                          <line x1="2" y1="12" x2="22" y2="12"/>
                          <line x1="12" y1="2" x2="12" y2="22"/>
                        </svg>
                        <span>整理方式</span>
                      </div>
                      <div class="action-selector">
                        <button 
                          type="button"
                          class="action-option" 
                          :class="{ active: autoOrganizeForm.action === 'move', dark: isDark }"
                          @click="autoOrganizeForm.action = 'move'"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 9l-3 3 3 3"/>
                            <path d="M9 5l3-3 3 3"/>
                            <path d="M15 19l-3 3-3-3"/>
                            <path d="M19 9l3 3-3 3"/>
                            <line x1="2" y1="12" x2="22" y2="12"/>
                            <line x1="12" y1="2" x2="12" y2="22"/>
                          </svg>
                          <span class="action-name">移动</span>
                          <span class="action-desc">删除原文件</span>
                        </button>
                        <button 
                          type="button"
                          class="action-option" 
                          :class="{ active: autoOrganizeForm.action === 'copy', dark: isDark }"
                          @click="autoOrganizeForm.action = 'copy'"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                          <span class="action-name">复制</span>
                          <span class="action-desc">保留原文件</span>
                        </button>
                      </div>
                    </div>

                    <div class="config-card">
                      <div class="config-card-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <span>运行时间</span>
                      </div>
                      <div class="cron-config">
                        <input 
                          v-model="autoOrganizeForm.cronExpression" 
                          class="cron-input" 
                          :class="{ dark: isDark }"
                          placeholder="0 3 * * *"
                        />
                        <div class="cron-presets">
                          <button class="preset-btn" :class="{ dark: isDark, active: autoOrganizeForm.cronExpression === '0 3 * * *' }" @click="autoOrganizeForm.cronExpression = '0 3 * * *'">每天3:00</button>
                          <button class="preset-btn" :class="{ dark: isDark, active: autoOrganizeForm.cronExpression === '*/10 * * * *' }" @click="autoOrganizeForm.cronExpression = '*/10 * * * *'">每10分钟</button>
                          <button class="preset-btn" :class="{ dark: isDark, active: autoOrganizeForm.cronExpression === '0 */6 * * *' }" @click="autoOrganizeForm.cronExpression = '0 */6 * * *'">每6小时</button>
                          <button class="preset-btn" :class="{ dark: isDark, active: autoOrganizeForm.cronExpression === '30 7 * * 6' }" @click="autoOrganizeForm.cronExpression = '30 7 * * 6'">每周六7:30</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-if="autoOrganizeStatus" class="status-card" :class="{ dark: isDark, running: autoOrganizeStatus.isRunning }">
                    <div class="status-indicator">
                      <span class="status-dot" :class="{ active: autoOrganizeStatus.isRunning }"></span>
                      <span class="status-text">{{ autoOrganizeStatus.isRunning ? '运行中' : '已停止' }}</span>
                    </div>
                    <div class="status-detail">
                      <span class="status-label">Cron:</span>
                      <code class="status-cron">{{ autoOrganizeStatus.cronExpression }}</code>
                    </div>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-primary" @click="saveSettings" :disabled="settingsLoading">
                  {{ settingsLoading ? '保存中...' : '保存设置' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDeleteModal">
          <Transition name="zoom">
            <div v-if="showDeleteModal" class="modal delete-modal" :class="{ dark: isDark }">
              <div class="delete-content">
                <div class="delete-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <h3 class="delete-title">确认删除</h3>
                <p class="delete-desc">确定要删除此{{ deleteItemType === 'folder' ? '文件夹' : '文件' }}吗？</p>
                <div class="delete-item-box">
                  <svg v-if="deleteItemType === 'folder'" viewBox="0 0 24 24" fill="currentColor" class="item-icon">
                    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="item-icon">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span class="item-name">{{ deleteItem?.name }}</span>
                </div>
                <p class="delete-warning-text">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  此操作不可恢复
                </p>
              </div>
              <div class="delete-actions">
                <button class="btn-delete-cancel" :class="{ dark: isDark }" @click="closeDeleteModal" :disabled="deleteLoading">
                  取消
                </button>
                <button class="btn-delete-confirm" @click="executeDelete" :disabled="deleteLoading">
                  <svg v-if="deleteLoading" class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                  <span>{{ deleteLoading ? '删除中...' : '删除' }}</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showRecordsModal" class="modal-overlay" @click.self="closeRecordsModal">
          <Transition name="zoom">
            <div v-if="showRecordsModal" class="modal records-modal" :class="{ dark: isDark }">
              <div class="modal-header">
                <h3>整理记录</h3>
                <button class="btn-close" @click="closeRecordsModal">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div class="modal-body">
                <div class="records-controls">
                  <div class="records-summary">
                    <span class="records-count">共 {{ recordsTotal }} 条记录</span>
                    <span class="records-page-info">第 {{ recordsPage }} / {{ recordsTotalPages }} 页</span>
                  </div>
                  <div class="records-actions">
                    <div class="records-pagination">
                      <button class="btn-records-page" :class="{ dark: isDark }" @click="goToPrevRecordsPage" :disabled="recordsLoading || !canGoPrevRecordsPage">
                        上一页
                      </button>
                      <button class="btn-records-page" :class="{ dark: isDark }" @click="goToNextRecordsPage" :disabled="recordsLoading || !canGoNextRecordsPage">
                        下一页
                      </button>
                    </div>
                    <button class="btn btn-clear-records" :class="{ dark: isDark }" @click="clearAllRecords" :disabled="recordsLoading">
                      清空记录
                    </button>
                  </div>
                </div>
                <div class="records-table-container">
                  <div v-if="recordsLoading" class="records-loading">
                    <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                      <path d="M12 2a10 10 0 0 1 10 10"/>
                    </svg>
                    <span>加载中...</span>
                  </div>
                  <div v-else-if="records.length === 0" class="records-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <p>暂无记录</p>
                  </div>
                  <table v-else class="records-table" :class="{ dark: isDark }">
                    <thead>
                      <tr>
                        <th class="col-name">媒体名称</th>
                        <th class="col-filename">路径</th>
                        <th class="col-action">方式</th>
                        <th class="col-status">状态</th>
                        <th class="col-time">时间</th>
                        <th class="col-actions">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="record in records" :key="record.id">
                        <td class="col-name" :title="record.name">{{ record.name }}</td>
                        <td class="col-filename">
                          <div class="filename-row original">
                            <span class="filename-value" :title="record.original_path">{{ record.original_path }}</span>
                          </div>
                          <div class="filename-row target">
                            <span class="filename-value" :title="record.target_path">{{ record.target_path }}</span>
                          </div>
                        </td>
                        <td class="col-action">
                          <span class="action-tag" :class="record.action">
                            {{ record.action === 'move' ? '移动' : '复制' }}
                          </span>
                        </td>
                        <td class="col-status">
                          <span class="status-tag" :class="record.status">
                            {{ record.status === 'success' ? '成功' : '失败' }}
                          </span>
                        </td>
                        <td class="col-time">{{ formatRecordTime(record.created_at) }}</td>
                        <td class="col-actions">
                          <button class="btn-delete-record" @click="deleteRecordById(record.id)" title="删除">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <Transition name="toast">
      <div v-if="message" class="toast" :class="[messageType, { dark: isDark }]">
        <svg v-if="messageType === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
        <svg v-else-if="messageType === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="10" x2="12" y2="16"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span>{{ message }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, computed } from 'vue'
import { useSettings } from '~/composables/useSettings'
import { formatShanghaiDateTime } from '~/utils/time'

definePageMeta({
  layout: 'default'
})

const { loadSettings: loadSharedSettings, updateSettingsData } = useSettings()

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

interface FileItem {
  type: 'file' | 'folder'
  name: string
  fileId: string
  parentId: string
  size: number
  updatedAt: string | null
}

interface PathPart {
  id: string
  name: string
}

interface RecognizeResult {
  mediaType: 'movie' | 'tv'
  tmdbId: number
  title: string
  originalTitle: string
  year: string
  posterUrl: string | null
  backdropUrl: string | null
  overview: string
  genres: string[]
  originCountry: string[]
  voteAverage: number
  category: string
  destRootId: string
  suggestedPath: string
  tech: {
    videoFormat: string
    resourceType: string
    videoCodec: string
    audioCodec: string
    releaseGroup: string
    edition: string
    webSource: string
    fileExt: string
  }
}

interface RecognizeApiResponse {
  success: boolean
  data?: RecognizeResult
  error?: any
}

const configReady = ref(false)
const configChecking = ref(true)
const loading = ref(false)
const files = ref<FileItem[]>([])
const folders = ref<FileItem[]>([])
const currentCid = ref('')
const pathParts = ref<PathPart[]>([])

const showOrganizeModal = ref(false)
const organizeLoading = ref(false)
const organizeStatus = ref('')
const organizeAction = ref<'move' | 'copy'>('move')
const currentItem = ref<FileItem | null>(null)
const currentItemType = ref<'file' | 'folder'>('file')
const recognizeResult = ref<RecognizeResult | null>(null)

const showCorrectForm = ref(false)
const correctMediaType = ref<'movie' | 'tv'>('movie')
const correctTmdbId = ref<string>('')

const showRecognizeModal = ref(false)
const recognizeLoading = ref(false)
const recognizeModalResult = ref<RecognizeResult | null>(null)
const recognizeModalItem = ref<FileItem | null>(null)

const message = ref('')
const messageType = ref<'success' | 'error' | 'info'>('success')
let toastTimer: ReturnType<typeof setTimeout> | null = null

const SWIPE_ACTION_WIDTH = 54
const SWIPE_ACTION_GAP = 8
const SWIPE_MAX_ACTIONS = 3
const MAX_SWIPE_OFFSET = SWIPE_MAX_ACTIONS * SWIPE_ACTION_WIDTH + (SWIPE_MAX_ACTIONS - 1) * SWIPE_ACTION_GAP
const SWIPE_OPEN_THRESHOLD = 54
const SWIPE_DRAG_THRESHOLD = 18

const mobileSwipeOpenKey = ref('')
const mobileSwipeActiveKey = ref('')
const mobileSwipeOffset = ref(0)
const touchStartX = ref(0)
const touchStartY = ref(0)
const touchDeltaX = ref(0)
const touchDeltaY = ref(0)
const touchTracking = ref(false)
const touchDragging = ref(false)

const organizeProgress = ref({ current: 0, total: 0, currentFile: '' })
let eventSource: EventSource | null = null

interface LogEntry {
  time: string
  level: 'info' | 'success' | 'warn' | 'error'
  tag: string
  message: string
}

const VIDEO_EXTS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.ts', '.m2ts', '.mpg', '.mpeg', '.rmvb', '.rm', '.vob', '.iso']
const SUBTITLE_EXTS = ['.srt', '.ass', '.ssa', '.sub', '.vtt', '.idx', '.sup', '.smi']

function getFileExtension(name: string): string {
  const dotIndex = name.lastIndexOf('.')
  return dotIndex === -1 ? '' : name.substring(dotIndex).toLowerCase()
}

function isVideoFile(name: string): boolean {
  return VIDEO_EXTS.includes(getFileExtension(name))
}

function isSubtitleFile(name: string): boolean {
  return SUBTITLE_EXTS.includes(getFileExtension(name))
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function showToast(msg: string, type: 'success' | 'error' | 'info' = 'success') {
  message.value = msg
  messageType.value = type

  if (toastTimer) {
    clearTimeout(toastTimer)
  }

  toastTimer = setTimeout(() => {
    message.value = ''
    toastTimer = null
  }, 3000)
}

onUnmounted(() => {
  if (toastTimer) {
    clearTimeout(toastTimer)
  }

  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
})

async function fetchAllVideoFiles(folderId: string, basePath: string = ''): Promise<string[]> {
  if (!folderId) {
    return []
  }

  try {
    const response = await $fetch('/api/pan115/fs_files_115', {
      method: 'POST',
      body: { cid: folderId }
    }) as any

    if (!response.success || !Array.isArray(response.files)) {
      return []
    }

    const names: string[] = []

    for (const entry of response.files as any[]) {
      const entryName = typeof entry?.name === 'string' ? entry.name : ''
      const entryPath = basePath ? `${basePath}/${entryName}` : entryName

      if (!entryName) {
        continue
      }

      if (entry.type === 'folder' && entry.fileId) {
        const nestedNames = await fetchAllVideoFiles(String(entry.fileId), entryPath)
        names.push(...nestedNames)
        continue
      }

      if (entry.type === 'file') {
        names.push(entryPath)
      }
    }

    return names
  } catch {
    return []
  }
}

function navigateTo(cid: string) {
  closeSwipeActions()

  if (!cid) {
    currentCid.value = ''
    pathParts.value = []
  } else {
    const index = pathParts.value.findIndex(part => part.id === cid)
    if (index >= 0) {
      currentCid.value = cid
      pathParts.value = pathParts.value.slice(0, index + 1)
    }
  }

  loadFiles()
}

function navigateToPath(index: number) {
  const target = pathParts.value[index]
  if (!target) {
    navigateTo('')
    return
  }

  navigateTo(target.id)
}

function enterFolder(folder: FileItem) {
  closeSwipeActions()
  currentCid.value = folder.fileId
  pathParts.value.push({
    id: folder.fileId,
    name: folder.name
  })
  loadFiles()
}

async function buildFolderRecognizePayload(item: FileItem, type: 'file' | 'folder') {
  return type === 'folder' && item.fileId ? await fetchAllVideoFiles(item.fileId) : undefined
}

async function buildRecognizeRequestBody(item: FileItem, type: 'file' | 'folder', extraBody: Record<string, any> = {}) {
  const folderFiles = await buildFolderRecognizePayload(item, type)

  return {
    fileName: item.name,
    isFolder: type === 'folder',
    folderFiles,
    ...extraBody
  }
}

async function checkConfig() {
  try {
    const response = await loadSharedSettings()
    if (response.success && response.data) {
      const { pan115Cookie, pan115SaveDir, pan115MediaDir } = response.data
      configReady.value = !!(pan115Cookie && pan115SaveDir && pan115MediaDir)
    }
  } catch (e) {
    configReady.value = false
  } finally {
    configChecking.value = false
  }
}

async function loadFiles() {
  loading.value = true
  try {
    const params = currentCid.value ? `?cid=${currentCid.value}` : ''
    const response = await $fetch(`/api/organize/list${params}`) as any

    if (response.success) {
      const allItems = response.files || []
      files.value = allItems.filter((item: FileItem) => item.type === 'file')
      folders.value = allItems.filter((item: FileItem) => item.type === 'folder')
    } else {
      showToast(response.error || '加载失败', 'error')
    }
  } catch (e: any) {
    showToast(e.message || '加载失败', 'error')
  } finally {
    loading.value = false
  }
}

function getSwipeKey(item: FileItem, type: 'file' | 'folder'): string {
  return `${type}:${item.fileId}`
}

function canShowRecognizeAction(item: FileItem, type: 'file' | 'folder'): boolean {
  return !!item && (type === 'folder' || type === 'file')
}

function getSwipeActionCount(item: FileItem, type: 'file' | 'folder'): number {
  return canShowRecognizeAction(item, type) ? 3 : 1
}

function getSwipeOpenOffset(item: FileItem, type: 'file' | 'folder'): number {
  const actionCount = getSwipeActionCount(item, type)
  return actionCount * SWIPE_ACTION_WIDTH + Math.max(0, actionCount - 1) * SWIPE_ACTION_GAP
}

function getSwipeItemStyle(item: FileItem, type: 'file' | 'folder') {
  const key = getSwipeKey(item, type)

  if (mobileSwipeActiveKey.value === key) {
    return {
      transform: `translateX(${mobileSwipeOffset.value}px)`
    }
  }

  if (mobileSwipeOpenKey.value === key) {
    return {
      transform: `translateX(${-getSwipeOpenOffset(item, type)}px)`
    }
  }

  return {
    transform: 'translateX(0)'
  }
}

function isMobileViewport() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.innerWidth <= 768
}

function resetSwipeState() {
  mobileSwipeActiveKey.value = ''
  mobileSwipeOffset.value = 0
  touchTracking.value = false
  touchDragging.value = false
  touchDeltaX.value = 0
  touchDeltaY.value = 0
}

function closeSwipeActions(preserveActiveKey: boolean = false) {
  mobileSwipeOpenKey.value = ''

  if (preserveActiveKey) {
    mobileSwipeOffset.value = 0
    touchTracking.value = false
    touchDragging.value = false
    touchDeltaX.value = 0
    touchDeltaY.value = 0
    return
  }

  resetSwipeState()
}

function handlePageTouchStart(event?: TouchEvent) {
  if (!mobileSwipeOpenKey.value || touchTracking.value) {
    return
  }

  const target = event?.target as HTMLElement | null
  if (target?.closest('.swipe-actions')) {
    return
  }

  closeSwipeActions(true)
}

function handlePageScroll() {
  if (mobileSwipeOpenKey.value && !touchTracking.value) {
    closeSwipeActions()
  }
}

function handleRowTouchStart(event: TouchEvent, item: FileItem, type: 'file' | 'folder') {
  if (!isMobileViewport()) {
    return
  }

  const target = event.target as HTMLElement | null
  if (target?.closest('.swipe-actions')) {
    return
  }

  const touch = event.touches[0]
  if (!touch) return

  const key = getSwipeKey(item, type)
  touchStartX.value = touch.clientX
  touchStartY.value = touch.clientY
  touchDeltaX.value = 0
  touchDeltaY.value = 0
  touchTracking.value = true
  touchDragging.value = false
  mobileSwipeActiveKey.value = key
  mobileSwipeOffset.value = mobileSwipeOpenKey.value === key ? -getSwipeOpenOffset(item, type) : 0
}

function handleRowTouchMove(event: TouchEvent, item: FileItem, type: 'file' | 'folder') {
  if (!touchTracking.value) return

  const touch = event.touches[0]
  if (!touch) return

  const deltaX = touch.clientX - touchStartX.value
  const deltaY = touch.clientY - touchStartY.value
  touchDeltaX.value = deltaX
  touchDeltaY.value = deltaY

  if (!touchDragging.value) {
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      resetSwipeState()
      return
    }

    if (Math.abs(deltaX) < SWIPE_DRAG_THRESHOLD) {
      return
    }

    if (deltaX >= 0 && mobileSwipeOpenKey.value !== getSwipeKey(item, type)) {
      resetSwipeState()
      return
    }

    touchDragging.value = true
  }

  event.preventDefault()

  const key = getSwipeKey(item, type)
  const openOffset = getSwipeOpenOffset(item, type)
  const baseOffset = mobileSwipeOpenKey.value === key ? -openOffset : 0
  const nextOffset = Math.max(-openOffset, Math.min(0, baseOffset + deltaX))
  mobileSwipeOffset.value = Math.max(-MAX_SWIPE_OFFSET, nextOffset)
}

function handleRowTouchEnd(item: FileItem, type: 'file' | 'folder') {
  if (!touchTracking.value) return

  const key = getSwipeKey(item, type)
  const openOffset = getSwipeOpenOffset(item, type)
  const shouldOpen = touchDragging.value
    ? Math.abs(mobileSwipeOffset.value) > Math.min(SWIPE_OPEN_THRESHOLD, openOffset / 2)
    : mobileSwipeOpenKey.value === key

  mobileSwipeOpenKey.value = shouldOpen ? key : ''
  resetSwipeState()
}

function handleRowTouchCancel() {
  resetSwipeState()
}

function handleSwipeAction(action: () => void) {
  action()
  closeSwipeActions()
}

function handleFileInfoClick(file: FileItem) {
  if (mobileSwipeOpenKey.value && isMobileViewport()) {
    closeSwipeActions()
    return
  }
}

function handleFolderInfoClick(folder: FileItem) {
  if (mobileSwipeOpenKey.value && isMobileViewport()) {
    closeSwipeActions()
    return
  }

  enterFolder(folder)
}

async function recognizeItem(item: FileItem, type: 'file' | 'folder') {
  recognizeModalItem.value = item
  recognizeModalResult.value = null
  showRecognizeModal.value = true
  recognizeLoading.value = true

  try {
    const body = await buildRecognizeRequestBody(item, type)
    const response = await $fetch<any>('/api/organize/recognize', {
      method: 'POST',
      body
    }) as RecognizeApiResponse

    if (response.success && response.data) {
      recognizeModalResult.value = response.data
    } else {
      recognizeModalResult.value = null
    }
  } catch {
    recognizeModalResult.value = null
  } finally {
    recognizeLoading.value = false
  }
}

function closeRecognizeModal() {
  showRecognizeModal.value = false
  recognizeModalItem.value = null
  recognizeModalResult.value = null
  recognizeLoading.value = false
}

async function organizeItem(item: FileItem, type: 'file' | 'folder') {
  currentItem.value = item
  currentItemType.value = type
  recognizeResult.value = null
  organizeAction.value = 'move'
  organizeLoading.value = true
  organizeStatus.value = '正在识别...'
  showOrganizeModal.value = true

  try {
    const body = await buildRecognizeRequestBody(item, type)
    const response = await $fetch<any>('/api/organize/recognize', {
      method: 'POST',
      body
    }) as RecognizeApiResponse

    if (response.success && response.data) {
      recognizeResult.value = response.data
    } else {
      recognizeResult.value = null
    }
  } catch {
    recognizeResult.value = null
  } finally {
    organizeLoading.value = false
    organizeStatus.value = ''
  }
}


function closeOrganizeModal() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
  showOrganizeModal.value = false
  currentItem.value = null
  recognizeResult.value = null
  organizeLoading.value = false
  organizeStatus.value = ''
  organizeProgress.value = { current: 0, total: 0, currentFile: '' }
  showCorrectForm.value = false
  correctTmdbId.value = ''
}

async function applyCorrection() {
  if (!correctTmdbId.value || !currentItem.value) return

  organizeLoading.value = true
  organizeStatus.value = '正在重新识别...'

  try {
    const body = await buildRecognizeRequestBody(currentItem.value, currentItemType.value, {
      forceMediaType: correctMediaType.value,
      forceTmdbId: parseInt(correctTmdbId.value, 10)
    })
    const response = await $fetch<any>('/api/organize/recognize', {
      method: 'POST',
      body
    }) as RecognizeApiResponse

    if (response.success && response.data) {
      recognizeResult.value = response.data
      showCorrectForm.value = false
      correctTmdbId.value = ''
      showToast('纠错成功', 'success')
    } else {
      showToast(response.error || '识别失败', 'error')
    }
  } catch (e: any) {
    showToast(e.message || '识别失败', 'error')
  } finally {
    organizeLoading.value = false
    organizeStatus.value = ''
  }
}

async function executeOrganize() {
  if (!currentItem.value) return

  if (!recognizeResult.value) {
    showToast('请先识别文件', 'error')
    return
  }

  organizeLoading.value = true
  organizeStatus.value = '正在整理...'
  organizeProgress.value = { current: 0, total: 0, currentFile: '' }

  eventSource = new EventSource('/api/organize/logs?sse=true')
  eventSource.onmessage = (event) => {
    try {
      const log: LogEntry = JSON.parse(event.data)
      
      const moveMatch = log.message.match(/^(?:移动|复制|字幕):\s*(.+?)\s*->/)
      if (moveMatch && moveMatch[1]) {
        organizeProgress.value.current++
        organizeProgress.value.currentFile = moveMatch[1]
      }
      
      const startMatch = log.message.match(/发现\s*(\d+)\s*个视频文件/)
      if (startMatch && startMatch[1]) {
        organizeProgress.value.total = parseInt(startMatch[1], 10)
      }
    } catch (e) {}
  }

  try {
    const body: any = {
      platform: '115',
      srcType: currentItemType.value,
      action: organizeAction.value,
      mediaType: recognizeResult.value.mediaType,
      tmdbId: recognizeResult.value.tmdbId,
      suggestedPath: recognizeResult.value.suggestedPath,
      title: recognizeResult.value.title,
      year: recognizeResult.value.year,
      posterUrl: recognizeResult.value.posterUrl,
      backdropUrl: recognizeResult.value.backdropUrl
    }

    if (currentItemType.value === 'file') {
      body.fileId = currentItem.value.fileId
      body.fileName = currentItem.value.name
      body.sizeBytesHint = currentItem.value.size
    } else {
      body.folderId = currentItem.value.fileId
      body.folderName = currentItem.value.name
    }

    const response = await $fetch('/api/organize/execute', {
      method: 'POST',
      body,
      timeout: 600000
    }) as any

    if (response.success) {
      setTimeout(() => {
        showToast('整理成功', 'success')
        closeOrganizeModal()
        loadFiles()
      }, 500)
    } else {
      showToast(response.error || '整理失败', 'error')
    }
  } catch (e: any) {
    showToast(e.message || '整理失败', 'error')
  } finally {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    organizeLoading.value = false
    organizeStatus.value = ''
  }
}

onMounted(() => {
  checkConfig().then(() => {
    if (configReady.value) {
      loadFiles()
    }
  })
})

const showSettingsModal = ref(false)
const settingsLoading = ref(false)
const settingsTab = ref<'rename' | 'classify' | 'groups' | 'auto'>('rename')
const settingsForm = reactive({
  movieTemplate: '',
  tvTemplate: '',
  movieRules: '',
  tvRules: ''
})

const autoOrganizeForm = reactive({
  enabled: false,
  action: 'move' as 'move' | 'copy',
  cronExpression: '0 3 * * *'
})

const autoOrganizeStatus = ref<{ isRunning: boolean; cronExpression: string } | null>(null)

const showBuiltinGroups = ref(false)
const builtinGroups = ref<string[]>([])
const customGroups = ref<string[]>([])
const newGroupInput = ref('')

const DEFAULT_MOVIE_TEMPLATE = '{{title}}{% if year %} ({{year}}){% endif %} {tmdb={{tmdbid}}}/{{title}}{% if year %}.{{year}}{% endif %}{% if videoFormat %}.{{videoFormat}}{% endif %}{% if edition %}.{{edition}}{% endif %}{% if videoCodec %}.{{videoCodec}}{% endif %}{% if audioCodec %}.{{audioCodec}}{% endif %}{% if webSource %}.{{webSource}}{% endif %}{% if releaseGroup %}-{{releaseGroup}}{% endif %}{{fileExt}}'

const DEFAULT_TV_TEMPLATE = '{{title}}{% if year %} ({{year}}){% endif %} {tmdb={{tmdbid}}}/Season {{ "%02d" | format(season|int) }}/{{title}}{% if seasonYear %}.{{seasonYear}}{% endif %}.{{seasonEpisode}}{% if videoFormat %}.{{videoFormat}}{% endif %}{% if edition %}.{{edition}}{% endif %}{% if videoCodec %}.{{videoCodec}}{% endif %}{% if audioCodec %}.{{audioCodec}}{% endif %}{% if webSource %}.{{webSource}}{% endif %}{% if releaseGroup %}-{{releaseGroup}}{% endif %}{{fileExt}}'

const DEFAULT_MOVIE_RULES = JSON.stringify([
  { category: '电影/动画电影', conditions: { genreIds: '16' } },
  { category: '电影/国产电影', conditions: { originCountry: 'CN,TW,HK' } },
  { category: '电影/日韩电影', conditions: { originCountry: 'JP,KP,KR' } },
  { category: '电影/欧美电影', conditions: {} }
], null, 2)

const DEFAULT_TV_RULES = JSON.stringify([
  { category: '剧集/国产动漫', conditions: { genreIds: '16', originCountry: 'CN,TW,HK' } },
  { category: '剧集/日本番剧', conditions: { genreIds: '16', originCountry: 'JP' } },
  { category: '剧集/欧美动漫', conditions: { genreIds: '16', originCountry: 'US,FR,GB,DE,ES,IT,NL,PT,RU,UK' } },
  { category: '其他/纪录片', conditions: { genreIds: '99' } },
  { category: '其他/综艺', conditions: { genreIds: '10764,10767' } },
  { category: '剧集/儿童', conditions: { genreIds: '10762' } },
  { category: '剧集/国产剧', conditions: { originCountry: 'CN,TW,HK' } },
  { category: '剧集/日韩剧', conditions: { originCountry: 'JP,KP,KR,TH,IN,SG' } },
  { category: '剧集/欧美剧', conditions: {} }
], null, 2)

async function loadSettings() {
  try {
    const response = await loadSharedSettings()
    if (response.success && response.data) {
      settingsForm.movieTemplate = response.data.renameMovieTemplate || DEFAULT_MOVIE_TEMPLATE
      settingsForm.tvTemplate = response.data.renameTvTemplate || DEFAULT_TV_TEMPLATE

      if (response.data.classificationStrategy) {
        try {
          const strategy = JSON.parse(response.data.classificationStrategy)
          settingsForm.movieRules = JSON.stringify(strategy.movie || [], null, 2)
          settingsForm.tvRules = JSON.stringify(strategy.tv || [], null, 2)
        } catch (e) {
          settingsForm.movieRules = DEFAULT_MOVIE_RULES
          settingsForm.tvRules = DEFAULT_TV_RULES
        }
      } else {
        settingsForm.movieRules = DEFAULT_MOVIE_RULES
        settingsForm.tvRules = DEFAULT_TV_RULES
      }

      builtinGroups.value = response.data.builtinReleaseGroups || []

      if (response.data.customReleaseGroups) {
        try {
          customGroups.value = JSON.parse(response.data.customReleaseGroups)
        } catch (e) {
          customGroups.value = []
        }
      } else {
        customGroups.value = []
      }
    }

    const autoResponse = await $fetch('/api/organize/auto-config') as any
    if (autoResponse.success && autoResponse.data) {
      autoOrganizeForm.enabled = autoResponse.data.enabled
      autoOrganizeForm.action = autoResponse.data.action
      autoOrganizeForm.cronExpression = autoResponse.data.cronExpression
      autoOrganizeStatus.value = {
        isRunning: autoResponse.data.isRunning,
        cronExpression: autoResponse.data.cronExpression
      }
    }
  } catch (e) {}
}

function openSettingsModal() {
  loadSettings()
  showSettingsModal.value = true
}

function closeSettingsModal() {
  showSettingsModal.value = false
}

interface OrganizeRecord {
  id: number
  name: string
  original_path: string
  target_path: string
  action: 'move' | 'copy'
  status: 'success' | 'failed'
  created_at: string
}

const showRecordsModal = ref(false)
const recordsLoading = ref(false)
const records = ref<OrganizeRecord[]>([])
const recordsTotal = ref(0)
const recordsPage = ref(1)
const recordsPageSize = 50
const recordsTotalPages = computed(() => Math.max(1, Math.ceil(recordsTotal.value / recordsPageSize)))
const canGoPrevRecordsPage = computed(() => recordsPage.value > 1)
const canGoNextRecordsPage = computed(() => recordsPage.value < recordsTotalPages.value)

async function loadRecords(page: number = recordsPage.value) {
  const nextPage = Math.max(1, page)
  const offset = (nextPage - 1) * recordsPageSize

  recordsLoading.value = true
  try {
    const response = await $fetch(`/api/organize/records?limit=${recordsPageSize}&offset=${offset}`) as any
    if (response.success) {
      const total = Number(response.total) || 0
      const totalPages = Math.max(1, Math.ceil(total / recordsPageSize))
      const normalizedPage = Math.min(nextPage, totalPages)

      if (normalizedPage !== nextPage) {
        recordsPage.value = normalizedPage
        await loadRecords(normalizedPage)
        return
      }

      records.value = response.data || []
      recordsTotal.value = total
      recordsPage.value = normalizedPage
      return
    }

    records.value = []
    recordsTotal.value = 0
    recordsPage.value = 1
  } catch (e) {
    records.value = []
    recordsTotal.value = 0
    recordsPage.value = 1
  } finally {
    recordsLoading.value = false
  }
}

function goToPrevRecordsPage() {
  if (!canGoPrevRecordsPage.value || recordsLoading.value) return
  loadRecords(recordsPage.value - 1)
}

function goToNextRecordsPage() {
  if (!canGoNextRecordsPage.value || recordsLoading.value) return
  loadRecords(recordsPage.value + 1)
}

function openRecordsModal() {
  recordsPage.value = 1
  loadRecords(1)
  showRecordsModal.value = true
}

function closeRecordsModal() {
  showRecordsModal.value = false
}

async function deleteRecordById(id: number) {
  if (!confirm('确定要删除此记录吗？')) return

  try {
    const response = await $fetch(`/api/organize/records?id=${id}`, { method: 'DELETE' }) as any
    if (response.success) {
      const nextTotal = Math.max(0, recordsTotal.value - 1)
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / recordsPageSize))
      recordsTotal.value = nextTotal
      recordsPage.value = Math.min(recordsPage.value, nextTotalPages)
      await loadRecords(recordsPage.value)
      showToast('记录已删除', 'success')
    } else {
      showToast(response.error || '删除失败', 'error')
    }
  } catch (e: any) {
    showToast(e.message || '删除失败', 'error')
  }
}

async function clearAllRecords() {
  if (!confirm('确定要清空所有记录吗？此操作不可恢复。')) return

  try {
    const response = await $fetch('/api/organize/records?clear=true', { method: 'DELETE' }) as any
    if (response.success) {
      records.value = []
      recordsTotal.value = 0
      recordsPage.value = 1
      showToast(response.message || '记录已清空', 'success')
    } else {
      showToast(response.error || '清空失败', 'error')
    }
  } catch (e: any) {
    showToast(e.message || '清空失败', 'error')
  }
}

function formatRecordTime(time: string): string {
  return formatShanghaiDateTime(time, false) || time
}

function resetMovieTemplate() {
  settingsForm.movieTemplate = DEFAULT_MOVIE_TEMPLATE
}

function resetTvTemplate() {
  settingsForm.tvTemplate = DEFAULT_TV_TEMPLATE
}

function resetMovieRules() {
  settingsForm.movieRules = DEFAULT_MOVIE_RULES
}

function resetTvRules() {
  settingsForm.tvRules = DEFAULT_TV_RULES
}

function addCustomGroup() {
  const group = newGroupInput.value.trim()
  if (group && !customGroups.value.includes(group) && !builtinGroups.value.includes(group)) {
    customGroups.value.push(group)
    newGroupInput.value = ''
  }
}

function removeCustomGroup(index: number) {
  customGroups.value.splice(index, 1)
}

function handleBackspace() {
  if (!newGroupInput.value && customGroups.value.length > 0) {
    customGroups.value.pop()
  }
}

async function saveSettings() {
  settingsLoading.value = true
  try {
    let classificationStrategy = null
    try {
      const movieRules = JSON.parse(settingsForm.movieRules)
      const tvRules = JSON.parse(settingsForm.tvRules)
      classificationStrategy = JSON.stringify({ movie: movieRules, tv: tvRules })
    } catch (e) {
      showToast('分类规则JSON格式错误', 'error')
      settingsLoading.value = false
      return
    }
    
    const settingsPayload = {
      rename_movie_template: settingsForm.movieTemplate,
      rename_tv_template: settingsForm.tvTemplate,
      classification_strategy: classificationStrategy,
      custom_release_groups: JSON.stringify(customGroups.value)
    }

    const response = await $fetch('/api/settings', {
      method: 'POST',
      body: settingsPayload
    }) as any
    
    if (!response.success) {
      showToast(response.error || '保存失败', 'error')
      settingsLoading.value = false
      return
    }

    updateSettingsData({
      renameMovieTemplate: settingsPayload.rename_movie_template,
      renameTvTemplate: settingsPayload.rename_tv_template,
      classificationStrategy: settingsPayload.classification_strategy,
      customReleaseGroups: settingsPayload.custom_release_groups
    })
    
    const autoResponse = await $fetch('/api/organize/auto-config', {
      method: 'POST',
      body: {
        enabled: autoOrganizeForm.enabled,
        action: autoOrganizeForm.action,
        cronExpression: autoOrganizeForm.cronExpression
      }
    }) as any
    
    if (autoResponse.success) {
      autoOrganizeStatus.value = {
        isRunning: autoOrganizeForm.enabled,
        cronExpression: autoOrganizeForm.cronExpression
      }
      showToast('设置已保存', 'success')
      closeSettingsModal()
    } else {
      showToast(autoResponse.error || '自动整理配置保存失败', 'error')
    }
  } catch (e: any) {
    showToast(e.message || '保存失败', 'error')
  } finally {
    settingsLoading.value = false
  }
}

const showDeleteModal = ref(false)
const deleteLoading = ref(false)
const deleteItem = ref<FileItem | null>(null)
const deleteItemType = ref<'file' | 'folder'>('file')

function confirmDelete(item: FileItem, type: 'file' | 'folder') {
  deleteItem.value = item
  deleteItemType.value = type
  showDeleteModal.value = true
}

function closeDeleteModal() {
  showDeleteModal.value = false
  deleteItem.value = null
  deleteLoading.value = false
}

async function executeDelete() {
  if (!deleteItem.value) return

  deleteLoading.value = true

  try {
    const response = await $fetch('/api/pan115/delete_115', {
      method: 'POST',
      body: {
        fileIds: deleteItem.value.fileId
      }
    }) as any

    if (response.success) {
      showToast('删除成功', 'success')
      closeDeleteModal()
      loadFiles()
    } else {
      showToast(response.error || '删除失败', 'error')
    }
  } catch (e: any) {
    showToast(e.message || '删除失败', 'error')
  } finally {
    deleteLoading.value = false
  }
}
</script>

<style scoped>
.organize {
  padding: 0;
}

.page-header {
  display: none;
}

.config-warning {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-radius: 24px;
  border: 1px solid rgba(245, 158, 11, 0.22);
  background: rgba(254, 243, 199, 0.72);
  color: #b45309;
  box-shadow:
    0 18px 40px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.54);
  backdrop-filter: blur(20px);
}

.config-warning.dark {
  border-color: rgba(245, 158, 11, 0.22);
  background: rgba(120, 53, 15, 0.28);
  color: #fcd34d;
  box-shadow:
    0 18px 40px rgba(2, 6, 23, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.config-warning svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
  padding: 14px 16px;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.62);
  box-shadow:
    0 22px 54px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(24px);
}

.toolbar.dark {
  border-color: rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.56);
  box-shadow:
    0 22px 54px rgba(2, 6, 23, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
}

.breadcrumb.dark {
  color: #94a3b8;
}

.breadcrumb-item {
  color: #2563eb;
  cursor: pointer;
  white-space: nowrap;
}

.breadcrumb-item:hover {
  color: #1d4ed8;
  text-decoration: none;
}

.breadcrumb-sep {
  color: #94a3b8;
}

.toolbar-left {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.btn-refresh,
.btn-settings,
.btn-records {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
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
}

.btn-refresh:hover,
.btn-settings:hover,
.btn-records:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.94);
  border-color: rgba(96, 165, 250, 0.28);
  color: #1e293b;
}

.btn-refresh.dark,
.btn-settings.dark,
.btn-records.dark {
  border-color: rgba(71, 85, 105, 0.54);
  background: rgba(30, 41, 59, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
}

.btn-refresh.dark:hover,
.btn-settings.dark:hover,
.btn-records.dark:hover {
  background: rgba(51, 65, 85, 0.96);
  color: #f8fafc;
}

.btn-refresh svg,
.btn-settings svg,
.btn-records svg {
  width: 15px;
  height: 15px;
}

.btn-refresh svg.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.content-area {
  border-radius: 30px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.58);
  box-shadow:
    0 22px 54px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
  min-height: 400px;
  backdrop-filter: blur(24px);
}

.content-area.dark {
  border-color: rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.52);
  box-shadow:
    0 22px 54px rgba(2, 6, 23, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #94a3b8;
}

.loading-state svg,
.empty-state svg {
  width: 44px;
  height: 44px;
  margin-bottom: 12px;
}

.loading-state svg.spin {
  animation: spin 1s linear infinite;
}

.section {
  padding: 18px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.56);
}

.section:last-child {
  border-bottom: none;
}

.section.dark {
  border-bottom-color: rgba(71, 85, 105, 0.4);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.section-header h3 {
  font-size: 14px;
  font-weight: 650;
  color: #475569;
  margin: 0;
}

.section-header.dark h3 {
  color: #94a3b8;
}

.count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  background: rgba(241, 245, 249, 0.9);
  border: 1px solid rgba(226, 232, 240, 0.82);
  border-radius: 999px;
}

.count.dark {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.52);
  color: #cbd5e1;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.62);
  background: rgba(248, 250, 252, 0.66);
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.file-item.folder {
  cursor: pointer;
}

.file-item:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.82);
  border-color: rgba(96, 165, 250, 0.22);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.04);
}

.file-item.dark {
  border-color: rgba(71, 85, 105, 0.46);
  background: rgba(30, 41, 59, 0.64);
}

.file-item.dark:hover {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(96, 165, 250, 0.22);
  box-shadow: 0 14px 28px rgba(2, 6, 23, 0.22);
}

.file-icon {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  flex-shrink: 0;
}

.file-icon svg {
  width: 22px;
  height: 22px;
}

.file-icon.folder-icon {
  color: #f59e0b;
}

.file-icon.video {
  color: #3b82f6;
}

.file-icon.subtitle {
  color: #10b981;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-info.folder-info {
  cursor: pointer;
}

.file-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-item.dark .file-name {
  color: #f8fafc;
}

.file-meta {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}

.file-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-action {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(226, 232, 240, 0.78);
  background: rgba(255, 255, 255, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
  border-radius: 12px;
  color: #64748b;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.btn-action:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.94);
  border-color: rgba(96, 165, 250, 0.24);
  color: #2563eb;
}

.btn-action.dark {
  border-color: rgba(71, 85, 105, 0.54);
  background: rgba(30, 41, 59, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
}

.btn-action.dark:hover {
  background: rgba(51, 65, 85, 0.96);
}

.btn-action svg {
  width: 16px;
  height: 16px;
}

.btn {
  padding: 8px 16px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
  border: 1px solid transparent;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  box-shadow: 0 14px 28px rgba(59, 130, 246, 0.2);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 32px rgba(59, 130, 246, 0.28);
}

.btn-secondary {
  border-color: rgba(226, 232, 240, 0.9);
  background: rgba(255, 255, 255, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  color: #475569;
}

.btn-secondary:hover {
  transform: translateY(-1px);
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(255, 255, 255, 0.94);
  color: #1e293b;
}

.btn-secondary.dark {
  border-color: rgba(71, 85, 105, 0.54);
  background: rgba(30, 41, 59, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
}

.btn-secondary.dark:hover {
  background: #475569;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding-left: 264px;
  padding-right: 24px;
  box-sizing: border-box;
  background: rgba(15, 23, 42, 0.36);
  backdrop-filter: blur(16px);
}

.modal {
  width: 480px;
  max-width: 90%;
  overflow: hidden;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.78);
  box-shadow:
    0 28px 70px rgba(15, 23, 42, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(24px);
}

.modal.dark {
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

.modal.dark .modal-header {
  border-bottom-color: rgba(71, 85, 105, 0.42);
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 650;
  color: #0f172a;
  margin: 0;
}

.modal.dark .modal-header h3 {
  color: #f8fafc;
}

.btn-close {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(226, 232, 240, 0.88);
  border-radius: 12px;
  color: #64748b;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.btn-close:hover {
  transform: translateY(-1px);
  background: rgba(241, 245, 249, 0.96);
  border-color: rgba(148, 163, 184, 0.24);
  color: #0f172a;
}

.modal.dark .btn-close {
  background: rgba(30, 41, 59, 0.84);
  border-color: rgba(71, 85, 105, 0.54);
  color: #cbd5e1;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.modal.dark .btn-close:hover {
  background: rgba(51, 65, 85, 0.96);
  color: #f8fafc;
}

.btn-close svg {
  width: 16px;
  height: 16px;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid rgba(226, 232, 240, 0.62);
}

.modal.dark .modal-footer {
  border-top-color: rgba(71, 85, 105, 0.42);
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

.toast.info {
  background: rgba(219, 234, 254, 0.94);
  border-color: rgba(96, 165, 250, 0.28);
  color: #1d4ed8;
}

.toast.info.dark {
  background: rgba(30, 64, 175, 0.22);
  border-color: rgba(96, 165, 250, 0.24);
  color: #bfdbfe;
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

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(16px);
}

.organize-progress {
  min-height: 100%;
  padding: 20px 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}

.progress-header svg {
  width: 24px;
  height: 24px;
  color: #3b82f6;
  animation: spin 1s linear infinite;
}

.progress-title {
  font-size: 16px;
  font-weight: 500;
  color: #1e293b;
}

.dark .progress-title {
  color: #f1f5f9;
}

.progress-bar-container {
  width: min(100%, 360px);
  margin-bottom: 12px;
}

.progress-bar {
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.dark .progress-bar {
  background: #334155;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  text-align: right;
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}

.dark .progress-text {
  color: #94a3b8;
}

.progress-file {
  width: min(100%, 420px);
  font-size: 13px;
  color: #64748b;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #f1f5f9;
  border-radius: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dark .progress-file {
  background: #1e293b;
  color: #94a3b8;
}

.settings-modal {
  width: 560px;
  max-width: 90vw;
  height: min(80vh, 720px);
  max-height: min(80vh, 720px);
  display: flex;
  flex-direction: column;
}

.settings-modal .modal-body {
  flex: 1 1 auto;
  min-height: 0;
  height: auto;
  padding-top: 18px;
  overflow-y: auto;
  overflow-x: hidden;
}

.records-modal {
  width: 100%;
  max-width: 100%;
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  margin-top: 20px;
  margin-bottom: 20px;
}

.records-modal .modal-header {
  padding: 14px 18px 12px;
}

.records-modal .modal-header h3 {
  font-size: 15px;
}

.records-modal .btn-close {
  width: 30px;
  height: 30px;
  border-radius: 10px;
}

.records-modal .btn-close svg {
  width: 14px;
  height: 14px;
}

.records-modal .modal-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  padding: 12px 14px 14px;
  overflow: hidden;
}

.records-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.records-count {
  font-size: 14px;
  color: #64748b;
}

.dark .records-count {
  color: #94a3b8;
}

.btn-clear-records {
  min-height: 32px;
  padding: 0 12px;
  background: rgba(254, 242, 242, 0.9);
  border: 1px solid rgba(248, 113, 113, 0.2);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
  border-radius: 12px;
  color: #dc2626;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.btn-clear-records:hover {
  transform: translateY(-1px);
  background: rgba(254, 226, 226, 0.98);
  border-color: rgba(248, 113, 113, 0.28);
}

.btn-clear-records.dark {
  background: rgba(127, 29, 29, 0.3);
  border-color: rgba(248, 113, 113, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #fca5a5;
}

.btn-clear-records.dark:hover {
  background: rgba(153, 27, 27, 0.42);
}

.btn-clear-records:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.records-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.records-page-info {
  font-size: 12px;
  color: #94a3b8;
}

.dark .records-page-info {
  color: #64748b;
}

.records-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.records-pagination {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-records-page {
  min-height: 32px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid rgba(226, 232, 240, 0.88);
  background: rgba(255, 255, 255, 0.9);
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.btn-records-page:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(239, 246, 255, 0.96);
  color: #1d4ed8;
}

.btn-records-page.dark {
  border-color: rgba(71, 85, 105, 0.58);
  background: rgba(30, 41, 59, 0.88);
  color: #cbd5e1;
}

.btn-records-page.dark:hover:not(:disabled) {
  border-color: rgba(96, 165, 250, 0.34);
  background: rgba(30, 64, 175, 0.22);
  color: #bfdbfe;
}

.btn-records-page:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.records-table-container {
  flex: 1 1 auto;
  min-height: 200px;
  max-height: none;
  overflow-y: auto;
  overflow-x: auto;
  border: 1px solid rgba(226, 232, 240, 0.76);
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.52);
}

.dark .records-table-container {
  border-color: rgba(71, 85, 105, 0.52);
  background: rgba(15, 23, 42, 0.28);
}

.records-loading,
.records-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #94a3b8;
}

.records-loading svg,
.records-empty svg {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
}

.records-table {
  width: 100%;
  min-width: 900px;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
  table-layout: auto;
}

.records-table th,
.records-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid rgba(226, 232, 240, 0.72);
  white-space: nowrap;
}

.dark .records-table th,
.dark .records-table td {
  border-bottom-color: rgba(51, 65, 85, 0.72);
}

.records-table th {
  background: rgba(248, 250, 252, 0.92);
  font-weight: 600;
  color: #475569;
  position: sticky;
  top: 0;
  z-index: 1;
  backdrop-filter: blur(12px);
}

.dark .records-table th {
  background: rgba(30, 41, 59, 0.92);
  color: #94a3b8;
}

.records-table tr:hover {
  background: rgba(241, 245, 249, 0.78);
}

.dark .records-table tr:hover {
  background: rgba(30, 41, 59, 0.82);
}

.col-name {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: #1e293b;
}

.dark .col-name {
  color: #f1f5f9;
}

.col-filename {
  min-width: 450px;
}

.filename-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  font-size: 12px;
  line-height: 1.5;
}

.filename-row.original {
  margin-bottom: 4px;
}

.filename-value {
  color: #64748b;
  font-family: monospace;
  word-break: break-all;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.dark .filename-value {
  color: #94a3b8;
}

.filename-row.target .filename-value {
  color: #16a34a;
}

.dark .filename-row.target .filename-value {
  color: #86efac;
}

.col-action,
.col-status {
  text-align: center;
}

.col-time {
  color: #64748b;
  font-size: 12px;
}

.dark .col-time {
  color: #94a3b8;
}

.col-actions {
  text-align: center;
  width: 60px;
}

.action-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.action-tag.move {
  background: rgba(219, 234, 254, 0.88);
  color: #1d4ed8;
}

.action-tag.copy {
  background: rgba(254, 243, 199, 0.88);
  color: #d97706;
}

.dark .action-tag.move {
  background: rgba(30, 64, 175, 0.24);
  color: #93c5fd;
}

.dark .action-tag.copy {
  background: rgba(120, 53, 15, 0.3);
  color: #fcd34d;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.status-tag.success {
  background: rgba(220, 252, 231, 0.92);
  color: #16a34a;
}

.status-tag.failed {
  background: rgba(254, 226, 226, 0.92);
  color: #dc2626;
}

.dark .status-tag.success {
  background: rgba(22, 101, 52, 0.34);
  color: #86efac;
}

.dark .status-tag.failed {
  background: rgba(153, 27, 27, 0.34);
  color: #fca5a5;
}

.btn-delete-record {
  width: 30px;
  height: 30px;
  padding: 0;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(248, 113, 113, 0.16);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
  color: #dc2626;
}

.btn-delete-record:hover {
  transform: translateY(-1px);
  background: rgba(254, 242, 242, 0.94);
  border-color: rgba(248, 113, 113, 0.24);
}

.dark .btn-delete-record {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(248, 113, 113, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.dark .btn-delete-record:hover {
  background: rgba(127, 29, 29, 0.28);
  border-color: rgba(248, 113, 113, 0.18);
}

.btn-delete-record svg {
  width: 15px;
  height: 15px;
}

.settings-tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 12px 16px 0;
  padding: 6px;
  min-height: 50px;
  box-sizing: border-box;
  flex-shrink: 0;
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.72);
  background: rgba(248, 250, 252, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  overflow-x: hidden;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}

.dark .settings-tabs {
  border-color: rgba(71, 85, 105, 0.5);
  background: rgba(30, 41, 59, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 14px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 12px;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
  box-sizing: border-box;
}

@media (max-width: 640px) {
  .settings-tabs {
    display: flex;
    width: calc(100% - 16px);
    margin: 10px 8px 0;
    padding: 5px;
    min-height: 44px;
    gap: 4px;
    border-radius: 16px;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .tab-btn {
    min-height: 34px;
    padding: 0 10px;
    font-size: 12px;
    gap: 4px;
    border-radius: 10px;
  }

  .tab-btn svg {
    width: 14px;
    height: 14px;
  }

  .section-header-row {
    align-items: flex-start;
    gap: 8px;
    flex-wrap: wrap;
  }

  .btn-toggle {
    min-height: 28px;
    padding: 0 9px;
    border-radius: 9px;
    font-size: 10px;
  }

  .btn-toggle svg {
    width: 12px;
    height: 12px;
  }

  .groups-container {
    gap: 6px;
    padding: 10px;
    border-radius: 14px;
    max-height: 136px;
  }

  .groups-container.custom {
    min-height: 42px;
  }

  .group-tag {
    min-height: 24px;
    padding: 0 9px;
    font-size: 10px;
  }

  .group-input {
    min-width: 92px;
    min-height: 28px;
    font-size: 11px;
  }

  .custom-groups-input {
    border-radius: 14px;
  }

  .form-group label {
    font-size: 11px;
    margin-bottom: 5px;
  }

  .form-textarea {
    padding: 11px 12px;
    border-radius: 14px;
    font-size: 12px;
    min-height: 76px;
  }

  .code-textarea {
    font-size: 11px;
  }

  .field-hint {
    margin-top: 6px;
  }

  .hint-text {
    font-size: 10px;
  }

  .btn-link {
    min-height: 26px;
    padding: 0 9px;
    border-radius: 9px;
    font-size: 10px;
  }
}

.tab-btn:hover {
  color: #2563eb;
  background: rgba(255, 255, 255, 0.72);
  border-color: rgba(226, 232, 240, 0.72);
}

.tab-btn.active {
  color: #1d4ed8;
  background: rgba(255, 255, 255, 0.94);
  border-color: rgba(191, 219, 254, 0.92);
  box-shadow: 0 8px 18px rgba(59, 130, 246, 0.12);
}

.tab-btn.dark {
  color: #94a3b8;
}

.tab-btn.dark:hover {
  color: #e2e8f0;
  background: rgba(51, 65, 85, 0.9);
  border-color: rgba(71, 85, 105, 0.56);
}

.tab-btn.dark.active {
  color: #dbeafe;
  background: rgba(37, 99, 235, 0.22);
  border-color: rgba(96, 165, 250, 0.3);
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.16);
}

.tab-btn svg {
  width: 15px;
  height: 15px;
}

.settings-section {
  margin-bottom: 20px;
  padding-top: 2px;
  min-height: 100%;
}

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-header-row label {
  margin-bottom: 0;
}

.btn-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 30px;
  padding: 0 10px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(226, 232, 240, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.btn-toggle:hover {
  transform: translateY(-1px);
  border-color: rgba(96, 165, 250, 0.3);
  background: rgba(255, 255, 255, 0.94);
  color: #2563eb;
}

.dark .btn-toggle {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #94a3b8;
}

.dark .btn-toggle:hover {
  background: rgba(51, 65, 85, 0.94);
  border-color: rgba(96, 165, 250, 0.24);
  color: #dbeafe;
}

.btn-toggle svg {
  width: 13px;
  height: 13px;
  transition: transform 0.2s ease;
}

.btn-toggle svg.rotated {
  transform: rotate(180deg);
}

.groups-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background: rgba(248, 250, 252, 0.78);
  border: 1px solid rgba(226, 232, 240, 0.82);
  border-radius: 16px;
  max-height: 150px;
  overflow-y: auto;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.groups-container.dark {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.groups-container.custom {
  min-height: 46px;
  align-items: center;
}

.group-tag {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.group-tag.builtin {
  background: rgba(226, 232, 240, 0.88);
  color: #475569;
}

.dark .group-tag.builtin {
  background: rgba(51, 65, 85, 0.92);
  color: #cbd5e1;
}

.group-tag.custom {
  background: rgba(219, 234, 254, 0.9);
  color: #1d4ed8;
}

.dark .group-tag.custom {
  background: rgba(30, 64, 175, 0.24);
  color: #93c5fd;
}

.tag-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin-left: 4px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: inherit;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.tag-remove:hover {
  opacity: 1;
}

.tag-remove svg {
  width: 10px;
  height: 10px;
}

.group-input {
  flex: 1;
  min-width: 120px;
  min-height: 30px;
  padding: 0 4px;
  background: transparent;
  border: none;
  outline: none;
  font-size: 12px;
  color: #0f172a;
}

.group-input.dark {
  color: #e2e8f0;
}

.group-input::placeholder {
  color: #94a3b8;
}

.custom-groups-input {
  border: 1px solid rgba(226, 232, 240, 0.82);
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.42);
}

.custom-groups-input.dark {
  border-color: rgba(71, 85, 105, 0.54);
  background: rgba(15, 23, 42, 0.24);
}

.hint-text {
  font-size: 11px;
  line-height: 1.5;
  color: #94a3b8;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 6px;
}

.dark .form-group label {
  color: #cbd5e1;
}

.form-textarea {
  width: 100%;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(226, 232, 240, 0.88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
  border-radius: 16px;
  font-size: 13px;
  line-height: 1.55;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #0f172a;
  resize: vertical;
  min-height: 84px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.form-textarea.dark {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #e2e8f0;
}

.form-textarea:focus {
  outline: none;
  border-color: rgba(96, 165, 250, 0.42);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.code-textarea {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.55;
  tab-size: 2;
}

.field-hint {
  margin-top: 8px;
  text-align: right;
}

.btn-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(226, 232, 240, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  border-radius: 10px;
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.btn-link:hover {
  transform: translateY(-1px);
  color: #1d4ed8;
  border-color: rgba(96, 165, 250, 0.3);
  background: rgba(255, 255, 255, 0.94);
  text-decoration: none;
}

.dark .btn-link {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #93c5fd;
}

.dark .btn-link:hover {
  background: rgba(51, 65, 85, 0.94);
  border-color: rgba(96, 165, 250, 0.24);
  color: #dbeafe;
}


.organize-preview {
  background: #f8fafc;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.organize-preview.dark {
  background: #334155;
}

.organize-options {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.dark .organize-options {
  border-top-color: #334155;
}

.action-type-selector {
  display: flex;
  gap: 12px;
}

.action-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(226, 232, 240, 0.88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.action-btn:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.94);
  border-color: rgba(96, 165, 250, 0.28);
  color: #2563eb;
}

.action-btn.dark {
  color: #94a3b8;
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.action-btn.dark:hover {
  background: rgba(51, 65, 85, 0.94);
  border-color: rgba(96, 165, 250, 0.24);
  color: #dbeafe;
}

.action-btn.active {
  color: #1d4ed8;
  background: rgba(219, 234, 254, 0.9);
  border-color: rgba(96, 165, 250, 0.34);
  box-shadow: 0 12px 24px rgba(59, 130, 246, 0.12);
}

.action-btn.active:hover {
  background: rgba(219, 234, 254, 0.98);
}

.action-btn.active.dark {
  color: #bfdbfe;
  background: rgba(30, 64, 175, 0.24);
  border-color: rgba(96, 165, 250, 0.3);
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.16);
}

.action-btn.active.dark:hover {
  background: rgba(30, 64, 175, 0.32);
}

.action-btn svg {
  width: 17px;
  height: 17px;
}

.correct-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.dark .correct-section {
  border-top-color: #334155;
}

.correct-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 38px;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(226, 232, 240, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.correct-toggle-btn:hover {
  transform: translateY(-1px);
  color: #2563eb;
  border-color: rgba(96, 165, 250, 0.3);
  background: rgba(255, 255, 255, 0.94);
}

.correct-toggle-btn.dark {
  color: #94a3b8;
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.correct-toggle-btn.dark:hover {
  color: #dbeafe;
  border-color: rgba(96, 165, 250, 0.24);
  background: rgba(51, 65, 85, 0.94);
}

.correct-toggle-btn svg {
  width: 15px;
  height: 15px;
}

.correct-form {
  margin-top: 12px;
  padding: 16px;
  background: rgba(248, 250, 252, 0.78);
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
}

.correct-form.dark {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.form-group {
  margin-bottom: 12px;
}

.form-group:last-of-type {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  margin-bottom: 6px;
}

.type-selector {
  display: flex;
  gap: 8px;
}

.type-btn {
  flex: 1;
  min-height: 38px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(226, 232, 240, 0.88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.type-btn:hover {
  transform: translateY(-1px);
  border-color: rgba(96, 165, 250, 0.28);
  color: #2563eb;
}

.type-btn.dark {
  color: #94a3b8;
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.type-btn.dark:hover {
  color: #dbeafe;
  border-color: rgba(96, 165, 250, 0.24);
}

.type-btn.active {
  color: #1d4ed8;
  background: rgba(219, 234, 254, 0.9);
  border-color: rgba(96, 165, 250, 0.32);
  box-shadow: 0 10px 22px rgba(59, 130, 246, 0.1);
}

.type-btn.active.dark {
  color: #bfdbfe;
  background: rgba(30, 64, 175, 0.24);
  border-color: rgba(96, 165, 250, 0.28);
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.14);
}

.form-input {
  width: 100%;
  min-height: 42px;
  padding: 0 14px;
  font-size: 13px;
  color: #0f172a;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(226, 232, 240, 0.88);
  border-radius: 14px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: rgba(96, 165, 250, 0.42);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input.dark {
  color: #f1f5f9;
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.form-input.dark:focus {
  border-color: rgba(96, 165, 250, 0.34);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.16);
}

.form-input::placeholder {
  color: #94a3b8;
}

.btn-sm {
  min-height: 36px;
  padding: 0 14px;
  font-size: 12px;
  border-radius: 12px;
}

.btn-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.organize-modal {
  width: 600px;
  max-width: 90vw;
  height: min(80vh, 760px);
  max-height: min(80vh, 760px);
  display: flex;
  flex-direction: column;
}

.organize-modal .modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.swipe-row {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
}

.file-item-shell {
  position: relative;
  z-index: 1;
  will-change: transform;
  background: inherit;
}

.file-item-shell.swipe-active {
  transition: transform 0.2s ease;
}

.swipe-actions {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: none;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 10px;
}

.swipe-actions.compact {
  gap: 0;
}

.swipe-action-btn {
  width: 54px;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(226, 232, 240, 0.78);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
  border-radius: 16px;
  color: #2563eb;
  cursor: pointer;
}

.swipe-action-btn.delete {
  color: #dc2626;
}

.swipe-action-btn.recognize {
  color: #7c3aed;
}

.swipe-actions.dark .swipe-action-btn {
  border-color: rgba(71, 85, 105, 0.52);
  background: rgba(30, 41, 59, 0.84);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #93c5fd;
}

.swipe-actions.dark .swipe-action-btn.recognize {
  color: #c4b5fd;
}

.swipe-actions.dark .swipe-action-btn.delete {
  color: #fca5a5;
}

.swipe-action-btn svg {
  width: 18px;
  height: 18px;
}

.correct-toggle-btn.active {
  color: #1d4ed8;
  background: rgba(219, 234, 254, 0.9);
  border-color: rgba(96, 165, 250, 0.3);
}

.correct-toggle-btn.dark.active {
  color: #bfdbfe;
  background: rgba(30, 64, 175, 0.24);
  border-color: rgba(96, 165, 250, 0.24);
}

.correct-form.compact {
  padding: 14px;
}

.correct-form-row {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.correct-form-main-row {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
}

.correct-inline-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.correct-inline-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
}

.dark .correct-inline-label {
  color: #94a3b8;
}

.type-selector.compact {
  gap: 6px;
}

.correct-submit-btn {
  white-space: nowrap;
}

.recognize-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: #64748b;
}

.recognize-loading svg {
  width: 32px;
  height: 32px;
  animation: spin 1s linear infinite;
}

.recognize-result-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.organize-result-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-media {
  display: flex;
  gap: 20px;
}

.result-poster {
  flex-shrink: 0;
  width: 120px;
  height: 180px;
  border-radius: 18px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(226, 232, 240, 0.86) 0%, rgba(241, 245, 249, 0.92) 100%);
  border: 1px solid rgba(226, 232, 240, 0.82);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.12);
}

.dark .result-poster {
  background: linear-gradient(135deg, rgba(51, 65, 85, 0.9) 0%, rgba(30, 41, 59, 0.96) 100%);
  border-color: rgba(71, 85, 105, 0.5);
}

.result-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.result-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.result-type-tag {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  border: 1px solid transparent;
}

.result-type-tag.movie {
  background: rgba(219, 234, 254, 0.88);
  color: #1d4ed8;
  border-color: rgba(147, 197, 253, 0.42);
}

.result-type-tag.tv {
  background: rgba(252, 231, 243, 0.88);
  color: #be185d;
  border-color: rgba(244, 114, 182, 0.22);
}

.dark .result-type-tag.movie {
  background: rgba(30, 64, 175, 0.24);
  color: #93c5fd;
  border-color: rgba(96, 165, 250, 0.24);
}

.dark .result-type-tag.tv {
  background: rgba(131, 24, 67, 0.22);
  color: #f9a8d4;
  border-color: rgba(244, 114, 182, 0.2);
}

.result-rating {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(254, 243, 199, 0.88);
  border: 1px solid rgba(251, 191, 36, 0.22);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #b45309;
}

.dark .result-rating {
  background: rgba(120, 53, 15, 0.32);
  border-color: rgba(245, 158, 11, 0.18);
  color: #fcd34d;
}

.result-rating svg {
  width: 14px;
  height: 14px;
  color: #f59e0b;
}

.dark .result-rating svg {
  color: #fbbf24;
}

.result-tmdb-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background: rgba(219, 234, 254, 0.88);
  border: 1px solid rgba(147, 197, 253, 0.4);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #1d4ed8;
}

.dark .result-tmdb-tag {
  background: rgba(30, 64, 175, 0.24);
  border-color: rgba(96, 165, 250, 0.24);
  color: #93c5fd;
}

.result-title {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.dark .result-title {
  color: #f8fafc;
}

.result-original-title {
  font-size: 13px;
  color: #64748b;
  margin: 0;
  font-style: italic;
}

.dark .result-original-title {
  color: #94a3b8;
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #64748b;
}

.dark .result-meta {
  color: #94a3b8;
}

.meta-year {
  font-weight: 500;
  color: #334155;
}

.dark .meta-year {
  color: #e2e8f0;
}

.meta-divider {
  color: #cbd5e1;
}

.meta-country {
  font-weight: 500;
}

.result-genres {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.genre-tag {
  padding: 4px 10px;
  background: #f1f5f9;
  border-radius: 12px;
  font-size: 12px;
  color: #475569;
  font-weight: 500;
}

.dark .genre-tag {
  background: #334155;
  color: #cbd5e1;
}

.result-quality-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.quality-tag {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.quality-tag.category-tag {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1d4ed8;
}

.dark .quality-tag.category-tag {
  background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%);
  color: #93c5fd;
}

.quality-tag.format-tag {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #b45309;
}

.dark .quality-tag.format-tag {
  background: linear-gradient(135deg, #451a03 0%, #78350f 100%);
  color: #fcd34d;
}

.quality-tag.source-tag {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #047857;
}

.dark .quality-tag.source-tag {
  background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
  color: #6ee7b7;
}

.quality-tag.web-source-tag {
  background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
  color: #be185d;
}

.dark .quality-tag.web-source-tag {
  background: linear-gradient(135deg, #500724 0%, #831843 100%);
  color: #f9a8d4;
}

.quality-tag.effect-tag {
  background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
  color: #6d28d9;
}

.dark .quality-tag.effect-tag {
  background: linear-gradient(135deg, #2e1065 0%, #4c1d95 100%);
  color: #c4b5fd;
}

.quality-tag.codec-tag {
  background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
  color: #be185d;
}

.dark .quality-tag.codec-tag {
  background: linear-gradient(135deg, #500724 0%, #831843 100%);
  color: #f9a8d4;
}

.quality-tag.audio-tag {
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  color: #4338ca;
}

.dark .quality-tag.audio-tag {
  background: linear-gradient(135deg, #312e81 0%, #3730a3 100%);
  color: #a5b4fc;
}

.quality-tag.group-tag {
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
  color: #374151;
  border: 1px solid #d1d5db;
}

.dark .quality-tag.group-tag {
  background: linear-gradient(135deg, #374151 0%, #4b5563 100%);
  color: #e5e7eb;
  border-color: #6b7280;
}

.result-overview-section {
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border-left: 3px solid #3b82f6;
}

.dark .result-overview-section {
  background: #1e293b;
  border-left-color: #60a5fa;
}

.result-overview-text {
  font-size: 13px;
  line-height: 1.7;
  color: #475569;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dark .result-overview-text {
  color: #94a3b8;
}

.result-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #94a3b8;
}

.dark .detail-label {
  color: #64748b;
}

.detail-value {
  font-size: 13px;
  color: #334155;
}

.dark .detail-value {
  color: #e2e8f0;
}

.detail-value.file-name {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  font-size: 12px;
  word-break: break-all;
  background: #f1f5f9;
  padding: 8px 10px;
  border-radius: 6px;
}

.dark .detail-value.file-name {
  background: #334155;
}

.detail-value.path-value {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  font-size: 12px;
  word-break: break-word;
  line-height: 1.5;
  background: #f1f5f9;
  padding: 8px 10px;
  border-radius: 6px;
}

.dark .detail-value.path-value {
  background: #334155;
}

.btn-block {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 20px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.modal-footer-organize {
  justify-content: stretch;
}

.organize-confirm-btn {
  min-height: 50px;
  border-radius: 16px;
  border: 1px solid rgba(147, 197, 253, 0.32);
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 32%, #2563eb 68%, #1d4ed8 100%);
  box-shadow: 0 16px 32px rgba(37, 99, 235, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.26);
  letter-spacing: 0.01em;
}

.organize-confirm-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 20px 36px rgba(37, 99, 235, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.organize-confirm-btn svg {
  width: 16px;
  height: 16px;
}

.btn-block:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-block svg {
  width: 18px;
  height: 18px;
}

.recognize-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: #94a3b8;
}

.recognize-empty svg {
  width: 40px;
  height: 40px;
}

.recognize-empty p {
  margin: 0;
}

.recognize-empty-hint {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.recognize-fail-correct {
  margin-top: 16px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.btn-action.recognize {
  color: #8b5cf6;
}

.btn-action.recognize:hover {
  background: #f3e8ff;
}

.btn-action.recognize.dark:hover {
  background: #2e1065;
}

.btn-action.delete {
  color: #ef4444;
}

.btn-action.delete:hover {
  background: #fef2f2;
  color: #dc2626;
}

.btn-action.delete.dark:hover {
  background: #450a0a;
}

.delete-modal {
  width: 380px;
  max-width: 90vw;
  border-radius: 24px;
  overflow: hidden;
}

.delete-content {
  padding: 32px 24px 24px;
  text-align: center;
}

.delete-icon {
  width: 60px;
  height: 60px;
  margin: 0 auto 16px;
  padding: 14px;
  border-radius: 20px;
  background: rgba(254, 242, 242, 0.92);
  border: 1px solid rgba(248, 113, 113, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-modal.dark .delete-icon {
  background: rgba(127, 29, 29, 0.28);
  border-color: rgba(248, 113, 113, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.delete-icon svg {
  width: 28px;
  height: 28px;
  color: #ef4444;
}

.delete-title {
  font-size: 18px;
  font-weight: 650;
  color: #1e293b;
  margin: 0 0 8px 0;
}

.delete-modal.dark .delete-title {
  color: #f1f5f9;
}

.delete-desc {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 16px 0;
}

.delete-modal.dark .delete-desc {
  color: #94a3b8;
}

.delete-item-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(248, 250, 252, 0.78);
  border: 1px solid rgba(226, 232, 240, 0.78);
  border-radius: 16px;
  margin-bottom: 16px;
}

.delete-modal.dark .delete-item-box {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(71, 85, 105, 0.52);
}

.delete-item-box .item-icon {
  width: 20px;
  height: 20px;
  color: #64748b;
  flex-shrink: 0;
}

.delete-modal.dark .delete-item-box .item-icon {
  color: #94a3b8;
}

.delete-item-box .item-name {
  font-size: 14px;
  font-weight: 500;
  color: #334155;
  word-break: break-all;
}

.delete-modal.dark .delete-item-box .item-name {
  color: #e2e8f0;
}

.delete-warning-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  color: #f59e0b;
  margin: 0;
}

.delete-warning-text svg {
  width: 16px;
  height: 16px;
}

.delete-actions {
  display: flex;
  gap: 12px;
  padding: 0 24px 24px;
}

.btn-delete-cancel {
  flex: 1;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.76);
  color: #475569;
  border: 1px solid rgba(226, 232, 240, 0.88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.btn-delete-cancel:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.94);
  border-color: rgba(148, 163, 184, 0.24);
}

.btn-delete-cancel.dark {
  background: rgba(30, 41, 59, 0.82);
  color: #94a3b8;
  border-color: rgba(71, 85, 105, 0.52);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.btn-delete-cancel.dark:hover {
  background: rgba(51, 65, 85, 0.94);
  color: #e2e8f0;
}

.btn-delete-confirm {
  flex: 1;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 600;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #ffffff;
  border: none;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 14px 28px rgba(239, 68, 68, 0.22);
}

.btn-delete-confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 32px rgba(220, 38, 38, 0.28);
}

.btn-delete-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-delete-confirm svg {
  width: 16px;
  height: 16px;
}

/* 移动端响应式适配 */
@media (max-width: 768px) {
  .modal-overlay {
    padding-left: 0;
    padding-right: 0;
    padding: 12px;
  }

  .toolbar {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px;
    border-radius: 22px;
  }

  .toolbar-left {
    flex: 1 1 100%;
    min-width: 0;
    overflow-x: auto;
    order: 1;
  }

  .breadcrumb {
    white-space: nowrap;
    font-size: 12px;
  }

  .toolbar-right {
    width: 100%;
    flex-shrink: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    order: 2;
  }

  .btn-refresh,
  .btn-settings,
  .btn-records {
    min-height: 34px;
    padding: 0 10px;
    border-radius: 11px;
    font-size: 11px;
  }

  .content-area {
    border-radius: 24px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .swipe-row {
    border-radius: 16px;
    background: #f8fafc;
  }

  .dark .swipe-row {
    background: #0f172a;
  }

  .swipe-row.open {
    background: transparent;
  }

  .swipe-actions {
    display: flex;
    padding: 0 8px;
    gap: 6px;
  }

  .swipe-actions.compact {
    padding-right: 8px;
  }

  .swipe-action-btn {
    width: 50px;
    height: 50px;
    border-radius: 14px;
  }

  .swipe-action-btn svg {
    width: 17px;
    height: 17px;
  }

  .file-actions {
    display: none;
  }

  .organize-modal {
    max-width: min(92vw, 600px);
    height: min(86vh, 720px);
    max-height: min(86vh, 720px);
  }

  .correct-form.compact {
    padding: 12px;
  }

  .correct-form-main-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .correct-inline-group {
    gap: 5px;
  }

  .correct-submit-btn {
    width: 100%;
    justify-content: center;
  }

  .modal-header {
    padding: 16px 16px 14px;
  }

  .modal-body {
    padding: 16px;
  }

  .modal-footer {
    padding: 14px 16px 16px;
    flex-direction: column;
    gap: 8px;
  }

  .modal-footer .btn {
    width: 100%;
  }

  .delete-modal {
    border-radius: 22px;
  }

  .delete-content {
    padding: 24px 16px 18px;
  }

  .delete-icon {
    width: 54px;
    height: 54px;
    margin-bottom: 14px;
    border-radius: 18px;
  }

  .delete-title {
    font-size: 17px;
  }

  .delete-desc {
    font-size: 13px;
    margin-bottom: 14px;
  }

  .delete-item-box {
    padding: 10px 12px;
    border-radius: 14px;
    margin-bottom: 14px;
  }

  .delete-item-box .item-name {
    font-size: 13px;
  }

  .delete-warning-text {
    font-size: 12px;
  }

  .delete-actions {
    flex-direction: column;
    gap: 8px;
    padding: 0 16px 16px;
  }

  .btn-delete-cancel,
  .btn-delete-confirm {
    min-height: 38px;
    border-radius: 12px;
    font-size: 12px;
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

  .result-media {
    flex-direction: row;
    gap: 12px;
  }

  .result-poster {
    width: 70px;
    height: 105px;
    flex-shrink: 0;
  }

  .result-info {
    flex: 1;
    min-width: 0;
    gap: 4px;
  }

  .result-header {
    flex-wrap: wrap;
    gap: 4px;
  }

  .result-type-tag {
    padding: 2px 6px;
    font-size: 10px;
  }

  .result-rating {
    padding: 2px 6px;
    font-size: 11px;
  }

  .result-rating svg {
    width: 10px;
    height: 10px;
  }

  .result-tmdb-tag {
    padding: 2px 6px;
    font-size: 10px;
  }

  .result-title {
    font-size: 15px;
    margin: 0;
  }

  .result-original-title {
    font-size: 11px;
    margin: 0;
  }

  .result-meta {
    flex-wrap: wrap;
    font-size: 11px;
    gap: 4px;
  }

  .result-genres {
    gap: 4px;
  }

  .genre-tag {
    padding: 2px 6px;
    font-size: 10px;
  }

  .result-quality-tags {
    gap: 4px;
  }

  .quality-tag {
    padding: 2px 6px;
    font-size: 10px;
  }

  .result-overview-section {
    display: none;
  }

  .result-tags {
    flex-wrap: wrap;
  }

  .tag {
    font-size: 10px;
    padding: 2px 6px;
  }

  .result-details {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .detail-item {
    gap: 4px;
  }

  .detail-label {
    font-size: 11px;
  }

  .detail-value {
    font-size: 11px;
  }

  .action-type-selector {
    flex-direction: column;
    gap: 8px;
  }

  .action-btn {
    width: 100%;
    min-height: 38px;
    padding: 0 12px;
    justify-content: center;
    gap: 6px;
    border-radius: 12px;
    font-size: 12px;
  }

  .action-btn svg {
    width: 16px;
    height: 16px;
  }

  .organize-options {
    margin-top: 8px;
  }

  .correct-section {
    margin-top: 8px;
  }

  .correct-toggle-btn {
    min-height: 34px;
    padding: 0 12px;
    border-radius: 12px;
    font-size: 11px;
  }

  .correct-toggle-btn svg {
    width: 14px;
    height: 14px;
  }

  .correct-form {
    margin-top: 10px;
    padding: 13px;
    border-radius: 16px;
  }

  .type-selector {
    gap: 6px;
  }

  .type-btn {
    min-height: 34px;
    padding: 0 10px;
    border-radius: 10px;
    font-size: 11px;
  }

  .form-input {
    min-height: 38px;
    padding: 0 12px;
    border-radius: 12px;
    font-size: 12px;
  }

  .btn-sm {
    min-height: 34px;
    padding: 0 12px;
    border-radius: 10px;
    font-size: 11px;
  }

  .records-modal {
    width: 98%;
    max-height: calc(100vh - 16px);
    margin-top: 4px;
    margin-bottom: 4px;
  }

  .records-modal .modal-header {
    padding: 12px 14px 10px;
  }

  .records-modal .modal-header h3 {
    font-size: 14px;
  }

  .records-modal .btn-close {
    width: 28px;
    height: 28px;
    border-radius: 9px;
  }

  .records-modal .btn-close svg {
    width: 13px;
    height: 13px;
  }

  .records-modal .modal-body {
    padding: 10px 12px 12px;
  }

  .records-controls {
    align-items: flex-start;
    gap: 6px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }

  .records-summary {
    width: 100%;
    justify-content: space-between;
  }

  .records-actions {
    width: 100%;
    justify-content: space-between;
  }

  .records-pagination {
    gap: 6px;
  }

  .btn-records-page,
  .btn-clear-records {
    min-height: 30px;
    padding: 0 10px;
    border-radius: 10px;
    font-size: 11px;
  }

  .records-table-container {
    flex: 1 1 auto;
    min-height: 0;
    max-height: none;
    border-radius: 14px;
  }

  .records-table {
    min-width: 500px;
    font-size: 11px;
  }

  .records-table th,
  .records-table td {
    padding: 6px 8px;
  }

  .action-tag,
  .status-tag {
    min-height: 22px;
    padding: 0 8px;
    font-size: 10px;
  }

  .btn-delete-record {
    width: 28px;
    height: 28px;
    border-radius: 9px;
  }

  .btn-delete-record svg {
    width: 14px;
    height: 14px;
  }

  .col-name {
    max-width: 80px;
  }

  .col-filename {
    min-width: 250px;
  }

  .filename-row {
    font-size: 10px;
    line-height: 1.4;
  }

  .filename-value {
    white-space: normal;
    word-break: break-word;
  }
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.toggle-row label {
  font-weight: 500;
  color: #1e293b;
}

.dark .toggle-row label {
  color: #f1f5f9;
}

.toggle-switch {
  position: relative;
  width: 48px;
  height: 26px;
  background: #cbd5e1;
  border: none;
  border-radius: 13px;
  cursor: pointer;
  transition: background 0.3s;
  padding: 0;
}

.toggle-switch.dark {
  background: #475569;
}

.toggle-switch.active {
  background: #16a34a;
}

.toggle-switch.active.dark {
  background: #22c55e;
}

.toggle-slider {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.3s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-switch.active .toggle-slider {
  transform: translateX(22px);
}

.radio-group {
  display: flex;
  gap: 16px;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #1e293b;
}

.radio-item.dark {
  color: #f1f5f9;
}

.radio-item input[type="radio"] {
  width: 16px;
  height: 16px;
  accent-color: #16a34a;
}

.radio-label {
  user-select: none;
}

.cron-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.preset-btn {
  padding: 3px 8px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 11px;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-btn:hover {
  background: #e2e8f0;
}

.preset-btn.dark {
  background: #334155;
  border-color: #475569;
  color: #94a3b8;
}

.preset-btn.dark:hover {
  background: #475569;
}

.auto-organize-section {
  padding: 0;
}

.auto-header {
  padding: 12px 14px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 8px;
  margin-bottom: 12px;
}

.auto-header.dark {
  background: linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%);
}

.auto-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.auto-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 8px;
  flex-shrink: 0;
}

.auto-icon svg {
  width: 16px;
  height: 16px;
  color: white;
}

.auto-title-info {
  flex: 1;
}

.auto-title-info h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.dark .auto-title-info h4 {
  color: #f1f5f9;
}

.auto-desc {
  display: none;
}

.toggle-switch.large {
  width: 44px;
  height: 24px;
}

.toggle-switch.large .toggle-slider {
  width: 18px;
  height: 18px;
}

.toggle-switch.large.active .toggle-slider {
  transform: translateX(20px);
}

.auto-config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  transition: opacity 0.3s ease;
}

.auto-config-grid.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.config-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
}

.config-card.dark {
  background: #1e293b;
  border-color: #334155;
}

.config-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 8px;
}

.dark .config-card-header {
  color: #94a3b8;
}

.config-card-header svg {
  width: 14px;
  height: 14px;
  color: #3b82f6;
}

.action-selector {
  display: flex;
  gap: 8px;
}

.action-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 6px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-option.dark {
  background: #334155;
  border-color: #475569;
}

.action-option:hover {
  border-color: #93c5fd;
}

.action-option.active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.action-option.active.dark {
  background: #1e3a5f;
  border-color: #3b82f6;
}

.action-option svg {
  width: 18px;
  height: 18px;
  color: #64748b;
}

.action-option.active svg {
  color: #3b82f6;
}

.action-name {
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
}

.dark .action-name {
  color: #f1f5f9;
}

.action-desc {
  font-size: 10px;
  color: #94a3b8;
}

.cron-config {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cron-input {
  width: 100%;
  padding: 6px 8px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #1e293b;
  transition: border-color 0.2s;
}

.cron-input.dark {
  background: #334155;
  border-color: #475569;
  color: #e2e8f0;
}

.cron-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.cron-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.preset-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.preset-btn.active.dark {
  background: #3b82f6;
  color: white;
}

.status-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  margin-top: 10px;
}

.status-card.dark {
  background: #1e293b;
  border-color: #334155;
}

.status-card.running {
  background: #f0fdf4;
  border-color: #86efac;
}

.status-card.running.dark {
  background: #14532d;
  border-color: #166534;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}

.status-dot.active {
  background: #22c55e;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.status-text {
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
}

.dark .status-text {
  color: #f1f5f9;
}

.status-detail {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-label {
  font-size: 11px;
  color: #64748b;
}

.status-cron {
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #3b82f6;
  background: #eff6ff;
  padding: 1px 6px;
  border-radius: 3px;
}

.dark .status-cron {
  background: #1e3a5f;
}

.status-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  margin-top: 16px;
}

.status-box.dark {
  background: #1e293b;
  border-color: #334155;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.status-row + .status-row {
  margin-top: 8px;
}

.status-label {
  color: #64748b;
}

.status-value {
  color: #1e293b;
  font-weight: 500;
}

.dark .status-value {
  color: #f1f5f9;
}

.status-value.running {
  color: #16a34a;
}

.dark .status-value.running {
  color: #22c55e;
}
</style>
