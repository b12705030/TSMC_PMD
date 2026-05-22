# Unleash Innovation — Performance Management System

A modern, centralized performance management system for a global enterprise with ~100,000 employees.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| Backend | Node.js + NestJS + TypeScript |
| Database | Neon (PostgreSQL) |
| Audit Log | Elasticsearch |
| ORM | Prisma |
| CI/CD | GitHub Actions |

## 測試帳號（密碼統一 `test1234`）

### Global
| employeeId | Role | Name | Department | Level |
|-----------|------|------|------------|-------|
| `admin001` | Admin | Alice Admin | IT | L6 |
| `ghr001` | GlobalHR | Bob GlobalHR | IT | L5 |

> GlobalHR 可跨所有 region 查看資料、比較模板差異、查看 Audit Log。

### Taiwan
```
tw-hr001   RegionalHR  Helen Lin     Human Resources
└── tw-sup003  Supervisor  Grace Hsu     Recruiting
    └── tw-emp003  Employee    Karen Lee     HR Recruiter L3

tw-mgr001  Manager     Michael Chen  Engineering
├── tw-sup001  Supervisor  Susan Wang    Process Engineering
│   ├── tw-emp001  Employee    Eric Chang    Process Engineer L2
│   └── tw-emp004  Employee    Kevin Chen    Process Engineer L3
└── tw-sup002  Supervisor  Victor Wu     Equipment Engineering
    └── tw-emp002  Employee    Jason Huang   Equipment Engineer L2
```

### North America
```
na-hr001   RegionalHR  Nancy Carter   Human Resources

na-mgr001  Manager     Mark Thompson  Engineering
└── na-sup001  Supervisor  Sarah Mitchell Process Engineering
    └── na-emp001  Employee    Jake Williams  Process Engineer L2
```

### Japan
```
jp-hr001   RegionalHR  Hanako Tanaka  Human Resources

jp-mgr001  Manager     Taro Yamada    Engineering
└── jp-sup001  Supervisor  Ken Sato       Process Engineering
    └── jp-emp001  Employee    Ichiro Suzuki  Process Engineer L2
```

### Europe
```
eu-hr001   RegionalHR  Greta Müller   Human Resources

eu-mgr001  Manager     Hans Schneider Engineering
└── eu-sup001  Supervisor  Ingrid Weber   Process Engineering
    └── eu-emp001  Employee    Fritz Bauer    Process Engineer L2
```

### 重新 seed（帳號有變動時）

```bash
cd backend
npx prisma db seed
```

> Seed 使用 upsert，重複執行不會重複新增資料。

## Local Development

### Prerequisites

**必須版本（版本不對 `npm install` 會失敗）：**
- Node.js **20 或以上**（建議 LTS，目前為 22.x）
- npm **10 或以上**（隨 Node.js 20+ 自動附帶）
- Docker（啟動 Elasticsearch 用）

確認目前版本：
```bash
node --version   # 應顯示 v20.x.x 或以上
npm --version    # 應顯示 10.x.x 或以上
docker --version
```

版本不符時，請至 [https://nodejs.org](https://nodejs.org) 下載最新 LTS，或使用 [nvm](https://github.com/nvm-sh/nvm) 切換版本：
```bash
# 使用 nvm（Mac/Linux）
nvm install 22
nvm use 22
```

### 啟動 Elasticsearch（必要）

Audit Log 功能依賴 Elasticsearch，需先啟動：
(以下為powershell語法)
```powershell
docker run -d `
  --name elasticsearch `
  -p 9200:9200 `
  -e "discovery.type=single-node" `
  -e "xpack.security.enabled=false" `
  docker.elastic.co/elasticsearch/elasticsearch:8.13.0
```

確認啟動成功：
```powershell
curl http://localhost:9200   # 應回傳 ES cluster 資訊
```

> 之後重啟只需 `docker start elasticsearch`，不需重跑 `docker run`。  
> 若 ES 不可用，其他功能（登入、目標、評核等）**仍可正常使用**，只是不會寫入 audit log。

### Environment Variables
去看notion
**backend/.env**：
```env
# PostgreSQL（從 Neon dashboard 取得）
DATABASE_URL="postgresql://..."       # Pooled connection
DIRECT_URL="postgresql://..."         # Direct / unpooled connection

# Elasticsearch（本機 Docker 預設值）
ELASTICSEARCH_NODE=http://localhost:9200

# 若 ES 有設定帳密（xpack.security.enabled=true）才需要以下兩行
# ELASTICSEARCH_USERNAME=elastic
# ELASTICSEARCH_PASSWORD=your-password
```

**frontend/.env.local**：
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd TSMC_PMD

# 2. 啟動 Elasticsearch（見上方說明）

# 3. Setup backend
cd backend
cp .env.example .env        # 填入 Neon 連線字串（DATABASE_URL / DIRECT_URL）
npm install
npx prisma generate         # 產生 Prisma client 型別（必須在 seed 前跑）
npx prisma migrate deploy   # 套用 DB migrations（每次 pull 後都要跑）
npx prisma db seed          # 建立測試帳號（第一次）
npm run start:dev

# 4. Setup frontend（開新 terminal）
cd frontend
cp .env.example .env.local  # 預設值即可，無需修改
npm install
npm run dev
```

> **注意**：
> - `migrate deploy` — **每次 pull 新程式碼後都應執行**，確保 DB schema 是最新的
> - `db seed` — 只需在第一次建立資料庫時執行一次（之後 seed 是 upsert，重複執行安全）
> - 後端啟動時會自動建立 ES 的 `audit-logs` index（若不存在）

### 啟動端點

| 服務 | URL |
|------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Swagger Docs | http://localhost:4000/api/docs |
| Elasticsearch | http://localhost:9200 |

### 執行測試

```bash
# Backend 單元測試
cd backend
npm test

# 只跑 audit 模組測試
npm test -- --testPathPattern=audit

# 含覆蓋率報告
npm run test:cov
```

## Branch Strategy

```
main          ← production-ready, protected
develop       ← integration branch, merge PRs here
feature/*     ← new features (e.g. feature/goal-management)
fix/*         ← bug fixes (e.g. fix/review-form-validation)
```

**Rules:**
- Never push directly to `main` or `develop`
- Always open a PR targeting `develop`
- PRs require at least 1 review before merge
- CI must pass before merge

## PR Convention

See [pull_request_template.md](.github/pull_request_template.md)

Commit message format:
```
feat: add goal progress update API
fix: correct session expiry logic
chore: update dependencies
docs: add API usage to README
```

## Project Structure

```
/
├── frontend/          # Next.js app
├── backend/           # NestJS app
└── .github/           # CI/CD + PR template
```
