# Unleash Innovation — Performance Management System

A modern, centralized performance management system for a global enterprise with ~100,000 employees.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| Backend | Node.js + NestJS + TypeScript |
| Database | Neon (PostgreSQL) — Primary + Read Replica |
| Audit Log | Neon (PostgreSQL)（Prisma `AuditLog` model） |
| ORM | Prisma |
| Metrics | prom-client → Grafana Cloud |
| CI/CD | GitHub Actions |
| Container | Docker Compose |

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

- Docker Desktop（包含 Docker Compose）

確認安裝：
```bash
docker --version
docker compose version
```

### Environment Variables

啟動前只需準備 **backend/.env**（從 Notion 取得內容）：

```env
# PostgreSQL（從 Neon dashboard 取得）
DATABASE_URL="postgresql://..."       # Pooled connection
DIRECT_URL="postgresql://..."         # Direct / unpooled connection
```

> `frontend/.env.local` 不需要手動建立，`NEXT_PUBLIC_API_URL` 已在 `docker-compose.yml` 的 build arg 中設定好。

### 啟動

```bash
# 1. Clone the repo
git clone <repo-url>
cd TSMC_PMD

# 2. 準備 backend/.env（填入 Neon 連線字串）
cp backend/.env.example backend/.env

# 3. 第一次啟動（Build image + 啟動所有服務）
docker-compose up --build -d

# 4. 套用 DB migrations（有新 migration 時都需執行，冪等安全）
docker exec tsmc-backend npx prisma migrate deploy

# 5. 若要匯入 Seed 測試資料（第一次，或清空 DB 後才需執行 整個專案只需執行一次）
docker exec tsmc-backend npx prisma db seed
```

之後重啟（不需重新 build）：
```bash
docker-compose up -d
```

停止所有服務：
```bash
docker-compose down
```

> **注意**：每次 pull 新程式碼若有 migration 變動，需再執行 `docker exec tsmc-backend npx prisma migrate deploy`

### 啟動端點

| 服務 | URL |
|------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Swagger Docs | http://localhost:4000/api/docs |
| Prometheus Metrics | http://localhost:4000/metrics |

### 執行測試

```bash
# Backend 單元測試（CI 同款，不需資料庫）
cd backend
npm run test:unit

# 只跑 audit 模組
npm run test:unit -- --testPathPattern=audit

# 含覆蓋率報告
npm run test:cov

# 整合測試（需 TEST_DATABASE_URL，Tier 2）
npm run test:integration
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
