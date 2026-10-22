/**
 * Watch lan-assist slips and record_decision into the CURRENT project graph.
 * Missing dir = no-op success. Never write into lan-assist slips. Never invent a graph.
 * @module dsh-semantic-os/slips
 */

import { watch } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { homedir, hostname } from 'node:os'
import { dirname, join } from 'node:path'
import { postPython } from './ingest.js'

export const SLIP_POLL_MS = 30_000
const SEEN_VERSION = 1

export function dshHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

export function slipsDir(home = dshHome()) {
  return join(home, 'lan-assist', 'slips')
}

export function seenPath(home = dshHome()) {
  return join(home, 'semantic-os', 'slip-seen.json')
}

export function workspaceStorePath(home = dshHome()) {
  return join(home, 'storages', 'workspace.json')
}

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/
const IPV6 = /^[0-9a-f:]+$/i
const FQDN = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i

export function actorLooksUnstable(actor) {
  const raw = String(actor || '').trim()
  if (!raw) return true
  const lower = raw.toLowerCase()
  if (lower === 'anonymous-user-id' || lower === 'anonymous' || lower === 'localhost') return true
  if (IPV4.test(raw)) return true
  if (raw.includes(':') && IPV6.test(raw)) return true
  if (FQDN.test(raw)) return true
  try {
    if (raw === hostname()) return true
  } catch { /* ignore */ }
  return false
}

function adoptedBody(row) {
  for (const key of ['quote', 'body', 'adopted', 'text', 'adoptedBody']) {
    const value = row && row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, slip: object } | { ok: false, reason: string }}
 */
export function parseSlip(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'NOT_OBJECT' }
  }
  const schemaVersion = Number(raw.schemaVersion)
  if (!Number.isFinite(schemaVersion) || schemaVersion < 1) {
    return { ok: false, reason: 'BAD_SCHEMA' }
  }
  const requestId = String(raw.requestId || '').trim()
  if (!requestId) return { ok: false, reason: 'NO_REQUEST' }
  const sessionId = String(raw.sessionId || '').trim()
  const actor = String(raw.actor || '').trim()
  if (actorLooksUnstable(actor)) return { ok: false, reason: 'BAD_ACTOR' }
  const quote = adoptedBody(raw)
  if (!quote) return { ok: false, reason: 'NO_BODY' }
  const toIds = Array.isArray(raw.toIds)
    ? raw.toIds.map((id) => String(id || '').trim()).filter(Boolean)
    : []
  const kind = String(raw.kind || '').trim() === 'mail' ? 'mail' : 'adopt'
  if (kind === 'mail') {
    const turn = String(raw.turn || 'send').trim() || 'send'
    const id = String(raw.id || `${requestId}.${turn}`).trim()
    return {
      ok: true,
      slip: {
        kind: 'mail',
        schemaVersion,
        id,
        requestId,
        turn,
        sessionId,
        workspace: String(raw.workspace || '').trim(),
        actor,
        fromName: String(raw.fromName || '').trim(),
        quote,
        toIds,
        at: String(raw.at || raw.adoptedAt || '').trim(),
      },
    }
  }
  return {
    ok: true,
    slip: {
      kind: 'adopt',
      schemaVersion,
      requestId,
      sessionId,
      actor,
      quote,
      toIds,
      adoptedAt: String(raw.adoptedAt || '').trim(),
    },
  }
}

export async function loadSeen(home = dshHome()) {
  try {
    const raw = JSON.parse(await readFile(seenPath(home), 'utf8'))
    const ids = Array.isArray(raw && raw.ids) ? raw.ids : []
    return { version: SEEN_VERSION, ids: ids.map((id) => String(id)) }
  } catch {
    return { version: SEEN_VERSION, ids: [] }
  }
}

export async function saveSeen(ids, home = dshHome()) {
  const file = seenPath(home)
  await mkdir(dirname(file), { recursive: true })
  const unique = [...new Set((ids || []).map((id) => String(id)).filter(Boolean))]
  await writeFile(file, `${JSON.stringify({ version: SEEN_VERSION, ids: unique }, null, 2)}\n`, 'utf8')
  return unique
}

