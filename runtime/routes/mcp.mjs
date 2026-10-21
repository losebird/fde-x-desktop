import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { delimiter, join } from 'node:path'
import { lookup as dnsLookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import { listBusinessConnections } from '../db.mjs'
import { FDE_AI_WORKSPACE, FDE_RESOURCES, resolveAllowedRequestOrigin } from '../config.mjs'
import { desktopProcessPath } from '../desktop-process-path.mjs'
import { loadBizVocab, vocabCatalogVersion } from '../biz/vocab-sheet.mjs'
import { collectBag } from '../catalog-collect.mjs'
import { resolvePrimarySessionForRuntime } from '../session-primary.mjs'
import {
  decorateDiscoveredMcpRows,
  discoverLocalMcpServers,
  parseMcpPatchEntries,
  profileCordisPatchPath,
  readMcpArchiveText,
  removeMcpPatchEntry,
  resolveStdioCwd,
  upsertMcpDisabled,
  upsertMcpPatchEntry,
  writeNormalizedPatch,
} from '../mcp-archive.mjs'

export { readMcpArchiveText, parseMcpPatchEntries }

const SERVER_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/u

export async function resolveMcpProjectionSession(aiRuntime, input = {}) {
  return resolvePrimarySessionForRuntime(aiRuntime, input)
}

function toolNameFromSchema(item) {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object') {
    if (typeof item.name === 'string') return item.name
    const fn = item.function
    if (fn && typeof fn === 'object' && typeof fn.name === 'string') return fn.name
  }
  return ''
}

function foldRequestHeaderFromRecords(records) {
  let header = null
  for (const record of Array.isArray(records) ? records : []) {
    const event = record?.type === 'event' ? record.event : null
    if (event?.type === 'request/header' && event.data?.header) header = event.data.header
  }
  return header
}

export function toolNamesFromFollowSnapshot(frame) {
  const names = []
  const pushTools = (tools) => {
    if (!Array.isArray(tools)) return
    for (const item of tools) {
      const name = toolNameFromSchema(item)
      if (name) names.push(name)
    }
  }
  if (frame?.type !== 'snapshot') return []
  pushTools(frame.header?.tools)
  pushTools(foldRequestHeaderFromRecords(frame.records)?.tools)
  return [...new Set(names)]
}

export function groupMcpToolsByServer(allToolNames, serverNames) {
  const byServer = new Map(serverNames.map((serverName) => [serverName, []]))
  for (const name of allToolNames) {
    if (!name.startsWith('mcp__')) continue
    for (const serverName of serverNames) {
      const prefix = `mcp__${serverName}__`
      if (name.startsWith(prefix)) {
        byServer.get(serverName).push(name)
        break
      }
    }
  }
  for (const serverName of serverNames) {
    byServer.set(serverName, (byServer.get(serverName) || []).sort())
  }
  return byServer
}

export async function listSessionProjectedToolNames(aiRuntime, sessionId) {
  const agentId = String(sessionId || '').trim()
  if (!agentId || !aiRuntime || typeof aiRuntime.stream !== 'function') return []
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), 8000)
  try {
    for await (const frame of aiRuntime.stream('session/follow', {
      request: {
        address: { kind: 'session', sessionId: agentId },
        maxMessages: 80,
      },
    }, abort.signal)) {
      if (frame?.type === 'snapshot') return toolNamesFromFollowSnapshot(frame)
    }
  } catch (error) {
    console.warn('mcp tools projection session/follow failed', error)
  } finally {
    clearTimeout(timer)
  }
  return []
}

const RUNNING_PHASES = new Set(['pending', 'loading', 'active', 'unloading'])

export function mapServerStatus({ connected, disabled, fiberPhase, fiberEnabled }) {
  const phase = String(fiberPhase || '').trim()
  if (disabled) {
    if (!connected) return 'disabled'
    if (fiberEnabled === true && RUNNING_PHASES.has(phase)) return 'unloading'
    return 'disabled'
  }
  if (!connected) return 'configured'
  if (phase === 'failed') return 'failed'
  if (phase === 'unloading') return 'unloading'
  if (phase === 'active' && fiberEnabled !== false) return 'loaded'
  return 'loading'
}

