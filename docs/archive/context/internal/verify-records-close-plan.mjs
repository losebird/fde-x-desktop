/**
 * Plan section 4. Objects, fields, enum labels, and page size come from the
 * live vocab, graph relations, and connector schema. Nothing here is a
 * business-word constant.
 */
import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const STORE = '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const nocoBase = 'http://127.0.0.1:13000'
const TURN_MS = 240000
const SHOTS = {
  '01': `${STORE}/media/records-close-plan-01.png`,
  '02': `${STORE}/media/records-close-plan-02.png`,
  '03': `${STORE}/media/records-close-plan-03.png`,
  '04': `${STORE}/media/records-close-plan-04.png`,
  '05': `${STORE}/media/records-close-plan-05.png`,
  '05b': `${STORE}/media/records-close-plan-05b.png`,
  '06': `${STORE}/media/records-close-plan-06.png`,
  '07': `${STORE}/media/records-close-plan-07.png`,
}

function gitSha() {
  const text = execSync('git rev-parse --abbrev-ref HEAD && git rev-parse HEAD', { cwd: SCENE, encoding: 'utf8' }).trim().split('\n')
  return { branch: text[0], sha: text[1] }
}

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
  const json = await res.json().catch(() => ({}))
  return { http: res.status, json }
}

function usable(value) {
  const text = String(value || '').trim()
  return Boolean(text) && !text.includes('{{')
}

function enumPairs(field) {
  const ui = field && field.uiSchema && typeof field.uiSchema === 'object' ? field.uiSchema : {}
  const raw = ui.enum || field.enum || []
  const out = []
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === 'object') {
        const label = String(item.label || item.value || '').trim()
        const value = String(item.value || '').trim()
        if (label) out.push({ value, label })
      } else if (typeof item === 'string' && item.trim()) {
        out.push({ value: item.trim(), label: item.trim() })
      }
    }
  }
  return out
}

function fieldIdentity(field) {
  const ui = field && field.uiSchema && typeof field.uiSchema === 'object' ? field.uiSchema : {}
  const title = String((field && field.title) || ui.title || '').trim()
  const name = String((field && field.name) || '').trim()
  return title || name
}

