/**
 * Per-cwd ingest queue. Six states + shared-write banner.
 * After a successful ingest, run extract → kg_build → dedup.
 * Failure never flips the plugin to not-ready.
 * @module dsh-semantic-os/ingest
 */

import { realpathSync } from 'node:fs'
import { describePath, isEyesPath } from './eyes-media.js'
import { postPython as callPython } from './sidecar-client.js'


const STATES = new Set(['idle', 'queued', 'running', 'canceling', 'done', 'failed', 'cancelled'])

/**
 * @param {{ sidecar: { snapshot: Function, getApiKey: Function }, onGraphWrite?: Function }} opts
 */
export function createIngest(opts) {
  const { sidecar, getEyes } = opts
  /** @type {Map<string, Job>} */
  const jobs = new Map()

  function keyOf(cwd) {
    try { return realpathSync(String(cwd || '')) } catch { return '' }
  }

  function get(cwd) {
    const key = keyOf(cwd)
    if (!key) return blank('failed', 'NO_CWD')
    return jobs.get(key) || blank('idle')
  }

  function listShared(cwd) {
    const key = keyOf(cwd)
    const job = key ? jobs.get(key) : null
    return Boolean(job && (job.state === 'running' || job.state === 'queued') && job.writers > 1)
  }

  function snapshot(cwd, sessionId) {
    const job = get(cwd)
    const shared = listShared(cwd)
    if (sessionId && job.state === 'running' && job.owner && job.owner !== sessionId) {
      return { ...publicJob(job), sharedWrite: true }
    }
    return { ...publicJob(job), sharedWrite: shared }
  }

  function ensure(cwd, sessionId, paths) {
    const key = keyOf(cwd)
    if (!key) return blank('failed', 'NO_CWD')
    let job = jobs.get(key)
    if (!job) {
      const selected = Array.isArray(paths) ? paths.filter(Boolean) : []
      if (!selected.length) return blank('idle')
      job = blank('queued')
      job.cwd = key
      job.paths = selected
      job.owner = sessionId || ''
      job.writers = 1
      jobs.set(key, job)
      void run(job)
      return publicJob(job)
    }
    if (job.state === 'running' || job.state === 'queued') {
      if (sessionId && job.owner && job.owner !== sessionId) job.writers = Math.max(2, job.writers)
      return publicJob(job)
    }
    return publicJob(job)
  }

  function start(cwd, sessionId, paths, retryPipeline) {
    const key = keyOf(cwd)
    if (!key) return blank('failed', 'NO_CWD')
    const snap = sidecar.snapshot()
    if (!snap.ready || !snap.port) return blank('failed', 'NOT_READY')
    let job = jobs.get(key)
    if (job && (job.state === 'running' || job.state === 'queued')) {
      if (sessionId && job.owner && job.owner !== sessionId) job.writers = Math.max(2, job.writers)
      return publicJob(job)
    }
    job = blank('queued')
    job.cwd = key
    job.paths = Array.isArray(paths) ? paths.slice() : []
    job.owner = sessionId || ''
    job.writers = 1
    job.retryPipeline = Boolean(retryPipeline)
    job.nodded = true
    jobs.set(key, job)
    void run(job)
    return publicJob(job)
  }

  function cancel(cwd) {
    const key = keyOf(cwd)
    const job = key ? jobs.get(key) : null
    if (!job) return blank('idle')
    if (job.state === 'running' || job.state === 'queued') {
      job.cancelRequested = true
      job.state = 'canceling'
      job.detail = 'cancel requested'
      if (job.controller) job.controller.abort()
    }
    return publicJob(job)
  }

  function retry(cwd, sessionId) {
    return start(cwd, sessionId, undefined, true)
  }

  async function run(job) {
    job.state = 'running'
    const snap = sidecar.snapshot()
    if (!snap.ready || !snap.port) {
      fail(job, 'NOT_READY')
      return
    }
    try {
      job.controller = new AbortController()
      const ingestBody = await postPython(sidecar, {
        op: 'ingest_directory',
        cwd: job.cwd,
        args: { paths: job.paths || [], cancel: false, nodded: Boolean(job.nodded) },
      }, { signal: job.controller.signal, timeoutMs: 10 * 60 * 1000 })
      if (job.cancelRequested) {
        job.state = 'cancelled'
        job.writers = 0
        return
      }
      if (ingestBody && ingestBody.error) {
        fail(job, mapCode(ingestBody.error), ingestBody.detail || ingestBody.error)
        return
      }
      job.ingest = ingestBody
      job.pipeline = { stage: 'extract', status: 'running' }
      const texts = Array.isArray(ingestBody && ingestBody.texts) ? ingestBody.texts.slice() : []
      const eyes = typeof getEyes === 'function' ? getEyes() : null
      const files = Array.isArray(ingestBody && ingestBody.files) ? ingestBody.files : []
      if (job.nodded) {
        for (const file of files) {
          const path = file && file.path ? String(file.path) : ''
          if (!isEyesPath(path)) continue
          const pictured = await describePath(eyes, path)
          await postPython(sidecar, {
            op: 'record_sight',
            cwd: job.cwd,
            args: { attachment_id: path, page: '1', nodded: true, text: pictured || '' },
          }).catch(() => null)
          if (!pictured) continue
          const idx = texts.findIndex((row) => row && row.path === path)
          const existing = idx >= 0 ? String(texts[idx].text || '') : ''
          if (existing && existing.length >= pictured.length && existing !== String(file.name || '')) continue
          const row = { path, text: pictured.slice(0, 20_000) }
          if (idx >= 0) texts[idx] = row
          else texts.push(row)
        }
      }
      if (job.cancelRequested) {
        job.state = 'cancelled'
        job.writers = 0
        return
      }
      const pipeBody = await postPython(sidecar, {
        op: 'run_pipeline',
        cwd: job.cwd,
        args: { texts, retry: Boolean(job.retryPipeline) },
      }, { signal: job.controller.signal, timeoutMs: 10 * 60 * 1000 })
      if (pipeBody && pipeBody.error) {
        job.pipeline = { stage: pipeBody.stage || 'extract', status: 'failed', error: String(pipeBody.error) }
        fail(job, 'PIPELINE', pipeBody.error)
        return
      }
      job.pipeline = { stage: 'dedup', status: 'ok', steps: (pipeBody && pipeBody.steps) || [] }
      job.state = 'done'
      job.code = ''
      job.detail = ''
      job.writers = 0
      if (typeof opts.onGraphWrite === 'function') opts.onGraphWrite(job.cwd, 'ingest')
      const queue = typeof opts.getExtractQueue === 'function' ? opts.getExtractQueue() : null
      if (queue && typeof queue.markParseFailed === 'function') {
        const parsed = Number(ingestBody && ingestBody.parse_failed_count)
        if (parsed > 0) queue.markParseFailed(parsed)
      }

    } catch (error) {
      if (job.cancelRequested) {
        job.state = 'cancelled'
        job.detail = 'cancelled'
        job.writers = 0
      } else {
        fail(job, 'FAILED', error instanceof Error ? error.message : String(error))
      }
    } finally {
      job.controller = null
    }
  }

  return { ensure, start, cancel, retry, snapshot, get }
}

function fail(job, code, detail) {
  job.state = 'failed'
  job.code = code
  job.detail = detail || code
  job.writers = 0
}

function mapCode(error) {
  const text = String(error || '')
  if (text === 'NO_CWD' || text === 'BAD_CWD' || text === 'NOT_READY') return text
  return 'FAILED'
}

function blank(state, code) {
  return {
    state: STATES.has(state) ? state : 'idle',
    code: code || '',
    detail: '',
    cwd: '',
    paths: [],
    owner: '',
    writers: 0,
    ingest: null,
    pipeline: null,
    cancelRequested: false,
    retryPipeline: false,
    controller: null,
  }
}

function publicJob(job) {
  return {
    state: job.state,
    code: job.code || '',
    detail: job.detail || '',
    failReason: job.code || '',
    cwd: job.cwd || '',
    pipeline: job.pipeline,
    sharedWrite: job.writers > 1,
    files: job.ingest && job.ingest.count != null ? job.ingest.count : 0,
  }
}

export function postPython(sidecar, payload, options) {
  return callPython(sidecar, payload, options)
}
