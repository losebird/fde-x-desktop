/**
 * One short memory card per substantial session. Origin session:{id} is idempotent.
 * @module dsh-semantic-os/session-distill
 */

import { isInjectedUserSpeech, sessionIdFromSession, userSpeechFromEvent } from './first-turn.js'

const LABEL_CAP = 400
const MIN_USER_LINES = 2

export function collectUserLines(session) {
  if (!session || typeof session.eventAt !== 'function') return []
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
  return lines
}

export function sessionPresetOfHeader(session) {
  const header = session && session.header && typeof session.header === 'object' ? session.header : {}
  return String(header.agentPreset || '').trim()
}

export function shouldDistillSession(session) {
  if (!session) return false
  if (sessionPresetOfHeader(session) === 'fde-briefing') return false
  return collectUserLines(session).length >= MIN_USER_LINES
}

export function formatDistillLabel(session, lines) {
  const header = session && session.header && typeof session.header === 'object' ? session.header : {}
  const title = String(header.title || '').trim()
  const body = (Array.isArray(lines) ? lines : []).slice(-3).join('\n').trim()
  const raw = [title ? `会话收口 · ${title}` : '会话收口', body].filter(Boolean).join('\n')
  return raw.length <= LABEL_CAP ? raw : `${raw.slice(0, LABEL_CAP - 1).trim()}…`
}

export async function postSessionDistill(session, io = {}) {
  if (!shouldDistillSession(session)) return { skipped: true, reason: 'thin' }
  const id = sessionIdFromSession(session)
  const cwd = String(session.header && session.header.cwd || '').trim()
  if (!id || !cwd) return { skipped: true, reason: 'no_cwd' }
  const label = formatDistillLabel(session, collectUserLines(session))
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
  const post = opts.post || postSessionDistill
  const listen = (name, fn) => {
    if (ctx && typeof ctx.on === 'function') {
      try { ctx.on(name, fn) } catch { /* optional */ }
    }
  }

  async function maybe(session) {
    const id = sessionIdFromSession(session)
    if (!id || seen.has(id)) return
    if (!shouldDistillSession(session)) return
    seen.add(id)
    try { await post(session) } catch { seen.delete(id) }
  }

  listen('session/event', (session, event) => {
    if (!event || event.type !== 'user/message') return
    void maybe(session)
  })
  listen('workspace.archiveSession', (first, second) => { void maybe(second || first) })
  return { maybe, seen }
}
