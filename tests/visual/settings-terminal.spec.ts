import { expect, test, type Page } from '@playwright/test'

test.use({
  extraHTTPHeaders: { Origin: 'http://127.0.0.1:5174' },
})

function statusPayload(patch: Record<string, unknown>) {
  return {
    data: {
      state: 'starting',
      connected: false,
      version: '0.2.0-rc.2',
      pid: null,
      origin: null,
      workspace: '/tmp/fde-mac-all',
      semanticMemoryMode: 'external-adapter',
      credentialsMode: 'ephemeral-copy',
      startedAt: null,
      lastError: null,
      recentLogs: [],
      ...patch,
    },
  }
}

const healthPayload = {
  service: 'fde-x',
  state: 'healthy',
  authority: {
    transactional: 'sqlite',
    semantic: 'semantic-service',
    externalRecords: 'source-system',
  },
  persistence: {
    state: 'healthy',
    database: { fingerprint: 'test', tableCount: 1 },
    migrations: [],
  },
  adapters: [
    {
      capability: 'ai-runtime',
      state: 'degraded',
      version: '0.2.0-rc.2',
      detail: '核心 AI 运行时正在受控启动和认证',
      checkedAt: '2026-10-17T00:00:00.000Z',
    },
  ],
  checkedAt: '2026-10-17T00:00:00.000Z',
}

async function openRuntime(page: Page, payload: ReturnType<typeof statusPayload>) {
  let hits = 0
  await page.route((url) => url.pathname === '/api/v1/ai/status', (route) => {
    hits += 1
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    })
  })
  await page.route((url) => url.pathname === '/api/v1/ai/connect', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  }))
  await page.route((url) => url.pathname === '/health', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(healthPayload),
  }))
  await page.goto('/settings')
  await page.waitForURL(/\/ai/)
  const select = page.getByRole('combobox', { name: '分类' })
  if (await select.isVisible()) await select.selectOption({ label: '运行环境' })
  else await page.getByRole('navigation', { name: '分类' }).getByRole('button', { name: '运行环境', exact: true }).click()
  const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: '运行环境诊断', level: 3 }) })
  return {
    panel,
    hits: () => hits,
  }
}

test('core error shows the pnpm dev sentence and stops status polling', async ({ page }) => {
  test.setTimeout(60_000)
  const { panel, hits } = await openRuntime(page, statusPayload({ state: 'error', lastError: 'AI 服务意外退出：code 1' }))
  await expect(page.getByText('请重新执行').first()).toBeVisible()
  await expect(panel.getByText('请重新执行')).toBeVisible()
  const settled = hits()
  await page.waitForTimeout(2000)
  expect(hits() - settled, 'the 400ms status watch should stop on core error').toBeLessThan(3)
})

test('iui failed shows the reason and stops status polling', async ({ page }) => {
  test.setTimeout(60_000)
  const line = 'IUI 安装失败：归档不存在。请重试。'
  const { panel, hits } = await openRuntime(page, statusPayload({
    state: 'error',
    iui: { state: 'failed', reason: '归档不存在' },
  }))
  await expect(page.getByText(line).first()).toBeVisible()
  await expect(panel.getByText(line)).toBeVisible()
  await expect(page.getByText('请重新执行')).toHaveCount(0)
  const settled = hits()
  await page.waitForTimeout(2000)
  expect(hits() - settled, 'the 400ms status watch should stop on iui failed').toBeLessThan(3)
})
