import { expect, test } from '@playwright/test'
import { chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BIN = join(process.cwd(), 'runtime/.host-generation/node_modules/@deepseek-ai/dsh/lib/bin.js')

let original: Buffer | null = null

function restoreBin() {
  if (!original) return
  chmodSync(BIN, 0o644)
  writeFileSync(BIN, original)
  original = null
}

test.use({
  extraHTTPHeaders: { Origin: 'http://127.0.0.1:5174' },
})

test.afterAll(() => {
  restoreBin()
})

test('a dead core shows the core failure and the retry button restarts it', async ({ page, request }) => {
  test.setTimeout(300_000)
  original = readFileSync(BIN)

  try {
    const stopped = await request.post('/api/v1/ai/disconnect', { timeout: 30_000 })
    expect(stopped.ok(), 'disconnect the live core before replacing its entry').toBeTruthy()
    chmodSync(BIN, 0o644)
    writeFileSync(BIN, "import 'fde-iui-missing-module'\n")

    let hits = 0
    page.on('request', (req) => {
      if (new URL(req.url()).pathname === '/api/v1/ai/status') hits += 1
    })

    await page.goto('/settings')
    await page.waitForURL(/\/ai/)
    const select = page.getByRole('combobox', { name: '分类' })
    if (await select.isVisible()) await select.selectOption({ label: '运行环境' })
    else await page.getByRole('navigation', { name: '分类' }).getByRole('button', { name: '运行环境', exact: true }).click()
    const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: '运行环境诊断', level: 3 }) })

    await expect(panel.getByText('本地核心还没接通')).toBeVisible({ timeout: 90_000 })
    await expect(panel.getByText('fde-iui-missing-module')).toBeVisible()
    await expect(panel.getByText(/IUI 安装失败/)).toHaveCount(0)
    await expect(panel.getByText(/pnpm/)).toHaveCount(0)
    await expect(panel.getByRole('button', { name: '重试' })).toBeVisible()
    const settled = hits
    await page.waitForTimeout(2000)
    expect(hits - settled, 'the 400ms status watch should stop on iui failed').toBeLessThan(3)

    const failed = await (await request.get('/api/v1/ai/status')).json()
    expect(failed.data?.state).toBe('error')
    expect(failed.data?.iui?.state).toBe('failed')
    expect(String(failed.data?.iui?.reason || '')).toContain('fde-iui-missing-module')

    restoreBin()
    const retryResponse = page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/api/v1/ai/iui/retry' && res.request().method() === 'POST',
      { timeout: 180_000 },
    )
    await panel.getByRole('button', { name: '重试' }).click()
    const response = await retryResponse
    expect(response.status(), 'POST /api/v1/ai/iui/retry').toBe(200)
    await expect.poll(async () => {
      const body = await (await request.get('/api/v1/ai/status')).json()
      return `${body.data?.state}|${body.data?.iui?.state}`
    }, { timeout: 90_000 }).toBe('connected|enabled')
    await expect(panel.getByText('fde-iui-missing-module')).toHaveCount(0)
    await expect(panel.getByText(/IUI 安装失败/)).toHaveCount(0)
  } finally {
    restoreBin()
  }
})
