import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'

const short = process.argv[2]
const CASES = {
  'stock-movements': {
    speech: '现查商品物料的出入库流水。只要预览，不要过账，不要 biz_write。',
    expectKind: '出入库流水',
    expectFrom: '商品物料',
    libraryHit: 5135,
  },
  warehouse: {
    speech: '现查仓库的出入库流水。只要预览，不要过账，不要 biz_write。',
    expectKind: '出入库流水',
    expectFrom: '仓库',
    libraryHit: 5135,
  },
}
const c = CASES[short]
if (!c) throw new Error('bad short')

const STORE = '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'

async function bffJson(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${bffBase}${path}`, {
    method,
    headers: { accept: 'application/json', Origin: mainBase, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { json: await res.json().catch(() => ({})) }
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
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
if (!sessionId) throw new Error('no session')

await page.evaluate(({ wsId, cwd, sid }) => {
  const key = 'scene-39-workstation'
  const state = JSON.parse(localStorage.getItem(key) || '{"state":{}}')
  state.state = state.state || {}
  state.state.activeWorkspaceId = wsId
  state.state.activeDataSubview = 'records'
  state.state.activeAiSessionId = sid
  localStorage.setItem(key, JSON.stringify(state))
}, { wsId: workspaceId, cwd: DATA, sid: sessionId })

await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded' })
await page.getByRole('button', { name: '业务记录', exact: true }).click().catch(() => {})
await page.waitForTimeout(1000)
await bffJson('/api/v1/biz/pending-sheet/dismiss', { method: 'POST', body: { sessionId, cwd: DATA } })

await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, { method: 'POST', body: { text: c.speech } })
const end = Date.now() + 300000
let saw = false
while (Date.now() < end) {
  const running = Boolean((await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`)).json?.data?.running)
  if (running) saw = true
  if (saw && !running) break
  await page.waitForTimeout(1500)
}

const waitEnd = Date.now() + 120000
let sheet = null
let ui = null
while (Date.now() < waitEnd) {
  const pending = await bffJson(`/api/v1/biz/pending-sheet?sessionId=${encodeURIComponent(sessionId)}&cwd=${encodeURIComponent(DATA)}`)
  sheet = pending.json?.data?.sheet
  ui = await page.evaluate(() => {
    const footerEl = document.querySelector('[data-records-footer]')
    const footer = footerEl?.getAttribute('data-records-footer') || ''
    const footerCount = Number((footer.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const chips = [...document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap button.btn')].map((b) => b.textContent?.replace(/\s+/g, '') || '')
    const banner = document.querySelector('div.border-blue-200.bg-blue-50')?.textContent?.replace(/\s+/g, ' ') || ''
    const rows = document.querySelectorAll('tbody tr').length
    const pageLine = [...document.querySelectorAll('span')].map((s) => s.textContent?.trim() || '').find((t) => /^第\s+\d+/.test(t)) || ''
    return { footer, footerCount, chips, banner, rows, pageLine }
  })
  const hit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  if (sheet?.kind === c.expectKind && hit === c.libraryHit && ui.footerCount === c.libraryHit && ui.banner.includes(c.expectFrom)) break
  await page.waitForTimeout(1200)
}

const dest = `${STORE}/media/biz-data-eval-missing-total-adv-${short}.png`
await page.screenshot({ path: dest, fullPage: false })
console.log(JSON.stringify({ short, sessionId, sheet: { kind: sheet?.kind, hitTotal: sheet?.hitTotal }, ui }, null, 2))
await browser.close()
