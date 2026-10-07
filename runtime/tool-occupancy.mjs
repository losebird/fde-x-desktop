/**
 * Tool table occupancy: freeze after configured MCP fibers settle, before first model request.
 */

function pluginIdCandidates(serverName) {
  const id = `mcp-${serverName}`
  return [id, `include:${id}`]
}

export function mcpFiberFromPlugins(plugins, serverName) {
  const rows = Array.isArray(plugins) ? plugins : []
  const wanted = new Set(pluginIdCandidates(serverName))
  for (const row of rows) {
    const entryId = String(row?.entryId || row?.id || '')
    const patchId = String(row?.patchId || '')
    if (wanted.has(entryId) || wanted.has(patchId)) return row
  }
  return null
}

export function mcpFiberSettled(fiber, disabled) {
  if (disabled) return true
  if (!fiber) return false
  if (fiber.enabled === false) return true
  const phase = String(fiber.fiberPhase || '').trim()
  return phase === 'active' || phase === 'failed'
}

export function mcpOccupancyFrozen(plugins, configured) {
  const rows = Array.isArray(configured) ? configured : []
  if (!rows.length) return true
  return rows.every((row) => mcpFiberSettled(mcpFiberFromPlugins(plugins, row.serverName), Boolean(row.disabled)))
}

function pluginsFromListed(listed) {
  if (Array.isArray(listed)) return listed
  if (Array.isArray(listed?.plugins)) return listed.plugins
  if (Array.isArray(listed?.entries)) return listed.entries
  return []
}

export async function waitMcpOccupancy(deps = {}) {
  const timeoutMs = Number(deps.timeoutMs) > 0 ? Number(deps.timeoutMs) : 8000
  const pollMs = Number(deps.pollMs) > 0 ? Number(deps.pollMs) : 200
  const configured = Array.isArray(deps.configured) ? deps.configured : []
  const enabled = configured.filter((row) => row && !row.disabled && row.serverName)
  if (!enabled.length) return { frozen: true, plugins: [], timedOut: false }
  if (typeof deps.listPlugins !== 'function') return { frozen: true, plugins: [], timedOut: false }
  const start = Date.now()
  let plugins = []
  while (Date.now() - start < timeoutMs) {
    try {
      plugins = pluginsFromListed(await deps.listPlugins())
    } catch {
      plugins = []
    }
    if (mcpOccupancyFrozen(plugins, configured)) return { frozen: true, plugins, timedOut: false }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
  return { frozen: true, plugins, timedOut: true }
}
