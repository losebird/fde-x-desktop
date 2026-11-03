const IUI_MODES = ['standard', 'fde-biz']
const IUI_SECTION_NAME = 'iui:fence'
const IUI_TOOL_NAMES = ['get_trip_stop_images', 'get_place_images']
const IUI_SKILL_NAME = 'iui'
const IUI_HTML_DENY_PREFIX = 'IUI:'
const STANDARD_DENY_SERVERS = ['cua-driver', 'chrome-devtools', 'playwright']

function iuiAllowedForPreset(preset) {
  return IUI_MODES.includes(preset)
}

function presetFromAgent(agent) {
  const header = agent && agent.session && agent.session.header
  const preset = header && header.agentPreset
  return typeof preset === 'string' ? preset : ''
}

function mcpServerName(toolName) {
  const name = String(toolName || '')
  if (!name.startsWith('mcp__')) return ''
  const body = name.slice(5)
  const cut = body.indexOf('__')
  if (cut <= 0) return ''
  return body.slice(0, cut)
}

const volatileWrite = Symbol.for('cosmokit.volatile.write')

function configValue(value) {
  if (value && typeof value === 'object' && typeof value.get === 'function' && typeof value[volatileWrite] === 'function') {
    return value.get()
  }
  return value
}

function mcpMountFromConfig(config) {
  const source = config && typeof config === 'object' ? config : {}
  const listed = configValue(source.standardDenyServers)
  const standardDenyServers = Array.isArray(listed)
    ? listed.map((item) => String(item || '').trim()).filter(Boolean)
    : STANDARD_DENY_SERVERS.slice()
  const briefingDenyUserMcp = configValue(source.briefingDenyUserMcp)
  return {
    standardDenyServers,
    briefingDenyUserMcp: briefingDenyUserMcp !== false,
  }
}

function resolveMcpMount(mount) {
  if (mount && Array.isArray(mount.standardDenyServers) && typeof mount.briefingDenyUserMcp === 'boolean') return mount
  return mcpMountFromConfig(mount)
}

function briefingAllowServers(sessionId) {
  if (typeof sessionId !== 'string' || !sessionId) return []
  const { readBriefingAllow } = require('./fde-x-dsh-bridge/lib/briefing-allow.js')
  return readBriefingAllow(sessionId)
}

function deniedBriefingBrowserServer(name) {
  return STANDARD_DENY_SERVERS.includes(name) ? name : ''
}

function deniedServer(server, preset, mount, sessionId) {
  const name = String(server || '').trim()
  if (!name) return ''
  const table = resolveMcpMount(mount)
  if (preset === 'fde-briefing' && table.briefingDenyUserMcp) {
    const browser = deniedBriefingBrowserServer(name)
    if (browser) return browser
    if (briefingAllowServers(sessionId).includes(name)) return ''
    return name
  }
  if ((preset === 'standard' || preset === 'fde-biz') && table.standardDenyServers.includes(name)) return name
  return ''
}

function deniedMcpServer(toolName, preset, mount, sessionId) {
  return deniedServer(mcpServerName(toolName), preset, mount, sessionId)
}

function stripDeniedMcpTools(assembly, preset, mount, sessionId) {
  if (!assembly || typeof assembly !== 'object' || !Array.isArray(assembly.tools)) return assembly
  const tools = assembly.tools.filter((tool) => !deniedMcpServer(tool && tool.name, preset, mount, sessionId))
  if (tools.length === assembly.tools.length) return assembly
  return { ...assembly, tools }
}

function gatePromptAssembly(assembly, preset, mount, sessionId) {
  const table = resolveMcpMount(mount)
  if (!assembly || typeof assembly !== 'object') return stripDeniedMcpTools(assembly, preset, table, sessionId)
  const allowed = iuiAllowedForPreset(preset)
  const sections = Array.isArray(assembly.sections)
    ? assembly.sections.filter((section) => !section || section.name !== IUI_SECTION_NAME)
    : assembly.sections
  const tools = allowed || !Array.isArray(assembly.tools)
    ? assembly.tools
    : assembly.tools.filter((tool) => !tool || !IUI_TOOL_NAMES.includes(tool.name))
  return stabilizeAssemblyTools(stripDeniedMcpTools({ ...assembly, sections, tools }, preset, table, sessionId))
}

