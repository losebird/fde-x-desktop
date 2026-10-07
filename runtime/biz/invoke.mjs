import { harvestTurnToolResults } from '../briefing/tool-official.mjs'
import { parseMcpPatchEntries, readMcpArchiveText } from '../mcp-archive.mjs'
import { callMcpHttpTool, listSessionProjectedToolNames } from '../routes/mcp.mjs'
import { resolvePrimarySessionForRuntime } from '../session-primary.mjs'
import { mcpToolLocalName, slotHandle } from './source.mjs'

const SESSION_TIMEOUT_MS = 60_000
const PROJECT_WAIT_MS = 8000

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function invokeError(message, code = 'invoke_failed') {
  const error = new Error(message)
  error.code = code
  return error
}

async function archiveEntry(aiRuntime, serverName) {
  const text = await readMcpArchiveText(aiRuntime)
  const entries = parseMcpPatchEntries(text)
  return entries.find((row) => row.serverName === serverName) || null
}

function pickMcpHarvest(byTool, handle) {
  const want = String(handle.tool || '').trim()
  const local = mcpToolLocalName(handle.serverName, handle.tool)
  const aliases = new Set([
    want,
    local,
    `mcp__${handle.serverName}__${local}`,
  ])
  for (const [name, row] of Object.entries(byTool || {})) {
    if (!aliases.has(name) && !name.endsWith(`__${local}`)) continue
    if (row?.error) continue
    if (row?.text) return row.text
  }
  for (const [name, row] of Object.entries(byTool || {})) {
    if (!aliases.has(name) && !name.endsWith(`__${local}`)) continue
    if (row?.error) return { error: String(row.text || `${name} 失败`) }
  }
  return null
}

async function sessionPromptThisTurn(aiRuntime, sessionId, prompt) {
  const requestId = `biz_${Date.now().toString(36)}`
  await aiRuntime.call('session/prompt', {
    request: {
      requestId,
      sessionId,
      mode: 'queue',
      content: [{ type: 'text', text: prompt }],
    },
  })
  const harvest = await harvestTurnToolResults(aiRuntime, sessionId, { timeoutMs: SESSION_TIMEOUT_MS })
  if (!harvest.ended) {
    throw invokeError('timeout', 'timeout')
  }
  return harvest.byTool
}

async function invokeStdioMcp(aiRuntime, handle, args, cwd, sessionIdHint) {
  const sessionId = await resolvePrimarySessionForRuntime(aiRuntime, { cwd, sessionId: sessionIdHint })
  if (!sessionId) throw invokeError('没有可用的 AI 会话', 'no_session')
  const local = mcpToolLocalName(handle.serverName, handle.tool)
  const projectedName = handle.tool.startsWith('mcp__') ? handle.tool : `mcp__${handle.serverName}__${local}`
  const deadline = Date.now() + PROJECT_WAIT_MS
  let projected = []
  while (true) {
    projected = await listSessionProjectedToolNames(aiRuntime, sessionId)
    if (projected.includes(projectedName) || projected.includes(handle.tool) || projected.includes(local)) break
    if (Date.now() >= deadline) break
    await waitMs(400)
  }
  if (!projected.includes(projectedName) && !projected.includes(handle.tool) && !projected.includes(local)) {
    throw invokeError(`会话未投影 ${projectedName}`, 'not_projected')
  }
  const tool = projected.includes(handle.tool) ? handle.tool : (projected.includes(projectedName) ? projectedName : local)
  const prompt = [
    '本轮必须调用指定 MCP 工具拿到结果。禁止沿用上一轮结果。不要作文替代工具结果。',
    `工具：${tool}`,
    `参数 JSON：${JSON.stringify(args && typeof args === 'object' ? args : {})}`,
  ].join('\n')
  const byTool = await sessionPromptThisTurn(aiRuntime, sessionId, prompt)
  const picked = pickMcpHarvest(byTool, { ...handle, tool })
  if (picked && typeof picked === 'object' && picked.error) throw invokeError(picked.error)
  if (picked == null || picked === '') throw invokeError(`本轮未调用 ${tool}`, 'not_called')
  return picked
}

export async function invokeBizSlot(deps, { source, slot, args, cwd, sessionId } = {}) {
  const handle = slotHandle(source, slot)
  if (!handle) {
    if (slot === 'write') throw invokeError('未绑 write', 'no_write')
    throw invokeError(`缺少 ${slot} 句柄`, 'no_handle')
  }
  const { aiRuntime } = deps
  const payload = args && typeof args === 'object' && !Array.isArray(args) ? args : {}
  if (handle.via === 'mcp') {
    const entry = await archiveEntry(aiRuntime, handle.serverName)
    if (!entry) throw invokeError('未找到该 MCP 服务器', 'mcp_missing')
    if (entry.disabled) throw invokeError('MCP 已停用', 'mcp_disabled')
    const local = mcpToolLocalName(handle.serverName, handle.tool)
    if (entry.transport === 'streamable-http') {
      const called = await callMcpHttpTool(entry, local, payload, SESSION_TIMEOUT_MS)
      if (!called.ok) throw invokeError(called.error || 'tools/call 失败')
      return called.result
    }
    return invokeStdioMcp(aiRuntime, handle, payload, cwd, sessionId)
  }
  throw invokeError('句柄 via 无效', 'bad_handle')
}