import { mcpFiberFromPlugins } from '../tool-occupancy.mjs'
export { mcpFiberFromPlugins }

async function listHostPlugins(aiRuntime) {
  if (!aiRuntime || typeof aiRuntime.call !== 'function') return []
  try {
    const listed = await aiRuntime.call('pluginManager/listPlugins', {})
    if (Array.isArray(listed)) return listed
    if (Array.isArray(listed?.plugins)) return listed.plugins
    if (Array.isArray(listed?.entries)) return listed.entries
  } catch {
    /* Host without plugin manager, or Face not fillable */
  }
  return []
}

export async function buildMcpServersV2(aiRuntime, patchText, projectedToolNames) {
  const connected = Boolean(aiRuntime && typeof aiRuntime.status === 'function' && aiRuntime.status().connected)
  const configured = parseMcpPatchEntries(patchText)
  const serverNames = configured.map((row) => row.serverName)
  const projected = Array.isArray(projectedToolNames) ? projectedToolNames : []
  const toolsByServer = groupMcpToolsByServer(projected, serverNames)
  const plugins = connected ? await listHostPlugins(aiRuntime) : []
  const mcp = []
  for (const row of configured) {
    const tools = toolsByServer.get(row.serverName) || []
    const fiber = mcpFiberFromPlugins(plugins, row.serverName)
    const args = Array.isArray(row.args) ? row.args : []
    const item = {
      serverName: row.serverName,
      transport: row.transport,
      disabled: Boolean(row.disabled),
      pluginId: row.pluginId || `mcp-${row.serverName}`,
      fiberPhase: fiber && fiber.fiberPhase ? String(fiber.fiberPhase) : '',
      status: mapServerStatus({
        connected,
        disabled: Boolean(row.disabled),
        fiberPhase: fiber && fiber.fiberPhase,
        fiberEnabled: fiber ? fiber.enabled !== false : undefined,
      }),
      tools,
    }
    if (row.transport === 'streamable-http') {
      item.url = row.url
      item.headers = row.headers || {}
    } else {
      item.command = row.command
      item.args = args
      if (row.env && typeof row.env === 'object') item.env = row.env
      if (row.cwd) item.cwd = row.cwd
    }
    mcp.push(item)
  }
  return mcp
}

export async function buildConnectors(db, aiRuntime) {
  const rows = listBusinessConnections(db)
  let state = {}
  try {
    state = await aiRuntime.lanAssist('/state', { search: { sessionId: '' } })
  } catch (error) {
    console.warn('mcp connectors state failed', error)
  }
  const lookup = state?.lookup && typeof state.lookup === 'object' ? state.lookup : {}
  const cwd = typeof aiRuntime.cwd === 'string' && aiRuntime.cwd.startsWith('/')
    ? aiRuntime.cwd
    : FDE_AI_WORKSPACE
  let catalogVersion = ''
  try {
    const vocab = await loadBizVocab(aiRuntime, cwd)
    const version = vocabCatalogVersion(vocab)
    catalogVersion = version == null ? '' : String(version)
  } catch {
    catalogVersion = ''
  }
  const lookupRegistered = Boolean(lookup.configured || lookup.hasToken)
  const online = Boolean(state.capabilities?.connector || lookupRegistered)
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    provider: row.provider,
    online,
    catalogVersion,
    lookupRegistered,
  }))
}

export function validateServerName(serverName, existing, opts = {}) {
  if (!SERVER_NAME_RE.test(serverName)) return 'serverName 须为 1–32 位字母数字_-'
  if (opts.unique && existing && existing.has(serverName)) return 'serverName 已存在'
  return ''
}

function headerMap(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return {}
  const out = {}
  for (const [key, value] of Object.entries(headers)) {
    const name = String(key || '').trim()
    if (!name) continue
    out[name] = String(value ?? '')
  }
  return out
}

const PROBE_TIMEOUT_MS = 10_000
const PROBE_HEADER_DROP = new Set(['cookie', 'set-cookie', 'host', 'connection', 'content-length', 'transfer-encoding'])

