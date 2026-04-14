# Unleash Innovation — Performance Management System

A modern, centralized performance management system for a global enterprise with ~100,000 employees.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| Backend | Node.js + NestJS + TypeScript |
| Database | Supabase (PostgreSQL) |
| Audit Log | Elasticsearch |
| ORM | Prisma |
| CI/CD | GitHub Actions |

## Roles

| Role | employeeId | Password |
|------|-----------|----------|
| Admin | `admin001` | `test1234` |
| Regional HR | `hr001` | `test1234` |
| Manager | `mgr001` | `test1234` |
| Supervisor | `sup001` | `test1234` |
| Employee | `emp001` | `test1234` |

## Local Development

### Prerequisites
- Node.js 20+
- npm 10+

### Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd TSMC_PMD

# 2. Setup backend
cd backend
cp .env.example .env        # fill in Supabase + Elasticsearch credentials
npm install
npx prisma migrate dev      # run DB migrations
npx prisma db seed          # seed fake accounts
npm run start:dev

# 3. Setup frontend (new terminal)
cd frontend
cp .env.local.example .env.local   # fill in NEXT_PUBLIC_API_URL
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`  
Backend runs at `http://localhost:4000`  
Swagger API docs at `http://localhost:4000/api/docs`

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
