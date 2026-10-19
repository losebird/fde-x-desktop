const { randomBytes, timingSafeEqual } = require('node:crypto')
const { existsSync, mkdirSync, writeFileSync } = require('node:fs')
const { mkdir, readdir, readFile, writeFile } = require('node:fs/promises')
const { createRequire } = require('node:module')
const { homedir } = require('node:os')
const { join } = require('node:path')

const SKIP_SESSION_FILES = new Set(['session.lock'])
const PREFIX = '/fde-session'
const sessions = new Map()
let bridgeCtx = null

function sessionIds(agent) {
  const header = agent.session && agent.session.header
  return [agent.id, agent.session && agent.session.id, header && header.id]
}

function rememberAgent(agent) {
  if (!agent) return
  for (const id of sessionIds(agent)) {
    if (typeof id === 'string' && id) sessions.set(id, agent)
  }
}

function forgetAgent(agent) {
  if (!agent) return
  for (const id of sessionIds(agent)) sessions.delete(id)
}

function sessionRoot() {
  return process.env.FDE_DSH_SESSION_ROOT || join(process.env.DSH_HOME || join(homedir(), '.dsh-fde-x'), 'sessions')
}

function safeName(name) {
  const s = String(name || '').trim()
  if (!s || s.includes('..') || s.includes('/') || s.includes('\\') || s.includes('\0')) return ''
  if (SKIP_SESSION_FILES.has(s) || s.startsWith('.')) return ''
  return s
}

function json(res, code, body) {
  const raw = Buffer.from(JSON.stringify(body))
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'content-length': raw.length })
  res.end(raw)
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

async function findSessionDir(sessionId) {
  const id = String(sessionId || '').trim()
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\') || id.includes('\0')) return ''
  const walk = async (dir, depth) => {
    if (depth > 3) return ''
    let entries = []
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return ''
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === id) return join(dir, entry.name)
      const nested = await walk(join(dir, entry.name), depth + 1)
      if (nested) return nested
    }
    return ''
  }
  return walk(sessionRoot(), 0)
}

async function readBundle(sessionId) {
  const dir = await findSessionDir(sessionId)
  if (!dir) throw new Error('找不到这个会话文件')
  const names = await readdir(dir)
  const files = []
  for (const name of names) {
    const safe = safeName(name)
    if (!safe) continue
    const buf = await readFile(join(dir, safe))
    files.push({ name: safe, size: buf.length, data: buf.toString('base64') })
  }
  if (!files.length) throw new Error('这个会话还没有可交接的文件')
  return { sessionId, files }
}

async function writeBundle(dir, files) {
  await mkdir(dir, { recursive: true })
  for (const file of Array.isArray(files) ? files : []) {
    const name = safeName(file && file.name)
    if (!name) continue
    const buf = Buffer.from(String((file && file.data) || ''), 'base64')
    if (!buf.length) continue
    await writeFile(join(dir, name), buf)
  }
}

function bridgeTokenPath() {
  return join(dshHome(), 'run', 'bridge.token')
}