function stringEnv(env) {
  if (!env || typeof env !== 'object' || Array.isArray(env)) return {}
  const out = {}
  for (const [key, value] of Object.entries(env)) {
    const name = String(key || '').trim()
    if (!name || name === 'PATH' || name === 'Path' || name.includes('=') || name.includes('\0')) continue
    if (value == null) continue
    out[name] = String(value)
  }
  return out
}

function probeHeaderMap(headers) {
  const out = {}
  for (const [key, value] of Object.entries(headerMap(headers))) {
    if (PROBE_HEADER_DROP.has(key.toLowerCase())) continue
    out[key] = value
  }
  return out
}

export function entryFromProbeDraft(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: '请求体必须是对象' }
  const transport = body.transport
  if (transport !== 'stdio' && transport !== 'streamable-http') {
    return { error: 'transport 必须是 stdio 或 streamable-http' }
  }
  if (transport === 'streamable-http') {
    const urlValue = typeof body.url === 'string' ? body.url.trim() : ''
    if (!urlValue) return { error: 'streamable-http 需要 url' }
    let parsed
    try {
      parsed = new URL(urlValue)
    } catch {
      return { error: 'url 不合法' }
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { error: 'url 只接受 http 或 https' }
    return { entry: { transport, url: urlValue, headers: probeHeaderMap(body.headers) } }
  }
  const command = typeof body.command === 'string' ? body.command.trim() : ''
  if (!command) return { error: 'stdio 需要 command' }
  if (Array.isArray(body.args) && body.args.length > 64) return { error: 'args 不能超过 64 项' }
  const args = Array.isArray(body.args) ? body.args.map((item) => String(item)) : []
  const cwd = typeof body.cwd === 'string' ? body.cwd.trim() : ''
  const env = stringEnv(body.env)
  return {
    entry: {
      transport,
      command,
      args,
      ...(cwd ? { cwd } : {}),
      ...(Object.keys(env).length ? { env } : {}),
    },
  }
}

// Loopback is intentionally absent. A local MCP on 127.0.0.0/8 or ::1 is a
// legitimate probe target. Everything else here is non-global: private,
// shared (CGNAT, including 100.100.100.200), link-local (including
// 169.254.169.254), ULA, unspecified, multicast, or reserved.
const probeBlock = new BlockList()
probeBlock.addSubnet('0.0.0.0', 8, 'ipv4')
probeBlock.addSubnet('10.0.0.0', 8, 'ipv4')
probeBlock.addSubnet('100.64.0.0', 10, 'ipv4')
probeBlock.addSubnet('169.254.0.0', 16, 'ipv4')
probeBlock.addSubnet('172.16.0.0', 12, 'ipv4')
probeBlock.addSubnet('192.0.0.0', 24, 'ipv4')
probeBlock.addSubnet('192.168.0.0', 16, 'ipv4')
probeBlock.addSubnet('198.18.0.0', 15, 'ipv4')
probeBlock.addSubnet('224.0.0.0', 4, 'ipv4')
probeBlock.addSubnet('240.0.0.0', 4, 'ipv4')
probeBlock.addAddress('::', 'ipv6')
probeBlock.addSubnet('fc00::', 7, 'ipv6')
probeBlock.addSubnet('fe80::', 10, 'ipv6')
probeBlock.addSubnet('ff00::', 8, 'ipv6')

function ipv6Groups(ip) {
  const lower = ip.toLowerCase()
  if (lower.includes('.')) return null
  const halves = lower.split('::')
  if (halves.length > 2) return null
  const parse = (part) => {
    if (!part) return []
    const bits = part.split(':')
    if (bits.some((bit) => !/^[0-9a-f]{1,4}$/.test(bit))) return null
    return bits.map((bit) => Number.parseInt(bit, 16))
  }
  const left = parse(halves[0])
  if (!left) return null
  if (halves.length === 1) return left.length === 8 ? left : null
  const right = parse(halves[1])
  if (!right) return null
  const missing = 8 - left.length - right.length
  if (missing < 1) return null
  return [...left, ...Array(missing).fill(0), ...right]
}

