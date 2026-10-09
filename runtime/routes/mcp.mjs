import { readFile } from 'node:fs/promises'
import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { delimiter, join } from 'node:path'
import { listBusinessConnections } from '../db.mjs'
import { FDE_AI_WORKSPACE, FDE_RESOURCES } from '../config.mjs'
import { desktopProcessPath } from '../desktop-process-path.mjs'
import { loadBizVocab, vocabCatalogVersion } from '../biz/vocab-sheet.mjs'
import { collectBag } from '../catalog-collect.mjs'
import { resolvePrimarySessionForRuntime } from '../session-primary.mjs'
import {
  parseMcpPatchEntries,
  profileCordisPatchPath,
  readMcpArchiveText,
  removeMcpPatchEntry,
  upsertMcpDisabled,
  upsertMcpPatchEntry,
  mcpFingerprintMatches,
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

export function mapServerStatus({ connected, disabled, fiberPhase, fiberEnabled, fingerprintMatch }) {
  if (disabled) {
    if (!connected) return 'disabled'
    if (fiberEnabled === false || !fiberPhase) return 'disabled'
    return 'needs-reload'
  }
  if (!connected) return 'configured'
  if (fingerprintMatch === false) return 'needs-reload'
  if (fiberEnabled === false) return 'needs-reload'
  if (fiberPhase === 'failed') return 'failed'
  if (fiberPhase === 'active') return 'loaded'
  return 'needs-reload'
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
  const snapshot = aiRuntime && aiRuntime.mcpLoadedSnapshot
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
        fingerprintMatch: mcpFingerprintMatches(row, snapshot),
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

function commandArgsSuffix(entry) {
  return Array.isArray(entry.args) && entry.args.length ? ` ${entry.args.join(' ')}` : ''
}

export async function checkMcpHealth(entry) {
  if (entry.transport === 'streamable-http') {
    if (!entry.url) return { ok: false, message: '缺少 url' }
    return probeMcpInitialize(entry)
  }
  const command = String(entry.command || '').trim()
  if (!command) return { ok: false, message: '缺少 command' }
  const absolute = command.startsWith('/') || /^[A-Za-z]:[\\/]/.test(command)
  if (absolute) {
    try {
      await access(command, constants.X_OK)
      return { ok: true, message: `可执行 ${command}${commandArgsSuffix(entry)}` }
    } catch {
      try {
        await access(command, constants.F_OK)
        return { ok: false, message: `不可执行 ${command}` }
      } catch {
        return { ok: false, message: `找不到文件 ${command}` }
      }
    }
  }
  const resolved = await resolveExecutable(command)
  if (!resolved) return { ok: false, message: `PATH 里找不到 ${command}` }
  return { ok: true, message: `可执行 ${resolved}${commandArgsSuffix(entry)}` }
}

export async function handleMcpRoutes(request, response, url, ctx) {
  const { aiRuntime, db, currentCorrelationId, sendJson, sendError, readJson } = ctx

  if (request.method === 'GET' && url.pathname === '/api/v1/mcp/recipes') {
    const { listMcpRecipes } = await import('../mcp-recipes.mjs')
    sendJson(response, 200, { data: { recipes: listMcpRecipes() }, correlationId: currentCorrelationId })
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
      entry = { serverName, transport, command, args, env }
    }
    await writeNormalizedPatch(archivePath, upsertMcpPatchEntry(text, entry))
    sendJson(response, existed ? 200 : 201, {
      data: { serverName, needsRestart: true },
      note: '已写入配置，需重载核心生效',
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
    await writeNormalizedPatch(archivePath, upsertMcpDisabled(text, serverName, !enabled))
    if (aiRuntime.status().connected && typeof aiRuntime.call === 'function') {
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
    sendJson(response, 200, {
      data: { serverName, enabled, needsRestart: !confirmed },
      note: confirmed ? (enabled ? '已启用' : '已停用') : '已写入档案，需重载核心生效',
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
    if (aiRuntime.status().connected && typeof aiRuntime.call === 'function') {
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
    await writeNormalizedPatch(archivePath, removeMcpPatchEntry(text, serverName))
    sendJson(response, 200, {
      data: { serverName, needsRestart: true },
      note: '已从档案删除，需重载核心生效',
      correlationId: currentCorrelationId,
    })
    return true
  }

  return false
}
