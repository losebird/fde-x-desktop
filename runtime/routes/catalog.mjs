import { collectBag, mutateBag, streamBag } from '../catalog-collect.mjs'

export async function handleCatalogRequest(request, response, url, { aiRuntime, readJson, sendJson, sendError, openEventStream, writeEvent }, correlationId) {
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
    const input = {
      sessionId: url.searchParams.get('sessionId') || '',
      cwd: url.searchParams.get('cwd') || '',
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
    try {
      const bag = await mutateBag(aiRuntime, {
        kind,
        action,
        sessionId: body.sessionId,
        cwd: body.cwd,
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