function embeddedTransitionIpv4(ip) {
  const groups = ipv6Groups(ip)
  if (!groups || groups.length !== 8) return ''
  const quad = (hi, lo) => `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`
  if (groups[0] === 0x64 && groups[1] === 0xff9b && groups[2] === 0 && groups[3] === 0 && groups[4] === 0 && groups[5] === 0) {
    return quad(groups[6], groups[7])
  }
  if (groups[0] === 0x2002) return quad(groups[1], groups[2])
  return ''
}

export function probeAddressBlocked(ip) {
  const raw = String(ip || '').trim().replace(/^\[|\]$/g, '').split('%')[0]
  const family = isIP(raw)
  if (family !== 4 && family !== 6) return true
  if (probeBlock.check(raw, family === 6 ? 'ipv6' : 'ipv4')) return true
  if (family !== 6) return false
  const embedded = embeddedTransitionIpv4(raw)
  return embedded !== '' && isIP(embedded) === 4 && probeBlock.check(embedded, 'ipv4')
}

export async function probeHttpTargetError(urlValue, resolveHost = dnsLookup) {
  let parsed
  try {
    parsed = new URL(String(urlValue || ''))
  } catch {
    return 'url 不合法'
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'url 只接受 http 或 https'
  let host = parsed.hostname
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1)
  host = host.split('%')[0]
  if (!host) return 'url 不合法'
  let addresses
  if (isIP(host)) {
    addresses = [host]
  } else {
    let found
    try {
      found = await resolveHost(host, { all: true, verbatim: true })
    } catch {
      return '无法解析该地址'
    }
    const rows = Array.isArray(found) ? found : [found]
    addresses = rows.map((row) => {
      if (typeof row === 'string') return row
      if (row && typeof row.address === 'string') return row.address
      return ''
    }).filter((address) => address)
  }
  if (!addresses.length) return '无法解析该地址'
  if (addresses.some((address) => probeAddressBlocked(address))) return '该地址不在探测允许范围内'
  return ''
}

function withProbeTimeout(promise, ms = PROBE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, message: 'timeout' }), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value && typeof value === 'object' ? value : { ok: false, message: 'timeout' })
      },
      () => {
        clearTimeout(timer)
        resolve({ ok: false, message: 'timeout' })
      },
    )
  })
}

function jsonRpcParse(text) {
  const raw = String(text || '').trim()
  if (!raw) return null
  const tryParse = (chunk) => {
    try {
      const parsed = JSON.parse(chunk)
      if (parsed && typeof parsed === 'object' && parsed.jsonrpc === '2.0') return parsed
    } catch {
      return null
    }
    return null
  }
  const direct = tryParse(raw)
  if (direct) return direct
  for (const line of raw.split('\n')) {
    const data = line.trim()
    if (!data.startsWith('data:')) continue
    const found = tryParse(data.slice(5).trim())
    if (found) return found
  }
  return null
}

function jsonRpcResultFromBody(text) {
  const parsed = jsonRpcParse(text)
  return parsed && parsed.result !== undefined ? parsed.result : null
}

function jsonRpcErrorMessage(text) {
  const parsed = jsonRpcParse(text)
  const err = parsed && parsed.error && typeof parsed.error === 'object' ? parsed.error : null
  if (!err) return ''
  return String(err.message || err.code || 'MCP error')
}

async function mcpHttpPost(entry, payload, { timeoutMs = 8000, sessionId } = {}) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const headers = {
      ...headerMap(entry.headers),
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    }
    if (sessionId) headers['Mcp-Session-Id'] = sessionId
    const res = await fetch(entry.url, {
      method: 'POST',
      redirect: 'manual',
      signal: ac.signal,
      headers,
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    const nextSession = res.headers.get('mcp-session-id') || sessionId || ''
    return { status: res.status, text, sessionId: nextSession }
  } finally {
    clearTimeout(timer)
  }
}

