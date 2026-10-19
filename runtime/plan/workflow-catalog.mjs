import { WORKFLOW_TOOLS, toolTier, waitsForPerson } from './tool-risk.mjs'

const EXCLUDED_REASON = '这个工具不在普通会话的可选清单里'

let catalogSessionId = ''
const presetSessions = new Map()

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

async function bridgeJson(origin, cookie, path, sessionId) {
  const url = new URL(path, origin)
  if (sessionId) url.searchParams.set('sessionId', sessionId)
  const response = await fetch(url, { headers: { cookie, origin } })
  if (response.status === 404) return null
  if (!response.ok) throw new Error('预设会话的工具没有列出来')
  const payload = await response.json()
  if (!payload || payload.ok !== true) throw new Error('预设会话的工具没有列出来')
  return payload
}

async function presetSession(aiRuntime, cwd, origin, cookie, presetId) {
  const cached = presetSessions.get(presetId)
  if (cached) {
    const snap = await bridgeJson(origin, cookie, '/fde-session/preset-snapshot', cached)
    if (snap) return snap
  }
  if (presetId === 'standard' && catalogSessionId) {
    const snap = await bridgeJson(origin, cookie, '/fde-session/preset-snapshot', catalogSessionId)
    if (snap) {
      presetSessions.set(presetId, catalogSessionId)
      return snap
    }
  }
  const created = await aiRuntime.call('session/create', {
    request: { cwd, agentPreset: presetId },
  })
  const sessionId = created && typeof created.sessionId === 'string' ? created.sessionId : ''
  if (!sessionId) throw new Error('预设会话没有建立')
  presetSessions.set(presetId, sessionId)
  const snap = await bridgeJson(origin, cookie, '/fde-session/preset-snapshot', sessionId)
  if (!snap || !Array.isArray(snap.tools)) throw new Error('预设会话的工具没有列出来')
  return snap
}

export async function listWorkflowCatalog(aiRuntime, cwd) {
  const base = await listSelectableTools(aiRuntime, cwd)
  const origin = aiRuntime && typeof aiRuntime.origin === 'string' ? aiRuntime.origin : ''
  const cookie = aiRuntime && typeof aiRuntime.cookie === 'string' ? aiRuntime.cookie : ''
  const inventory = await bridgeJson(origin, cookie, '/fde-session/preset-inventory')
  if (!inventory || !Array.isArray(inventory.presets)) throw new Error('预设没有列出来')
  const known = new Set(base.tools.map((row) => row.name))
  const presets = []
  for (const row of inventory.presets) {
    if (!row || typeof row.id !== 'string' || !row.id) continue
    let snap
    try {
      snap = await presetSession(aiRuntime, cwd, origin, cookie, row.id)
    } catch (error) {
      presets.push({
        id: row.id,
        name: typeof row.name === 'string' && row.name ? row.name : row.id,
        hasDanger: false,
        persona: null,
        tools: [],
        unavailable: error instanceof Error && error.message ? error.message : '这个预设开不了会话',
      })
      continue
    }
    const tools = snap.tools.map((tool) => {
      const name = tool.name
      const tier = toolTier(name, { readOnly: tool.readOnly === true })
      const selectable = known.has(name)
      const blocksRun = tier === 'wait' || waitsForPerson(name)
      const row = selectable ? { name, tier, selectable } : { name, tier, selectable, reason: EXCLUDED_REASON }
      return blocksRun ? { ...row, blocksRun: true } : row
    }).sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
    const persona = snap.persona && typeof snap.persona.text === 'string' && snap.persona.text
      ? { text: snap.persona.text, complete: snap.persona.complete === true }
      : null
    presets.push({
      id: row.id,
      name: typeof row.name === 'string' && row.name ? row.name : row.id,
      hasDanger: tools.some((tool) => tool.selectable && tool.tier === 'danger'),
      persona,
      tools,
    })
  }
  presets.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
  return { tools: base.tools, defaults: base.defaults, presets }
}
