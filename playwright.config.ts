import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.FDE_VISUAL_BASE ?? 'http://127.0.0.1:5174'

export default defineConfig({
  testDir: 'tests/visual',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    },
  },
  webServer: process.env.FDE_VISUAL_NO_SERVER
    ? undefined
    : {
        command: 'pnpm dev',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