async function probeMcpInitialize(entry, timeoutMs = 2000) {
  try {
    const posted = await mcpHttpPost(entry, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'dsh-mcp-client', version: '0.2.0-rc.2' },
      },
    }, { timeoutMs })
    if (posted.status < 200 || posted.status >= 400) return { ok: false, message: `HTTP ${posted.status}` }
    if (!jsonRpcResultFromBody(posted.text)) return { ok: false, message: 'MCP initialize 无 result' }
    return { ok: true, message: 'MCP 可达' }
  } catch (error) {
    if (error && error.name === 'AbortError') return { ok: false, message: 'timeout' }
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

export async function callMcpHttpTool(entry, toolName, args = {}, timeoutMs = 60_000) {
  const name = String(toolName || '').trim()
  if (!entry?.url) return { ok: false, error: '缺少 url' }
  if (!name) return { ok: false, error: '缺少 tool' }
  try {
    const initialized = await mcpHttpPost(entry, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'dsh-mcp-client', version: '0.2.0-rc.2' },
      },
    }, { timeoutMs: Math.min(8000, timeoutMs) })
    if (initialized.status < 200 || initialized.status >= 400) {
      return { ok: false, error: `HTTP ${initialized.status}` }
    }
    if (!jsonRpcResultFromBody(initialized.text)) {
      return { ok: false, error: jsonRpcErrorMessage(initialized.text) || 'MCP initialize 无 result' }
    }
    const sessionId = initialized.sessionId
    await mcpHttpPost(entry, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {},
    }, { timeoutMs: 4000, sessionId }).catch(() => ({ status: 0, text: '', sessionId }))
    const called = await mcpHttpPost(entry, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name,
        arguments: args && typeof args === 'object' && !Array.isArray(args) ? args : {},
      },
    }, { timeoutMs, sessionId })
    if (called.status < 200 || called.status >= 400) {
      return { ok: false, error: jsonRpcErrorMessage(called.text) || `HTTP ${called.status}` }
    }
    const result = jsonRpcResultFromBody(called.text)
    if (result === null) {
      return { ok: false, error: jsonRpcErrorMessage(called.text) || 'tools/call 无 result' }
    }
    return { ok: true, result }
  } catch (error) {
    if (error && error.name === 'AbortError') return { ok: false, error: 'timeout' }
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function mcpStdioFrame(payload) {
  return `${JSON.stringify(payload)}\n`
}

function jsonRpcMessagesFromStdio(text) {
  const messages = []
  let rest = String(text || '')
  while (rest.length) {
    const header = rest.match(/^Content-Length:\s*(\d+)\r\n\r\n/iu)
    if (header) {
      const length = Number(header[1])
      const start = header[0].length
      if (rest.length < start + length) break
      const chunk = rest.slice(start, start + length)
      rest = rest.slice(start + length)
      try {
        messages.push(JSON.parse(chunk))
      } catch {
        /* skip malformed frame */
      }
      continue
    }
    const nl = rest.indexOf('\n')
    if (nl < 0) {
      const trimmed = rest.trim()
      if (trimmed) {
        try {
          messages.push(JSON.parse(trimmed))
        } catch {
          /* incomplete */
        }
      }
      break
    }
    const line = rest.slice(0, nl).trim()
    rest = rest.slice(nl + 1)
    if (!line) continue
    try {
      messages.push(JSON.parse(line))
    } catch {
      /* skip non-json */
    }
  }
  return messages
}

function firstStderrLine(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join('\n')
    .slice(0, 500)
}

function initializeBody() {
  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'dsh-mcp-client', version: '0.2.0-rc.2' },
    },
  }
}