function stripIuiSkillLine(text) {
  return String(text).split('\n').filter((line) => !/^- `iui`:/u.test(line)).join('\n')
}

function clipSkillDescription(value) {
  return String(value || '').split('\n')[0].trim().slice(0, 80)
}

function catalogSource(message) {
  if (message && message.source && typeof message.source === 'object') return message.source
  const data = message && message.data
  if (data && data.source && typeof data.source === 'object') return data.source
  return null
}

function catalogIdentity(entries) {
  if (!Array.isArray(entries)) return ''
  return entries.map((entry) => JSON.stringify([
    entry && entry.name ? String(entry.name) : '',
    clipSkillDescription(entry && entry.description),
  ])).join('\n')
}

function visibleInjectKind(agent, kind) {
  const session = agent && agent.session
  if (!session || typeof session.eventAt !== 'function') return false
  const seq = Number(session.seq)
  if (!Number.isSafeInteger(seq) || seq <= 0) return false
  const nodes = session.surface && session.surface.nodes
  const visible = nodes && typeof nodes[Symbol.iterator] === 'function' ? new Set(nodes) : null
  for (let index = seq - 1; index >= 0; index -= 1) {
    let event
    try {
      event = session.eventAt(index)
    } catch {
      continue
    }
    if (!event || event.type !== 'user/message') continue
    const source = event.data && event.data.source
    if (!source || source.kind !== kind) continue
    if (visible && !visible.has(event.seq) && !visible.has(index)) continue
    return true
  }
  return false
}

function visibleCatalogIdentity(agent) {
  const session = agent && agent.session
  if (!session || typeof session.eventAt !== 'function') return ''
  const seq = Number(session.seq)
  if (!Number.isSafeInteger(seq) || seq <= 0) return ''
  const nodes = session.surface && session.surface.nodes
  const visible = nodes && typeof nodes[Symbol.iterator] === 'function' ? new Set(nodes) : null
  for (let index = seq - 1; index >= 0; index -= 1) {
    let event
    try {
      event = session.eventAt(index)
    } catch {
      continue
    }
    if (!event || event.type !== 'user/message') continue
    const source = event.data && event.data.source
    if (!source || source.kind !== 'skill-catalog') continue
    if (visible && !visible.has(event.seq) && !visible.has(index)) continue
    return catalogIdentity(source.entries)
  }
  return ''
}

function dropLaterInjectKind(messages, agent, kind) {
  if (!Array.isArray(messages) || !kind) return messages
  const historyHas = visibleInjectKind(agent, kind)
  const at = []
  for (let index = 0; index < messages.length; index += 1) {
    const source = catalogSource(messages[index])
    if (source && source.kind === kind) at.push(index)
  }
  if (at.length === 0) return messages
  const drop = new Set()
  if (historyHas) {
    for (const index of at) drop.add(index)
  } else if (at.length > 1) {
    for (const index of at.slice(1)) drop.add(index)
  }
  if (drop.size === 0) return messages
  return messages.filter((_, index) => !drop.has(index))
}

function stabilizeAssemblyTools(assembly) {
  if (!assembly || typeof assembly !== 'object' || !Array.isArray(assembly.tools)) return assembly
  const names = assembly.tools.map((tool) => String((tool && tool.name) || ''))
  const ordered = names.slice().sort()
  if (names.every((name, index) => name === ordered[index])) return assembly
  const tools = assembly.tools.slice().sort((left, right) => (
    String((left && left.name) || '').localeCompare(String((right && right.name) || ''))
  ))
  return { ...assembly, tools }
}

