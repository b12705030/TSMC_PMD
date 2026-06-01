# PMS 測試指南

這份文件說明 TSMC Performance Management System 目前有哪些自動化測試、如何在本機執行，以及 CI 預期會跑哪些檢查。

最後確認日期：2026-06-02。

## 目前測試總覽

| 層級 | 指令 | Suites / files | Tests | 需要 DB？ | CI 狀態 |
| --- | --- | ---: | ---: | --- | --- |
| 後端單元測試 | `cd backend && npm run test:unit` | 29 suites | 185 | 否 | 是 |
| 後端整合測試 | `cd backend && npm run test:integration` | 5 suites | 20 | 是，PostgreSQL | 是 |
| 後端單元 + 整合 | `cd backend && npm run test:all` | 34 suites | 205 | 只有整合測試需要 | 是，分 job 跑 |
| E2E smoke test | `cd e2e && npm test` | 3 files | 10 | 需要完整 app stack | 目前只本機 |
| 前端檢查 | `cd frontend && npm run lint && npm run type-check && npm run build` | N/A | N/A | 否 | 是 |

從 `backend/` 執行 `npm run test:cov` 可以產生當下 coverage。這份文件刻意不硬寫 coverage 百分比，因為每次新增測試或調整被量測的 source files 都會讓數字變動。

## 測試金字塔

這個 repo 採三層測試策略：

| Tier | 目的 | 範例 |
| --- | --- | --- |
| Tier 1：單元測試 | 使用 mocked Prisma 或 mocked 外部依賴，快速驗證 service logic、controller 接線、guards、utils、scheduler、audit 行為。 | `backend/src/**/*.spec.ts` |
| Tier 2：整合測試 | 用真實 Nest service 搭配真實 PostgreSQL 測試資料庫，驗證跨表 workflow、RBAC、region isolation、狀態轉換。 | `backend/test/integration/**/*.integration.spec.ts` |
| Tier 3：E2E smoke test | 使用 Playwright 對跑起來的 frontend/backend 做瀏覽器測試，驗證 login、RBAC UI、goal approval 等關鍵路徑。 | `e2e/tests/*.spec.ts` |

E2E 測試已經可以在本機跑，但目前還沒有接進 CI。

## 後端單元測試

執行：

```bash
cd backend
npm run test:unit
```

Coverage：

```bash
cd backend
npm run test:cov
```

### 單元測試清單

| 檔案 | Tests | 覆蓋內容 |
| --- | ---: | --- |
| `src/app.module.spec.ts` | 1 | App module imports、health controller、global provider 接線 |
| `src/health.controller.spec.ts` | 1 | Health endpoint 回傳格式 |
| `src/common/guards/auth.guard.spec.ts` | 5 | Session cookie auth guard |
| `src/common/guards/roles.guard.spec.ts` | 3 | Role metadata access check |
| `src/common/utils/region.util.spec.ts` | 3 | Global role 判斷 |
| `src/modules/audit/audit-write.interceptor.spec.ts` | 6 | Audit interceptor 成功/失敗 logging |
| `src/modules/audit/audit.controller.spec.ts` | 5 | Audit controller filter 與 delegation |
| `src/modules/audit/audit.service.spec.ts` | 8 | Audit 查詢/寫入，外部依賴 mock |
| `src/modules/audit/forbidden.filter.spec.ts` | 4 | Forbidden response 與 audit logging |
| `src/modules/auth/auth.controller.spec.ts` | 5 | Login/logout/me controller 接線、cookie set/clear |
| `src/modules/auth/auth.service.spec.ts` | 5 | Login、invalid credentials、session、logout audit |
| `src/modules/config/config.controller.spec.ts` | 3 | Config controller delegation |
| `src/modules/config/config.service.spec.ts` | 7 | Region config 讀寫與 RBAC |
| `src/modules/users/users.controller.spec.ts` | 5 | Users controller delegation 與 query parsing |
| `src/modules/users/users.service.spec.ts` | 21 | User listing、hierarchy、metadata、create/update |
| `src/modules/goals/goals.controller.spec.ts` | 4 | Goal controller delegation、milestone normalization |
| `src/modules/goals/goals.service.spec.ts` | 19 | Goal 建立、審核、team access、milestone、delete |
| `src/modules/cycles/cycles.controller.spec.ts` | 3 | Cycle controller 讀取、寫入、狀態操作 |
| `src/modules/cycles/cycles.service.spec.ts` | 16 | Cycle RBAC、日期驗證、advance gates、review rows、confirm/postpone |
| `src/modules/cycles/cycles.scheduler.spec.ts` | 4 | Auto-advance 與 reminder scheduler |
| `src/modules/reviews/review-answers.util.spec.ts` | 6 | 必填答案、rating/option/text validation |
| `src/modules/reviews/reviews.controller.spec.ts` | 4 | Review controller delegation |
| `src/modules/reviews/reviews.service.spec.ts` | 14 | Review scopes、submit、calibration、publish、stats |
| `src/modules/templates/templates.controller.spec.ts` | 4 | Template controller delegation |
| `src/modules/templates/templates.service.spec.ts` | 9 | Template 建立、自訂題、publish conflict、global lock |
| `src/modules/appeals/appeals.controller.spec.ts` | 4 | Appeal controller delegation |
| `src/modules/appeals/appeals.service.spec.ts` | 8 | Appeal 建立、access scope、response、resolved state |
| `src/modules/notifications/notifications.controller.spec.ts` | 4 | Notification controller delegation |
| `src/modules/notifications/notifications.service.spec.ts` | 4 | Notification list、read state、recipient dedupe |

