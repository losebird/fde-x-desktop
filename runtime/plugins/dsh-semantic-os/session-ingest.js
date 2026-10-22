/**
 * Scan DSH session transcripts on a Host timer (not the Semantic tab).
 * New and existing sessions. Incremental by seq. Default 30 minutes.
 * @module dsh-semantic-os/session-ingest
 */

import { existsSync, statSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { postPython } from './ingest.js'
import { describePath, pathsFromText } from './eyes-media.js'

export const DEFAULT_SESSION_INGEST_INTERVAL_MIN = 30

function cursorPath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'semantic-os', 'session-cursors.json')
}

function stampPath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'semantic-os', 'session-stamps.json')
}

function textFromContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map((part) => {
    if (!part) return ''
    if (typeof part === 'string') return part
    if (part.type === 'text' && typeof part.text === 'string') return part.text
    return ''
  }).join('')
}

function imagePartsFromContent(content) {
  if (!Array.isArray(content)) return []
  return content.filter((part) => part && part.type === 'image')
}

function attachmentHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

function imageFileFromPart(part) {
  const att = (part && part.attachment) || part || {}
  const id = String(att.attachmentId || '')
  const match = /^sha256:([a-f0-9]{64})$/.exec(id)
  if (match) {
    const sha = match[1]
    return {
      path: join(attachmentHome(), 'attachments', 'v1', 'objects', sha.slice(0, 2), sha),
      mediaType: String(att.mediaType || 'image/png'),
      id,
    }
  }
  return null
}

function eventImages(event) {
  if (!event || !event.data) return []
  if (event.type === 'user/message') {
    const src = event.data.source || {}
    if (src.kind && src.kind !== 'user') return []
    return imagePartsFromContent(event.data.content)
  }
  if (event.type === 'assistant/message') {
    const message = event.data.message || event.data
    return imagePartsFromContent(message.content)
  }
  return []
}

const SEE_TOOLS = new Set(['see_file', 'see_image', 'ocr_image', 'see'])

export function toolNameOf(event) {
  if (!event || typeof event !== 'object') return ''
  const data = event.data && typeof event.data === 'object' ? event.data : {}
  return String(data.name || data.tool || data.toolName || (data.toolCall && data.toolCall.name) || '').trim()
}

export function mayLook(event) {
  if (!event || typeof event !== 'object') return false
  const data = event.data && typeof event.data === 'object' ? event.data : {}
  const meta = data.metadata && typeof data.metadata === 'object' ? data.metadata : {}
  if (data.nodded === true || data.see === true || meta.nodded === true || meta.see === true) return true
  const name = toolNameOf(event)
  if (SEE_TOOLS.has(name)) return true
  const type = String(event.type || '')
  return type.includes('tool') && SEE_TOOLS.has(name)
}

export function eventTime(event) {
  if (!event || typeof event !== 'object') return ''
  const data = event.data && typeof event.data === 'object' ? event.data : {}
  const raw = event.time ?? event.ts ?? event.timestamp ?? event.createdAt
    ?? data.time ?? data.ts ?? data.timestamp ?? data.createdAt
  if (raw == null || raw === '') return ''
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const ms = raw < 1e12 ? raw * 1000 : raw
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? '' : date.toISOString()
  }
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export function eventText(event) {
  if (!event || !event.data) return ''
  if (event.type === 'user/message') {
    const src = event.data.source || {}
    if (src.kind && src.kind !== 'user') return ''
    const text = textFromContent(event.data.content)
    if (/^Current (runtime context|DSH file policy)/.test(text)) return ''
    return text
  }
  if (event.type === 'assistant/message') {
    const message = event.data.message || event.data
    return textFromContent(message.content)
  }
  return ''
}

export function headerOf(value) {
  if (!value || typeof value !== 'object') return value
  const nested = value.header
  if (nested && typeof nested === 'object') return nested
  return value
}

export function headerCwd(header) {
  const row = headerOf(header)
  if (!row) return ''
  return String(row.cwd || (row.meta && row.meta.cwd) || '')
}

export function headerId(header) {
  const row = headerOf(header)
  if (!row) return ''
  return String(row.id || (row.meta && row.meta.id) || '')
}

/**
 * DSH 0.1.5 sessionPersistence lists snapshots `{ header, revision }`
 * and reads via `open(id, 'read').read(offset)`. Older fixtures still
 * expose `readFrom(id, fromSeq)`.
 */
