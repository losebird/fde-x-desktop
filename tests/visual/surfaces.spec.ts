import { expect, test, type Page } from '@playwright/test'

const PANELS = [
  { route: '/mcp', title: '连接器', shot: 'connectors' },
  { route: '/skills', title: '技能', shot: 'skills' },
  { route: '/settings', title: '设置', shot: 'settings' },
] as const

const SETTINGS = ['账户', '外观', '通知', '快捷键', 'AI 核心', '语义记忆', '运行环境', '存储与数据'] as const

function stagePanel(page: Page, title: string) {
  return page.locator('div.border-l.bg-surface').filter({ hasText: title }).first()
}

for (const panel of PANELS) {
  test(`panel ${panel.shot} keeps the right-hand stage`, async ({ page }) => {
    await page.goto(panel.route)
    await page.waitForURL(/\/ai/)
    const shell = stagePanel(page, panel.title)
    await expect(shell).toBeVisible()
    await expect(shell).toHaveScreenshot(`${panel.shot}.png`)
  })
}

test('settings exposes eight sections', async ({ page }) => {
  await page.goto('/settings')
  await page.waitForURL(/\/ai/)
  for (const label of SETTINGS) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(stagePanel(page, '设置')).toBeVisible()
    await expect(page).toHaveScreenshot(`settings-${label}.png`, {
      mask: [page.locator('iframe')],
    })
  }
})
