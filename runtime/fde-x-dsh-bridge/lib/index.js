const { randomBytes, randomUUID, timingSafeEqual } = require('node:crypto')
const { request: httpRequest } = require('node:http')
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs')
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
      if (req.method === 'GET' && path === '/preset-inventory') {
        const presets = bridgeCtx && bridgeCtx.get('agentPresets')
        if (!presets || typeof presets.compositionInventory !== 'function') {
          json(res, 400, { ok: false, error: 'preset_inventory_unavailable' })
          return
        }
        const rows = await presets.compositionInventory()
        json(res, 200, {
          ok: true,
          presets: rows.map((row) => ({
            id: row.id,
            name: typeof row.name === 'string' && row.name ? row.name : row.id,
          })),
        })
        return
      }
      if (req.method === 'GET' && path === '/preset-snapshot') {
        const sessionId = url.searchParams.get('sessionId') || ''
        const agent = sessions.get(sessionId)
        if (!bridgeCtx || !agent || !bridgeCtx.tools || typeof bridgeCtx.tools.schemas !== 'function') {
          json(res, 404, { ok: false, error: 'session_tools_unavailable' })
          return
        }
        const tools = bridgeCtx.tools.schemas(agent).map((row) => {
          const definition = bridgeCtx.tools.get(row.name, agent)
          return { name: row.name, readOnly: explicitReadOnly(definition) }
        }).sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
        json(res, 200, { ok: true, tools, persona: personaSection(agent) })
        return
      }
      if (req.method === 'GET' && path === '/visible-tools') {
        const sessionId = url.searchParams.get('sessionId') || ''
        const agent = sessions.get(sessionId)
        if (!bridgeCtx || !agent || !bridgeCtx.tools || typeof bridgeCtx.tools.schemas !== 'function') {
          json(res, 404, { ok: false, error: 'session_tools_unavailable' })
          return
        }
        const tools = bridgeCtx.tools.schemas(agent).map((row) => row.name).sort()
        json(res, 200, { ok: true, tools, approval: sessionApproval(agent) })
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
        const viewer = sessions.get(String(body.sessionId || '').trim())
          || [...sessions.values()].find(Boolean)
        const tool = (viewer && ctx.tools.get(name, viewer)) || ctx.tools.get(name)
        if (!tool) {
          json(res, 403, { ok: false, error: 'tool_not_registered' })
          return
        }
        const args = body.args && typeof body.args === 'object' && !Array.isArray(body.args) ? body.args : {}
        const result = await ctx.tools.execute({
          callId: `mcp_bridge_${randomBytes(8).toString('hex')}`,
          name,
          arguments: args,
          signal: new AbortController().signal,
          fdeBridge: true,
          ...(viewer ? { agent: viewer } : {}),
        })
        if (result.isError) {
          json(res, 200, { ok: false, error: result.error.message })
          return
        }
        json(res, 200, { ok: true, text: textFromToolResult(result) })
        return
      }
      if (req.method === 'GET' && path === '/tool-catalog') {
        const sessionId = url.searchParams.get('sessionId') || ''
        const agent = sessions.get(sessionId)
        const header = agent && agent.session && agent.session.header
        const preset = header && header.agentPreset
        if (!bridgeCtx || !agent || preset !== 'standard' || !bridgeCtx.tools || typeof bridgeCtx.tools.schemas !== 'function') {
          json(res, 404, { ok: false, error: 'session_tools_unavailable' })
          return
        }
        const view = bridgeCtx.tools.view(agent)
        const tools = bridgeCtx.tools.schemas(agent).map((row) => {
          const definition = bridgeCtx.tools.get(row.name, agent)
          return {
            name: row.name,
            readOnly: explicitReadOnly(definition),
            grantable: Boolean(view && view.restrictableNames && view.restrictableNames.has(row.name)),
          }
        }).sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
        json(res, 200, { ok: true, tools })
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
      if (req.method === 'POST' && path === '/wrote-followup') {
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
        const body = await readBody(req, 256 * 1024)
        const sessionId = String(body.sessionId || '').trim()
        const text = String(body.text || '').trim()
        if (!sessionId || !text) {
          json(res, 400, { ok: false, error: 'sessionId_and_text_required' })
          return
        }
        const agent = sessions.get(sessionId)
        if (!agent || typeof agent.followup !== 'function') {
          json(res, 404, { ok: false, error: 'session_agent_unavailable' })
          return
        }
        const content = [{ type: 'text', text }]
        const source = { kind: 'dsh-lan-assist', form: 'wrote' }
        let message
        try {
          const llm = require('@deepseek-ai/dsh-llm')
          const create = llm.createUserMessage || (llm.default && llm.default.createUserMessage)
          if (typeof create === 'function') message = create({ content, source })
        } catch { /* fall through */ }
        if (!message || typeof message.id !== 'string' || !message.id) {
          message = { role: 'user', id: randomUUID(), content, source }
        }
        agent.followup(message)
        json(res, 200, { ok: true })
        return
      }
      json(res, 404, { ok: false, error: 'not_found' })
    } catch (error) {
      json(res, 400, { ok: false, error: error instanceof Error ? error.message : '失败' })
    }
  }
}

