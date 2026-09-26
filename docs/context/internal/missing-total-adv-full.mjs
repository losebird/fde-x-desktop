import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const STORE = '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const COMMIT = '3dd20f6a3e30662aa0974906e2f1075896cf1edd'
const VITE_PID = 1985
const TURN_MS = 240000
const TAIL = '只要预览，不要过账，不要 biz_write。'

const CASES = [
  {
    short: 'product',
    edge: '商品物料 → 出入库流水（product）',
    field: 'product',
    speech: `现查商品物料的出入库流水。${TAIL}`,
    expectKind: '出入库流水',
    expectFrom: '商品物料',
    libraryKey: 'movementsWithProduct',
    fullKind: '出入库流水',
    parentFullKey: 'products',
  },
  {
    short: 'stock-movements',
    edge: '商品物料 → 出入库流水（stockMovements）',
    field: 'stockMovements',
    speech: `现查商品物料的出入库流水。${TAIL}`,
    expectKind: '出入库流水',
    expectFrom: '商品物料',
    libraryKey: 'movementsWithProduct',
    fullKind: '出入库流水',
    parentFullKey: 'products',
    sameSpeechAs: 'product',
  },
  {
    short: 'warehouse',
    edge: '仓库 → 出入库流水（warehouse）',
    field: 'warehouse',
    speech: `现查仓库的出入库流水。${TAIL}`,
    expectKind: '出入库流水',
    expectFrom: '仓库',
    libraryKey: 'movementsWithWarehouse',
    fullKind: '出入库流水',
    parentFullKey: 'warehouses',
  },
  {
    short: 'roles',
    edge: '{{t("Departments")}} → {{t("Roles")}}（roles）',
    field: 'roles',
    speech: `现查{{t("Departments")}}的{{t("Roles")}}。${TAIL}`,
    expectKind: '{{t("Roles")}}',
    expectFrom: '{{t("Departments")}}',
    libraryKey: 'deptRoleHits',
    fullKind: 'roles',
    parentFullKey: 'departments',
  },
]

