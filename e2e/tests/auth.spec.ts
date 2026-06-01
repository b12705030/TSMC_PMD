import { test, expect } from '@playwright/test'
import { login, logout, loginPath, DEFAULT_PASSWORD } from '../fixtures/auth'

test.describe('Authentication', () => {
  test('employee can log in, see dashboard, and log out', async ({ page }) => {
    await login(page, 'tw-emp001')
    await expect(page.getByRole('heading', { name: '儀表板' })).toBeVisible()
    await logout(page)
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto(loginPath())
    await page.getByPlaceholder('例如 emp001').fill('tw-emp001')
    await page.locator('input[type="password"]').fill('wrong-password')
    await page.getByRole('button', { name: '登入' }).click()
    await expect(page).toHaveURL(new RegExp('/login'))
    await expect(page.getByText('帳號或密碼錯誤，請再試一次。')).toBeVisible()
  })

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/zh-TW/dashboard')
    await expect(page).toHaveURL(new RegExp('/login'))
  })
})

test.describe('Session cookie', () => {
  test('sets sessionId cookie after login', async ({ page, context }) => {
    await login(page, 'tw-emp001', DEFAULT_PASSWORD)
    const cookies = await context.cookies()
    expect(cookies.some((c) => c.name === 'sessionId' && c.value.length > 0)).toBe(true)
  })
})
