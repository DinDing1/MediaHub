/**
 * 设置API
 * GET: 获取配置
 * POST: 保存配置或测试连接
 */
import { getAllSettings, setSetting } from '../utils/db'
import { testEmbyConnection, clearEmbyConfigCache } from '../utils/emby/emby'
import { log } from '../utils/logger'
import { getBuiltinReleaseGroups } from '../utils/organize/tech_info'

export default defineEventHandler(async (event) => {
  const method = event.method

  // GET - 获取设置
  if (method === 'GET') {
    try {
      const settings = getAllSettings()
      return {
        success: true,
        data: {
          embyBaseUrl: settings.emby_base_url || '',
          embyApiKey: settings.emby_api_key || '',
          embyProxyEnabled: settings.emby_proxy_enabled === 'true',
          embyProxyPort: parseInt(settings.emby_proxy_port || '8097'),
          pan115Cookie: settings.pan115_cookie || '',
          pan115SaveDir: settings.pan115_save_dir || '',
          pan115MediaDir: settings.pan115_media_dir || '',
          pan115AppId: settings.pan115_app_id || '',
          pan115OpenToken: settings.pan115_open_token || '',
          tmdbApiUrl: settings.tmdb_api_url || '',
          tmdbApiKey: settings.tmdb_api_key || '',
          strmServerUrl: settings.strm_server_url || '',
          fnosCookie: settings.fnos_cookie || '',
          gladosCookie: settings.glados_cookie || '',
          hdhiveCookie: settings.hdhive_cookie || '',
          renameMovieTemplate: settings.rename_movie_template || '',
          renameTvTemplate: settings.rename_tv_template || '',
          classificationStrategy: settings.classification_strategy || '',
          builtinReleaseGroups: getBuiltinReleaseGroups(),
          customReleaseGroups: settings.custom_release_groups || '',
          aiRecognizeEnabled: settings.ai_recognize_enabled || 'false',
          aiApiKey: settings.ai_api_key || '',
          aiApiUrl: settings.ai_api_url || '',
          aiModel: settings.ai_model || '',
        pathMapping: settings.path_mapping || ''
        }
      }
    } catch (error: any) {
      log.error('配置', '加载配置失败', error.message)
      return { success: false, error: error.message || '获取配置失败' }
    }
  }

  // POST - 保存设置
  if (method === 'POST') {
    try {
      const body = await readBody(event)
      const { 
        embyBaseUrl, 
        embyApiKey, 
        embyProxyEnabled,
        embyProxyPort,
        testOnly = false,
        pan115Cookie,
        pan115SaveDir,
        pan115MediaDir,
        pan115AppId,
        pan115OpenToken,
        tmdbApiUrl,
        tmdbApiKey,
        rename_movie_template,
        rename_tv_template,
        classification_strategy
      } = body

      // 如果是测试Emby连接
      if (testOnly && embyBaseUrl && embyApiKey) {
        const trimmedUrl = embyBaseUrl.trim()
        const trimmedKey = embyApiKey.trim()

        log.info('Emby', '正在测试连接...', trimmedUrl)
        const testResult = await testEmbyConnection({ baseUrl: trimmedUrl, apiKey: trimmedKey })

        if (testResult.success) {
          log.success('Emby', `连接成功: ${testResult.serverName}`)
          return { success: true, serverName: testResult.serverName }
        } else {
          log.error('Emby', '连接测试失败', testResult.error)
          return { success: false, error: testResult.error }
        }
      }

      let serverName = ''
      let connectionError = ''

      // 保存Emby配置
      if (embyBaseUrl !== undefined && embyApiKey !== undefined) {
        if (embyBaseUrl.trim() && embyApiKey.trim()) {
          setSetting('emby_base_url', embyBaseUrl.trim())
          setSetting('emby_api_key', embyApiKey.trim())
          clearEmbyConfigCache()
          log.success('配置', 'Emby配置已保存')

          // 测试连接
          const testResult = await testEmbyConnection({ 
            baseUrl: embyBaseUrl.trim(), 
            apiKey: embyApiKey.trim() 
          })

          if (testResult.success) {
            serverName = testResult.serverName || ''
            log.success('Emby', `连接成功: ${serverName}`)
          } else {
            connectionError = testResult.error || ''
            log.warn('Emby', '连接测试失败', connectionError)
          }
        }
      }

      // 保存Emby反代开关
      if (embyProxyEnabled !== undefined) {
        setSetting('emby_proxy_enabled', embyProxyEnabled ? 'true' : 'false')
        log.success('配置', `Emby反代服务${embyProxyEnabled ? '已启用' : '已禁用'}`)
      }

      // 保存Emby反代端口
      if (embyProxyPort !== undefined) {
        const port = parseInt(String(embyProxyPort)) || 8097
        setSetting('emby_proxy_port', String(port))
        log.success('配置', `Emby反代端口已设置为: ${port}`)
      }

      // 保存115云盘配置
      if (pan115Cookie !== undefined) {
        setSetting('pan115_cookie', pan115Cookie.trim())
        log.success('配置', '115云盘Cookie已保存')
      }
      if (pan115SaveDir !== undefined) {
        setSetting('pan115_save_dir', pan115SaveDir.trim())
        log.success('配置', '115云盘保存目录已保存')
      }
      if (pan115MediaDir !== undefined) {
        setSetting('pan115_media_dir', pan115MediaDir.trim())
        log.success('配置', '115云盘媒体库目录已保存')
      }
      if (pan115AppId !== undefined) {
        setSetting('pan115_app_id', pan115AppId.trim())
        log.success('配置', '115云盘AppID已保存')
      }

      // 保存TMDB配置
      if (tmdbApiUrl !== undefined) {
        setSetting('tmdb_api_url', tmdbApiUrl.trim())
        log.success('配置', 'TMDB代理地址已保存')
      }
      if (tmdbApiKey !== undefined) {
        setSetting('tmdb_api_key', tmdbApiKey.trim())
        log.success('配置', 'TMDB API Key已保存')
      }

      // 保存STRM配置
      if (body.strmServerUrl !== undefined) {
        setSetting('strm_server_url', body.strmServerUrl.trim())
        log.success('配置', 'STRM服务器地址已保存')
      }

      // 保存飞牛论坛Cookie
      if (body.fnosCookie !== undefined) {
        setSetting('fnos_cookie', body.fnosCookie.trim())
        log.success('配置', '飞牛论坛Cookie已保存')
      }

      // 保存GlaDOS Cookie
      if (body.gladosCookie !== undefined) {
        setSetting('glados_cookie', body.gladosCookie.trim())
        log.success('配置', 'GlaDOS Cookie已保存')
      }

      // 保存影巢Cookie
      if (body.hdhiveCookie !== undefined) {
        setSetting('hdhive_cookie', body.hdhiveCookie.trim())
        log.success('配置', '影巢Cookie已保存')
      }

      // 保存AI识别配置
      if (body.aiRecognizeEnabled !== undefined) {
        setSetting('ai_recognize_enabled', body.aiRecognizeEnabled)
        log.success('配置', `AI辅助识别${body.aiRecognizeEnabled === 'true' ? '已启用' : '已禁用'}`)
      }
      if (body.aiApiKey !== undefined) {
        setSetting('ai_api_key', body.aiApiKey.trim())
        log.success('配置', 'AI API Key已保存')
      }
      if (body.aiApiUrl !== undefined) {
        setSetting('ai_api_url', body.aiApiUrl.trim())
        log.success('配置', 'AI API地址已保存')
      }
      if (body.aiModel !== undefined) {
        setSetting('ai_model', body.aiModel.trim())
        log.success('配置', 'AI模型已保存')
      }

      // 保存路径映射配置
      if (body.path_mapping !== undefined) {
        setSetting('path_mapping', String(body.path_mapping))
        log.success('配置', '路径映射配置已保存')
      }

      // 保存重命名模板
      if (rename_movie_template !== undefined) {
        setSetting('rename_movie_template', rename_movie_template)
        log.success('配置', '电影命名模板已保存')
      }
      if (rename_tv_template !== undefined) {
        setSetting('rename_tv_template', rename_tv_template)
        log.success('配置', '电视剧命名模板已保存')
      }

      // 保存分类策略
      if (classification_strategy !== undefined) {
        setSetting('classification_strategy', classification_strategy)
        log.success('配置', '分类策略已保存')
      }

      // 保存自定义发布组
      if (body.custom_release_groups !== undefined) {
        setSetting('custom_release_groups', body.custom_release_groups)
        log.success('配置', '自定义发布组已保存')
      }

      if (serverName) {
        return { success: true, serverName }
      } else if (connectionError) {
        return { success: true, warning: true, error: connectionError }
      }
      return { success: true, message: '配置保存成功' }
    } catch (error: any) {
      log.error('配置', '保存配置失败', error.message)
      return { success: false, error: error.message || '保存配置失败' }
    }
  }

  return { success: false, error: '不支持的请求方法: ' + method }
})
