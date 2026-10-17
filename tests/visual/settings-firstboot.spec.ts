import { expect, test } from '@playwright/test'
import { connectCore, readAiStatus } from './host-core'

test.use({
  extraHTTPHeaders: { Origin: 'http://127.0.0.1:5174' },
})

test.afterAll(async ({ request }) => {
  test.setTimeout(120_000)
  await connectCore(request)
})

test('starting core does not tell the user to rerun pnpm dev', async ({ page, request }) => {
  test.setTimeout(120_000)
  const status = await readAiStatus(request)
  if (status.connected) {
    const off = await request.post('/api/v1/ai/disconnect')
    expect(off.ok()).toBeTruthy()
    expect((await readAiStatus(request)).connected).toBeFalsy()
  }

  await page.goto('/settings')
  await page.waitForURL(/\/ai/)
  const select = page.getByRole('combobox', { name: '分类' })
  if (await select.isVisible()) await select.selectOption({ label: '运行环境' })
  else await page.getByRole('navigation', { name: '分类' }).getByRole('button', { name: '运行环境', exact: true }).click()

  const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: '运行环境诊断', level: 3 }) })
  await expect.poll(async () => {
    const response = await request.get('/api/v1/ai/status')
    const body = await response.json() as { data?: { state?: string } }
    if (body.data?.state !== 'starting') return body.data?.state || 'empty'
    const retry = await page.getByText('请重新执行').count()
    const boot = await page.getByText('正在首次启动').count()
    const panelBoot = await panel.getByText('正在首次启动').count()
    const iui = await panel.getByText('IUI 未安装').count()
    if (retry === 0 && boot > 0 && panelBoot > 0 && iui === 0) return 'ok'
    return `starting retry=${retry} boot=${boot} panel=${panelBoot} iui=${iui}`
  }, { timeout: 30_000 }).toBe('ok')
})