async function bffJson(path, { method = 'GET', body, timeoutMs = 20000 } = {}) {
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

async function libraryCounts() {
  const secrets = JSON.parse(await readFile('/Users/zxz/.dsh-fde-x/lan-assist/secrets.json', 'utf8'))
  const token = String(secrets.lookupToken || '')
  const noco = async (path) => {
    const res = await fetch(`http://127.0.0.1:13000${path}`, {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`${res.status}`)
    return json
  }
  const meta = async (resource, filter) => {
    const q = filter ? `&filter=${encodeURIComponent(JSON.stringify(filter))}` : ''
    const body = await noco(`/api/${resource}:list?page=1&pageSize=1${q}`)
    const c = Number(body?.meta?.count)
    return Number.isFinite(c) ? c : null
  }
  const fk = (row, name) => {
    const raw = row?.[name] ?? row?.[`${name}Id`]
    if (raw == null) return ''
    if (typeof raw === 'object') return String(raw.id ?? '').trim()
    return String(raw).trim()
  }
  const walkFk = async (resource) => {
    let hit = 0
    let page = 1
    while (page < 300) {
      const body = await noco(`/api/${resource}:list?page=${page}&pageSize=200&sort=id&fields=product,productId,warehouse,warehouseId`)
      const rows = body.data || []
      for (const r of rows) {
        if (fk(r, 'product') || fk(r, 'productId')) hit += 1
      }
      if (!rows.length || rows.length < 200) break
      page += 1
    }
    return hit
  }
  const mov = 'biz_stock_movements'
  const prod = 'biz_products'
  const wh = 'biz_warehouses'
  const roles = 'roles'
  const depts = 'departments'
  const withProduct = await walkFk(mov)
  const withWarehouse = await meta(mov, { warehouseId: { $notEmpty: true } }).catch(() => withProduct)
  return {
    movementsWithProduct: withProduct,
    movementsWithWarehouse: withWarehouse,
    deptRoleHits: await meta('departmentsRoles'),
    full: {
      movements: await meta(mov),
      products: await meta(prod),
      warehouses: await meta(wh),
      roles: await meta(roles),
      departments: await meta(depts),
    },
    fkNote: 'product 与 stockMovements 均走流水表 product/productId 外键；仓库走 warehouse/warehouseId。部门→角色数 departmentsRoles 关联表行数。',
  }
}

function seedState(page, workspaceId, sessionId) {
  return page.evaluate(({ wsId, cwd, sid }) => {
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
  }, { wsId: workspaceId, cwd: DATA, sid: sessionId })
}

async function readUi(page) {
  return page.evaluate(() => {
    const chipWrap = [...document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap')]
      .find((el) => [...el.querySelectorAll('button.btn')].length)
    const kindChipEls = chipWrap ? [...chipWrap.querySelectorAll('button.btn')] : []
    const kindChips = kindChipEls.map((b) => b.textContent?.replace(/\s+/g, ' ').trim() || '')
    const footerEl = document.querySelector('[data-records-footer]')
    const footerAttr = footerEl?.getAttribute('data-records-footer') || ''
    const footer = footerAttr || [...document.querySelectorAll('span')].map((s) => s.textContent?.trim() || '').find((t) => /^共\s+\d+\s+条/.test(t)) || ''
    const footerCount = Number((footer.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const footerState = footerEl?.getAttribute('data-hit-total-state') || ''
    const table = document.querySelector('div.overflow-x-auto.overflow-y-auto table')
    const tbodyRows = table ? table.querySelectorAll('tbody tr').length : 0
    const banner = document.querySelector('div.border-blue-200.bg-blue-50')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const planCandidates = [...document.querySelectorAll('button, [role="combobox"]')]
      .map((el) => el.textContent?.replace(/\s+/g, ' ').trim() || '')
      .filter((t) => t.includes('现查') && t.length < 200)
    const planLine = planCandidates[0] || ''
    const pageLine = [...document.querySelectorAll('span')].map((s) => s.textContent?.trim() || '').find((t) => /^第\s+\d+/.test(t)) || ''
    return { kindChips, footer, footerCount, footerState, tbodyRows, banner, planLine, pageLine }
  })
}

async function dismissPending(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  const sheet = json?.data?.sheet
  if (!sheet) return
  await bffJson('/api/v1/biz/pending-sheet/dismiss', {
    method: 'POST',
    body: { sessionId, cwd: DATA },
  }).catch(() => ({}))
  await bffJson('/api/v1/biz/preview/dismiss', {
    method: 'POST',
    body: { sessionId, cwd: DATA, preview_id: sheet.preview_id || sheet.previewId },
  }).catch(() => ({}))
}

async function official(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  const sheet = json?.data?.sheet
  return sheet && typeof sheet === 'object' ? sheet : null
}

function speechMatchesTurn(pendingSpeech, wanted) {
  const a = String(pendingSpeech || '').replace(/\s+/g, '')
  const b = String(wanted || '').replace(/\s+/g, '')
  if (!a || !b) return false
  const keys = ['商品物料的出入库流水', '仓库的出入库流水', 'Departments', 'Roles']
  for (const k of keys) {
    if (b.includes(k.replace(/\s+/g, '')) && a.includes(k.replace(/\s+/g, ''))) return true
  }
  return a.includes(b.slice(0, 24)) || b.includes(a.slice(0, 24))
}

function sheetFrom(steps, speech) {
  const stepKinds = Array.isArray(steps) ? steps.map((s) => s?.kind).filter(Boolean) : []
  return { stepKinds, speech: String(speech || '') }
}

function assessCase(c, lib, sheet, ui) {
  const libraryHit = lib[c.libraryKey]
  const fullTable = c.short === 'roles' ? lib.full.roles : lib.full.movements
  const parentFull = lib.full[c.parentFullKey === 'products' ? 'products' : c.parentFullKey === 'warehouses' ? 'warehouses' : 'departments']
  const hit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  const footer = Number.isFinite(ui.footerCount) ? ui.footerCount : null
  const notes = []
  let pierced = false

  const plan = ui.planLine + ' ' + ui.banner
  const chips = ui.kindChips.join(' ')

  if (c.short === 'roles') {
    if (hit !== 0) { pierced = true; notes.push(`pending hitTotal=${hit}，应为 0`) }
    if (footer !== 0) { pierced = true; notes.push(`页脚=${footer}，应为 0`) }
    const emptyOnly = ui.tbodyRows <= 1 && /没有|空|暂无|还没有/.test(ui.banner + ui.footer)
    if (ui.tbodyRows > 0 && !emptyOnly) { pierced = true; notes.push(`表体 ${ui.tbodyRows} 行，应为空`) }
    if (String(sheet?.kind || '') !== c.expectKind) { pierced = true; notes.push(`落点型=${sheet?.kind}`) }
    if (/出入库流水/.test(plan) || /出入库流水/.test(chips)) { pierced = true; notes.push('计划条/芯片仍挂流水') }
    if (footer === 5135) { pierced = true; notes.push('页脚串成流水整表 5135') }
  } else {
    if (String(sheet?.kind || '') !== c.expectKind) { pierced = true; notes.push(`落点型=${sheet?.kind}`) }
    if (hit !== libraryHit) { pierced = true; notes.push(`hitTotal=${hit}，库=${libraryHit}`) }
    if (footer !== libraryHit) { pierced = true; notes.push(`页脚=${footer}，库=${libraryHit}`) }
    if (footer !== hit) { pierced = true; notes.push('页脚与 pending hitTotal 不一致') }
    if (!plan.includes(c.expectFrom) && !ui.banner.includes(c.expectFrom)) { pierced = true; notes.push('计划条未体现上游') }
    if (c.expectFrom === '仓库' && /商品物料/.test(plan) && !/仓库/.test(plan)) { pierced = true; notes.push('计划条像商品边') }
    if (c.expectFrom === '商品物料' && /仓库的出入库/.test(plan) && c.short !== 'warehouse') { pierced = true; notes.push('计划条像仓库边') }
    if (/\b301\b/.test(chips) && c.expectFrom !== '商品物料') { pierced = true; notes.push('芯片出现商品整表 301') }
    if (/\b6\b/.test(chips) && chips.includes('仓库') && c.expectFrom !== '仓库') { pierced = true; notes.push('芯片像仓库整表 6') }
    if (ui.tbodyRows >= libraryHit && libraryHit > 20) { /* ok paginated */ }
    if (ui.tbodyRows === footer && footer > 20) { pierced = true; notes.push('页行数等于页脚总数') }
  }

  if (c.sameSpeechAs) notes.push('词表公开说法与 product 相同，图上无法区分 field')

  return {
    edge: c.edge,
    field: c.field,
    speech: c.speech,
    libraryHit,
    fullTable,
    parentFull,
    rightHitTotal: hit,
    rightKind: sheet?.kind || null,
    footer,
    footerText: ui.footer,
    footerState: ui.footerState,
    rowsOnPage: ui.tbodyRows,
    pageLine: ui.pageLine,
    kindChips: ui.kindChips,
    planLine: ui.planLine,
    banner: ui.banner,
    pierced,
    note: notes.join('；') || (pierced ? '' : '页脚与库命中一致，落点与计划条匹配'),
    screenshot: `${STORE}/media/biz-data-eval-missing-total-adv-${c.short}.png`,
    sheetSteps: sheet?.steps || [],
  }
}

const lib = await libraryCounts()
const ws = ((await bffJson('/api/v1/workspaces')).json?.data?.items || (await bffJson('/api/v1/workspaces')).json?.items || [])
  .find((r) => String(r?.cwd || r?.description || '') === DATA)
const workspaceId = String(ws?.id || '1985293d-03bb-496f-ad69-5c7f2ac23149')
if (!workspaceId) throw new Error('workspace-missing')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded' })
if (!(await bffJson('/api/v1/ai/status')).json?.data?.connected) {
  await bffJson('/api/v1/ai/connect', { method: 'POST', body: {}, timeoutMs: 120000 })
}
for (let i = 0; i < 60; i += 1) {
  if ((await bffJson('/api/v1/ai/status')).json?.data?.connected) break
  await page.waitForTimeout(1000)
}

await mkdir(`${STORE}/media`, { recursive: true })
const results = []

for (const c of CASES) {
  const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId }, timeoutMs: 30000 })
  const sessionId = String(created.json?.data?.sessionId || '').trim()
  if (!sessionId) throw new Error(`session-create-failed http=${created.http}`)
  await seedState(page, workspaceId, sessionId)
  await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1200)
  await dismissPending(sessionId)
  await page.waitForTimeout(600)

  await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
    method: 'POST',
    body: { text: c.speech },
    timeoutMs: 20000,
  })

  const deadline = Date.now() + TURN_MS
  let saw = false
  while (Date.now() < deadline) {
    const running = Boolean((await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`)).json?.data?.running)
    if (running) saw = true
    if (saw && !running) break
    await page.waitForTimeout(1200)
  }

  let sheet = null
  let ui = null
  const waitEnd = Date.now() + 90000
  while (Date.now() < waitEnd) {
    sheet = await official(sessionId)
    ui = await readUi(page)
    const hit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
    const footer = ui.footerCount
    const kindOk = String(sheet?.kind || '') === c.expectKind
    const footerOk = Number.isFinite(footer) && footer === hit
    const planBlob = `${ui.planLine} ${ui.banner}`
    const speechOk = speechMatchesTurn(sheet?.speech, c.speech)
    const settled = sheet?.querySettled === true || speechOk
    if (c.short === 'roles') {
      if (settled && kindOk && hit === 0 && footer === 0 && !/出入库流水/.test(planBlob + ui.kindChips.join(' '))) break
      if (settled && (/出入库流水/.test(planBlob) || footer === 5135)) break
    } else if (settled && kindOk && hit === lib[c.libraryKey] && footerOk && planBlob.includes(c.expectFrom)) {
      break
    }
    await page.waitForTimeout(1000)
  }

  if (!sheet) sheet = await official(sessionId)
  if (!ui) ui = await readUi(page)

  const dest = `${STORE}/media/biz-data-eval-missing-total-adv-${c.short}.png`
  await page.evaluate(() => {
    const f = document.querySelector('[data-records-footer]')
    if (f) f.scrollIntoView({ block: 'end' })
  }).catch(() => {})
  await page.waitForTimeout(400)
  await page.screenshot({ path: dest, fullPage: false })

  const row = assessCase(c, lib, sheet, ui)
  results.push({ ...row, sessionId })
}

await browser.close()

const codePierce = {
  commit: COMMIT,
  hardcodedLiterals: false,
  note: '3dd20f6 未写死 5135/0 或对象名；仍有用行数兜底：runtime/vendor-overlays/dsh-lan-assist/write.js:833-834、1053-1054；lookup.js:503-504 hitPack 在 known 时用 rows.length。',
}

const out = {
  branch: 'cursor/eval-three-causes-2d90',
  commit: COMMIT,
  vitePid5174: VITE_PID,
  workspace: DATA,
  library: lib,
  codeReview: codePierce,
  cases: results,
}

await writeFile(`${STORE}/internal/biz-data-eval-missing-total-adv.json`, JSON.stringify(out, null, 2))
console.log(JSON.stringify({ ok: true, cases: results.map((r) => ({ short: r.field, pierced: r.pierced, footer: r.footer, hit: r.rightHitTotal })) }, null, 2))
