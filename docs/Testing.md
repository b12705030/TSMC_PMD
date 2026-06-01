# PMS Testing Guide

This document describes the automated tests currently present in the TSMC Performance Management System repo, how to run them locally, and which checks are expected to run in CI.

Last verified on 2026-06-02.

## Current Test Inventory

| Layer | Command | Suites / files | Tests | Requires DB? | CI status |
| --- | --- | ---: | ---: | --- | --- |
| Backend unit | `cd backend && npm run test:unit` | 29 suites | 201 | No | Yes |
| Backend integration | `cd backend && npm run test:integration` | 5 suites | 20 | Yes, PostgreSQL | Yes |
| Backend unit + integration | `cd backend && npm run test:all` | 34 suites | 221 | Integration only | Yes, split by job |
| E2E smoke | `cd e2e && npm test` | 3 files | 10 | Full app stack | Local only |
| Frontend checks | `cd frontend && npm run lint && npm run type-check && npm run build` | N/A | N/A | No | Yes |

Run `npm run test:cov` from `backend/` to generate current coverage. Coverage percentages are intentionally not hard-coded here because they change whenever tests or measured source files change.

## Test Pyramid

The repo uses a three-layer test strategy:

| Tier | Purpose | Examples |
| --- | --- | --- |
| Tier 1: Unit tests | Fast checks with mocked Prisma or external dependencies. These protect service logic, controller wiring, guards, utilities, scheduler behavior, and audit behavior. | `backend/src/**/*.spec.ts` |
| Tier 2: Integration tests | Real Nest services against a real PostgreSQL test database. These protect cross-table workflows, RBAC, region isolation, and status transitions. | `backend/test/integration/**/*.integration.spec.ts` |
| Tier 3: E2E smoke tests | Playwright tests against a running frontend/backend stack. These protect critical browser flows such as login, RBAC UI, and goal approval. | `e2e/tests/*.spec.ts` |

E2E tests are implemented locally, but they are not wired into CI yet.

## Backend Unit Tests

Run:

```bash
cd backend
npm run test:unit
```

Coverage:

```bash
cd backend
npm run test:cov
```

### Unit Test Catalog

| File | Tests | Covers |
| --- | ---: | --- |
| `src/app.module.spec.ts` | 1 | App module imports, health controller, and global provider wiring |
| `src/health.controller.spec.ts` | 1 | Health endpoint return shape |
| `src/common/guards/auth.guard.spec.ts` | 5 | Session cookie auth guard behavior |
| `src/common/guards/roles.guard.spec.ts` | 3 | Role metadata access checks |
| `src/common/utils/region.util.spec.ts` | 3 | Global role detection |
| `src/modules/audit/audit-write.interceptor.spec.ts` | 6 | Audit interceptor success/failure logging behavior |
| `src/modules/audit/audit.controller.spec.ts` | 5 | Audit controller filtering and delegation |
| `src/modules/audit/audit.service.spec.ts` | 8 | Audit persistence/search behavior with mocked dependencies |
| `src/modules/audit/forbidden.filter.spec.ts` | 4 | Forbidden response handling and audit logging |
| `src/modules/auth/auth.controller.spec.ts` | 7 | Login/logout/me controller wiring, session cookie set/clear |
| `src/modules/auth/auth.service.spec.ts` | 5 | Login, invalid credentials, sessions, logout audit |
| `src/modules/config/config.controller.spec.ts` | 3 | Config controller delegation |
| `src/modules/config/config.service.spec.ts` | 7 | Region config reads/updates and RBAC |
| `src/modules/users/users.controller.spec.ts` | 5 | Users controller delegation and query parsing |
| `src/modules/users/users.service.spec.ts` | 23 | User listing, hierarchy, metadata, create/update rules |
| `src/modules/goals/goals.controller.spec.ts` | 4 | Goal controller delegation and milestone normalization |
| `src/modules/goals/goals.service.spec.ts` | 21 | Goal creation, approval, team access, milestones, deletes |
| `src/modules/cycles/cycles.controller.spec.ts` | 3 | Cycle controller reads, writes, status actions |
| `src/modules/cycles/cycles.service.spec.ts` | 19 | Cycle RBAC, date validation, advance gates, review row creation, confirm/postpone |
| `src/modules/cycles/cycles.scheduler.spec.ts` | 4 | Auto-advance and reminder scheduler behavior |
| `src/modules/reviews/review-answers.util.spec.ts` | 8 | Required answers, rating/option/text validation |
| `src/modules/reviews/reviews.controller.spec.ts` | 4 | Review controller delegation |
| `src/modules/reviews/reviews.service.spec.ts` | 17 | Review scopes, submit flows, calibration, publish, stats |
| `src/modules/templates/templates.controller.spec.ts` | 4 | Template controller delegation |
| `src/modules/templates/templates.service.spec.ts` | 11 | Template creation, custom questions, publish conflicts, global lock |
| `src/modules/appeals/appeals.controller.spec.ts` | 4 | Appeal controller delegation |
| `src/modules/appeals/appeals.service.spec.ts` | 8 | Appeal creation, access scopes, responses, resolved states |
| `src/modules/notifications/notifications.controller.spec.ts` | 4 | Notification controller delegation |
| `src/modules/notifications/notifications.service.spec.ts` | 4 | Notification listing, read state, deduped recipients |

