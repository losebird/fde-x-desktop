import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'

const BIN = '/tmp/fde-mac-all/runtime/.host-generation/node_modules/@deepseek-ai/dsh/lib/bin.js'

let original: Buffer | null = null

function restoreBin() {
  if (!original) return
  writeFileSync(BIN, original)
  original = null
}

test.use({
  extraHTTPHeaders: { Origin: 'http://127.0.0.1:5174' },
})

test.afterAll(() => {
  restoreBin()
})

test('a core that dies on startup reaches the rerun sentence and stops polling', async ({ page }) => {
  test.setTimeout(90_000)
  original = readFileSync(BIN)
  writeFileSync(BIN, "import 'fde-missing-module'\n")

  let hits = 0
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/api/v1/ai/status') hits += 1
  })

  try {
    await page.goto('/settings')
    await page.waitForURL(/\/ai/)
    const select = page.getByRole('combobox', { name: '分类' })
    if (await select.isVisible()) await select.selectOption({ label: '运行环境' })
    else await page.getByRole('navigation', { name: '分类' }).getByRole('button', { name: '运行环境', exact: true }).click()
    const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: '运行环境诊断', level: 3 }) })

    await expect.poll(async () => {
      const boot = await page.getByText('正在首次启动').count()
      const rerun = await page.getByText('请重新执行').count()
      const panelRerun = await panel.getByText('请重新执行').count()
      return `boot=${boot} rerun=${rerun} panel=${panelRerun} hits=${hits}`
    }, { timeout: 25_000 }).toMatch(/panel=[1-9]/)

    const settled = hits
    await page.waitForTimeout(1600)
    expect(hits - settled, 'status polling should stop once the core is in error').toBeLessThan(2)
  } finally {
    restoreBin()
  }
})
