import { test, expect } from '@playwright/test'
import { login, logout, loginPath, DEFAULT_PASSWORD } from '../fixtures/auth'

test.describe('Authentication', () => {
  test('employee can log in, see dashboard, and log out', async ({ page }) => {
    await login(page, 'tw-emp001')
    await expect(page.getByTestId('sidebar-logout')).toBeVisible()

    await logout(page)
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto(loginPath())
    await page.getByTestId('login-employee-id').fill('tw-emp001')
    await page.getByTestId('login-password').fill('wrong-password')
    await page.getByTestId('login-submit').click()

    await expect(page).toHaveURL(new RegExp('/login'))
    await expect(page.getByTestId('login-error')).toBeVisible()
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

  test('clears sessionId cookie after logout', async ({ page, context }) => {
    await login(page, 'tw-emp001', DEFAULT_PASSWORD)
    await logout(page)

    const cookies = await context.cookies()
    expect(cookies.some((c) => c.name === 'sessionId')).toBe(false)
  })

  test('redirects to login when an existing session cookie disappears', async ({ page, context }) => {
    await login(page, 'tw-emp001', DEFAULT_PASSWORD)
    await context.clearCookies()

    await page.goto('/zh-TW/dashboard')

    await expect(page).toHaveURL(new RegExp('/login'))
  })
})
