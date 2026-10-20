import { FDE_AI_WORKSPACE } from '../config.mjs'
import { httpStatusForWorkspaceError, resolveHttpWorkspace } from '../http-workspace.mjs'
import { resolveWorkspaceIdOrFail } from '../briefing/workspace.mjs'
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
  const ident = resolved.error ? resolved : resolveWorkspaceIdOrFail(db, resolved)
  const failure = httpStatusForWorkspaceError(ident.error)
  if (failure) {
    sendError(response, failure.status, failure.code, failure.message, correlationId)
    return true
  }
  const query = String(url.searchParams.get('q') || '')
  const sessionId = String(url.searchParams.get('sessionId') || '').trim()
  const sheet = await loadSearchSheet({ aiRuntime, db }, { cwd: ident.cwd || resolved.cwd, query, sessionId })
  sendJson(response, 200, { data: sheet, correlationId })
  return true
}
