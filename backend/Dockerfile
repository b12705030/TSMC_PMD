# Stage 1: Build 階段
FROM node:22-alpine AS builder

# 針對 Alpine Linux 安裝 Prisma 引擎所需的依賴
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# 複製 package 檔案並使用 install 避免 lock 檔不同步錯誤
COPY package*.json ./
RUN npm install

# 複製專案原始碼與 Prisma Schema
COPY . .

# 產生 Prisma Client (必須在編譯 NestJS 之前)
RUN npx prisma generate

# 編譯 NestJS 專案 (輸出至 dist 資料夾)
RUN npm run build

# Stage 2: Production 階段
FROM node:22-alpine AS runner

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app
ENV NODE_ENV=production

# 僅複製運行所需的檔案
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 4000

# 直接執行編譯後的檔案，最穩定且效能最好
CMD ["node", "dist/src/main.js"]