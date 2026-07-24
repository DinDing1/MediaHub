# MediaHub

媒体库管理工具，支持云盘自动整理、自动重命名、STRM 文件生成、Emby 302 反代、Telegram、WeChat 通知等功能。

目标运行环境：**飞牛 OS 原生套件**（非 Docker）。

## 项目结构

```
media-dashboard/
├── app/                 # 前端 (Nuxt pages/components/layouts/...)
├── server/              # 后端 (Nitro API / utils / plugins)
├── types/               # 共享 TypeScript 类型
├── public/              # 静态资源
├── fonts/               # 封面生成字体
├── config/              # 版本等配置 (version.json)
├── deploy/
│   └── fnos/
│       └── mediahub/    # 飞牛套件打包源 (manifest/cmd/wizard/...)
├── docs/                # 文档与截图
├── nuxt.config.ts
├── package.json
└── .github/workflows/
    └── package.yml      # 飞牛 fpk 构建与发布
```

## 本地开发

```bash
npm install
npm run dev
```

访问 `http://localhost:3030`。

```bash
npm run build    # 生产构建
npm run preview  # 预览构建产物
```

本地运行时数据目录（已 gitignore）：

| 目录 | 说明 |
|------|------|
| `data/` | 数据库等应用数据 |
| `logs/` | 日志 |
| `media/` | 可选本地媒体目录 |

## 飞牛 OS 安装

1. 从 Release 或 FnDepot 下载对应架构的 `.fpk`
2. 在飞牛「应用中心」安装套件
3. 在「应用设置」中授权存储目录（用于 STRM 输出等）
4. 打开应用完成 115 / Emby 等业务配置；STRM 输出路径在「设置 → STRM 配置」中选择

服务端口：`3030`

## 打包说明

CI（`.github/workflows/package.yml`）由 `config/version.json` 版本号变更或手动 workflow 触发，产物为飞牛 `.fpk`。

- 打包源目录：`deploy/fnos/mediahub`（`FNOS_PKG_DIR`）
- 前端源码：`app/`（`nuxt.config.ts` 中 `srcDir: 'app'`）
- 后端源码：`server/`（`serverDir: 'server'`）
- 代码质检：`npm run typecheck`（`nuxt typecheck`，覆盖 `app/` + `server/`）
- Node 运行时与 fnpack：CI **临时下载**，不提交仓库
  - Node：`https://nodejs.org/dist/...` → `deploy/fnos/mediahub/app/runtime/bin/node`
  - fnpack：`https://static2.fnnas.com/fnpack/fnpack-1.2.1-linux-{amd64,arm64}`
- 构建产物复制使用 `rsync -aL`（解引用符号链接，避免飞牛「设置目录权限失败」）

本地质检：

```bash
npm run typecheck
npm run build
```

## 版本管理

应用版本**唯一源**为 `config/version.json`（当前与 `package.json` 同步）。

升级版本时请同时修改：

1. `config/version.json` 的 `version` 字段（会触发飞牛 fpk 打包）
2. `package.json` 的 `version` 字段（保持一致）

前端侧栏与后端 Telegram 客户端等均从上述配置读取，请勿在业务代码中硬编码版本号。

飞牛套件 `deploy/fnos/mediahub/manifest` 中的 `version` 由 CI 打包时自动写入，无需手改。
