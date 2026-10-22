/**
 * Extract worker pump. Session text is searched from DSH logs; ingest no longer copies diaries into the graph.
 * Entity/relation jobs come from search hits, a nod, or idle-warm of the latest session.
 * The worker does not use the chat ctx.llm stream.
 * @module dsh-semantic-os/extract-queue
 */

import { readFileSync } from 'node:fs'
import { attachExtract } from './extract-llm.js'
import { CAUSES, createJobStore, windowOf } from './extract-jobs.js'
import { cleanExtract } from './extract-clean.js'

// Cheap local gate before paying an LLM call: only text that already looks like
// a concluded decision ("定了/就按/拍板/采用/保留/不删/结论是…") is sent to the
// model for precise extraction. Ordinary discussion and questions never reach it.
const DECISION_HINTS = /(定了|拍板|结论是|敲定|选定|就按)/
const ENVELOPE_QUOTE = /【信封】|信封正文|金额未传|这封像请.+过/

const CARD_SPLIT = /(?<=[。！？\n])|(?<=[.!?]\s)/

function fingerprint(text) {
  let hash = 0
  const blob = String(text || '')
  for (let i = 0; i < blob.length; i += 1) hash = (hash * 31 + blob.charCodeAt(i)) >>> 0
  return hash.toString(16).padStart(8, '0')
}

