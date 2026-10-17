import { expect, test } from '@playwright/test'

test.use({
  extraHTTPHeaders: { Origin: 'http://127.0.0.1:5174' },
})

test('a missing install progress field is shown, not a blank page', async ({ page }) => {
  test.setTimeout(60_000)
  const payload = {
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
      iui: { state: 'installing', phase: 'link' },
    },
  }
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
  await page.goto('/settings')
  await page.waitForURL(/\/ai/)
  await expect(page.getByAltText('FDE-X')).toBeVisible()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByText('运行状态不完整，这一页暂时显示不了。').first()).toBeVisible()
  await expect(page.getByText(/iui\.progress/)).toHaveCount(0)
  await expect(page.getByText(/pnpm dev/)).toHaveCount(0)
  await expect(page.frameLocator('iframe').getByText('运行状态不完整')).toHaveCount(0)
})
