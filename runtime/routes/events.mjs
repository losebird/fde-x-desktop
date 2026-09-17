import { resolveAllowedRequestOrigin } from '../config.mjs'
import {
  configureEventBus,
  emit,
  listEventsAfter,
  listRecentEvents,
  matchesWorkspaceFilter,
  subscribe,
} from '../events.mjs'

const MAX_SSE_CONNECTIONS = 32
const PING_INTERVAL_MS = 25_000

/** @type {Set<import('node:http').ServerResponse>} */
const activeSse = new Set()

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @param {URL} url
 * @param {{
 *   db: import('node:sqlite').DatabaseSync,
 *   allowedOrigins: Set<string>,
 *   correlationId: string,
 *   sendError: Function,
 *   sendJson: Function,
 * }} deps
 */
export async function handleEventsRoutes(request, response, url, deps) {
  const { db, allowedOrigins, correlationId, sendError, sendJson } = deps
  configureEventBus(db)

  const pathname = url.pathname
  if (pathname === '/api/v1/events/pending') return false
  if (!pathname.startsWith('/api/v1/events')) return false

  const origin = resolveAllowedRequestOrigin(request, allowedOrigins)
  if (!origin) {
    sendError(response, 403, 'origin_not_allowed', '当前页面来源不被允许', correlationId)
    return true
  }

  if (request.method === 'GET' && pathname === '/api/v1/events/recent') {
    const workspace = String(url.searchParams.get('workspace') || '').trim()
    const type = String(url.searchParams.get('type') || '').trim()
    const limit = Number(url.searchParams.get('limit') ?? 50)
    const workspaceCwd = workspace.startsWith('/') ? workspace : undefined
    const items = listRecentEvents(db, {
      workspaceCwd,
      type: type || undefined,
      limit,
    })
    sendJson(response, 200, { items, correlationId })
    return true
  }

  if (request.method === 'GET' && pathname === '/api/v1/events') {
    if (activeSse.size >= MAX_SSE_CONNECTIONS) {
      sendError(response, 429, 'too_many_connections', '事件流连接过多，请稍后重试', correlationId)
      return true
    }

    const workspace = String(url.searchParams.get('workspace') || '').trim()
    const workspaceCwd = workspace.startsWith('/') ? workspace : undefined
    const since = String(url.searchParams.get('since') || '').trim()

    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
    })
    response.write(': connected\n\n')

    activeSse.add(response)

    const writeEnvelope = (envelope) => {
      if (!matchesWorkspaceFilter(envelope, workspaceCwd)) return
      if (response.writableEnded) return
      response.write(`id: ${envelope.id}\n`)
      response.write(`event: ${envelope.type}\n`)
      response.write(`data: ${JSON.stringify(envelope)}\n\n`)
    }

    for (const envelope of listEventsAfter(db, { sinceId: since || undefined, workspaceCwd })) {
      writeEnvelope(envelope)
    }

    const unsubscribe = subscribe((envelope) => {
      writeEnvelope(envelope)
    })

    const pingTimer = setInterval(() => {
      if (!response.writableEnded) response.write(': ping\n\n')
    }, PING_INTERVAL_MS)

    const close = () => {
      clearInterval(pingTimer)
      unsubscribe()
      activeSse.delete(response)
    }
    request.on('close', close)
    response.on('close', close)
    return true
  }

  return false
}

export { emit, subscribe }