## Backend Integration Tests

Integration tests require a disposable PostgreSQL database configured through `TEST_DATABASE_URL`.

Run:

```bash
cd backend
npm run test:integration
```

### Local Setup Example

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

PowerShell:

```powershell
$env:TEST_DATABASE_URL = "postgresql://test:test@localhost:5433/pms_test?schema=public"
$env:DATABASE_URL = $env:TEST_DATABASE_URL
$env:DIRECT_URL = $env:TEST_DATABASE_URL
npx prisma migrate deploy
npm run test:integration
```

### Integration Test Catalog

| File | Tests | Covers |
| --- | ---: | --- |
| `test/integration/auth.integration.spec.ts` | 5 | Real login/session workflows |
| `test/integration/goals.integration.spec.ts` | 6 | Goal creation, region/cycle checks, ownership, approval |
| `test/integration/templates.integration.spec.ts` | 4 | Template creation, region checks, publish conflicts |
| `test/integration/reviews.integration.spec.ts` | 3 | Supervisor submit, required grade, RBAC |
| `test/integration/cycles.integration.spec.ts` | 2 | Cycle advance gates and review row creation |

Integration tests truncate and reseed the test database between cases. Never point `TEST_DATABASE_URL` at production or a shared database.

## E2E Tests

E2E tests live under `e2e/` and use Playwright. They require the frontend, backend, and database to be running with seeded data.

Run:

```bash
docker compose up --build -d
docker exec tsmc-backend npx prisma migrate deploy
docker exec tsmc-backend npx prisma db seed

cd e2e
npm install
npx playwright install chromium
npm test
```

Useful commands:

```bash
cd e2e
npm run test:headed
npm run test:ui
npm run report
```

### E2E Test Catalog

| File | Tests | Covers | Accounts |
| --- | ---: | --- | --- |
| `e2e/tests/auth.spec.ts` | 6 | Login, logout, invalid credentials, unauthenticated redirect, `sessionId` set/clear, missing-session redirect | `tw-emp001` |
| `e2e/tests/rbac.spec.ts` | 2 | Employee cannot create cycles; RegionalHR can create cycles | `tw-emp001`, `tw-hr001` |
| `e2e/tests/goals.spec.ts` | 2 | Employee creates/submits a goal; supervisor approves it | `tw-emp001`, `tw-sup001` |

Stable selectors use `data-testid`, including:

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

E2E is not currently part of CI because it needs a full app stack and browser runtime.

## Frontend Checks

The frontend currently has no Jest, Vitest, React Testing Library, or component-test setup. CI and local verification use:

```bash
cd frontend
npm run lint
npm run type-check
npm run build
```

Frontend behavior coverage currently comes from Playwright E2E smoke tests.

## CI/CD

CI is expected to run three categories of checks:

| Job | Checks |
| --- | --- |
| Frontend | Install, lint, type-check, build |
| Backend unit | Install, Prisma validate/generate, lint, type-check, build, unit tests |
| Backend integration | PostgreSQL service, migrations, integration tests |

E2E is intentionally local-only for now.

## Suggested Future Coverage

High-value next additions:

| Area | Suggested tests |
| --- | --- |
| HTTP route integration | Supertest coverage for auth cookies, current user, and 403/401 behavior |
| Appeals integration | Real DB appeal create/respond/resolution flows |
| Users integration | Region isolation and hierarchy queries with real relationships |
| E2E review flow | Employee self-review, supervisor review, manager publish |
| E2E HR flow | RegionalHR creates a cycle, creates a template, publishes it |
| Frontend component tests | Add only if hooks/components become complex enough to justify a test runner |

## Recent Verification Commands

These commands were used to verify the current inventory:

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

Latest observed results:

- Backend type-check passed.
- Backend unit tests passed: 29 suites, 201 tests.
- Backend coverage can be regenerated with `npm run test:cov`.
- Frontend type-check and lint passed.
- Playwright listed 10 tests across 3 files.
