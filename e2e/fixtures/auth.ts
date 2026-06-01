import { expect, type Page } from '@playwright/test'

export const DEFAULT_PASSWORD = 'test1234'
export const LOCALE = 'zh-TW'

export function loginPath() {
  return `/${LOCALE}/login`
}

export async function login(page: Page, employeeId: string, password = DEFAULT_PASSWORD) {
  await page.goto(loginPath())
  await page.getByTestId('login-employee-id').fill(employeeId)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await expect(page).toHaveURL(new RegExp(`/${LOCALE}/dashboard`), { timeout: 30_000 })
}

export async function logout(page: Page) {
  await page.getByTestId('sidebar-logout').click()
  await expect(page).toHaveURL(new RegExp(`/${LOCALE}/login`), { timeout: 15_000 })
}