async function nocoJson(token, path) {
  const res = await fetch(`${nocoBase}${path}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`noco ${res.status} ${path.slice(0, 80)}`)
  return json
}

function listData(body) {
  if (Array.isArray(body)) return body
  if (Array.isArray(body?.data)) return body.data
  return []
}

async function listAllIds(token, resource) {
  const ids = []
  let page = 1
  let size = 0
  for (let guard = 0; guard < 40; guard += 1) {
    const body = await nocoJson(token, `/api/${resource}:list?page=${page}&sort=id`)
    const rows = listData(body)
    if (!size) size = rows.length || 1
    for (const row of rows) if (row && row.id != null) ids.push(String(row.id))
    const count = Number(body?.meta?.count)
    if (!rows.length || (Number.isFinite(count) && ids.length >= count) || rows.length < size) break
    page += 1
  }
  return ids
}

function unwrapId(raw) {
  if (raw == null || raw === '') return ''
  if (typeof raw === 'object') return String(raw.id || raw.code || '').trim()
  return String(raw).trim()
}

function fkOf(row, field) {
  if (!row || !field) return ''
  return unwrapId(row[field]) || unwrapId(row[`${field}Id`]) || ''
}

async function findByNo(token, resource, ticketField, no) {
  const wanted = String(no || '').trim()
  if (!wanted) return null
  const attempts = []
  if (ticketField) attempts.push({ [ticketField]: wanted })
  if (/^\d+$/.test(wanted)) attempts.push({ id: Number(wanted) })
  for (const filter of attempts) {
    const body = await nocoJson(token, `/api/${resource}:list?page=1&filter=${encodeURIComponent(JSON.stringify(filter))}&pageSize=5`)
    const rows = listData(body)
    if (rows.length) return rows[0]
  }
  return null
}

async function metaCount(token, resource, filter) {
  const query = filter ? `&filter=${encodeURIComponent(JSON.stringify(filter))}` : ''
  const body = await nocoJson(token, `/api/${resource}:list?page=1${query}`)
  const count = Number(body?.meta?.count)
  return Number.isFinite(count) ? count : null
}

async function walkRows(token, resource, field, visit) {
  let page = 1
  let size = 0
  let seen = 0
  while (page < 80) {
    const appends = field ? `&appends=${encodeURIComponent(field)}` : ''
    const body = await nocoJson(token, `/api/${resource}:list?page=${page}&sort=-updatedAt${appends}`)
    const rows = listData(body)
    if (!rows.length) break
    if (!size) size = Number(body?.meta?.pageSize) || rows.length
    for (const row of rows) visit(row)
    seen += rows.length
    const count = Number(body?.meta?.count)
    if (rows.length < size || (Number.isFinite(count) && seen >= count)) break
    page += 1
  }
  return seen
}

async function countRelated(token, resource, field, ids) {
  let related = 0
  await walkRows(token, resource, field, (row) => {
    if (ids.has(fkOf(row, field))) related += 1
  })
  return related
}

function inFilter(field, ids) {
  return { [field]: { $in: ids } }
}

function valueFilter(fieldName, label, value) {
  const vals = [...new Set([label, value].filter(Boolean))]
  if (vals.length === 1) return { [fieldName]: vals[0] }
  return { [fieldName]: { $or: vals } }
}

const { branch, sha } = gitSha()
await mkdir(`${STORE}/internal`, { recursive: true })
await mkdir(`${STORE}/media`, { recursive: true })

const report = {
  sha,
  branch,
  items: {},
  unproven: [],
  shots: {},
}

const secrets = JSON.parse(await readFile('/Users/zxz/.dsh-fde-x/lan-assist/secrets.json', 'utf8'))
const token = String(secrets.lookupToken || '')
if (!token) {
  report.unproven.push('connector-token-missing')
  await writeFile(`${STORE}/internal/verify-records-close-plan.json`, JSON.stringify(report, null, 2))
  process.exit(0)
}

const workspaceBody = (await bffJson('/api/v1/workspaces')).json || {}
const workspaces = workspaceBody?.data?.items || workspaceBody?.items || []
const ws = (Array.isArray(workspaces) ? workspaces : []).find((row) => {
  const cwd = String(row?.cwd || row?.description || '')
  return cwd === DATA
}) || null
const workspaceId = String(ws?.id || '')
const workspaceName = String(ws?.name || ws?.title || '')
if (!workspaceId) {
  report.unproven.push('workspace-missing')
  await writeFile(`${STORE}/internal/verify-records-close-plan.json`, JSON.stringify(report, null, 2))
  process.exit(0)
}

let catalog = { kinds: [], relations: [] }
for (let i = 0; i < 15; i += 1) {
  const { json } = await bffJson(`/api/v1/biz/kinds?cwd=${encodeURIComponent(DATA)}`)
  const data = json?.data || {}
  if (Array.isArray(data.kinds) && data.kinds.length) {
    catalog = data
    break
  }
  await new Promise((r) => setTimeout(r, 400))
}
const kinds = (catalog.kinds || []).filter((row) => usable(row.kind) && usable(row.resource) && row.resource !== '(in graph)')
const byKind = new Map(kinds.map((row) => [row.kind, row]))
const relations = (catalog.relations || []).filter((rel) => usable(rel.from) && usable(rel.to) && rel.from !== rel.to && byKind.has(rel.from) && byKind.has(rel.to))

const collections = listData(await nocoJson(token, '/api/collections:list?paginate=false&fields=name,title,fields'))
const enumsByResource = new Map()
for (const col of collections) {
  const bag = []
  for (const field of Array.isArray(col.fields) ? col.fields : []) {
    const pairs = enumPairs(field)
    if (!pairs.length) continue
    bag.push({ name: String(field.name || ''), identity: fieldIdentity(field), pairs })
  }
  if (col.name) enumsByResource.set(col.name, bag)
}

function ownedLabels(kindName) {
  const row = byKind.get(kindName)
  const fields = enumsByResource.get(row?.resource) || []
  const labels = []
  for (const field of fields) {
    for (const pair of field.pairs) {
      if (pair.label.length < 2) continue
      labels.push({ ...pair, field: field.name, identity: field.identity, kind: kindName })
    }
  }
  return labels
}

function insideLabels(kindName) {
  return ownedLabels(kindName).filter((row) => kindName.includes(row.label) && row.label !== kindName)
}

function speechOf(rel, extra = '') {
  const tail = '只要预览，不要过账，不要 biz_write。'
  const head = `现查${rel.from}关联的${rel.to}`
  return extra ? `${head}，${extra}。${tail}` : `${head}。${tail}`
}

function termsOf(sheet) {
  const nodes = []
  if (sheet && typeof sheet === 'object') {
    nodes.push(sheet)
    if (sheet.from && typeof sheet.from === 'object') nodes.push(sheet.from)
    if (Array.isArray(sheet.steps)) nodes.push(...sheet.steps)
  }
  const terms = []
  for (const node of nodes) {
    const where = Array.isArray(node.where) ? node.where : []
    for (const term of where) {
      if (!term || typeof term !== 'object') continue
      terms.push({
        kind: String(node.kind || sheet.kind || ''),
        values: (Array.isArray(term.values) ? term.values : []).map((item) => String(item || '')),
      })
    }
  }
  return terms
}

function mentions(terms, label) {
  return terms.some((term) => term.values.some((value) => value === label || value.includes(label)))
}

async function relationIds(rel) {
  const parent = byKind.get(rel.from)
  return listAllIds(token, parent.resource)
}

async function parentIndex(rel) {
  const parent = byKind.get(rel.from)
  const ids = new Set()
  const byLabel = new Map()
  await walkRows(token, parent.resource, '', (row) => {
    const id = unwrapId(row.id)
    if (!id) return
    ids.add(id)
    const labels = [row.name, row.title, parent.ticketField ? row[parent.ticketField] : '']
    for (const label of labels) {
      const text = String(label || '').trim()
      if (text) byLabel.set(text, id)
    }
  })
  return { ids, byLabel }
}

async function rowOnRelation(rel, no, ids, byLabel) {
  const child = byKind.get(rel.to)
  const found = await findByNo(token, child.resource, child.ticketField, no)
  if (found) {
    const fk = fkOf(found, rel.field)
    return { found: true, on: Boolean(fk) && ids.has(fk), row: found, fk }
  }
  const parentId = byLabel?.get(String(no || '').trim())
  if (parentId && ids.has(parentId)) return { found: true, on: true, row: null, fk: parentId, via: 'parent-label' }
  return { found: false, on: false, row: null }
}

async function firstPageOffRelation(rel, ids) {
  const child = byKind.get(rel.to)
  const body = await nocoJson(token, `/api/${child.resource}:list?page=1&sort=-updatedAt&appends=${encodeURIComponent(rel.field)}`)
  const rows = listData(body)
  const off = []
  for (const row of rows) {
    const fk = fkOf(row, rel.field)
    if (!fk || !ids.has(fk)) off.push(row)
  }
  return { page: rows, off }
}

const seenPair = new Set()
const pairs = []
for (const rel of relations) {
  const key = `${rel.from}\0${rel.to}`
  if (seenPair.has(key)) continue
  seenPair.add(key)
  pairs.push(rel)
}

let case03 = null
for (const rel of pairs) {
  const inner = insideLabels(rel.to)
  if (inner.length) {
    case03 = { rel, inner }
    break
  }
}

let case04 = null
for (const rel of pairs) {
  const left = ownedLabels(rel.from)
  const right = ownedLabels(rel.to)
  for (const a of left) {
    const b = right.find((row) => row.label === a.label && row.identity === a.identity)
    if (!b) continue
    if (rel.from.includes(a.label) || rel.to.includes(a.label)) continue
    const child = byKind.get(rel.to)
    const count = await metaCount(token, child.resource, { [b.field]: b.value || b.label })
    if (!count) continue
    case04 = { rel, label: a.label, value: b.value, field: b.field, identity: a.identity }
    break
  }
  if (case04) break
}

let case06 = null
for (const rel of pairs) {
  if (case03 && rel.from === case03.rel.from && rel.to === case03.rel.to) {
    const labels = ownedLabels(rel.to).filter((row) => !rel.to.includes(row.label) && !rel.from.includes(row.label))
    for (const label of labels) {
      const child = byKind.get(rel.to)
      const count = await metaCount(token, child.resource, { [label.field]: label.value || label.label })
      if (!count) continue
      case06 = { rel, label: label.label, field: label.field, value: label.value }
      break
    }
  }
  if (case06) break
}
if (!case06) {
  for (const rel of pairs) {
    const labels = ownedLabels(rel.to).filter((row) => !rel.to.includes(row.label) && !rel.from.includes(row.label))
    for (const label of labels) {
      const child = byKind.get(rel.to)
      const count = await metaCount(token, child.resource, { [label.field]: label.value || label.label })
      if (!count) continue
      case06 = { rel, label: label.label, field: label.field, value: label.value }
      break
    }
    if (case06) break
  }
}

const sampleList = await nocoJson(token, `/api/${kinds[0].resource}:list?page=1`)
const discoveredPage = Number(sampleList?.meta?.pageSize) || listData(sampleList).length || 0
let case05 = null
let bestCount = Infinity
for (const rel of pairs) {
  if (insideLabels(rel.from).length || insideLabels(rel.to).length) continue
  const child = byKind.get(rel.to)
  const count = await metaCount(token, child.resource, null)
  if (count != null && discoveredPage > 0 && count > discoveredPage && count < bestCount) {
    bestCount = count
    case05 = rel
  }
}

const used = new Set()
function mark(rel) {
  if (rel) used.add(`${rel.from}\0${rel.to}`)
}
mark(case03?.rel)
mark(case04?.rel)
mark(case06?.rel)
mark(case05)
const fresh = pairs.filter((rel) => !used.has(`${rel.from}\0${rel.to}`))
const case01 = fresh.length >= 2 ? [fresh[0], fresh[1]] : pairs.slice(0, 2)
const case02 = fresh.find((rel) => !insideLabels(rel.to).length) || case05 || pairs[0]

console.error(JSON.stringify({
  '01': case01.map((rel) => `${rel.from}->${rel.to}`),
  '02': case02 && `${case02.from}->${case02.to}`,
  '03': case03 && `${case03.rel.from}->${case03.rel.to}`,
  '04': case04 && `${case04.rel.from}->${case04.rel.to}`,
  '05': case05 && `${case05.from}->${case05.to}`,
  '06': case06 && `${case06.rel.from}->${case06.rel.to}`,
}, null, 0))

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 2400, height: 2200 } })
const writes = []
page.on('request', (req) => {
  const url = req.url()
  if (req.method() === 'POST' && /\/api\/v1\/biz\/write/.test(url)) writes.push(url)
})

function sheetView(sheet) {
  if (!sheet || typeof sheet !== 'object') return null
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  return {
    kind: String(sheet.kind || ''),
    action: String(sheet.action || ''),
    from: sheet.from && typeof sheet.from === 'object' ? String(sheet.from.kind || '') : '',
    nos: rows.map((row) => String(row?.no || '')).filter(Boolean),
    hitTotal: sheet.hitTotal == null ? null : Number(sheet.hitTotal),
    hitTotalState: String(sheet.hitTotalState || ''),
    page: Number(sheet.page) || 0,
    pageSize: Number(sheet.pageSize) || 0,
    pageFull: sheet.pageFull === true,
    querySettled: sheet.querySettled === true,
    where: termsOf(sheet),
    steps: Array.isArray(sheet.steps) ? sheet.steps.map((step) => String(step?.kind || '')) : [],
  }
}

async function official(sessionId) {
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?sessionId=${encodeURIComponent(sessionId)}`)
  const sheet = json?.data?.sheet
  return sheet && typeof sheet === 'object' ? sheet : null
}

