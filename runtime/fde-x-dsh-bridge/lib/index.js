const { mkdirSync, writeFileSync } = require('node:fs')
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

async function handler(req, res) {
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
      json(res, 200, { ok: true, tools, approval: sessionApproval(agent) })
      return
    }
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
    json(res, 404, { ok: false, error: 'not_found' })
  } catch (error) {
    json(res, 400, { ok: false, error: error instanceof Error ? error.message : '失败' })
  }
}

function personaSection(agent) {
  const prompt = agent && agent.ctx && agent.ctx.systemPrompt
  if (!prompt || !prompt.layers || typeof prompt.layers.merge !== 'function') return null
  const merged = prompt.layers.merge(agent, (layer) => layer.sections)
  const section = merged && typeof merged.get === 'function' ? merged.get('deployment:persona-prefix') : null
  if (!section || typeof section.text !== 'string' || !section.text) return null
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

function apply(ctx) {
  if (ctx.webServer && typeof ctx.webServer.register === 'function') {
    ctx.effect(() => ctx.webServer.register({
      kind: 'prefix',
      path: PREFIX,
      handler,
    }))
  }
  try {
    const { defineTool } = loadDshTools()
    const { registerTools, FDE_TOOL_NAMES } = require('./tools.js')
    const { installWorkflowToolLimit } = require('./workflow-limit.js')
    registerTools(ctx, { defineTool })
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

module.exports = { apply, inject: ['webServer', 'tools'] }
exports.apply = apply
exports.inject = ['webServer', 'tools']
