# Stage 1: Install dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm install

# Stage 2: Build (建置階段)
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 接收建置時的環境變數 (讓 Next.js 知道去哪裡打 API)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# 編譯 Next.js 專案
RUN npm run build

# Stage 3: Production Runner (執行階段)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# 複製必要的靜態檔與編譯結果
# COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# 根據你的設定暴露 3000 Port
EXPOSE 3000

# 啟動 Next.js 伺服器
CMD ["npm", "start"]