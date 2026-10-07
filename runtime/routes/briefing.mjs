import { collectBag } from '../catalog-collect.mjs'
import { resolveAllowedRequestOrigin } from '../config.mjs'
import { getOrCreateDefinition, getBriefing, getLatestBriefing, saveDefinition } from '../briefing/store.mjs'
import { validateSchedule, validateSections, validateSources, validateDelivery } from '../briefing/validate.mjs'
import { runBriefing } from '../briefing/run.mjs'
import { rescheduleBriefingForWorkspace, shouldRunOnOpen } from '../briefing/scheduler.mjs'
import { resolveWorkspaceCwd } from '../briefing/workspace.mjs'
import { FDE_AI_WORKSPACE } from '../config.mjs'

function briefingCors(request, allowedOrigins) {
  const origin = resolveAllowedRequestOrigin(request, allowedOrigins)
  if (!origin) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'Content-Type, X-Correlation-Id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  }
}

function briefingError(response, status, error, message, correlationId, cors = {}) {
  const body = JSON.stringify({ ok: false, error, message, correlationId })
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...cors,
  })
  response.end(body)
}

function briefingOk(response, status, data, correlationId, cors = {}) {
  const body = JSON.stringify({ ok: true, data, correlationId })
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...cors,
  })
  response.end(body)
}

function queryWorkspace(url) {
  return url.searchParams.get('cwd') || url.searchParams.get('workspace')
}

function requireWorkspaceQuery(db, url, response, correlationId, fallbackCwd, cors) {
  const cwd = resolveWorkspaceCwd(db, queryWorkspace(url), fallbackCwd)
  if (!cwd.startsWith('/')) {
    briefingError(response, 400, 'missing_workspace', '需要 workspace 绝对路径', correlationId, cors)
    return ''
  }
  return cwd
}

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @param {URL} url
 */
