import { readFile } from 'node:fs/promises'
import { parseMcpPatchEntries, buildMcpServersV2 } from './mcp.mjs'
import { resolveAllowedRequestOrigin } from '../config.mjs'
import { getOrCreateDefinition, getBriefing, getLatestBriefing, saveDefinition } from '../briefing/store.mjs'
import { validateSchedule, validateSections, validateSources } from '../briefing/validate.mjs'
import { runBriefing } from '../briefing/run.mjs'
import { rescheduleBriefingForWorkspace, shouldRunOnOpen } from '../briefing/scheduler.mjs'
import { resolveWorkspaceCwd } from '../briefing/workspace.mjs'
import { FDE_AI_WORKSPACE } from '../config.mjs'

function briefingError(response, status, error, message, correlationId) {
  const body = JSON.stringify({ ok: false, error, message, correlationId })
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  response.end(body)
}

function briefingOk(response, status, data, correlationId) {
  const body = JSON.stringify({ ok: true, data, correlationId })
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  response.end(body)
}

function requireWorkspaceQuery(db, url, response, correlationId, fallbackCwd) {
  const cwd = resolveWorkspaceCwd(db, url.searchParams.get('workspace'), fallbackCwd)
  if (!cwd.startsWith('/')) {
    briefingError(response, 400, 'missing_workspace', '需要 workspace 绝对路径', correlationId)
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

  const writeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method ?? '')
  if (writeMethod) {
    const origin = resolveAllowedRequestOrigin(request, allowedOrigins)
    if (!origin) {
      sendError(response, 403, 'origin_not_allowed', '当前页面来源不被允许', correlationId)
      return true
    }
  }

  if (request.method === 'GET' && pathname === '/api/v1/briefing/definition') {
    const cwd = requireWorkspaceQuery(db, url, response, correlationId, defaultWorkspaceCwd)
    if (!cwd) return true
    const def = getOrCreateDefinition(db, cwd)
    briefingOk(response, 200, def, correlationId)
    return true
  }

  if (request.method === 'PUT' && pathname === '/api/v1/briefing/definition') {
    const body = await readJson(request)
    const cwd = typeof body.workspaceCwd === 'string' && body.workspaceCwd.startsWith('/')
      ? body.workspaceCwd
      : resolveWorkspaceCwd(db, body.workspace, defaultWorkspaceCwd)
    if (!cwd.startsWith('/')) {
      briefingError(response, 400, 'missing_workspace', '需要 workspaceCwd', correlationId)
      return true
    }
    const errors = [
      ...validateSections(body.sections),
      ...validateSchedule(body.schedule),
      ...validateSources(body.sources),
    ]
    if (errors.length) {
      briefingError(response, 422, 'validation_error', errors.join('；'), correlationId)
      return true
    }
    const saved = saveDefinition(db, cwd, {
      sections: body.sections,
      schedule: body.schedule,
      sources: body.sources,
    })
    rescheduleBriefingForWorkspace(db, cwd)
    briefingOk(response, 200, saved, correlationId)
    return true
  }

  if (request.method === 'POST' && pathname === '/api/v1/briefing/run') {
    const body = await readJson(request)
    const cwd = typeof body.workspaceCwd === 'string' && body.workspaceCwd.startsWith('/')
      ? body.workspaceCwd
      : resolveWorkspaceCwd(db, body.workspace, defaultWorkspaceCwd)
    if (!cwd.startsWith('/')) {
      briefingError(response, 400, 'missing_workspace', '需要 workspaceCwd', correlationId)
      return true
    }
    const mode = body.mode === 'internal-only' ? 'internal-only' : 'full'
    try {
      const result = await runBriefing(runBriefingDeps || { db, aiRuntime }, {
        workspaceCwd: cwd,
        mode,
        definitionId: typeof body.definitionId === 'string' ? body.definitionId : undefined,
      })
      briefingOk(response, 200, { briefingId: result.briefingId, briefing: result.briefing }, correlationId)
    } catch (error) {
      briefingError(response, 500, 'briefing_run_failed', error instanceof Error ? error.message : '生成失败', correlationId)
    }
    return true
  }

  if (request.method === 'GET' && pathname === '/api/v1/briefing/latest') {
    const cwd = requireWorkspaceQuery(db, url, response, correlationId, defaultWorkspaceCwd)
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
    const def = getOrCreateDefinition(db, cwd)
    briefingOk(response, 200, {
      definition: def,
      briefing: latest,
      schedule: def.schedule,
    }, correlationId)
    return true
  }

  const idMatch = pathname.match(/^\/api\/v1\/briefing\/([^/]+)$/)
  if (request.method === 'GET' && idMatch && idMatch[1] !== 'definition' && idMatch[1] !== 'latest' && idMatch[1] !== 'run' && !idMatch[1].startsWith('sources')) {
    const row = getBriefing(db, decodeURIComponent(idMatch[1]))
    if (!row) {
      briefingError(response, 404, 'not_found', '早报不存在', correlationId)
      return true
    }
    briefingOk(response, 200, row, correlationId)
    return true
  }

  if (request.method === 'GET' && pathname === '/api/v1/briefing/sources/mcp') {
    const cwd = requireWorkspaceQuery(db, url, response, correlationId, defaultWorkspaceCwd)
    if (!cwd) return true
    let text = ''
    try {
      text = await readFile(aiRuntime.patchFile, 'utf8')
    } catch {
      text = ''
    }
    const servers = await buildMcpServersV2(aiRuntime, text)
    const configured = parseMcpPatchEntries(text).map((row) => row.serverName)
    briefingOk(response, 200, { servers, configured }, correlationId)
    return true
  }

  return false
}
