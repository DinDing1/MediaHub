# 添加 Telegram Bot 支持计划

## 背景

当前项目的 Telegram 功能基于 GramJS（telegram 包）实现 **用户客户端（User Bot）** 模式，需要用户提供：
- API ID（从 my.telegram.org 申请）
- API Hash
- 手机号 + 验证码登录

问题：部分用户很难从 my.telegram.org 申请到开发者 API，导致无法使用 Telegram 功能。

## 目标

在保留现有 User Bot 模式的基础上，新增 **Bot 模式** 支持。用户只需提供 Bot Token（从 @BotFather 获取，非常简单），即可使用 Telegram 通知和命令功能。

## 设计方案

### 模式选择

在设置页面新增 Telegram 模式切换（单选）：
- **Bot 模式**（推荐）：只需 Bot Token，无需 API ID/Hash
- **User 模式**（高级）：需要 API ID/Hash + 手机号登录

两种模式共享：管理员 ID、白名单群组、通知群组配置。

### 功能对比

| 功能 | Bot 模式 | User 模式 |
|------|---------|----------|
| 发送通知 | ✅ | ✅ |
| 接收命令 | ✅ | ✅ |
| 115 分享链接转存 | ✅ | ✅ |
| 代理支持 | ✅ | ✅ |
| 无需 API 申请 | ✅ | ❌ |
| 以用户身份操作 | ❌ | ✅ |

## 实现步骤

### 第1步：安装 node-telegram-bot-api 依赖

当前项目使用 `telegram`（GramJS）包实现 User Bot。Bot 模式使用 `node-telegram-bot-api` 包，这是 Node.js 中最成熟的 Telegram Bot API 库。

```bash
npm install node-telegram-bot-api
```

### 第2步：新增数据库配置项

在 `server/utils/db.ts` 的 `CONFIG_DEFINITIONS` 中添加：

- `telegram_mode`：模式选择，值为 `bot` 或 `user`，默认 `user`
- `telegram_bot_token`：Bot Token

### 第3步：创建 Bot 客户端模块

新建 `server/utils/telegram/bot.ts`，实现：

1. **BotClient 类**：封装 node-telegram-bot-api
   - `initBot()`：初始化 Bot，设置 webhook 或 polling
   - `sendNotification()`：发送通知消息/图片
   - `startMessageHandler()`：监听命令消息
   - `disconnectBot()`：断开连接
   - `getLoginStatus()`：获取 Bot 连接状态
   - 代理支持（node-telegram-bot-api 原生支持 SOCKS5/HTTP 代理）

2. **命令处理**：复用现有 `commands.ts` 的命令注册表，但适配 Bot API 的消息格式
   - Bot 命令以 `/` 开头（如 `/start`、`/strm115`），而非 User 模式的 `-` 开头
   - 权限校验逻辑复用（管理员 ID、白名单群组）

3. **全局状态管理**：与 User 模式类似，通过 `globalThis` 持久化 Bot 实例

### 第4步：创建统一通知接口

修改 `server/utils/telegram/client.ts` 中的 `sendNotification()` 函数，根据 `telegram_mode` 配置自动路由：

```
sendNotification() → 检查 telegram_mode
  ├── bot → bot.ts 的 sendNotification()
  └── user → 现有 GramJS 的 sendNotification()
```

这样所有调用 `sendNotification()` 的业务模块（10+ 个）无需任何修改。

### 第5步：修改 Telegram 配置 API

修改 `server/api/telegram/config.ts`：

1. GET 请求：返回 `telegram_mode` 和 `telegram_bot_token`（脱敏）配置
2. POST 请求：
   - 新增 `saveConfig` 处理 `telegram_mode` 和 `telegram_bot_token`
   - 新增 `initBot` action：初始化 Bot 客户端
   - 新增 `logoutBot` action：断开 Bot 连接
   - Bot 模式下不需要 sendCode/signIn/signInWithPassword 流程

### 第6步：修改前端设置页面

修改 `pages/settings.vue`：

1. 在 Telegram 配置卡片顶部添加模式切换（Bot / User 单选按钮）
2. Bot 模式下显示：
   - Bot Token 输入框
   - 代理配置（复用现有）
   - 连接/断开按钮
   - Bot 信息显示（用户名等）
3. User 模式下显示现有的 API ID/Hash/手机号/验证码流程
4. 权限配置卡片两种模式共享，无需修改

### 第7步：修改 nuxt.config.ts

将 `node-telegram-bot-api` 加入 Nitro 的 inline 外部依赖列表（与现有 `telegram` 包处理方式一致）。

### 第8步：更新定时任务调度器

修改 `server/utils/scheduler.ts`，确保定时任务启动时同时初始化对应模式的 Telegram 客户端（Bot 或 User）。

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `package.json` | 修改 | 添加 `node-telegram-bot-api` 依赖 |
| `server/utils/db.ts` | 修改 | 添加 `telegram_mode`、`telegram_bot_token` 配置定义 |
| `server/utils/telegram/bot.ts` | **新建** | Bot 客户端模块 |
| `server/utils/telegram/client.ts` | 修改 | `sendNotification()` 根据模式路由 |
| `server/utils/telegram/commands.ts` | 修改 | 适配 Bot API 消息格式，支持 `/` 命令前缀 |
| `server/api/telegram/config.ts` | 修改 | 添加 Bot 模式配置和操作 |
| `pages/settings.vue` | 修改 | 添加模式切换 UI 和 Bot 配置表单 |
| `nuxt.config.ts` | 修改 | 添加 `node-telegram-bot-api` 到 inline 外部依赖 |
| `server/utils/scheduler.ts` | 修改 | 启动时初始化对应模式的客户端 |
