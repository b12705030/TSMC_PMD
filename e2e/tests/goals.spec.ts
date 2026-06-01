import { test, expect } from '@playwright/test'
import { login } from '../fixtures/auth'

function futureDateIso(daysAhead = 30) {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().slice(0, 10)
}

async function fillNewGoalForm(page: import('@playwright/test').Page, title: string) {
  const titleField = page.getByTestId('goal-new-title').or(
    page.getByPlaceholder('給這個目標取個名字...'),
  )
  const dueField = page.getByTestId('goal-new-due-date').or(page.locator('input[type="date"]'))

  await titleField.fill(title)
  await dueField.fill(futureDateIso())
  await page.getByPlaceholder('具體描述你要完成的事情').fill('Reduce defect rate in line A')
  await page.getByPlaceholder('例：將製程良率提升到 98%').fill('Defect rate %')
  await page.getByPlaceholder('例：98%、10 件、每週 1 次').fill('Below 2%')
  await page.getByPlaceholder('和團隊或公司目標的關聯').fill('Supports Q2 quality OKR')

  await page.getByRole('button', { name: '儲存目標' }).click()
}

test.describe('Goals workflow', () => {
  test('employee creates a goal and submits for approval', async ({ page }) => {
    const title = `E2E Goal ${Date.now()}`

    await login(page, 'tw-emp001')
    await page.goto('/zh-TW/goals/new')
    await fillNewGoalForm(page, title)

    await expect(page).toHaveURL(/\/goals\/[^/]+/)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    const submitBtn = page.getByTestId('goal-submit-approval').or(
      page.getByRole('button', { name: '提交審核' }),
    )
    await submitBtn.click()
    await expect(page.getByText('待審核').first()).toBeVisible()
  })

  test('supervisor approves a pending goal from goal detail page', async ({ page }) => {
    const title = `E2E Approve ${Date.now()}`

    await login(page, 'tw-emp001')
    await page.goto('/zh-TW/goals/new')
    await fillNewGoalForm(page, title)

    const submitBtn = page.getByRole('button', { name: '提交審核' })
    await submitBtn.click()
    await expect(page.getByText('待審核').first()).toBeVisible()

    const goalUrl = page.url()
    await page.context().clearCookies()
    await login(page, 'tw-sup001')
    await page.goto(goalUrl)

    await page.getByRole('button', { name: '核准目標' }).click()
    await expect(page.getByText('進行中').first()).toBeVisible({ timeout: 15_000 })
  })
})
