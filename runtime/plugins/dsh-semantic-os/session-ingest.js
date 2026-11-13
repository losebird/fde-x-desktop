/**
 * Scan DSH session transcripts on a Host timer (not the Semantic tab).
 * New and existing sessions. Incremental by seq. Default 30 minutes.
 * @module dsh-semantic-os/session-ingest
 */

import { existsSync, statSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, extname, join } from 'node:path'
import { postPython } from './ingest.js'
import { describePath, extractEyesText, pathsFromText } from './eyes-media.js'

export const DEFAULT_SESSION_INGEST_INTERVAL_MIN = 30
export const SESSION_STAMP_BUDGET = 4
export const SESSION_GRAPH_BUDGET_FORCE = 16
export const FILE_INGEST_BUDGET = 2
export const TICK_DEADLINE_MS = 45_000
export const SESSION_STEP_MS = 8_000
export const SIDECAR_STEP_MS = 8_000

function withTimeout(promise, ms, code) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(code || 'TIMEOUT')), ms)
  })
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

function dshHome() {
  return process.env.DSH_HOME || process.env.FDE_DSH_HOME || join(homedir(), '.dsh-fde-x')
}

function cursorPath() {
  return join(dshHome(), 'semantic-os', 'session-cursors.json')
}

async function pingLowRiskAutoFile(cwd) {
  const path = String(cwd || '').trim()
  if (!path) return
  const port = String(process.env.FDE_RUNTIME_PORT || '4318')
  const home = process.env.FDE_DSH_HOME || process.env.DSH_HOME || ''
  let token = ''
  if (home) {
    try { token = String(await readFile(join(home, '.ui-token'), 'utf8')).trim() } catch { token = '' }
  }
  const get = globalThis.fetch
  if (typeof get !== 'function') return
  try {
    await get(`http://127.0.0.1:${port}/api/v1/memory/auto-file`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Origin: `http://127.0.0.1:${port}`,
        ...(token ? { 'x-fde-ui-token': token } : {}),
      },
      body: JSON.stringify({ cwd: path, workspaceCwd: path }),
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    /* BFF optional */
  }
}

function stampPath() {
  return join(dshHome(), 'semantic-os', 'session-stamps.json')
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
  return dshHome()
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])

