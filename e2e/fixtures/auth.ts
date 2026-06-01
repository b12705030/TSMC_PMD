import { expect, type Page } from '@playwright/test'

export const DEFAULT_PASSWORD = 'test1234'
export const LOCALE = 'zh-TW'

export function loginPath() {
  return `/${LOCALE}/login`
}

export async function login(page: Page, employeeId: string, password = DEFAULT_PASSWORD) {
  await page.goto(loginPath())
  await page.getByPlaceholder('例如 emp001').fill(employeeId)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL(new RegExp(`/${LOCALE}/dashboard`), { timeout: 30_000 })
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: '登出' }).click()
  await expect(page).toHaveURL(new RegExp(`/${LOCALE}/login`), { timeout: 15_000 })
}
