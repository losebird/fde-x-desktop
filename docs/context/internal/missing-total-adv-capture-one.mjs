import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'

const STORE = '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const short = process.argv[2] || 'product'
const speeches = {
  product: '现查商品物料的出入库流水。只要预览，不要过账，不要 biz_write。',
  roles: '现查{{t("Departments")}}的{{t("Roles")}}。只要预览，不要过账，不要 biz_write。',
}
const speech = speeches[short]
if (!speech) throw new Error('unknown short')

async function bffJson(path, { method = 'GET', body, timeoutMs = 20000 } = {}) {
  const res = await fetch(`${bffBase}${path}`, {
    method,
    headers: { accept: 'application/json', Origin: mainBase, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  })
  return { json: await res.json().catch(() => ({})) }
}

const ws = ((await bffJson('/api/v1/workspaces')).json?.data?.items || []).find((r) => String(r?.cwd || r?.description || '') === DATA)
const workspaceId = String(ws?.id || '')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

function seedState(sessionId) {
  return page.evaluate(({ wsId, workspaceCwd: cwd, sessionId: sid }) => {
    const key = 'scene-39-workstation'
    const state = JSON.parse(localStorage.getItem(key) || '{"state":{}}')
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeDataSubview = 'records'
    state.state.activeAiSessionId = sid
    const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
    if (!rows.some((r) => r.id === wsId)) rows.push({ id: wsId, name: 'fdex测试1', desc: cwd, cwd })
    state.state.workspaces = rows
    const panels = Array.isArray(state.state.panels) ? state.state.panels : []
    state.state.panels = panels.map((p) => {
      if (p?.id === 'data') return { ...p, state: 'full', width: 1100 }
      if (p && (p.state === 'full' || p.state === 'half')) return { ...p, state: 'tab' }
      return p
    })
    localStorage.setItem(key, JSON.stringify(state))
  }, { wsId: workspaceId, workspaceCwd: DATA, sessionId })
}

await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded' })
if (!(await bffJson('/api/v1/ai/status')).json?.data?.connected) {
  await bffJson('/api/v1/ai/connect', { method: 'POST', body: {} })
}
for (let i = 0; i < 45; i += 1) {
  if ((await bffJson('/api/v1/ai/status')).json?.data?.connected) break
  await page.waitForTimeout(1000)
}

const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId } })
const sessionId = created.json?.data?.sessionId
await seedState(sessionId)
await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded' })
await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 10000 }).catch(() => {})
await page.waitForTimeout(1500)

await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, { method: 'POST', body: { text: speech } })
const deadline = Date.now() + 240000
let saw = false
while (Date.now() < deadline) {
  const running = Boolean((await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`)).json?.data?.running)
  if (running) saw = true
  if (saw && !running) break
  await page.waitForTimeout(1200)
}
for (let i = 0; i < 60; i += 1) {
  const panel = await page.evaluate(() => document.querySelector('[data-records-footer]')?.getAttribute('data-records-footer') || '')
  const want = short === 'roles' ? '共 0 条' : '共 5135 条'
  if (panel.startsWith(want.split(' ')[0] + ' ' + want.split(' ')[1])) break
  await page.waitForTimeout(1000)
}
const dest = `${STORE}/media/biz-data-eval-missing-total-adv-${short}.png`
await page.screenshot({ path: dest, fullPage: false })
const sheet = (await bffJson(`/api/v1/biz/pending-sheet?sessionId=${encodeURIComponent(sessionId)}&cwd=${encodeURIComponent(DATA)}`)).json?.data?.sheet
console.log(JSON.stringify({ short, dest, footer: await page.evaluate(() => document.querySelector('[data-records-footer]')?.textContent), sheetHitTotal: sheet?.hitTotal, kind: sheet?.kind }, null, 2))
await browser.close()
