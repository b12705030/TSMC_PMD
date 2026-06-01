import { test, expect } from '@playwright/test'
import { login } from '../fixtures/auth'

const ADD_CYCLE = '+ 新增週期'

test.describe('Role-based UI', () => {
  test('employee cannot see create-cycle button on cycles page', async ({ page }) => {
    await login(page, 'tw-emp001')
    await page.goto('/zh-TW/cycles')
    await expect(page.getByRole('heading', { name: '績效週期管理' })).toBeVisible()
    await expect(page.getByRole('button', { name: ADD_CYCLE })).toHaveCount(0)
  })

  test('regional HR can see create-cycle button', async ({ page }) => {
    await login(page, 'tw-hr001')
    await page.goto('/zh-TW/cycles')
    await expect(page.getByRole('button', { name: ADD_CYCLE })).toBeVisible()
  })
})