function personaSection(agent) {
  const prompt = agent && agent.ctx && agent.ctx.systemPrompt
  if (!prompt || !prompt.layers) return null
  const layers = []
  if (prompt.layers.global) layers.push(prompt.layers.global)
  if (typeof prompt.layers.chainLayers === 'function') layers.push(...prompt.layers.chainLayers(agent))
  let section = null
  for (const layer of layers) {
    const table = layer && layer.sections
    const found = table && typeof table.get === 'function' ? table.get('deployment:persona-prefix') : null
    if (!found || found.workflowAllow === true || typeof found.text !== 'string' || !found.text) continue
    section = found
  }
  if (!section) return null
  return { text: section.text, complete: section.complete === true }
}

function explicitReadOnly(definition) {
  if (!definition || typeof definition !== 'object') return false
  if (definition.readOnly === true) return true
  const annotations = definition.annotations
  return Boolean(annotations && annotations.readOnlyHint === true)
}

function sessionApproval(agent) {
  const presets = bridgeCtx.get('permissionPresets')
  if (!presets || typeof presets.current !== 'function') return 'ask'
  return presets.current(agent.session) === 'danger-full-access' ? 'never' : 'ask'
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
    mcpServerName,
    resolveMcpMount,
  } = require('../../mode-policy.cjs')
  if (!ctx || typeof ctx.on !== 'function') {
    throw new Error('IUI mode gate requires ctx.on')
  }
  const mountOf = () => resolveMcpMount(config)
  const { applyMcpCatalog, sessionLoaded } = require('./mcp-catalog.js')
  const { toolSessionId } = require('./tools.js')
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    const agent = context && context.agent
    const preset = presetFromAgent(agent)
    const sessionId = toolSessionId({ agent })
    const gated = gatePromptAssembly(assembled, preset, mountOf(), sessionId)
    return applyMcpCatalog(gated, sessionId)
  }, true)
  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    return gatePreStepDecision(decision, presetFromAgent(payload && payload.agent), payload && payload.agent)
  }, true)
  ctx.on('tools/pre-execute', async (exec, next) => {
    const preset = presetFromAgent(exec && exec.agent)
    const sessionId = toolSessionId(exec)
    const denied = deniedMcpServer(exec && exec.name, preset, mountOf(), sessionId)
    if (denied) return { kind: 'deny', reason: `MCP 服务 ${denied} 未挂到预设 ${preset}` }
    const server = mcpServerName(exec && exec.name)
    const official = Boolean(exec && exec.fdeBridge)
      || String(exec && exec.callId || '').startsWith('mcp_bridge_')
    if (server && sessionId && !official) {
      const loaded = await sessionLoaded(sessionId)
      if (!loaded.has(server)) return { kind: 'deny', reason: `MCP 服务 ${server} 未加载` }
    }
    const decision = await next()
    if (resumePastIuiHtmlDeny(decision, preset)) return next()
    return decision
  }, true)
  ctx.on('session/event', (session, event) => {
    if (!event || event.type !== 'turn/end') return
    const reason = event.data && event.data.reason
    const kind = reason && typeof reason.kind === 'string' ? reason.kind : 'completed'
    if (kind && kind !== 'completed') return
    const sessionId = session && (session.id || session.sessionId || (session.header && (session.header.id || session.header.sessionId)))
    if (!sessionId) return
    const title = String((session && (session.title || session.name)) || '').trim()
    const cwd = String((session && session.cwd) || process.env.FDE_AI_WORKSPACE || '').trim()
    postSessionTurnEnd(sessionId, title, cwd)
  })
}

