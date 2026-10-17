const IUI_MODES = ['standard']
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

function mcpMountFromConfig(config) {
  const source = config && typeof config === 'object' ? config : {}
  const listed = source.standardDenyServers
  const standardDenyServers = Array.isArray(listed)
    ? listed.map((item) => String(item || '').trim()).filter(Boolean)
    : STANDARD_DENY_SERVERS.slice()
  return {
    standardDenyServers,
    briefingDenyUserMcp: source.briefingDenyUserMcp !== false,
  }
}

function resolveMcpMount(mount) {
  if (mount && Array.isArray(mount.standardDenyServers) && typeof mount.briefingDenyUserMcp === 'boolean') return mount
  return mcpMountFromConfig(mount)
}

function deniedMcpServer(toolName, preset, mount) {
  const server = mcpServerName(toolName)
  if (!server) return ''
  const table = resolveMcpMount(mount)
  if (preset === 'fde-briefing' && table.briefingDenyUserMcp) return server
  if (preset === 'standard' && table.standardDenyServers.includes(server)) return server
  return ''
}

function stripDeniedMcpTools(assembly, preset, mount) {
  if (!assembly || typeof assembly !== 'object' || !Array.isArray(assembly.tools)) return assembly
  const tools = assembly.tools.filter((tool) => !deniedMcpServer(tool && tool.name, preset, mount))
  if (tools.length === assembly.tools.length) return assembly
  return { ...assembly, tools }
}

function gatePromptAssembly(assembly, preset, mount) {
  const table = resolveMcpMount(mount)
  const stripped = !assembly || typeof assembly !== 'object' || iuiAllowedForPreset(preset)
    ? assembly
    : {
      ...assembly,
      sections: Array.isArray(assembly.sections)
        ? assembly.sections.filter((section) => !section || section.name !== IUI_SECTION_NAME)
        : assembly.sections,
      tools: Array.isArray(assembly.tools)
        ? assembly.tools.filter((tool) => !tool || !IUI_TOOL_NAMES.includes(tool.name))
        : assembly.tools,
    }
  return stripDeniedMcpTools(stripped, preset, table)
}

function stripIuiSkillLine(text) {
  return String(text).split('\n').filter((line) => !/^- `iui`:/u.test(line)).join('\n')
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

function gatePreStepDecision(decision, preset) {
  if (!decision || typeof decision !== 'object' || iuiAllowedForPreset(preset)) return decision
  if (decision.kind === 'reject' || !Array.isArray(decision.messages)) return decision
  return {
    ...decision,
    messages: decision.messages.map(gateSkillMessage).filter(Boolean),
  }
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
  deniedMcpServer,
  gatePromptAssembly,
  gatePreStepDecision,
  isIuiHtmlDeny,
  resumePastIuiHtmlDeny,
}
