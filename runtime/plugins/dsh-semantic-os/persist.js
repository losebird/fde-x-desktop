/**
 * User overlay for non-secret Semantic OS settings.
 * Never stores API keys — only the env var name.
 * @module dsh-semantic-os/persist
 */

import { readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const STRING_KEYS = ['pythonPath', 'apiKeyEnv', 'ingestStrategy', 'peopleSyncUrl', 'peopleAccount', 'peoplePath',
  'storeNeo4jUrl', 'storeNeo4jAccount', 'storeRdfUrl', 'storeRdfAccount',
  'storeDatabricksUrl', 'storeDatabricksAccount', 'storeSnowflakeUrl', 'storeSnowflakeAccount']
const NUMBER_KEYS = ['startTimeoutMs', 'installTimeoutMs', 'peopleIntervalSec', 'sessionIngestIntervalMin']
const BOOLEAN_KEYS = ['sessionEndRecord', 'peopleAllowPrivateNetwork']

export const DEFAULT_START_TIMEOUT_MS = 180_000
export const DEFAULT_API_KEY_ENV = 'SEMANTICA_API_KEY'
export const DEFAULT_SESSION_INGEST_INTERVAL_MIN = 30

export function overlayPath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'dsh-semantic-os.json')
}

/** @type {Record<string, unknown> | null} */
let cache = null

export function loadOverlaySync() {
  if (cache) return cache
  try {
    cache = sanitize(JSON.parse(readFileSync(overlayPath(), 'utf8')), { partial: true })
  } catch {
    cache = {}
  }
  return cache
}

export async function loadOverlay() {
  if (cache) return cache
  try {
    const raw = await readFile(overlayPath(), 'utf8')
    cache = sanitize(JSON.parse(raw), { partial: true })
  } catch {
    cache = {}
  }
  return cache
}

export function peekOverlay() {
  return cache || {}
}

/**
 * @param {unknown} input
 * @param {{ partial?: boolean }} [opts]
 */
export function sanitize(input, opts = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('config must be an object')
  }
  const src = /** @type {Record<string, unknown>} */ (input)
  if ('apiKey' in src || 'token' in src || 'secret' in src || 'password' in src) {
    throw new Error('do not write secrets into config; only apiKeyEnv (the env var name)')
  }
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const key of STRING_KEYS) {
    if (src[key] === undefined) continue
    if (typeof src[key] !== 'string') throw new Error(`${key} must be a string`)
    const value = src[key].trim()
    if (key === 'apiKeyEnv' && value && !/^[A-Z][A-Z0-9_]{0,127}$/.test(value)) {
      throw new Error('apiKeyEnv must be an env var name such as SEMANTICA_API_KEY')
    }
    out[key] = value
  }
  for (const key of NUMBER_KEYS) {
    if (src[key] === undefined) continue
    const value = Number(src[key])
    if (!Number.isFinite(value)) throw new Error(`${key} must be a number`)
    if (key === 'peopleIntervalSec') {
      if (value < 0) throw new Error(`${key} must be >= 0`)
      out[key] = Math.floor(value)
      continue
    }
    if (value < 1) throw new Error(`${key} must be a positive number`)
    if (key === 'sessionIngestIntervalMin' && value > 24 * 60) {
      out[key] = 24 * 60
      continue
    }
    out[key] = Math.floor(value)
  }
  for (const key of BOOLEAN_KEYS) {
    if (src[key] === undefined) continue
    out[key] = Boolean(src[key])
  }
  if (!opts.partial && out.startTimeoutMs === undefined) {
    out.startTimeoutMs = DEFAULT_START_TIMEOUT_MS
  }
  return out
}

/**
 * @param {Record<string, unknown>} base
 */
export function mergeConfig(base) {
  const overlay = loadOverlaySync()
  return {
    pythonPath: String(overlay.pythonPath ?? base.pythonPath ?? ''),
    apiKeyEnv: String(overlay.apiKeyEnv ?? base.apiKeyEnv ?? DEFAULT_API_KEY_ENV),
    startTimeoutMs: Number(overlay.startTimeoutMs ?? base.startTimeoutMs ?? DEFAULT_START_TIMEOUT_MS),
    installTimeoutMs: Number(overlay.installTimeoutMs ?? base.installTimeoutMs ?? 15 * 60 * 1000),
    ingestStrategy: String(overlay.ingestStrategy ?? base.ingestStrategy ?? 'mtime'),
    sessionEndRecord: Boolean(overlay.sessionEndRecord ?? base.sessionEndRecord ?? false),
    peopleSyncUrl: String(overlay.peopleSyncUrl ?? base.peopleSyncUrl ?? ''),
    peopleAccount: String(overlay.peopleAccount ?? base.peopleAccount ?? ''),
    peoplePath: String(overlay.peoplePath ?? base.peoplePath ?? ''),
    peopleIntervalSec: Number(overlay.peopleIntervalSec ?? base.peopleIntervalSec ?? 0),
    peopleAllowPrivateNetwork: Boolean(overlay.peopleAllowPrivateNetwork ?? base.peopleAllowPrivateNetwork ?? false),
    sessionIngestIntervalMin: Number(overlay.sessionIngestIntervalMin ?? base.sessionIngestIntervalMin ?? DEFAULT_SESSION_INGEST_INTERVAL_MIN),
    storeNeo4jUrl: String(overlay.storeNeo4jUrl ?? base.storeNeo4jUrl ?? ''),
    storeNeo4jAccount: String(overlay.storeNeo4jAccount ?? base.storeNeo4jAccount ?? ''),
    storeRdfUrl: String(overlay.storeRdfUrl ?? base.storeRdfUrl ?? ''),
    storeRdfAccount: String(overlay.storeRdfAccount ?? base.storeRdfAccount ?? ''),
    storeDatabricksUrl: String(overlay.storeDatabricksUrl ?? base.storeDatabricksUrl ?? ''),
    storeDatabricksAccount: String(overlay.storeDatabricksAccount ?? base.storeDatabricksAccount ?? ''),
    storeSnowflakeUrl: String(overlay.storeSnowflakeUrl ?? base.storeSnowflakeUrl ?? ''),
    storeSnowflakeAccount: String(overlay.storeSnowflakeAccount ?? base.storeSnowflakeAccount ?? ''),
  }
}

/**
 * @param {unknown} input
 */
export async function saveOverlay(input) {
  const prev = await loadOverlay()
  const next = sanitize({ ...prev, ...(input && typeof input === 'object' ? input : {}) }, { partial: true })
  const path = overlayPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  cache = next
  return next
}
