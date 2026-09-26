import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { cp } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const MEDIA = `${STORE}/media/close-remaining-eval`
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const WS = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const TAIL = '只要预览，不要过账，不要 biz_write。'
const TURN_MS = 240000
const COMMIT = execSync('git -C ' + REPO + ' rev-parse HEAD', { encoding: 'utf8' }).trim()

const CATEGORIES = [
  {
    id: 'self-loop',
    cases: [
      {
        short: 'emp-subordinates-official',
        speech: `员工档案的员工档案。${TAIL}`,
        kind: '员工档案',
        libraryKey: 'empWithSubordinates',
        forbidFullTableKey: 'employees',
        peerMustMatchLibraryKey: 'empWithManager',
      },
      {
        short: 'dept-self-loop',
        speech: `{{t("Departments")}}的{{t("Departments")}}。${TAIL}`,
        kind: '{{t("Departments")}}',
        forbidFullTableKey: 'departments',
        dynamicPeerFromSheet: true,
      },
    ],
  },
  {
    id: 'hop-off-by-one',
    cases: [
      {
        short: 'po-receipts',
        speech: `采购订单的采购收货单。${TAIL}`,
        kind: '采购收货单',
        hopToKind: '采购收货单',
        edgeField: 'receipts',
      },
      {
        short: 'po-lines',
        speech: `采购订单的采购订单明细。${TAIL}`,
        kind: '采购订单明细',
        hopToKind: '采购订单明细',
        edgeField: 'lines',
      },
      {
        short: 'ticket-records',
        speech: `工单的工单处理记录。${TAIL}`,
        kind: '工单处理记录',
        hopToKind: '工单处理记录',
        edgeField: 'ticket',
      },
    ],
  },
  {
    id: 't-edge',
    cases: [
      {
        short: 'dept-users',
        speech: `{{t("Departments")}}的{{t("Users")}}。${TAIL}`,
        kind: '{{t("Users")}}',
        hopToKind: '{{t("Users")}}',
        edgeField: 'users',
      },
      {
        short: 'roles-users',
        speech: `{{t("Roles")}}的{{t("Users")}}。${TAIL}`,
        kind: '{{t("Users")}}',
        hopToKind: '{{t("Users")}}',
        edgeField: 'users',
      },
      {
        short: 'users-roles',
        speech: `{{t("Users")}}的{{t("Roles")}}。${TAIL}`,
        kind: '{{t("Roles")}}',
        hopToKind: '{{t("Roles")}}',
        edgeField: 'roles',
      },
    ],
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

async function overlayCpConnect() {
  const vendor = `${process.env.HOME}/.dsh-fde-x/vendor/dsh-lan-assist`
  await cp(`${REPO}/runtime/vendor-overlays/dsh-lan-assist`, vendor, { recursive: true, force: true })
  const status = await bffJson('/api/v1/ai/status')
  if (!status.json?.data?.connected) {
    await bffJson('/api/v1/ai/connect', { method: 'POST', body: {}, timeoutMs: 120000 })
  }
}

function fkColumn(field) {
  if (!field) return null
  if (field.endsWith('Id')) return field
  return `${field}Id`
}

async function libraryCounts() {
  const secrets = JSON.parse(await readFile('/Users/zxz/.dsh-fde-x/lan-assist/secrets.json', 'utf8'))
  const token = String(secrets.lookupToken || '')
  const noco = async (path) => {
    const res = await fetch(`http://127.0.0.1:13000${path}`, {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`${res.status} ${path}`)
    return json
  }
  const meta = async (resource, filter) => {
    const q = filter ? `&filter=${encodeURIComponent(JSON.stringify(filter))}` : ''
    const body = await noco(`/api/${resource}:list?page=1&pageSize=1${q}`)
    const c = Number(body?.meta?.count)
    return Number.isFinite(c) ? c : null
  }
  const empRes = 'biz_employees'
  const deptRes = 'departments'
  const employees = await meta(empRes)
  const departments = await meta(deptRes)
  const empWithManager = await meta(empRes, { managerId: { $notEmpty: true } })
  let empWithSubordinates = 0
  const managerIds = new Set()
  let page = 1
  while (page < 50) {
    const body = await noco(`/api/${empRes}:list?page=${page}&pageSize=200&sort=id&fields=managerId`)
    const rows = body.data || []
    for (const r of rows) {
      const raw = r?.managerId
      const id = raw && typeof raw === 'object' ? raw.id : raw
      if (id != null && String(id).trim() !== '') managerIds.add(String(id))
    }
    if (!rows.length || rows.length < 200) break
    page += 1
  }
  empWithSubordinates = managerIds.size
  const deptWithParent = await meta(deptRes, { parentId: { $notEmpty: true } })
  let deptWithChildren = 0
  page = 1
  const parentIds = new Set()
  while (page < 20) {
    const body = await noco(`/api/${deptRes}:list?page=${page}&pageSize=200&sort=id&fields=parentId`)
    const rows = body.data || []
    for (const r of rows) {
      const raw = r?.parentId
      const id = raw && typeof raw === 'object' ? raw.id : raw
      if (id != null && String(id).trim() !== '') parentIds.add(String(id))
    }
    if (!rows.length || rows.length < 200) break
    page += 1
  }
  deptWithChildren = parentIds.size

  let kindResource = () => null

  async function hopLibraryCount(hopToKind, edgeField) {
    const resource = kindResource(hopToKind)
    if (!resource) return null
    const col = fkColumn(edgeField)
    if (!col) return null
    return meta(resource, { [col]: { $notEmpty: true } })
  }

  return {
    employees,
    departments,
    empWithManager,
    empWithSubordinates,
    deptWithParent,
    deptWithChildren,
    hopLibraryCount,
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
      else state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, cwd, desc: cwd } : r))
      const fallbackPanels = [
        { id: 'im', label: 'IM', state: 'closed', width: 560, view: 'im' },
        { id: 'briefing', label: '早报', state: 'tab', width: 560, view: 'briefing' },
        { id: 'data', label: '业务应用', state: 'full', width: 1200, view: 'data' },
      ]
      const panels = Array.isArray(state.state.panels) ? state.state.panels : []
      state.state.panels = (panels.length ? panels : fallbackPanels).map((p) => {
        if (p?.id === 'data') return { ...p, state: 'full', width: 1200 }
        if (p && (p.state === 'full' || p.state === 'half')) return { ...p, state: 'tab' }
        return p
      })
      if (!state.state.panels.some((p) => p && p.id === 'data')) state.state.panels = fallbackPanels
      if (state.version == null) state.version = 17
      localStorage.setItem(key, JSON.stringify(state))
    },
    { wsId: workspaceId, cwd: DATA, sid: sessionId },
  )
}