function dropRedundantSkillCatalog(messages, agent) {
  if (!Array.isArray(messages)) return messages
  const historyId = visibleCatalogIdentity(agent)
  const catalogAt = []
  for (let index = 0; index < messages.length; index += 1) {
    const source = catalogSource(messages[index])
    if (source && source.kind === 'skill-catalog') catalogAt.push(index)
  }
  if (catalogAt.length === 0) return messages
  const drop = new Set()
  const remaining = []
  for (const index of catalogAt) {
    const identity = catalogIdentity(catalogSource(messages[index]).entries)
    if (historyId && identity === historyId) drop.add(index)
    else remaining.push(index)
  }
  if (remaining.length > 1) {
    for (const index of remaining.slice(0, -1)) drop.add(index)
  }
  if (drop.size === 0) return messages
  return messages.filter((_, index) => !drop.has(index))
}

function compactSkillCatalog(message) {
  const source = catalogSource(message)
  if (!source || source.kind !== 'skill-catalog' || !Array.isArray(source.entries)) return message
  const byName = new Map()
  for (const entry of source.entries) {
    if (entry && entry.name && typeof entry.description === 'string' && entry.description) {
      byName.set(String(entry.name), clipSkillDescription(entry.description))
    }
  }
  const content = Array.isArray(message.content)
    ? message.content.map((part) => {
      if (!part || part.type !== 'text' || typeof part.text !== 'string') return part
      const text = part.text.replace(/^- `([^`]+)`: .+$/gm, (line, name) => {
        if (!byName.has(name)) return line
        return `- \`${name}\`: ${byName.get(name)}`
      })
      return { ...part, text }
    })
    : message.content
  return { ...message, content }
}

function gateSkillMessage(message) {
  const source = message && message.source
  if (!source || typeof source !== 'object') return message
  if (source.kind === 'skill-invocation' && source.name === IUI_SKILL_NAME) return null
  if (source.kind !== 'skill-catalog') return message
  const entries = Array.isArray(source.entries)
    ? source.entries.filter((entry) => !entry || entry.name !== IUI_SKILL_NAME)
    : source.entries
  const content = Array.isArray(message.content)
    ? message.content.map((part) => {
      if (!part || part.type !== 'text' || typeof part.text !== 'string') return part
      return { ...part, text: stripIuiSkillLine(part.text) }
    })
    : message.content
  return { ...message, content, source: { ...source, entries } }
}

function gatePreStepDecision(decision, preset, agent) {
  if (!decision || typeof decision !== 'object' || !Array.isArray(decision.messages)) return decision
  if (decision.kind === 'reject') return decision
  let messages = decision.messages.map(compactSkillCatalog)
  if (!iuiAllowedForPreset(preset)) {
    messages = messages.map(gateSkillMessage).filter(Boolean)
  }
  messages = dropRedundantSkillCatalog(messages, agent)
  messages = dropLaterInjectKind(messages, agent, 'time-context')
  messages = dropLaterInjectKind(messages, agent, 'runtime-context')
  return { ...decision, messages }
}

function isIuiHtmlDeny(decision) {
  return Boolean(
    decision
    && decision.kind === 'deny'
    && typeof decision.reason === 'string'
    && decision.reason.startsWith(IUI_HTML_DENY_PREFIX),
  )
}

function resumePastIuiHtmlDeny(decision, preset) {
  return !iuiAllowedForPreset(preset) && isIuiHtmlDeny(decision)
}

module.exports = {
  IUI_MODES,
  IUI_SECTION_NAME,
  IUI_TOOL_NAMES,
  IUI_SKILL_NAME,
  IUI_HTML_DENY_PREFIX,
  STANDARD_DENY_SERVERS,
  iuiAllowedForPreset,
  presetFromAgent,
  mcpServerName,
  mcpMountFromConfig,
  resolveMcpMount,
  deniedServer,
  deniedMcpServer,
  gatePromptAssembly,
  gatePreStepDecision,
  isIuiHtmlDeny,
  resumePastIuiHtmlDeny,
}
