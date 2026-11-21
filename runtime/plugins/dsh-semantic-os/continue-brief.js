/**
 * Tiny always-on continuation brief. Cap is characters, not a transcript dump.
 * @module dsh-semantic-os/continue-brief
 */

export const CORE_BRIEF_CAP = 400
export const BRIEF_TTL_MS = 120_000

export function createBriefCache({ ttlMs = BRIEF_TTL_MS, now = () => Date.now() } = {}) {
  const map = new Map()
  function keyOf(cwd, sessionId) {
    return `${String(cwd || '').trim()}::${String(sessionId || '').trim()}`
  }
  async function load(cwd, sessionId, loader) {
    const key = keyOf(cwd, sessionId)
    const stamp = now()
    const hit = map.get(key)
    if (hit && hit.value && stamp - hit.at < ttlMs) return hit.value
    if (hit && hit.wait) return hit.wait
    let settle
    const wait = new Promise((resolve, reject) => {
      settle = { resolve, reject }
    })
    map.set(key, { at: (hit && hit.at) || 0, value: hit && hit.value, wait })
    try {
      const value = await loader()
      map.set(key, { at: now(), value, wait: null })
      settle.resolve(value)
      return value
    } catch (error) {
      if (hit && hit.value) {
        map.set(key, { at: hit.at, value: hit.value, wait: null })
        settle.resolve(hit.value)
        return hit.value
      }
      map.delete(key)
      settle.reject(error)
      throw error
    }
  }
  return { load, keyOf }
}

const CONTINUE_MARK = /接着干|接着处理|继续处理|还没做完|未完成|上次没做完|上次还没做完/

export function isContinueQuery(text) {
  return CONTINUE_MARK.test(String(text || '').trim())
}

export function clipBrief(text, cap = CORE_BRIEF_CAP) {
  const raw = String(text || '').trim()
  if (raw.length <= cap) return raw
  return `${raw.slice(0, Math.max(0, cap - 1)).trim()}…`
}

export function projectionVal(node) {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node).trim()
  if (typeof node === 'object' && node.val != null) return String(node.val || '').trim()
  return ''
}

export function listedSessionRow(row) {
  if (!row || typeof row !== 'object') return null
  const header = row.header && typeof row.header === 'object' ? row.header : {}
  const id = String(row.id || row.sessionId || header.id || header.sessionId || '').trim()
  if (!id) return null
  const cwd = String(row.cwd || header.cwd || '').trim()
  const title = sessionTitleOf(row)
  const preset = sessionPresetOf(row)
  const lastPromptAt = Number(row.lastPromptAt || header.lastPromptAt || 0)
  const updatedAt = Number(row.updatedAt || header.updatedAt || lastPromptAt || row.createdAt || header.createdAt || 0)
  return { id, cwd, title, agentPreset: preset, lastPromptAt, updatedAt }
}

export function mergeSessionLists(persisted, live, cwd) {
  const want = String(cwd || '').trim()
  const byId = new Map()
  for (const raw of [...(Array.isArray(persisted) ? persisted : []), ...(Array.isArray(live) ? live : [])]) {
    const row = listedSessionRow(raw)
    if (!row) continue
    if (want && row.cwd && row.cwd !== want) continue
    const prev = byId.get(row.id)
    if (!prev) {
      byId.set(row.id, row)
      continue
    }
    byId.set(row.id, {
      id: row.id,
      cwd: prev.cwd || row.cwd,
      title: prev.title || row.title,
      agentPreset: prev.agentPreset || row.agentPreset,
      lastPromptAt: Math.max(Number(prev.lastPromptAt) || 0, Number(row.lastPromptAt) || 0),
      updatedAt: Math.max(Number(prev.updatedAt) || 0, Number(row.updatedAt) || 0),
    })
  }
  return [...byId.values()]
}

const PROBE_TITLE = /INGESTOBS|SCANFILE|AUTOFILE-?(LOW|HIGH)?|BRIDGEPROBE|ARCHIVEFULL|回扫升格探针|Work on INGESTOBS/i

export function isProbeSessionTitle(title) {
  return PROBE_TITLE.test(String(title || ''))
}

export function titleRelatedToTodo(title, todo) {
  const a = String(title || '').trim()
  const b = String(todo || '').trim()
  if (!a || !b) return false
  const keysA = a.match(/PO-?\d{6,}/gi) || []
  const keysB = b.match(/PO-?\d{6,}/gi) || []
  const norm = (key) => String(key || '').replace(/-/g, '').toUpperCase()
  if (keysA.some((key) => keysB.some((other) => norm(key) === norm(other)))) return true
  if (a.includes(b) || b.includes(a)) return true
  const head = b.replace(/[：:].*$/u, '').slice(0, 8)
  return head.length >= 4 && a.includes(head)
}