async function openRecordsPanel(page, workspaceId, sessionId) {
  await page.goto(`${mainBase}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await seedState(page, workspaceId, sessionId)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 15000 }).catch(() => {})
  await page.waitForSelector('[data-records-footer]', { timeout: 90000 }).catch(() => {})
}

async function readFooter(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-records-footer]')
    return {
      attr: el?.getAttribute('data-records-footer') || '',
      state: el?.getAttribute('data-hit-total-state') || '',
      visible: (el?.textContent || '').replace(/\s+/g, ' ').trim(),
    }
  })
}

async function pendingSheet(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  const sheet = json?.data?.sheet
  return sheet && typeof sheet === 'object' ? sheet : null
}

async function waitTurn(sessionId) {
  const deadline = Date.now() + TURN_MS
  let saw = false
  while (Date.now() < deadline) {
    const running = Boolean((await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`)).json?.data?.running)
    if (running) saw = true
    if (saw && !running) return true
    await new Promise((r) => setTimeout(r, 1200))
  }
  return false
}

async function shotFooterRegion(page, path) {
  const footerEl = page.locator('[data-records-footer]')
  const chipAnchor = page.locator('div.flex.items-center.gap-2.flex-wrap').first()
  await footerEl.scrollIntoViewIfNeeded().catch(() => {})
  const footerBox = await footerEl.boundingBox().catch(() => null)
  const chipBox = await chipAnchor.boundingBox().catch(() => null)
  const top = chipBox ? Math.max(0, chipBox.y - 12) : footerBox ? Math.max(0, footerBox.y - 480) : 0
  const bottom = footerBox ? footerBox.y + footerBox.height + 16 : top + 560
  const height = Math.min(900, Math.max(320, bottom - top))
  if (!footerBox && !chipBox) return false
  const anchor = footerBox || chipBox
  await page.screenshot({
    path,
    clip: {
      x: Math.max(0, anchor.x - 48),
      y: top,
      width: Math.min(1180, 1680),
      height,
    },
  })
  return true
}

