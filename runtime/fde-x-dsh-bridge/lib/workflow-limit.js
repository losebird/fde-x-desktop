const { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } = require('node:fs')
const { homedir } = require('node:os')
const { dirname, join } = require('node:path')

const WORKFLOW_PRESET = 'fde-workflow'
const WORKFLOW_TOOLS = ['fde_app_records_query', 'fde_app_records_propose', 'fde_plan_task_propose']
const DENY = '工作流步骤不能调用这个工具'
const UNCONFIRMED = '工作流预设未能限制工具'
const limited = new WeakSet()
const watched = new Set()
let stripping = false

function dshHome() {
  return process.env.FDE_DSH_HOME || process.env.DSH_HOME || join(homedir(), '.dsh-fde-x')
}

function allowFile(sessionId, home) {
  const id = String(sessionId || '')
  if (!/^session-[A-Za-z0-9-]+$/.test(id)) return ''
  return join(home || dshHome(), 'run', 'workflow-allow', `${id}.json`)
}

function stageWorkflowAllow(sessionId, tools, home) {
  const file = allowFile(sessionId, home)
  if (!file) throw new Error(UNCONFIRMED)
  if (!Array.isArray(tools) || tools.length === 0) throw new Error(UNCONFIRMED)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify({ tools })}\n`)
}

function consumeWorkflowAllow(sessionId) {
  const file = allowFile(sessionId)
  if (!file || !existsSync(file)) return null
  const payload = JSON.parse(readFileSync(file, 'utf8'))
  unlinkSync(file)
  if (!payload || !Array.isArray(payload.tools) || payload.tools.length === 0) throw new Error(UNCONFIRMED)
  if (payload.tools.some((name) => typeof name !== 'string' || !name)) throw new Error(UNCONFIRMED)
  return payload.tools
}

function headerPreset(agent) {
  const header = agent && agent.session && agent.session.header
  const id = header && header.agentPreset
  return typeof id === 'string' ? id : ''
}

function composedPresetId(ctx, agent) {
  if (!ctx || typeof ctx.get !== 'function' || !agent || !agent.ctx) return undefined
  const presets = ctx.get('agentPresets')
  if (!presets || typeof presets.composedPreset !== 'function') return undefined
  const id = presets.composedPreset(agent.ctx)
  return typeof id === 'string' && id ? id : undefined
}

function effectLabel(dispose) {
  if (typeof dispose !== 'function') return ''
  for (const key of Object.getOwnPropertySymbols(dispose)) {
    const meta = dispose[key]
    if (meta && typeof meta.label === 'string') return meta.label
  }
  return ''
}

function stripOwnLayer(agent) {
  const fiber = agent && agent.ctx && agent.ctx.fiber
  const disposables = fiber && fiber._disposables
  if (!disposables || typeof disposables[Symbol.iterator] !== 'function') throw new Error(UNCONFIRMED)
  const pending = []
  for (const dispose of disposables) {
    if (effectLabel(dispose) === 'tools.register()') pending.push(dispose)
  }
  for (const dispose of pending) dispose()
}

function scheduleStrip() {
  if (stripping || watched.size === 0) return
  queueMicrotask(() => {
    if (stripping) return
    stripping = true
    try {
      for (const agent of watched) stripOwnLayer(agent)
    } finally {
      stripping = false
    }
  })
}

function layerTables(tools) {
  const tables = []
  const globalLayer = tools.layers && tools.layers.global
  if (globalLayer && globalLayer.tools) tables.push(globalLayer.tools)
  const scoped = tools.layers && tools.layers.scoped
  if (scoped && typeof scoped.values === 'function') {
    for (const layer of scoped.values()) {
      if (layer && layer.tools) tables.push(layer.tools)
    }
  }
  return tables
}

function locateDefinition(tools, name) {
  for (const table of layerTables(tools)) {
    if (typeof table.get !== 'function') continue
    const found = table.get(name)
    if (found) return found
  }
  return undefined
}

function grantOnAgent(tools, agent, name, definition) {
  tools.layers.effect(agent.ctx, (layer) => layer.tools.insert(name, definition), {
    label: 'workflow-allow.grant()',
    notify: false,
  })
}

function limitWorkflowAgent(ctx, agent) {
  const header = headerPreset(agent)
  const composed = composedPresetId(ctx, agent)
  if (header !== WORKFLOW_PRESET && composed !== WORKFLOW_PRESET) return
  if (composed !== WORKFLOW_PRESET) throw new Error(UNCONFIRMED)
  if (limited.has(agent)) return
  const tools = agent.ctx && agent.ctx.tools
  if (!tools || typeof tools.restrict !== 'function' || typeof tools.guard !== 'function') {
    throw new Error(UNCONFIRMED)
  }
  const sessionHeader = agent && agent.session && agent.session.header
  const sessionId = (sessionHeader && sessionHeader.id) || (agent.session && agent.session.id) || agent.id
  const staged = consumeWorkflowAllow(sessionId)
  const allow = staged || [...WORKFLOW_TOOLS]
  const snapshot = typeof tools.view === 'function' ? tools.view(agent) : null
  const restrictable = snapshot && snapshot.restrictableNames
  if (!restrictable || typeof restrictable.has !== 'function') throw new Error(UNCONFIRMED)
  const inherited = []
  const grants = []
  for (const name of allow) {
    if (restrictable.has(name)) {
      inherited.push(name)
      continue
    }
    const definition = locateDefinition(tools, name)
    if (!definition) throw new Error(UNCONFIRMED)
    grants.push({ name, definition })
  }
  stripping = true
  try {
    stripOwnLayer(agent)
  } finally {
    stripping = false
  }
  for (const grant of grants) grantOnAgent(tools, agent, grant.name, grant.definition)
  if (inherited.length > 0) tools.restrict({ allow: inherited })
  else if (restrictable.size > 0) tools.restrict({ deny: [...restrictable] })
  tools.guard((exec) => {
    if (!allow.includes(exec && exec.name)) return DENY
  })
  watched.add(agent)
  limited.add(agent)
  scheduleStrip()
}

function installWorkflowToolLimit(ctx) {
  ctx.tools.guard((exec) => {
    if (exec && exec.agent) return
    return DENY
  })
  ctx.on('tools/change', () => {
    scheduleStrip()
  })
  ctx.on('agent/created', (event) => {
    limitWorkflowAgent(ctx, event && event.agent)
  })
  ctx.on('agent/disposed', (event) => {
    watched.delete(event && event.agent)
  })
  return true
}

function workflowLimitReady() {
  const file = join(dshHome(), 'run', 'bridge-tools.json')
  if (!existsSync(file)) return false
  const payload = JSON.parse(readFileSync(file, 'utf8'))
  return Boolean(payload && payload.ok === true && payload.workflowLimit === true)
}

module.exports = {
  WORKFLOW_PRESET,
  WORKFLOW_TOOLS,
  limitWorkflowAgent,
  installWorkflowToolLimit,
  workflowLimitReady,
  stageWorkflowAllow,
}
