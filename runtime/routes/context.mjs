import { buildContextPack } from '../context-pack.mjs'
import { FDE_AI_WORKSPACE } from '../config.mjs'
import { resolveHttpWorkspace } from '../http-workspace.mjs'

function sendJson(response, status, body) {
  const raw = JSON.stringify(body)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(raw),
    'Cache-Control': 'no-store',
  })
  response.end(raw)
}

/**
 * POST /api/v1/context/pack
 */
export async function handleContextPackRoute(request, response, url, deps) {
  if (url.pathname !== '/api/v1/context/pack' || request.method !== 'POST') return false
  const { readJson, db, aiRuntime, correlationId, sendError } = deps
  let body = {}
  try {
    body = await readJson(request)
  } catch {
    sendError(response, 400, 'invalid_json', '请求体不是合法 JSON', correlationId)
    return true
  }
  const resolvedPack = resolveHttpWorkspace({
    url,
    body,
    slots: [['body', 'workspaceCwd'], ['body', 'cwd']],
    runtimeCwd: aiRuntime?.cwd,
    fallbackCwd: FDE_AI_WORKSPACE,
  })
  if (resolvedPack.error) {
    sendError(response, 400, 'workspace_invalid', '工作区必须是绝对路径', correlationId)
    return true
  }
  const workspaceCwd = resolvedPack.cwd
  const scopes = Array.isArray(body.scopes) ? body.scopes.map(String) : []
  const { pack, warnings } = await buildContextPack(
    { db, aiRuntime },
    {
      workspaceCwd,
      scopes,
      query: typeof body.query === 'string' ? body.query : undefined,
      entity: body.entity,
      intentKind: body.intentKind,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
      taskIds: body.taskIds,
    },
  )
  sendJson(response, 200, { ok: true, data: pack, warnings, correlationId })
  return true
}
