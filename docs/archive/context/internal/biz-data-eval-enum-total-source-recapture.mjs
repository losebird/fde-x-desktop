import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile } from 'node:fs/promises'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'

const report = JSON.parse(await readFile(`${STORE}/internal/biz-data-eval-enum-total-source.json`, 'utf8'))

async function bffJson(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${bffBase}${path}`, {
    method,
    headers: { accept: 'application/json', Origin: mainBase, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { json: await res.json().catch(() => ({})) }
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
      else state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
      const panels = Array.isArray(state.state.panels) ? state.state.panels : []
      state.state.panels = panels.map((p) => {
        if (p?.id === 'data') return { ...p, state: 'full', width: 1100 }
        if (p && (p.state === 'full' || p.state === 'half')) return { ...p, state: 'tab' }
        return p
      })
      localStorage.setItem(key, JSON.stringify(state))
    },
    { wsId: workspaceId, cwd: DATA, sid: sessionId },
  )
}

const wsPayload = (await bffJson('/api/v1/workspaces')).json
const ws = (wsPayload?.data?.items || wsPayload?.items || []).find((r) => String(r?.cwd || r?.description || '') === DATA)
const workspaceId = String(ws?.id || '')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })

for (const c of report.cases) {
  await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await seedState(page, workspaceId, c.sessionId)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 15000 })
  let footerText = ''
  for (let i = 0; i < 100; i += 1) {
    footerText = await page.evaluate(() => document.querySelector('[data-records-footer]')?.getAttribute('data-records-footer') || '')
    if (footerText && footerText !== '共 0 条') break
    await page.waitForTimeout(400)
  }
  const footerEl = page.locator('[data-records-footer]')
  await footerEl.scrollIntoViewIfNeeded().catch(() => {})
  const box = await footerEl.boundingBox().catch(() => null)
  if (box) {
    await page.screenshot({
      path: c.screenshot,
      clip: {
        x: Math.max(0, box.x - 40),
        y: Math.max(0, box.y - (c.short === 'product-movements' ? 220 : 520)),
        width: Math.min(1120, 1580),
        height: Math.min(c.short === 'product-movements' ? 260 : 580, 1100),
      },
    })
  } else {
    await page.screenshot({ path: c.screenshot, fullPage: false })
  }
  c.footerText = footerText
  c.footer = Number((footerText.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
  c.footer = Number.isFinite(c.footer) ? c.footer : null
  const lib = report.library.byCase[c.short]
  c.pass =
    !c.pierced &&
    c.rightHitTotal === lib &&
    (c.footerText === `共 ${lib} 条` || (c.hitTotalState === 'unknown' && c.footerText === '总数未知' && c.rightHitTotal == null))
  c.passMode = c.pass ? (c.footerText === '总数未知' ? 'unknown-footer' : 'known-from-query') : 'fail'
}

await browser.close()
report.allPass = report.cases.every((c) => c.pass)
await writeFile(`${STORE}/internal/biz-data-eval-enum-total-source.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report.cases.map((c) => ({ short: c.short, footerText: c.footerText, pass: c.pass })), null, 2))
