import { expect, test, type Page } from '@playwright/test'

test.use({
  extraHTTPHeaders: { Origin: 'http://127.0.0.1:5174' },
})

function payload(iui: Record<string, unknown>) {
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
      iui,
    },
  }
}

async function openFailed(page: Page, iui: Record<string, unknown>) {
  let hits = 0
  let retries = 0
  const body = payload(iui)
  await page.route((url) => url.pathname === '/api/v1/ai/status', (route) => {
    hits += 1
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.route((url) => url.pathname === '/api/v1/ai/connect', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }))
  await page.route((url) => url.pathname === '/api/v1/ai/iui/retry', (route) => {
    retries += 1
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: body.data }) })
  })
  await page.route((url) => url.pathname === '/health', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      service: 'fde-x',
      state: 'healthy',
      authority: { transactional: 'sqlite', semantic: 'semantic-service', externalRecords: 'source-system' },
      persistence: { state: 'healthy', database: { fingerprint: 'test', tableCount: 1 }, migrations: [] },
      adapters: [{
        capability: 'ai-runtime',
        state: 'degraded',
        version: '0.2.0-rc.2',
        detail: '核心 AI 运行时正在受控启动和认证',
        checkedAt: '2026-10-17T00:00:00.000Z',
      }],
      checkedAt: '2026-10-17T00:00:00.000Z',
    }),
  }))
  await page.goto('/settings')
  await page.waitForURL(/\/ai/)
  const select = page.getByRole('combobox', { name: '分类' })
  if (await select.isVisible()) await select.selectOption({ label: '运行环境' })
  else await page.getByRole('navigation', { name: '分类' }).getByRole('button', { name: '运行环境', exact: true }).click()
  const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: '运行环境诊断', level: 3 }) })
  return { panel, hits: () => hits, retries: () => retries }
}

test('verify_failed offers retry and subscribes again after the click', async ({ page }) => {
  test.setTimeout(60_000)
  const { panel, hits, retries } = await openFailed(page, {
    state: 'verify_failed',
    artifactPath: '/tmp/iui-pin.tar.gz',
    expected: 'aaa111',
    actual: 'bbb222',
    command: 'node scripts/pack/build-iui.mjs',
  })
  const line = 'IUI 校验失败。归档 /tmp/iui-pin.tar.gz。期望 aaa111，实际 bbb222。用 Node 26.7.0 与 pnpm 11.20.0 重新打包：node scripts/pack/build-iui.mjs'
  await expect(panel.getByText(line)).toBeVisible()
  const beforeStop = hits()
  await page.waitForTimeout(2000)
  expect(hits() - beforeStop, 'the 400ms status watch should stop on verify_failed').toBeLessThan(3)
  const settled = hits()
  await panel.getByRole('button', { name: '重试' }).click()
  await expect.poll(() => retries()).toBe(1)
  await expect.poll(() => hits()).toBeGreaterThan(settled)
})

test('iui failed offers retry next to the reason', async ({ page }) => {
  test.setTimeout(60_000)
  const { panel, retries } = await openFailed(page, { state: 'failed', reason: '归档不存在' })
  await expect(panel.getByText('IUI 安装失败：归档不存在。请重试。')).toBeVisible()
  await panel.getByRole('button', { name: '重试' }).click()
  await expect.poll(() => retries()).toBe(1)
})

function enabledPayload() {
  const body = payload({ state: 'enabled', version: '0.13.0-iui.26' })
  body.data.state = 'connected'
  body.data.connected = true
  return body
}

async function openSwitching(page: Page, options: {
  failed: Record<string, unknown>
  core?: Record<string, unknown>
  holdRetry?: boolean
}) {
  let retries = 0
  let readsAfterRetry = 0
  let releaseRetry: (() => void) | null = null
  const retryGate = options.holdRetry
    ? new Promise<void>((resolve) => {
      releaseRetry = resolve
    })
    : null
  const failedBody = payload(options.failed)
  if (options.core) Object.assign(failedBody.data, options.core)
  const recovered = enabledPayload()
  await page.route((url) => url.pathname === '/api/v1/ai/status', (route) => {
    if (retries >= 1) readsAfterRetry += 1
    const body = retries >= 1 && readsAfterRetry >= 2 ? recovered : failedBody
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.route((url) => url.pathname === '/api/v1/ai/connect', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(failedBody),
  }))
  await page.route((url) => url.pathname === '/api/v1/ai/iui/retry', async (route) => {
    retries += 1
    if (retryGate) await retryGate
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: failedBody.data }),
    })
  })
  await page.route((url) => url.pathname === '/health', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      service: 'fde-x',
      state: 'healthy',
      authority: { transactional: 'sqlite', semantic: 'semantic-service', externalRecords: 'source-system' },
      persistence: { state: 'healthy', database: { fingerprint: 'test', tableCount: 1 }, migrations: [] },
      adapters: [{
        capability: 'ai-runtime',
        state: 'degraded',
        version: '0.2.0-rc.2',
        detail: '核心 AI 运行时正在受控启动和认证',
        checkedAt: '2026-10-17T00:00:00.000Z',
      }],
      checkedAt: '2026-10-17T00:00:00.000Z',
    }),
  }))
  await page.goto('/settings')
  await page.waitForURL(/\/ai/)
  const select = page.getByRole('combobox', { name: '分类' })
  if (await select.isVisible()) await select.selectOption({ label: '运行环境' })
  else await page.getByRole('navigation', { name: '分类' }).getByRole('button', { name: '运行环境', exact: true }).click()
  const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: '运行环境诊断', level: 3 }) })
  return {
    panel,
    releaseRetry: () => releaseRetry?.(),
  }
}

