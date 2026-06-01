import { request } from '@playwright/test'

const BACKEND_URL  = process.env.BACKEND_HEALTH_URL  ?? 'http://localhost:4000/api/health'
const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL  ?? 'http://localhost:3000'
const TIMEOUT_MS   = 120_000
const INTERVAL_MS  = 3_000

async function waitFor(url: string, label: string) {
  const deadline = Date.now() + TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const ctx = await request.newContext()
      const res = await ctx.get(url)
      await ctx.dispose()
      if (res.ok()) { console.log(`✓ ${label} ready`); return }
    } catch { /* still starting */ }
    await new Promise((r) => setTimeout(r, INTERVAL_MS))
  }
  throw new Error(`${label} did not become ready within ${TIMEOUT_MS / 1000}s`)
}

export default async function globalSetup() {
  await waitFor(BACKEND_URL,  'Backend')
  await waitFor(FRONTEND_URL, 'Frontend')
}
