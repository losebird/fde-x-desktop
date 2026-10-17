import { expect, test } from '@playwright/test'
import { connectCore, readAiStatus } from './host-core'

test.use({
  extraHTTPHeaders: { Origin: 'http://127.0.0.1:5174' },
})

test.afterAll(async ({ request }) => {
  test.setTimeout(120_000)
  await connectCore(request)
})

test('runtime panel leaves the controlled start copy after the core connects', async ({ page, request }) => {
  test.setTimeout(120_000)
  await page.route('**/api/v1/ai/connect', (route) => route.abort())
  const status = await readAiStatus(request)
  if (status.connected) {
    const off = await request.post('/api/v1/ai/disconnect')
    expect(off.ok()).toBeTruthy()
    expect((await readAiStatus(request)).connected).toBeFalsy()
  }

  let releaseHealth = () => {}
  const healthGate = new Promise<void>((resolve) => {
    releaseHealth = resolve
  })
  let held = false
  await page.route((url) => url.pathname === '/health', async (route) => {
    if (!held) {
      held = true
      await healthGate
    }
    await route.continue()
  })

  try {
    await page.goto('/settings')
    await page.waitForURL(/\/ai/)
    const select = page.getByRole('combobox', { name: '分类' })
    if (await select.isVisible()) await select.selectOption({ label: '运行环境' })
    else await page.getByRole('navigation', { name: '分类' }).getByRole('button', { name: '运行环境', exact: true }).click()
    await expect.poll(() => held, { timeout: 20_000 }).toBeTruthy()

    const connectPromise = request.post('/api/v1/ai/connect', { data: {} })
    await expect.poll(async () => {
      const response = await request.get('/api/v1/ai/status')
      const body = await response.json() as { data?: { state?: string } }
      return body.data?.state || ''
    }, { timeout: 30_000 }).toBe('starting')
    releaseHealth()

    const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: '运行环境诊断', level: 3 }) })
    await expect(panel.getByText('正在首次启动')).toBeVisible({ timeout: 20_000 })
    await expect(panel.getByText('请重新执行')).toHaveCount(0)
    await expect(panel.getByText('IUI 未安装')).toHaveCount(0)
    const connected = await connectPromise
    const body = await connected.json() as { error?: { message?: string } }
    expect(connected.status(), body.error?.message || '').toBe(200)
    await expect(panel.getByText('正在首次启动')).toHaveCount(0, { timeout: 20_000 })
    await expect(panel.getByText('已接通')).toBeVisible()
  } finally {
    releaseHealth()
  }
})