export async function handleBriefingRoutes(request, response, url, deps) {
  const {
    db,
    aiRuntime,
    allowedOrigins,
    correlationId,
    sendError,
    readJson,
    defaultWorkspaceCwd = FDE_AI_WORKSPACE,
    runBriefingDeps,
  } = deps

  const pathname = url.pathname
  if (!pathname.startsWith('/api/v1/briefing')) return false
  const cors = briefingCors(request, allowedOrigins)

  const writeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method ?? '')
  if (writeMethod) {
    const origin = resolveAllowedRequestOrigin(request, allowedOrigins)
    if (!origin) {
      sendError(response, 403, 'origin_not_allowed', '当前页面来源不被允许', correlationId)
      return true
    }
  }

  if (request.method === 'GET' && pathname === '/api/v1/briefing/definition') {
    const cwd = requireWorkspaceQuery(db, url, response, correlationId, defaultWorkspaceCwd, cors)
    if (!cwd) return true
    try {
      const def = getOrCreateDefinition(db, cwd)
      briefingOk(response, 200, def, correlationId, cors)
    } catch (error) {
      if (error && error.code === 'missing_workspace') {
        briefingError(response, 400, 'missing_workspace', error.message, correlationId, cors)
        return true
      }
      throw error
    }
    return true
  }

  if (request.method === 'PUT' && pathname === '/api/v1/briefing/definition') {
    const body = await readJson(request)
    const cwd = typeof body.workspaceCwd === 'string' && body.workspaceCwd.startsWith('/')
      ? body.workspaceCwd
      : resolveWorkspaceCwd(db, body.workspace, defaultWorkspaceCwd)
    if (!cwd.startsWith('/')) {
      briefingError(response, 400, 'missing_workspace', '需要 workspaceCwd', correlationId, cors)
      return true
    }
    const errors = [
      ...validateSections(body.sections),
      ...validateSchedule(body.schedule),
      ...validateSources(body.sources),
      ...validateDelivery(body.delivery),
    ]
    if (errors.length) {
      briefingError(response, 422, 'validation_error', errors.join('；'), correlationId, cors)
      return true
    }
    try {
      const saved = saveDefinition(db, cwd, {
        sections: body.sections,
        schedule: body.schedule,
        delivery: body.delivery,
      })
      rescheduleBriefingForWorkspace(db, cwd)
      briefingOk(response, 200, saved, correlationId, cors)
    } catch (error) {
      if (error && error.code === 'missing_workspace') {
        briefingError(response, 400, 'missing_workspace', error.message, correlationId, cors)
        return true
      }
      throw error
    }
    return true
  }

  if (request.method === 'POST' && pathname === '/api/v1/briefing/run') {
    const body = await readJson(request)
    const cwd = typeof body.workspaceCwd === 'string' && body.workspaceCwd.startsWith('/')
      ? body.workspaceCwd
      : resolveWorkspaceCwd(db, body.workspace, defaultWorkspaceCwd)
    if (!cwd.startsWith('/')) {
      briefingError(response, 400, 'missing_workspace', '需要 workspaceCwd', correlationId, cors)
      return true
    }
    const mode = body.mode === 'internal-only' ? 'internal-only' : 'full'
    try {
      const result = await runBriefing(runBriefingDeps || { db, aiRuntime }, {
        workspaceCwd: cwd,
        mode,
        sessionId: typeof body.sessionId === 'string' ? body.sessionId.trim() : '',
        definitionId: typeof body.definitionId === 'string' ? body.definitionId : undefined,
      })
      briefingOk(response, 200, { briefingId: result.briefingId, briefing: result.briefing }, correlationId, cors)
    } catch (error) {
      if (error && error.code === 'missing_workspace') {
        briefingError(response, 400, 'missing_workspace', error.message, correlationId, cors)
        return true
      }
      briefingError(response, 500, 'briefing_run_failed', error instanceof Error ? error.message : '生成失败', correlationId, cors)
    }
    return true
  }

  if (request.method === 'GET' && pathname === '/api/v1/briefing/latest') {
    const cwd = requireWorkspaceQuery(db, url, response, correlationId, defaultWorkspaceCwd, cors)
    if (!cwd) return true
    const onOpen = url.searchParams.get('onOpen') === '1'
    if (onOpen && shouldRunOnOpen(db, cwd)) {
      const connected = aiRuntime?.status?.().connected
      void runBriefing(runBriefingDeps || { db, aiRuntime }, {
        workspaceCwd: cwd,
        mode: 'internal-only',
      }).then(() => {
        if (connected) {
          void runBriefing(runBriefingDeps || { db, aiRuntime }, { workspaceCwd: cwd, mode: 'full' })
        }
      }).catch((error) => console.warn('briefing_on_open_failed', error))
    }
    const latest = getLatestBriefing(db, cwd)
    let def
    try {
      def = getOrCreateDefinition(db, cwd)
    } catch (error) {
      if (error && error.code === 'missing_workspace') {
        briefingError(response, 400, 'missing_workspace', error.message, correlationId, cors)
        return true
      }
      throw error
    }
    briefingOk(response, 200, {
      definition: def,
      briefing: latest,
      schedule: def.schedule,
    }, correlationId, cors)
    return true
  }

  const idMatch = pathname.match(/^\/api\/v1\/briefing\/([^/]+)$/)
  if (request.method === 'GET' && idMatch && idMatch[1] !== 'definition' && idMatch[1] !== 'latest' && idMatch[1] !== 'run' && !idMatch[1].startsWith('sources')) {
    const row = getBriefing(db, decodeURIComponent(idMatch[1]))
    if (!row) {
      briefingError(response, 404, 'not_found', '早报不存在', correlationId, cors)
      return true
    }
    briefingOk(response, 200, row, correlationId, cors)
    return true
  }

  if (request.method === 'GET' && pathname === '/api/v1/briefing/sources/mcp') {
    const cwd = requireWorkspaceQuery(db, url, response, correlationId, defaultWorkspaceCwd, cors)
    if (!cwd) return true
    const bag = await collectBag(aiRuntime, 'mcp', { project: true, cwd })
    const servers = Array.isArray(bag.raw?.mcp) ? bag.raw.mcp : []
    const configured = servers.map((row) => row.serverName).filter(Boolean)
    briefingOk(response, 200, { servers, configured }, correlationId, cors)
    return true
  }

  return false
}
