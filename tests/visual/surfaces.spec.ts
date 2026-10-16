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
  await page.setViewportSize({ width: 1760, height: 1000 })
  await page.goto('/settings')
  await page.waitForURL(/\/ai/)
  await expect(page.getByText('设置', { exact: true }).first()).toBeVisible()
  const select = page.getByRole('combobox', { name: '分类' })
  await expect(select).toBeVisible()
  for (const label of SETTINGS) {
    await select.selectOption({ label })
    await expect(page.getByRole('heading', { name: label, level: 2 })).toBeVisible()
    if (process.env.FDE_VISUAL_OUT) {
      await page.screenshot({
        path: `${process.env.FDE_VISUAL_OUT}/settings-${label}-narrow.png`,
        animations: 'disabled',
        mask: [page.locator('iframe')],
      })
    }
  }
  const handle = page.getByTitle('拖拽调整宽度')
  const box = await handle.boundingBox()
  const panel = handle.locator('xpath=ancestor::div[contains(@class,"border-l")][1]')
  const start = await panel.boundingBox()
  if (box && start) {
    const target = 880
    await page.mouse.move(box.x + box.width / 2, box.y + 80)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + (start.width - target), box.y + 80, { steps: 12 })
    await page.mouse.up()
  }
  const nav = page.getByRole('navigation', { name: '分类' })
  await expect(nav).toBeVisible()
  for (const label of SETTINGS) {
    await nav.getByRole('button', { name: label, exact: true }).click()
    await expect(page.getByRole('heading', { name: label, level: 2 })).toBeVisible()
    if (process.env.FDE_VISUAL_OUT) {
      await page.screenshot({
        path: `${process.env.FDE_VISUAL_OUT}/settings-${label}-wide.png`,
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

test('appearance font size saves and reads back', async ({ page }) => {
  await page.goto('/settings')
  await page.waitForURL(/\/ai/)
  await page.getByRole('combobox', { name: '分类' }).selectOption({ label: '外观' })
  const field = page.getByLabel('fontSize')
  await expect(field).toBeVisible({ timeout: 20000 })
  const before = await field.inputValue()
  const next = before === '15' ? '16' : '15'
  await field.click()
  await field.fill('')
  await field.pressSequentially(next)
  await expect(field).toHaveValue(next)
  const save = page.getByRole('button', { name: '保存', exact: true })
  await expect(save).toBeVisible()
  await save.click()
  await expect(page.getByText('未保存')).toHaveCount(0, { timeout: 20000 })
  await expect(field).toHaveValue(next)
  const readback = await page.evaluate(async () => {
    const response = await fetch('/api/v1/catalog?kind=settings')
    const body = await response.json() as { data?: { items?: Array<{ id?: string; fields?: { revision?: number; value?: { fontSize?: number } } }> } }
    const row = body.data?.items?.find((item) => item.id === 'ui-theme')
    return { fontSize: row?.fields?.value?.fontSize, revision: row?.fields?.revision }
  })
  expect(readback.fontSize).toBe(Number(next))
  await field.click()
  await field.fill('')
  await field.pressSequentially(before)
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText('未保存')).toHaveCount(0, { timeout: 20000 })
  await expect(field).toHaveValue(before)
  if (process.env.FDE_READBACK) {
    const restored = await page.evaluate(async () => {
      const response = await fetch('/api/v1/catalog?kind=settings')
      const body = await response.json() as { data?: { items?: Array<{ id?: string; fields?: { revision?: number; value?: { fontSize?: number } } }> } }
      const row = body.data?.items?.find((item) => item.id === 'ui-theme')
      return { fontSize: row?.fields?.value?.fontSize, revision: row?.fields?.revision, wrote: true }
    })
    const { writeFileSync } = await import('node:fs')
    writeFileSync(process.env.FDE_READBACK, JSON.stringify({
      ns: 'ui-theme',
      field: 'fontSize',
      written: Number(next),
      readBack: readback,
      restored,
    }, null, 2))
  }
})
