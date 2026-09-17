import { appendFile, readFile } from 'node:fs/promises'
import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { listBusinessConnections } from '../db.mjs'

const SERVER_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/u

export function parseMcpPatchEntries(text) {
  const entries = []
  const blocks = text.split(/\n(?=- id: mcp-)/u).filter((block) => block.includes('serverName:'))
  for (const block of blocks) {
    const serverName = block.match(/serverName:\s*([A-Za-z0-9_-]+)/u)?.[1]
    if (!serverName) continue
    const transportRaw = block.match(/transport:\s*(\S+)/u)?.[1] || 'stdio'
    const transport = transportRaw === 'streamable-http' ? 'streamable-http' : 'stdio'
    const commandMatch = block.match(/command:\s*(.+)$/mu)?.[1]
    const urlMatch = block.match(/url:\s*(\S+)/u)?.[1]
    let command = ''
    if (commandMatch) {
      try { command = JSON.parse(commandMatch.trim()) } catch { command = commandMatch.trim().replace(/^['"]|['"]$/g, '') }
    }
    const url = urlMatch ? urlMatch.replace(/^['"]|['"]$/g, '') : ''
    let headers = undefined
    const headersBlock = block.match(/headers:\s*\n((?:\s+.+\n?)+)/u)?.[1]
    if (headersBlock) {
      headers = {}
      for (const line of headersBlock.split('\n')) {
        const m = line.match(/^\s+([^:]+):\s*(.+)$/u)
        if (m) headers[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '')
      }
    }
    entries.push({ serverName, transport, command, url, headers })
  }
  return entries
}

async function pickAgentId(aiRuntime) {
  if (!aiRuntime.status().connected) return ''
  try {
    const listed = await aiRuntime.call('session/list', { _request: { includeBlank: false } })
    const sessions = listed?.sessions || listed?.items || []
    const first = Array.isArray(sessions) ? sessions[0] : null
    return first?.id || first?.sessionId || ''
  } catch (error) {
    console.warn('mcp tools projection session/list failed', error)
    return ''
  }
}

async function listMcpToolNames(aiRuntime, serverName) {
  const agentId = await pickAgentId(aiRuntime)
  if (!agentId) return []
  try {
    const commands = await aiRuntime.call('commands/list', { agentId })
    const names = []
    const rows = Array.isArray(commands) ? commands : commands?.commands || commands?.items || []
    for (const row of rows) {
      const name = typeof row === 'string' ? row : row?.name || row?.id || ''
      if (name.startsWith(`mcp__${serverName}__`)) names.push(name)
    }
    return names.sort()
  } catch (error) {
    console.warn('mcp tools projection commands/list failed', error)
    return []
  }
}

function mapServerStatus(connected, tools) {
  if (!connected) return 'configured'
  if (tools.length > 0) return 'live'
  return 'needs-reload'
}

export async function buildMcpServersV2(aiRuntime, patchText) {
  const connected = aiRuntime.status().connected
  const configured = parseMcpPatchEntries(patchText)
  const mcp = []
  for (const row of configured) {
    const tools = connected ? await listMcpToolNames(aiRuntime, row.serverName) : []
    mcp.push({
      serverName: row.serverName,
      transport: row.transport,
      ...(row.transport === 'streamable-http'
        ? { url: row.url, headers: row.headers || {} }
        : { command: row.command }),
      status: mapServerStatus(connected, tools),
      tools,
    })
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
  const catalogVersion = typeof state.catalogVersion === 'string'
    ? state.catalogVersion
    : (Array.isArray(state.catalog) && state.catalog[0]?.version ? String(state.catalog[0].version) : '')
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

export function validateServerName(serverName, existing) {
  if (!SERVER_NAME_RE.test(serverName)) return 'serverName 须为 1–32 位字母数字_-'
  if (existing.has(serverName)) return 'serverName 已存在'
  return ''
}

async function headHttp(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const timer = setTimeout(() => finish({ ok: false, error: 'timeout' }), timeoutMs)
    try {
      const target = new URL(url)
      const req = httpRequest({
        method: 'HEAD',
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: target.pathname + target.search,
        timeout: timeoutMs,
      }, (res) => {
        clearTimeout(timer)
        finish({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode })
      })
      req.on('error', (error) => {
        clearTimeout(timer)
        finish({ ok: false, error: error.message })
      })
      req.end()
    } catch (error) {
      clearTimeout(timer)
      finish({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  })
}

export async function checkMcpHealth(entry) {
  if (entry.transport === 'streamable-http') {
    if (!entry.url) return { ok: false, message: '缺少 url' }
    const result = await headHttp(entry.url)
    return result.ok
      ? { ok: true, message: 'HTTP 可达' }
      : { ok: false, message: result.error || `HTTP ${result.status || '失败'}` }
  }
  const command = entry.command
  if (!command) return { ok: false, message: '缺少 command' }
  try {
    await access(command, constants.X_OK)
    return { ok: true, message: '命令可执行' }
  } catch {
    return { ok: false, message: '命令不可执行或不存在' }
  }
}

function buildMcpPatchBlock({ serverName, transport, commandLine, url, headers }) {
  if (transport === 'streamable-http') {
    const headerLines = headers && Object.keys(headers).length
      ? ['    headers:']
      : []
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        headerLines.push(`      ${key}: ${JSON.stringify(String(value))}`)
      }
    }
    return [
      '',
      `- id: mcp-${serverName}`,
      '  package: @deepseek-ai/dsh-mcp-client',
      '  config:',
      '    transport: streamable-http',
      `    serverName: ${serverName}`,
      `    url: ${JSON.stringify(url)}`,
      ...headerLines,
      '',
    ].join('\n')
  }
  const parts = commandLine.split(/\s+/u)
  const command = parts[0]
  const args = parts.slice(1)
  return [
    '',
    `- id: mcp-${serverName}`,
    '  package: @deepseek-ai/dsh-mcp-client',
    '  config:',
    '    transport: stdio',
    `    serverName: ${serverName}`,
    `    command: ${JSON.stringify(command)}`,
    `    args: ${JSON.stringify(args)}`,
    '',
  ].join('\n')
}

export async function handleMcpRoutes(request, response, url, ctx) {
  const { aiRuntime, db, currentCorrelationId, sendJson, sendError, readJson } = ctx

  if (request.method === 'GET' && url.pathname === '/api/v1/mcp/servers') {
    let text = ''
    try {
      text = await readFile(aiRuntime.patchFile, 'utf8')
    } catch {
      text = ''
    }
    const mcp = await buildMcpServersV2(aiRuntime, text)
    const connectors = await buildConnectors(db, aiRuntime)
    sendJson(response, 200, { data: { mcp, connectors }, correlationId: currentCorrelationId })
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/mcp/health') {
    let text = ''
    try {
      text = await readFile(aiRuntime.patchFile, 'utf8')
    } catch {
      text = ''
    }
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
    let text = ''
    try {
      text = await readFile(aiRuntime.patchFile, 'utf8')
    } catch {
      text = ''
    }
    const existing = new Set(parseMcpPatchEntries(text).map((row) => row.serverName))
    const nameError = validateServerName(serverName, existing)
    if (nameError) {
      sendError(response, 400, 'validation_error', nameError, currentCorrelationId)
      return true
    }
    if (transport === 'streamable-http') {
      const urlValue = typeof body.url === 'string' ? body.url.trim() : ''
      if (!urlValue) {
        sendError(response, 400, 'validation_error', 'streamable-http 需要 url', currentCorrelationId)
        return true
      }
      const headers = body.headers && typeof body.headers === 'object' ? body.headers : undefined
      await appendFile(aiRuntime.patchFile, buildMcpPatchBlock({ serverName, transport, url: urlValue, headers }), 'utf8')
    } else {
      const commandLine = typeof body.command === 'string' ? body.command.trim() : ''
      if (!commandLine) {
        sendError(response, 400, 'validation_error', 'stdio 需要 command', currentCorrelationId)
        return true
      }
      await appendFile(aiRuntime.patchFile, buildMcpPatchBlock({ serverName, transport, commandLine }), 'utf8')
    }
    sendJson(response, 201, {
      data: { serverName, needsRestart: true },
      note: '已写入配置，需重载核心生效',
      correlationId: currentCorrelationId,
    })
    return true
  }

  return false
}
