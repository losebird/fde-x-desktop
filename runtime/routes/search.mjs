import { loadSearchSheet } from '../search/search-sheet.mjs'

export async function handleSearchRoute(request, response, url, ctx) {
  if (!(request.method === 'GET' && url.pathname === '/api/v1/search')) return false
  const { db, aiRuntime, sendJson, sendError, correlationId } = ctx
  const cwd = String(url.searchParams.get('cwd') || '').trim()
  if (!cwd.startsWith('/')) {
    sendError(response, 400, 'validation_error', '需要当前工作区目录', correlationId)
    return true
  }
  const query = String(url.searchParams.get('q') || '')
  const sessionId = String(url.searchParams.get('sessionId') || '').trim()
  const sheet = await loadSearchSheet({ aiRuntime, db }, { cwd, query, sessionId })
  sendJson(response, 200, { data: sheet, correlationId })
  return true
}
