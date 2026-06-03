# 阶段1: 构建应用
FROM node:24-slim AS builder

WORKDIR /app

# 安装构建依赖（better-sqlite3 需要 python 和编译工具）
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# 先复制依赖文件，利用 Docker 缓存
COPY package.json package-lock.json* ./

# 安装所有依赖（包括 devDependencies，构建需要）
RUN npm install

# 复制源码
COPY . .

# 构建 Nuxt 应用
RUN npm run build

# 阶段2: 生产镜像
FROM node:24-slim AS production

WORKDIR /app

# 安装运行时依赖（better-sqlite3 需要 glibc）
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY package.json package-lock.json* ./

# 只安装生产依赖
RUN npm install --omit=dev

# 从构建阶段复制构建产物
COPY --from=builder /app/.output .output

# 应用端口
ENV PORT=3030
ENV NODE_ENV=production
ENV NITRO_PRESET=node-server

# 暴露端口
EXPOSE 3030

# 数据目录挂载点
VOLUME ["/app/data"]

# 启动应用
CMD ["node", ".output/server/index.mjs"]
