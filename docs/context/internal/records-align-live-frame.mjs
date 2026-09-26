/**
 * Live-frame diagnosis only. Do not git-add. Does not send an AI prompt.
 * Inspects RecordsPanel: pending API, chrome DOM, tbody nodes, React fiber keys / row arrays.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { kindMentions, relatedMentionedKinds } from '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation/runtime/vendor-overlays/dsh-lan-assist/slots.js'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const speech = '待审回款 ∩ 已到期合同'

function coolingIn(text) {
  return /429|RATE_LIMIT|rate.?limit|upstream_cooling|上游账号正在冷却|可用账号正在冷却/i.test(String(text || ''))
}

function gitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: SCENE, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

const sha = gitSha()
await mkdir(`${STORE}/internal`, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } })
const out = { sha, hardcodedLiterals: 'none', workspaceCwd }

try {
  await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeDataSubview = 'records'
    const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
    if (!rows.some((r) => r.id === wsId)) {
      rows.push({ id: wsId, name: 'fdex测试1', desc: cwd, cwd })
      state.state.workspaces = rows
    } else {
      state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
    }
    const fallbackPanels = [
      { id: 'im', label: 'IM', icon: 'MessageCircleMore', emoji: '💬', accent: 'bg-slate-700', state: 'closed', width: 560, badge: 0, view: 'im' },
      { id: 'briefing', label: '早报', icon: 'Newspaper', emoji: '🌅', accent: 'bg-amber-500', state: 'tab', width: 560, pinned: true, view: 'briefing' },
      { id: 'plan', label: '计划', icon: 'ClipboardList', emoji: '📋', accent: 'bg-blue-500', state: 'closed', width: 600, view: 'plan' },
      { id: 'files', label: '文件', icon: 'Folder', emoji: '📁', accent: 'bg-emerald-500', state: 'closed', width: 580, view: 'files' },
      { id: 'data', label: '业务应用', icon: 'Database', emoji: '🗃️', accent: 'bg-cyan-500', state: 'full', width: 1100, view: 'data' },
      { id: 'mcp', label: 'MCP', icon: 'Plug', emoji: '🔌', accent: 'bg-rose-500', state: 'closed', width: 520, view: 'mcp' },
      { id: 'skills', label: 'Skills', icon: 'Wand2', emoji: '🪄', accent: 'bg-indigo-500', state: 'closed', width: 520, view: 'skills' },
      { id: 'memory', label: '记忆', icon: 'Brain', emoji: '🧠', accent: 'bg-fuchsia-500', state: 'closed', width: 800, view: 'memory' },
      { id: 'settings', label: '设置', icon: 'Settings', emoji: '⚙️', accent: 'bg-slate-500', state: 'closed', width: 520, view: 'settings' },
    ]
    const panels = Array.isArray(state.state.panels) ? state.state.panels : []
    state.state.panels = (panels.length ? panels : fallbackPanels).map((p) => (
      p && p.id === 'data' ? { ...p, state: 'full', width: 1100 } : p
    ))
    if (!state.state.panels.some((p) => p && p.id === 'data')) state.state.panels = fallbackPanels
    if (state.version == null) state.version = 17
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd })
  await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(2500)

  const recordsBtn = page.getByRole('button', { name: '业务记录' })
  if (await recordsBtn.count()) {
    await recordsBtn.click({ timeout: 15000 }).catch(() => {})
  }
  await page.waitForTimeout(1500)

  out.pending = await page.evaluate(async (ws) => {
    const res = await fetch(`/api/v1/biz/pending-sheet?cwd=${encodeURIComponent(ws)}`)
    const json = await res.json().catch(() => ({}))
    const sheet = json?.data?.sheet || json?.data || null
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
    const nos = rows.map((row) => (row && typeof row === 'object' ? String(row.no || row.orderId || '') : ''))
    return {
      kind: sheet?.kind || null,
      action: sheet?.action || null,
      rows: rows.length,
      first: nos[0] || '',
      nos,
      hopWhere: Array.isArray(sheet?.hopWhere) && sheet.hopWhere.length > 0,
      from: sheet?.from && typeof sheet.from === 'object' ? String(sheet.from.kind || '') : '',
      steps: Array.isArray(sheet?.steps) ? sheet.steps.map((row) => row?.kind).filter(Boolean) : [],
      speech: String(sheet?.speech || ''),
      sessionId: sheet?.sessionId || '',
    }
  }, workspaceCwd)

  async function inspectFrame() {
    return page.evaluate(() => {
    function fiberOf(el) {
      if (!el) return null
      const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'))
      return key ? el[key] : null
    }
    function fiberName(fiber) {
      if (!fiber) return ''
      const t = fiber.type || fiber.elementType
      if (typeof t === 'function') return t.displayName || t.name || ''
      if (typeof t === 'string') return t
      if (t && typeof t === 'object') return t.displayName || t.render?.name || ''
      return ''
    }
    function rowish(value) {
      if (!Array.isArray(value) || !value.length) return false
      const sample = value[0]
      return sample && typeof sample === 'object' && ('orderId' in sample || 'no' in sample || 'status' in sample)
    }
    function walkHooks(fiber) {
      const hooks = []
      const memos = []
      let hook = fiber?.memoizedState
      let i = 0
      while (hook && i < 120) {
        const value = hook.memoizedState
        let kind = 'other'
        let summary = null
        if (value && typeof value === 'object' && 'current' in value && Object.keys(value).length <= 3) {
          kind = 'ref'
          const cur = value.current
          if (typeof cur === 'string' || typeof cur === 'number' || typeof cur === 'boolean') summary = { ref: cur }
          else if (Array.isArray(cur)) summary = { refArrayLen: cur.length, refRowish: rowish(cur) }
          else if (cur && typeof cur === 'object') summary = { refKeys: Object.keys(cur).slice(0, 8) }
        } else if (Array.isArray(value) && value.length === 2 && Array.isArray(value[1])) {
          kind = 'memo'
          const inner = value[0]
          if (rowish(inner)) {
            memos.push({ hook: i, len: inner.length, nos: inner.slice(0, 12).map((row) => String(row.orderId ?? row.no ?? row.id ?? '')), objectId: inner })
            summary = { memoRows: inner.length, nos: memos[memos.length - 1].nos }
          } else if (Array.isArray(inner)) {
            summary = { memoArrayLen: inner.length }
          } else if (inner && typeof inner === 'object' && 'kind' in inner && 'rows' in inner && typeof inner.rows === 'number') {
            summary = { memoPending: { kind: inner.kind, action: inner.action, rows: inner.rows } }
          } else {
            summary = { memoType: typeof inner }
          }
        } else if (Array.isArray(value)) {
          kind = 'array'
          const sample = value[0] && typeof value[0] === 'object' ? value[0] : null
          const nos = value.slice(0, 12).map((row) => {
            if (!row || typeof row !== 'object') return String(row)
            return String(row.orderId ?? row.no ?? row.id ?? '')
          })
          summary = {
            len: value.length,
            nos,
            sampleKeys: sample ? Object.keys(sample).slice(0, 10) : [],
            objectId: value,
            rowish: rowish(value),
          }
        } else if (value && typeof value === 'object') {
          const keys = Object.keys(value)
          if ('kind' in value && 'action' in value && 'rows' in value && typeof value.rows === 'number') {
            kind = 'pending'
            summary = {
              kind: value.kind,
              action: value.action,
              rows: value.rows,
              sessionId: value.sessionId || '',
              previewId: value.previewId || '',
            }
          } else if ('previewId' in value && 'sheet' in value) {
            kind = 'drawer'
            const sheet = value.sheet
            summary = {
              previewId: value.previewId,
              action: sheet && typeof sheet === 'object' ? String(sheet.action || '') : '',
              sheetRows: sheet && Array.isArray(sheet.rows) ? sheet.rows.length : 0,
            }
          } else if (typeof value.memoizedState !== 'undefined' || typeof value.queue !== 'undefined') {
            kind = 'hook-node'
          } else {
            kind = 'object'
            summary = { keys: keys.slice(0, 12) }
          }
        } else if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' || value == null) {
          kind = 'primitive'
          summary = { value }
        }
        hooks.push({ i, kind, summary })
        hook = hook.next
        i += 1
      }
      return { hooks, memos }
    }
    function collectHost(fiber, into, depth = 0) {
      if (!fiber || into.length > 40 || depth > 8) return
      const name = fiberName(fiber)
      if (fiber.tag === 5 && (name === 'tr' || fiber.stateNode?.tagName === 'TR')) {
        into.push({
          key: fiber.key == null ? null : String(fiber.key),
          index: fiber.index,
          tag: fiber.tag,
          name,
        })
        collectHost(fiber.sibling, into, depth)
        return
      }
      collectHost(fiber.child, into, depth + 1)
      collectHost(fiber.sibling, into, depth)
    }

    const tables = [...document.querySelectorAll('div.overflow-x-auto.overflow-y-auto table')]
    const table = tables[0]
    const tbody = table?.querySelector('tbody')
    const trEls = tbody ? [...tbody.querySelectorAll('tr')] : []
    const tbodyFiber = fiberOf(tbody)
    const hostTr = []
    collectHost(tbodyFiber?.child, hostTr)
    const tbodyDirect = []
    let kid = tbodyFiber?.child
    let n = 0
    while (kid && n < 12) {
      tbodyDirect.push({ tag: kid.tag, key: kid.key == null ? null : String(kid.key), name: fiberName(kid) })
      kid = kid.sibling
      n += 1
    }

    let panel = tbodyFiber
    const ancestors = []
    while (panel && ancestors.length < 40) {
      ancestors.push(fiberName(panel) || `#${panel.tag}`)
      if (fiberName(panel) === 'RecordsPanel') break
      panel = panel.return
    }
    const walked = fiberName(panel) === 'RecordsPanel' ? walkHooks(panel) : { hooks: [], memos: [] }
    const hooks = walked.hooks
    const memos = walked.memos
    const rowArrays = hooks.filter((h) => h.kind === 'array' && h.summary?.rowish)
    const allRowRefs = [
      ...rowArrays.map((a) => ({ from: `state:${a.i}`, len: a.summary.len, objectId: a.summary.objectId, nos: a.summary.nos })),
      ...memos.map((a) => ({ from: `memo:${a.hook}`, len: a.len, objectId: a.objectId, nos: a.nos })),
    ]
    const identities = allRowRefs.map((a, idx) => ({
      from: a.from,
      len: a.len,
      sameAsRowsState: allRowRefs[0] ? a.objectId === allRowRefs[0].objectId : null,
      sameAsPrev: idx > 0 ? a.objectId === allRowRefs[idx - 1].objectId : null,
    }))
    for (const a of rowArrays) delete a.summary.objectId
    for (const a of memos) delete a.objectId

    const keys = trEls.map((tr, index) => {
      const f = fiberOf(tr)
      return {
        index,
        fiberKey: f?.key == null ? null : String(f.key),
        text: (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      }
    })
    const fiberKeys = keys.map((k) => k.fiberKey)
    const dup = fiberKeys.filter((k, i) => k && fiberKeys.indexOf(k) !== i)

    const footer = [...document.querySelectorAll('span')]
      .map((s) => s.textContent?.trim() || '')
      .find((t) => t.startsWith('共 ') && t.includes('条')) || ''
    const footerCount = Number((footer.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const bannerEl = document.querySelector('div.border-blue-200.bg-blue-50')
    const banner = bannerEl?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const bannerRows = Number((banner.match(/(\d+)\s*行/) || [])[1] || NaN)
    const chipWrap = [...document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap')]
      .find((el) => [...el.querySelectorAll('button.btn')].length)
    const chips = chipWrap
      ? [...chipWrap.querySelectorAll('button.btn')].map((b) => b.textContent?.replace(/\s+/g, ' ').trim() || '')
      : []
    const active = chipWrap
      ? [...chipWrap.querySelectorAll('button.btn')]
        .filter((b) => b.className.includes('bg-ink'))
        .map((b) => b.textContent?.replace(/\s+/g, ' ').trim() || '')
      : []
    const history = document.querySelector('select.input.h-7')
    const historyValue = history ? String(history.value || '') : ''
    const historyOptions = history
      ? [...history.querySelectorAll('option')].map((o) => ({ value: o.value, label: (o.textContent || '').trim() }))
      : []

    const pendingHook = hooks.find((h) => h.kind === 'pending')
    const pageHook = hooks.find((h) => h.kind === 'primitive' && typeof h.summary?.value === 'number' && h.summary.value >= 1 && h.summary.value <= 20)
    const rowsState = rowArrays[0]

    return {
      tableCount: tables.length,
      tbodyDomTr: trEls.length,
      tbodyDirect,
      hostTrCount: hostTr.length,
      hostTrKeys: hostTr.map((r) => r.key),
      keys,
      duplicateFiberKeys: [...new Set(dup)],
      uniqueFiberKeys: [...new Set(fiberKeys.filter(Boolean))],
      footer,
      footerCount,
      banner,
      bannerRows,
      chips,
      active,
      historyValue,
      historyOptionsCount: historyOptions.length,
      historyOptions: historyOptions.slice(0, 12),
      panelFound: fiberName(panel) === 'RecordsPanel',
      pendingHook: pendingHook?.summary || null,
      pageHook: pageHook?.summary || null,
      rowsState: rowsState ? { hook: rowsState.i, len: rowsState.summary.len, nos: rowsState.summary.nos } : null,
      memoRows: memos.map((m) => ({ hook: m.hook, len: m.len, nos: m.nos })),
      identities,
    }
    })
  }

  out.frameBefore = await inspectFrame()

  const kindsPack = await page.evaluate(async (ws) => {
    const res = await fetch(`/api/v1/biz/kinds?workspace=${encodeURIComponent(ws)}`, { headers: { accept: 'application/json' } })
    const json = await res.json().catch(() => ({}))
    const data = json?.data || {}
    return {
      kinds: Array.isArray(data.kinds) ? data.kinds.map((row) => ({
        kind: String(row?.kind || ''),
        can: Array.isArray(row?.can) ? row.can : [],
        relations: Array.isArray(row?.relations) ? row.relations : [],
      })) : [],
      relations: Array.isArray(data.relations) ? data.relations : [],
    }
  }, workspaceCwd)
  const vocabRows = kindsPack.kinds
  const labels = vocabRows.map((row) => row.kind).filter(Boolean)
  const bag = { vocab: vocabRows, relations: kindsPack.relations }
  const mentioned = [...new Set(kindMentions(speech, labels, bag).map((row) => row.kind))]
  const relatedPack = relatedMentionedKinds(speech, vocabRows, bag)
  const listed = vocabRows.filter((row) => (row.can || []).includes('现查')).map((row) => row.kind)
  const childFirst = listed.filter((kind) => (
    relatedPack.related.includes(kind)
    && kindsPack.relations.some((rel) => String(rel?.to || '') === kind && relatedPack.related.includes(String(rel?.from || '')))
  ))
  const targetCandidates = [...new Set([
    ...childFirst,
    ...relatedPack.related.filter((kind) => listed.includes(kind)),
  ])]
  out.target = { mentioned, related: relatedPack.related, targetCandidates }

  if (!targetCandidates.length) {
    out.error = { message: 'no-target-kind' }
  } else {
    const target = targetCandidates[0]
    const hop = await page.evaluate(async ({ ws, kind, text }) => {
      const res = await fetch('/api/v1/biz/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ workspace: ws, cwd: ws, kind, action: '现查', speech: text }),
      })
      const json = await res.json().catch(() => ({}))
      const err = json?.error || json?.data?.error || json?.data?.sheet?.error || json?.sheet?.error || null
      const sheet = json?.data?.sheet || json?.data || json?.sheet || {}
      const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
      return {
        http: res.status,
        error: err,
        kind: sheet?.kind || null,
        rows: rows.length,
        first: rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || '') : '',
        hopWhere: Array.isArray(sheet?.hopWhere) && sheet.hopWhere.length > 0,
        from: sheet?.from && typeof sheet.from === 'object' ? String(sheet.from.kind || '') : '',
        steps: Array.isArray(sheet?.steps) ? sheet.steps.map((row) => row?.kind).filter(Boolean) : [],
        speech: String(sheet?.speech || ''),
        blob: JSON.stringify(err || json).slice(0, 800),
      }
    }, { ws: workspaceCwd, kind: target, text: speech })
    out.hopPreview = { target, ...hop }
    if (coolingIn(hop.blob) || hop.http === 429) {
      out.rateLimited = true
    } else {
      for (let i = 0; i < 20; i += 1) {
        await page.waitForTimeout(400)
        const ready = await page.evaluate(() => {
          const footer = [...document.querySelectorAll('span')]
            .map((s) => (s.textContent || '').trim())
            .find((t) => t.startsWith('共 ') && t.includes('条')) || ''
          const banner = document.querySelector('div.border-blue-200.bg-blue-50')?.textContent || ''
          return { footer, banner }
        })
        if (/1\s*行/.test(ready.banner) || /共\s+1\s+条/.test(ready.footer)) break
      }
      out.pendingAfter = await page.evaluate(async (ws) => {
        const res = await fetch(`/api/v1/biz/pending-sheet?cwd=${encodeURIComponent(ws)}`)
        const json = await res.json().catch(() => ({}))
        const sheet = json?.data?.sheet || json?.data || null
        const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
        return {
          kind: sheet?.kind || null,
          rows: rows.length,
          first: rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || '') : '',
          hopWhere: Array.isArray(sheet?.hopWhere) && sheet.hopWhere.length > 0,
          speech: String(sheet?.speech || ''),
        }
      }, workspaceCwd)
      out.frameAfter = await inspectFrame()
    }
  }

  const after = out.frameAfter || out.frameBefore
  out.verdict = {
    rateLimited: Boolean(out.rateLimited),
    chrome1: after?.footerCount === 1 && after?.bannerRows === 1,
    tbodyGt1: (after?.tbodyDomTr || 0) > 1,
    rowsStateLen: after?.rowsState?.len ?? null,
    memoLens: (after?.memoRows || []).map((m) => m.len),
    identities: after?.identities || [],
    duplicateKeys: after?.duplicateFiberKeys || [],
    hostTrCount: after?.hostTrCount ?? null,
    tbodyDomTr: after?.tbodyDomTr ?? null,
    pendingApiRows: (out.pendingAfter || out.pending)?.rows ?? null,
    pendingHookRows: after?.pendingHook?.rows ?? null,
    firstDom: after?.keys?.[0]?.fiberKey || after?.keys?.[0]?.text || '',
    hopFirst: out.hopPreview?.first || '',
  }
} catch (err) {
  out.error = { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : '' }
} finally {
  await browser.close()
}

const report = `${STORE}/internal/records-align-live-frame.json`
await writeFile(report, JSON.stringify(out, null, 2))
console.log(JSON.stringify({
  sha: out.sha,
  rateLimited: out.rateLimited || false,
  error: out.error || null,
  target: out.target,
  hopPreview: out.hopPreview,
  pendingAfter: out.pendingAfter,
  verdict: out.verdict,
  before: {
    footerCount: out.frameBefore?.footerCount,
    bannerRows: out.frameBefore?.bannerRows,
    tbodyDomTr: out.frameBefore?.tbodyDomTr,
    hostTrCount: out.frameBefore?.hostTrCount,
    rowsState: out.frameBefore?.rowsState,
    memoRows: out.frameBefore?.memoRows,
    tbodyDirect: out.frameBefore?.tbodyDirect,
    identities: out.frameBefore?.identities,
  },
  after: {
    footerCount: out.frameAfter?.footerCount,
    bannerRows: out.frameAfter?.bannerRows,
    tbodyDomTr: out.frameAfter?.tbodyDomTr,
    hostTrCount: out.frameAfter?.hostTrCount,
    rowsState: out.frameAfter?.rowsState,
    memoRows: out.frameAfter?.memoRows,
    tbodyDirect: out.frameAfter?.tbodyDirect,
    identities: out.frameAfter?.identities,
    duplicateFiberKeys: out.frameAfter?.duplicateFiberKeys,
    hostTrKeys: out.frameAfter?.hostTrKeys,
    keys: out.frameAfter?.keys?.map((k) => k.fiberKey),
    pendingHook: out.frameAfter?.pendingHook,
    chips: out.frameAfter?.chips,
    active: out.frameAfter?.active,
    banner: out.frameAfter?.banner,
    footer: out.frameAfter?.footer,
  },
}, null, 2))