function headerId(header) {
  const row = header && header.header && typeof header.header === 'object' ? header.header : header
  if (!row) return ''
  return String(row.id || (row.meta && row.meta.id) || '')
}

function headerCwd(header) {
  const row = header && header.header && typeof header.header === 'object' ? header.header : header
  if (!row) return ''
  return String(row.cwd || (row.meta && row.meta.cwd) || '')
}

export async function cwdFromWorkspaceStore(sessionId, home = dshHome()) {
  const id = String(sessionId || '').trim()
  if (!id) return ''
  try {
    const raw = JSON.parse(await readFile(workspaceStorePath(home), 'utf8'))
    const workspaces = raw && raw.tables && raw.tables.workspaces
    if (!workspaces || typeof workspaces !== 'object') return ''
    for (const row of Object.values(workspaces)) {
      if (!row || typeof row !== 'object') continue
      const ids = Array.isArray(row.sessionIds) ? row.sessionIds : []
      if (ids.includes(id) && typeof row.path === 'string' && row.path.trim()) {
        return row.path.trim()
      }
    }
  } catch { /* ignore */ }
  return ''
}

export async function resolveSessionCwd(sessionId, getPersistence, home = dshHome()) {
  const id = String(sessionId || '').trim()
  if (!id) return ''
  const persistence = typeof getPersistence === 'function' ? getPersistence() : null
  if (persistence && typeof persistence.list === 'function') {
    try {
      const headers = await persistence.list()
      const list = Array.isArray(headers) ? headers : []
      for (const header of list) {
        if (headerId(header) === id) {
          const cwd = headerCwd(header)
          if (cwd) return cwd
        }
      }
    } catch { /* fall through */ }
  }
  return cwdFromWorkspaceStore(id, home)
}

export function slipSeenId(slip) {
  if (!slip) return ''
  if (slip.kind === 'mail') return `mail:${slip.id || slip.requestId}`
  return String(slip.requestId || '')
}

export async function recordMailDocument(sidecar, cwd, slip) {
  const path = `mail:${slip.id || slip.requestId}`
  const result = await postPython(sidecar, {
    op: 'upsert_documents',
    cwd,
    args: {
      texts: [{
        path,
        text: slip.quote,
        role: slip.turn || 'mail',
        messageId: slip.id || slip.requestId,
        timestamp: slip.at || undefined,
      }],
    },
  })
  if (!result || result.error) return { ok: false, error: (result && result.error) || 'UPSERT_FAILED' }
  return { ok: true, result }
}

export async function recordSlipDecision(sidecar, cwd, slip) {
  const result = await postPython(sidecar, {
    op: 'record_decision',
    cwd,
    args: {
      category: 'lan_adopt',
      scenario: slip.quote,
      reasoning: `adopted from slip ${slip.requestId}`,
      outcome: 'adopted',
      confidence: 1,
      decision_maker: slip.actor,
      kind: '信封',
      nodded: true,
      metadata: {
        requestId: slip.requestId,
        sessionId: slip.sessionId,
        toIds: slip.toIds,
        adoptedAt: slip.adoptedAt,
        actor: slip.actor,
      },
    },
  })
  if (!result || result.error) return { ok: false, error: (result && result.error) || 'RECORD_FAILED' }
  return { ok: true, result }
}

/**
 * Unit-test helper: parse + record with a forced cwd. Does not touch seen unless markSeen.
 */
export async function ingestParsedSlip(sidecar, slip, cwd, opts = {}) {
  if (!slip || !cwd) return { ok: false, error: 'NO_CWD' }
  const snap = sidecar && typeof sidecar.snapshot === 'function' ? sidecar.snapshot() : null
  if (snap && (!snap.ready || !snap.port)) return { ok: false, error: 'NOT_READY' }
  const recorded = slip.kind === 'mail'
    ? await recordMailDocument(sidecar, cwd, slip)
    : await recordSlipDecision(sidecar, cwd, slip)
  const seenId = slipSeenId(slip)
  if (recorded.ok && opts.markSeen && opts.home && seenId) {
    const seen = await loadSeen(opts.home)
    if (!seen.ids.includes(seenId)) {
      seen.ids.push(seenId)
      await saveSeen(seen.ids, opts.home)
    }
  }
  return recorded
}

