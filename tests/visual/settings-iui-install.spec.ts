import { expect, test, type Page } from '@playwright/test'

test.use({
  extraHTTPHeaders: { Origin: 'http://127.0.0.1:5174' },
})

type IuiRecord = Record<string, unknown>

function statusPayload(iui: IuiRecord, state = 'starting') {
  return {
    data: {
      state,
      connected: false,
      version: '0.2.0-rc.2',
      pid: 4242,
      origin: null,
      workspace: '/tmp/fde-mac-all',
      semanticMemoryMode: 'external-adapter',
      credentialsMode: 'ephemeral-copy',
      startedAt: null,
      lastError: null,
      recentLogs: [],
      iui,
    },
  }
}

function healthPayload(iui: IuiRecord, detail: string) {
  return {
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
        detail,
        checkedAt: '2026-10-17T00:00:00.000Z',
        iui,
      },
    ],
    checkedAt: '2026-10-17T00:00:00.000Z',
  }
}

async function showRuntime(page: Page, iui: IuiRecord, detail: string) {
  const payload = statusPayload(iui)
  await page.route((url) => url.pathname === '/api/v1/ai/status', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  }))
  await page.route((url) => url.pathname === '/api/v1/ai/connect', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  }))
  await page.route((url) => url.pathname === '/health', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(healthPayload(iui, detail)),
  }))
  await page.goto('/settings')
  await page.waitForURL(/\/ai/)
  const select = page.getByRole('combobox', { name: '分类' })
  if (await select.isVisible()) await select.selectOption({ label: '运行环境' })
  else await page.getByRole('navigation', { name: '分类' }).getByRole('button', { name: '运行环境', exact: true }).click()
  return page.locator('section').filter({ has: page.getByRole('heading', { name: '运行环境诊断', level: 3 }) })
}

test('installing iui shows first-install progress instead of a missing install', async ({ page }) => {
  test.setTimeout(60_000)
  const panel = await showRuntime(page, {
    state: 'installing',
    phase: 'link',
    progress: { completed: 1, total: 4 },
  }, '核心 AI 运行时正在受控启动和认证；IUI 未安装')
  const line = '正在首次安装… 写入配置 1/4'
  await expect(page.getByText(line).first()).toBeVisible()
  await expect(panel.getByText(line)).toBeVisible()
  await expect(page.getByText('IUI 未安装')).toHaveCount(0)
  await expect(page.getByText('请重新执行')).toHaveCount(0)
})

test('a failed iui install retries with the reason, not pnpm dev', async ({ page }) => {
  test.setTimeout(60_000)
  const panel = await showRuntime(page, {
    state: 'failed',
    reason: '归档不存在',
  }, '核心 AI 运行时正在受控启动和认证；IUI 未安装')
  const line = 'IUI 安装失败：归档不存在。请重试。'
  await expect(page.getByText(line).first()).toBeVisible()
  await expect(panel.getByText(line)).toBeVisible()
  await expect(page.getByText('请重新执行')).toHaveCount(0)
  await expect(page.getByText('IUI 未安装')).toHaveCount(0)
})

test('verify_failed shows the archive, both digests, and the repack command', async ({ page }) => {
  test.setTimeout(60_000)
  const panel = await showRuntime(page, {
    state: 'verify_failed',
    artifactPath: '/tmp/iui-pin.tar.gz',
    expected: 'aaa111',
    actual: 'bbb222',
    command: 'node scripts/pack/build-iui.mjs',
  }, '核心 AI 运行时正在受控启动和认证；IUI 未安装')
  const line = 'IUI 校验失败。归档 /tmp/iui-pin.tar.gz。期望 aaa111，实际 bbb222。用 Node 26.7.0 与 pnpm 11.20.0 重新打包：node scripts/pack/build-iui.mjs'
  await expect(page.getByText(line).first()).toBeVisible()
  await expect(panel.getByText(line)).toBeVisible()
  await expect(page.getByText('IUI 未安装')).toHaveCount(0)
})