## 後端整合測試

整合測試需要一個可丟棄的 PostgreSQL 測試資料庫，並透過 `TEST_DATABASE_URL` 指定。

執行：

```bash
cd backend
npm run test:integration
```

### 本機資料庫範例

```bash
docker run -d --name pms-test-db -p 5433:5432 \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=pms_test \
  postgres:16

cd backend
export TEST_DATABASE_URL="postgresql://test:test@localhost:5433/pms_test?schema=public"
export DATABASE_URL="$TEST_DATABASE_URL"
export DIRECT_URL="$TEST_DATABASE_URL"
npx prisma migrate deploy
npm run test:integration
```

PowerShell：

```powershell
$env:TEST_DATABASE_URL = "postgresql://test:test@localhost:5433/pms_test?schema=public"
$env:DATABASE_URL = $env:TEST_DATABASE_URL
$env:DIRECT_URL = $env:TEST_DATABASE_URL
npx prisma migrate deploy
npm run test:integration
```

### 整合測試清單

| 檔案 | Tests | 覆蓋內容 |
| --- | ---: | --- |
| `test/integration/auth.integration.spec.ts` | 5 | 真實 login/session workflow |
| `test/integration/goals.integration.spec.ts` | 6 | Goal 建立、region/cycle 檢查、ownership、approval |
| `test/integration/templates.integration.spec.ts` | 4 | Template 建立、region 檢查、publish conflict |
| `test/integration/reviews.integration.spec.ts` | 3 | Supervisor submit、required grade、RBAC |
| `test/integration/cycles.integration.spec.ts` | 2 | Cycle advance gates 與 review row 建立 |

整合測試會在 test cases 之間清空並重建測試資料。不要把 `TEST_DATABASE_URL` 指向 production 或共用資料庫。

## E2E 測試

E2E 測試位於 `e2e/`，使用 Playwright。執行前需要 frontend、backend、database 都已啟動，且 seed data 已建立。

執行：

```bash
docker compose up --build -d
docker exec tsmc-backend npx prisma migrate deploy
docker exec tsmc-backend npx prisma db seed

cd e2e
npm install
npx playwright install chromium
npm test
```

常用指令：

```bash
cd e2e
npm run test:headed
npm run test:ui
npm run report
```

### E2E 測試清單

| 檔案 | Tests | 覆蓋內容 | 帳號 |
| --- | ---: | --- | --- |
| `e2e/tests/auth.spec.ts` | 6 | Login、logout、invalid credentials、未登入 redirect、`sessionId` set/clear、session 消失 redirect | `tw-emp001` |
| `e2e/tests/rbac.spec.ts` | 2 | Employee 不能建立 cycle；RegionalHR 可以建立 cycle | `tw-emp001`, `tw-hr001` |
| `e2e/tests/goals.spec.ts` | 2 | Employee 建立/提交 goal；Supervisor 核准 goal | `tw-emp001`, `tw-sup001` |

目前穩定 selector 使用 `data-testid`，包含：

- `login-employee-id`
- `login-password`
- `login-submit`
- `login-error`
- `sidebar-logout`
- `goal-new-title`
- `goal-new-due-date`
- `goal-new-description`
- `goal-new-metric`
- `goal-new-targetValue`
- `goal-new-relevance`
- `goal-new-submit`
- `goal-submit-approval`
- `goal-approve`
- `cycles-add`

E2E 目前沒有接進 CI，因為它需要完整 app stack 和 browser runtime。

## 前端檢查

前端目前沒有 Jest、Vitest、React Testing Library 或 component test setup。CI 與本機驗證使用：

```bash
cd frontend
npm run lint
npm run type-check
npm run build
```

前端行為目前主要靠 Playwright E2E smoke tests 覆蓋。

## CI/CD

CI 預期跑三類檢查：

| Job | 檢查內容 |
| --- | --- |
| Frontend | install、lint、type-check、build |
| Backend unit | install、Prisma validate/generate、lint、type-check、build、unit tests |
| Backend integration | PostgreSQL service、migrations、integration tests |

E2E 目前維持本機手動執行。

## 建議後續補強

| 區域 | 建議測試 |
| --- | --- |
| HTTP route integration | 用 Supertest 補 auth cookies、current user、403/401 behavior |
| Appeals integration | 用真實 DB 補 appeal create/respond/resolution flows |
| Users integration | 用真實關聯補 region isolation 與 hierarchy queries |
| E2E review flow | Employee self-review、Supervisor review、Manager publish |
| E2E HR flow | RegionalHR 建立 cycle、建立 template、發布 template |
| Frontend component tests | 等 hooks/components 複雜到值得引入 test runner 時再加 |

## 最近驗證指令

目前清單是用以下指令確認：

```bash
cd backend
npm run type-check
npm run test:unit
npm run test:cov

cd frontend
npm run type-check
npm run lint

cd e2e
npx playwright test --list
```

最近觀察結果：

- Backend type-check passed.
- Backend unit tests passed：29 suites，185 tests。
- Backend coverage 可用 `npm run test:cov` 重新產生。
- Frontend type-check 與 lint passed。
- Playwright 可列出 3 個檔案、10 個 tests。
