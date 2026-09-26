import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile } from 'node:fs/promises'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'

const report = JSON.parse(await readFile(`${STORE}/internal/biz-data-eval-enum-footer-adv.json`, 'utf8'))
const writeJs = await readFile(`${REPO}/runtime/vendor-overlays/dsh-lan-assist/write.js`, 'utf8')
const lookupJs = await readFile(`${REPO}/runtime/vendor-overlays/dsh-lan-assist/lookup.js`, 'utf8')
const recordsSnippet = await readFile(`${REPO}/src/components/biz/RecordsPanel.tsx`, 'utf8')
const footerFn = recordsSnippet.match(/function hitFooterText[\s\S]*?^}/m)?.[0] || ''

report.codeAudit = {
  recordsPanelHitFooterTextFn: footerFn,
  hitFooterTextStillUsesShownCount: /\$\{shown\}/.test(footerFn),
  hitFooterTextUsesHitTotalNotShown:
    footerFn.includes('sheet.hitTotal') && !/\$\{shown\}/.test(footerFn),
  hitFooterTextUnknownWhenNoQueryTotal: footerFn.includes("return '总数未知'"),
  writeJsPeerHitTotalBlock: writeJs.split('\n').slice(830, 852).join('\n'),
  writeJsAssignsMatchesLengthToHitTotal: /hitTotal\s*=\s*[^;\n]*matches\.length/.test(writeJs),
  writeJsAssignsPageRowsToHitTotal: /hitTotal\s*:\s*[^,\n}]*rows\.length/.test(writeJs),
  lookupJsRowLengthHitTotalFallback: /hitTotal:\s*rows\.length/.test(lookupJs),
  lookupJsListedRowsLengthFallback: /listed\.rows\.length \? \{ hitTotal: listed\.rows\.length \}/.test(lookupJs),
}

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
    const pagination =
      [...document.querySelectorAll('span')]
        .map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim())
        .find((t) => /^第\s+\d+\s+\/\s+\d+\s+页/.test(t)) || ''
    const tableBody = document.querySelector('table tbody')
    const visibleRowCount = tableBody ? tableBody.querySelectorAll('tr').length : 0
    const kindChip =
      document.querySelector('[data-biz-kind-chip]')?.textContent?.trim() ||
      [...document.querySelectorAll('h2,h3,button,span')]
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .find((t) => /^(仓库|供应商|出入库流水|员工档案)(\s|$)/.test(t)) ||
      ''
    let emptyManagerCells = null
    if (wantMgr && tableBody) {
      const headers = [...document.querySelectorAll('table thead th')].map((th) =>
        (th.textContent || '').replace(/\s+/g, '').trim(),
      )
      const idx = headers.findIndex((h) => h.includes('直属上级'))
      if (idx >= 0) {
        emptyManagerCells = [...tableBody.querySelectorAll('tr')].filter((tr) => {
          const cell = tr.querySelectorAll('td')[idx]
          return cell && !(cell.textContent || '').trim()
        }).length
      }
    }
    return {
      footerAttr,
      footerVisible,
      footerCount: Number.isFinite(footerCount) ? footerCount : null,
      hitTotalStateAttr,
      pagination,
      visibleRowCount,
      objectChip: kindChip,
      emptyManagerCells,
    }
  }, spotManagerColumn)
}

async function official(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  const sheet = json?.data?.sheet
  return sheet && typeof sheet === 'object' ? sheet : null
}

const expectKind = {
  'warehouse-semi': '仓库',
  'warehouse-mixed': '仓库',
  'supplier-c': '供应商',
  'movement-production': '出入库流水',
  'spot-manager': '员工档案',
}

