import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const skillName = 'fde-toggle-skill'
const root = '/home/ubuntu/.dsh-fde-x/skills'
const source = '/tmp/fde-toggle-skill'
const manifestPath = `${root}/${skillName}/SKILL.md`
const skillList = /\/api\/v1\/ai\/(?:skills|sessions\/[^/]+\/skills)(?:\?|$)/

test.use({
  extraHTTPHeaders: { Origin: 'http://127.0.0.1:5174' },
})

let sid = ''

async function skillRow(request: APIRequestContext) {
  const response = await request.get(`/api/v1/ai/sessions/${encodeURIComponent(sid)}/skills`)
  expect(response.ok()).toBeTruthy()
  const body = await response.json() as { data?: { items?: Array<{ name?: string; modelInvocable?: boolean }> } }
  return body.data?.items?.find((item) => item.name === skillName)
}

async function setFlag(request: APIRequestContext, modelInvocable: boolean) {
  const response = await request.post('/api/v1/skills/model-invocable', {
    data: { path: manifestPath, modelInvocable, cwd: '/workspace', sessionId: sid },
  })
  expect(response.ok()).toBeTruthy()
}

function watchWrites(page: Page) {
  const wrote: boolean[] = []
  page.on('request', (request) => {
    if (request.method() !== 'POST' || !request.url().includes('/api/v1/skills/model-invocable')) return
    const body = request.postDataJSON() as { modelInvocable?: boolean }
    wrote.push(body.modelInvocable === true)
  })
  return wrote
}

test.beforeAll(async ({ request }) => {
  rmSync(source, { recursive: true, force: true })
  rmSync(`${root}/${skillName}`, { recursive: true, force: true })
  mkdirSync(source, { recursive: true })
  writeFileSync(join(source, 'SKILL.md'), `---
name: ${skillName}
description: Toggle round trip skill.
---

Toggle body.
`)
  const session = await request.post('/api/v1/ai/sessions', { data: { cwd: '/workspace' } })
  expect(session.status()).toBe(201)
  const created = await session.json() as { data?: { sessionId?: string } }
  sid = created.data?.sessionId || ''
  expect(sid).toBeTruthy()
  const installed = await request.post('/api/v1/skills/install', {
    data: { source, root, cwd: '/workspace' },
  })
  expect(installed.status()).toBe(201)
})

test.afterAll(async ({ request }) => {
  if (sid) {
    await request.delete(`/api/v1/skills/bundle?${new URLSearchParams({ path: manifestPath, cwd: '/workspace', sessionId: sid })}`)
    await request.post(`/api/v1/ai/sessions/${encodeURIComponent(sid)}/archive`)
  }
  rmSync(source, { recursive: true, force: true })
  rmSync(`${root}/${skillName}`, { recursive: true, force: true })
})

test('disable, enable, then disable reads back from the api', async ({ page, request }) => {
  await setFlag(request, true)
  const wrote = watchWrites(page)
  await page.goto('/skills')
  await page.waitForURL(/\/ai/)
  await page.getByRole('switch', { name: `停用 ${skillName}` }).click()
  await expect.poll(async () => (await skillRow(request))?.modelInvocable, { timeout: 8000 }).toBe(false)
  await page.getByRole('switch', { name: `启用 ${skillName}` }).click()
  await expect.poll(async () => (await skillRow(request))?.modelInvocable, { timeout: 8000 }).toBe(true)
  await page.getByRole('switch', { name: `停用 ${skillName}` }).click()
  await expect.poll(async () => (await skillRow(request))?.modelInvocable, { timeout: 8000 }).toBe(false)
  expect(wrote).toEqual([false, true, false])
})

test('a stale catalog read does not turn the next click into another disable', async ({ page, request }) => {
  await setFlag(request, true)
  let lock = false
  let lockedBody = ''
  await page.route(skillList, async (route) => {
    if (!lock) {
      const response = await route.fetch()
      const body = await response.text()
      if (body.includes(skillName)) lockedBody = body
      await route.fulfill({ response, body })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: lockedBody })
  })
  const wrote = watchWrites(page)
  await page.goto('/skills')
  await page.waitForURL(/\/ai/)
  const disable = page.getByRole('switch', { name: `停用 ${skillName}` })
  await disable.waitFor({ timeout: 20000 })
  expect(lockedBody).toContain('"modelInvocable":true')
  lock = true
  await disable.click()
  await expect(page.getByRole('switch', { name: `启用 ${skillName}` })).not.toBeChecked()
  await expect.poll(() => wrote.length).toBe(1)
  expect(wrote[0]).toBe(false)
  await page.getByText('已停用。').waitFor()
  await expect(page.getByRole('switch', { name: `启用 ${skillName}` })).not.toBeChecked()
  await page.getByRole('switch', { name: `启用 ${skillName}` }).click()
  await expect.poll(() => wrote.length).toBe(2)
  expect(wrote).toEqual([false, true])
  await expect(page.getByRole('switch', { name: `停用 ${skillName}` })).toBeChecked()
})
