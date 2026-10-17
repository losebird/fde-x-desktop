import { expect, test, type APIRequestContext } from '@playwright/test'
import { objectFieldEntries, rootObjectUid, schemaNode } from '../../src/lib/settings-schema'
import { settingsNsHome } from '../../src/lib/settings-ns-home'
import { connectCore, readAiStatus } from './host-core'

test.use({
  extraHTTPHeaders: { Origin: 'http://127.0.0.1:5174' },
})

test.afterAll(async ({ request }) => {
  test.setTimeout(120_000)
  await connectCore(request)
})

type CatalogItem = {
  id?: string
  fields?: { schema?: Record<string, unknown> }
}

function fieldLabel(schema: Record<string, unknown>, uid: unknown, name: string) {
  const node = schemaNode(schema, uid)
  const meta = node?.meta && typeof node.meta === 'object' ? node.meta as { title?: unknown } : {}
  const title = typeof meta.title === 'string' ? meta.title.trim() : ''
  return title || name
}

async function appearanceFieldLabels(request: APIRequestContext) {
  const response = await request.get('/api/v1/catalog?kind=settings')
  expect(response.ok()).toBeTruthy()
  const body = await response.json() as { data?: { items?: CatalogItem[] } }
  const labels: string[] = []
  for (const item of body.data?.items || []) {
    if (settingsNsHome(String(item.id || '')) !== 'appearance') continue
    const schema = item.fields?.schema
    if (!schema || typeof schema !== 'object') continue
    const root = rootObjectUid(schema)
    if (!root) continue
    for (const field of objectFieldEntries(schema, root)) {
      const label = fieldLabel(schema, field.uid, field.name)
      if (label) labels.push(label)
    }
  }
  return labels
}

test('appearance renders the host schema after the core connects', async ({ page, request }) => {
  test.setTimeout(120_000)
  await page.route('**/api/v1/ai/connect', (route) => route.abort())
  const status = await readAiStatus(request)
  if (status.connected) {
    const off = await request.post('/api/v1/ai/disconnect')
    expect(off.ok()).toBeTruthy()
    expect((await readAiStatus(request)).connected).toBeFalsy()
  }
  await page.goto('/settings')
  await page.waitForURL(/\/ai/)
  const select = page.getByRole('combobox', { name: '分类' })
  if (await select.isVisible()) await select.selectOption({ label: '外观' })
  else await page.getByRole('navigation', { name: '分类' }).getByRole('button', { name: '外观', exact: true }).click()
  await expect(page.getByText('核心还没接通', { exact: true })).toBeVisible({ timeout: 20_000 })
  await page.unroute('**/api/v1/ai/connect')
  await connectCore(request)
  const labels = await appearanceFieldLabels(request)
  expect(labels.length).toBeGreaterThan(0)
  const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: '外观', level: 3 }) })
  const counts = new Map<string, number>()
  for (const label of labels) counts.set(label, (counts.get(label) || 0) + 1)
  for (const [label, count] of counts) {
    await expect(panel.getByText(label, { exact: true })).toHaveCount(count, { timeout: 20_000 })
  }
  await expect(page.getByText('核心还没接通', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '连接核心' })).toHaveCount(0)
})