function reassess(c, lib, sheet, ui) {
  const libraryHit = lib.byCase[c.short]
  const fullTable =
    c.short === 'spot-manager'
      ? lib.full.biz_employees
      : {
          'warehouse-semi': lib.full.biz_warehouses,
          'warehouse-mixed': lib.full.biz_warehouses,
          'supplier-c': lib.full.biz_suppliers,
          'movement-production': lib.full.biz_stock_movements,
        }[c.short]
  const rightHit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  const hitTotalState = String(sheet?.hitTotalState || ui.hitTotalStateAttr || '')
  const sheetKind = sheet?.kind || null
  const notes = []
  let pierced = false

  if (!ui.footerAttr || !ui.footerVisible) {
    pierced = true
    notes.push('未见页脚')
  } else if (
    ui.footerAttr !== '总数未知' &&
    ui.footerAttr !== '不完整' &&
    !ui.footerVisible.startsWith(ui.footerAttr)
  ) {
    pierced = true
    notes.push(`attr 与可见不一致 attr=${ui.footerAttr} visible=${ui.footerVisible}`)
  }
  if (ui.hitTotalStateAttr && hitTotalState && ui.hitTotalStateAttr !== hitTotalState) {
    pierced = true
    notes.push(`data-hit-total-state=${ui.hitTotalStateAttr} sheet=${hitTotalState}`)
  }
  const ek = expectKind[c.short]
  if (ek && sheetKind !== ek) {
    pierced = true
    notes.push(`sheet.kind=${sheetKind} 期望 ${ek}`)
  }
  if (c.short === 'spot-manager' && rightHit === fullTable) {
    pierced = true
    notes.push(`员工整表 ${fullTable}`)
  }
  if (libraryHit != null && rightHit != null && rightHit !== libraryHit) {
    pierced = true
    notes.push(`rightHit=${rightHit} 库=${libraryHit}`)
  }
  const footerCount = ui.footerCount
  if (libraryHit != null && footerCount != null && footerCount !== libraryHit) {
    pierced = true
    notes.push(`页脚=${footerCount} 库=${libraryHit}`)
  }
  if (rightHit != null && footerCount != null && rightHit !== footerCount) {
    pierced = true
    notes.push('页脚与 hitTotal 不一致')
  }
  if (fullTable != null && rightHit === fullTable && libraryHit !== fullTable) {
    pierced = true
    notes.push(`rightHit 整表 ${fullTable}`)
  }
  if (fullTable != null && footerCount === fullTable && libraryHit !== fullTable) {
    pierced = true
    notes.push(`页脚整表 ${fullTable}`)
  }
  if (c.short === 'spot-manager' && ui.emptyManagerCells > 0) {
    notes.push(`本页直属上级空单元格 ${ui.emptyManagerCells} 格`)
  }

  const pass =
    !pierced &&
    libraryHit != null &&
    rightHit === libraryHit &&
    footerCount === libraryHit &&
    hitTotalState === 'known' &&
    sheetKind === ek

  return {
    libraryHit,
    fullTable,
    rightHitTotal: rightHit,
    hitTotalState: hitTotalState || null,
    sheetKind,
    objectChip: ui.objectChip || null,
    footerText: ui.footerVisible,
    footerAttr: ui.footerAttr,
    dataRecordsFooter: ui.footerAttr,
    dataHitTotalState: ui.hitTotalStateAttr || null,
    pagination: ui.pagination,
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
  let stable = 0
  let lastKey = ''
  const ek = expectKind[c.short]
  for (let i = 0; i < 80; i += 1) {
    sheet = await official(c.sessionId)
    ui = await readUi(page, c.short === 'spot-manager')
    const key = `${sheet?.kind}|${ui.footerAttr}|${ui.hitTotalStateAttr}|${ui.visibleRowCount}|${sheet?.hitTotal}`
    const aligned =
      ui.footerAttr &&
      ui.visibleRowCount > 0 &&
      sheet?.kind === ek &&
      (ui.footerAttr === '总数未知' || ui.footerAttr === '不完整' || /^共\s+\d+\s+条/.test(ui.footerAttr))
    if (aligned) {
      if (key === lastKey) stable += 1
      else stable = 0
      lastKey = key
      if (stable >= 2) break
    } else {
      stable = 0
      lastKey = key
    }
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
        y: Math.max(0, box.y - (c.short === 'movement-production' ? 220 : 520)),
        width: Math.min(1120, 1580),
        height: Math.min(c.short === 'movement-production' ? 260 : 580, 1100),
      },
    })
  } else {
    await page.screenshot({ path: c.screenshot, fullPage: false })
  }
  Object.assign(c, reassess(c, report.library, sheet, ui))
}

await browser.close()

const fallbacksRemain =
  report.codeAudit.hitFooterTextStillUsesShownCount ||
  report.codeAudit.writeJsAssignsMatchesLengthToHitTotal ||
  report.codeAudit.writeJsAssignsPageRowsToHitTotal ||
  report.codeAudit.lookupJsRowLengthHitTotalFallback ||
  report.codeAudit.lookupJsListedRowsLengthFallback

report.lookupJsRowLengthHitTotalFallback = fallbacksRemain
report.allPass = report.cases.every((r) => r.pass) && !fallbacksRemain
await writeFile(`${STORE}/internal/biz-data-eval-enum-footer-adv.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report.cases.map((c) => ({ short: c.short, pass: c.pass, pierced: c.pierced, footerAttr: c.footerAttr, pagination: c.pagination })), null, 2))
