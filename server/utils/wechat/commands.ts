/**
 * 微信命令处理模块
 *
 * 功能：
 * 1. 处理微信消息中的命令（以 - 开头）
 * 2. 处理115分享链接自动转存
 *
 * 与 Telegram 模块保持一致的回复格式
 * 使用 @wechatbot/wechatbot 的 WeChatBot 和 IncomingMessage 类型
 *
 * 重要：回复消息时使用 bot.reply(msg, content) 而非 bot.send(userId, content)
 * reply() 自动使用消息中的 context_token，更可靠
 * send() 需要从 ContextStore 查找 token，可能已过期
 */

import { WeChatBot, NoContextError, type IncomingMessage } from '@wechatbot/wechatbot'
import { log } from '../logger'
import { saveShareLink, is115ShareUrl } from '../pan115/share115'
import { generateStrmFiles } from '../pan115/strm_115'

/**
 * 命令上下文
 * 包含命令执行所需的上下文信息
 */
interface CommandContext {
  /** 发送者用户 ID */
  userId: string
  /** 命令参数 */
  args: string[]
  /** 原始消息 */
  message: IncomingMessage
}

/**
 * 命令处理器类型
 */
type CommandHandler = (bot: WeChatBot, ctx: CommandContext) => Promise<string | void>

/**
 * 已注册的命令映射表
 * key: 命令名称（小写）
 * value: 命令处理函数
 */
const commands: Map<string, CommandHandler> = new Map()

/**
 * 注册 -start 命令
 * 显示帮助信息
 */
commands.set('start', async (_bot: WeChatBot, _ctx: CommandContext) => {
  return `👋 你好！我是媒体管理机器人。

可用命令：
-start - 显示帮助信息
-strm115 - 生成 STRM 文件

💡 发送115分享链接可自动转存到云盘`
})

commands.set('strm115', async (bot: WeChatBot, ctx: CommandContext) => {
  log.info('WeChat', `收到 -strm115 命令，来自用户 ${ctx.userId}`)

  try {
    /* 使用 reply() 回复，自动使用消息中的 context_token */
    await bot.reply(ctx.message, '🔄 开始生成 STRM 文件...')

    const result = await generateStrmFiles()

    if (!result.success) {
      log.error('WeChat', `STRM 生成失败: ${result.error}`)
      await bot.reply(ctx.message, `❌ 生成失败: ${result.error}`)
    }
  } catch (e: any) {
    log.error('WeChat', `STRM 生成异常: ${e.message}`)
    await bot.reply(ctx.message, `❌ 生成异常: ${e.message}`).catch(() => {})
  }
})

/**
 * 处理微信命令消息
 *
 * @param bot - WeChatBot 实例
 * @param msg - 收到的消息（IncomingMessage 类型）
 */
export async function handleWechatCommand(bot: WeChatBot, msg: IncomingMessage): Promise<void> {
  const userId = msg.userId
  if (!userId) return

  const text = msg.text
  if (!text || !text.startsWith('-')) return

  const parts = text.slice(1).split(' ')
  const commandName = parts[0]?.toLowerCase()
  const args = parts.slice(1)

  if (!commandName) return

  const handler = commands.get(commandName)
  if (handler) {
    try {
      const response = await handler(bot, { userId, args, message: msg })
      if (response) {
        /* 使用 reply() 回复，自动使用消息中的 context_token */
        await bot.reply(msg, response)
      }
      log.info('WeChat', `已响应 -${commandName} 命令，来自用户 ${userId}`)
    } catch (error: any) {
      log.error('WeChat', `命令执行失败: ${error.message}`)
      if (error instanceof NoContextError) {
        /* context_token 过期，无法回复，静默忽略 */
        return
      }
      await bot.reply(msg, `❌ 命令执行失败: ${error.message}`).catch(() => {})
    }
  } else {
    /* 未知命令，提示帮助信息 */
    await bot.reply(msg, '❓ 未知命令，发送 -start 查看帮助').catch(() => {})
  }
}

/**
 * 处理115分享链接
 *
 * 功能：
 * 1. 检测消息是否为115分享链接
 * 2. 自动转存到配置的目录
 * 3. 返回转存结果
 *
 * @param bot - WeChatBot 实例
 * @param msg - 收到的消息（IncomingMessage 类型）
 * @returns 是否处理了分享链接
 */
export async function handleWechatShareLink(bot: WeChatBot, msg: IncomingMessage): Promise<boolean> {
  const userId = msg.userId
  if (!userId) return false

  const shareUrl = is115ShareUrl(msg.text)
  if (!shareUrl) return false

  log.info('WeChat', `检测到115分享链接，来自用户 ${userId}`)

  try {
    /* 使用 reply() 回复，自动使用消息中的 context_token */
    await bot.reply(msg, '🔍 检测到115分享链接，开始转存...')

    const result = await saveShareLink(shareUrl)

    if (result.success) {
      const replyText = [
        '✅ 115分享转存成功!',
        `📁 转存目录: ${result.saveDir}`,
        `📄 文件数量: ${result.fileCount}`,
        `💾 总大小: ${result.totalSize}`
      ].join('\n')

      await bot.reply(msg, replyText)
      log.info('WeChat', `115分享转存成功: ${result.saveDir}, ${result.fileCount}个文件`)
    } else {
      await bot.reply(msg, `❌ 转存失败: ${result.error}`)
      log.error('WeChat', `115分享转存失败: ${result.error}`)
    }

    return true
  } catch (error: any) {
    log.error('WeChat', `处理115分享链接异常: ${error.message}`)
    await bot.reply(msg, `❌ 处理分享链接失败: ${error.message}`).catch(() => {})
    return false
  }
}
