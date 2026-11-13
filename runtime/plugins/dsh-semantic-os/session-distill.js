/**
 * One short memory card per substantial session. Origin session:{id} is idempotent.
 * @module dsh-semantic-os/session-distill
 */

import { isInjectedUserSpeech, sessionIdFromSession, userSpeechFromEvent } from './first-turn.js'

const LABEL_CAP = 400
const MIN_USER_LINES = 2
const TRAP_MARK = /未读到|对不上|缺口|未放行|不过账|不要过账|键对不上|先停|0 条|没有采购/
const RULE_CAP = 120
const TRAP_CAP = 80
const OPEN_CAP = 90

export function collectUserLines(session, extraEvent) {
  if (!session || typeof session.eventAt !== 'function') {
    const extra = userSpeechFromEvent(extraEvent)
    return extra && !isInjectedUserSpeech(extra) ? [extra] : []
  }
  const seq = Number(session.seq)
  const cap = Number.isSafeInteger(seq) && seq > 0 ? Math.min(seq, 64) : 0
  const lines = []
  for (let index = 0; index < cap; index += 1) {
    let event
    try { event = session.eventAt(index) } catch { continue }
    const text = userSpeechFromEvent(event)
    if (!text || isInjectedUserSpeech(text)) continue
    lines.push(text)
  }
  const extra = userSpeechFromEvent(extraEvent)
  if (extra && !isInjectedUserSpeech(extra) && lines[lines.length - 1] !== extra) lines.push(extra)
  return lines
}

export function sessionPresetOfHeader(session) {
  const header = session && session.header && typeof session.header === 'object' ? session.header : {}
  return String(header.agentPreset || '').trim()
}

export function shouldDistillSession(session, extraEvent) {
  if (!session) return false
  if (sessionPresetOfHeader(session) === 'fde-briefing') return false
  return collectUserLines(session, extraEvent).length >= MIN_USER_LINES
}

function clipField(text, cap) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  if (!raw) return ''
  if (raw.length <= cap) return raw
  return `${raw.slice(0, Math.max(0, cap - 1)).trim()}…`
}

function textFromAssistantContent(content) {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  return content.map((part) => {
    if (!part) return ''
    if (typeof part === 'string') return part
    if (part.type === 'reasoning') return ''
    if (part.type === 'text' && typeof part.text === 'string') return part.text
    return ''
  }).join('').trim()
}

export function assistantSpeechFromEvent(event) {
  if (!event || event.type !== 'assistant/message') return ''
  const data = event.data && typeof event.data === 'object' ? event.data : {}
  const message = data.message && typeof data.message === 'object' ? data.message : data
  const text = textFromAssistantContent(message.content)
  if (!text || text.startsWith('{')) return ''
  return text
}

export function collectAssistantLines(session) {
  if (!session || typeof session.eventAt !== 'function') return []
  const seq = Number(session.seq)
  const cap = Number.isSafeInteger(seq) && seq > 0 ? Math.min(seq, 64) : 0
  const lines = []
  for (let index = 0; index < cap; index += 1) {
    let event
    try { event = session.eventAt(index) } catch { continue }
    const text = assistantSpeechFromEvent(event)
    if (text) lines.push(text)
  }
  return lines
}

export function trapLinesOf(texts) {
  return (Array.isArray(texts) ? texts : [])
    .map((row) => String(row || '').replace(/\s+/g, ' ').trim())
    .filter((row) => row && TRAP_MARK.test(row))
}

export function formatDistillLabel(session, lines) {
  const header = session && session.header && typeof session.header === 'object' ? session.header : {}
  const title = String(header.title || '').trim()
  const id = sessionIdFromSession(session)
  const users = (Array.isArray(lines) ? lines : []).map((row) => String(row || '').trim()).filter(Boolean)
  const assistants = collectAssistantLines(session)
  const rule = clipField(assistants[assistants.length - 1] || title || users[users.length - 1] || '会话收口', RULE_CAP)
  const traps = trapLinesOf([...assistants, ...users]).slice(-2).map((row) => clipField(row, TRAP_CAP)).filter(Boolean)
  const open = clipField(users.slice(-2).join('；'), OPEN_CAP)
  const parts = [
    `规则：${rule}`,
    id ? `怎么知道：session:${id}` : '',
    `陷阱：${traps.length ? traps.join('；') : '无'}`,
    open ? `未证实：${open}` : '',
  ].filter(Boolean)
  const raw = parts.join('\n')
  return raw.length <= LABEL_CAP ? raw : `${raw.slice(0, LABEL_CAP - 1).trim()}…`
}

export async function postSessionDistill(session, io = {}, extraEvent) {
  if (!shouldDistillSession(session, extraEvent)) return { skipped: true, reason: 'thin' }
  const id = sessionIdFromSession(session)
  const cwd = String(session.header && session.header.cwd || '').trim()
  if (!id || !cwd) return { skipped: true, reason: 'no_cwd' }
  const label = formatDistillLabel(session, collectUserLines(session, extraEvent))
  const env = io.env || process.env
  const port = String(env.FDE_RUNTIME_PORT || '4318')
  const home = env.FDE_DSH_HOME || env.DSH_HOME || ''
  const read = io.readFile || (await import('node:fs/promises')).readFile
  let token = ''
  if (home) {
    try { token = String(await read(`${String(home).replace(/[\\/]+$/, '')}/.ui-token`, 'utf8')).trim() } catch { token = '' }
  }
  const get = io.fetch || globalThis.fetch
  if (typeof get !== 'function') return { skipped: true, reason: 'no_fetch' }
  const payload = JSON.stringify({
    cwd,
    workspaceCwd: cwd,
    origin: `session:${id}`,
    label,
    sessionId: id,
  })
  try {
    const res = await get(`http://127.0.0.1:${port}/api/v1/memory/cards`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Origin: `http://127.0.0.1:${port}`,
        ...(token ? { 'x-fde-ui-token': token } : {}),
      },
      body: payload,
      signal: io.signal || AbortSignal.timeout(2000),
    })
    if (!res || !res.ok) return { skipped: true, reason: 'http' }
    return { ok: true, origin: `session:${id}` }
  } catch {
    return { skipped: true, reason: 'http' }
  }
}

export function installSessionDistill(ctx, opts = {}) {
  const seen = new Set()
  const post = opts.post || ((sess, extra) => postSessionDistill(sess, {}, extra))
  const listen = (name, fn) => {
    if (ctx && typeof ctx.on === 'function') {
      try { ctx.on(name, fn) } catch { /* optional */ }
    }
  }

  async function maybe(session, extraEvent) {
    const id = sessionIdFromSession(session)
    if (!id || seen.has(id)) return
    if (!shouldDistillSession(session, extraEvent)) return
    seen.add(id)
    try { await post(session, extraEvent) } catch { seen.delete(id) }
  }

  listen('session/event', (session, event) => {
    if (!event || event.type !== 'user/message') return
    void maybe(session, event)
  })
  listen('workspace.archiveSession', (first, second) => { void maybe(second || first) })
  return { maybe, seen }
}
