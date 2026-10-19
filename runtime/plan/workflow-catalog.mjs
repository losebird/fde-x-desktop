import { WORKFLOW_TOOLS, toolTier } from './tool-risk.mjs'

let catalogSessionId = ''

async function fetchCatalog(origin, cookie, sessionId) {
  const url = new URL('/fde-session/tool-catalog', origin)
  url.searchParams.set('sessionId', sessionId)
  const response = await fetch(url, { headers: { cookie, origin } })
  if (response.status === 404) return null
  if (!response.ok) throw new Error('普通会话的工具没有列出来')
  const payload = await response.json()
  if (!payload || payload.ok !== true || !Array.isArray(payload.tools)) {
    throw new Error('普通会话的工具没有列出来')
  }
  return payload
}

export async function listSelectableTools(aiRuntime, cwd) {
  const origin = aiRuntime && typeof aiRuntime.origin === 'string' ? aiRuntime.origin : ''
  const cookie = aiRuntime && typeof aiRuntime.cookie === 'string' ? aiRuntime.cookie : ''
  if (!aiRuntime || typeof aiRuntime.call !== 'function' || !origin || !cookie) {
    const error = new Error('核心 AI 运行时尚未连接')
    error.status = 503
    error.code = 'ai_offline'
    throw error
  }
  let payload = catalogSessionId ? await fetchCatalog(origin, cookie, catalogSessionId) : null
  if (!payload) {
    const created = await aiRuntime.call('session/create', {
      request: { cwd, agentPreset: 'standard' },
    })
    const sessionId = created && typeof created.sessionId === 'string' ? created.sessionId : ''
    if (!sessionId) throw new Error('普通会话没有建立')
    catalogSessionId = sessionId
    payload = await fetchCatalog(origin, cookie, sessionId)
  }
  if (!payload) throw new Error('普通会话的工具没有列出来')
  const tools = payload.tools.map((row) => ({
    name: row.name,
    tier: toolTier(row.name, { readOnly: row.readOnly === true }),
    grantable: row.grantable === true,
  })).sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
  return { tools, defaults: [...WORKFLOW_TOOLS] }
}
