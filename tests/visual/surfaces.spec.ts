import { expect, test } from '@playwright/test'

const PANELS = [
  { route: '/mcp', title: '连接器' },
  { route: '/skills', title: '技能' },
  { route: '/settings', title: '设置' },
] as const

const SETTINGS = ['账户', '外观', '通知', '快捷键', 'AI 核心', '语义记忆', '运行环境', '存储与数据'] as const

for (const panel of PANELS) {
  test(`${panel.title} opens in the right-hand panel`, async ({ page }) => {
    await page.goto(panel.route)
    await page.waitForURL(/\/ai/)
    await expect(page.getByText(panel.title, { exact: true }).first()).toBeVisible()
    if (process.env.FDE_VISUAL_OUT) {
      await page.screenshot({
        path: `${process.env.FDE_VISUAL_OUT}/${panel.route.slice(1)}.png`,
        animations: 'disabled',
        mask: [page.locator('iframe')],
      })
    }
  })
}

test('settings exposes eight sections by name', async ({ page }, testInfo) => {
  await page.goto('/settings')
  await page.waitForURL(/\/ai/)
  await expect(page.getByText('设置', { exact: true }).first()).toBeVisible()
  for (const label of SETTINGS) {
    const section = page.getByRole('button', { name: label, exact: true })
    await expect(section).toBeVisible()
    await section.click()
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    if (process.env.FDE_VISUAL_OUT) {
      await page.screenshot({
        path: `${process.env.FDE_VISUAL_OUT}/settings-${label}.png`,
        animations: 'disabled',
        mask: [page.locator('iframe')],
      })
    }
  }
  await testInfo.attach('settings-eight-sections', {
    body: await page.screenshot({ animations: 'disabled', mask: [page.locator('iframe')] }),
    contentType: 'image/png',
  })
})
