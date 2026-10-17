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

test('a dead core shows the install failure and the retry button restarts it', async ({ page, request }) => {
  test.setTimeout(240_000)
  original = readFileSync(BIN)
  chmodSync(BIN, 0o644)
  writeFileSync(BIN, "import 'fde-iui-missing-module'\n")

  try {
    const before = await request.get('/api/v1/ai/status')
    expect(before.ok()).toBeTruthy()
    const beforeBody = await before.json()
    const pid = beforeBody?.data?.pid
    if (beforeBody?.data?.state === 'connected' && !pid) {
      throw new Error('connected core has no pid to stop')
    }
    if (pid) {
      try {
        process.kill(pid, 'SIGKILL')
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
        if (code !== 'ESRCH') throw error
      }
      await expect.poll(async () => {
        const body = await (await request.get('/api/v1/ai/status')).json()
        return `${body.data?.state}|${body.data?.pid ?? ''}`
      }, { timeout: 15_000 }).toBe('error|')
    }

    const connect = await request.post('/api/v1/ai/connect', { timeout: 90_000 })
    expect(connect.status(), 'a broken generation entry must fail the real connect').toBe(502)
    await expect.poll(async () => {
      const body = await (await request.get('/api/v1/ai/status')).json()
      const reason = String(body.data?.iui?.reason || '')
      return `${body.data?.state}|${body.data?.iui?.state}|${reason.includes('fde-iui-missing-module')}`
    }, { timeout: 20_000 }).toBe('error|failed|true')

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

    await expect(panel.getByText(/IUI 安装失败：/)).toBeVisible()
    await expect(panel.getByText('fde-iui-missing-module')).toBeVisible()
    await expect(panel.getByRole('button', { name: '重试' })).toBeVisible()
    const settled = hits
    await page.waitForTimeout(1600)
    expect(hits - settled, 'status polling should stop on iui failed').toBeLessThan(2)

    restoreBin()
    const retryResponse = page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/api/v1/ai/iui/retry' && res.request().method() === 'POST',
      { timeout: 120_000 },
    )
    await panel.getByRole('button', { name: '重试' }).click()
    const response = await retryResponse
    expect(response.status(), 'POST /api/v1/ai/iui/retry').toBe(200)
    await expect.poll(async () => {
      const body = await (await request.get('/api/v1/ai/status')).json()
      return `${body.data?.state}|${body.data?.iui?.state}`
    }, { timeout: 90_000 }).toBe('connected|enabled')
    await expect(panel.getByText(/IUI 安装失败：/)).toHaveCount(0)
  } finally {
    restoreBin()
  }
})
