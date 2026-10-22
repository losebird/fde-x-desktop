const { chmodSync, lstatSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } = require('node:fs')
const { homedir } = require('node:os')
const { dirname, join } = require('node:path')
const { STANDARD_DENY_SERVERS } = require('../../mode-policy.cjs')

const SERVER_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/u
const SESSION_ID_RE = /^session-[A-Za-z0-9-]{1,80}$/
const UNCONFIRMED = '早报允许表未能写入'

function dshHome() {
  return process.env.FDE_DSH_HOME || process.env.DSH_HOME || join(homedir(), '.dsh-fde-x')
}

function allowFile(sessionId, home) {
  const id = String(sessionId || '')
  if (!SESSION_ID_RE.test(id)) return ''
  return join(home || dshHome(), 'run', 'briefing-allow', `${id}.json`)
}

function allowDirectory(home) {
  return join(home || dshHome(), 'run', 'briefing-allow')
}

function statOrNull(path) {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error && error.code === 'ENOENT') return null
    throw error
  }
}

function prepareAllowDirectory(dir) {
  let info = statOrNull(dir)
  if (!info) {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    info = lstatSync(dir)
  }
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(UNCONFIRMED)
  chmodSync(dir, 0o700)
}

function tightenRegularAllowFile(file, info) {
  if (!info.isFile() || info.isSymbolicLink()) return
  if ((info.mode & 0o777) !== 0o600) chmodSync(file, 0o600)
}

function normalizeServers(servers) {
  const denied = new Set(STANDARD_DENY_SERVERS)
  const seen = new Set()
  const out = []
  for (const item of Array.isArray(servers) ? servers : []) {
    const name = String(item || '').trim()
    if (!SERVER_NAME_RE.test(name) || denied.has(name) || seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

function stageBriefingAllow(sessionId, servers, home) {
  const file = allowFile(sessionId, home)
  if (!file) throw new Error(UNCONFIRMED)
  prepareAllowDirectory(dirname(file))
  const existing = statOrNull(file)
  if (existing && (existing.isSymbolicLink() || !existing.isFile())) throw new Error(UNCONFIRMED)
  const body = { servers: normalizeServers(servers) }
  writeFileSync(file, `${JSON.stringify(body)}\n`, { mode: 0o600 })
  chmodSync(file, 0o600)
}

function readBriefingAllow(sessionId, home) {
  try {
    const file = allowFile(sessionId, home)
    if (!file) return []
    const info = statOrNull(file)
    if (!info || info.isSymbolicLink() || !info.isFile()) return []
    tightenRegularAllowFile(file, info)
    const payload = JSON.parse(readFileSync(file, 'utf8'))
    return normalizeServers(payload && payload.servers)
  } catch {
    return []
  }
}

function discardBriefingAllow(sessionId, home) {
  const file = allowFile(sessionId, home)
  if (!file) return
  const dirInfo = statOrNull(dirname(file))
  if (!dirInfo || dirInfo.isSymbolicLink() || !dirInfo.isDirectory()) return
  const info = statOrNull(file)
  if (!info) return
  if (info.isSymbolicLink() || info.isFile()) unlinkSync(file)
}

function sweepBriefingAllow(home) {
  const dir = allowDirectory(home)
  prepareAllowDirectory(dir)
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue
    const file = join(dir, name)
    const info = lstatSync(file)
    if (info.isSymbolicLink() || info.isFile()) unlinkSync(file)
  }
}

module.exports = {
  stageBriefingAllow,
  readBriefingAllow,
  discardBriefingAllow,
  sweepBriefingAllow,
}
