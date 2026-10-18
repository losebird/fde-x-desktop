const { existsSync, readFileSync } = require('node:fs')
const { homedir } = require('node:os')
const { join } = require('node:path')

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
  tools.restrict({ allow: [...WORKFLOW_TOOLS] })
  tools.guard((exec) => {
    if (!WORKFLOW_TOOLS.includes(exec && exec.name)) return DENY
  })
  stripping = true
  try {
    stripOwnLayer(agent)
  } finally {
    stripping = false
  }
  watched.add(agent)
  limited.add(agent)
  scheduleStrip()
}

function installWorkflowToolLimit(ctx) {
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
}
