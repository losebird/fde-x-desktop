const IUI_MODES = ['standard']
const IUI_SECTION_NAME = 'iui:fence'
const IUI_TOOL_NAMES = ['get_trip_stop_images', 'get_place_images']
const IUI_SKILL_NAME = 'iui'
const IUI_HTML_DENY_PREFIX = 'IUI:'

function iuiAllowedForPreset(preset) {
  return IUI_MODES.includes(preset)
}

function presetFromAgent(agent) {
  const header = agent && agent.session && agent.session.header
  const preset = header && header.agentPreset
  return typeof preset === 'string' ? preset : ''
}

function gatePromptAssembly(assembly, preset) {
  if (!assembly || typeof assembly !== 'object' || iuiAllowedForPreset(preset)) return assembly
  return {
    ...assembly,
    sections: Array.isArray(assembly.sections)
      ? assembly.sections.filter((section) => !section || section.name !== IUI_SECTION_NAME)
      : assembly.sections,
    tools: Array.isArray(assembly.tools)
      ? assembly.tools.filter((tool) => !tool || !IUI_TOOL_NAMES.includes(tool.name))
      : assembly.tools,
  }
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

function gateToolDecision(decision, preset) {
  if (iuiAllowedForPreset(preset)) return decision
  if (!decision || decision.kind !== 'deny') return decision
  if (typeof decision.reason !== 'string' || !decision.reason.startsWith(IUI_HTML_DENY_PREFIX)) return decision
  return { kind: 'allow' }
}

module.exports = {
  IUI_MODES,
  IUI_SECTION_NAME,
  IUI_TOOL_NAMES,
  IUI_SKILL_NAME,
  iuiAllowedForPreset,
  presetFromAgent,
  gatePromptAssembly,
  gatePreStepDecision,
  gateToolDecision,
}
