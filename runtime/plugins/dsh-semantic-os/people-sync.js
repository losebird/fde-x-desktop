/**
 * Host timer: pull a user-configured roster URL into people.json.
 * Empty URL = no network. Never dumps into a project graph.json.
 * @module dsh-semantic-os/people-sync
 */

import { listPeople, savePeople } from './people.js'
import { mergeConfig } from './persist.js'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export const DEFAULT_PEOPLE_INTERVAL_MS = 6 * 60 * 60 * 1000
export const PEOPLE_FETCH_TIMEOUT_MS = 15_000
export const PEOPLE_MAX_RESPONSE_BYTES = 5 * 1024 * 1024

function intervalMs(cfg) {
  const sec = Number(cfg && cfg.peopleIntervalSec)
  if (Number.isFinite(sec) && sec > 0) return Math.max(60_000, Math.floor(sec) * 1000)
  return DEFAULT_PEOPLE_INTERVAL_MS
}

async function timedFetch(url, init) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PEOPLE_FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function limitedJson(res) {
  const reader = res.body && res.body.getReader ? res.body.getReader() : null
  if (!reader) return res.json()
  const chunks = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > PEOPLE_MAX_RESPONSE_BYTES) {
      await reader.cancel()
      const error = new Error('people response too large')
      error.code = 'RESPONSE_TOO_LARGE'
      throw error
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder().decode(bytes))
}

function privateAddress(address) {
  const text = String(address || '').toLowerCase()
  if (isIP(text) === 4) {
    const parts = text.split('.').map(Number)
    return parts[0] === 10
      || parts[0] === 127
      || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || parts[0] === 0
  }
  if (isIP(text) === 6) {
    return text === '::1' || text === '::' || text.startsWith('fc') || text.startsWith('fd') || text.startsWith('fe8') || text.startsWith('fe9') || text.startsWith('fea') || text.startsWith('feb')
  }
  return false
}

async function assertNetworkTarget(parsed, allowPrivate) {
  if (allowPrivate) return
  if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.localhost')) throw new Error('PRIVATE_NETWORK_FORBIDDEN')
  const rows = await lookup(parsed.hostname, { all: true, verbatim: true })
  if (!rows.length || rows.some((row) => privateAddress(row.address))) throw new Error('PRIVATE_NETWORK_FORBIDDEN')
}

function rowsFromPayload(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.people)) return payload.people
    if (Array.isArray(payload.items)) return payload.items
  }
  return null
}

export async function pullPeopleUrl(url, account, options = {}) {
  const target = String(url || '').trim()
  if (!target) return { ok: true, skipped: true, reason: 'NO_URL' }
  let parsed
  try {
    parsed = new URL(target)
  } catch {
    return { ok: false, error: 'BAD_URL' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'BAD_URL' }
  }
  try {
    await assertNetworkTarget(parsed, Boolean(options.allowPrivate))
  } catch {
    return { ok: false, error: 'PRIVATE_NETWORK_FORBIDDEN' }
  }
  const headers = { accept: 'application/json' }
  const label = String(account || '').trim()
  if (label) headers['x-dsh-people-account'] = label
  let res
  try {
    res = await timedFetch(parsed.href, { method: 'GET', headers, redirect: 'error' })
  } catch (err) {
    return { ok: false, error: 'FETCH_FAILED', detail: err instanceof Error ? err.message : String(err) }
  }
  if (!res.ok) {
    try {
      res = await timedFetch(parsed.href, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify(label ? { account: label } : {}),
        redirect: 'error',
      })
    } catch (err) {
      return { ok: false, error: 'FETCH_FAILED', detail: err instanceof Error ? err.message : String(err) }
    }
  }
  if (!res.ok) return { ok: false, error: 'HTTP', status: res.status }
  let payload
  try {
    payload = await limitedJson(res)
  } catch (error) {
    return { ok: false, error: error && error.code === 'RESPONSE_TOO_LARGE' ? 'RESPONSE_TOO_LARGE' : 'BAD_JSON' }
  }
  const rows = rowsFromPayload(payload)
  if (!rows) return { ok: false, error: 'BAD_SHAPE' }
  const saved = await savePeople(rows)
  return { ok: true, count: (saved.people || []).length, path: saved.path }
}

/**
 * @param {{ getConfig: () => Record<string, unknown> }} opts
 */
export function createPeopleSync(opts) {
  const getConfig = opts.getConfig
  const onRoster = opts.onRoster
  /** @type {ReturnType<typeof setInterval> | null} */
  let timer = null
  let running = false
  let last = { at: 0, ok: true, skipped: true, error: '' }

  async function tick() {
    if (running) return last
    running = true
    try {
      const cfg = mergeConfig(getConfig() || {})
      const url = String(cfg.peopleSyncUrl || '').trim()
      if (!url) {
        last = { at: Date.now(), ok: true, skipped: true, error: '' }
        return last
      }
      const result = await pullPeopleUrl(url, cfg.peopleAccount, { allowPrivate: cfg.peopleAllowPrivateNetwork })
      last = { at: Date.now(), ok: Boolean(result.ok), skipped: Boolean(result.skipped), error: result.error || '' }
      if (result.ok && !result.skipped && typeof onRoster === 'function') {
        const packed = await listPeople()
        const roster = (packed.people || []).map((row) => ({
          id: row && row.id,
          displayName: row && row.displayName,
          status: row && row.status,
        }))
        onRoster(roster)
      }
      return last
    } catch (err) {
      last = { at: Date.now(), ok: false, skipped: false, error: err instanceof Error ? err.message : String(err) }
      return last
    } finally {
      running = false
    }
  }

  function start() {
    if (timer) return
    void tick()
    const cfg = mergeConfig((getConfig && getConfig()) || {})
    timer = setInterval(() => { void tick() }, intervalMs(cfg))
    if (typeof timer.unref === 'function') timer.unref()
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function reschedule() {
    stop()
    start()
  }

  return { start, stop, tick, reschedule, snapshot: () => last }
}