function postSessionTurnEnd(sessionId, title, cwd) {
  const port = process.env.FDE_RUNTIME_PORT || '4318'
  const home = process.env.DSH_HOME || join(homedir(), '.dsh-fde-x')
  let token = ''
  try {
    token = readFileSync(join(home, '.ui-token'), 'utf8').trim()
  } catch {
    token = ''
  }
  const payload = JSON.stringify({ sessionId, title, cwd })
  const req = httpRequest({
    hostname: '127.0.0.1',
    port: Number(port),
    path: '/api/v1/ai/turn-end',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
      ...(token ? { 'x-fde-ui-token': token } : {}),
      Origin: 'http://127.0.0.1:5174',
    },
  }, (res) => { res.resume() })
  req.on('error', () => undefined)
  req.end(payload)
}

function registerSemanticOsHttpTools(ctx) {
  const root = process.env.FDE_SEMANTIC_OS_ROOT
  if (!root) return Promise.resolve()
  const { pathToFileURL } = require('node:url')
  const { defineTool } = loadDshTools()
  return import(pathToFileURL(join(root, 'tools.js')).href).then(async (mod) => {
    const { createHttpSidecar } = await import(pathToFileURL(join(root, 'sidecar-client.js')).href)
    const port = process.env.FDE_RUNTIME_PORT || '4318'
    const sidecar = createHttpSidecar(`http://127.0.0.1:${port}/semantic-os`)
    const writes = { mark() {} }
    mod.registerTools(ctx, { defineTool }, sidecar, writes, null, {
      getPersistence: () => null,
      getExtract: () => null,
    })
  })
}

function registerLanAssistHttpTools(ctx) {
  const root = process.env.FDE_LAN_ASSIST_ROOT
  if (!root) return Promise.resolve()
  const { pathToFileURL } = require('node:url')
  const { defineTool } = loadDshTools()
  return import(pathToFileURL(join(root, 'tools.js')).href).then((mod) => {
    const port = process.env.FDE_RUNTIME_PORT || '4318'
    const secretary = mod.createHttpSecretary(`http://127.0.0.1:${port}/lan-assist`)
    mod.registerTools(ctx, { defineTool }, secretary, {
      noteToolSheet: () => ({ emit: false }),
      notePostSettledHopTool: () => undefined,
    })
  })
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
    require('./briefing-allow.js').sweepBriefingAllow()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('briefing_allow_sweep_failed', message)
  }
  try {
    const { defineTool } = loadDshTools()
    const { registerTools, FDE_TOOL_NAMES } = require('./tools.js')
    const { installWorkflowToolLimit } = require('./workflow-limit.js')
    registerTools(ctx, { defineTool, config })
    installWorkflowToolLimit(ctx)
    writeBridgeToolsStatus({ ok: true, tools: FDE_TOOL_NAMES, workflowLimit: true })
    void registerLanAssistHttpTools(ctx).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      if (ctx.logger && typeof ctx.logger.warn === 'function') ctx.logger.warn(`[fde-x-dsh-bridge] lan-assist tools: ${message}`)
      else console.warn(`[fde-x-dsh-bridge] lan-assist tools: ${message}`)
    })
    void registerSemanticOsHttpTools(ctx).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      if (ctx.logger && typeof ctx.logger.warn === 'function') ctx.logger.warn(`[fde-x-dsh-bridge] semantic-os tools: ${message}`)
      else console.warn(`[fde-x-dsh-bridge] semantic-os tools: ${message}`)
    })
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
    const agent = event && event.agent
    forgetAgent(agent)
    const { discardBriefingAllow } = require('./briefing-allow.js')
    const session = agent && agent.session
    const header = session && session.header
    const ids = [
      session && session.sessionId,
      session && session.id,
      header && header.sessionId,
      header && header.id,
      agent && agent.id,
    ]
    for (const id of ids) {
      if (typeof id === 'string' && id) discardBriefingAllow(id)
    }
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
