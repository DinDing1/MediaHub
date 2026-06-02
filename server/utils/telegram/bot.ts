/**
 * Telegram Bot 模块
 * 基于 grammy 实现 Telegram Bot 连接和消息处理
 * 支持 SOCKS5 和 HTTP(S) 代理
 */
import { Bot, Context, RawApi, Api } from 'grammy'
import { getSetting } from '../db'
import { log } from '../logger'
import { handleBotCommand, handleBotShareLink } from './commands'

/**
 * Bot 全局状态接口
 * 使用 globalThis 持久化，避免 HMR 热更新时状态丢失
 */
interface BotGlobalState {
  bot: Bot<Context, Api<RawApi>> | null
  connected: boolean
  initializing: boolean
  botInfo: { id: number; username: string; firstName: string } | null
}

/**
 * 获取 Bot 全局状态
 * 通过 globalThis 跨 HMR 保持状态
 */
function getGlobalState(): BotGlobalState {
  if (!(globalThis as any).__telegramBotState__) {
    (globalThis as any).__telegramBotState__ = {
      bot: null,
      connected: false,
      initializing: false,
      botInfo: null
    }
  }
  return (globalThis as any).__telegramBotState__
}

/**
 * 根据代理 URL 协议创建对应的 HTTP Agent
 * socks5/socks5h/socks4 → SocksProxyAgent
 * http/https → HttpsProxyAgent
 *
 * @param proxyUrl 代理地址，如 socks5://user:pass@host:port
 * @returns HTTP Agent 实例，用于 node-fetch 的 agent 选项
 */
async function createProxyAgent(proxyUrl: string): Promise<any | null> {
  if (proxyUrl.startsWith('socks5://') || proxyUrl.startsWith('socks5h://') || proxyUrl.startsWith('socks4://')) {
    const { SocksProxyAgent } = await import('socks-proxy-agent')
    return new SocksProxyAgent(proxyUrl)
  }

  if (proxyUrl.startsWith('http://') || proxyUrl.startsWith('https://')) {
    const { HttpsProxyAgent } = await import('https-proxy-agent')
    return new HttpsProxyAgent(proxyUrl)
  }

  log.warn('Telegram Bot', `不支持的代理协议: ${proxyUrl}`)
  return null
}

/**
 * 初始化 Telegram Bot
 * 创建 Bot 实例，配置代理，验证连接，启动长轮询
 *
 * 代理通过 grammy 的 client.baseFetchConfig.agent 传入，
 * grammy 内部使用 node-fetch，node-fetch 支持 agent 选项
 */
export async function initBot(): Promise<{ success: boolean; error?: string }> {
  const state = getGlobalState()

  if (state.connected && state.bot) {
    return { success: true }
  }

  if (state.initializing) {
    return { success: false, error: 'Bot 正在初始化中' }
  }

  const token = getSetting('telegram_bot_token')
  if (!token) {
    return { success: false, error: '未配置 Bot Token' }
  }

  state.initializing = true

  try {
    /* 如果存在旧实例，先停止 */
    if (state.bot) {
      try {
        await state.bot.stop()
      } catch {}
      state.bot = null
    }

    const proxyEnabled = getSetting('telegram_proxy_enabled') === 'true'
    const proxyUrl = getSetting('telegram_proxy_url') || ''

    /* 构建 Bot 选项，根据代理配置决定是否传入 agent */
    let botOptions: any = {}

    if (proxyEnabled && proxyUrl) {
      try {
        const agent = await createProxyAgent(proxyUrl)
        if (agent) {
          botOptions = {
            client: {
              baseFetchConfig: {
                agent,
                compress: true
              }
            }
          }
          log.info('Telegram Bot', `已配置代理: ${proxyUrl}`)
        }
      } catch (importError: any) {
        log.warn('Telegram Bot', `代理模块加载失败: ${importError.message}，代理可能无法正常工作`)
      }
    }

    const bot = new Bot(token, botOptions)

    /* 验证 Bot Token 有效性，获取 Bot 信息 */
    const me = await bot.api.getMe()
    log.success('Telegram Bot', `Bot 已连接: @${me.username} (${me.id})`)

    state.bot = bot
    state.botInfo = {
      id: me.id,
      username: me.username || '',
      firstName: me.first_name
    }
    state.connected = true
    state.initializing = false

    /* 注册 Bot 命令菜单，用户在聊天界面点击 / 即可看到命令列表 */
    await registerBotCommands(bot)

    /* 启动消息处理器（长轮询） */
    startBotMessageHandler(bot)

    return { success: true }
  } catch (error: any) {
    state.initializing = false
    log.error('Telegram Bot', `Bot 初始化失败: ${error.message}`)
    return { success: false, error: error.message }
  }
}