test('retry leaves the failure copy when a later status read recovers', async ({ page }) => {
  test.setTimeout(60_000)
  const { panel } = await openSwitching(page, { failed: { state: 'failed', reason: '归档不存在' } })
  const failure = 'IUI 安装失败：归档不存在。请重试。'
  await expect(panel.getByText(failure)).toBeVisible()
  await panel.getByRole('button', { name: '重试' }).click()
  await expect(panel.getByText(failure)).toHaveCount(0)
  await expect(panel.getByText('核心 AI 运行时正在受控启动和认证')).toBeVisible()
})

test('reinstall shows in-progress copy while the retry request is still open', async ({ page }) => {
  test.setTimeout(60_000)
  const { panel, releaseRetry } = await openSwitching(page, {
    failed: { state: 'failed', reason: '归档不存在' },
    holdRetry: true,
  })
  const failure = 'IUI 安装失败：归档不存在。请重试。'
  await expect(panel.getByText(failure)).toBeVisible()
  await panel.getByRole('button', { name: '重试' }).click()
  await expect(panel.getByText('正在首次安装… 校验归档 0/4')).toBeVisible()
  await expect(panel.getByText(failure)).toHaveCount(0)
  releaseRetry()
})

test('retry shows the same install failure again after install progress', async ({ page }) => {
  test.setTimeout(60_000)
  let hits = 0
  let retries = 0
  const failure = 'IUI 安装失败：归档不存在。请重试。'
  const failed = payload({ state: 'failed', reason: '归档不存在' })
  const progress = payload({
    state: 'installing',
    phase: 'link',
    progress: { completed: 2, total: 4 },
  })
  await page.route((url) => url.pathname === '/api/v1/ai/status', async (route) => {
    if (retries >= 1) await new Promise((resolve) => setTimeout(resolve, 400))
    hits += 1
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(failed) })
  })
  await page.route((url) => url.pathname === '/api/v1/ai/connect', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(failed),
  }))
  await page.route((url) => url.pathname === '/api/v1/ai/iui/retry', (route) => {
    retries += 1
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: progress.data }),
    })
  })
  await page.route((url) => url.pathname === '/health', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      service: 'fde-x',
      state: 'healthy',
      authority: { transactional: 'sqlite', semantic: 'semantic-service', externalRecords: 'source-system' },
      persistence: { state: 'healthy', database: { fingerprint: 'test', tableCount: 1 }, migrations: [] },
      adapters: [{
        capability: 'ai-runtime',
        state: 'degraded',
        version: '0.2.0-rc.2',
        detail: '核心 AI 运行时正在受控启动和认证',
        checkedAt: '2026-10-17T00:00:00.000Z',
      }],
      checkedAt: '2026-10-17T00:00:00.000Z',
    }),
  }))
  await page.goto('/settings')
  await page.waitForURL(/\/ai/)
  const select = page.getByRole('combobox', { name: '分类' })
  if (await select.isVisible()) await select.selectOption({ label: '运行环境' })
  else await page.getByRole('navigation', { name: '分类' }).getByRole('button', { name: '运行环境', exact: true }).click()
  const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: '运行环境诊断', level: 3 }) })
  await expect(panel.getByText(failure)).toBeVisible()
  await panel.getByRole('button', { name: '重试' }).click()
  await expect(panel.getByText('正在首次安装… 写入配置 2/4')).toBeVisible()
  await expect(panel.getByText(failure)).toBeVisible()
  const settled = hits
  await page.waitForTimeout(2000)
  expect(hits - settled, 'the 400ms status watch should stop when the same install failure returns').toBeLessThan(3)
})