async function probeMcpStdioInitialize(entry, timeoutMs = 8000) {
  const command = String(entry.command || '').trim()
  const absolute = command.startsWith('/') || /^[A-Za-z]:[\\/]/.test(command)
  const resolved = await resolveExecutable(command)
  if (!resolved) {
    if (absolute) {
      try {
        await access(command, constants.F_OK)
        return { ok: false, message: `不可执行 ${command}` }
      } catch {
        return { ok: false, message: `找不到文件 ${command}` }
      }
    }
    return { ok: false, message: `PATH 里找不到 ${command}` }
  }
  const args = Array.isArray(entry.args) ? entry.args.map(String) : []
  const pathEnv = desktopProcessPath({
    resources: process.env.FDE_RESOURCES || FDE_RESOURCES,
    inheritedPath: process.env.PATH || '',
  })
  return await new Promise((resolve) => {
    const spawnCwd = String(entry.cwd || '').trim()
    const child = spawn(resolved, args, {
      env: { ...process.env, ...stringEnv(entry.env), PATH: pathEnv },
      cwd: spawnCwd || undefined,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        child.kill('SIGTERM')
      } catch {
        /* already gone */
      }
      resolve(result)
    }
    const timer = setTimeout(() => finish({ ok: false, message: 'timeout' }), timeoutMs)
    const consider = () => {
      for (const message of jsonRpcMessagesFromStdio(out)) {
        if (message && message.id === 1 && message.result !== undefined) {
          finish({ ok: true, message: 'MCP 可达' })
          return
        }
        if (message && message.id === 1 && message.error) {
          finish({ ok: false, message: String(message.error.message || message.error.code || 'MCP error') })
        }
      }
    }
    child.stdout.on('data', (chunk) => {
      out += chunk
      consider()
    })
    child.stderr.on('data', (chunk) => {
      err += chunk
    })
    child.on('error', (error) => finish({ ok: false, message: error.message }))
    child.on('exit', () => {
      if (settled) return
      consider()
      if (settled) return
      finish({ ok: false, message: firstStderrLine(err) || 'stdio 退出且无 initialize result' })
    })
    try {
      child.stdin.write(mcpStdioFrame(initializeBody()))
    } catch (error) {
      finish({ ok: false, message: error instanceof Error ? error.message : String(error) })
    }
  })
}

export async function resolveExecutable(command) {
  const raw = String(command || '').trim()
  if (!raw) return ''
  if (raw.startsWith('/') || /^[A-Za-z]:[\\/]/.test(raw)) {
    try {
      await access(raw, constants.X_OK)
      return raw
    } catch {
      return ''
    }
  }
  const pathEnv = desktopProcessPath({
    resources: process.env.FDE_RESOURCES || FDE_RESOURCES,
    inheritedPath: process.env.PATH || '',
  })
  for (const dir of pathEnv.split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, raw)
    try {
      await access(candidate, constants.X_OK)
      return candidate
    } catch {
      /* next PATH entry */
    }
  }
  return ''
}

export async function checkMcpHealth(entry) {
  if (entry.transport === 'streamable-http') {
    if (!entry.url) return { ok: false, message: '缺少 url' }
    return probeMcpInitialize(entry)
  }
  const command = String(entry.command || '').trim()
  if (!command) return { ok: false, message: '缺少 command' }
  return probeMcpStdioInitialize(entry)
}

export function mcpArchiveWriteNote(connected) {
  return connected ? '已写入配置，核心将热更新' : '已写入配置，需重载核心生效'
}

function hostConnected(aiRuntime) {
  return Boolean(aiRuntime && typeof aiRuntime.status === 'function' && aiRuntime.status().connected)
}

