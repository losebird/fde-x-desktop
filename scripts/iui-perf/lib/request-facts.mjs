export const PROMPT = '帮我生成一份单人行杭州三天的旅游攻略，请注意是一份非常专业的攻略，内容要足够详细，介绍页面要好看，按照现在的时间点加入合适的景点，点击每个景点要有这个景点的详细介绍，吃住行的花费也要有'

const MARKERS = [
  ['iui-fence', 'You render interactive UI INSIDE your reply'],
  ['persona', 'You are a coding agent powered by'],
  ['plan-mode', 'You are in plan mode'],
  ['semantic-graph', 'local knowledge graph of prior chats'],
  ['app-spec', 'fde-app/v1'],
  ['briefing-skill', 'fde_briefing_submit'],
  ['workflow-word', 'workflow'],
]

export function systemText(body) {
  if (!body || typeof body !== 'object') return ''
  if (typeof body.system === 'string') return body.system
  if (Array.isArray(body.system)) {
    return body.system.map((block) => (block && typeof block.text === 'string' ? block.text : '')).join('\n')
  }
  const messages = Array.isArray(body.messages) ? body.messages : []
  return messages
    .filter((message) => message && message.role === 'system')
    .map((message) => {
      if (typeof message.content === 'string') return message.content
      if (!Array.isArray(message.content)) return ''
      return message.content.map((block) => (block && block.type === 'text' ? block.text : '')).join('')
    })
    .join('\n\n')
}

export function userText(body) {
  const messages = body && Array.isArray(body.messages) ? body.messages : []
  return messages.map((message) => {
    if (!message || message.role === 'system') return ''
    if (typeof message.content === 'string') return message.content
    if (!Array.isArray(message.content)) return ''
    return message.content.map((block) => {
      if (!block) return ''
      if (typeof block.text === 'string') return block.text
      if (typeof block.content === 'string') return block.content
      return ''
    }).join('')
  }).join('\n')
}

export function isPromptTurn(body) {
  return userText(body).includes('杭州三天')
}

export function effortOf(body) {
  const thinking = body && body.thinking && typeof body.thinking === 'object' ? body.thinking.type : ''
  const effort = body && body.output_config && typeof body.output_config.effort === 'string'
    ? body.output_config.effort
    : ''
  return { thinking, effort }
}

export function toolsOf(body) {
  const tools = body && Array.isArray(body.tools) ? body.tools : []
  return tools.map((tool) => ({
    name: String(tool && tool.name || ''),
    description: String(tool && tool.description || ''),
    schema: tool && tool.input_schema ? tool.input_schema : {},
  }))
}

export function markerHits(text) {
  const hits = {}
  for (const [name, needle] of MARKERS) hits[name] = String(text || '').includes(needle)
  return hits
}

export function paragraphs(text) {
  return String(text || '').split(/\n\n+/u).map((part) => part.trim()).filter(Boolean)
}
