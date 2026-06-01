import { test, expect } from '@playwright/test'
import { login } from '../fixtures/auth'

test.describe('RBAC in the UI', () => {
  test('employee can view cycles but cannot create a cycle', async ({ page }) => {
    await login(page, 'tw-emp001')
    await page.goto('/zh-TW/cycles')

    await expect(page.getByTestId('cycles-add')).toHaveCount(0)
  })

  test('regional HR can create cycles', async ({ page }) => {
    await login(page, 'tw-hr001')
    await page.goto('/zh-TW/cycles')

    await expect(page.getByTestId('cycles-add').first()).toBeVisible()
  })
})