/**
 * 注册 Bot 命令菜单
 * 调用 Telegram Bot API 的 setMyCommands 方法
 * 用户在聊天界面点击 / 即可看到命令列表
 *
 * @param bot - grammy Bot 实例
 */
async function registerBotCommands(bot: Bot<Context, Api<RawApi>>): Promise<void> {
  try {
    await bot.api.setMyCommands([
      { command: 'start', description: '显示帮助信息' },
      { command: 'strm115', description: '生成 STRM 文件' }
    ])
    log.info('Telegram Bot', '命令菜单已注册')
  } catch (error: any) {
    log.warn('Telegram Bot', `注册命令菜单失败: ${error.message}`)
  }
}

/**
 * 启动 Bot 消息处理器
 * 监听文本消息，根据前缀分发到命令处理或分享链接处理
 * - 以 / 开头 → 命令处理（如 /start, /strm115）
 * - 其他文本 → 分享链接检测
 */
function startBotMessageHandler(bot: Bot<Context, Api<RawApi>>): void {
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text
    const fromId = ctx.from?.id

    if (!fromId) return

    if (text.startsWith('/')) {
      await handleBotCommand(ctx)
    } else {
      await handleBotShareLink(ctx)
    }
  })

  bot.start({
    onStart: (info) => {
      log.info('Telegram Bot', `Bot 长轮询已启动: @${info.username}`)
    }
  })
}

/**
 * 断开 Bot 连接
 * 停止长轮询，清理状态
 */
export async function disconnectBot(): Promise<void> {
  const state = getGlobalState()

  if (state.bot) {
    try {
      await state.bot.stop()
    } catch {}
    state.bot = null
  }

  state.connected = false
  state.botInfo = null
  log.info('Telegram Bot', 'Bot 已断开连接')
}

/**
 * 获取 Bot 登录状态
 * 供前端轮询展示连接状态
 */
export function getBotLoginStatus(): {
  connected: boolean
  state: string
  error?: string
  botInfo?: { id: number; username: string; firstName: string } | null
} {
  const state = getGlobalState()

  if (state.connected && state.botInfo) {
    return {
      connected: true,
      state: 'connected',
      botInfo: state.botInfo
    }
  }

  if (state.initializing) {
    return { connected: false, state: 'connecting' }
  }

  return { connected: false, state: 'disconnected' }
}

/**
 * 通过 Bot 发送通知消息
 * 如果 Bot 未连接，会自动尝试初始化
 *
 * @param message 消息内容（支持 HTML 格式）
 * @param imageUrl 可选图片 URL，发送图片+文字
 */
export async function sendBotNotification(message: string, imageUrl?: string): Promise<{ success: boolean; error?: string }> {
  const state = getGlobalState()

  const notifyChat = getSetting('telegram_notify_chat')
  if (!notifyChat) {
    log.info('Telegram Bot', '未配置通知群组，跳过发送通知')
    return { success: false, error: '未配置通知群组' }
  }

  /* 如果 Bot 正在初始化，等待完成 */
  if (!state.connected || !state.bot) {
    if (state.initializing) {
      let retries = 0
      while (state.initializing && retries < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        retries++
      }
      if (state.initializing) {
        return { success: false, error: 'Bot 初始化超时' }
      }
    }

    /* 尝试自动初始化 */
    if (!state.connected || !state.bot) {
      const initResult = await initBot()
      if (!initResult.success) {
        return { success: false, error: initResult.error }
      }
    }
  }

  try {
    const chatId = Number(notifyChat)

    if (imageUrl) {
      await state.bot!.api.sendPhoto(chatId, imageUrl, {
        caption: message,
        parse_mode: 'HTML'
      })
    } else {
      await state.bot!.api.sendMessage(chatId, message, {
        parse_mode: 'HTML'
      })
    }

    log.success('Telegram Bot', '通知消息发送成功')
    return { success: true }
  } catch (error: any) {
    log.error('Telegram Bot', `发送通知失败: ${error.message}`)
    return { success: false, error: error.message }
  }
}
