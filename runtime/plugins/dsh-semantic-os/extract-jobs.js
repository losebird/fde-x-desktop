/**
 * Durable extract jobs. One live job per session window.
 * Disk queue survives restart. Does not call the chat model.
 * @module dsh-semantic-os/extract-jobs
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { clipSnippet } from './session-find.js'

export const WINDOW = 1600
export const MAX_JOBS = 200
export const CAUSES = Object.freeze({
  hit: 'hit',
  nod: 'nod',
  idle: 'idle',
})

function homeDir() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

export function jobsPath() {
  return join(homeDir(), 'semantic-os', 'extract-jobs.json')
}

export function sessionKey(id) {
  const raw = String(id || '').trim()
  if (!raw.startsWith('session:')) return raw
  const rest = raw.slice('session:'.length)
  const cut = rest.match(/^(.*):\d+$/)
  return cut ? `session:${cut[1]}` : raw
}

export function windowOf(text, query, limit = WINDOW) {
  return clipSnippet(text, query, limit)
}

export function jobId(cwd, source, window) {
  return createHash('sha256')
    .update(String(cwd || ''))
    .update('\n')
    .update(sessionKey(source))
    .update('\n')
    .update(String(window || ''))
    .digest('hex')
    .slice(0, 24)
}

function emptyStore() {
  return { version: 1, jobs: [] }
}

async function readStore(path) {
  try {
    const raw = JSON.parse(await readFile(path, 'utf8'))
    if (raw && Array.isArray(raw.jobs)) return { version: 1, jobs: raw.jobs.filter((row) => row && row.id) }
  } catch { /* missing or corrupt → empty */ }
  return emptyStore()
}

async function writeStore(path, store) {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  await writeFile(tmp, `${JSON.stringify(store)}\n`, 'utf8')
  await rename(tmp, path)
}

function liveJobs(store) {
  return store.jobs.filter((row) => row.status === 'queued' || row.status === 'running')
}

export function createJobStore(opts = {}) {
  const path = opts.path || jobsPath()
  let chain = Promise.resolve()

  function withStore(fn) {
    const run = chain.then(async () => {
      const store = await readStore(path)
      const out = await fn(store)
      await writeStore(path, store)
      return out
    })
    chain = run.then(() => undefined, () => undefined)
    return run
  }

  function enqueue(job) {
    const cwd = String(job && job.cwd || '').trim()
    const source = String(job && job.source || '').trim()
    const text = String(job && job.window || job && job.text || '')
    if (!cwd || !source || !text) return Promise.resolve({ ok: false, error: 'NO_JOB' })
    const id = jobId(cwd, source, text)
    const cause = CAUSES[job.cause] || CAUSES.hit
    return withStore((store) => {
      const same = liveJobs(store).find((row) => row.id === id || (row.cwd === cwd && sessionKey(row.source) === sessionKey(source)))
      if (same) return { ok: true, id: same.id, duplicate: true, status: same.status }
      store.jobs.push({
        id,
        cwd,
        source,
        window: text,
        query: String(job.query || ''),
        timestamp: job.timestamp || '',
        cause,
        status: 'queued',
        createdAt: Date.now(),
        attempts: 0,
      })
      if (store.jobs.length > MAX_JOBS) store.jobs = store.jobs.slice(-MAX_JOBS)
      return { ok: true, id, duplicate: false, status: 'queued' }
    })
  }

  function claim() {
    return withStore((store) => {
      const staleBefore = Date.now() - 90_000
      for (const row of store.jobs) {
        if (row && row.status === 'running' && Number(row.startedAt || 0) < staleBefore) {
          row.status = 'queued'
          delete row.startedAt
        }
      }
      if (store.jobs.some((row) => row && row.status === 'running')) return null
      const next = store.jobs.find((row) => row.status === 'queued')
      if (!next) return null
      next.status = 'running'
      next.attempts = Number(next.attempts || 0) + 1
      next.startedAt = Date.now()
      return { ...next }
    })
  }

  function finish(id, status, detail) {
    const nid = String(id || '')
    return withStore((store) => {
      const row = store.jobs.find((item) => item.id === nid)
      if (!row) return { ok: false }
      row.status = status === 'failed' ? 'failed' : 'done'
      row.finishedAt = Date.now()
      if (detail) row.detail = String(detail).slice(0, 240)
      return { ok: true, id: nid, status: row.status }
    })
  }

  function requeue(id, extra) {
    const nid = String(id || '')
    return withStore((store) => {
      const row = store.jobs.find((item) => item.id === nid)
      if (!row) return { ok: false }
      row.status = 'queued'
      delete row.startedAt
      if (extra && extra.notReadyAttempts != null) row.notReadyAttempts = Number(extra.notReadyAttempts) || 0
      return { ok: true, id: nid }
    })
  }

  function requeueFailed(detail) {
    const want = String(detail || '')
    return withStore((store) => {
      const liveIds = new Set(liveJobs(store).map((row) => row.id))
      let queued = 0
      let dropped = 0
      const kept = []
      for (const row of store.jobs) {
        if (!row || row.status !== 'failed' || String(row.detail || '') !== want) {
          kept.push(row)
          continue
        }
        if (liveIds.has(row.id)) {
          dropped += 1
          continue
        }
        row.status = 'queued'
        delete row.startedAt
        delete row.finishedAt
        delete row.detail
        queued += 1
        kept.push(row)
      }
      store.jobs = kept
      return { ok: true, queued, dropped }
    })
  }

  function reclaimRunning() {
    return withStore((store) => {
      let count = 0
      for (const row of store.jobs) {
        if (row && row.status === 'running') {
          row.status = 'queued'
          delete row.startedAt
          count += 1
        }
      }
      return { ok: true, count }
    })
  }

  async function snapshot() {
    const store = await readStore(path)
    const rows = store.jobs
    return {
      queued: rows.filter((row) => row.status === 'queued').length,
      running: rows.filter((row) => row.status === 'running').length,
      done: rows.filter((row) => row.status === 'done').length,
      failed: rows.filter((row) => row.status === 'failed').length,
    }
  }

  return { enqueue, claim, finish, requeue, requeueFailed, reclaimRunning, snapshot, path }
}