export function pickLastSession(rows, input = {}) {
  const cwd = String(input.cwd || '').trim()
  const currentId = String(input.currentId || '').trim()
  const todos = Array.isArray(input.todos)
    ? input.todos.map((row) => String(row && row.title || row || '').trim()).filter(Boolean)
    : []
  const list = Array.isArray(rows) ? rows : []
  const ranked = list
    .map((row) => {
      const flat = listedSessionRow(row)
      if (!flat) return null
      if (flat.id === currentId) return null
      if (flat.agentPreset === 'fde-briefing') return null
      if (cwd && flat.cwd && flat.cwd !== cwd) return null
      if (!flat.title && !flat.updatedAt && !flat.lastPromptAt) return null
      return {
        id: flat.id,
        title: flat.title,
        updatedAt: flat.updatedAt || flat.lastPromptAt,
        lastPromptAt: flat.lastPromptAt || flat.updatedAt,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const work = ranked.filter((row) => !isProbeSessionTitle(row.title))
  const pool = work.length ? work : ranked
  const hit = pool.find((row) => todos.some((todo) => titleRelatedToTodo(row.title, todo)))
  return hit || pool[0] || null
}

export function peerLeaves(peers) {
  const names = []
  const seen = new Set()
  for (const cwd of Array.isArray(peers) ? peers : []) {
    const leaf = String(cwd || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() || String(cwd || '').trim()
    if (!leaf || seen.has(leaf)) continue
    seen.add(leaf)
    names.push(leaf)
  }
  return names
}

export function formatCoreBrief(input = {}) {
  const cwd = String(input.cwd || '').trim()
  const leaf = cwd.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || cwd
  const last = input.lastSession && typeof input.lastSession === 'object' ? input.lastSession : null
  const todos = Array.isArray(input.todos) ? input.todos.map((row) => String(row && row.title || row || '').trim()).filter(Boolean).slice(0, 3) : []
  const bridges = peerLeaves(input.peers)
  const lines = ['续场：']
  if (leaf) lines.push(`工作区 ${leaf}`)
  if (last && last.title) lines.push(`最近一场 ${last.title}`)
  else if (last && last.id) lines.push(`最近一场 ${last.id}`)
  else lines.push('最近一场 无')
  if (todos.length) lines.push(`未完成 ${todos.join('；')}`)
  else lines.push('未完成 0')
  if (bridges.length) lines.push(`桥接 ${bridges.length}（${bridges.slice(0, 2).join('；')}${bridges.length > 2 ? '…' : ''}）`)
  else lines.push('桥接 无（只续本工作区）')
  lines.push('细节用 search_text。')
  return clipBrief(lines.join('\n'))
}

export function rewriteContinueQuery(speech, brief = {}) {
  const line = String(speech || '').trim()
  if (!isContinueQuery(line)) return line
  const last = brief.lastSession && typeof brief.lastSession === 'object' ? brief.lastSession : null
  const todos = Array.isArray(brief.todos) ? brief.todos.map((row) => String(row && row.title || row || '').trim()).filter(Boolean) : []
  const bits = []
  if (last && last.title) bits.push(last.title)
  else if (last && last.id) bits.push(last.id)
  if (todos.length) bits.push(todos.slice(0, 3).join(' '))
  if (!bits.length) return '未完成 待办'
  return bits.join(' ')
}

export function sessionTitleOf(row) {
  if (!row || typeof row !== 'object') return ''
  const header = row.header && typeof row.header === 'object' ? row.header : {}
  const values = row.projections && row.projections.values && typeof row.projections.values === 'object'
    ? row.projections.values
    : {}
  const headerValues = header.projections && header.projections.values && typeof header.projections.values === 'object'
    ? header.projections.values
    : {}
  const recordRows = row.record && row.record.rows && typeof row.record.rows === 'object'
    ? row.record.rows
    : {}
  return projectionVal(row.title)
    || projectionVal(row.displayTitle)
    || projectionVal(header.title)
    || projectionVal(values.title)
    || projectionVal(headerValues.title)
    || projectionVal(recordRows.title)
}

export async function fillSessionTitles(rows, io = {}) {
  const list = Array.isArray(rows) ? rows : []
  const home = String((io.env || process.env).DSH_HOME || '').trim()
  if (!home) return list
  const read = io.readFile || (await import('node:fs/promises')).readFile
  await Promise.all(list.map(async (row) => {
    if (!row || row.title) return
    const id = String(row.id || '').trim()
    if (!id) return
    try {
      const raw = await read(`${home.replace(/[\\/]+$/, '')}/storages/session_projcache/sessions/${id}.json`, 'utf8')
      const title = sessionTitleOf(JSON.parse(String(raw || '')))
      if (title) row.title = title
    } catch { /* optional cache */ }
  }))
  return list
}

const OPEN_TASK = new Set(['todo', 'doing'])

export async function fetchOpenTodos(cwd, io = {}) {
  const path = String(cwd || '').trim()
  if (!path) return []
  const env = io.env || process.env
  const port = String(env.FDE_RUNTIME_PORT || '4318')
  const home = env.FDE_DSH_HOME || env.DSH_HOME || ''
  const read = io.readFile || (await import('node:fs/promises')).readFile
  let token = ''
  if (home) {
    try { token = String(await read(joinPath(home, '.ui-token'), 'utf8')).trim() } catch { token = '' }
  }
  const href = `http://127.0.0.1:${port}/api/v1/plan/tasks?workspace=${encodeURIComponent(path)}`
  const get = io.fetch || globalThis.fetch
  if (typeof get !== 'function') return []
  try {
    const res = await get(href, {
      headers: token ? { 'x-fde-ui-token': token } : {},
      signal: io.signal || AbortSignal.timeout(1500),
    })
    if (!res || !res.ok) return []
    const body = await res.json()
    const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : []
    return rows
      .filter((row) => row && OPEN_TASK.has(String(row.status || '')))
      .map((row) => ({ title: String(row.title || '').trim() }))
      .filter((row) => row.title)
      .slice(0, 8)
  } catch {
    return []
  }
}

export const FILED_RULE_CAP = 3

export function pickFiledRules(cards, cap = FILED_RULE_CAP) {
  const opts = cap && typeof cap === 'object' ? cap : { cap }
  const limit = Number.isFinite(Number(opts.cap)) && Number(opts.cap) > 0
    ? Math.min(Number(opts.cap), 8)
    : FILED_RULE_CAP
  const todos = Array.isArray(opts.todos)
    ? opts.todos.map((row) => String(row && row.title || row || '').trim()).filter(Boolean)
    : []
  const needles = [String(opts.lastTitle || '').trim(), ...todos].filter(Boolean)
  const scored = []
  let index = 0
  for (const card of Array.isArray(cards) ? cards : []) {
    if (!card || typeof card !== 'object') continue
    const status = String(card.status || '')
    if (status && status !== '已入档') continue
    if (card.current === false) continue
    const id = String(card.id || '').trim()
    const raw = String(card.body || card.content || card.label || '').trim()
    if (!id || !raw) continue
    const lines = raw.split('\n').map((row) => String(row || '').trim()).filter(Boolean)
    const ruleLine = lines.find((row) => row.startsWith('规则：')) || lines[0] || ''
    const cue = ruleLine.replace(/^规则：/, '').trim() || ruleLine
    if (!cue) continue
    let score = 0
    if (isProbeSessionTitle(cue) || isProbeSessionTitle(raw)) score -= 100
    if (needles.some((needle) => titleRelatedToTodo(cue, needle) || titleRelatedToTodo(raw, needle))) score += 50
    if (/案卷/.test(cue)) score += 15
    if (/未放行|不过账|未读到/.test(cue) || /未放行|不过账|未读到/.test(raw)) score += 10
    scored.push({
      id,
      label: cue.length <= 80 ? cue : `${cue.slice(0, 79).trim()}…`,
      score,
      index,
    })
    index += 1
  }
  scored.sort((a, b) => b.score - a.score || a.index - b.index)
  return scored.slice(0, limit).map((row) => ({ id: row.id, label: row.label }))
}

export async function fetchFiledRules(cwd, io = {}) {
  const path = String(cwd || '').trim()
  if (!path) return []
  const env = io.env || process.env
  const port = String(env.FDE_RUNTIME_PORT || '4318')
  const home = env.FDE_DSH_HOME || env.DSH_HOME || ''
  const read = io.readFile || (await import('node:fs/promises')).readFile
  let token = ''
  if (home) {
    try { token = String(await read(joinPath(home, '.ui-token'), 'utf8')).trim() } catch { token = '' }
  }
  const href = `http://127.0.0.1:${port}/api/v1/memory/cards?cwd=${encodeURIComponent(path)}&include_filed=true`
  const get = io.fetch || globalThis.fetch
  if (typeof get !== 'function') return []
  try {
    const res = await get(href, {
      headers: token ? { 'x-fde-ui-token': token } : {},
      signal: io.signal || AbortSignal.timeout(1500),
    })
    if (!res || !res.ok) return []
    const body = await res.json()
    const payload = body && typeof body === 'object' && body.data && typeof body.data === 'object' ? body.data : body
    const rows = Array.isArray(payload?.cards) ? payload.cards : Array.isArray(payload) ? payload : []
    return pickFiledRules(rows, io)
  } catch {
    return []
  }
}

function joinPath(home, name) {
  const sep = String(home).includes('\\') ? '\\' : '/'
  return `${String(home).replace(/[\\/]+$/, '')}${sep}${name}`
}

export function sessionPresetOf(row) {
  if (!row || typeof row !== 'object') return ''
  const header = row.header && typeof row.header === 'object' ? row.header : {}
  const values = row.projections && row.projections.values && typeof row.projections.values === 'object'
    ? row.projections.values
    : {}
  return projectionVal(row.agentPreset)
    || projectionVal(row.preset)
    || projectionVal(header.agentPreset)
    || projectionVal(values.agentPreset)
}
