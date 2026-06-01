import { test, expect, type Page } from '@playwright/test'
import { login } from '../fixtures/auth'

function futureDateIso(daysAhead = 30) {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().slice(0, 10)
}

async function fillNewGoalForm(page: Page, title: string) {
  await page.getByTestId('goal-new-title').fill(title)
  await page.getByTestId('goal-new-due-date').fill(futureDateIso())
  await page.getByTestId('goal-new-description').fill('Reduce defect rate in line A')
  await page.getByTestId('goal-new-metric').fill('Defect rate percentage')
  await page.getByTestId('goal-new-targetValue').fill('Below 2 percent')
  await page.getByTestId('goal-new-relevance').fill('Supports Q2 quality OKR')
  await page.getByTestId('goal-new-submit').click()
}

test.describe('Goals workflow', () => {
  test('employee creates a goal and submits for approval', async ({ page }) => {
    const title = `E2E Goal ${Date.now()}`

    await login(page, 'tw-emp001')
    await page.goto('/zh-TW/goals/new')
    await fillNewGoalForm(page, title)

    await expect(page).toHaveURL(/\/goals\/[^/]+/)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    await page.getByTestId('goal-submit-approval').click()
    await expect(page.getByTestId('goal-submit-approval')).toBeHidden()
  })

  test('supervisor approves a pending goal from goal detail page', async ({ page }) => {
    const title = `E2E Approve ${Date.now()}`

    await login(page, 'tw-emp001')
    await page.goto('/zh-TW/goals/new')
    await fillNewGoalForm(page, title)
    await page.getByTestId('goal-submit-approval').click()

    const goalUrl = page.url()
    await page.context().clearCookies()
    await login(page, 'tw-sup001')
    await page.goto(goalUrl)

    await page.getByTestId('goal-approve').click()
    await expect(page.getByTestId('goal-approve')).toBeHidden({ timeout: 15_000 })
  })
})
