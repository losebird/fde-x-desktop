import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile } from 'node:fs/promises'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const reportPath = `${STORE}/internal/biz-data-eval-manager-adv.json`

const report = JSON.parse(await readFile(reportPath, 'utf8'))

async function bffJson(path) {
  const res = await fetch(`${bffBase}${path}`, {
    headers: { accept: 'application/json', Origin: mainBase },
    signal: AbortSignal.timeout(30000),
  })
  return (await res.json().catch(() => ({})))
}

async function official(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const json = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  const sheet = json?.data?.sheet
  return sheet && typeof sheet === 'object' ? sheet : null
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

async function readUi(page, spotManagerColumn) {
  return page.evaluate((wantMgr) => {
    const footerEl = document.querySelector('[data-records-footer]')
    const footerAttr = footerEl?.getAttribute('data-records-footer') || ''
    const hitTotalStateAttr = footerEl?.getAttribute('data-hit-total-state') || ''
    const footerVisible = (footerEl?.textContent || '').replace(/\s+/g, ' ').trim()
    const footerCount = Number((footerAttr.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const tableBody = document.querySelector('table tbody')
    const visibleRowCount = tableBody ? tableBody.querySelectorAll('tr').length : 0
    const pagination =
      [...document.querySelectorAll('span')]
        .map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim())
        .find((t) => /^第\s+\d+\s+\/\s+\d+\s+页/.test(t)) || ''
    const planCandidates = [...document.querySelectorAll('button, [role="combobox"]')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.includes('现查') && t.length < 240)
    const planLine = planCandidates.find((t) => t.length > 4) || planCandidates[0] || ''
    let managerColumnEmpty = null
    if (wantMgr && tableBody) {
      const headers = [...document.querySelectorAll('table thead th')].map((th) =>
        (th.textContent || '').replace(/\s+/g, ' ').trim(),
      )
      const idx = headers.findIndex((h) => /直属上级|上级/.test(h))
      if (idx >= 0) {
        const cells = [...tableBody.querySelectorAll('tr')].slice(0, 8).map((tr) => {
          const td = tr.querySelectorAll('td')[idx]
          return (td?.textContent || '').replace(/\s+/g, ' ').trim()
        })
        managerColumnEmpty = cells.every((t) => t === '' || t === '—' || t === '-')
      }
    }
    return {
      footerAttr,
      footerVisible,
      footerCount: Number.isFinite(footerCount) ? footerCount : null,
      hitTotalStateAttr,
      pagination,
      visibleRowCount,
      planLine,
      managerColumnEmpty,
    }
  }, spotManagerColumn)
}

const wsPayload = await bffJson('/api/v1/workspaces')
const ws = (wsPayload?.data?.items || wsPayload?.items || []).find((r) => String(r?.cwd || r?.description || '') === DATA)
const workspaceId = String(ws?.id || '')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })

