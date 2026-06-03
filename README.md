# MediaHub

媒体库管理工具，支持云盘自动整理、自动重命名、STRM 文件生成、Emby 302 反代、Telegram、WeChat 通知等功能。

## Docker 部署

### 快速启动

1. 创建 `docker-compose.yml`：

```yaml
services:
  mediahub:
    image: dinding1/mediahub:latest
    container_name: mediahub
    ports:
      - "3030:3030"   # Web 管理界面
      - "8097:8097"   # Emby 反代端口（可选，启用反代时需要）
    volumes:
      - ./data:/app/data                    # 应用数据（数据库等）
      - ./logs:/app/logs                    # 日志目录
      - /path/to/your/media:/media          # 媒体目录，STRM 文件输出路径
    environment:
      - NODE_ENV=production
      - TZ=Asia/Shanghai
    restart: unless-stopped
```

2. 启动服务：

```bash
docker compose up -d
```

3. 访问 `http://<服务器IP>:3030` 打开管理界面。

### 端口说明

| 端口 | 用途 |
|------|------|
| 3030 | Web 管理界面（必须） |
| 8097 | Emby 302 反代端口（启用反代功能时需要映射） |

### 目录说明

| 容器路径 | 说明 |
|----------|------|
| `/app/data` | 应用数据目录（数据库、配置） |
| `/app/data/logs` | 日志目录 |
| `/media` | 媒体目录，STRM 文件输出路径，需映射到宿主机实际媒体目录 |

## 本地开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```
