import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { execSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const COMMIT = execSync('git -C "$REPO" rev-parse HEAD', { env: { REPO } }).toString().trim()
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'

async function bffJson(path, { method = 'GET', body, timeoutMs = 30000 } = {}) {
  const res = await fetch(`${bffBase}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      Origin: mainBase,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  })
  return { http: res.status, json: await res.json().catch(() => ({})) }
}

async function libraryCount() {
  const secrets = JSON.parse(await readFile('/Users/zxz/.dsh-fde-x/lan-assist/secrets.json', 'utf8'))
  const token = String(secrets.lookupToken || '')
  const filter = { managerId: { $notEmpty: true } }
  const q = `&filter=${encodeURIComponent(JSON.stringify(filter))}`
  const res = await fetch(`http://127.0.0.1:13000/api/biz_warehouses:list?page=1&pageSize=1${q}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
  })
  const body = await res.json()
  return Number(body?.meta?.count)
}

async function preview(speech, sessionId) {
  const { json } = await bffJson('/api/v1/biz/preview', {
    method: 'POST',
    body: { sessionId, cwd: DATA, kind: '仓库', action: '现查', speech },
  })
  const sheet = json?.data?.sheet || {}
  return {
    ok: !json?.error,
    error: json?.error || null,
    kind: sheet.kind || null,
    hitTotal: sheet.hitTotal ?? null,
    hitTotalState: sheet.hitTotalState || null,
    rowCount: Array.isArray(sheet.rows) ? sheet.rows.length : 0,
    steps: sheet.steps || null,
    fromKind: sheet.from?.kind || null,
  }
}

function seedState(page, workspaceId, sessionId) {
  return page.evaluate(
    ({ wsId, cwd, sid }) => {
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
      state.state.panels = panels.map((p) => (p?.id === 'data' ? { ...p, state: 'full', width: 1100 } : p))
      localStorage.setItem(key, JSON.stringify(state))
    },
    { wsId: workspaceId, cwd: DATA, sid: sessionId },
  )
}

const library = await libraryCount()
const wsPayload = (await bffJson('/api/v1/workspaces')).json
const ws = (wsPayload?.data?.items || wsPayload?.items || []).find((r) => String(r?.cwd || r?.description || '') === DATA)
const workspaceId = String(ws?.id || '')
if (!workspaceId) throw new Error('workspace-missing')

if (!(await bffJson('/api/v1/ai/status')).json?.data?.connected) {
  await bffJson('/api/v1/ai/connect', { method: 'POST', body: {}, timeoutMs: 120000 })
}

const cases = [
  { short: 'edge-speech', speech: '员工档案的仓库', session: `mw-eval-a-${Date.now()}` },
  { short: 'edge-speech-2', speech: '员工档案的仓库', session: `mw-eval-b-${Date.now() + 1}` },
]

const apiResults = []
for (const c of cases) {
  const row = await preview(c.speech, c.session)
  apiResults.push({
    ...c,
    library,
    pass: row.hitTotal === library && row.hitTotalState === 'known' && row.kind === '仓库',
    ...row,
  })
}

await mkdir(`${STORE}/media`, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId } })
const sessionId = String(created.json?.data?.sessionId || '').trim()
await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await seedState(page, workspaceId, sessionId)
await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await bffJson('/api/v1/biz/preview', {
  method: 'POST',
  body: { sessionId, cwd: DATA, kind: '仓库', action: '现查', speech: '员工档案的仓库' },
})
await page.waitForTimeout(2500)
const shot = `${STORE}/media/biz-data-eval-managed-warehouses-edge-speech.png`
await page.screenshot({ path: shot, fullPage: false })
await browser.close()

const report = {
  branch: 'cursor/eval-three-causes-2d90',
  commit: COMMIT,
  edge: { from: '员工档案', to: '仓库', field: 'managedWarehouses' },
  libraryCount: library,
  pushed: false,
  cases: apiResults.map((r) => ({
    short: r.short,
    speech: r.speech,
    sessionId: r.session,
    library: r.library,
    hitTotal: r.hitTotal,
    hitTotalState: r.hitTotalState,
    sheetKind: r.kind,
    rowCount: r.rowCount,
    steps: r.steps,
    fromKind: r.fromKind,
    pass: r.pass,
    screenshot: r.short === 'edge-speech' ? shot : undefined,
  })),
  adversarial: {
    reverseSpeech: await preview('仓库的员工档案', `mw-eval-rev-${Date.now()}`),
    fieldLabelSpeech: await preview('管理的仓库', `mw-eval-label-${Date.now()}`),
  },
  allPass: apiResults.every((r) => r.pass),
}

await writeFile(`${STORE}/internal/biz-data-eval-managed-warehouses.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ allPass: report.allPass, library, cases: apiResults.map((r) => r.hitTotal), shot }, null, 2))
