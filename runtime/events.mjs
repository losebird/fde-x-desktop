/** Monotonic event ids (time + sequence) so same-ms rows sort in emit order. */
let eventOrdinal = 0n

function createEventId(ts) {
  eventOrdinal += 1n
  const timePart = BigInt(ts).toString(36).padStart(9, '0')
  const seqPart = eventOrdinal.toString(36).padStart(9, '0')
  return `evt_${timePart}_${seqPart}`
}

/** @typedef {{ id: string, ts: number, type: string, workspaceCwd: string | null, sessionId?: string, source: string, payload: unknown }} FdeEnvelope */

const subscribers = new Set()
/** @type {import('node:sqlite').DatabaseSync | null} */
let dbRef = null
let cleanupDone = false

const MAX_RETAINED = 10_000
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function configureEventBus(db) {
  dbRef = db
  if (!cleanupDone) {
    cleanupOutbox(db)
    cleanupDone = true
  }
}

function cleanupOutbox(db) {
  const cutoff = Date.now() - RETENTION_MS
  try {
    db.prepare('DELETE FROM outbox_events WHERE ts IS NOT NULL AND ts < ?').run(cutoff)
    const count = db.prepare('SELECT COUNT(*) AS n FROM outbox_events').get()
    const n = Number(count?.n ?? 0)
    if (n > MAX_RETAINED) {
      const excess = n - MAX_RETAINED
      db.prepare(`
        DELETE FROM outbox_events
        WHERE id IN (
          SELECT id FROM outbox_events
          ORDER BY COALESCE(ts, CAST(strftime('%s', occurred_at) AS INTEGER) * 1000) ASC, id ASC
          LIMIT ?
        )
      `).run(excess)
    }
  } catch (error) {
    console.warn('event_bus_cleanup_failed', error)
  }
}

/**
 * @param {Record<string, unknown>} row
 * @returns {FdeEnvelope}
 */
export function envelopeFromRow(row) {
  const ts = row.ts != null
    ? Number(row.ts)
    : Date.parse(String(row.occurred_at ?? '')) || 0
  let payload = {}
  try {
    payload = JSON.parse(String(row.payload_json ?? '{}'))
  } catch {
    payload = {}
  }
  return {
    id: String(row.id),
    ts,
    type: String(row.event_type),
    workspaceCwd: row.workspace_cwd != null ? String(row.workspace_cwd) : null,
    sessionId: row.session_id != null ? String(row.session_id) : undefined,
    source: String(row.source ?? 'bff'),
    payload,
  }
}

/**
 * @param {string} type
 * @param {unknown} payload
 * @param {{ workspaceCwd?: string | null, sessionId?: string, source?: string }} [meta]
 */
export function emit(type, payload, { workspaceCwd = null, sessionId, source = 'bff' } = {}) {
  const ts = Date.now()
  const id = createEventId(ts)
  const occurredAt = new Date(ts).toISOString()
  const envelope = {
    id,
    ts,
    type,
    workspaceCwd: workspaceCwd ?? null,
    sessionId,
    source,
    payload: payload ?? {},
  }

  if (dbRef) {
    try {
      dbRef.prepare(`
        INSERT INTO outbox_events
          (id, event_type, schema_version, source_ref, subject_ref, correlation_id, causation_id,
           payload_json, occurred_at, available_at, ts, workspace_cwd, session_id, source, delivered)
        VALUES (?, ?, 1, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        id,
        type,
        workspaceCwd ? `fde://workspace${workspaceCwd}` : 'fde://global',
        sessionId ?? null,
        id,
        JSON.stringify(envelope.payload),
        occurredAt,
        occurredAt,
        ts,
        workspaceCwd,
        sessionId ?? null,
        source,
      )
    } catch (error) {
      console.warn('event_bus_persist_failed', error)
    }
  } else {
    console.warn('event_bus_not_configured')
  }

  for (const fn of subscribers) {
    try {
      fn(envelope)
    } catch (error) {
      console.warn('event_bus_subscriber_failed', error)
    }
  }
  return id
}

/**
 * @param {(envelope: FdeEnvelope) => void} fn
 */
export function subscribe(fn) {
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ sinceId?: string, workspaceCwd?: string, limit?: number }} options
 */
export function listEventsAfter(db, { sinceId, workspaceCwd, limit = 500 } = {}) {
  const cap = Math.max(1, Math.min(500, limit))
  let sinceTs = 0
  let sinceRowId = ''
  if (sinceId) {
    const anchor = db.prepare(`
      SELECT id, ts, occurred_at FROM outbox_events WHERE id = ?
    `).get(sinceId)
    if (anchor) {
      sinceTs = anchor.ts != null
        ? Number(anchor.ts)
        : Date.parse(String(anchor.occurred_at ?? '')) || 0
      sinceRowId = String(anchor.id)
    }
  }

  const rows = db.prepare(`
    SELECT id, event_type, payload_json, occurred_at, ts, workspace_cwd, session_id, source
    FROM outbox_events
    WHERE (
      COALESCE(ts, CAST(strftime('%s', occurred_at) AS INTEGER) * 1000) > ?
      OR (
        COALESCE(ts, CAST(strftime('%s', occurred_at) AS INTEGER) * 1000) = ?
        AND id > ?
      )
    )
    ORDER BY COALESCE(ts, CAST(strftime('%s', occurred_at) AS INTEGER) * 1000) ASC, id ASC
    LIMIT ?
  `).all(sinceTs, sinceTs, sinceRowId, cap)

  const envelopes = rows.map((row) => envelopeFromRow(row))
  if (!workspaceCwd) return envelopes
  return envelopes.filter((item) => item.workspaceCwd == null || item.workspaceCwd === workspaceCwd)
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ workspaceCwd?: string, type?: string, limit?: number }} options
 */
export function listRecentEvents(db, { workspaceCwd, type, limit = 50 } = {}) {
  const cap = Math.max(1, Math.min(200, limit))
  const params = []
  const clauses = ['1 = 1']
  if (type) {
    clauses.push('event_type = ?')
    params.push(type)
  }
  if (workspaceCwd) {
    clauses.push('(workspace_cwd IS NULL OR workspace_cwd = ?)')
    params.push(workspaceCwd)
  }
  const rows = db.prepare(`
    SELECT id, event_type, payload_json, occurred_at, ts, workspace_cwd, session_id, source
    FROM outbox_events
    WHERE ${clauses.join(' AND ')}
    ORDER BY COALESCE(ts, CAST(strftime('%s', occurred_at) AS INTEGER) * 1000) DESC, id DESC
    LIMIT ?
  `).all(...params, cap)
  return rows.map((row) => envelopeFromRow(row)).reverse()
}

/**
 * @param {FdeEnvelope} envelope
 * @param {string | undefined} workspaceCwd
 */
export function matchesWorkspaceFilter(envelope, workspaceCwd) {
  if (!workspaceCwd) return true
  return envelope.workspaceCwd == null || envelope.workspaceCwd === workspaceCwd
}
