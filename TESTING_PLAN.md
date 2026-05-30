# PMS Testing Plan

> Practical test strategy for TSMC PMD — unit, integration, and E2E.  
> Complements the detailed backend case matrix in [TEST_PLAN.md](./TEST_PLAN.md) and manual steps in [TEST_GUIDE.md](./TEST_GUIDE.md).

---

## Goals

- Protect **RBAC**, **region isolation**, and **workflow gates** (the highest-risk areas).
- Keep CI fast: mostly backend tests; a small E2E smoke suite.
- Reuse existing tooling: Jest, `@nestjs/testing`, Prisma test helpers under `backend/test/helpers/`.

---

## Test pyramid

| Layer | Scope | Tools | When to run |
|-------|--------|-------|-------------|
| **Unit** | Pure logic, filters, guards with mocks | Jest | Every PR (CI) |
| **Integration** | Services + real DB; HTTP + auth | Jest + Prisma + Supertest | Every PR (CI, with test DB) |
| **E2E** | Critical user journeys in browser | Playwright (recommended) | PR optional; nightly or pre-release |

---

## Environment

### Running the app (Docker)

```bash
docker compose up --build -d
docker exec tsmc-backend npx prisma migrate deploy
docker exec tsmc-backend npx prisma db seed   # first time or after seed changes
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API / Swagger | http://localhost:4000/api · http://localhost:4000/api/docs |
| Elasticsearch | http://localhost:9200 |

Test accounts: README (password `test1234`).

### Automated tests

Create `backend/.env.test` (or export vars) — **never use production Neon for integration tests**:

```env
TEST_DATABASE_URL="postgresql://..."   # separate Neon branch or local Postgres
DATABASE_URL="${TEST_DATABASE_URL}"  # if tests read DATABASE_URL
```

```bash
cd backend
TEST_DATABASE_URL="..." npm test
TEST_DATABASE_URL="..." npm run test:cov
```

---

## 1. Unit tests

**Purpose:** Fast checks with no database. Mock Prisma, Elasticsearch, and HTTP.

### Already in place

- `audit.service.spec.ts` — ES client mocked
- `audit-write.interceptor.spec.ts`, `forbidden.filter.spec.ts`, `audit.controller.spec.ts`

### Add (small, high value)

| Target | Examples |
|--------|----------|
| `common/utils/region.util.ts` | `isGlobalRole`, region matching |
| `reviews.service.ts` — `validateAnswers` | Rating 1–5, MC options, text length (extract or test via public method) |
| `roles.guard.ts` + `auth.guard.ts` | Missing session → deny; wrong role → deny (mock execution context) |
| Pure DTO validation | class-validator on login/create DTOs (optional) |

**Skip heavy unit mocks** for Goals/Templates/Reviews services — behavior is tied to Prisma + RBAC; cover those in integration tests instead.

---

## 2. Integration tests

**Purpose:** Verify business rules and permissions against a **real** Postgres DB (not mocked Prisma).

Use `backend/test/helpers/seed.ts` + `db.ts` (`truncateAll` in `beforeEach` or `afterEach`).

### Priority modules (P0)

| Module | Essential scenarios |
|--------|---------------------|
| **Auth** | Valid login; bad password → 401; logout clears session |
| **Goals** | Create goal; link cycle (region + status); owner update; supervisor approve/reject; non-owner → 403 |
| **Templates** | RegionalHR region lock; Admin multi-region `regionId`; publish overlap conflict |
| **Reviews** | Answer validation; supervisor submit requires grade; direct-report manager path; calibrate forbidden for Employee |
| **Cycles** | `advanceStatus` gates (e.g. no published template); RegionalHR cannot advance multi-region cycle |
| **Users** | `getEmployee` hierarchy + region isolation |
| **Appeals** | Appeal only on published review; Manager resolve with/without grade change |

### Secondary (P1)

| Module | Essential scenarios |
|--------|---------------------|
| **Audit** | Login writes ES document (or mock ES in CI if ES unavailable) |
| **Config** | Admin-only update |

### HTTP layer (optional but useful)

One spec file `test/auth.e2e-spec.ts` (name is conventional; still integration):

- `POST /api/auth/login` → 200 + `Set-Cookie`
- Protected `GET /api/goals/mine` without cookie → 401
- Employee calling `POST /api/cycles` → 403

Framework: `@nestjs/testing` + `supertest` on `AppModule`.

### CI suggestion

```yaml
# .github/workflows/ci.yml — backend job
- name: Integration tests
  env:
    TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
  run: npm test
```

---

## 3. E2E tests

**Purpose:** A few **happy-path + permission** flows through UI + API. Not a full duplicate of [TEST_GUIDE.md](./TEST_GUIDE.md).

**Tool:** Playwright (`frontend/` or repo root `e2e/`).

**Base URL:** `http://localhost:3000`  
**API:** `http://localhost:4000` (for setup helpers if needed)

### Recommended smoke suite (5–7 tests)

| ID | Flow | Roles |
|----|------|-------|
| E2E-01 | Login → dashboard visible → logout | `tw-emp001` |
| E2E-02 | Employee creates goal → submits for approval | Employee |
| E2E-03 | Supervisor approves subordinate goal | Supervisor `tw-sup001` |
| E2E-04 | RegionalHR creates cycle + template → publishes | `tw-hr001` |
| E2E-05 | Employee blocked from cycle admin UI | Employee (no create button / 403 via API) |
| E2E-06 | Review cycle: employee self-review → supervisor review (use seeded cycle or API setup) | Employee + Supervisor |
| E2E-07 | Manager publishes calibration → employee sees grade | Manager + Employee |

### Prerequisites

- Docker stack up + seed data
- Stable `data-testid` on login form and primary actions (add incrementally)

### When to run

- Locally before release
- CI: optional job `e2e` on `develop` only (longer, flaky without Docker service wait)

---

## Implementation phases

| Phase | Deliverable | Effort |
|-------|-------------|--------|
| **1** | `TEST_DATABASE_URL` wired; Goals + Auth integration specs | ~2–3 days |
| **2** | Templates + Reviews + Cycles integration specs (P0 table) | ~3–4 days |
| **3** | Supertest auth/RBAC smoke; expand unit tests for guards/utils | ~1 day |
| **4** | Playwright: E2E-01–05 | ~2 days |
| **5** | Playwright: E2E-06–07 + CI optional job | ~2 days |

---

## Coverage targets (guideline)

| Area | Target |
|------|--------|
| Service RBAC / gates | ≥ 80% of P0 scenarios in TEST_PLAN.md |
| Audit module | Already covered |
| Frontend | E2E smoke only initially; component tests later if hooks grow complex |
| Overall line coverage | 60%+ backend services (not a hard gate at first) |

---

## What not to test (for now)

- Full i18n matrix across all locales
- Every dashboard chart variant
- Elasticsearch cluster failure recovery (beyond audit “fail silent” unit test)
- MFA / SSO (out of scope per TEST_GUIDE)

---

## Quick commands

```bash
# App
docker compose up -d

# Backend unit + integration
cd backend && TEST_DATABASE_URL="..." npm test

# Audit only
npm test -- --testPathPattern=audit

# Coverage
npm run test:cov

# E2E (after Playwright setup)
npx playwright test
```

---

*Last updated: 2026-05-25*
