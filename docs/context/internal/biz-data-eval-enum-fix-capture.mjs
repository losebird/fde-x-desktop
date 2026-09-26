import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE = '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const TAIL = '只要预览，不要过账，不要 biz_write。'

const SHOTS = [
  { short: 'ticket-resolved', kind: '工单', speech: `已解决的工单。${TAIL}`, want: 121 },
  { short: 'ticket-closed', kind: '工单', speech: `已关闭的工单。${TAIL}`, want: 115 },
  { short: 'supplier-a', kind: '供应商', speech: `A的供应商。${TAIL}`, want: 19 },
  { short: 'project-active', kind: '项目', speech: `进行中的项目。${TAIL}`, want: 96 },
  { short: 'movement-transfer', kind: '出入库流水', speech: `库存调拨的出入库流水。${TAIL}`, want: 47 },
]

async function bffJson(path, { method = 'GET', body, timeoutMs = 20000 } = {}) {
  const res = await fetch(`${bffBase}${path}`, {
    method,
    headers: { accept: 'application/json', Origin: mainBase, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  })
  return { json: await res.json().catch(() => ({})) }
}

const ws = ((await bffJson('/api/v1/workspaces')).json?.data?.items || (await bffJson('/api/v1/workspaces')).json?.items || [])
  .find((r) => String(r?.cwd || '') === DATA)
const workspaceId = String(ws?.id || '1985293d-03bb-496f-ad69-5c7f2ac23149')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

function seedState(sessionId) {
  return page.evaluate(({ wsId, cwd, sid }) => {
    const key = 'scene-39-workstation'
    const state = JSON.parse(localStorage.getItem(key) || '{"state":{}}')
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeDataSubview = 'records'
    state.state.activeAiSessionId = sid
    const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
    if (!rows.some((r) => r.id === wsId)) rows.push({ id: wsId, name: 'fdex测试1', desc: cwd, cwd })
    else state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, cwd, desc: cwd } : r))
    const panels = Array.isArray(state.state.panels) ? state.state.panels : []
    state.state.panels = panels.map((p) => {
      if (p?.id === 'data') return { ...p, state: 'full', width: 1100 }
      if (p && (p.state === 'full' || p.state === 'half')) return { ...p, state: 'tab' }
      return p
    })
    localStorage.setItem(key, JSON.stringify(state))
  }, { wsId: workspaceId, cwd: DATA, sid: sessionId })
}

await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded' })
await mkdir(`${STORE}/media`, { recursive: true })

for (const c of SHOTS) {
  const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId } })
  const sessionId = String(created.json?.data?.sessionId || '').trim()
  await bffJson('/api/v1/biz/preview', {
    method: 'POST',
    body: { cwd: DATA, sessionId, kind: c.kind, action: '现查', speech: c.speech },
  })
  await seedState(sessionId)
  await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 10000 }).catch(() => {})
  for (let i = 0; i < 40; i += 1) {
    const footer = await page.evaluate(() => document.querySelector('[data-records-footer]')?.getAttribute('data-records-footer') || '')
    const n = Number((footer.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    if (n === c.want) break
    await page.waitForTimeout(500)
  }
  const dest = `${STORE}/media/biz-data-eval-enum-fix-${c.short}.png`
  await page.screenshot({ path: dest, fullPage: false })
  console.log(c.short, dest)
}
await browser.close()
console.log('commit', execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim())
