# PMS Testing & CI/CD Guide

This document is the single reference for how the **TSMC Performance Management System (PMS)** is tested and verified in continuous integration. It explains what kinds of tests exist in this repository, which ones run automatically on every pull request, why we chose that structure, and how to run the same checks on your machine.

If you are new to the project, read the [testing philosophy](#testing-philosophy-and-the-test-pyramid) first, then [what is implemented today](#what-is-implemented-today), then [CI/CD pipelines](#cicd-pipelines) to see how GitHub Actions enforces quality before merge.

---

## Table of contents

1. [Why we test this way](#why-we-test-this-way)
2. [Testing philosophy and the test pyramid](#testing-philosophy-and-the-test-pyramid)
3. [What is implemented today](#what-is-implemented-today)
4. [Unit tests (Tier 1)](#unit-tests-tier-1)
5. [Integration tests (Tier 2)](#integration-tests-tier-2)
6. [End-to-end tests (Tier 3)](#end-to-end-tests-tier-3)
7. [CI/CD pipelines](#cicd-pipelines)
8. [Planned coverage and roadmap](#planned-coverage-and-roadmap)
9. [Manual and exploratory testing](#manual-and-exploratory-testing)
10. [Run tests locally](#run-tests-locally)
11. [Related files](#related-files)

---

## Why we test this way

PMS is not a simple CRUD app. It coordinates **authentication**, **role-based access control (RBAC)**, **multi-region data isolation**, and long-running workflows for **goals**, **performance reviews**, **cycles**, and **form templates**. A mistake in any of these layers can mean the wrong person sees another region’s data, a review is submitted without a required grade, or a cycle advances before templates are ready—failures that are hard to catch by clicking through the UI once.

Automated tests exist to catch those regressions **before** they reach `dev` or production. We deliberately use a **test pyramid**: many fast, isolated unit tests at the base; fewer integration tests that exercise real database workflows; and (in the future) a small set of browser end-to-end tests for critical user journeys. That balance keeps pull-request feedback fast while still validating the rules that only appear when Prisma reads and writes real rows.

---

## Testing philosophy and the test pyramid

The pyramid below shows how responsibility is split across test types. Higher layers are slower and more expensive; lower layers run on every change.

```
                    ┌─────────────┐
                    │  Tier 3 E2E │  ← Not in CI yet (Playwright, planned)
                    └─────────────┘
               ┌────────────────────────┐
               │ Tier 2 Integration     │  ← 20 tests, real PostgreSQL
               │ (service + database)   │
               └────────────────────────┘
          ┌────────────────────────────────────┐
          │ Tier 1 Unit                        │  ← 40 tests, no DB / mocked I/O
          │ (guards, utils, audit, validation) │
          └────────────────────────────────────┘
```

**Unit tests** answer: “Is this piece of logic correct when dependencies are controlled?” They mock Prisma, Elasticsearch, and HTTP so failures point to a specific function or guard.

**Integration tests** answer: “When the real NestJS service runs SQL against Postgres, do region rules, foreign keys, and status transitions still hold?” They use the same service classes as production, with test helpers seeding users and cycles.

**End-to-end (E2E) tests** (not implemented yet) will answer: “Can a real user complete login → goal → review in the browser?” They are the slowest layer and are reserved for a small smoke suite, not a duplicate of every service scenario.

**Rule of thumb:** If the bug requires **reading or writing multiple tables** or depends on **seeded relationships** (supervisor hierarchy, cycle region), add or extend an **integration** test. If the bug is **pure logic**, **validation**, or **guard behavior** with mockable dependencies, use a **unit** test.

---

## What is implemented today

| Layer | Command | Suites | Tests | Database | Runs in CI? |
|-------|---------|--------|-------|----------|-------------|
| **Unit (Tier 1)** | `npm run test:unit` | 8 | **40** | No | Yes — backend job |
| **Integration (Tier 2)** | `npm run test:integration` | 5 | **20** | Yes (Postgres 16) | Yes — integration job |
| **Both** | `npm run test:all` | 13 | **60** | Tier 2 only | Both jobs in parallel |
| **E2E (Tier 3)** | `cd e2e && npm test` | 3 | **8** | App + browser (local) | **No** (see [E2E section](#end-to-end-tests-tier-3)) |
| **Frontend automated** | — | — | — | — | **No** (lint, type-check, build only) |

**Backend tools:** Jest, `@nestjs/testing`, Prisma test client under `backend/test/helpers/`.

**Frontend:** CI verifies that the Next.js app **lints**, **type-checks**, and **builds**. There are no Jest or Playwright tests in the pipeline yet.

---

## Unit tests (Tier 1)

### What unit tests are

Unit tests exercise **small, focused units** of the backend in isolation: guards, pure utility functions, review-answer validation, and the audit module with a mocked Elasticsearch client. They do not connect to PostgreSQL or Neon. That makes them **fast** (on the order of ten seconds for the full suite) and **stable**, which is why they run on every pull request together with lint, type-check, and build.

Unit tests are the first line of defense for **security-sensitive primitives**: session cookies, role metadata on routes, and `isGlobalRole()` used throughout services to decide whether to filter by `regionId`.

### How they run

| Setting | Value |
|---------|--------|
| Command | `npm run test:unit` |
| Jest pattern | `backend/src/**/*.spec.ts` |
| Count | **40 tests**, **8 suites** |
| Database | Not used |
| Elasticsearch | Mocked in audit specs |

Optional coverage: `npm run test:cov` (unit paths only by default).

### What Tier 1 protects

| Area | Production code | Why it matters |
|------|-----------------|----------------|
| Session gate | `AuthGuard` | Blocks unauthenticated API access |
| Role gate | `RolesGuard` | Enforces `@Roles()` on endpoints |
| Region scope | `isGlobalRole()` | Admin/GlobalHR vs regional isolation |
| Review forms | `validateReviewAnswers()` | Valid ratings, options, required fields |
| Audit | `AuditService`, interceptor, filter, controller | Logging must not break API or leak secrets |

### Unit test catalog

#### `auth.guard.spec.ts` (4 tests) → `common/guards/auth.guard.ts`

Every protected route depends on reading the `sessionId` cookie, loading the session from the database, and attaching `request.user`. These tests mock `PrismaService`.

| Test | Checks | If it broke |
|------|--------|-------------|
| Missing cookie | `UnauthorizedException` | APIs open without login |
| Session not in DB | 401 | Invalid cookies still work |
| Expired session | 401 | Sessions never expire |
| Valid session | `request.user` populated | Wrong/missing user in handlers |

#### `roles.guard.spec.ts` (3 tests) → `common/guards/roles.guard.ts`

After authentication, `@Roles()` metadata restricts which roles can call each endpoint. `Reflector` is mocked.

| Test | Checks | If it broke |
|------|--------|-------------|
| No roles required | Access allowed | False 403s |
| Role in list | Access allowed | Legitimate users blocked |
| Role not in list | `ForbiddenException` | Privilege escalation |

#### `region.util.spec.ts` (3 tests) → `common/utils/region.util.ts`

`isGlobalRole()` is used in many services to skip `regionId` filtering for Admin and GlobalHR only.

| Test | Checks | If it broke |
|------|--------|-------------|
| Admin | `true` | Admin locked to one region |
| GlobalHR | `true` | Cannot see all regions |
| RegionalHR, Manager, Supervisor, Employee | `false` | Cross-region data leaks |

#### `review-answers.util.spec.ts` (6 tests) → `modules/reviews/review-answers.util.ts`

Validates employee/supervisor answers before submit (shared with `ReviewsService`). Uses in-memory question fixtures. Does **not** test “grade required on submit”—that is Tier 2.

| Test | Checks | If it broke |
|------|--------|-------------|
| Valid answers | Pass | Good submits rejected |
| Bad rating | `BadRequestException` | Invalid scores saved |
| Bad MC option | `BadRequestException` | Invalid choices saved |
| Text too long | `BadRequestException` | Oversized payloads |
| Missing required | `BadRequestException` | Incomplete reviews submitted |
| Optional omitted | Pass | Optional fields block submit |

#### Audit module (24 tests) — `audit.service`, controller, interceptor, filter

Elasticsearch is fully mocked.

- Writes audit entries without crashing the API if ES is down.
- Search with filters (outcome, dates, text query).
- RegionalHR only sees their region’s logs.
- Logs successful POST/PATCH; redacts passwords from body.
- On 403: logs detail to ES but returns a generic message to the client.

After merging `dev`, audit persistence also uses Prisma `AuditLog` in production; unit tests still mock external I/O so CI does not require Elasticsearch.

### What unit tests deliberately skip

Unit tests do **not** run SQL, instantiate full `GoalsService` / `TemplatesService` workflows with real relations, or hit HTTP routes (`POST /api/...`). Those gaps are intentional: service behavior tied to Prisma and RBAC is covered in **integration** tests instead of heavy per-service unit mocks.

---

## Integration tests (Tier 2)

### What integration tests are

Integration tests call **real NestJS services** (`AuthService`, `GoalsService`, `TemplatesService`, `ReviewsService`, `CyclesService`) against a **real PostgreSQL** database. Each test:

1. Truncates all application tables (`truncateAll()` in `backend/test/helpers/db.ts`).
2. Seeds regions, users, cycles, and related data via `backend/test/helpers/seed.ts`.
3. Invokes the service method the API would eventually call.
4. Asserts on return values and, where relevant, database state.

This catches bugs unit tests miss: wrong foreign keys, region checks that depend on joined data, supervisor hierarchy, and workflow gates that only appear when rows exist.

### How they run

| Setting | Value |
|---------|--------|
| Command | `npm run test:integration` |
| Jest pattern | `backend/test/integration/**/*.integration.spec.ts` |
| Count | **20 tests**, **5 suites** |
| Database | **Required** — `TEST_DATABASE_URL` |
| Parallelism | `--runInBand` (serial) — one shared DB; avoids truncate races |
| Timeout | 30s per test |

**Infrastructure:**

| File | Role |
|------|------|
| `test/helpers/db.ts` | Prisma client, `truncateAll()`, `connectTestDb()` |
| `test/helpers/seed.ts` | Factories: `createUser`, `createCycle`, `createGoal`, … |
| `test/helpers/integration-setup.ts` | Service factories; **audit `log` mocked**; real `NotificationsService` wired for goals/reviews/cycles |
| `backend/.env.test.example` | Example connection string for local Postgres |

**Safety:** Always use a **dedicated test database**. Never point `TEST_DATABASE_URL` at production or a shared Neon branch unless it is isolated and disposable.

### What Tier 2 protects

| Module | Service | Business rules verified with real DB |
|--------|---------|--------------------------------------|
| Auth | `AuthService` | Password verify, session create, expiry |
| Goals | `GoalsService` | Create, region/cycle linkage, ownership, approval |
| Templates | `TemplatesService` | Region on create, publish, overlap detection |
| Reviews | `ReviewsService` | Grade required, supervisor submit, RBAC |
| Cycles | `CyclesService` | Cannot advance without template; creates review rows |

### Integration test catalog

#### `auth.integration.spec.ts` (5 tests)

Tier 1 only tests `AuthGuard` with mocked Prisma. Login must hash passwords, insert `Session` rows, and reload user relations.

| Test | Scenario | Expected |
|------|----------|----------|
| Login succeeds | Valid `employeeId` + password `test1234` | `sessionId` + user with region |
| Wrong password | Valid user, bad password | `UnauthorizedException` |
| Unknown user | Non-existent `employeeId` | `UnauthorizedException` |
| getMe valid | After login | Correct `employeeId` |
| getMe expired | Session `expiresAt` in past | `UnauthorizedException` |

#### `goals.integration.spec.ts` (6 tests)

Goals tie together `userId`, `cycleId`, `regionId`, status transitions, and supervisor hierarchy.

| Test | Scenario | Expected |
|------|----------|----------|
| Employee creates goal | SMART fields | `status = Draft` |
| Cross-region cycle | TW employee, US cycle | `ForbiddenException` |
| Completed cycle | Link to `Completed` cycle | `BadRequestException` |
| Owner vs other | Owner updates; peer updates | Owner OK; other `ForbiddenException` |
| Supervisor approves | `PendingApproval` | `status = Approved` |
| Employee submits | Draft goal | `status = PendingApproval` |

#### `templates.integration.spec.ts` (4 tests)

Template creation ties to cycle region; publish runs conflict queries against other published templates.

| Test | Scenario | Expected |
|------|----------|----------|
| HR creates template | RegionalHR + same-region cycle | Template + questions created |
| Cross-region cycle | TW HR, US cycle | `ForbiddenException` |
| Publish success | Draft, no conflict | `Published` |
| Publish overlap | Second template overlaps grades/titles | `BadRequestException` |

#### `reviews.integration.spec.ts` (3 tests)

Supervisor submit combines DB state (grade, answers JSON), reviewer identity, and validation.

| Test | Scenario | Expected |
|------|----------|----------|
| Submit without grade | Answers present, `grade = null` | `BadRequestException` (請先選擇等第) |
| Submit with grade | Save then submit | `PendingManagerApproval` |
| Employee submits | Employee calls supervisor submit | `ForbiddenException` |

#### `cycles.integration.spec.ts` (2 tests)

Advancing a cycle can create many `PerformanceReview` rows and enforces a published template.

| Test | Scenario | Expected |
|------|----------|----------|
| Advance blocked | `InProgress`, no published template | `BadRequestException` |
| Advance success | Published template + matching employee | `EmployeeReview` + ≥1 review row |

### What integration tests do not cover yet

Integration tests do **not** currently exercise `UsersService`, `AppealsService`, HTTP routes via Supertest, the frontend, Elasticsearch writes, or the cycle scheduler. Notifications are constructed with a real `NotificationsService` against the test DB (side effect: notification rows may be created during some flows); audit writes remain mocked in setup.

---

## End-to-end tests (Tier 3)

### Status: implemented locally (not in CI)

E2E tests live in the [`e2e/`](../e2e/) directory and use **Playwright** against a **running** frontend and backend (typically `docker compose up` with seeded data). They complement Tier 1 and Tier 2 by verifying cookies, routing, and role-based UI—not service logic in isolation.

| Setting | Value |
|---------|--------|
| Command | `cd e2e && npm install && npx playwright install chromium && npm test` |
| Base URL | `http://localhost:3000` (`PLAYWRIGHT_BASE_URL` to override) |
| Locale | `zh-TW` (default app locale) |
| Count | **8 tests**, **3 files** |
| CI | **Not wired** — see [e2e/README.md](../e2e/README.md) |

**Prerequisites:** Stack up, migrations applied, `prisma db seed` (password `test1234` for seed accounts). See [e2e/README.md](../e2e/README.md) for step-by-step commands.

### Implemented smoke suite

| File | Scenario | Account(s) |
|------|----------|--------------|
| `e2e/tests/auth.spec.ts` | Login → dashboard → logout; invalid password; unauthenticated redirect; `sessionId` cookie | `tw-emp001` |
| `e2e/tests/rbac.spec.ts` | Employee does not see「+ 新增週期」; RegionalHR does | `tw-emp001`, `tw-hr001` |
| `e2e/tests/goals.spec.ts` | Create goal + submit for approval; supervisor approves on goal detail | `tw-emp001`, `tw-sup001` |

Stable selectors use `data-testid` on login, logout, goal forms, and cycle admin actions (`login-employee-id`, `sidebar-logout`, `goal-new-title`, `cycles-add`, etc.).

### Still planned for E2E (not written yet)

| ID | Flow | Roles |
|----|------|-------|
| E2E-04 | RegionalHR creates cycle + template → publishes | RegionalHR |
| E2E-06 | Self-review → supervisor review (seeded cycle) | Employee + Supervisor |
| E2E-07 | Manager publishes calibration → employee sees grade | Manager + Employee |

**CI placement (future):** optional fourth GitHub Actions job after the suite is stable in Docker CI (longer runtime, health waits). Not required for merge gates today.

### What E2E should not try to do

Do not replicate every integration test row, full i18n, dashboard charts, or Elasticsearch failure modes. MFA/SSO are out of scope.

---

## CI/CD pipelines

Automated quality gates live in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). The workflow is named **CI** and is the enforcement mechanism for Tier 1 and Tier 2 tests before code lands on shared branches.

### When CI runs

CI triggers on **push** and on **pull_request** when the target branch is `main`, `develop`, or **`dev`** (the team’s primary integration branch). Pushing a feature branch alone does **not** run CI until you open a pull request into one of those branches—or push directly to them.

All jobs use **`ubuntu-latest`** and **Node.js 20**. Independent jobs run **in parallel** so frontend checks and backend unit tests do not wait on Postgres, and integration tests do not block lint feedback on unrelated files.

### High-level flow

```
Push or PR to main / develop / dev
    │
    ├─► Job: Frontend — Lint, Type Check & Build
    │       checkout → npm ci → lint → type-check → build
    │       env: NEXT_PUBLIC_API_URL=http://localhost:4000
    │
    ├─► Job: Backend — Lint, Type Check, Build & Unit Tests
    │       checkout → npm ci → prisma validate & generate
    │       → lint → type-check → build → test:unit
    │       env: dummy DATABASE_URL / DIRECT_URL (no live DB)
    │
    └─► Job: Backend — Integration Tests
            Postgres 16 service container (health-checked)
            checkout → npm ci → prisma migrate deploy → test:integration
            env: real TEST_DATABASE_URL pointing at the service
```

A failing job blocks merge (subject to branch protection settings on GitHub). All three jobs must pass for a green PR check.

### Frontend job

The frontend job installs dependencies with **`npm ci`** (reproducible lockfile), then runs ESLint, TypeScript (`tsc --noEmit`), and **`next build`**. It does **not** run Jest or Playwright.

`NEXT_PUBLIC_API_URL` is set to `http://localhost:4000` in CI so Next.js can embed a valid API base URL at build time, matching local Docker defaults. Without this, production builds can fail when code references `process.env.NEXT_PUBLIC_API_URL`.

This job protects against broken imports, type errors in pages and hooks, and build-time configuration issues—common regressions when i18n messages or shared types change.

### Backend job (Tier 1 — unit tests and compile gate)

The backend job is the main **compile + fast test** gate. It sets **placeholder** `DATABASE_URL` and `DIRECT_URL` values (`postgresql://ci:ci@localhost:5432/ci`) because `schema.prisma` requires those variables to exist, but **no database server is started** for this job.

Steps, in order:

1. **`npm ci`** — install exact dependency versions from `package-lock.json`.
2. **`npx prisma validate && npx prisma generate`** — ensure the Prisma schema is valid and generate the client used by TypeScript. This does not connect to a real database; it only validates syntax and generates types.
3. **`npm run lint`** — ESLint on `src` and `test`.
4. **`npm run type-check`** — `tsc --noEmit` across the backend, including test helpers referenced by integration specs (so constructor signature drift, like a new `NotificationsService` dependency, fails here too).
5. **`npm run build`** — NestJS production build.
6. **`npm run test:unit`** — 40 unit tests, no Postgres.

If any step fails, the job fails. Type-check and unit tests together catch most logic and API-surface mistakes without the cost of a database container.

### Backend integration job (Tier 2 — Postgres)

The integration job proves that migrations apply cleanly and that service workflows work against a real database—closer to production than mocks.

GitHub Actions starts a **`postgres:16`** **service container** with user `test`, password `test`, database `pms_test`, exposed on port 5432. A health check (`pg_isready`) runs until Postgres accepts connections, avoiding flaky “connection refused” failures.

Environment variables set `TEST_DATABASE_URL`, `DATABASE_URL`, and `DIRECT_URL` to the same local service URL. Steps:

1. **`npm ci`**
2. **`npx prisma migrate deploy`** — applies all migrations to the empty test database, same as deployment.
3. **`npm run test:integration`** — 20 tests, serial (`--runInBand`).

This job **never** uses your Neon dev or production URLs. CI Postgres is ephemeral and destroyed when the job ends.

### Why Prisma steps differ between jobs

| Step | Backend (unit) job | Integration job |
|------|-------------------|-----------------|
| `prisma validate` | Yes | No (migrate implies valid schema) |
| `prisma generate` | Yes | Implicit via client in node_modules after install |
| `prisma migrate deploy` | No | Yes — requires live Postgres |

Tier 1 only needs generated types. Tier 2 needs the **actual schema** in Postgres because tests run real queries.

### What CI does not do today

- No Playwright or Cypress E2E job.
- No frontend unit tests.
- No enforced coverage percentage gate (`test:cov` is available locally but not required in CI).
- No deploy to GCP or Docker registry from this workflow (deploy is separate; see `GCP_GUIDE.md` if present).

### Verifying CI before merge

Open a pull request into `dev` and wait for all three checks. To reproduce locally, see [Run tests locally](#run-tests-locally).

---

## Planned coverage and roadmap

The tables below summarize **additional** scenarios worth automating. They are derived from earlier planning docs and prioritized by security and historical bug frequency. Many are **not implemented** yet; the “Implemented” column refers to Tier 2 integration coverage where noted.

### Priority P0 (highest value next)

| Module | Example scenarios not fully covered | Notes |
|--------|--------------------------------------|-------|
| **Goals** | Reject goal, milestones, Admin update any goal | Partial: create, approve, submit covered |
| **Templates** | Admin multi-region `regionId`, custom questions | Partial: HR create, publish overlap covered |
| **Reviews** | `publishAll`, calibrate, direct-report manager, `getTeamReviews` | Partial: grade on submit covered |
| **Cycles** | RegionalHR cannot advance multi-region cycle; `advanceConfirmed` | Partial: advance with/without template covered |
| **Users** | `getEmployee` hierarchy + region isolation | Not started |
| **Appeals** | Appeal only on published review; Manager resolve | Not started |

### Priority P1

| Module | Examples |
|--------|----------|
| **Audit** | Login writes audit row (Prisma) or ES document in integration |
| **Config** | Admin-only region config update |
| **HTTP layer** | Supertest: `POST /api/auth/login` + cookie, 401 without session, 403 for wrong role |

### E2E phases (when started)

| Phase | Deliverable |
|-------|-------------|
| 1 | Playwright setup + E2E-01–05 (login, goal, supervisor, HR cycle, permission) |
| 2 | E2E-06–07 (review flow, publish) + optional nightly CI job |

### Coverage guidelines (not enforced in CI)

| Area | Guideline |
|------|-----------|
| Service RBAC / workflow gates | Cover majority of P0 scenarios over time |
| Audit module | Strong unit coverage today |
| Frontend | E2E smoke first; component tests later if hooks grow complex |
| Backend line coverage | 60%+ on services as a soft target |

### What we intentionally do not automate (for now)

Full i18n across all locales, every dashboard visualization, Elasticsearch cluster disaster recovery beyond “audit fail silent,” and MFA/SSO.

---

## Manual and exploratory testing

Automated tests do not replace **exploratory QA** before releases. For manual checks, run the application locally (Docker Compose or separate `backend` / `frontend` dev servers), apply migrations and seed data, and use the test accounts documented in the project **README** (default password `test1234` unless seed changed).

Typical manual areas: full cycle stepper UX, calibration UI, appeals workflow, notifications and idle timeout, and cross-role navigation in the sidebar. Seed definitions live in `backend/prisma/seed.ts`; Swagger is available at `http://localhost:4000/api/docs` when the backend is running.

Manual testing is especially important for **frontend-only** changes and for flows that lack Tier 2 or E2E coverage yet (Users admin page, Appeals, deadline toasts).

---

## Run tests locally

### Tier 1 only (no database)

```bash
cd backend
npm run test:unit

# Optional coverage (unit paths)
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

### Match CI backend checks locally

```bash
cd backend
npm ci
DATABASE_URL="postgresql://ci:ci@localhost:5432/ci" DIRECT_URL="postgresql://ci:ci@localhost:5432/ci" \
  npx prisma validate && npx prisma generate
npm run lint && npm run type-check && npm run build && npm run test:unit

# Integration (with test Postgres, e.g. port 5433)
TEST_DATABASE_URL="postgresql://test:test@localhost:5433/pms_test?schema=public" \
  DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" \
  npx prisma migrate deploy && npm run test:integration
```

### Match CI frontend checks locally

```bash
cd frontend
export NEXT_PUBLIC_API_URL=http://localhost:4000
npm ci && npm run lint && npm run type-check && npm run build
```

### Running the full stack for manual or future E2E

```bash
docker compose up --build -d
docker exec tsmc-backend npx prisma migrate deploy
docker exec tsmc-backend npx prisma db seed   # first time or after seed changes
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend / Swagger | http://localhost:4000/api · http://localhost:4000/api/docs |

---

## Related files

| File | Purpose |
|------|---------|
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | CI workflow definition |
| [`backend/.env.test.example`](../backend/.env.test.example) | Test database environment template |
| [`backend/test/helpers/`](../backend/test/helpers/) | DB, seed, and service setup for integration tests |
| [`backend/package.json`](../backend/package.json) | `test:unit`, `test:integration`, `test:all` scripts |
| [`e2e/`](../e2e/) | Playwright E2E smoke tests (local / optional CI later) |
| [`e2e/README.md`](../e2e/README.md) | How to run E2E against Docker |

---

*Last updated: 2026-05-31*
