import { FDE_AI_WORKSPACE } from '../config.mjs'
import { resolveHttpWorkspace } from '../http-workspace.mjs'
import { loadSearchSheet } from '../search/search-sheet.mjs'

export async function handleSearchRoute(request, response, url, ctx) {
  if (!(request.method === 'GET' && url.pathname === '/api/v1/search')) return false
  const { db, aiRuntime, sendJson, sendError, correlationId } = ctx
  const resolved = resolveHttpWorkspace({
    url,
    slots: [['query', 'cwd']],
    runtimeCwd: aiRuntime?.cwd,
    fallbackCwd: FDE_AI_WORKSPACE,
  })
  if (resolved.error) {
    sendError(response, 400, 'workspace_invalid', '工作区必须是绝对路径', correlationId)
    return true
  }
  const query = String(url.searchParams.get('q') || '')
  const sessionId = String(url.searchParams.get('sessionId') || '').trim()
  const sheet = await loadSearchSheet({ aiRuntime, db }, { cwd: resolved.cwd, query, sessionId })
  sendJson(response, 200, { data: sheet, correlationId })
  return true
}
