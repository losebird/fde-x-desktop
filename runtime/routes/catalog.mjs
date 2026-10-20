import { collectBag, mutateBag, streamBag } from '../catalog-collect.mjs'
import { FDE_AI_WORKSPACE } from '../config.mjs'
import { httpStatusForWorkspaceError, resolveHttpWorkspace } from '../http-workspace.mjs'
import { resolveWorkspaceIdOrFail } from '../briefing/workspace.mjs'

function rejectCatalogWorkspace(db, resolved, response, correlationId, sendError) {
  const failure = httpStatusForWorkspaceError(resolved?.error)
    || httpStatusForWorkspaceError(resolveWorkspaceIdOrFail(db, resolved).error)
  if (!failure) return false
  sendError(response, failure.status, failure.code, failure.message, correlationId)
  return true
}

export async function handleCatalogRequest(request, response, url, { db, aiRuntime, readJson, sendJson, sendError, openEventStream, writeEvent }, correlationId) {
  if (!url.pathname.startsWith('/api/v1/catalog')) return false

  if (request.method === 'GET' && url.pathname === '/api/v1/catalog/stream') {
    const kind = url.searchParams.get('kind') || ''
    const action = url.searchParams.get('action') || ''
    if (!kind || !action) {
      sendError(response, 400, 'validation_error', '缺少 kind 或 action', correlationId)
      return true
    }
    const abort = new AbortController()
    request.on('close', () => abort.abort())
    try {
      openEventStream(response)
      writeEvent(response, 'catalog', { correlationId, kind, action })
      for await (const frame of streamBag(aiRuntime, {
        kind,
        action,
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
    if (rejectCatalogWorkspace(db, resolved, response, correlationId, sendError)) return true
    const cwd = resolved.cwd
    const input = {
      sessionId: url.searchParams.get('sessionId') || '',
      cwd,
      path: url.searchParams.get('path') || '.',
      workspaceId: url.searchParams.get('workspaceId') || '',
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
    if (rejectCatalogWorkspace(db, resolved, response, correlationId, sendError)) return true
    const cwd = resolved.cwd
    try {
      const bag = await mutateBag(aiRuntime, {
        kind,
        action,
        sessionId: body.sessionId,
        cwd,
        path: body.path,
        id: body.id,
        status: body.status,
        workspaceId: body.workspaceId,
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