function sameToken(left, right) {
  const a = Buffer.from(String(left || ''))
  const b = Buffer.from(String(right || ''))
  if (!a.length || a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function headerToken(req) {
  const raw = req.headers && req.headers['x-fde-bridge-token']
  if (typeof raw === 'string') return raw.trim()
  if (Array.isArray(raw)) return String(raw[0] || '').trim()
  return ''
}

function textFromToolResult(result) {
  const blocks = result && Array.isArray(result.content) ? result.content : []
  const parts = []
  for (const block of blocks) {
    if (block && block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  if (parts.length) return parts.join('\n')
  if (result && typeof result.value === 'string') return result.value
  if (result && result.value != null) return JSON.stringify(result.value)
  return ''
}

function createFdeSessionHandler(ctx) {
  return async function handler(req, res) {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const path = url.pathname.slice(PREFIX.length) || '/'
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    try {
      if (req.method === 'GET' && path === '/visible-tools') {
        const sessionId = url.searchParams.get('sessionId') || ''
        const agent = sessions.get(sessionId)
        if (!bridgeCtx || !agent || !bridgeCtx.tools || typeof bridgeCtx.tools.schemas !== 'function') {
          json(res, 404, { ok: false, error: 'session_tools_unavailable' })
          return
        }
        const tools = bridgeCtx.tools.schemas(agent).map((row) => row.name).sort()
        json(res, 200, { ok: true, tools })
        return
      }
      if (req.method === 'POST' && path === '/mcp/call') {
        let expected = ''
        try {
          expected = String(await readFile(bridgeTokenPath(), 'utf8')).trim()
        } catch (error) {
          if (!error || error.code !== 'ENOENT') throw error
        }
        if (!sameToken(headerToken(req), expected)) {
          json(res, 401, { ok: false, error: 'bridge_unauthorized' })
          return
        }
        const body = await readBody(req, 1024 * 1024)
        const name = String(body.name || '').trim()
        if (!name.startsWith('mcp__')) {
          json(res, 403, { ok: false, error: 'tool_not_allowed' })
          return
        }
        const tool = ctx.tools.get(name)
        if (!tool) {
          json(res, 403, { ok: false, error: 'tool_not_registered' })
          return
        }
        const args = body.args && typeof body.args === 'object' && !Array.isArray(body.args) ? body.args : {}
        const result = await ctx.tools.execute({
          callId: `mcp_${randomBytes(8).toString('hex')}`,
          name,
          arguments: args,
          signal: new AbortController().signal,
        })
        if (result.isError) {
          json(res, 200, { ok: false, error: result.error.message })
          return
        }
        json(res, 200, { ok: true, text: textFromToolResult(result) })
        return
      }
      if (req.method === 'GET' && path === '/export') {
        const sessionId = url.searchParams.get('sessionId') || ''
        const bundle = await readBundle(sessionId)
        json(res, 200, { ok: true, ...bundle })
        return
      }
      if (req.method === 'POST' && path === '/restore') {
        const body = await readBody(req, 32 * 1024 * 1024)
        const rows = Array.isArray(body.sessions) ? body.sessions : []
        if (!rows.length) {
          json(res, 400, { ok: false, error: '交接包里没有可复原的会话文件' })
          return
        }
        json(res, 400, { ok: false, error: '请用工作台复原接口；导出已可用' })
        return
      }
      json(res, 404, { ok: false, error: 'not_found' })
    } catch (error) {
      json(res, 400, { ok: false, error: error instanceof Error ? error.message : '失败' })
    }
  }
}

function dshHome() {
  return process.env.FDE_DSH_HOME || process.env.DSH_HOME || join(homedir(), '.dsh-fde-x')
}

function writeBridgeToolsStatus(payload) {
  const dir = join(dshHome(), 'run')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'bridge-tools.json'), `${JSON.stringify(payload)}\n`)
}

function loadDshTools() {
  const seeds = []
  if (require.main && require.main.filename) seeds.push(require.main.filename)
  if (process.argv[1]) seeds.push(process.argv[1])
  let last
  for (const seed of seeds) {
    try {
      return createRequire(seed)('@deepseek-ai/dsh-tools')
    } catch (error) {
      last = error
    }
  }
  throw last || new Error('cannot resolve @deepseek-ai/dsh-tools')
}

function loadSchemastery() {
  const seeds = []
  if (require.main && require.main.filename) seeds.push(require.main.filename)
  const hostTools = join(__dirname, '..', '..', '.host-generation', 'node_modules', '@deepseek-ai', 'dsh-tools', 'package.json')
  if (existsSync(hostTools)) seeds.push(hostTools)
  for (const seed of seeds) {
    try {
      return createRequire(seed)('@deepseek-ai/schemastery')
    } catch (error) {
      if (!error || error.code !== 'MODULE_NOT_FOUND') throw error
    }
  }
  return null
}

function volatileField(schema) {
  if (schema && typeof schema.volatile === 'function' && !(schema.meta && schema.meta.volatile)) return schema.volatile()
  if (schema && schema.meta) schema.meta.volatile = true
  return schema
}

function bridgeConfigSchema() {
  const z = loadSchemastery()
  if (!z) return null
  const { STANDARD_DENY_SERVERS } = require('../../mode-policy.cjs')
  return z.object({
    standardDenyServers: volatileField(z.array(z.string()).default(STANDARD_DENY_SERVERS.slice())),
    briefingDenyUserMcp: volatileField(z.boolean().default(true)),
  })
}

const Config = bridgeConfigSchema()

function installIuiModeGate(ctx, config) {
  const {
    presetFromAgent,
    gatePromptAssembly,
    gatePreStepDecision,
    resumePastIuiHtmlDeny,
    deniedMcpServer,
    resolveMcpMount,
  } = require('../../mode-policy.cjs')
  if (!ctx || typeof ctx.on !== 'function') {
    throw new Error('IUI mode gate requires ctx.on')
  }
  const mountOf = () => resolveMcpMount(config)
  const { applyMcpCatalog } = require('./mcp-catalog.js')
  const { toolSessionId } = require('./tools.js')
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    const preset = presetFromAgent(context && context.agent)
    const gated = gatePromptAssembly(assembled, preset, mountOf())
    return applyMcpCatalog(gated, toolSessionId({ agent: context && context.agent }))
  }, true)
  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    return gatePreStepDecision(decision, presetFromAgent(payload && payload.agent))
  }, true)
  ctx.on('tools/pre-execute', async (exec, next) => {
    const preset = presetFromAgent(exec && exec.agent)
    const server = deniedMcpServer(exec && exec.name, preset, mountOf())
    if (server) return { kind: 'deny', reason: `MCP 服务 ${server} 未挂到预设 ${preset}` }
    const decision = await next()
    if (resumePastIuiHtmlDeny(decision, preset)) return next()
    return decision
  }, true)
}