export function adaptSessionPersistence(raw) {
  if (!raw || typeof raw !== 'object') return null
  const list = typeof raw.list === 'function' ? raw.list.bind(raw) : null
  const readFrom = typeof raw.readFrom === 'function' ? raw.readFrom.bind(raw) : null
  const open = typeof raw.open === 'function' ? raw.open.bind(raw) : null
  if (!list || (!readFrom && !open)) return raw
  return {
    async list(...args) {
      const rows = await list(...args)
      return (Array.isArray(rows) ? rows : []).map((row) => {
        const header = headerOf(row) || {}
        const out = {
          id: String(header.id || ''),
          cwd: String(header.cwd || (header.meta && header.meta.cwd) || ''),
        }
        if (header.createdAt != null) out.createdAt = header.createdAt
        if (header.updatedAt != null) out.updatedAt = header.updatedAt
        else if (header.createdAt != null) out.updatedAt = header.createdAt
        return out
      })
    },
    async readFrom(id, fromSeq = 0) {
      if (readFrom) return readFrom(id, fromSeq)
      const handle = await open(id, 'read')
      try {
        if (!handle || typeof handle.read !== 'function') return { events: [] }
        return await handle.read(fromSeq)
      } finally {
        if (handle && typeof handle.close === 'function') {
          await Promise.resolve(handle.close()).catch(() => undefined)
        }
      }
    },
  }
}

/**
 * @param {{
 *   sidecar: { snapshot: Function },
 *   getPersistence: () => object | null,
 *   getEyes: () => { describe: Function } | null,
 *   getExtract: () => { extract: Function } | null,
 *   extractQueue: { enqueue: Function },
 *   getConfig: () => Record<string, unknown>,
 *   onGraphWrite?: Function,
 * }} opts
 */
