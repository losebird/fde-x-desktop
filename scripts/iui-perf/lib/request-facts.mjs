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

function textOfContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map((block) => {
    if (!block) return ''
    if (typeof block === 'string') return block
    if (typeof block.text === 'string') return block.text
    if (typeof block.content === 'string') return block.content
    return ''
  }).join('')
}

function messageText(message) {
  if (!message || typeof message === 'string') return typeof message === 'string' ? message : ''
  if (typeof message.content === 'string' || Array.isArray(message.content)) return textOfContent(message.content)
  if (typeof message.text === 'string') return message.text
  return ''
}

export function systemText(body) {
  if (!body || typeof body !== 'object') return ''
  const chunks = []
  if (typeof body.instructions === 'string') chunks.push(body.instructions)
  if (typeof body.system === 'string') chunks.push(body.system)
  if (Array.isArray(body.system)) chunks.push(body.system.map((block) => (block && typeof block.text === 'string' ? block.text : '')).join('\n'))
  const messages = [
    ...(Array.isArray(body.messages) ? body.messages : []),
    ...(Array.isArray(body.input) ? body.input : []),
  ]
  chunks.push(messages
    .filter((message) => message && (message.role === 'system' || message.role === 'developer'))
    .map((message) => messageText(message))
    .filter(Boolean)
    .join('\n\n'))
  return chunks.filter(Boolean).join('\n\n')
}

export function userText(body) {
  if (!body || typeof body !== 'object') return ''
  if (typeof body.input === 'string') return body.input
  const messages = [
    ...(Array.isArray(body.messages) ? body.messages : []),
    ...(Array.isArray(body.input) ? body.input : []),
  ]
  return messages.map((message) => {
    if (!message || message.role === 'system' || message.role === 'developer') return ''
    return messageText(message)
  }).filter(Boolean).join('\n')
}

export function isPromptTurn(body) {
  return userText(body).includes('杭州三天')
}

export function effortOf(body) {
  const thinking = body && body.thinking && typeof body.thinking === 'object' ? body.thinking.type : ''
  const nested = body && body.reasoning && typeof body.reasoning === 'object' ? body.reasoning.effort : ''
  const effort = (typeof body?.reasoning_effort === 'string' && body.reasoning_effort)
    || (typeof nested === 'string' && nested)
    || (body && body.output_config && typeof body.output_config.effort === 'string' ? body.output_config.effort : '')
    || ''
  return { thinking, effort }
}

export function toolsOf(body) {
  const tools = body && Array.isArray(body.tools) ? body.tools : []
  return tools.map((tool) => {
    const fn = tool && tool.function && typeof tool.function === 'object' ? tool.function : tool
    return {
      name: String((fn && fn.name) || (tool && tool.name) || (tool && tool.type) || ''),
      description: String((fn && fn.description) || ''),
      schema: (fn && (fn.parameters || fn.input_schema)) || {},
    }
  })
}

export function markerHits(text) {
  const hits = {}
  for (const [name, needle] of MARKERS) hits[name] = String(text || '').includes(needle)
  return hits
}

export function paragraphs(text) {
  return String(text || '').split(/\n\n+/u).map((part) => part.trim()).filter(Boolean)
}