/**
 * @param {{
 *   sidecar: { snapshot: Function },
 *   getPersistence?: () => object | null,
 *   onGraphWrite?: Function,
 *   pollMs?: number,
 *   home?: string,
 * }} opts
 */
export function createSlipIngest(opts) {
  const sidecar = opts.sidecar
  const getPersistence = opts.getPersistence || (() => null)
  const onGraphWrite = opts.onGraphWrite
  const pollMs = Number(opts.pollMs) > 0 ? Number(opts.pollMs) : SLIP_POLL_MS
  const home = () => opts.home || dshHome()

  /** @type {ReturnType<typeof setInterval> | null} */
  let timer = null
  /** @type {import('node:fs').FSWatcher | null} */
  let watcher = null
  let running = false
  let last = { at: 0, ok: true, ingested: 0, skipped: 0, pending: 0, error: '' }

  async function tick() {
    if (running) return last
    running = true
    let ingested = 0
    let skipped = 0
    let pending = 0
    let error = ''
    try {
      const dir = slipsDir(home())
      let names
      try {
        names = await readdir(dir)
      } catch (err) {
        const code = err && err.code
        if (code === 'ENOENT') {
          last = { at: Date.now(), ok: true, ingested: 0, skipped: 0, pending: 0, error: '' }
          return last
        }
        throw err
      }
      const snap = sidecar.snapshot()
      if (!snap.ready || !snap.port) {
        last = { at: Date.now(), ok: true, ingested: 0, skipped: 0, pending: 0, error: 'NOT_READY' }
        return last
      }
      const seen = await loadSeen(home())
      const seenSet = new Set(seen.ids)
      for (const name of names) {
        if (!name.endsWith('.json')) continue
        let raw
        try {
          raw = JSON.parse(await readFile(join(dir, name), 'utf8'))
        } catch {
          skipped += 1
          continue
        }
        const parsed = parseSlip(raw)
        if (!parsed.ok) {
          skipped += 1
          continue
        }
        const slip = parsed.slip
        const seenId = slipSeenId(slip)
        if (seenSet.has(seenId)) {
          skipped += 1
          continue
        }
        const cwd = String(slip.workspace || '').trim()
          || await resolveSessionCwd(slip.sessionId, getPersistence, home())
        if (!cwd) {
          pending += 1
          continue
        }
        const recorded = slip.kind === 'mail'
          ? await recordMailDocument(sidecar, cwd, slip)
          : await recordSlipDecision(sidecar, cwd, slip)
        if (!recorded.ok) {
          pending += 1
          error = recorded.error || (slip.kind === 'mail' ? 'UPSERT_FAILED' : 'RECORD_FAILED')
          continue
        }
        seenSet.add(seenId)
        seen.ids.push(seenId)
        await saveSeen(seen.ids, home())
        ingested += 1
        if (typeof onGraphWrite === 'function') {
          try { onGraphWrite(cwd, slip.kind === 'mail' ? 'lan_mail' : 'record_decision') } catch { /* ignore */ }
        }
      }
      last = { at: Date.now(), ok: true, ingested, skipped, pending, error }
      return last
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      last = { at: Date.now(), ok: true, ingested, skipped, pending, error }
      return last
    } finally {
      running = false
    }
  }

  function startWatch() {
    if (watcher) return
    try {
      watcher = watch(slipsDir(home()), { persistent: false }, () => {
        void tick()
      })
      watcher.on('error', () => {
        try { watcher && watcher.close() } catch { /* ignore */ }
        watcher = null
      })
    } catch {
      watcher = null
    }
  }

  function start() {
    if (timer) return
    void tick().then(() => startWatch())
    timer = setInterval(() => {
      void tick().then(() => startWatch())
    }, pollMs)
    if (typeof timer.unref === 'function') timer.unref()
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    if (watcher) {
      try { watcher.close() } catch { /* ignore */ }
      watcher = null
    }
  }

  return { start, stop, tick, snapshot: () => last }
}