export async function handleMcpRoutes(request, response, url, ctx) {
  const { aiRuntime, db, currentCorrelationId, sendJson, sendError, readJson } = ctx

  if (request.method === 'GET' && url.pathname === '/api/v1/mcp/recipes') {
    const { listMcpRecipes } = await import('../mcp-recipes.mjs')
    sendJson(response, 200, { data: { recipes: listMcpRecipes() }, correlationId: currentCorrelationId })
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/mcp/discover') {
    const discovered = await discoverLocalMcpServers()
    const archiveNames = parseMcpPatchEntries(await readMcpArchiveText(aiRuntime)).map((row) => row.serverName)
    sendJson(response, 200, {
      data: { items: decorateDiscoveredMcpRows(discovered, archiveNames) },
      correlationId: currentCorrelationId,
    })
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/mcp/servers') {
    const bag = await collectBag(aiRuntime, 'mcp')
    const mcp = Array.isArray(bag.raw?.mcp) ? bag.raw.mcp : bag.items.map((row) => row.fields)
    const resourceTools = Array.isArray(bag.raw?.resourceTools) ? bag.raw.resourceTools : []
    const connectors = await buildConnectors(db, aiRuntime)
    sendJson(response, 200, { data: { mcp, connectors, resourceTools }, correlationId: currentCorrelationId })
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/mcp/projection') {
    const bag = await collectBag(aiRuntime, 'mcp', {
      project: true,
      sessionId: url.searchParams.get('sessionId') || '',
      cwd: url.searchParams.get('cwd') || url.searchParams.get('workspace') || '',
    })
    const mcp = Array.isArray(bag.raw?.mcp) ? bag.raw.mcp : bag.items.map((row) => row.fields)
    const resourceTools = Array.isArray(bag.raw?.resourceTools) ? bag.raw.resourceTools : []
    sendJson(response, 200, { data: { mcp, resourceTools, actions: bag.actions }, correlationId: currentCorrelationId })
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/mcp/probe') {
    const origin = resolveAllowedRequestOrigin(request, ctx.allowedOrigins || [])
    if (!origin) {
      sendError(response, 403, 'origin_not_allowed', '当前页面来源不被允许', currentCorrelationId)
      return true
    }
    let body
    try {
      body = await readJson(request)
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === 'request_too_large'
      sendError(response, 400, 'validation_error', tooLarge ? '请求体过大' : '请求体不是合法的 JSON', currentCorrelationId)
      return true
    }
    const built = entryFromProbeDraft(body)
    if (built.error) {
      sendError(response, 400, 'validation_error', built.error, currentCorrelationId)
      return true
    }
    if (built.entry.transport === 'streamable-http') {
      const targetError = await probeHttpTargetError(built.entry.url)
      if (targetError) {
        sendError(response, 400, 'validation_error', targetError, currentCorrelationId)
        return true
      }
    }
    const health = await withProbeTimeout(checkMcpHealth(built.entry))
    sendJson(response, 200, { data: health, correlationId: currentCorrelationId })
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/mcp/health') {
    const text = await readMcpArchiveText(aiRuntime)
    const serverName = url.searchParams.get('serverName') || ''
    const entries = parseMcpPatchEntries(text)
    const entry = entries.find((row) => row.serverName === serverName)
    if (!entry) {
      sendError(response, 404, 'not_found', '未找到该 MCP 服务器', currentCorrelationId)
      return true
    }
    const health = await checkMcpHealth(entry)
    sendJson(response, 200, { data: health, correlationId: currentCorrelationId })
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/mcp/servers') {
    const body = await readJson(request)
    const serverName = typeof body.serverName === 'string' ? body.serverName.trim() : ''
    const transport = body.transport === 'streamable-http' ? 'streamable-http' : 'stdio'
    const archivePath = profileCordisPatchPath(aiRuntime) || aiRuntime.patchFile
    let text = ''
    try {
      text = await readFile(archivePath, 'utf8')
    } catch {
      text = ''
    }
    const existing = new Set(parseMcpPatchEntries(await readMcpArchiveText(aiRuntime)).map((row) => row.serverName))
    const nameError = validateServerName(serverName, existing)
    if (nameError) {
      sendError(response, 400, 'validation_error', nameError, currentCorrelationId)
      return true
    }
    const existed = existing.has(serverName)
    const current = parseMcpPatchEntries(text).find((row) => row.serverName === serverName)
    let entry
    if (transport === 'streamable-http') {
      const urlValue = typeof body.url === 'string' ? body.url.trim() : ''
      if (!urlValue) {
        sendError(response, 400, 'validation_error', 'streamable-http 需要 url', currentCorrelationId)
        return true
      }
      const headers = body.headers && typeof body.headers === 'object' && !Array.isArray(body.headers) ? body.headers : undefined
      entry = { serverName, transport, url: urlValue, headers }
    } else {
      const command = typeof body.command === 'string' ? body.command.trim() : ''
      if (!command) {
        sendError(response, 400, 'validation_error', 'stdio 需要 command', currentCorrelationId)
        return true
      }
      const args = Array.isArray(body.args) ? body.args.map((item) => String(item)) : []
      const env = body.env && typeof body.env === 'object' && !Array.isArray(body.env) ? body.env : undefined
      const cwdSource = Object.prototype.hasOwnProperty.call(body, 'cwd') ? body.cwd : current?.cwd
      const cwd = resolveStdioCwd(cwdSource, aiRuntime)
      entry = { serverName, transport, command, args, env, ...(cwd ? { cwd } : {}) }
    }
    const next = upsertMcpPatchEntry(text, entry)
    await writeNormalizedPatch(archivePath, next)
    const connected = hostConnected(aiRuntime)
    sendJson(response, existed ? 200 : 201, {
      data: { serverName, needsRestart: !connected },
      note: mcpArchiveWriteNote(connected),
      correlationId: currentCorrelationId,
    })
    return true
  }

  const enableMatch = url.pathname.match(/^\/api\/v1\/mcp\/servers\/([^/]+)\/enabled$/)
  if (request.method === 'POST' && enableMatch) {
    const serverName = decodeURIComponent(enableMatch[1])
    const body = await readJson(request)
    const enabled = body.enabled !== false
    const archivePath = profileCordisPatchPath(aiRuntime) || aiRuntime.patchFile
    let text = ''
    try {
      text = await readFile(archivePath, 'utf8')
    } catch {
      text = ''
    }
    const existing = parseMcpPatchEntries(await readMcpArchiveText(aiRuntime))
    if (!existing.some((row) => row.serverName === serverName)) {
      sendError(response, 404, 'not_found', '未找到该 MCP 服务器', currentCorrelationId)
      return true
    }
    const next = upsertMcpDisabled(text, serverName, !enabled)
    await writeNormalizedPatch(archivePath, next)
    if (hostConnected(aiRuntime) && typeof aiRuntime.call === 'function') {
      const plugins = await listHostPlugins(aiRuntime)
      const fiber = mcpFiberFromPlugins(plugins, serverName)
      const pluginId = fiber?.entryId || fiber?.id || `mcp-${serverName}`
      try {
        await aiRuntime.call('pluginManager/setPluginEnabled', { id: pluginId, enabled })
      } catch (error) {
        console.warn('mcp setPluginEnabled failed', error)
      }
    }
    const bag = await collectBag(aiRuntime, 'mcp')
    const row = (Array.isArray(bag.raw?.mcp) ? bag.raw.mcp : []).find((item) => item && item.serverName === serverName)
    const confirmed = enabled
      ? Boolean(row && row.status === 'loaded')
      : Boolean(row && row.status === 'disabled')
    const connected = hostConnected(aiRuntime)
    sendJson(response, 200, {
      data: { serverName, enabled, needsRestart: !connected && !confirmed },
      note: confirmed ? (enabled ? '已启用' : '已停用') : (connected ? '已写入档案，核心将热更新' : '已写入档案，需重载核心生效'),
      correlationId: currentCorrelationId,
    })
    return true
  }

  const deleteMatch = url.pathname.match(/^\/api\/v1\/mcp\/servers\/([^/]+)$/)
  if (request.method === 'DELETE' && deleteMatch) {
    const serverName = decodeURIComponent(deleteMatch[1])
    const archivePath = profileCordisPatchPath(aiRuntime) || aiRuntime.patchFile
    let text = ''
    try {
      text = await readFile(archivePath, 'utf8')
    } catch {
      text = ''
    }
    const existing = parseMcpPatchEntries(await readMcpArchiveText(aiRuntime))
    if (!existing.some((row) => row.serverName === serverName)) {
      sendError(response, 404, 'not_found', '未找到该 MCP 服务器', currentCorrelationId)
      return true
    }
    if (hostConnected(aiRuntime) && typeof aiRuntime.call === 'function') {
      const plugins = await listHostPlugins(aiRuntime)
      const fiber = mcpFiberFromPlugins(plugins, serverName)
      if (fiber) {
        try {
          await aiRuntime.call('pluginManager/setPluginEnabled', { id: fiber.entryId || fiber.id, enabled: false })
        } catch (error) {
          console.warn('mcp disable before delete failed', error)
        }
      }
    }
    const next = removeMcpPatchEntry(text, serverName)
    await writeNormalizedPatch(archivePath, next)
    const connected = hostConnected(aiRuntime)
    sendJson(response, 200, {
      data: { serverName, needsRestart: !connected },
      note: connected ? '已从档案删除' : '已从档案删除，需重载核心生效',
      correlationId: currentCorrelationId,
    })
    return true
  }

  return false
}