async function picturedOf({ sidecar, cwd, path, mediaType, getEyes }) {
  const extracted = await extractEyesText(path)
  if (extracted) return extracted
  const ext = extname(String(path || '')).toLowerCase()
  const looksImage = IMAGE_EXTS.has(ext) || String(mediaType || '').startsWith('image/')
  if (looksImage && sidecar) {
    const got = await postPython(sidecar, {
      op: 'describe_image',
      cwd,
      args: { path, mediaType: mediaType || '' },
    }, { timeoutMs: SIDECAR_STEP_MS }).catch(() => null)
    const text = String(got && got.text || '').trim()
    if (text) return text
  }
  const eyes = typeof getEyes === 'function' ? getEyes() : null
  if (eyes) return describePath(eyes, path)
  return ''
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

const SKIP_INGEST = /Current runtime context|Current DSH file policy|system-reminder|available_skills|<goal_round>|<skill_content>|Compactions remaining/

function looksLikeJsonDump(text) {
  const raw = String(text || '').trim()
  if (!raw.startsWith('{') && !raw.startsWith('[')) return false
  try {
    JSON.parse(raw)
    return true
  } catch {
    return false
  }
}

function assistantVisibleText(content) {
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

export function eventText(event) {
  if (!event || !event.data) return ''
  let text = ''
  if (event.type === 'user/message') {
    const src = event.data.source || {}
    if (src.kind && src.kind !== 'user') return ''
    text = textFromContent(event.data.content).trim()
  } else if (event.type === 'assistant/message') {
    const message = event.data.message || event.data
    text = assistantVisibleText(message.content)
  } else {
    return ''
  }
  if (!text) return ''
  if (SKIP_INGEST.test(text)) return ''
  if (text.startsWith('/')) return ''
  if (looksLikeJsonDump(text)) return ''
  return text
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
        const meta = header.meta && typeof header.meta === 'object' ? header.meta : {}
        const values = row && row.projections && row.projections.values && typeof row.projections.values === 'object'
          ? row.projections.values
          : (header.projections && header.projections.values && typeof header.projections.values === 'object'
            ? header.projections.values
            : {})
        const titleNode = header.title || meta.title || values.title
        const title = typeof titleNode === 'object' && titleNode && titleNode.val != null
          ? String(titleNode.val || '').trim()
          : String(titleNode || '').trim()
        const out = {
          id: String(header.id || ''),
          cwd: String(header.cwd || meta.cwd || ''),
        }
        if (title) out.title = title
        const preset = String(header.agentPreset || meta.agentPreset || '').trim()
        if (preset) out.agentPreset = preset
        if (header.lastPromptAt != null) out.lastPromptAt = header.lastPromptAt
        if (header.createdAt != null) out.createdAt = header.createdAt
        if (header.updatedAt != null) out.updatedAt = header.updatedAt
        else if (header.createdAt != null) out.updatedAt = header.createdAt
        if (out.lastPromptAt == null && out.updatedAt != null) out.lastPromptAt = out.updatedAt
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
  const { sidecar, getPersistence, getEyes, getExtract, extractQueue, getConfig, onGraphWrite, startFileIngest } = opts
  const stepMs = Number(opts.sessionStepMs) > 0 ? Number(opts.sessionStepMs) : SESSION_STEP_MS
  const deadlineMs = Number(opts.tickDeadlineMs) > 0 ? Number(opts.tickDeadlineMs) : TICK_DEADLINE_MS
  const sidecarMs = Number(opts.sidecarStepMs) > 0 ? Number(opts.sidecarStepMs) : SIDECAR_STEP_MS
  /** @type {ReturnType<typeof setInterval> | null} */
  let timer = null
  /** @type {ReturnType<typeof setTimeout> | null} */
  let first = null
  /** @type {ReturnType<typeof setTimeout> | null} */
  let retryTimer = null
  let notReadyRetries = 0
  let running = false
  let startedAt = 0
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
      return { cursor: Number(raw.cursor), at: Number(raw.at) || 0, graph: Boolean(raw.graph) }
    }
    return null
  }

  function documentRows(id, events) {
    const texts = []
    for (const event of events || []) {
      const seq = event && Number.isFinite(event.seq) ? event.seq : -1
      const text = eventText(event).trim()
      if (seq < 0 || !text) continue
      const stamped = eventTime(event)
      texts.push({
        path: `session:${id}:${seq}`,
        text: text.slice(0, 20_000),
        role: event.type === 'user/message' ? 'user' : 'assistant',
        ingest_source: 'session_ingest',
        messageId: (event.data && (event.data.id || (event.data.message && event.data.message.id))) || '',
        ...(stamped ? { timestamp: stamped } : {}),
      })
    }
    return texts.concat(workRows(texts))
  }

  function workRows(texts) {
    const out = []
    const seen = new Set()
    for (const row of texts) {
      const text = String(row.text || '')
      if (!text.includes('只处理这一条待办')) continue
      const matched = /任务\s+(\S+)：([^\n]+)/.exec(text)
      if (!matched) continue
      const taskId = String(matched[1] || '').trim()
      if (!taskId || seen.has(taskId)) continue
      seen.add(taskId)
      const source = /来源：([^\n]+)/.exec(text)
      const body = [String(matched[2] || '').trim(), source ? String(source[1] || '').trim() : '', '进行中']
        .filter(Boolean)
        .join('\n')
        .slice(0, 160)
      out.push({
        path: `work:${taskId}`,
        text: body,
        role: 'work',
        ...(row.timestamp ? { timestamp: row.timestamp } : {}),
      })
    }
    return out
  }

  async function upsertSessionDocuments(cwd, texts) {
    if (!texts.length) return { ok: true, count: 0 }
    const chunk = 80
    let count = 0
    for (let i = 0; i < texts.length; i += chunk) {
      const body = await postPython(sidecar, {
        op: 'upsert_documents',
        cwd,
        args: { texts: texts.slice(i, i + chunk) },
      }, { timeoutMs: sidecarMs }).catch(() => null)
      if (!body || body.error) return { ok: false, count, error: (body && body.error) || 'UPSERT_FAILED' }
      count += Number(body.count) || 0
    }
    return { ok: true, count }
  }

  async function stampExisting(persistence, cwd, id) {
    let packed
    try {
      packed = await persistence.readFrom(id, 0)
    } catch {
      return { ok: false, attempted: 0, stamped: 0 }
    }
    const events = (packed && packed.events) || []
    const texts = documentRows(id, events)
    const put = await upsertSessionDocuments(cwd, texts)
    if (!put.ok) return { ok: false, attempted: texts.length, stamped: 0 }
    const stamps = texts
      .filter((row) => row.timestamp)
      .map((row) => ({ id: row.path, timestamp: row.timestamp }))
    if (!stamps.length) return { ok: true, attempted: texts.length, stamped: 0, graph: true }
    const chunk = 4000
    let n = 0
    for (let i = 0; i < stamps.length; i += chunk) {
      const body = await postPython(sidecar, {
        op: 'stamp_session_times',
        cwd,
        args: { stamps: stamps.slice(i, i + chunk) },
      }, { timeoutMs: sidecarMs }).catch(() => null)
      if (!body || body.error) return { ok: false, attempted: stamps.length, stamped: n, graph: true }
      n += Number(body.stamped) || 0
    }
    return { ok: true, attempted: stamps.length, stamped: n, graph: true }
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
    startedAt = Date.now()
    const deadline = startedAt + deadlineMs
    let sessions = 0
    let ingested = 0
    let skipped = 0
    let error = ''
    const fileCwds = []
    try {
      const headers = await persistence.list()
      const cursors = await loadCursors()
      const stamps = await loadStamps()
      let stampsDirty = false
      const list = Array.isArray(headers) ? headers : []
      sessions = list.length
      let stampLeft = opts.force ? SESSION_GRAPH_BUDGET_FORCE : SESSION_STAMP_BUDGET
      for (const header of list) {
        if (Date.now() > deadline) {
          if (!error) error = 'TICK_TIMEOUT'
          break
        }
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
        if (!fileCwds.includes(cwd)) fileCwds.push(cwd)
        try {
        const fromSeq = Number.isFinite(Number(cursors[id])) ? Number(cursors[id]) + 1 : 0
        const rec = stampRecord(stamps[id])
        let stampResult = null
        if (opts.force || (((!rec || !rec.graph) && fromSeq > 0 && stampLeft > 0))) {
          stampResult = await withTimeout(stampExisting(persistence, cwd, id), stepMs, 'SESSION_TIMEOUT')
          stampLeft -= 1
        }
        let packed
        try {
          packed = await withTimeout(persistence.readFrom(id, fromSeq), stepMs, 'SESSION_TIMEOUT')
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
              ingest_source: 'session_ingest',
              messageId: (event.data && (event.data.id || (event.data.message && event.data.message.id))) || '',
              timestamp: eventTime(event),
            }
            texts.push(row)
            if (seq >= fromSeq) fresh.push(row)
          }
          if (seq < fromSeq || imagesThisSession >= 16) continue
          if (!mayLook(event)) continue
          const media = []
          for (const part of eventImages(event)) {
            const file = imageFileFromPart(part)
            if (file) media.push({ path: file.path, kind: 'image', id: file.id, mediaType: file.mediaType })
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
            }, { timeoutMs: sidecarMs }).catch(() => null)
          }
          for (const file of media) {
            if (imagesThisSession >= 16) break
            if (file.kind === 'file') {
              filePaths.push(file.path)
              continue
            }
            const pictured = await picturedOf({
              sidecar,
              cwd,
              path: file.path,
              mediaType: file.mediaType || '',
              getEyes,
            })
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
            const pictured = await picturedOf({
              sidecar,
              cwd,
              path: filePath,
              mediaType: '',
              getEyes,
            })
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
        if (texts.length) {
          if (maxSeq >= 0) cursors[id] = maxSeq
        } else if (maxSeq >= fromSeq) {
          cursors[id] = maxSeq
        }
        if (stampResult && stampResult.ok) {
          stamps[id] = { cursor: Number(cursors[id]) || 0, at: Date.now(), graph: true }
          stampsDirty = true
        }
        if (!texts.length) {
          skipped += 1
          continue
        }
        if (fresh.length) {
          const docs = documentRows(id, events.filter((event) => {
            const seq = event && Number.isFinite(event.seq) ? event.seq : -1
            return seq >= fromSeq
          }))
          await upsertSessionDocuments(cwd, docs)
          const rows = fresh
            .filter((row) => String(row.path || '').startsWith('session:') || String(row.path || '').startsWith('file:') || String(row.path || '').startsWith('mail:'))
            .map((row) => ({ id: row.path, text: row.text, time: row.timestamp }))
          if (rows.length) {
            await postPython(sidecar, { op: 'index_passages', cwd, args: { rows } }, { timeoutMs: sidecarMs }).catch(() => null)
          }
          stamps[id] = { cursor: Number(cursors[id]) || 0, at: Date.now(), graph: true }
          stampsDirty = true
        }
        ingested += 1
        if (typeof onGraphWrite === 'function') onGraphWrite(cwd, fresh.length ? 'session_index' : 'session_backfill')
        } catch (err) {
          skipped += 1
          error = err instanceof Error ? err.message : String(err)
          continue
        }
      }
      await saveCursors(cursors)
      if (stampsDirty) await saveStamps(stamps)
      const fileBudget = opts.force ? FILE_INGEST_BUDGET : 1
      if (typeof startFileIngest === 'function') {
        for (const fileCwd of fileCwds.slice(0, fileBudget)) startFileIngest(fileCwd)
      }
      for (const fileCwd of fileCwds) void pingLowRiskAutoFile(fileCwd)
      last = { at: Date.now(), ok: !error, sessions, ingested, skipped, error }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      last = { at: Date.now(), ok: false, sessions, ingested, skipped, error }
    } finally {
      running = false
      startedAt = 0
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
    if (running) {
      if (startedAt && Date.now() - startedAt > deadlineMs + stepMs) {
        running = false
        last = { ...last, at: Date.now(), error: last.error || 'STALE_TICK' }
      } else {
        return { ok: true, started: false, ...snapshot() }
      }
    }
    void tick({ force: true })
    return { ok: true, started: true, ...snapshot() }
  }

  return { tick, kick, start, stop, reschedule, snapshot }
}
