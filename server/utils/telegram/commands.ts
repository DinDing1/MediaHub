import { TelegramClient } from 'telegram/index.js'
import { Api, helpers } from 'telegram/index.js'
import { getSetting } from '../db'
import { log } from '../logger'
import { saveShareLink, is115ShareUrl } from '../pan115/share115'
import { generateStrmFiles } from '../pan115/strm_115'

let client: TelegramClient | null = null

export function setCommandClient(c: TelegramClient | null): void {
  client = c
}

function getAdminIds(): number[] {
  const adminIdsStr = getSetting('telegram_admin_ids') || ''
  if (!adminIdsStr) return []
  return adminIdsStr.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
}

function getWhitelistChats(): number[] {
  const whitelistStr = getSetting('telegram_whitelist_chats') || ''
  if (!whitelistStr) return []
  return whitelistStr.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
}

function isAdmin(userId: any): boolean {
  const adminIds = getAdminIds()
  let id: number
  if (typeof userId === 'bigint') {
    id = Number(userId)
  } else if (userId !== undefined && userId !== null) {
    id = Number(userId)
  } else {
    return false
  }
  return adminIds.includes(id)
}

function isWhitelistedChat(chatId: any): boolean {
  const whitelist = getWhitelistChats()
  let id: number
  if (typeof chatId === 'bigint') {
    id = Number(chatId)
  } else if (chatId !== undefined && chatId !== null) {
    id = Number(chatId)
  } else {
    return false
  }
  return whitelist.length === 0 || whitelist.includes(id)
}

interface CommandContext {
  chatId: any
  senderId: any
  args: string[]
  message: Api.Message
}

type CommandHandler = (ctx: CommandContext) => Promise<void>

const commands: Map<string, CommandHandler> = new Map()

commands.set('start', async (ctx: CommandContext) => {
  await client?.sendMessage(ctx.chatId, {
    message: '👋 你好！我是媒体管理机器人。\n\n可用命令：\n-start - 显示帮助信息\n-strm115 - 生成 STRM 文件\n\n💡 发送115分享链接可自动转存到云盘'
  })
  await ctx.message.delete()
  log.info('Telegram', `已响应 -start 命令，来自用户 ${ctx.senderId}`)
})

commands.set('strm115', async (ctx: CommandContext) => {
  log.info('Telegram', `收到 -strm115 命令，来自用户 ${ctx.senderId}`)
  
  const progressMsg = await client?.sendMessage(ctx.chatId, {
    message: '🔄 开始生成 STRM 文件...'
  })
  
  try {
    const result = await generateStrmFiles()
    
    if (progressMsg) {
      try {
        await progressMsg.delete()
      } catch {}
    }
    
    if (!result.success) {
      await client?.sendMessage(ctx.chatId, { 
        message: `❌ 生成失败: ${result.error}` 
      })
      log.error('Telegram', `STRM 生成失败: ${result.error}`)
    }
  } catch (e: any) {
    if (progressMsg) {
      try {
        await progressMsg.delete()
      } catch {}
    }
    
    await client?.sendMessage(ctx.chatId, { 
      message: `❌ 生成异常: ${e.message}` 
    })
    log.error('Telegram', `STRM 生成异常: ${e.message}`)
  }
  
  await ctx.message.delete()
})

export async function handleCommand(message: Api.Message): Promise<void> {
  if (!message) return
  
  const text = message.message || ''
  const chatId = message.chatId
  const senderId = message.senderId
  
  if (!text.startsWith('-')) return
  
  const parts = text.slice(1).split(' ')
  const commandName = parts[0]?.toLowerCase()
  const args = parts.slice(1)
  
  if (!commandName) return
  
  const handler = commands.get(commandName)
  if (!handler) return
  
  if (!isAdmin(senderId)) {
    log.info('Telegram', `非管理员用户 ${senderId} 尝试使用命令 -${commandName}`)
    return
  }
  
  await handler({ chatId, senderId, args, message })
}

export async function handleShareLink(message: Api.Message): Promise<boolean> {
  if (!message) return false
  
  const text = message.message || ''
  const chatId = message.chatId
  const senderId = message.senderId
  
  if (!chatId) return false
  if (!isAdmin(senderId)) {
    return false
  }
  
  const shareUrl = is115ShareUrl(text)
  if (!shareUrl) {
    return false
  }
  
  log.info('Telegram', `检测到115分享链接，来自用户 ${senderId}`)
  
  try {
    const progressMsg = await client?.sendMessage(chatId, {
      message: '🔍 检测到115分享链接，开始转存...'
    })
    
    const result = await saveShareLink(shareUrl)
    
    if (progressMsg) {
      try {
        await progressMsg.delete()
      } catch {}
    }
    
    if (result.success) {
      const replyText = [
        '✅ 115分享转存成功!',
        `📁 转存目录: ${result.saveDir}`,
        `📄 文件数量: ${result.fileCount}`,
        `💾 总大小: ${result.totalSize}`
      ].join('\n')
      
      await client?.sendMessage(chatId, { message: replyText })
      log.info('Telegram', `115分享转存成功: ${result.saveDir}, ${result.fileCount}个文件`)
    } else {
      await client?.sendMessage(chatId, { 
        message: `❌ 转存失败: ${result.error}` 
      })
      log.error('Telegram', `115分享转存失败: ${result.error}`)
    }
    
    return true
  } catch (e: any) {
    log.error('Telegram', `处理115分享链接异常: ${e.message}`)
    await client?.sendMessage(chatId, { 
      message: `❌ 处理分享链接失败: ${e.message}` 
    })
    return true
  }
}

export function registerCommand(name: string, handler: CommandHandler): void {
  commands.set(name.toLowerCase(), handler)
  log.info('Telegram', `已注册命令: -${name}`)
}

export function getRegisteredCommands(): string[] {
  return Array.from(commands.keys())
}
