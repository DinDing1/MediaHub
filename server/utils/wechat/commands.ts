/**
 * 微信命令处理模块
 * 
 * 功能：
 * 1. 处理微信消息中的命令（以 - 开头）
 * 2. 处理115分享链接自动转存
 * 
 * 与 Telegram 模块保持一致的回复格式
 */

import { Client } from '@openilink/openilink-sdk-node'
import { log } from '../logger'
import { saveShareLink, is115ShareUrl } from '../pan115/share115'
import { generateStrmFiles } from '../pan115/strm_115'

/**
 * 微信消息结构
 * 来自 openilink-sdk-node 的消息格式
 */
interface WechatMessage {
  from_user_id?: string
  context_token?: string
  item_list?: Array<{
    type?: number
    text_item?: { text?: string }
  }>
}

/**
 * 命令上下文
 * 包含命令执行所需的上下文信息
 */
interface CommandContext {
  userId: string
  args: string[]
  message: WechatMessage
}

/**
 * 命令处理器类型
 */
type CommandHandler = (client: Client, ctx: CommandContext) => Promise<string | void>

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
commands.set('start', async (client: Client, ctx: CommandContext) => {
  return `👋 你好！我是媒体管理机器人。

可用命令：
-start - 显示帮助信息
-strm115 - 生成 STRM 文件

💡 发送115分享链接可自动转存到云盘`
})

commands.set('strm115', async (client: Client, ctx: CommandContext) => {
  log.info('WeChat', `收到 -strm115 命令，来自用户 ${ctx.userId}`)
  
  try {
    await client.push(ctx.userId, '🔄 开始生成 STRM 文件...')
    
    const result = await generateStrmFiles()
    
    if (!result.success) {
      log.error('WeChat', `STRM 生成失败: ${result.error}`)
      await client.push(ctx.userId, `❌ 生成失败: ${result.error}`)
    }
  } catch (e: any) {
    log.error('WeChat', `STRM 生成异常: ${e.message}`)
    await client.push(ctx.userId, `❌ 生成异常: ${e.message}`)
  }
})

/**
 * 处理微信命令消息
 * 
 * @param client - 微信客户端实例
 * @param message - 微信消息对象
 * @param text - 消息文本内容
 */
export async function handleWechatCommand(client: Client, message: WechatMessage, text: string): Promise<void> {
  const userId = message.from_user_id
  if (!userId) return

  if (!text.startsWith('-')) return

  const parts = text.slice(1).split(' ')
  const commandName = parts[0]?.toLowerCase()
  const args = parts.slice(1)

  if (!commandName) return

  const handler = commands.get(commandName)
  if (handler) {
    try {
      const response = await handler(client, { userId, args, message })
      if (response) {
        await client.push(userId, response)
      }
      log.info('WeChat', `已响应 -${commandName} 命令，来自用户 ${userId}`)
    } catch (error: any) {
      log.error('WeChat', `命令执行失败: ${error.message}`)
      await client.push(userId, `❌ 命令执行失败: ${error.message}`)
    }
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
 * @param client - 微信客户端实例
 * @param message - 微信消息对象
 * @param text - 消息文本内容
 * @returns 是否处理了分享链接
 */
export async function handleWechatShareLink(client: Client, message: WechatMessage, text: string): Promise<boolean> {
  const userId = message.from_user_id
  if (!userId) return false

  const shareUrl = is115ShareUrl(text)
  if (!shareUrl) return false

  log.info('WeChat', `检测到115分享链接，来自用户 ${userId}`)

  try {
    await client.push(userId, '🔍 检测到115分享链接，开始转存...')
    
    const result = await saveShareLink(shareUrl)
    
    if (result.success) {
      const replyText = [
        '✅ 115分享转存成功!',
        `📁 转存目录: ${result.saveDir}`,
        `📄 文件数量: ${result.fileCount}`,
        `💾 总大小: ${result.totalSize}`
      ].join('\n')
      
      await client.push(userId, replyText)
      log.info('WeChat', `115分享转存成功: ${result.saveDir}, ${result.fileCount}个文件`)
    } else {
      await client.push(userId, `❌ 转存失败: ${result.error}`)
      log.error('WeChat', `115分享转存失败: ${result.error}`)
    }
    
    return true
  } catch (error: any) {
    log.error('WeChat', `处理115分享链接异常: ${error.message}`)
    await client.push(userId, `❌ 处理分享链接失败: ${error.message}`)
    return false
  }
}