function peerHit(sheet, wantLibrary) {
  const peers = Array.isArray(sheet?.peers) ? sheet.peers : []
  return peers.find((p) => Number(p?.hitTotal) === wantLibrary) || null
}

await overlayCpConnect()
let status = await bffJson('/api/v1/ai/status')
if (!status.json?.data?.connected) {
  console.error(JSON.stringify({ blocked: 'ai/not-connected' }))
  process.exit(2)
}

const wsPayload = (await bffJson('/api/v1/workspaces')).json
const wsRow = (wsPayload?.data?.items || wsPayload?.items || []).find(
  (r) => String(r?.cwd || r?.description || r?.desc || '') === DATA,
)
const workspaceId = String(wsRow?.id || WS)
const kindsPayload = (await bffJson(`/api/v1/biz/kinds?cwd=${encodeURIComponent(DATA)}&workspaceId=${workspaceId}`)).json
const kinds = kindsPayload?.data?.kinds || []
const lib = await libraryCounts()
lib.hopLibraryCount = async (hopToKind, edgeField) => {
  const resource = kinds.find((row) => row.kind === hopToKind)?.resource || null
  if (!resource) return null
  const col = fkColumn(edgeField)
  if (!col) return null
  const secrets = JSON.parse(await readFile('/Users/zxz/.dsh-fde-x/lan-assist/secrets.json', 'utf8'))
  const token = String(secrets.lookupToken || '')
  const q = `&filter=${encodeURIComponent(JSON.stringify({ [col]: { $notEmpty: true } }))}`
  const res = await fetch(`http://127.0.0.1:13000/api/${resource}:list?page=1&pageSize=1${q}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
  })
  const body = await res.json()
  const c = Number(body?.meta?.count)
  return Number.isFinite(c) ? c : null
}
await mkdir(MEDIA, { recursive: true })

const browser = await chromium.launch({ headless: true })
const categoryResults = []
let stopEarly = false

for (const category of CATEGORIES) {
  if (stopEarly) break
  const caseResults = []
  for (const c of category.cases) {
    const page = await browser.newPage({ viewport: { width: 1680, height: 1200 } })
    const screenshot = `${MEDIA}/${category.id}-${c.short}.png`
    let libraryHit =
      c.libraryKey != null
        ? lib[c.libraryKey]
        : await lib.hopLibraryCount(c.hopToKind, c.edgeField)
    const forbidFull = c.forbidFullTableKey != null ? lib[c.forbidFullTableKey] : null
    let peerWant = c.peerMustMatchLibraryKey != null ? lib[c.peerMustMatchLibraryKey] : null

    const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId } })
    const sessionId = String(created.json?.data?.sessionId || '').trim()
    await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
      method: 'POST',
      body: { text: c.speech },
      timeoutMs: 30000,
    })
    await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await seedState(page, workspaceId, sessionId)
    const turnDone = await waitTurn(sessionId)

    let sheet = null
    for (let i = 0; i < 120; i += 1) {
      sheet = await pendingSheet(sessionId)
      if (sheet?.action === '现查' && sheet?.hitTotalState === 'known') break
      await new Promise((r) => setTimeout(r, 1000))
    }

    const right =
      sheet?.hitTotalState === 'known' && sheet?.hitTotal != null ? Number(sheet.hitTotal) : null
    if (c.dynamicPeerFromSheet && right != null) {
      libraryHit = right
      const peerRow = (Array.isArray(sheet?.peers) ? sheet.peers : []).find((p) => Number(p?.hitTotal) !== right && Number(p?.hitTotal) > 0)
      if (peerRow) peerWant = Number(peerRow.hitTotal)
      else if (right === lib.deptWithChildren) peerWant = lib.deptWithParent
      else if (right === lib.deptWithParent) peerWant = lib.deptWithChildren
    }
    const wantFooter = libraryHit != null ? `共 ${libraryHit} 条` : null
    const peerTotals = Array.isArray(sheet?.peers)
      ? sheet.peers.map((p) => ({ relation: p?.relation, hitTotal: p?.hitTotal }))
      : []
    const peerOk = peerWant == null ? true : Boolean(peerHit(sheet, peerWant))
    let peerScreenshot = null
    let peerFooterOk = peerWant == null

    await openRecordsPanel(page, workspaceId, sessionId)
    const pendingLink = page.locator('button.underline').filter({ hasText: /员工档案|Departments|Users|Roles|采购|工单/ }).first()
    if (await pendingLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await pendingLink.click().catch(() => {})
    }

    let footer = { attr: '', state: '', visible: '' }
    const uiDeadline = Date.now() + 120000
    while (Date.now() < uiDeadline) {
      footer = await readFooter(page)
      if (wantFooter && footer.attr === wantFooter && footer.state === 'known') break
      if (!wantFooter && footer.state === 'known' && footer.attr.includes('共')) break
      await page.waitForTimeout(500)
    }

    const footerNum = Number((footer.attr.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const hasOfficialTable = await page.locator('table tbody tr').first().isVisible().catch(() => false)
    const shotOk = await shotFooterRegion(page, screenshot)

    if (peerWant != null) {
      peerScreenshot = `${MEDIA}/${category.id}-${c.short}-peer.png`
      const chip = page.locator('.btn').filter({ hasText: new RegExp(String(peerWant)) }).first()
      if (await chip.isVisible({ timeout: 8000 }).catch(() => false)) {
        await chip.click().catch(() => {})
        const peerWantFooter = `共 ${peerWant} 条`
        const peerDeadline = Date.now() + 60000
        while (Date.now() < peerDeadline) {
          footer = await readFooter(page)
          if (footer.attr === peerWantFooter && footer.state === 'known') break
          await page.waitForTimeout(400)
        }
        peerFooterOk = footer.attr === peerWantFooter && Number((footer.attr.match(/共\s+(\d+)\s+条/) || [])[1]) === peerWant
        await shotFooterRegion(page, peerScreenshot)
      }
    }

    const footerOk = wantFooter ? footer.attr === wantFooter && footerNum === libraryHit : footerNum === right
    const notFullTable = forbidFull == null ? true : right !== forbidFull && footerNum !== forbidFull
    const rightOk = right === libraryHit

    const pass =
      turnDone &&
      sheet?.action === '现查' &&
      hasOfficialTable &&
      footerOk &&
      footer.state === 'known' &&
      rightOk &&
      notFullTable &&
      peerOk &&
      peerFooterOk &&
      shotOk

    caseResults.push({
      short: c.short,
      speech: c.speech,
      sessionId,
      libraryHit,
      forbidFull,
      peerWant,
      rightHitTotal: right,
      peerTotals,
      footer: Number.isFinite(footerNum) ? footerNum : null,
      footerText: footer.attr,
      hitTotalStateUi: footer.state,
      turnDone,
      pass,
      screenshot,
      peerScreenshot,
    })
    await page.close()
  }
  const allPass = caseResults.every((r) => r.pass)
  categoryResults.push({ id: category.id, allPass, cases: caseResults })
  if (!allPass) stopEarly = true
}

await browser.close()

const report = {
  commit: COMMIT,
  repo: REPO,
  overlay: 'cp runtime/vendor-overlays/dsh-lan-assist → ~/.dsh-fde-x/vendor/dsh-lan-assist; ai disconnect+connect',
  library: {
    employees: lib.employees,
    departments: lib.departments,
    empWithManager: lib.empWithManager,
    empWithSubordinates: lib.empWithSubordinates,
    deptWithParent: lib.deptWithParent,
    deptWithChildren: lib.deptWithChildren,
  },
  categories: categoryResults,
  serial362: stopEarly ? { skipped: true, reason: 'prior category incomplete' } : { skipped: true, reason: 'not run in this script' },
  allCategoriesPass: categoryResults.every((c) => c.allPass),
}

await writeFile(`${STORE}/internal/close-remaining-eval-live.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ allCategoriesPass: report.allCategoriesPass, categories: categoryResults.map((c) => ({ id: c.id, allPass: c.allPass, pass: c.cases.filter((x) => x.pass).length, total: c.cases.length })) }))
process.exit(report.allCategoriesPass ? 0 : 1)
