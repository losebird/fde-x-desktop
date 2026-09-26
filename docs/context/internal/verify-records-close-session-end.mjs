/**
 * Prove the records-close session round once.
 * Pass/fail copied from docs/records-close-session-plan.md 「准备怎么验」.
 * Speeches are built from the live kinds/relations API. No business names here.
 */
import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { dirname } from 'node:path'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const CURSOR_STORE = '/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e'
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const PREVIEW_ONLY = '只要预览，不要过账，不要 biz_write。'
const TURN_MS = 240000

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

function gitSha() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD && git rev-parse HEAD', { cwd: SCENE, encoding: 'utf8' }).trim().split('\n')
  } catch {
    return ['unknown', 'unknown']
  }
}

function usableName(value) {
  const text = String(value || '').trim()
  if (!text) return false
  if (text.includes('{{')) return false
  return true
}

function isDumpSheet(sheet) {
  if (!sheet || typeof sheet !== 'object') return false
  if (String(sheet.action || '').trim() !== '现查') return false
  if (String(sheet.preview_id || sheet.previewId || '').trim()) return false
  const where = sheet.where ?? sheet.listWhere
  if (Array.isArray(where) && where.length) return false
  if (Array.isArray(sheet.hopWhere) && sheet.hopWhere.length) return false
  const from = sheet.from
  if (from && typeof from === 'object' && !Array.isArray(from) && String(from.kind || '').trim()) return false
  if (Array.isArray(sheet.steps) && sheet.steps.length) return false
  return true
}

function hopSpeech(rel) {
  return `现查${rel.from}关联的${rel.to}。${PREVIEW_ONLY}`
}

function whereBlocks(node) {
  if (!node || typeof node !== 'object' || !Array.isArray(node.where)) return []
  return node.where.filter((term) => term && typeof term === 'object').map((term) => ({
    keys: Array.isArray(term.keys) ? term.keys.map((key) => String(key || '')).filter(Boolean) : [],
    values: Array.isArray(term.values) ? term.values.map((value) => String(value ?? '')).filter(Boolean) : [],
    not: Boolean(term.not),
  }))
}

function spokenCondition(pending) {
  const raw = pending?.raw && typeof pending.raw === 'object' ? pending.raw : pending
  if (!raw || typeof raw !== 'object') return { wheres: [], valueSets: {} }
  const nodes = [raw]
  if (raw.from && typeof raw.from === 'object') nodes.push(raw.from)
  if (Array.isArray(raw.steps)) nodes.push(...raw.steps)
  const wheres = []
  const keys = new Set()
  for (const node of nodes) {
    const terms = whereBlocks(node)
    if (!terms.length) continue
    wheres.push({ kind: String(node.kind || ''), terms })
    for (const term of terms) for (const key of term.keys) keys.add(key)
  }
  const rows = Array.isArray(raw.rows) ? raw.rows : []
  const valueSets = {}
  for (const row of rows) {
    const fields = row && row.fields && typeof row.fields === 'object' ? row.fields : {}
    for (const key of keys) {
      const rawValue = fields[key]
      const text = rawValue == null
        ? ''
        : typeof rawValue === 'object'
          ? String(rawValue.label || rawValue.value || rawValue.name || '')
          : String(rawValue)
      if (!text) continue
      valueSets[key] = valueSets[key] || []
      if (!valueSets[key].includes(text)) valueSets[key].push(text)
    }
  }
  return { wheres, valueSets }
}

function sheetSnap(pending, ui) {
  const condition = spokenCondition(pending)
  return {
    kind: String(pending?.kind || ui?.selectedChip || '').trim(),
    action: String(pending?.action || ui?.drawerAction || '').trim(),
    rows: Number(pending?.rows ?? ui?.footerCount ?? 0),
    first: String(pending?.first || ui?.firstNo || ''),
    dump: isDumpSheet(pending?.raw || pending),
    fromKind: pending?.from && typeof pending.from === 'object' ? String(pending.from.kind || '') : '',
    hopWhere: Array.isArray(pending?.hopWhere) && pending.hopWhere.length > 0,
    steps: Array.isArray(pending?.steps) ? pending.steps.map((row) => String(row?.kind || '')).filter(Boolean) : [],
    speech: String(pending?.speech || '').trim(),
    roundId: String(pending?.roundId || '').trim(),
    wheres: condition.wheres,
    valueSets: condition.valueSets,
  }
}

