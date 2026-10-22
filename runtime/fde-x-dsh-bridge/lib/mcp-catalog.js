const { readdir, readFile } = require('node:fs/promises')
const { homedir } = require('node:os')
const { join } = require('node:path')
const { promisify } = require('node:util')
const { deniedServer, mcpServerName } = require('../../mode-policy.cjs')

const loadedBySession = new Map()
const restoring = new Map()
const knownServers = new Map()

function sessionRoot() {
  return process.env.FDE_DSH_SESSION_ROOT || join(process.env.DSH_HOME || join(homedir(), '.dsh-fde-x'), 'sessions')
}

function rememberTools(tools) {
  for (const tool of tools) {
    const server = mcpServerName(tool && tool.name)
    if (!server) continue
    let bucket = knownServers.get(server)
    if (!bucket) {
      bucket = new Map()
      knownServers.set(server, bucket)
    }
    bucket.set(tool.name, tool)
  }
}

function serverFromArguments(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value
  if (!parsed || typeof parsed !== 'object') return ''
  return String(parsed.server || '').trim()
}

function serversFromEvent(event) {
  const servers = []
  if (!event || typeof event !== 'object') return servers
  if (event.type === 'tool/call' && event.data && event.data.name === 'fde_mcp_load') {
    const server = serverFromArguments(event.data.arguments)
    if (server) servers.push(server)
  }
  const content = event.type === 'assistant/message'
    && event.data
    && event.data.message
    && event.data.message.content
  if (!Array.isArray(content)) return servers
  for (const block of content) {
    if (!block || block.type !== 'tool-call' || block.name !== 'fde_mcp_load') continue
    const server = serverFromArguments(block.arguments)
    if (server) servers.push(server)
  }
  return servers
}

function serversFromLog(text) {
  const servers = []
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue
    servers.push(...serversFromEvent(JSON.parse(line)))
  }
  return servers
}

async function textFromZstd(buf) {
  const { zstdDecompress } = require('node:zlib')
  const { scanZstdFrames } = await import('../../session-tree.mjs')
  const decompress = promisify(zstdDecompress)
  const frames = scanZstdFrames(buf)
  const parts = []
  for (const frame of frames) {
    const raw = await decompress(buf.subarray(frame.start, frame.end))
    parts.push(raw.toString('utf8'))
  }
  return parts.join('')
}

async function readLoadedServers(sessionId) {
  const { findSessionDir, isSessionLogName } = await import('../../session-tree.mjs')
  const dir = await findSessionDir(sessionRoot(), sessionId)
  if (!dir) return []
  const names = (await readdir(dir)).filter((name) => isSessionLogName(name))
  const servers = []
  for (const name of names) {
    const buf = await readFile(join(dir, name))
    const text = name.endsWith('.zstd') ? await textFromZstd(buf) : buf.toString('utf8')
    servers.push(...serversFromLog(text))
  }
  return servers
}

async function sessionLoaded(sessionId) {
  if (!sessionId) return new Set()
  const existing = loadedBySession.get(sessionId)
  if (existing) return existing
  let pending = restoring.get(sessionId)
  if (!pending) {
    pending = readLoadedServers(sessionId).then((servers) => {
      restoring.delete(sessionId)
      const raced = loadedBySession.get(sessionId)
      if (raced) {
        for (const server of servers) raced.add(server)
        return raced
      }
      const set = new Set(servers)
      loadedBySession.set(sessionId, set)
      return set
    }, (error) => {
      restoring.delete(sessionId)
      throw error
    })
    restoring.set(sessionId, pending)
  }
  return pending
}

function catalogText(tools) {
  const lines = ['MCP 目录。调用 fde_mcp_load({server}) 后，下一步才能用真名。']
  for (const tool of tools) {
    const server = mcpServerName(tool.name)
    const local = String(tool.name).slice(`mcp__${server}__`.length)
    const description = String(tool.description || '').split('\n')[0].trim().slice(0, 120)
    lines.push(`${server} / ${local} / ${description}`)
  }
  return lines.join('\n')
}

async function applyMcpCatalog(assembly, sessionId) {
  if (!assembly || typeof assembly !== 'object' || !Array.isArray(assembly.tools)) return assembly
  const mcp = []
  const rest = []
  for (const tool of assembly.tools) {
    if (tool && mcpServerName(tool.name)) mcp.push(tool)
    else rest.push(tool)
  }
  rememberTools(mcp)
  const loaded = await sessionLoaded(sessionId)
  const kept = []
  const catalog = []
  for (const tool of mcp) {
    if (loaded.has(mcpServerName(tool.name))) kept.push(tool)
    else catalog.push(tool)
  }
  const tools = rest.concat(kept)
  if (catalog.length === 0) return { ...assembly, tools }
  const sections = (Array.isArray(assembly.sections) ? assembly.sections : []).concat({
    name: 'fde:mcp-catalog',
    text: catalogText(catalog),
    interpolate: false,
  })
  return { ...assembly, tools, sections }
}

async function loadMcpServer({ sessionId, server, preset, mount }) {
  const name = String(server || '').trim()
  if (!sessionId) throw new Error('fde_mcp_load 没有会话')
  const denied = deniedServer(name, preset, mount, sessionId)
  if (denied) throw new Error(`MCP 服务 ${denied} 未挂到预设 ${preset}`)
  const loaded = await sessionLoaded(sessionId)
  if (!name || !knownServers.has(name)) throw new Error(`MCP 服务 ${name} 不在目录里`)
  loaded.add(name)
  return [...knownServers.get(name).keys()]
}

module.exports = {
  applyMcpCatalog,
  loadMcpServer,
}
