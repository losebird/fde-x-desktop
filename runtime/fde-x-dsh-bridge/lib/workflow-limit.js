const { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } = require('node:fs')
const { createRequire } = require('node:module')
const { homedir } = require('node:os')
const { dirname, join } = require('node:path')

const WORKFLOW_PRESET = 'fde-workflow'
const WORKFLOW_TOOLS = ['fde_app_records_query', 'fde_app_records_propose', 'fde_plan_task_propose']
const DENY = '工作流步骤不能调用这个工具'
const UNCONFIRMED = '工作流预设未能限制工具'
const CAPABILITY_CLAIMS = [
  ['查询应用记录', 'fde_app_records_query'],
  ['提出记录变更', 'fde_app_records_propose'],
  ['提出计划任务', 'fde_plan_task_propose'],
]
const limited = new WeakSet()
const watched = new Set()
let stripping = false
let renderPromptFn = null

function dshHome() {
  return process.env.FDE_DSH_HOME || process.env.DSH_HOME || join(homedir(), '.dsh-fde-x')
}

function allowFile(sessionId, home) {
  const id = String(sessionId || '')
  if (!/^session-[A-Za-z0-9-]+$/.test(id)) return ''
  return join(home || dshHome(), 'run', 'workflow-allow', `${id}.json`)
}

function allowDirectory(home) {
  return join(home || dshHome(), 'run', 'workflow-allow')
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

function tightenExistingAllowFiles(dir) {
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue
    const file = join(dir, name)
    tightenRegularAllowFile(file, lstatSync(file))
  }
}

function stageWorkflowAllow(sessionId, tools, home, persona) {
  const file = allowFile(sessionId, home)
  if (!file) throw new Error(UNCONFIRMED)
  if (!Array.isArray(tools) || tools.length === 0) throw new Error(UNCONFIRMED)
  const body = { tools }
  if (persona) {
    if (typeof persona.text !== 'string' || !persona.text) throw new Error(UNCONFIRMED)
    body.persona = { text: persona.text, complete: persona.complete === true }
  }
  prepareAllowDirectory(dirname(file))
  tightenExistingAllowFiles(dirname(file))
  const existing = statOrNull(file)
  if (existing && (existing.isSymbolicLink() || !existing.isFile())) throw new Error(UNCONFIRMED)
  writeFileSync(file, `${JSON.stringify(body)}\n`, { mode: 0o600 })
  chmodSync(file, 0o600)
}

function discardWorkflowAllow(sessionId, home) {
  const file = allowFile(sessionId, home)
  if (!file) return
  const dirInfo = statOrNull(dirname(file))
  if (!dirInfo) return
  if (dirInfo.isSymbolicLink() || !dirInfo.isDirectory()) throw new Error(UNCONFIRMED)
  const info = statOrNull(file)
  if (!info) return
  if (info.isSymbolicLink() || info.isFile()) unlinkSync(file)
}

function sweepWorkflowAllow(home) {
  const dir = allowDirectory(home)
  prepareAllowDirectory(dir)
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue
    const file = join(dir, name)
    const info = lstatSync(file)
    if (info.isSymbolicLink()) {
      unlinkSync(file)
      continue
    }
    if (!info.isFile()) continue
    unlinkSync(file)
  }
}