export function createSessionIngest(opts) {
  const { sidecar, getPersistence, getEyes, getExtract, extractQueue, getConfig, onGraphWrite } = opts
  /** @type {ReturnType<typeof setInterval> | null} */
  let timer = null
  /** @type {ReturnType<typeof setTimeout> | null} */
  let first = null
  /** @type {ReturnType<typeof setTimeout> | null} */
  let retryTimer = null
  let notReadyRetries = 0
  let running = false
  let last = {
    at: 0,
    ok: false,
    sessions: 0,
    ingested: 0,
    skipped: 0,
    error: '',
  }

  function intervalMs() {
    const cfg = getConfig() || {}
    const min = Number(cfg.sessionIngestIntervalMin)
    const safe = Number.isFinite(min) && min >= 1 ? Math.floor(min) : DEFAULT_SESSION_INGEST_INTERVAL_MIN
    return Math.max(60_000, safe * 60_000)
  }

  async function loadCursors() {
    try {
      return JSON.parse(await readFile(cursorPath(), 'utf8'))
    } catch {
      return {}
    }
  }

  async function saveJson(path, map) {
    const temp = `${path}.${process.pid}.${Date.now()}.tmp`
    await mkdir(dirname(path), { recursive: true })
    try {
      await writeFile(temp, `${JSON.stringify(map, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
      await rename(temp, path)
    } finally {
      await rm(temp, { force: true }).catch(() => undefined)
    }
  }

  async function saveCursors(map) {
    await saveJson(cursorPath(), map)
  }

  async function loadStamps() {
    try {
      return JSON.parse(await readFile(stampPath(), 'utf8'))
    } catch {
      return {}
    }
  }

  async function saveStamps(map) {
    await saveJson(stampPath(), map)
  }

  function stampRecord(raw) {
    if (raw && typeof raw === 'object' && Number.isFinite(Number(raw.cursor))) {
      return { cursor: Number(raw.cursor), at: Number(raw.at) || 0 }
    }
    return null
  }

  async function stampExisting(persistence, cwd, id) {
    let packed
    try {
      packed = await persistence.readFrom(id, 0)
    } catch {
      return { ok: false, attempted: 0, stamped: 0 }
    }
    const stamps = []
    for (const event of (packed && packed.events) || []) {
      const seq = event && Number.isFinite(event.seq) ? event.seq : -1
      const stamped = eventTime(event)
      if (seq < 0 || !stamped) continue
      if (!eventText(event).trim()) continue
      stamps.push({ id: `session:${id}:${seq}`, timestamp: stamped })
    }
    if (!stamps.length) return { ok: true, attempted: 0, stamped: 0 }
    const rows = []
    for (const event of (packed && packed.events) || []) {
      const seq = event && Number.isFinite(event.seq) ? event.seq : -1
      const stamped = eventTime(event)
      const text = eventText(event).trim()
      if (seq < 0 || !stamped || !text) continue
      rows.push({ id: `session:${id}:${seq}`, text: text.slice(0, 20_000), time: stamped })
    }
    if (rows.length) {
      await postPython(sidecar, { op: 'index_passages', cwd, args: { rows } }).catch(() => null)
    }
    const chunk = 4000
    let n = 0
    for (let i = 0; i < stamps.length; i += chunk) {
      const body = await postPython(sidecar, {
        op: 'stamp_session_times',
        cwd,
        args: { stamps: stamps.slice(i, i + chunk) },
      }).catch(() => null)
      if (!body || body.error) return { ok: false, attempted: stamps.length, stamped: n }
      n += Number(body.stamped) || 0
    }
    return { ok: true, attempted: stamps.length, stamped: n }
  }

  function scheduleNotReadyRetry() {
    // The first tick fires 8s after start(), which lands while the sidecar is
    // still cold-starting (~120s). Without this, that NOT_READY would leave the
    // ingest idle until the next 30-minute interval. Retry on a short cadence
    // until the sidecar is up, bounded so a permanently-broken sidecar doesn't
    // spin forever.
    if (retryTimer) return
    if (notReadyRetries >= 20) return
    notReadyRetries += 1
    retryTimer = setTimeout(() => {
      retryTimer = null
      void tick()
    }, 10_000)
  }

  async function tick(opts = {}) {
    if (running) return last
    const snap = sidecar.snapshot()
    if (!snap.ready) {
      last = { ...last, at: Date.now(), ok: false, error: 'NOT_READY' }
      scheduleNotReadyRetry()
      return last
    }
    // Sidecar is up: cancel any pending retry and reset the retry budget so the
    // next cold start is handled fresh.
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    notReadyRetries = 0
    const persistence = adaptSessionPersistence(typeof getPersistence === 'function' ? getPersistence() : null)
    if (!persistence || typeof persistence.list !== 'function' || typeof persistence.readFrom !== 'function') {
      last = { ...last, at: Date.now(), ok: false, error: 'NO_PERSISTENCE' }
      return last
    }
    running = true
    let sessions = 0
    let ingested = 0
    let skipped = 0
    let error = ''
    try {
      const headers = await persistence.list()
      const cursors = await loadCursors()
      const stamps = await loadStamps()
      let stampsDirty = false
      const list = Array.isArray(headers) ? headers : []
      sessions = list.length
      for (const header of list) {
        const id = headerId(header)
        const cwd = String(headerCwd(header) || '').replace(/[\r\n\t]/g, '')
        if (!id || !cwd) {
          skipped += 1
          continue
        }
        try {
          if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
            skipped += 1
            continue
          }
        } catch {
          skipped += 1
          continue
        }
        try {
        const fromSeq = Number.isFinite(Number(cursors[id])) ? Number(cursors[id]) + 1 : 0
        const rec = stampRecord(stamps[id])
        let stampResult = null
        if (opts.force || (!rec && fromSeq > 0)) {
          stampResult = await stampExisting(persistence, cwd, id)
        }
        let packed
        try {
          packed = await persistence.readFrom(id, fromSeq)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          skipped += 1
          // A newer/foreign session log must not fail this workspace's ingest.
          if (!/unknown to this harness|not marked ignorable/.test(msg) && !error) {
            error = msg
          }
          continue
        }
        const events = (packed && packed.events) || []
        const texts = []
        const fresh = []
        let maxSeq = fromSeq - 1
        let imagesThisSession = 0
        for (const event of events) {
          const seq = event && Number.isFinite(event.seq) ? event.seq : -1
          if (seq >= 0) maxSeq = Math.max(maxSeq, seq)
          const text = eventText(event).trim()
          if (text) {
            const row = {
              path: `session:${id}:${seq}`,
              text: text.slice(0, 20_000),
              role: event.type === 'user/message' ? 'user' : 'assistant',
              messageId: (event.data && (event.data.id || (event.data.message && event.data.message.id))) || '',
              timestamp: eventTime(event),
            }
            texts.push(row)
            if (seq >= fromSeq) fresh.push(row)
          }
          if (seq < fromSeq || imagesThisSession >= 16) continue
          if (!mayLook(event)) continue
          const eyes = typeof getEyes === 'function' ? getEyes() : null
          const media = []
          for (const part of eventImages(event)) {
            const file = imageFileFromPart(part)
            if (file) media.push({ path: file.path, kind: 'image', id: file.id })
          }
          for (const found of pathsFromText(text)) {
            media.push({ path: found, kind: 'file', id: found })
          }
          const filePaths = []
          const recordLook = async (attachmentId, pictured, page = '1') => {
            imagesThisSession += 1
            await postPython(sidecar, {
              op: 'record_sight',
              cwd,
              args: {
                attachment_id: attachmentId,
                page,
                nodded: true,
                text: pictured || '',
              },
            }).catch(() => null)
          }
          for (const file of media) {
            if (imagesThisSession >= 16) break
            if (file.kind === 'file') {
              filePaths.push(file.path)
              continue
            }
            const pictured = await describePath(eyes, file.path)
            await recordLook(file.id || file.path, pictured)
            if (!pictured) continue
            const row = {
              path: `session:${id}:${seq}:${file.kind}`,
              text: pictured.slice(0, 20_000),
              role: event.type === 'user/message' ? 'user' : 'assistant',
              messageId: (event.data && (event.data.id || (event.data.message && event.data.message.id))) || file.id,
              timestamp: eventTime(event),
            }
            texts.push(row)
            fresh.push(row)
          }
          for (const filePath of filePaths) {
            if (imagesThisSession >= 16) break
            const pictured = await describePath(eyes, filePath)
            await recordLook(filePath, pictured)
            if (!pictured) continue
            const item = {
              path: filePath,
              text: pictured.slice(0, 20_000),
              role: event.type === 'user/message' ? 'user' : 'assistant',
              messageId: (event.data && (event.data.id || (event.data.message && event.data.message.id))) || '',
              timestamp: eventTime(event),
            }
            texts.push(item)
            fresh.push(item)
          }
        }
        if (!texts.length) {
          if (maxSeq >= fromSeq) cursors[id] = maxSeq
          skipped += 1
          continue
        }
        if (fresh.length) {
          const rows = fresh
            .filter((row) => String(row.path || '').startsWith('session:') || String(row.path || '').startsWith('file:') || String(row.path || '').startsWith('mail:'))
            .map((row) => ({ id: row.path, text: row.text, time: row.timestamp }))
          if (rows.length) {
            void postPython(sidecar, { op: 'index_passages', cwd, args: { rows } }).catch(() => undefined)
          }
        }
        ingested += 1
        if (typeof onGraphWrite === 'function') onGraphWrite(cwd, fresh.length ? 'session_index' : 'session_backfill')
        if (maxSeq >= 0) cursors[id] = maxSeq
        if (stampResult && stampResult.ok && stampResult.stamped === stampResult.attempted) {
          stamps[id] = { cursor: Number(cursors[id]) || 0, at: Date.now() }
          stampsDirty = true
        }
        } catch (err) {
          skipped += 1
          error = err instanceof Error ? err.message : String(err)
          continue
        }
      }
      await saveCursors(cursors)
      if (stampsDirty) await saveStamps(stamps)
      last = { at: Date.now(), ok: !error, sessions, ingested, skipped, error }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      last = { at: Date.now(), ok: false, sessions, ingested, skipped, error }
    } finally {
      running = false
    }
    return last
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    if (first) {
      clearTimeout(first)
      first = null
    }
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  function start() {
    stop()
    first = setTimeout(() => {
      first = null
      void tick()
      timer = setInterval(() => { void tick() }, intervalMs())
    }, 8_000)
  }

  function reschedule() {
    start()
  }

  function snapshot() {
    return {
      ...last,
      intervalMin: Math.round(intervalMs() / 60_000),
      running,
      extract: extractQueue && typeof extractQueue.snapshot === 'function' ? extractQueue.snapshot() : null,
    }
  }

  function kick() {
    if (running) return { ok: true, started: false, ...snapshot() }
    void tick({ force: true })
    return { ok: true, started: true, ...snapshot() }
  }

  return { tick, kick, start, stop, reschedule, snapshot }
}
