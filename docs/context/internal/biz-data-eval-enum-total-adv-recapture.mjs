import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile } from 'node:fs/promises'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'

const report = JSON.parse(await readFile(`${STORE}/internal/biz-data-eval-enum-total-adv.json`, 'utf8'))

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

async function readUi(page) {
  return page.evaluate(() => {
    const footerEl = document.querySelector('[data-records-footer]')
    const footerAttr = footerEl?.getAttribute('data-records-footer') || ''
    const hitTotalStateAttr = footerEl?.getAttribute('data-hit-total-state') || ''
    const footerVisible = (footerEl?.textContent || '').replace(/\s+/g, ' ').trim()
    const footerCount = Number((footerAttr.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const visibleCount = Number((footerVisible.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const pagination =
      [...document.querySelectorAll('span')]
        .map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim())
        .find((t) => /^第\s+\d+\s+\/\s+\d+\s+页/.test(t)) || ''
    const kindChip =
      [...document.querySelectorAll('button.btn')]
        .filter((el) => el.className.includes('bg-ink'))
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())[0] || ''
    const tableBody = document.querySelector('table tbody')
    const visibleRowCount = tableBody ? tableBody.querySelectorAll('tr').length : 0
    return {
      footerAttr,
      footerVisible,
      footerCount: Number.isFinite(footerCount) ? footerCount : null,
      visibleCount: Number.isFinite(visibleCount) ? visibleCount : null,
      hitTotalStateAttr,
      pagination,
      kindChip,
      visibleRowCount,
    }
  })
}

async function official(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  const sheet = json?.data?.sheet
  return sheet && typeof sheet === 'object' ? sheet : null
}

function reassess(c, lib, sheet, ui) {
  const libraryHit = lib.byCase[c.short]
  const fullTable = c.short === 'product-movements'
    ? lib.full.biz_stock_movements
    : c.short === 'spot-manager'
      ? lib.full.biz_employees
      : lib.full[
          {
            'warehouse-semi': 'biz_warehouses',
            'warehouse-mixed': 'biz_warehouses',
            'supplier-c': 'biz_suppliers',
            'movement-production': 'biz_stock_movements',
          }[c.short]
        ]
  const rightHit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  const hitTotalState = String(sheet?.hitTotalState || ui.hitTotalStateAttr || '')
  const sheetKind = sheet?.kind || null
  const notes = []
  let pierced = false

  if (!ui.footerAttr && !ui.footerVisible) {
    pierced = true
    notes.push('未见业务记录页脚')
  }
  if (ui.footerAttr && ui.footerVisible) {
    const attrN = ui.footerAttr.match(/共\s+(\d+)\s+条/)
    const visN = ui.footerVisible.match(/共\s+(\d+)\s+条/)
    if (attrN && visN && attrN[1] !== visN[1]) {
      pierced = true
      notes.push(`打穿：attr=${ui.footerAttr} visible=${ui.footerVisible}`)
    }
  }

  const expectKind =
    c.short === 'spot-manager'
      ? null
      : { 'warehouse-semi': '仓库', 'warehouse-mixed': '仓库', 'supplier-c': '供应商', 'movement-production': '出入库流水', 'product-movements': '出入库流水' }[
          c.short
        ]
  if (expectKind && sheetKind !== expectKind) {
    pierced = true
    notes.push(`sheet.kind=${sheetKind} 期望 ${expectKind}`)
  }
  if (c.short === 'spot-manager' && rightHit === fullTable) {
    pierced = true
    notes.push('员工整表 120')
  }
  if (libraryHit != null && rightHit != null && rightHit !== libraryHit) {
    pierced = true
    notes.push(`hitTotal=${rightHit} 库=${libraryHit}`)
  }
  if (libraryHit != null && ui.footerCount != null && ui.footerCount !== libraryHit) {
    pierced = true
    notes.push(`页脚=${ui.footerCount} 库=${libraryHit}`)
  }
  if (rightHit != null && ui.footerCount != null && rightHit !== ui.footerCount) {
    pierced = true
    notes.push('页脚与 hitTotal 不一致')
  }
  if (fullTable != null && rightHit === fullTable && libraryHit !== fullTable && c.short !== 'product-movements') {
    pierced = true
    notes.push(`rightHit 整表 ${fullTable}`)
  }
  if (fullTable != null && ui.footerCount === fullTable && libraryHit !== fullTable && c.short !== 'product-movements') {
    pierced = true
    notes.push(`页脚整表 ${fullTable}`)
  }
  if (c.short === 'product-movements') {
    if (rightHit === fullTable || ui.footerCount === fullTable) {
      notes.push(`与流水整表相同（${fullTable}）`)
    }
  }
  if (c.short === 'movement-production' && (rightHit === 0 || ui.footerCount === 0)) {
    pierced = true
    notes.push('生产领料为 0')
  }

  const pass =
    !pierced &&
    libraryHit != null &&
    rightHit === libraryHit &&
    ui.footerCount === libraryHit &&
    hitTotalState === 'known' &&
    (expectKind ? sheetKind === expectKind : rightHit !== fullTable)

  return {
    libraryHit,
    fullTable,
    rightHitTotal: rightHit,
    hitTotalState: hitTotalState || null,
    sheetKind,
    footerText: ui.footerVisible,
    footerAttr: ui.footerAttr,
    pagination: ui.pagination,
    kindChip: ui.kindChip,
    visibleRowCount: ui.visibleRowCount,
    pierced,
    pass,
    note: notes.join('；') || '库、右边、页脚一致',
  }
}

const wsPayload = (await bffJson('/api/v1/workspaces')).json
const ws = (wsPayload?.data?.items || wsPayload?.items || []).find((r) => String(r?.cwd || r?.description || '') === DATA)
const workspaceId = String(ws?.id || '')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })

for (const c of report.cases) {
  await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await seedState(page, workspaceId, c.sessionId)
  await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 15000 }).catch(() => {})
  let ui = null
  let sheet = null
  for (let i = 0; i < 80; i += 1) {
    sheet = await official(c.sessionId)
    ui = await readUi(page)
    if (ui.footerAttr && ui.visibleRowCount > 0 && sheet?.kind) break
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
  Object.assign(c, reassess(c, report.library, sheet, ui))
}

await browser.close()
report.allPass = report.cases.every((r) => r.pass)
await writeFile(`${STORE}/internal/biz-data-eval-enum-total-adv.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report.cases.map((c) => ({ short: c.short, pass: c.pass, pierced: c.pierced, footerText: c.footerText, footerAttr: c.footerAttr, pagination: c.pagination })), null, 2))