function fingerprint(snap) {
  return [snap.kind, snap.action, snap.rows, snap.first, snap.roundId].join('|')
}

function kindKey(value) {
  return String(value || '').replace(/\s+/g, '').replace(/\d+$/g, '')
}

function sameKind(a, b) {
  const left = kindKey(a)
  const right = kindKey(b)
  return Boolean(left) && left === right
}

async function dualWrite(src, rel) {
  const dest = `${CURSOR_STORE}${rel}`
  try {
    await mkdir(dirname(dest), { recursive: true })
    await copyFile(src, dest)
    return dest
  } catch {
    return ''
  }
}

const [branch, sha] = gitSha()
await mkdir(`${STORE}/internal`, { recursive: true })
await mkdir(`${STORE}/media`, { recursive: true })

const out = {
  slice: 'records-close-session-end',
  sha,
  branch,
  proofs: {},
}

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } })

try {
  const workspaces = (await bffJson('/api/v1/workspaces')).json?.data?.items
    || (await bffJson('/api/v1/workspaces')).json?.items
    || []
  const rows = Array.isArray(workspaces) ? workspaces : []
  const ws = rows.find((row) => /fdex/.test(`${row?.cwd || ''} ${row?.description || ''} ${row?.name || ''}`))
    || rows[0]
    || null
  const workspaceCwd = String(ws?.cwd || ws?.description || '/Users/zxz/Documents/ai-project/fdex测试')
  const workspaceId = String(ws?.id || '')
  const workspaceName = String(ws?.name || ws?.title || '')
  out.workspaceCwd = workspaceCwd
  out.workspaceId = workspaceId
  console.error(`workspace ${workspaceId} ${workspaceCwd}`)

  let st = (await bffJson('/api/v1/ai/status')).json?.data || {}
  if (!st.connected) {
    await bffJson('/api/v1/ai/connect', { method: 'POST', body: {}, timeoutMs: 180000 })
    st = (await bffJson('/api/v1/ai/status')).json?.data || {}
  }
  if (!st.connected) {
    out.failCode = 'dsh-not-connected'
    throw new Error('dsh-not-connected')
  }

  async function loadKinds() {
    const urls = [
      `/api/v1/biz/kinds?cwd=${encodeURIComponent(workspaceCwd)}`,
      `/api/v1/biz/kinds?workspace=${encodeURIComponent(workspaceCwd)}`,
    ]
    for (const url of urls) {
      const { json } = await bffJson(url)
      const data = json?.data || {}
      const kinds = Array.isArray(data.kinds) ? data.kinds : []
      const relations = Array.isArray(data.relations) ? data.relations : []
      if (kinds.length) return { kinds, relations, aliases: data.aliases || {} }
    }
    return { kinds: [], relations: [], aliases: {} }
  }

  let catalog = await loadKinds()
  for (let i = 0; i < 20 && !catalog.kinds.length; i += 1) {
    await page.waitForTimeout(500)
    catalog = await loadKinds()
  }
  out.kindCount = catalog.kinds.length
  out.relationCount = catalog.relations.length

  const connected = catalog.kinds.filter((row) => {
    const resource = String(row?.resource || '').trim()
    return resource && resource !== '(in graph)' && usableName(row?.kind)
  })
  const names = new Set(connected.map((row) => row.kind))
  const rels = (catalog.relations || []).filter((rel) => {
    const from = String(rel?.from || '').trim()
    const to = String(rel?.to || '').trim()
    if (!usableName(from) || !usableName(to) || from === to) return false
    return names.has(from) && names.has(to)
  })
  const uniquePairs = []
  const seen = new Set()
  for (const rel of rels) {
    const key = `${rel.from}\0${rel.to}`
    if (seen.has(key)) continue
    seen.add(key)
    uniquePairs.push({ from: String(rel.from), to: String(rel.to) })
  }
  out.livePairs = uniquePairs.length
  if (uniquePairs.length < 1) {
    out.proofs.p3 = { pass: false, skip: true, failCode: '词表没有可验的关系' }
  }

  const pairA = uniquePairs[0]
  const pairB = uniquePairs.find((row) => row.to !== pairA?.to)
    || uniquePairs.find((row) => row.from !== pairA?.from)
    || uniquePairs[1]
    || uniquePairs[0]
  const speech1 = pairA ? hopSpeech(pairA) : ''
  const speech2 = pairB ? hopSpeech(pairB) : ''
  out.speeches = { first: '第一句（现场词表已发布关系）', second: '第二句（另一条已发布关系）', hop: '有关系的那一句' }

  async function seedState(sessionId) {
    await page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd, workspaceName: name, sessionId: sid }) => {
      const key = 'scene-39-workstation'
      const raw = localStorage.getItem(key)
      const state = raw ? JSON.parse(raw) : { state: {} }
      state.state = state.state || {}
      state.state.activeWorkspaceId = wsId
      state.state.activeDataSubview = 'records'
      if (sid) state.state.activeAiSessionId = sid
      const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
      if (wsId && !rows.some((r) => r.id === wsId)) {
        rows.push({ id: wsId, name: name || 'workspace', desc: cwd, cwd })
        state.state.workspaces = rows
      }
      const panels = Array.isArray(state.state.panels) ? state.state.panels : []
      state.state.panels = panels.map((p) => {
        if (p && p.id === 'data') return { ...p, state: 'full', width: 1100 }
        if (p && (p.state === 'full' || p.state === 'half')) return { ...p, state: 'tab' }
        return p
      })
      if (state.version == null) state.version = 17
      localStorage.setItem(key, JSON.stringify(state))
    }, { workspaceId, workspaceCwd, workspaceName, sessionId })
  }

  async function readPending(sessionId) {
    const { json } = await bffJson(`/api/v1/biz/pending-sheet?sessionId=${encodeURIComponent(sessionId)}`)
    const sheet = json?.data?.sheet
    if (!sheet || typeof sheet !== 'object') return null
    const rows = Array.isArray(sheet.rows) ? sheet.rows : []
    return {
      ...sheet,
      rows: rows.length,
      first: rows[0] ? String(rows[0].no || '') : '',
      raw: sheet,
    }
  }

  async function readUi() {
    return page.evaluate(() => {
      const chipWrap = [...document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap')]
        .find((el) => [...el.querySelectorAll('button.btn')].length)
      const kindChipEls = chipWrap ? [...chipWrap.querySelectorAll('button.btn')] : []
      const footer = [...document.querySelectorAll('span')]
        .map((s) => s.textContent?.trim() || '')
        .find((t) => t.startsWith('共 ') && t.includes('条')) || ''
      const footerCount = Number((footer.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
      const table = document.querySelector('div.overflow-x-auto.overflow-y-auto table')
      const tbodyRows = table ? table.querySelectorAll('tbody tr').length : 0
      const firstNo = table?.querySelector('tbody tr td:nth-child(2)')?.textContent?.trim() || ''
      const selectedChip = kindChipEls.find((b) => b.className.includes('bg-ink'))?.textContent?.replace(/\s+/g, ' ').trim() || ''
      const drawer = document.querySelector('[class*="drawer"], aside')
      const drawerText = drawer?.textContent || ''
      const drawerAction = (drawerText.match(/操作：([^\s]+)/) || [])[1] || ''
      return { selectedChip, footer, footerCount, tbodyRows, firstNo, drawerAction }
    })
  }

  async function iframeBlob() {
    const bits = []
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue
      try {
        const text = await frame.evaluate(() => document.body?.innerText || '')
        if (text) bits.push(text.replace(/\s+/g, ' ').trim())
      } catch { /* ignore */ }
    }
    return bits.join('\n')
  }

  function stillThinking(blob) {
    return /深度求索中/.test(String(blob || ''))
  }

  async function composerState() {
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue
      try {
        const info = await frame.evaluate(() => {
          const text = document.body?.innerText || ''
          const thinking = /深度求索中/.test(text)
          const ta = document.querySelector('textarea')
          const ce = document.querySelector('[contenteditable="true"]')
          const send = [...document.querySelectorAll('button')].find((el) => /发送/.test(el.textContent || ''))
          const el = ta || ce
          const disabled = Boolean(ta?.disabled)
            || (el && el.getAttribute('aria-disabled') === 'true')
            || Boolean(send?.disabled)
          return {
            thinking,
            hasInput: Boolean(el),
            disabled,
            sendLabel: Boolean(send),
          }
        })
        if (info) return info
      } catch { /* ignore */ }
    }
    return { thinking: stillThinking(await iframeBlob()), hasInput: false, disabled: true, sendLabel: false }
  }

  async function sessionRunning(sessionId) {
    const { json } = await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`)
    return Boolean(json?.data?.running)
  }

  async function waitDshAlive() {
    const deadline = Date.now() + 90000
    while (Date.now() < deadline) {
      const blob = await iframeBlob()
      if (/选择一个工作区|粘贴路径|用这个路径开会话/.test(blob)) {
        const labels = [workspaceName, workspaceCwd.split('/').filter(Boolean).at(-1)].filter(Boolean)
        for (const frame of page.frames()) {
          if (frame === page.mainFrame()) continue
          try {
            const input = frame.locator('input, textarea').first()
            if (await input.count()) await input.fill(workspaceCwd, { timeout: 3000 }).catch(() => {})
            const go = frame.getByRole('button', { name: /用这个路径开会话|确认|开始/ })
            if (await go.count()) await go.first().click({ timeout: 4000 }).catch(() => {})
            for (const label of labels) {
              const hits = frame.getByText(label)
              const n = await hits.count().catch(() => 0)
              for (let i = 0; i < n; i += 1) await hits.nth(i).click({ timeout: 2000 }).catch(() => {})
            }
          } catch { /* ignore */ }
        }
      }
      if (/标准模式|完全社交|发送/.test(blob) || (blob.length > 80 && /对话|轨迹/.test(blob))) {
        return true
      }
      await page.waitForTimeout(800)
    }
    return false
  }

  /**
   * Wait until the BFF turn is no longer running, or TURN_MS.
   * Do not keep waiting for 「深度求索中」 to clear after that — extra wait is not a pass.
   * Watch the right table while spinning: a painted kind other than this send is leftover.
   */
  async function promptTurn(sessionId, speech, expectedKind, holdKind = '') {
    const painted = []
    console.error(`prompt ${sessionId} expected=${expectedKind || ''}`)
    const prompted = await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
      method: 'POST',
      body: { text: speech },
      timeoutMs: 20000,
    })
    console.error(`prompted http=${prompted.http}`)
    const deadline = Date.now() + TURN_MS
    let last = { pending: null, ui: null, thinking: false, running: true, composer: null }
    let whenOfficial = null
    let sawRunning = false
    while (Date.now() < deadline) {
      const pending = await readPending(sessionId)
      const ui = await readUi()
      const blob = await iframeBlob()
      const running = await sessionRunning(sessionId)
      const thinking = stillThinking(blob)
      const composer = await composerState()
      const snap = sheetSnap(pending, ui)
      last = { pending, ui, thinking, running, composer, blob: String(blob).slice(-400), snap }
      if (running) sawRunning = true
      const paintedKind = kindKey(ui?.selectedChip)
      if (paintedKind) {
        const prev = painted[painted.length - 1]
        if (!prev || prev.kind !== paintedKind) {
          painted.push({ kind: paintedKind, dump: snap.dump, running, thinking, rows: snap.rows })
        }
      }
      const officialUp = Boolean(snap.kind) && !snap.dump && (!expectedKind || sameKind(snap.kind, expectedKind))
      if (officialUp && !whenOfficial) {
        whenOfficial = { ...last, snap }
      }
      if (sawRunning && !running) {
        console.error(`turn-closed kind=${snap.kind || ''} dump=${snap.dump} thinking=${thinking}`)
        break
      }
      await page.waitForTimeout(1200)
    }
    const leftoverJump = painted.some((row) => {
      if (!row.kind) return false
      if (expectedKind && sameKind(row.kind, expectedKind)) return false
      if (holdKind && sameKind(row.kind, holdKind)) return false
      return true
    })
    return {
      prompted,
      ...last,
      whenOfficial,
      painted,
      leftoverJump,
      dumpsDuring: painted.filter((row) => row.dump && !(expectedKind && sameKind(row.kind, expectedKind))),
    }
  }

  async function openSession() {
    const created = await bffJson('/api/v1/ai/sessions', {
      method: 'POST',
      body: workspaceId ? { workspaceId } : { cwd: workspaceCwd },
    })
    const sessionId = created.json?.data?.sessionId || created.json?.sessionId || ''
    if (!sessionId) {
      out.sessionCreate = { http: created.http, json: created.json }
      throw new Error('session-create-failed')
    }
    console.error(`openSession ${sessionId}`)
    await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await seedState(sessionId)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    console.error(`seeded ${sessionId}`)
    await page.waitForTimeout(800)
    const rec = page.getByRole('button', { name: '业务记录', exact: true })
    if (await rec.count()) await rec.click({ timeout: 8000 }).catch(() => {})
    await waitDshAlive()
    return sessionId
  }

  async function fileMd5(path) {
    if (!existsSync(path)) return ''
    return createHash('md5').update(await readFile(path)).digest('hex')
  }

  async function ensureRecordsVisible() {
    const rec = page.getByRole('button', { name: '业务记录', exact: true })
    if (await rec.count()) await rec.click({ timeout: 8000 }).catch(() => {})
    await page.locator('div.overflow-x-auto.overflow-y-auto table').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
  }

  async function waitUiThisSend(sessionId, expectedKind, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs
    let last = { pending: null, ui: null, snap: null }
    while (Date.now() < deadline) {
      await ensureRecordsVisible()
      const pending = await readPending(sessionId)
      const ui = await readUi()
      const snap = sheetSnap(pending, ui)
      last = { pending, ui, snap }
      const chip = sameKind(ui?.selectedChip, expectedKind)
      const sheet = sameKind(snap.kind, expectedKind) && !snap.dump
      const table = Number(ui?.tbodyRows || 0) > 0 || Number(ui?.footerCount || 0) > 0
      if (sheet && table && (chip || sameKind(pending?.kind, expectedKind))) return { ...last, painted: true }
      await page.waitForTimeout(400)
    }
    return { ...last, painted: false }
  }

  async function shotDistinct(name, previousHashes = []) {
    const dest = `${STORE}/media/${name}`
    let hash = ''
    let exists = false
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await ensureRecordsVisible()
      await page.screenshot({ path: dest, fullPage: true })
      await dualWrite(dest, `/media/${name}`)
      exists = existsSync(dest)
      hash = await fileMd5(dest)
      if (hash && !previousHashes.includes(hash)) break
      console.error(`shot ${name} md5=${hash} duplicate attempt=${attempt}`)
      await page.waitForTimeout(800)
    }
    return { path: dest, exists, md5: hash, distinct: Boolean(hash && !previousHashes.includes(hash)) }
  }

  function judgeThisSend(turn, expectedKind, previousFp) {
    const snap = turn.snap || sheetSnap(turn.pending, turn.ui)
    const stopped = !turn.running
    const thisSend = Boolean(snap.kind) && sameKind(snap.kind, expectedKind) && !snap.dump
    const replacedPrevious = !previousFp || fingerprint(snap) !== previousFp
    let failCode = ''
    if (!stopped) failCode = 'turn-still-open'
    else if (turn.leftoverJump || (turn.dumpsDuring && turn.dumpsDuring.length)) failCode = 'leftover-replaced-during-round'
    else if (!thisSend) failCode = snap.dump ? 'unfiltered-catalog' : `not-this-send`
    else if (previousFp && !replacedPrevious) failCode = 'still-previous-send'
    return {
      pass: stopped && thisSend && !turn.leftoverJump && replacedPrevious,
      failCode,
      snap,
      running: turn.running,
      thinking: turn.thinking,
      painted: turn.painted,
      leftoverJump: turn.leftoverJump,
    }
  }

  // ——— 第一块 + 第二块：同一条对话 2～3 句 ———
  const sessionA = await openSession()
  out.sessionA = sessionA
  if (!speech1 || !speech2) {
    out.proofs.p1 = { pass: false, failCode: '词表没有可验的关系' }
    out.proofs.p2 = { pass: false, failCode: 'no-official-sheet' }
  } else {
    const turn1 = await promptTurn(sessionA, speech1, pairA.to, '')
    const painted1 = await waitUiThisSend(sessionA, pairA.to)
    const j1 = judgeThisSend({ ...turn1, ...painted1 }, pairA.to, '')
    if (!painted1.painted) {
      j1.pass = false
      j1.failCode = j1.failCode || 'ui-not-this-send'
    }
    out.shots = out.shots || {}
    out.shots.round01 = await shotDistinct('records-close-round-01.png', [])

    const turn2 = await promptTurn(sessionA, speech2, pairB.to, pairA.to)
    const painted2 = await waitUiThisSend(sessionA, pairB.to)
    const j2 = judgeThisSend({ ...turn2, ...painted2 }, pairB.to, fingerprint(j1.snap))
    if (!painted2.painted) {
      j2.pass = false
      j2.failCode = j2.failCode || 'ui-not-this-send'
    }
    const sameTarget = pairA.to === pairB.to
    if (sameTarget && j2.failCode === 'still-previous-send' && j2.snap.roundId && j2.snap.roundId !== j1.snap.roundId && !j2.snap.dump) {
      j2.pass = !turn2.running && !turn2.leftoverJump
      j2.failCode = j2.pass ? '' : j2.failCode
    }
    out.shots.round02 = await shotDistinct('records-close-round-02.png', [out.shots.round01?.md5].filter(Boolean))
    out.proofs.p1 = {
      pass: Boolean(j1.pass && j2.pass && out.shots.round01?.distinct && out.shots.round02?.distinct),
      failCode: j1.pass
        ? (j2.pass ? ((out.shots.round01?.distinct && out.shots.round02?.distinct) ? '' : 'duplicate-screenshot') : j2.failCode)
        : j1.failCode,
      checkPass: '每一句停转后，右边 = 这一句。转的时候不跟丢、不跟成自己再查的表。',
      checkFail: '你没说下一句，表自己换了；或下一句停转后还是上一句的表。',
      turn1: { ...j1.snap, running: j1.running, thinking: j1.thinking, leftoverJump: j1.leftoverJump, painted: j1.painted, uiPainted: painted1.painted },
      turn2: { ...j2.snap, running: j2.running, thinking: j2.thinking, leftoverJump: j2.leftoverJump, painted: j2.painted, uiPainted: painted2.painted },
    }

    const composer = await composerState()
    const thinkingNow = stillThinking(await iframeBlob())
    const officialUp = Boolean(j2.snap?.kind) && !j2.snap.dump
    const p2 = officialUp && !thinkingNow && !turn2.running && composer.hasInput && !composer.disabled
    out.proofs.p2 = {
      pass: p2,
      failCode: p2 ? '' : (thinkingNow || turn2.running ? 'still-thinking' : (composer.disabled || !composer.hasInput ? 'composer-not-ready' : 'no-official-sheet')),
      checkPass: '正式表已经在右边，左边没有「深度求索中」，输入框可以再发。',
      checkFail: '右边表有了，左边还一直转。把等待再加长不算过。',
      thinking: thinkingNow,
      running: turn2.running,
      composer,
      extraWaitUsed: false,
    }
  }

  // ——— 第三块：新开一条对话，一句带关系的现查 ———
  if (!pairA) {
    out.proofs.p3 = out.proofs.p3 || { pass: false, skip: true, failCode: '词表没有可验的关系' }
  } else {
    const sessionB = await openSession()
    out.sessionB = sessionB
    const hop = await promptTurn(sessionB, hopSpeech(pairA), pairA.to)
    const painted3 = await waitUiThisSend(sessionB, pairA.to)
    const snap = painted3.snap || hop.snap || sheetSnap(hop.pending, hop.ui)
    const hasCondition = Boolean(snap.fromKind || snap.hopWhere || snap.steps.length)
    const target = snap.kind === pairA.to
    const p3 = target && !snap.dump && hasCondition && !hop.running && painted3.painted
    out.proofs.p3 = {
      pass: Boolean(p3),
      failCode: p3
        ? ''
        : (snap.dump ? 'unfiltered-catalog' : (!target ? 'not-relation-target' : (!hasCondition ? 'no-sentence-condition' : (hop.running ? 'turn-still-open' : 'not-relation-target')))),
      checkPass: '右边是关系指向的那张，并且带着这一句的条件，不是某种对象的默认第一页。',
      checkFail: '右边是没筛条件的一页列表；或跳到的不是词表关系指向的那张。',
      snap,
      running: hop.running,
      thinking: hop.thinking,
      leftoverJump: hop.leftoverJump,
      uiPainted: painted3.painted,
    }
    out.shots = out.shots || {}
    out.shots.round03 = await shotDistinct('records-close-round-03.png', [out.shots.round01?.md5, out.shots.round02?.md5].filter(Boolean))
    if (out.proofs.p3?.pass && !out.shots.round03?.distinct) {
      out.proofs.p3.pass = false
      out.proofs.p3.failCode = 'duplicate-screenshot'
    }
  }

  out.pass = Boolean(out.proofs.p1?.pass && out.proofs.p2?.pass && (out.proofs.p3?.skip || out.proofs.p3?.pass))
} catch (error) {
  out.failCode = out.failCode || String(error?.message || error)
  out.pass = false
} finally {
  await browser.close().catch(() => {})
}

const reportMd = `${STORE}/internal/verify-records-close-session-end.md`
const reportJson = `${STORE}/internal/verify-records-close-session-end.json`
await writeFile(reportJson, `${JSON.stringify(out, null, 2)}\n`)
await dualWrite(reportJson, '/internal/verify-records-close-session-end.json')

function yn(ok) {
  return ok ? '过' : '没过'
}

function existsShot(row) {
  return Boolean(row?.exists && existsSync(row.path))
}

const p3label = out.proofs.p3?.skip ? '词表没有可验的关系' : yn(out.proofs.p3?.pass)

const md = `---
cursor:
  subagentId: "bc-32b86a01-9462-5f49-8db8-601a48cefc3c"
---

# Verify: records-close session end

对照 [准备怎么验](../docs/records-close-session-plan.md)。契约未改。不写死业务名。说的话从现场词表已发布关系现拼。对抗审查未开始。不声称图过。

**SHA:** \`${out.sha}\`  
**branch:** \`${out.branch}\`  
**三块都过:** ${out.pass ? 'yes' : 'no'}${out.failCode ? `  
**failCode:** \`${out.failCode}\`` : ''}

不验某一种业务好不好使。验工作台认不认一轮、认不认正式结果。

## 第一块：同一条对话里你说 2～3 句

目的：右边跟的是「这一轮结束时的正式结果」，不是过程里过闸的那一次。

怎么做：

1. 开业务记录，用同一条对话。
2. 发送第一句。等左边这一轮停转。
3. 看右边：应是第一句的结果。
4. 再发送第二句（和第一句不是同一件事）。等左边这一轮停转。
5. 看右边：应换成第二句的结果，不能还停在第一句。

过程里怎么看「自己再查不换表」：某一句发出去之后、左边还在转的时候，右边如果先跳到另一张表（尤其是没筛条件的一页列表），再跳回来或停在那页，就算没过。停转之后，右边必须是你这一句要的那张，不是过程里闪过的那张。

**过：** 每一句停转后，右边 = 这一句。转的时候不跟丢、不跟成自己再查的表。  
**没过：** 你没说下一句，表自己换了；或下一句停转后还是上一句的表。

### 现场

- 第一句：现场词表一条已发布关系的现查（「这个，和它关联的那个」）。
- 第二句：另一条已发布关系的现查。
- 转的时候右边画过的对象：第一句 \`${JSON.stringify(out.proofs.p1?.turn1?.painted || [])}\`；第二句 \`${JSON.stringify(out.proofs.p1?.turn2?.painted || [])}\`。

### 判定

**${yn(out.proofs.p1?.pass)}** ${out.proofs.p1?.failCode || ''}

| 句 | 停转 | dump | leftoverJump | running | 右边对象 | 行数 |
|---|---|---|---|---|---|---|
| 第一句 | ${out.proofs.p1?.turn1?.running === false ? '是' : '否'} | ${out.proofs.p1?.turn1?.dump} | ${out.proofs.p1?.turn1?.leftoverJump} | ${out.proofs.p1?.turn1?.running} | （现场对象，不写进脚本） | ${out.proofs.p1?.turn1?.rows ?? ''} |
| 第二句 | ${out.proofs.p1?.turn2?.running === false ? '是' : '否'} | ${out.proofs.p1?.turn2?.dump} | ${out.proofs.p1?.turn2?.leftoverJump} | ${out.proofs.p1?.turn2?.running} | （现场对象，不写进脚本） | ${out.proofs.p1?.turn2?.rows ?? ''} |

图：\`media/records-close-round-01.png\` exists=${existsShot(out.shots?.round01)} md5=${out.shots?.round01?.md5 || ''} distinct=${out.shots?.round01?.distinct}  
路径：\`${out.shots?.round01?.path || `${STORE}/media/records-close-round-01.png`}\`

## 第二块：正式结果上桌后，左边必须停转

目的：一轮结束这个信号是真的，不是表先画了、聊天还以为没说完。

怎么做：就用第一块里某一句已经停转、右边已经是正式结果的那一刻。看左边聊天。

**过：** 正式表已经在右边，左边没有「深度求索中」，输入框可以再发。  
**没过：** 右边表有了，左边还一直转。把等待再加长不算过。

### 判定

**${yn(out.proofs.p2?.pass)}** ${out.proofs.p2?.failCode || ''}

- 右边已有正式表：${Boolean(out.proofs.p1?.turn2?.kind) && !out.proofs.p1?.turn2?.dump}
- 左边「深度求索中」：${out.proofs.p2?.thinking}
- session.running：${out.proofs.p2?.running}
- 输入框可再发：hasInput=${out.proofs.p2?.composer?.hasInput} disabled=${out.proofs.p2?.composer?.disabled}
- 额外加长等待：${out.proofs.p2?.extraWaitUsed ? '是（不算过）' : '否'}

图：\`media/records-close-round-02.png\` exists=${existsShot(out.shots?.round02)} md5=${out.shots?.round02?.md5 || ''} distinct=${out.shots?.round02?.distinct}  
路径：\`${out.shots?.round02?.path || `${STORE}/media/records-close-round-02.png`}\`

## 第三块：新开一条对话，说一句带关系的现查

目的：跳关联表走词表里已发布的关系，而且是这一轮的正式结果；不是后台自己拉的一页目录。

怎么做：

1. 新开一条对话（不要接着第一块那条）。
2. 在词表里找一条已经发布的关系：两种对象是连着的。
3. 说一句现查，把这两个都点出来（「这个，和它关联的那个」这种）。
4. 等左边这一轮停转。看右边。

**过：** 右边是关系指向的那张，并且带着这一句的条件，不是某种对象的默认第一页。  
**没过：** 右边是没筛条件的一页列表；或跳到的不是词表关系指向的那张。  
**现场词表没有关系：** 记「词表没有可验的关系」，不编一种业务来验。

### 判定

**${p3label}** ${out.proofs.p3?.failCode || ''}

- dump（没筛条件的一页列表）：${out.proofs.p3?.snap?.dump}
- 带这一句的条件：from=${Boolean(out.proofs.p3?.snap?.fromKind)} hopWhere=${out.proofs.p3?.snap?.hopWhere} steps=${(out.proofs.p3?.snap?.steps || []).length}
- running：${out.proofs.p3?.running}

图：\`media/records-close-round-03.png\` exists=${existsShot(out.shots?.round03)} md5=${out.shots?.round03?.md5 || ''} distinct=${out.shots?.round03?.distinct}  
路径：\`${out.shots?.round03?.path || `${STORE}/media/records-close-round-03.png`}\`

## Files

- ${STORE}/media/records-close-round-01.png exists=${existsShot(out.shots?.round01)} md5=${out.shots?.round01?.md5 || ''}
- ${STORE}/media/records-close-round-02.png exists=${existsShot(out.shots?.round02)} md5=${out.shots?.round02?.md5 || ''}
- ${STORE}/media/records-close-round-03.png exists=${existsShot(out.shots?.round03)} md5=${out.shots?.round03?.md5 || ''}
- ${reportJson}
`

await writeFile(reportMd, md)
await dualWrite(reportMd, '/internal/verify-records-close-session-end.md')
console.log(JSON.stringify({
  pass: out.pass,
  sha: out.sha,
  proofs: {
    p1: { pass: out.proofs.p1?.pass, failCode: out.proofs.p1?.failCode },
    p2: { pass: out.proofs.p2?.pass, failCode: out.proofs.p2?.failCode },
    p3: { pass: out.proofs.p3?.pass, skip: out.proofs.p3?.skip, failCode: out.proofs.p3?.failCode },
  },
  shots: out.shots,
  hashes: {
    round01: out.shots?.round01?.md5,
    round02: out.shots?.round02?.md5,
    round03: out.shots?.round03?.md5,
  },
  failCode: out.failCode,
}, null, 2))
process.exit(out.pass ? 0 : 1)
