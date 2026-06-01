# PMS End-to-End Tests (Playwright)

Browser smoke tests for critical flows: login, RBAC in the UI, and goal approval.

## Prerequisites

1. **Running stack** with seeded data (password `test1234` for test accounts):

   ```bash
   docker compose up --build -d
   docker exec tsmc-backend npx prisma migrate deploy
   docker exec tsmc-backend npx prisma db seed
   ```

2. Frontend reachable at `http://localhost:3000`, backend at `http://localhost:4000`.

## Install & run

```bash
cd e2e
npm install
npx playwright install chromium

# Run all tests (stack must already be up)
npm test

# Interactive UI mode
npm run test:ui

# View last HTML report
npm run report
```

Override base URL if needed:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm test
```

## Test files

| File | Covers |
|------|--------|
| `tests/auth.spec.ts` | Login, logout, invalid credentials, auth redirect, session cookie |
| `tests/rbac.spec.ts` | Employee vs HR cycle admin button |
| `tests/goals.spec.ts` | Create goal, submit for approval, supervisor approve |

## CI

E2E is **not** wired into GitHub Actions yet (requires Docker stack + longer runtime). See [docs/Testing.md](../docs/Testing.md).