for (const row of report.cases) {
  const cShort = row.short
  const spot = cShort.startsWith('manager-')
  await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await seedState(page, workspaceId, row.sessionId)
  await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 15000 }).catch(() => {})
  let sheet = null
  let ui = null
  let stable = 0
  let lastKey = ''
  for (let i = 0; i < 100; i += 1) {
    sheet = await official(row.sessionId)
    ui = await readUi(page, spot)
    const footerReady =
      ui.footerAttr === '总数未知' ||
      ui.footerAttr === '不完整' ||
      /^共\s+\d+\s+条/.test(ui.footerAttr)
    const rowsReady = ui.visibleRowCount > 0
    const planOk = Boolean(ui.planLine)
    const key = `${sheet?.kind}|${ui.footerAttr}|${sheet?.hitTotal}|${ui.pagination}`
    if (footerReady && rowsReady && planOk && sheet?.kind) {
      if (key === lastKey) stable += 1
      else stable = 0
      lastKey = key
      if (stable >= 3) break
    } else {
      stable = 0
      lastKey = key
    }
    await page.waitForTimeout(500)
  }
  row.rightHitTotal = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  row.hitTotalState = sheet?.hitTotalState || ui.hitTotalStateAttr || null
  row.sheetKind = sheet?.kind || null
  row.footerText = ui.footerVisible
  row.footerAttr = ui.footerAttr
  row.pagination = ui.pagination
  row.planLine = ui.planLine
  row.visibleRowCount = ui.visibleRowCount
  row.managerColumnEmpty = ui.managerColumnEmpty
  if (row.managerColumnEmpty === true) {
    row.note = [row.note, '直属上级列可见行为空'].filter(Boolean).join('；').replace(/^；/, '')
  }
  const lib = report.library.byCase[cShort]
  const full = report.library.full[
    cShort.startsWith('manager') || cShort === 'subordinates'
      ? 'biz_employees'
      : cShort === 'warehouse-semi'
        ? 'biz_warehouses'
        : cShort === 'supplier-c'
          ? 'biz_suppliers'
          : 'biz_stock_movements'
  ]
  let pierced = false
  const notes = []
  if (!row.footerAttr) {
    pierced = true
    notes.push('未见页脚')
  }
  if (row.rightHitTotal === full && lib !== full) {
    pierced = true
    notes.push(`整表 ${full}`)
  }
  const footerCount = ui.footerCount
  if (footerCount === full && lib !== full) {
    pierced = true
    notes.push(`页脚整表 ${full}`)
  }
  if (cShort.startsWith('manager') && (row.rightHitTotal === 15 || footerCount === 15)) {
    pierced = true
    notes.push('误落下属侧 15')
  }
  if (cShort === 'subordinates' && (row.rightHitTotal === 80 || footerCount === 80)) {
    pierced = true
    notes.push('误落有上级侧 80')
  }
  if (row.rightHitTotal != null && lib != null && row.rightHitTotal !== lib) {
    pierced = true
    notes.push(`rightHit=${row.rightHitTotal} 库=${lib}`)
  }
  if (footerCount != null && lib != null && footerCount !== lib) {
    pierced = true
    notes.push(`页脚=${footerCount} 库=${lib}`)
  }
  if (row.rightHitTotal != null && footerCount != null && row.rightHitTotal !== footerCount) {
    pierced = true
    notes.push('页脚与 hitTotal 不一致')
  }
  row.pierced = pierced
  row.pass =
    !pierced &&
    lib != null &&
    row.rightHitTotal === lib &&
    footerCount === lib &&
    row.hitTotalState === 'known' &&
    row.sheetKind === report.cases.find((x) => x.short === cShort)?.sheetKind
  if (notes.length) row.note = notes.join('；')
  else if (!row.note || row.note === '未见页脚') row.note = '库、右边、页脚一致'

  const shot = row.screenshot
  const footerEl = page.locator('[data-records-footer]')
  await footerEl.scrollIntoViewIfNeeded().catch(() => {})
  const box = await footerEl.boundingBox().catch(() => null)
  if (box) {
    await page.screenshot({
      path: shot,
      clip: {
        x: Math.max(0, box.x - 40),
        y: Math.max(0, box.y - (cShort === 'movement-production' ? 220 : 520)),
        width: Math.min(1120, 1580),
        height: Math.min(cShort === 'movement-production' ? 260 : 580, 1100),
      },
    })
  }
}

await browser.close()

const managers = report.cases.filter((r) => r.short.startsWith('manager-'))
report.managerFootersMatch =
  managers.length === 2 &&
  managers[0].footerAttr === managers[1].footerAttr &&
  managers[0].footerText === managers[1].footerText &&
  managers[0].rightHitTotal === managers[1].rightHitTotal &&
  managers[0].pagination === managers[1].pagination
if (!report.managerFootersMatch) {
  for (const r of managers) {
    r.pierced = true
    r.pass = false
    r.note = `${r.note}；两遍页脚不一致`.replace(/^；/, '')
  }
}
const codePierced =
  report.codeAudit.ensurePlanSelfHopHardcode.pierced || report.codeAudit.lookupJsRowsLengthHitTotal.pierced
report.allPass = report.cases.every((r) => r.pass) && report.managerFootersMatch && !codePierced

await writeFile(reportPath, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ allPass: report.allPass, cases: report.cases.map((r) => ({ short: r.short, pass: r.pass, footerAttr: r.footerAttr, hit: r.rightHitTotal, pagination: r.pagination })) }, null, 2))
