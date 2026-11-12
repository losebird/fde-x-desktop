/**
 * Tiny always-on continuation brief. Cap is characters, not a transcript dump.
 * @module dsh-semantic-os/continue-brief
 */

export const CORE_BRIEF_CAP = 400

const CONTINUE_MARK = /接着干|接着处理|继续处理|还没做完|未完成|上次没做完|上次还没做完/

export function isContinueQuery(text) {
  return CONTINUE_MARK.test(String(text || '').trim())
}

export function clipBrief(text, cap = CORE_BRIEF_CAP) {
  const raw = String(text || '').trim()
  if (raw.length <= cap) return raw
  return `${raw.slice(0, Math.max(0, cap - 1)).trim()}…`
}

export function pickLastSession(rows, input = {}) {
  const cwd = String(input.cwd || '').trim()
  const currentId = String(input.currentId || '').trim()
  const list = Array.isArray(rows) ? rows : []
  const ranked = list
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const id = String(row.id || row.sessionId || '').trim()
      if (!id || id === currentId) return null
      const preset = String(row.agentPreset || row.preset || '').trim()
      if (preset === 'fde-briefing') return null
      const rowCwd = String(row.cwd || '').trim()
      if (cwd && rowCwd && rowCwd !== cwd) return null
      const title = String(row.title || '').trim()
      const lastPromptAt = Number(row.lastPromptAt || 0)
      if (!title && !lastPromptAt) return null
      const updatedAt = Number(row.updatedAt || lastPromptAt || 0)
      return { id, title, updatedAt, lastPromptAt }
    })
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt)
  return ranked[0] || null
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
  return String(row.title || header.title || values.title || '').trim()
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
  return String(row.agentPreset || header.agentPreset || values.agentPreset || '').trim()
}