function consumeWorkflowAllow(sessionId) {
  const file = allowFile(sessionId)
  if (!file) return null
  const info = statOrNull(file)
  if (!info) return null
  if (info.isSymbolicLink() || !info.isFile()) throw new Error(UNCONFIRMED)
  tightenRegularAllowFile(file, info)
  const raw = readFileSync(file, 'utf8')
  unlinkSync(file)
  let payload
  try {
    payload = JSON.parse(raw)
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(UNCONFIRMED)
    throw error
  }
  if (!payload || !Array.isArray(payload.tools) || payload.tools.length === 0) throw new Error(UNCONFIRMED)
  if (payload.tools.some((name) => typeof name !== 'string' || !name)) throw new Error(UNCONFIRMED)
  let persona = null
  if (payload.persona !== undefined) {
    if (!payload.persona || typeof payload.persona.text !== 'string' || !payload.persona.text) throw new Error(UNCONFIRMED)
    persona = { text: payload.persona.text, complete: payload.persona.complete === true }
  }
  return { tools: payload.tools, persona }
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

function ownLayer(tools, agent) {
  if (!tools || !tools.layers || typeof tools.layers.peek !== 'function' || !agent) return null
  const layer = tools.layers.peek(agent)
  if (layer && layer.tools && typeof layer.tools.get === 'function') return layer
  return null
}

function locateDefinition(tools, name, agent) {
  const own = ownLayer(tools, agent)
  if (own) {
    const found = own.tools.get(name)
    if (found) return found
  }
  for (const table of layerTables(tools)) {
    if (typeof table.get !== 'function') continue
    const found = table.get(name)
    if (found) return found
  }
  return undefined
}

function grantOnAgent(tools, agent, name, definition) {
  tools.layers.effect(agent.ctx, (layer) => {
    if (layer.tools.has(name)) return () => {}
    return layer.tools.insert(name, definition)
  }, {
    label: 'workflow-allow.grant()',
    notify: false,
  })
}

function loadRenderPrompt() {
  if (typeof renderPromptFn === 'function') return renderPromptFn
  const seeds = []
  if (require.main && require.main.filename) seeds.push(require.main.filename)
  if (process.argv[1]) seeds.push(process.argv[1])
  let last
  for (const seed of seeds) {
    try {
      const loaded = createRequire(seed)('@deepseek-ai/dsh-system-prompt')
      if (loaded && typeof loaded.renderPrompt === 'function') {
        renderPromptFn = loaded.renderPrompt
        return renderPromptFn
      }
    } catch (error) {
      last = error
    }
  }
  throw last || new Error(UNCONFIRMED)
}

function allowLine(tools) {
  return `本步只能使用这些工具：${[...tools].sort().join('、')}`
}

function claimFits(text, tools) {
  const allow = new Set(tools)
  for (const [phrase, name] of CAPABILITY_CLAIMS) {
    if (text.includes(phrase) && !allow.has(name)) return false
  }
  return true
}

function promptVariables(prompt, agent) {
  const context = { scope: agent, agent }
  const variables = {}
  const globalLayer = prompt.layers && prompt.layers.global
  const globalVars = globalLayer && globalLayer.variables
  if (!globalVars || typeof globalVars.entries !== 'function' || typeof prompt.layers.chainLayers !== 'function') {
    throw new Error(UNCONFIRMED)
  }
  for (const [name, provider] of globalVars.entries()) variables[name] = provider(context)
  for (const layer of prompt.layers.chainLayers(agent)) {
    if (!layer || !layer.variables || typeof layer.variables.entries !== 'function') continue
    for (const [name, provider] of layer.variables.entries()) variables[name] = provider(context)
  }
  return variables
}

function renderPersonaText(prompt, agent, text) {
  const rendered = loadRenderPrompt()({
    sections: [{ name: 'deployment:persona-prefix', text }],
    variables: promptVariables(prompt, agent),
  })
  if (typeof rendered !== 'string' || rendered.includes('{{')) throw new Error(UNCONFIRMED)
  return rendered.trim()
}

function presetPrefix(prompt, agent) {
  if (!prompt || !prompt.layers) return ''
  const layers = []
  if (prompt.layers.global) layers.push(prompt.layers.global)
  if (typeof prompt.layers.chainLayers === 'function') layers.push(...prompt.layers.chainLayers(agent))
  let section = null
  for (const layer of layers) {
    const table = layer && layer.sections
    const found = table && typeof table.get === 'function' ? table.get('deployment:persona-prefix') : null
    if (!found || found.workflowAllow === true || typeof found.text !== 'string') continue
    section = found
  }
  return section ? section.text : ''
}

function stepPromptText(prompt, agent, rawText, tools) {
  const rendered = rawText ? renderPersonaText(prompt, agent, rawText) : ''
  const usable = rendered && !rendered.includes('本步只能使用这些工具：') && claimFits(rendered, tools) ? rendered : ''
  const text = usable ? `${usable}\n\n${allowLine(tools)}` : allowLine(tools)
  if (text.includes('{{')) throw new Error(UNCONFIRMED)
  return text
}

function applyPersona(agent, prompt, text) {
  if (!prompt || !prompt.layers || typeof prompt.layers.effect !== 'function' || typeof prompt.getSectionOrder !== 'function') {
    throw new Error(UNCONFIRMED)
  }
  if (typeof text !== 'string' || !text || text.includes('{{')) throw new Error(UNCONFIRMED)
  const section = {
    name: 'deployment:persona-prefix',
    order: prompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'),
    text,
    complete: true,
    workflowAllow: true,
  }
  prompt.layers.effect(agent.ctx, (layer) => layer.sections.insert(section.name, section), {
    label: 'workflow-allow.persona()',
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
  const allow = staged ? staged.tools : [...WORKFLOW_TOOLS]
  const persona = staged && staged.persona
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
    const definition = locateDefinition(tools, name, agent)
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
  const prompt = agent.ctx && typeof agent.ctx.get === 'function' ? agent.ctx.get('systemPrompt') : null
  if (!prompt) throw new Error(UNCONFIRMED)
  const raw = persona && persona.text ? persona.text : presetPrefix(prompt, agent)
  applyPersona(agent, prompt, stepPromptText(prompt, agent, raw, allow))
  watched.add(agent)
  limited.add(agent)
  scheduleStrip()
}

function installWorkflowToolLimit(ctx) {
  sweepWorkflowAllow()
  ctx.tools.guard((exec) => {
    if (exec && exec.agent) return
    return DENY
  })
  ctx.on('tools/change', () => {
    scheduleStrip()
  })
  ctx.on('agent/disposed', (event) => {
    const agent = event && event.agent
    watched.delete(agent)
    const header = agent && agent.session && agent.session.header
    const sessionId = (header && header.id) || (agent && agent.session && agent.session.id) || (agent && agent.id)
    discardWorkflowAllow(sessionId)
  })
  runWorkflowLimitLast(ctx)
  return true
}

function runWorkflowLimitLast(ctx) {
  const settle = (event) => {
    limitWorkflowAgent(ctx, event && event.agent)
  }
  ctx.on('agent/created', settle)
  const hooks = ctx.events && ctx.events._hooks && ctx.events._hooks['agent/created']
  const mine = hooks && hooks[hooks.length - 1]
  if (!mine) return
  ctx.on('internal/dispatch', (_type, name) => {
    if (name !== 'agent/created') return
    const list = ctx.events._hooks['agent/created']
    if (!list) return
    const index = list.indexOf(mine)
    if (index < 0 || index === list.length - 1) return
    list.splice(index, 1)
    list.push(mine)
  })
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
  discardWorkflowAllow,
  sweepWorkflowAllow,
}