function apply(ctx, config) {
  if (Config && Config.dict) {
    for (const field of Object.values(Config.dict)) {
      if (field && field.meta) field.meta.volatile = true
    }
  }
  installIuiModeGate(ctx, config)
  if (ctx.webServer && typeof ctx.webServer.register === 'function') {
    ctx.effect(() => ctx.webServer.register({
      kind: 'prefix',
      path: PREFIX,
      handler: createFdeSessionHandler(ctx),
    }))
  }
  try {
    const { defineTool } = loadDshTools()
    const { registerTools, FDE_TOOL_NAMES } = require('./tools.js')
    const { installWorkflowToolLimit } = require('./workflow-limit.js')
    registerTools(ctx, { defineTool, config })
    installWorkflowToolLimit(ctx)
    writeBridgeToolsStatus({ ok: true, tools: FDE_TOOL_NAMES, workflowLimit: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    writeBridgeToolsStatus({ ok: false, error: message })
    if (ctx.logger && typeof ctx.logger.error === 'function') {
      ctx.logger.error(`[fde-x-dsh-bridge] tools: ${message}`)
    } else {
      console.error(`[fde-x-dsh-bridge] tools: ${message}`)
    }
  }
  bridgeCtx = ctx
  ctx.on('agent/created', (event) => {
    rememberAgent(event && event.agent)
  })
  ctx.on('agent/disposed', (event) => {
    forgetAgent(event && event.agent)
  })
}

module.exports = { apply, installIuiModeGate, createFdeSessionHandler, inject: ['webServer', 'tools'] }
exports.apply = apply
exports.installIuiModeGate = installIuiModeGate
exports.createFdeSessionHandler = createFdeSessionHandler
exports.inject = ['webServer', 'tools']
if (Config) {
  module.exports.Config = Config
  exports.Config = Config
}
