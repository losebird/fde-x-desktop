import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const bff = 'http://127.0.0.1:4318'
const web = 'http://127.0.0.1:5174'
const origin = web
const cwdA = '/tmp/fde-ws-a'
const cwdB = '/tmp/fde-ws-b'
const outDir = join(import.meta.dirname, '..', '..', 'artifacts', 'briefing-session-bugs')

async function api(method, path, body) {
  const response = await fetch(`${bff}${path}`, {
    method,
    headers: {
      Origin: origin,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 400)}`)
  return text ? JSON.parse(text) : null
}

async function sessionForCwd(cwd, preset) {
  const listed = await api('GET', '/api/v1/ai/sessions?includeBlank=true&includeSubagents=true')
  const items = listed.data?.items || []
  const hit = items.find((row) => row.cwd === cwd && (!preset || row.agentPreset === preset))
  if (hit) return hit.sessionId
  const created = await api('POST', '/api/v1/ai/sessions', { cwd })
  return created.data.sessionId
}

async function asideCount(page) {
  return page.locator('aside ul li').count()
}

async function chooseWorkspace(page, name) {
  await page.getByTitle(/当前工作区:/).click()
  await page.getByRole('menuitem').filter({ hasText: name }).click()
  await page.getByTitle(new RegExp(`当前工作区: ${name}`)).waitFor({ timeout: 10000 })
}

const sessionA = await sessionForCwd(cwdA, 'standard')
const sessionB = await sessionForCwd(cwdB, 'standard')
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(`${web}/ai/${sessionA}`, { waitUntil: 'domcontentloaded' })
await page.locator('aside').getByText('会话', { exact: true }).waitFor({ timeout: 30000 })
await chooseWorkspace(page, 'repro-a')
await page.waitForTimeout(800)
const countOnA = await asideCount(page)
await page.screenshot({ path: join(outDir, 'list-on-workspace-a.png') })
const created = await api('POST', '/api/v1/ai/sessions', { cwd: cwdA })
const extraId = created.data.sessionId
await page.waitForTimeout(2500)
const countAfterCreate = await asideCount(page)
await page.screenshot({ path: join(outDir, 'list-after-create-no-reload.png') })
await page.reload({ waitUntil: 'domcontentloaded' })
await page.locator('aside').getByText('会话', { exact: true }).waitFor({ timeout: 30000 })
await page.getByTitle(/当前工作区: repro-a/).waitFor({ timeout: 15000 })
await page.waitForTimeout(1200)
const countAfterReload = await asideCount(page)
await page.screenshot({ path: join(outDir, 'list-after-reload.png') })
const listed = await api('GET', `/api/v1/ai/sessions?includeBlank=true&includeSubagents=true`)
const apiHasExtra = (listed.data?.items || []).some((row) => row.sessionId === extraId)
await chooseWorkspace(page, 'repro-b')
await page.waitForTimeout(1200)
const urlAfterSwitch = page.url()
const iframeSrc = await page.locator('iframe[title="DSH 会话"]').getAttribute('src')
const countOnB = await asideCount(page)
const buttonTitle = await page.getByTitle(/当前工作区:/).getAttribute('title')
await page.screenshot({ path: join(outDir, 'workspace-switch.png') })
await browser.close()

const report = {
  sessionA,
  sessionB,
  extraId,
  apiHasExtra,
  countOnA,
  countAfterCreate,
  countAfterReload,
  countOnB,
  urlAfterSwitch,
  iframeSrc,
  buttonTitle,
  listIgnoredCreate: countAfterCreate === countOnA && apiHasExtra,
  reloadShowsCreate: countAfterReload === countOnA + 1,
  urlStayedOnA: urlAfterSwitch.includes(`/ai/${sessionA}`),
  iframeStayedOnA: String(iframeSrc || '').includes(sessionA),
  iframeDidNotOpenB: !String(iframeSrc || '').includes(sessionB),
  switcherShowsB: String(buttonTitle || '').includes('repro-b'),
}
await writeFile(join(outDir, 'page-list-follow.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
if (!report.listIgnoredCreate || !report.reloadShowsCreate || !report.urlStayedOnA || !report.iframeStayedOnA || !report.switcherShowsB) {
  process.exit(1)
}