export function draftMemoryCards(text, source) {
  const path = String(source || '').trim()
  if (!path.startsWith('session:') && !path.startsWith('file:')) return []
  const blob = String(text || '').trim()
  if (!blob) return []
  const parts = blob.split(/\n+/).flatMap((row) => row.split(CARD_SPLIT)).map((row) => row.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const cards = []
  const seen = new Set()
  for (const part of parts) {
    if (part.length < 8 || part.length > 240) continue
    if (isReportNoise(part)) continue
    if (!DECISION_HINTS.test(part)) continue
    const id = `memory:${fingerprint(`${path}\n${part}`)}`
    if (seen.has(id)) continue
    seen.add(id)
    cards.push({
      id,
      type: '记忆卡片',
      status: '起草',
      source: path,
      label: part.slice(0, 160),
    })
    if (cards.length >= 3) break
  }
  return cards
}

export function isEnvelopeQuote(text) {
  return ENVELOPE_QUOTE.test(String(text || ''))
}

export function isReportNoise(text) {
  const blob = String(text || '').trim()
  if (!blob) return false
  const stripped = blob.replace(/^[\s*_>\-]+/, '')
  if (/^#{1,6}(\s|$)/.test(blob) || /^#{1,6}(\s|$)/.test(stripped) || blob.startsWith('---') || stripped.startsWith('---')) return true
  const pipes = (blob.match(/\|/g) || []).length
  if (pipes >= 3) return true
  return (blob.match(/`/g) || []).length >= 4
}

export async function writeDraftMemoryCards({ cwd, texts, postPython }) {
  const written = []
  for (const row of Array.isArray(texts) ? texts : []) {
    if (String(row && row.role || '').toLowerCase() === 'assistant') continue
    const path = String(row && row.path || '').trim()
    const cards = draftMemoryCards(row && row.text, path)
    for (const card of cards) {
      const added = await postPython({
        op: 'add_entity',
        cwd,
        args: {
          id: card.id,
          label: card.label,
          type: card.type,
          metadata: {
            status: '起草',
            source: card.source,
            auto: true,
            kind: '记忆卡片',
            timestamp: row && row.timestamp,
            valid_from: row && row.timestamp,
          },
        },
      }).catch(() => null)
      if (added && added.error) continue
      await postPython({
        op: 'add_relationship',
        cwd,
        args: { source: card.source, target: card.id, type: '出自' },
      }).catch(() => null)
      written.push(card.id)
    }
  }
  return { ok: true, cards: written, truncated: false }
}

const IDLE_MS = 20_000

export function createExtractQueue({
  getExtract,
  postPython,
  onGraphWrite,
  jobs,
  isChatBusy,
  maxRetries = 2,
  idleMs = IDLE_MS,
  notReadyDelayMs = 10_000,
  notReadyMax = 20,
}) {
  const store = jobs && typeof jobs.enqueue === 'function' ? jobs : createJobStore()
  let timer = null
  let stopped = false
  let processing = false
  let idleAt = Date.now()
  const state = { queued: 0, processed: 0, failed: 0, parseFailed: 0 }

  function snapshot() {
    let live = { queued: 0, running: 0, done: 0, failed: 0 }
    try {
      const packed = JSON.parse(readFileSync(store.path, 'utf8'))
      const rows = packed && Array.isArray(packed.jobs) ? packed.jobs : []
      live = {
        queued: rows.filter((row) => row.status === 'queued').length,
        running: rows.filter((row) => row.status === 'running').length,
        done: rows.filter((row) => row.status === 'done').length,
        failed: rows.filter((row) => row.status === 'failed').length,
      }
    } catch { /* empty queue file */ }
    return {
      queued: live.queued,
      running: live.running,
      processed: live.done,
      failed: live.failed,
      parseFailed: state.parseFailed,
      processing,
      store: store.path,
    }
  }

  function markIdle() {
    idleAt = Date.now()
  }

  function markBusy() {
    idleAt = 0
  }

  function chatBusy() {
    if (typeof isChatBusy === 'function') return Boolean(isChatBusy())
    return idleAt === 0
  }

  function kick(ms) {
    if (stopped) return
    const delay = ms == null ? 400 : Math.max(0, Number(ms) || 0)
    if (timer && ms == null) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void pump()
    }, delay)
  }

  function enqueue(cwd, texts, cause = CAUSES.hit, query = '') {
    const rows = (Array.isArray(texts) ? texts : []).filter((row) => {
      if (!row || isEnvelopeQuote(row.text) || isReportNoise(row.text)) return false
      if (String(row.role || '').toLowerCase() === 'assistant') return false
      return true
    })
    if (!rows.length) return Promise.resolve({ ok: true, count: 0 })
    const tasks = rows.map((row) => {
      const source = String(row.path || row.source || row.id || '').trim()
      const window = windowOf(row.text, query)
      if (!source || !window) return null
      state.queued += 1
      return store.enqueue({ cwd, source, window, query, cause, timestamp: row.timestamp })
    }).filter(Boolean)
    kick()
    return Promise.all(tasks).then((done) => ({ ok: true, count: done.length }))
  }

  function enqueueHits(cwd, hits, query) {
    const q = String(query || '')
    const rows = (Array.isArray(hits) ? hits : []).map((hit) => {
      const node = hit && hit.node
      const id = String((node && node.id) || (hit && hit.id) || '')
      const text = String((node && (node.content || (node.properties && node.properties.content))) || '')
      return { path: id, text }
    }).filter((row) => row.path.startsWith('session:') || row.path.startsWith('file:'))
    return enqueue(cwd, rows, CAUSES.hit, q)
  }

  async function pump() {
    if (stopped || processing) return
    processing = true
    try {
      if (store && typeof store.reclaimRunning === 'function') {
        await store.reclaimRunning().catch(() => undefined)
      }
      if (store && typeof store.requeueFailed === 'function') {
        await store.requeueFailed('NOT_READY').catch(() => undefined)
      }
      while (!stopped) {
        if (chatBusy()) {
          await new Promise((resolve) => setTimeout(resolve, 800))
          continue
        }
        const job = await store.claim()
        if (!job) break
        const outcome = await processWindow(job)
        if (outcome && outcome.wait) break
      }
    } finally {
      processing = false
    }
  }

  async function extractFromSession({ cwd, id, nodded, auto, text, timestamp }) {
    const path = String(id || '').trim()
    if (!path.startsWith('session:') && !path.startsWith('file:')) {
      return { error: 'NOT_A_SESSION', truncated: false }
    }
    if (nodded !== true && auto !== true) return { error: 'NO_NOD', truncated: false }
    const blob = String(text || '')
    const result = await writeDraftMemoryCards({
      cwd,
      texts: [{ path, text: blob, timestamp }],
      postPython,
    })
    if (typeof onGraphWrite === 'function' && result.cards && result.cards.length) {
      onGraphWrite(cwd, auto ? 'extract_long_session' : 'extract_session')
    }
    return { ...result, truncated: false, body_length: blob.length, auto: Boolean(auto) }
  }

  async function processWindow(job) {
    const cwd = job.cwd
    const texts = [{ path: job.source, text: job.window, timestamp: job.timestamp }]
    let closed = false
    try {
      const extract = typeof getExtract === 'function' ? getExtract() : null
      if (/[\u4e00-\u9fff]/.test(job.window) && (!extract || typeof extract.extract !== 'function')) {
        throw new Error('EXTRACT_LLM_UNAVAILABLE')
      }
      let types = []
      try {
        const typed = await postPython({ op: 'vocab_types', cwd, args: {} })
        types = typed && Array.isArray(typed.types) ? typed.types : []
      } catch { /* extract without a vocab still works */ }
      const extracted = await attachExtract(extract, texts, 1, types)
      const row = (extracted && extracted[0]) || texts[0]
      const cleaned = cleanExtract(job.window, row, types)
      const result = await postPython({
        op: 'apply_extracted_window',
        cwd,
        args: {
          source: job.source,
          text: job.window,
          entities: cleaned.entities,
          relations: cleaned.relations,
          types,
        },
      })
      if (result && result.error) throw new Error(result.error)
      state.processed += 1
      if (typeof onGraphWrite === 'function') onGraphWrite(cwd, 'async_extract')
      await store.finish(job.id, 'done')
      closed = true
    } catch (error) {
      const msg = String((error && error.message) || '')
      if (msg === 'NOT_READY' && !stopped) {
        const n = Number(job.notReadyAttempts || 0) + 1
        if (n <= Number(notReadyMax || 20)) {
          await store.requeue(job.id, { notReadyAttempts: n })
          closed = true
          kick(notReadyDelayMs == null ? 10_000 : notReadyDelayMs)
          return { wait: true }
        }
      }
      const retry = msg === 'EXTRACT_LLM_UNAVAILABLE'
      if (retry && Number(job.attempts || 0) <= Number(maxRetries || 0) && !stopped) {
        await store.requeue(job.id)
        closed = true
        kick()
        return
      }
      state.failed += 1
      await store.finish(job.id, 'failed', msg || 'failed')
      closed = true
    } finally {
      if (!closed) await store.finish(job.id, 'failed', 'aborted').catch(() => undefined)
    }
  }

  function markParseFailed(count) {
    const n = Math.max(0, Number(count) || 0)
    if (!n) return
    state.parseFailed += n
  }

  async function stop() {
    stopped = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    while (processing) await new Promise((resolve) => setTimeout(resolve, 100))
  }

  async function backfill(cwd) {
    const key = String(cwd || '')
    if (!key) return { ok: false, count: 0 }
    try {
      await postPython({ op: 'repair_session_structure', cwd: key, args: {} }).catch(() => null)
      await postPython({ op: 'repair_workspace_vocab', cwd: key, args: {} }).catch(() => null)
      return { ok: true, count: 0 }
    } catch {
      return { ok: false, count: 0 }
    }
  }

  async function idleWarm(cwd) {
    if (chatBusy()) return { ok: false, count: 0 }
    if (idleAt && Date.now() - idleAt < (Number(idleMs) > 0 ? Number(idleMs) : IDLE_MS)) return { ok: false, count: 0 }
    const key = String(cwd || '')
    if (!key) return { ok: false, count: 0 }
    const listed = await postPython({ op: 'list_session_summaries', cwd: key, args: {} }).catch(() => null)
    const rows = listed && Array.isArray(listed.texts) ? listed.texts : []
    const latest = rows.find((row) => row && String(row.path || '').startsWith('session:'))
    if (!latest) return { ok: true, count: 0 }
    await enqueue(key, [{ path: latest.path, text: latest.text }], CAUSES.idle)
    return { ok: true, count: 1 }
  }

  kick()

  return {
    enqueue,
    enqueueHits,
    backfill,
    idleWarm,
    stop,
    snapshot,
    markParseFailed,
    extractFromSession,
    markIdle,
    markBusy,
    kick,
  }
}
