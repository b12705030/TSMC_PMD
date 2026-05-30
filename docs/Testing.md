# CI/CD Automated Testing — Tier 1 & Tier 2 Reference

This document explains **all automated backend tests** that run in GitHub Actions on push/PR: what each tier does, why it exists, how it runs, and what every test checks.

> **File name note:** `Testing.md` is kept for history; content covers **Tier 1 (unit)** and **Tier 2 (integration)**.

---

## Table of contents

1. [Testing strategy at a glance](#testing-strategy-at-a-glance)
2. [When CI runs](#when-ci-runs)
3. [CI pipeline (all jobs)](#ci-pipeline-all-jobs)
4. [Tier 1 — Unit tests](#tier-1--unit-tests)
5. [Tier 2 — Integration tests](#tier-2--integration-tests)
6. [Tier 1 vs Tier 2 comparison](#tier-1-vs-tier-2-comparison)
7. [What is still not automated](#what-is-still-not-automated)
8. [Run tests locally](#run-tests-locally)
9. [Related documents](#related-documents)

---

## Testing strategy at a glance

The PMS backend handles **authentication**, **role-based access**, **multi-region data**, and workflows for **goals**, **reviews**, **cycles**, and **templates**. Bugs in these areas can cause security issues (wrong user sees data) or broken business flows (reviews submitted without grades).

We use a **test pyramid** in CI:

```
                    ┌─────────────┐
                    │  Tier 3 E2E │  ← Not in CI yet (Playwright)
                    └─────────────┘
               ┌────────────────────────┐
               │ Tier 2 Integration     │  ← 20 tests, real Postgres
               │ (service + database)   │
               └────────────────────────┘
          ┌────────────────────────────────────┐
          │ Tier 1 Unit                        │  ← 45 tests, no DB / mocked ES
          │ (guards, utils, audit, validation) │
          └────────────────────────────────────┘
```

| Tier | Command | Tests | Database | CI job |
|------|---------|-------|----------|--------|
| **Tier 1** | `npm run test:unit` | 45 | No | `Backend — Lint, Type Check, Build & Unit Tests` |
| **Tier 2** | `npm run test:integration` | 20 | Yes (Postgres) | `Backend — Integration Tests` |
| **Both** | `npm run test:all` | 65 | Tier 2 only | Run both jobs in parallel on GitHub |

**Frontend:** CI runs lint, type-check, and build only — no Jest or Playwright tests yet.

---

## When CI runs

| Event | Branches |
|-------|----------|
| **Push** | `main`, `develop`, `dev` |
| **Pull request** | Target branch is `main`, `develop`, or `dev` |

Pushing a feature branch alone does **not** run CI until you open a PR into one of the branches above.

**Environment:** `ubuntu-latest`, Node.js 20. Jobs run in parallel where possible.

---

## CI pipeline (all jobs)

```
Push / PR
    │
    ├─► Frontend
    │     npm ci → lint → type-check → build
    │     (NEXT_PUBLIC_API_URL=http://localhost:4000)
    │
    ├─► Backend (Tier 1)
    │     npm ci → prisma validate & generate → lint → type-check → build → test:unit
    │     (dummy DATABASE_URL / DIRECT_URL — no real DB)
    │
    └─► Backend Integration (Tier 2)
          Postgres 16 service → npm ci → prisma migrate deploy → test:integration
          (real TEST_DATABASE_URL)
```

### Prisma steps explained

| Step | Job | Connects to real DB? | Purpose |
|------|-----|----------------------|---------|
| `prisma validate` | Backend (Tier 1) | **No** | Schema file is syntactically valid |
| `prisma generate` | Backend (Tier 1) | **No** | Prisma Client builds for TypeScript/compile |
| `prisma migrate deploy` | Backend Integration (Tier 2) | **Yes** | Applies migrations to test Postgres |

Tier 1 only needs **placeholder** `DATABASE_URL` / `DIRECT_URL` because `schema.prisma` references those env vars. Tier 2 uses a real Postgres container — **not** your Neon dev/prod database.

---

## Tier 1 — Unit tests

### What Tier 1 is

**Unit tests** exercise small pieces of logic in isolation:

- **Guards and pure functions** — mocked dependencies (no Postgres).
- **Audit module** — Elasticsearch client fully mocked.
- **Review answer validation** — in-memory question fixtures.

They are **fast** (~20s) and **deterministic**, which makes them ideal as a gate on every PR.

### How Tier 1 runs

| Setting | Value |
|---------|--------|
| Command | `npm run test:unit` |
| Jest pattern | `backend/src/**/*.spec.ts` |
| Count | **45 tests**, **8 suites** |
| Database | Not used |
| Elasticsearch | Mocked in audit specs |

### What Tier 1 protects (summary)

| Area | Production code | Why it matters |
|------|-----------------|----------------|
| Session gate | `AuthGuard` | Blocks unauthenticated API access |
| Role gate | `RolesGuard` | Enforces `@Roles()` on endpoints |
| Region scope | `isGlobalRole()` | Admin/GlobalHR vs regional isolation |
| Review forms | `validateReviewAnswers()` | Valid ratings, options, required fields |
| Audit | `AuditService`, interceptor, filter, controller | Logging must not break API or leak secrets |

### Tier 1 test catalog

#### `auth.guard.spec.ts` (4 tests) → `common/guards/auth.guard.ts`

**Purpose:** Every protected route depends on reading the `sessionId` cookie, loading the session from the DB, and attaching `request.user`.

| Test | Checks | If it broke |
|------|--------|-------------|
| Missing cookie | `UnauthorizedException` | APIs open without login |
| Session not in DB | 401 | Invalid cookies still work |
| Expired session | 401 | Sessions never expire |
| Valid session | `request.user` populated | Wrong/missing user in handlers |

**Method:** `PrismaService` mocked.

---

#### `roles.guard.spec.ts` (3 tests) → `common/guards/roles.guard.ts`

**Purpose:** After auth, `@Roles()` metadata restricts which roles can call each endpoint.

| Test | Checks | If it broke |
|------|--------|-------------|
| No roles required | Access allowed | False 403s |
| Role in list | Access allowed | Legitimate users blocked |
| Role not in list | `ForbiddenException` | Privilege escalation |

**Method:** `Reflector` mocked.

---

#### `region.util.spec.ts` (3 tests) → `common/utils/region.util.ts`

**Purpose:** `isGlobalRole()` is used in many services to skip `regionId` filtering for Admin and GlobalHR only.

| Test | Checks | If it broke |
|------|--------|-------------|
| Admin | `true` | Admin locked to one region |
| GlobalHR | `true` | Cannot see all regions |
| RegionalHR, Manager, Supervisor, Employee | `false` | Cross-region data leaks |

**Method:** Pure function, no mocks.

---

#### `review-answers.util.spec.ts` (6 tests) → `modules/reviews/review-answers.util.ts`

**Purpose:** Validates employee/supervisor answers before submit (also used by `ReviewsService`).

Validates: question IDs, required fields, rating 1–5, MC options, text ≤ 5000 chars.

| Test | Checks | If it broke |
|------|--------|-------------|
| Valid answers | Pass | Good submits rejected |
| Bad rating | `BadRequestException` | Invalid scores saved |
| Bad MC option | `BadRequestException` | Invalid choices saved |
| Text too long | `BadRequestException` | Oversized payloads |
| Missing required | `BadRequestException` | Incomplete reviews submitted |
| Optional omitted | Pass | Optional fields block submit |

**Method:** In-memory fixtures. Does **not** test grade-required-on-submit (that's Tier 2).

---

#### Audit module (29 tests) — pre-existing

Elasticsearch is **mocked**. Files: `audit.service.spec.ts` (14), `audit.controller.spec.ts` (5), `audit-write.interceptor.spec.ts` (6), `forbidden.filter.spec.ts` (4).

**Purpose:**

- Write audit entries without crashing the API if ES is down.
- Search with filters (outcome, dates, text query).
- RegionalHR only sees their region’s logs.
- Log successful POST/PATCH; redact passwords from body.
- On 403: log detail to ES but return generic message to client.

---

### Tier 1 limitations

Unit tests do **not**:

- Run SQL against real tables.
- Test full `GoalsService` / `TemplatesService` workflows end-to-end.
- Test HTTP routes (`POST /api/...`) or the frontend.

Those gaps are addressed by **Tier 2** (and eventually E2E).

---

## Tier 2 — Integration tests

### What Tier 2 is

**Integration tests** call real **NestJS services** (`AuthService`, `GoalsService`, etc.) against a real **PostgreSQL** database:

1. Each test starts with an empty DB (`truncateAll()`).
2. Test helpers **seed** regions, users, cycles, goals, etc. (`backend/test/helpers/seed.ts`).
3. The service runs real Prisma queries — same code path as production.
4. Assertions check return values and DB state.

This catches bugs that unit tests miss: wrong foreign keys, region checks that depend on joined data, and workflow rules that only appear when reading/writing rows.

### How Tier 2 runs

| Setting | Value |
|---------|--------|
| Command | `npm run test:integration` |
| Jest pattern | `backend/test/integration/**/*.integration.spec.ts` |
| Count | **20 tests**, **5 suites** |
| Database | **Required** — `TEST_DATABASE_URL` |
| Parallelism | **`--runInBand`** (serial) — one DB shared; avoids truncate races |
| CI | Postgres 16 service + `prisma migrate deploy` |

**Infrastructure files:**

| File | Role |
|------|------|
| `test/helpers/db.ts` | Prisma client + `truncateAll()` + `connectTestDb()` |
| `test/helpers/seed.ts` | Factories: `createUser`, `createCycle`, `createGoal`, … |
| `test/helpers/integration-setup.ts` | `createGoalsService()`, etc.; audit `log` mocked |
| `backend/.env.test.example` | Local Postgres connection example |

**Important:** Integration tests use a **dedicated test database**. Never point `TEST_DATABASE_URL` at production or shared Neon unless you use an isolated branch.

### What Tier 2 protects (summary)

| Module | Service | Business rules verified with real DB |
|--------|---------|--------------------------------------|
| Auth | `AuthService` | Password verify, session create, expiry |
| Goals | `GoalsService` | Create, region/cycle linkage, ownership, approval |
| Templates | `TemplatesService` | Region on create, publish, overlap detection |
| Reviews | `ReviewsService` | Grade required, supervisor submit, RBAC |
| Cycles | `CyclesService` | Cannot advance without template; creates review rows |

---

### Tier 2 test catalog (detailed)

#### `auth.integration.spec.ts` (5 tests) → `modules/auth/auth.service.ts`

**Why Tier 2 is needed:** Tier 1 only tests `AuthGuard` with mocked Prisma. Login must hash passwords, insert `Session` rows, and reload user relations — that requires a real database.

| Test | Scenario | What it verifies | Expected |
|------|----------|------------------|----------|
| Login succeeds | Valid `employeeId` + password `test1234` (seed default) | `bcrypt.compare`, session insert, user payload | `sessionId` + user with region name |
| Wrong password | Valid user, bad password | Reject before session | `UnauthorizedException` |
| Unknown user | Non-existent `employeeId` | No user leak | `UnauthorizedException` |
| getMe valid | After login | Session → user load | Correct `employeeId` |
| getMe expired | Session `expiresAt` in past | Expiry enforcement | `UnauthorizedException` |

---

#### `goals.integration.spec.ts` (6 tests) → `modules/goals/goals.service.ts`

**Why Tier 2 is needed:** Goals tie together `userId`, `cycleId`, `regionId`, status transitions, and supervisor hierarchy. Unit tests only cover `isGlobalRole()` indirectly.

| Test | Scenario | What it verifies | Expected |
|------|----------|------------------|----------|
| Employee creates goal | `createGoal` with SMART fields | Row created for owner | `status = Draft` |
| Cross-region cycle | TW employee, US cycle | `cycle.regionId !== user.regionId` | `ForbiddenException` |
| Completed cycle | Link goal to `Completed` cycle | Active cycles only | `BadRequestException` |
| Owner vs other | Owner updates; peer updates | `assertOwner` | Owner OK; other `ForbiddenException` |
| Supervisor approves | Goal `PendingApproval`, supervisor is lead | `approveGoal` + `assertCanRead` | `status = Approved` |
| Employee submits | Draft goal | `submitGoal` | `status = PendingApproval` |

---

#### `templates.integration.spec.ts` (4 tests) → `modules/templates/templates.service.ts`

**Why Tier 2 is needed:** Template creation ties to cycle region; publish runs conflict queries against other published templates in the same cycle/region.

| Test | Scenario | What it verifies | Expected |
|------|----------|------------------|----------|
| HR creates template | RegionalHR + cycle in same region | `regionId` from cycle | Template + questions created |
| Cross-region cycle | TW HR, US cycle | Region guard on create | `ForbiddenException` |
| Publish success | Draft template, no conflict | Status update | `Published` |
| Publish overlap | Second template overlaps grades/titles | `findMany` conflict check | `BadRequestException` |

---

#### `reviews.integration.spec.ts` (3 tests) → `modules/reviews/reviews.service.ts`

**Why Tier 2 is needed:** Supervisor submit combines DB state (grade column, answers JSON), reviewer identity (`supervisorId` / manager), and validation — not fully testable without persisted reviews.

| Test | Scenario | What it verifies | Expected |
|------|----------|------------------|----------|
| Submit without grade | Answers present, `grade = null` | Business rule before status change | `BadRequestException` (請先選擇等第) |
| Submit with grade | `saveSupervisorReview` then submit | Full happy path | `PendingManagerApproval` |
| Employee submits | Employee calls `submitSupervisor` | Reviewer check | `ForbiddenException` |

---

#### `cycles.integration.spec.ts` (2 tests) → `modules/cycles/cycles.service.ts`

**Why Tier 2 is needed:** Advancing a cycle can create many `PerformanceReview` rows and enforces “published template exists” using real employees and templates.

| Test | Scenario | What it verifies | Expected |
|------|----------|------------------|----------|
| Advance blocked | `InProgress`, no published template | Gate before `EmployeeReview` | `BadRequestException` |
| Advance success | Published template + employee matching grades/titles | Status change + `createMany` reviews | `EmployeeReview` + ≥1 review row |

---

### Tier 2 limitations

Still **not** covered (see `TEST_PLAN.md` for full matrix):

- `UsersService`, `AppealsService`, full Goals/Templates edge cases
- HTTP layer (Supertest) — cookies, status codes on routes
- Frontend / Playwright E2E
- Elasticsearch in integration runs (audit `log` is mocked in setup)

---

## Tier 1 vs Tier 2 comparison

| Question | Tier 1 (unit) | Tier 2 (integration) |
|----------|-----------------|----------------------|
| **What fails the build?** | Wrong guard logic, bad validation math | Broken SQL workflows, wrong region in DB |
| **Speed** | Fast | Slower (~6s serial, 20 tests) |
| **CI cost** | Low | Postgres service container |
| **Flakiness** | Very low | Low if `--runInBand` |
| **Auth** | Guard only | Login + session in DB |
| **Goals** | — | Create, approve, region rules |
| **Reviews** | Answer format only | Grade required on submit |

**Rule of thumb:** If the bug needs **reading or writing multiple tables**, add or extend a **Tier 2** test. If the bug is **pure logic** or **mockable I/O**, use **Tier 1**.

---

## What is still not automated

| Layer | Status | Examples |
|-------|--------|----------|
| More integration cases | Planned | Users, Appeals, remaining `TEST_PLAN.md` rows |
| HTTP API tests | Planned | `POST /api/auth/login`, 401 without cookie |
| E2E (Tier 3) | Not started | Playwright: login → goal → review |
| Frontend unit tests | Not started | React components, hooks |
| Coverage % gate in CI | Not enforced | Optional `test:cov` threshold |

---

## Run tests locally

### Tier 1 only (no database)

```bash
cd backend
npm run test:unit

# Optional: coverage report
npm run test:cov
```

### Tier 2 (Postgres required)

```bash
# 1. Start Postgres (see backend/.env.test.example)
docker run -d --name pms-test-db -p 5433:5432 \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=pms_test \
  postgres:16

# 2. Migrate and test
cd backend
export TEST_DATABASE_URL="postgresql://test:test@localhost:5433/pms_test?schema=public"
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL"
npx prisma migrate deploy
npm run test:integration
```

### Tier 1 + Tier 2

```bash
cd backend && npm run test:all
```

### Match full backend CI locally

```bash
cd backend
npm ci
DATABASE_URL="postgresql://ci:ci@localhost:5432/ci" DIRECT_URL="postgresql://ci:ci@localhost:5432/ci" \
  npx prisma validate && npx prisma generate
npm run lint && npm run type-check && npm run build && npm run test:unit

# Integration (with test Postgres on 5433)
TEST_DATABASE_URL="postgresql://test:test@localhost:5433/pms_test?schema=public" \
  DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" \
  npx prisma migrate deploy && npm run test:integration
```

---

## Related documents

| Document | Contents |
|----------|----------|
| `TEST_PLAN.md` | Full integration test case matrix (many not implemented yet) |
| `TESTING_PLAN.md` | Overall strategy including future E2E |
| `TEST_GUIDE.md` | Manual QA steps |
| `.github/workflows/ci.yml` | CI workflow definition |
| `backend/.env.test.example` | Test database env template |