async function running(sessionId) {
  const { json } = await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`)
  return Boolean(json?.data?.running)
}

async function iframeText() {
  const bits = []
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue
    try {
      const text = await frame.evaluate(() => document.body?.innerText || '')
      if (text) bits.push(text)
    } catch { /* detached */ }
  }
  return bits.join('\n')
}

async function composer() {
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue
    try {
      const info = await frame.evaluate(() => {
        const text = document.body?.innerText || ''
        const ta = document.querySelector('textarea')
        const send = [...document.querySelectorAll('button')].find((el) => /发送/.test(el.textContent || ''))
        return {
          thinking: /深度求索中/.test(text),
          hasInput: Boolean(ta),
          disabled: Boolean(ta?.disabled) || Boolean(send?.disabled),
        }
      })
      if (info) return info
    } catch { /* detached */ }
  }
  return { thinking: /深度求索中/.test(await iframeText()), hasInput: false, disabled: true }
}

async function readPanel() {
  return page.evaluate(() => {
    const footer = document.querySelector('[data-records-footer]')
    const state = footer?.getAttribute('data-hit-total-state') || ''
    const footerText = footer?.getAttribute('data-records-footer') || footer?.textContent?.trim() || ''
    const pageText = [...document.querySelectorAll('span')].map((el) => el.textContent?.trim() || '').find((text) => /^第\s+\d+/.test(text)) || ''
    const nos = [...document.querySelectorAll('tbody tr')].map((row) => {
      const cell = row.querySelector('td:nth-child(2)')
      return cell?.innerText?.trim() || ''
    }).filter(Boolean)
    const buttons = [...document.querySelectorAll('button')].map((el) => (el.textContent || '').replace(/\s+/g, '').trim()).filter(Boolean)
    return { footerText, state, pageText, nos, rowCount: document.querySelectorAll('tbody tr').length, buttons }
  })
}

async function turn(sessionId, speech) {
  console.error(`turn ${speech.slice(0, 40)}`)
  const prompted = await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
    method: 'POST',
    body: { text: speech },
    timeoutMs: 20000,
  })
  const started = Date.now()
  const deadline = started + TURN_MS
  let saw = false
  let last = null
  while (Date.now() < deadline) {
    const isRunning = await running(sessionId)
    if (isRunning) saw = true
    last = {
      running: isRunning,
      thinking: /深度求索中/.test(await iframeText()),
      composer: await composer(),
      sheet: sheetView(await official(sessionId)),
    }
    if (saw && !isRunning) break
    await page.waitForTimeout(1200)
  }
  await page.waitForTimeout(800)
  last = {
    ...last,
    running: await running(sessionId),
    thinking: /深度求索中/.test(await iframeText()),
    composer: await composer(),
    sheet: sheetView(await official(sessionId)),
    prompted: prompted.http,
  }
  const stopped = last.running === false && last.thinking === false
  const panelDeadline = Date.now() + 20000
  let panel = null
  while (Date.now() < panelDeadline) {
    panel = await readPanel()
    if (panel.footerText || panel.rowCount > 0) break
    await page.waitForTimeout(500)
  }
  return { ...last, stopped, panel }
}

async function seed(sessionId) {
  await page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd, workspaceName: name, sessionId: sid }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeDataSubview = 'records'
    if (sid) state.state.activeAiSessionId = sid
    const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
    if (wsId && !rows.some((row) => row.id === wsId)) {
      rows.push({ id: wsId, name: name || 'workspace', desc: cwd, cwd })
      state.state.workspaces = rows
    }
    const panels = Array.isArray(state.state.panels) ? state.state.panels : []
    state.state.panels = panels.map((panel) => {
      if (panel && panel.id === 'data') return { ...panel, state: 'full', width: 1100 }
      if (panel && (panel.state === 'full' || panel.state === 'half')) return { ...panel, state: 'tab' }
      return panel
    })
    if (state.version == null) state.version = 17
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd: DATA, workspaceName, sessionId })
}

async function openSession() {
  const created = await bffJson('/api/v1/ai/sessions', {
    method: 'POST',
    body: { workspaceId },
    timeoutMs: 30000,
  })
  const sessionId = created.json?.data?.sessionId || created.json?.sessionId || ''
  if (!sessionId) throw new Error(`session-create ${created.http}`)
  await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await seed(sessionId)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  const rec = page.getByRole('button', { name: '业务记录', exact: true })
  if (await rec.count()) await rec.click({ timeout: 8000 }).catch(() => {})
  const deadline = Date.now() + 90000
  while (Date.now() < deadline) {
    const text = await iframeText()
    if (/标准模式|完全社交|发送/.test(text)) break
    await page.waitForTimeout(800)
  }
  return sessionId
}

async function shot(id, hashes) {
  const dest = SHOTS[id]
  await page.evaluate(() => {
    const el = document.querySelector('[data-records-footer]')
    if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' })
  }).catch(() => {})
  await page.waitForTimeout(300)
  await page.screenshot({ path: dest, fullPage: false })
  const hash = createHash('md5').update(await readFile(dest)).digest('hex')
  const distinct = !hashes.includes(hash)
  hashes.push(hash)
  report.shots[id] = dest
  return { path: dest, md5: hash, distinct, exists: existsSync(dest) }
}

async function rowsMatchRelation(rel, nos) {
  const parents = await parentIndex(rel)
  const checked = []
  for (const no of nos.slice(0, 20)) {
    const hit = await rowOnRelation(rel, no, parents.ids, parents.byLabel)
    checked.push({ no, found: hit.found, on: hit.on })
  }
  const offPage = await firstPageOffRelation(rel, parents.ids)
  const sheetSet = new Set(nos)
  const offNos = []
  const child = byKind.get(rel.to)
  const parent = byKind.get(rel.from)
  for (const row of offPage.off.slice(0, 5)) {
    const linked = row[rel.field]
    const label = linked && typeof linked === 'object'
      ? String(linked.name || linked.title || linked[parent.ticketField] || '')
      : ''
    const no = String(row[child.ticketField] || label || row.id || '')
    if (no) offNos.push(no)
  }
  const leaked = offNos.filter((no) => sheetSet.has(no))
  return {
    checked,
    allOn: checked.length > 0 && checked.every((row) => row.on),
    missingRow: checked.some((row) => !row.found),
    leaked,
    offSample: offNos,
  }
}

function item(id, objects, rowsRight, extra = {}) {
  report.items[id] = {
    objects,
    rowsRight,
    shot: SHOTS[id],
    ...extra,
  }
  if (rowsRight == null) report.unproven.push(id)
}

const hashes = []

try {
  if (case01.length < 2) report.unproven.push('01-need-two-relations')
  else {
    const session = await openSession()
    const first = await turn(session, speechOf(case01[0]))
    const firstRows = await rowsMatchRelation(case01[0], first.sheet?.nos || [])
    const firstOk = Boolean(first.stopped)
      && first.sheet?.kind === case01[0].to
      && first.sheet?.from === case01[0].from
      && first.sheet?.action === '现查'
      && firstRows.allOn
      && firstRows.leaked.length === 0
    const second = await turn(session, speechOf(case01[1]))
    const secondRows = await rowsMatchRelation(case01[1], second.sheet?.nos || [])
    const replaced = first.sheet?.kind !== second.sheet?.kind || first.sheet?.nos?.[0] !== second.sheet?.nos?.[0]
    const secondOk = Boolean(second.stopped)
      && second.sheet?.kind === case01[1].to
      && second.sheet?.from === case01[1].from
      && second.sheet?.action === '现查'
      && secondRows.allOn
      && secondRows.leaked.length === 0
      && replaced
    const pic = await shot('01', hashes)
    item('01', [case01[0].from, case01[0].to, case01[1].from, case01[1].to], Boolean(firstOk && secondOk), {
      leftStopped: Boolean(second.stopped),
      replaced,
      first: { stopped: first.stopped, kind: first.sheet?.kind, from: first.sheet?.from, rows: firstRows },
      second: { stopped: second.stopped, kind: second.sheet?.kind, from: second.sheet?.from, rows: secondRows },
      distinct: pic.distinct,
    })
  }

  if (!case02) report.unproven.push('02')
  else {
    const session = await openSession()
    const done = await turn(session, speechOf(case02))
    const rows = await rowsMatchRelation(case02, done.sheet?.nos || [])
    const ok = Boolean(done.stopped)
      && done.sheet?.kind === case02.to
      && done.sheet?.from === case02.from
      && rows.allOn
      && rows.leaked.length === 0
    if (!rows.offSample.length) report.unproven.push('02-default-page-had-no-off-relation-row')
    const pic = await shot('02', hashes)
    item('02', [case02.from, case02.to], ok, {
      leftStopped: Boolean(done.stopped),
      kind: done.sheet?.kind,
      from: done.sheet?.from,
      rows,
      distinct: pic.distinct,
      session,
    })
    report._session02 = session
    report._sheet02 = done.sheet
  }

  if (!case03) report.unproven.push('03')
  else {
    const session = await openSession()
    const done = await turn(session, speechOf(case03.rel))
    const labels = case03.inner.map((row) => row.label)
    const whereHits = labels.filter((label) => mentions(done.sheet?.where || [], label))
    const ids = (await parentIndex(case03.rel)).ids
    const child = byKind.get(case03.rel.to)
    const innerValues = new Set(case03.inner.flatMap((row) => [row.value, row.label].filter(Boolean)))
    let full = 0
    let narrowed = 0
    await walkRows(token, child.resource, case03.rel.field, (row) => {
      if (!ids.has(fkOf(row, case03.rel.field))) return
      full += 1
      const raw = row[case03.inner[0].field]
      const text = String(raw && typeof raw === 'object' ? (raw.label || raw.value || '') : (raw || ''))
      if (innerValues.has(text)) narrowed += 1
    })
    const total = done.sheet?.hitTotal
    const state = done.sheet?.hitTotalState
    const totalOk = state === 'known' && full != null && total === full && (narrowed == null || narrowed !== full || whereHits.length === 0)
    const rows = await rowsMatchRelation(case03.rel, done.sheet?.nos || [])
    const ok = Boolean(done.stopped)
      && whereHits.length === 0
      && done.sheet?.kind === case03.rel.to
      && rows.allOn
      && (totalOk || (state !== 'known' && whereHits.length === 0 && rows.allOn))
    if (!(state === 'known' && full != null)) report.unproven.push('03-total-not-proven-against-relation-count')
    const pic = await shot('03', hashes)
    item('03', [case03.rel.from, case03.rel.to, ...labels], ok && whereHits.length === 0, {
      leftStopped: Boolean(done.stopped),
      whereHits,
      full,
      narrowed,
      hitTotal: total,
      hitTotalState: state,
      rows,
      distinct: pic.distinct,
    })
  }

  if (!case04) report.unproven.push('04')
  else {
    const session = await openSession()
    const done = await turn(session, speechOf(case04.rel, case04.label))
    const onTarget = (done.sheet?.where || []).some((term) => term.kind === case04.rel.to && mentions([term], case04.label))
    const onParent = (done.sheet?.where || []).some((term) => term.kind === case04.rel.from && mentions([term], case04.label))
    const rows = await rowsMatchRelation(case04.rel, done.sheet?.nos || [])
    const child = byKind.get(case04.rel.to)
    const valueOk = []
    const parents04 = await parentIndex(case04.rel)
    for (const no of (done.sheet?.nos || []).slice(0, 20)) {
      const hit = await rowOnRelation(case04.rel, no, parents04.ids, parents04.byLabel)
      const raw = hit.row ? String(hit.row[case04.field] ?? '') : ''
      valueOk.push(raw === case04.label || raw === case04.value)
    }
    const ok = Boolean(done.stopped) && onTarget && onParent && rows.allOn && valueOk.length > 0 && valueOk.every(Boolean)
    const pic = await shot('04', hashes)
    item('04', [case04.rel.from, case04.rel.to, case04.label, case04.identity], ok, {
      leftStopped: Boolean(done.stopped),
      onTarget,
      onParent,
      valueOk,
      rows,
      distinct: pic.distinct,
    })
  }

  if (!case05) report.unproven.push('05')
  else {
    const session = await openSession()
    const done = await turn(session, speechOf(case05))
    const panel = await readPanel()
    const parents05 = await parentIndex(case05)
    const child = byKind.get(case05.to)
    const full = await countRelated(token, child.resource, case05.field, parents05.ids)
    const shown = done.sheet?.nos?.length || panel.rowCount
    const pageSize = done.sheet?.pageSize || 0
    const state = done.sheet?.hitTotalState || panel.state
    const total = done.sheet?.hitTotal
    const footer = panel.footerText
    const pretends = pageSize > 0 && shown >= pageSize && state === 'known' && total === shown && full != null && full !== shown
    const honestKnown = state === 'known' && full != null && total === full
    const marked = state === 'incomplete' || state === 'unknown' || /不完整|总数未知/.test(footer)
    const footerOk = !pretends && (honestKnown || marked)
    const rows = await rowsMatchRelation(case05, done.sheet?.nos || [])
    const ok = Boolean(done.stopped) && footerOk && rows.allOn && done.sheet?.where?.length === 0
    const pic = await shot('05', hashes)
    item('05', [case05.from, case05.to], ok, {
      leftStopped: Boolean(done.stopped),
      footer,
      state,
      total,
      full,
      shown,
      pageSize,
      pretends,
      rows,
      distinct: pic.distinct,
    })

    const before = [...(done.sheet?.nos || [])]
    const next = page.getByRole('button', { name: '下一页', exact: true })
    let page2 = null
    if (await next.count() && await next.isEnabled()) {
      const waitPreview = page.waitForResponse((res) => res.url().includes('/api/v1/biz/preview') && res.request().method() === 'POST', { timeout: 120000 }).catch(() => null)
      await next.click()
      const response = await waitPreview
      const payload = response ? await response.json().catch(() => null) : null
      const raw = payload?.data?.sheet || payload?.data || null
      await page.waitForTimeout(600)
      page2 = sheetView(raw) || sheetView(await official(session))
      const panel2 = await readPanel()
      const samePlan = page2?.kind === case05.to && page2?.from === case05.from
      const moved = page2?.nos?.length > 0 && page2.nos[0] !== before[0]
      const overlap = (page2?.nos || []).filter((no) => before.includes(no))
      const rows2 = await rowsMatchRelation(case05, page2?.nos || panel2.nos || [])
      const ok2 = samePlan && moved && overlap.length === 0 && rows2.allOn
      const pic2 = await shot('05b', hashes)
      item('05b', [case05.from, case05.to], ok2, {
        leftStopped: Boolean(done.stopped) && !/深度求索中/.test(await iframeText()),
        page: page2?.page || panel2.pageText,
        footer: panel2.footerText,
        moved,
        overlap: overlap.length,
        rows: rows2,
        distinct: pic2.distinct,
      })
    } else {
      report.unproven.push('05b-next-page-disabled')
      item('05b', [case05.from, case05.to], null, { reason: 'next-disabled', footer: panel.footerText })
    }
  }

  if (!case06) report.unproven.push('06')
  else {
    const session = await openSession()
    const done = await turn(session, speechOf(case06.rel, case06.label))
    const parents06 = await parentIndex(case06.rel)
    const child = byKind.get(case06.rel.to)
    const rows = await rowsMatchRelation(case06.rel, done.sheet?.nos || [])
    const values = []
    for (const no of (done.sheet?.nos || []).slice(0, 20)) {
      const hit = await rowOnRelation(case06.rel, no, parents06.ids, parents06.byLabel)
      const raw = hit.row ? String(hit.row[case06.field] == null ? '' : (hit.row[case06.field]?.label || hit.row[case06.field])) : ''
      values.push({ no, on: hit.on, raw, match: raw === case06.label || raw === case06.value })
    }
    let onCount = 0
    await walkRows(token, child.resource, case06.rel.field, (row) => {
      if (!parents06.ids.has(fkOf(row, case06.rel.field))) return
      const raw = row[case06.field]
      const text = String(raw && typeof raw === 'object' ? (raw.label || raw.value || '') : (raw ?? ''))
      if (text === case06.label || text === case06.value) onCount += 1
    })
    const anyCount = await metaCount(token, child.resource, { [case06.field]: case06.value || case06.label })
    const whereOn = mentions(done.sheet?.where || [], case06.label)
    const leakedOff = values.filter((row) => row.no && !row.on)
    const wrongValue = values.filter((row) => row.no && !row.match)
    const total = done.sheet?.hitTotal
    const totalOk = done.sheet?.hitTotalState !== 'known' || onCount == null || total === onCount
    const excluded = anyCount != null && onCount != null && anyCount > onCount
    const ok = Boolean(done.stopped) && whereOn && leakedOff.length === 0 && wrongValue.length === 0 && values.length > 0 && totalOk && rows.allOn
    if (!excluded) report.unproven.push('06-no-off-relation-row-with-that-label')
    const pic = await shot('06', hashes)
    item('06', [case06.rel.from, case06.rel.to, case06.label], ok, {
      leftStopped: Boolean(done.stopped),
      whereOn,
      onCount,
      anyCount,
      leakedOff: leakedOff.length,
      wrongValue: wrongValue.length,
      total,
      distinct: pic.distinct,
    })
  }

  const chatSession = report._session02
  if (!chatSession || !report._sheet02) {
    report.unproven.push('07')
    item('07', [], null, { reason: 'no-prior-sheet' })
  } else {
    const before = report._sheet02
    const blobKinds = kinds.map((row) => row.kind)
    let chat = '随便聊聊'
    if (blobKinds.some((name) => chat.includes(name))) chat = '嗯'
    const done = await turn(chatSession, chat)
    const after = done.sheet
    const same = after?.kind === before.kind && after?.nos?.[0] === before.nos?.[0] && after?.from === before.from
    const paths = []
    page.on('request', (req) => {
      if (req.method() === 'POST' || req.method() === 'GET') paths.push(`${req.method()} ${req.url().replace(mainBase, '').replace(bffBase, '')}`)
    })
    const spoken = JSON.parse(await readFile(`${SCENE}/runtime/vendor-overlays/dsh-lan-assist/vocab/spoken.json`, 'utf8'))
    const actionValues = new Set()
    for (const clue of spoken.clues || []) {
      if (clue.role === '动作' && Array.isArray(clue.values)) {
        for (const value of clue.values) actionValues.add(String(value))
      }
    }
    const keep = [...actionValues].filter((value) => value !== '现查' && value !== '删除' && value !== '新建')
    const cell = page.locator('tbody tr input, tbody tr textarea').first()
    if (await cell.count()) {
      await cell.fill(`probe-${Date.now()}`).catch(() => {})
    }
    for (const label of keep) {
      const button = page.locator('tbody tr button', { hasText: label }).first()
      if (await button.count()) {
        await button.click().catch(() => {})
        await page.waitForTimeout(500)
      }
    }
    const cancel = page.locator('button', { hasText: '取消' }).last()
    if (await cancel.count()) await cancel.click().catch(() => {})
    const history = page.locator('select').last()
    if (await history.count()) {
      const value = await history.evaluate((el) => {
        const option = [...el.options].find((row) => row.value)
        return option ? option.value : ''
      })
      if (value) await history.selectOption(value).catch(() => {})
    }
    await page.waitForTimeout(800)
    const prompted = paths.filter((line) => /\/prompt/.test(line))
    const previewed = paths.filter((line) => /\/api\/v1\/biz\/preview/.test(line))
    const dismissed = paths.filter((line) => /dismiss/.test(line))
    const wrote = writes.length > 0
    const oldPath = previewed.length > 0 && prompted.length === 0 && !wrote
    const pic = await shot('07', hashes)
    const left = !/深度求索中/.test(await iframeText())
    item('07', [before.kind, chat], Boolean(same && done.stopped && left), {
      leftStopped: Boolean(done.stopped && left),
      sameSheet: same,
      oldPath,
      previewed: previewed.length,
      dismissed: dismissed.length,
      prompted: prompted.length,
      wrote,
      historySelected: Boolean(history && await history.count()),
      distinct: pic.distinct,
    })
    if (!oldPath) report.unproven.push('07-old-path-not-seen')
  }
} catch (error) {
  report.unproven.push(`run-error:${error instanceof Error ? error.message : String(error)}`)
  console.error(error)
} finally {
  delete report._session02
  delete report._sheet02
  await browser.close().catch(() => {})
  await writeFile(`${STORE}/internal/verify-records-close-plan.json`, `${JSON.stringify(report, null, 2)}\n`)
  console.error(`wrote ${STORE}/internal/verify-records-close-plan.json`)
}
