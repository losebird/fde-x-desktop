import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const runtimeDirectory = dirname(fileURLToPath(import.meta.url))

function expandHome(value) {
  const text = String(value || '')
  if (text === '~') return homedir()
  if (text.startsWith('~/')) return join(homedir(), text.slice(2))
  return text
}

export const FDE_RUNTIME_DIR = runtimeDirectory

export const FDE_APP_ROOT = resolve(expandHome(process.env.FDE_APP_ROOT || join(runtimeDirectory, '..')))

export const FDE_RESOURCES = resolve(expandHome(process.env.FDE_RESOURCES || FDE_APP_ROOT))

export const FDE_DSH_HOME = resolve(expandHome(process.env.FDE_DSH_HOME || join(homedir(), '.dsh-fde-x')))

export const FDE_VENDOR_DIR = resolve(expandHome(process.env.FDE_VENDOR_DIR || join(homedir(), '.dsh', 'vendor')))

export const FDE_OFFICIAL_DSH_HOME = join(homedir(), '.dsh')

export const FDE_DSH_PATCH = resolve(
  process.env.FDE_DSH_PATCH || join(FDE_RUNTIME_DIR, 'dsh-core.patch.yml'),
)

export const FDE_RUNTIME_PORT = Number(process.env.FDE_RUNTIME_PORT ?? 4318)

export const FDE_RUNTIME_HOST = process.env.FDE_RUNTIME_HOST ?? '127.0.0.1'

export const FDE_WEB_PORT = Number(process.env.FDE_WEB_PORT ?? 5174)

export const FDE_AI_WORKSPACE = resolve(process.env.FDE_AI_WORKSPACE || FDE_APP_ROOT)

export const DSH_LAN_ASSIST_PORT = String(process.env.DSH_LAN_ASSIST_PORT || '19527')

export const FDE_DATABASE_PATH = process.env.FDE_DATABASE_PATH
  ? resolve(process.env.FDE_DATABASE_PATH)
  : resolve(FDE_RUNTIME_DIR, 'data', 'fde-workstation.sqlite')

const MAC_DSH_FALLBACKS = ['/opt/homebrew/bin/dsh', '/usr/local/bin/dsh']

export function resolveDshBin(explicit) {
  const forced = explicit || process.env.FDE_DSH_BIN
  if (forced) {
    return existsSync(forced) ? forced : ''
  }

  const candidates = []

  const bundled = join(FDE_RESOURCES, 'dsh', 'bin', process.platform === 'win32' ? 'dsh.cmd' : 'dsh')
  const bundledUnix = join(FDE_RESOURCES, 'dsh', 'bin', 'dsh')
  if (existsSync(bundled)) candidates.push(bundled)
  if (bundled !== bundledUnix && existsSync(bundledUnix)) candidates.push(bundledUnix)

  candidates.push(...MAC_DSH_FALLBACKS)

  for (const dir of String(process.env.PATH || '').split(delimiter).filter(Boolean)) {
    candidates.push(join(dir, 'dsh'))
    if (process.platform === 'win32') candidates.push(join(dir, 'dsh.cmd'))
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate
  }
  return ''
}

export const FDE_DSH_BIN = resolveDshBin()

export function officialSemanticRuntimeRoot() {
  if (process.env.FDE_SEMANTIC_RUNTIME_SRC) {
    return resolve(expandHome(process.env.FDE_SEMANTIC_RUNTIME_SRC))
  }
  return join(FDE_OFFICIAL_DSH_HOME, 'semantic-os', 'runtime')
}

export const FDE_SEMANTIC_RUNTIME_SRC = officialSemanticRuntimeRoot()

export function vendorSemanticRuntimeDist(dshHome = FDE_DSH_HOME) {
  return join(dshHome, 'vendor', 'dsh-semantic-os', 'runtime-dist')
}

export function officialSemanticInstallState() {
  return join(FDE_OFFICIAL_DSH_HOME, 'semantic-os', 'install-state.json')
}

/** @param {string | undefined} raw */
export function parseAllowedOrigins(raw) {
  if (raw && String(raw).trim()) {
    return String(raw)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  }
  const hosts = ['127.0.0.1', 'localhost']
  const webPorts = [4173, 5173, FDE_WEB_PORT, 5175]
  const runtimePorts = [FDE_RUNTIME_PORT, 4318, 4319]
  const origins = new Set()
  for (const host of hosts) {
    for (const p of webPorts) origins.add(`http://${host}:${p}`)
    for (const p of runtimePorts) origins.add(`http://${host}:${p}`)
  }
  return [...origins]
}

export const FDE_ALLOWED_ORIGINS = parseAllowedOrigins(process.env.FDE_ALLOWED_ORIGINS)

/**
 * Resolve an allowed page origin for CORS / SSE reads.
 * Browsers omit `Origin` on same-origin GET (e.g. EventSource via Vite proxy); use `Referer` then.
 *
 * @param {import('node:http').IncomingMessage} request
 * @param {Set<string> | string[]} allowedOrigins
 * @returns {string | null}
 */
export function resolveAllowedRequestOrigin(request, allowedOrigins) {
  const allowed = allowedOrigins instanceof Set ? allowedOrigins : new Set(allowedOrigins)
  const origin = request.headers.origin
  if (typeof origin === 'string' && origin.length > 0) {
    return allowed.has(origin) ? origin : null
  }
  const referer = request.headers.referer
  if (typeof referer === 'string' && referer.length > 0) {
    try {
      const fromReferer = new URL(referer).origin
      if (allowed.has(fromReferer)) return fromReferer
    } catch {
      // ignore malformed referer
    }
  }
  return null
}

export function defaultRuntimeUrl() {
  return `http://${FDE_RUNTIME_HOST}:${FDE_RUNTIME_PORT}`
}

export function fdeRunDirectory(dshHome = FDE_DSH_HOME) {
  return join(dshHome, 'run')
}
