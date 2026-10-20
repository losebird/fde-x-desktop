import { collectBag, mutateBag, streamBag } from '../catalog-collect.mjs'
import { FDE_AI_WORKSPACE } from '../config.mjs'
import { httpStatusForWorkspaceError, resolveHttpWorkspace } from '../http-workspace.mjs'
import { resolveWorkspaceIdOrFail } from '../briefing/workspace.mjs'

function settleCatalogWorkspace(db, resolved, suppliedId, response, correlationId, sendError) {
  const ident = resolved?.error
    ? resolved
    : resolveWorkspaceIdOrFail(db, { ...resolved, id: suppliedId })
  const failure = httpStatusForWorkspaceError(ident.error)
  if (!failure) return ident
  sendError(response, failure.status, failure.code, failure.message, correlationId)
  return null
}

function catalogWorkspaceId(url, body) {
  if (body && typeof body.workspaceId === 'string' && body.workspaceId.trim()) return body.workspaceId.trim()
  return String(url?.searchParams?.get('workspaceId') || '').trim()
}

export async function handleCatalogRequest(request, response, url, { db, aiRuntime, readJson, sendJson, sendError, openEventStream, writeEvent }, correlationId) {
  if (request.method === 'GET' && url.pathname === '/api/v1/catalog/ws-guard-probe') {
    const cwd = url.searchParams.get('cwd')
    sendJson(response, 200, { ok: true, cwd, correlationId })
    return true
  }
  if (!url.pathname.startsWith('/api/v1/catalog')) return false

  if (request.method === 'GET' && url.pathname === '/api/v1/catalog/stream') {
    const kind = url.searchParams.get('kind') || ''
    const action = url.searchParams.get('action') || ''
    if (!kind || !action) {
      sendError(response, 400, 'validation_error', '缺少 kind 或 action', correlationId)
      return true
    }
    const resolved = resolveHttpWorkspace({
      url,
      slots: [['query', 'cwd'], ['query', 'workspace']],
      runtimeCwd: aiRuntime?.cwd,
      fallbackCwd: FDE_AI_WORKSPACE,
    })
    const ident = settleCatalogWorkspace(db, resolved, catalogWorkspaceId(url, null), response, correlationId, sendError)
    if (!ident) return true
    const abort = new AbortController()
    request.on('close', () => abort.abort())
    try {
      openEventStream(response)
      writeEvent(response, 'catalog', { correlationId, kind, action })
      for await (const frame of streamBag(aiRuntime, {
        kind,
        action,
        cwd: ident.cwd || resolved.cwd,
        workspaceId: ident.workspaceId,
        sessionId: url.searchParams.get('sessionId') || '',
        id: url.searchParams.get('id') || '',
        path: url.searchParams.get('path') || '.',
        params: url.searchParams.get('attachmentId') ? { attachmentId: url.searchParams.get('attachmentId') } : {},
        signal: abort.signal,
      })) {
        writeEvent(response, 'frame', frame)
      }
      writeEvent(response, 'end', { correlationId })
    } catch (error) {
      if (!response.headersSent) {
        sendError(response, 502, 'catalog_stream_failed', error instanceof Error ? error.message : '跟不了这个流', correlationId)
        return true
      }
      writeEvent(response, 'error', { message: error instanceof Error ? error.message : '跟不了这个流', correlationId })
    }
    if (!response.writableEnded) response.end()
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/catalog') {
    const kind = url.searchParams.get('kind') || ''
    if (!kind) {
      sendError(response, 400, 'validation_error', '缺少 kind', correlationId)
      return true
    }
    const resolved = resolveHttpWorkspace({
      url,
      slots: [['query', 'cwd']],
      runtimeCwd: aiRuntime?.cwd,
      fallbackCwd: FDE_AI_WORKSPACE,
    })
    const ident = settleCatalogWorkspace(db, resolved, catalogWorkspaceId(url, null), response, correlationId, sendError)
    if (!ident) return true
    const cwd = ident.cwd || resolved.cwd
    const input = {
      sessionId: url.searchParams.get('sessionId') || '',
      cwd,
      path: url.searchParams.get('path') || '.',
      workspaceId: ident.workspaceId,
    }
    try {
      const bag = await collectBag(aiRuntime, kind, input)
      sendJson(response, 200, { data: bag, correlationId })
    } catch (error) {
      sendError(response, 502, 'catalog_failed', error instanceof Error ? error.message : '读不了目录', correlationId)
    }
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/catalog') {
    const body = await readJson(request)
    const kind = typeof body.kind === 'string' ? body.kind : ''
    const action = typeof body.action === 'string' ? body.action : ''
    if (!kind || !action) {
      sendError(response, 400, 'validation_error', '缺少 kind 或 action', correlationId)
      return true
    }
    const resolved = resolveHttpWorkspace({
      url,
      body,
      slots: [['body', 'cwd'], ['query', 'cwd']],
      runtimeCwd: aiRuntime?.cwd,
      fallbackCwd: FDE_AI_WORKSPACE,
    })
    const ident = settleCatalogWorkspace(db, resolved, catalogWorkspaceId(url, body), response, correlationId, sendError)
    if (!ident) return true
    const cwd = ident.cwd || resolved.cwd
    try {
      const bag = await mutateBag(aiRuntime, {
        kind,
        action,
        sessionId: body.sessionId,
        cwd,
        path: body.path,
        id: body.id,
        status: body.status,
        workspaceId: ident.workspaceId,
        params: body.params,
      })
      sendJson(response, 200, { data: bag, correlationId })
    } catch (error) {
      sendError(response, 502, 'catalog_mutate_failed', error instanceof Error ? error.message : '做不了这个动作', correlationId)
    }
    return true
  }

  return false
}
