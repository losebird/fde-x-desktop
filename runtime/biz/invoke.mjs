import { callHostMcp, mcpPublicName } from '../host-mcp-call.mjs'
import { parseMcpPatchEntries, readMcpArchiveText } from '../mcp-archive.mjs'
import { callMcpHttpTool } from '../routes/mcp.mjs'
import { mcpToolLocalName, slotHandle } from './source.mjs'

const SESSION_TIMEOUT_MS = 60_000

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

async function invokeStdioMcp(aiRuntime, handle, args) {
  const named = mcpPublicName(handle.serverName, handle.tool)
  if (named.error) throw invokeError(named.error)
  const status = typeof aiRuntime.status === 'function' ? aiRuntime.status() : {}
  const called = await callHostMcp({
    origin: status.origin || aiRuntime.origin,
    cookie: aiRuntime.cookie || status.cookie || '',
    dshHome: aiRuntime.dshHome || status.dshHome,
    name: named.name,
    args,
  })
  if (!called.ok) throw invokeError(called.error || 'tools/call 失败')
  return called.text
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
    return invokeStdioMcp(aiRuntime, handle, payload)
  }
  throw invokeError('句柄 via 无效', 'bad_handle')
}
