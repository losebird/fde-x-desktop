import { resolveBizCorpusOrigin } from '../biz/corpus-origin.mjs'

function sendJson(response, status, body) {
  const raw = JSON.stringify(body)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(raw),
    'Cache-Control': 'no-store',
  })
  response.end(raw)
}

function notFound(response, correlationId, message) {
  sendJson(response, 404, {
    ok: false,
    error: { code: 'not_found', message },
    message,
    correlationId,
  })
}

async function resolveImMessage(aiRuntime, requestId) {
  const thread = await aiRuntime.lanAssist('/thread', {
    search: { requestId },
  })
  const messages = Array.isArray(thread?.messages) ? thread.messages : []
  const row = messages.find((m) => String(m?.requestId || m?.id || '') === requestId) || messages[0]
  if (!row) return null
  return {
    title: String(row.fromName || row.peerName || 'IM 消息'),
    text: String(row.text || row.body || row.excerpt || '').slice(0, 8000),
    href: { panel: 'im', requestId },
  }
}

function resolveTask(db, taskId) {
  const row = db.prepare('SELECT id, title, notes, status FROM tasks WHERE id = ?').get(taskId)
  if (!row) return null
  return {
    title: row.title,
    text: String(row.notes || row.title || '').slice(0, 8000),
    href: { panel: 'plan', tab: 'todo', taskId: row.id },
  }
}

function resolveBriefing(db, briefingId) {
  const row = db.prepare('SELECT id, content_json, generated_at FROM briefings WHERE id = ?').get(briefingId)
  if (!row) return null
  let ai = ''
  try {
    const content = JSON.parse(row.content_json || '{}')
    ai = String(content.ai || content.aiBlock || content.summary || '').slice(0, 8000)
  } catch {
    ai = ''
  }
  if (!ai) {
    return {
      title: '早报',
      text: '',
      unreadable: '暂时读不出这篇早报的原文。',
      href: { panel: 'briefing', briefingId: row.id },
    }
  }
  return {
    title: '早报',
    text: ai,
    href: { panel: 'briefing', briefingId: row.id },
  }
}

function resolveAppRecord(db, slug, entity, rid) {
  const row = db.prepare(`
    SELECT id, name FROM business_apps WHERE id = ?
  `).get(slug)
  if (!row) return null
  const text = `应用 ${row.name} · ${entity} #${rid}`
  return {
    title: row.name,
    text,
    href: { panel: 'data', tab: 'records', slug, entity, rowId: rid },
  }
}

/**
 * GET /api/v1/corpus/:id
 */
export async function handleCorpusRoute(request, response, url, deps) {
  const match = url.pathname.match(/^\/api\/v1\/corpus\/([^/]+)$/)
  if (!match || request.method !== 'GET') return false
  const { db, aiRuntime, correlationId } = deps
  const id = decodeURIComponent(match[1])

  try {
    if (id.startsWith('biz:')) {
      const traceId = id.slice(4)
      const resolved = await resolveBizCorpusOrigin({
        db,
        aiRuntime,
        traceId,
        url,
      })
      if (resolved.ok) {
        sendJson(response, 200, { ok: true, id, title: resolved.title, text: resolved.text, href: resolved.href, correlationId })
        return true
      }
      sendJson(response, 200, {
        ok: false,
        id,
        title: '当时原文',
        text: '',
        message: resolved.message || '暂时读不出原文',
        href: resolved.href,
        correlationId,
      })
      return true
    }
    if (id.startsWith('im:')) {
      const requestId = id.slice(3)
      const resolved = await resolveImMessage(aiRuntime, requestId)
      if (!resolved) {
        notFound(response, correlationId, '找不到该 IM 消息')
        return true
      }
      sendJson(response, 200, { ok: true, id, ...resolved, correlationId })
      return true
    }
    if (id.startsWith('task:')) {
      const resolved = resolveTask(db, id.slice(5))
      if (!resolved) {
        notFound(response, correlationId, '找不到该任务')
        return true
      }
      sendJson(response, 200, { ok: true, id, ...resolved, correlationId })
      return true
    }
    if (id.startsWith('briefing:')) {
      const resolved = resolveBriefing(db, id.slice(9))
      if (!resolved) {
        notFound(response, correlationId, '找不到该早报')
        return true
      }
      if (resolved.unreadable) {
        sendJson(response, 200, {
          ok: false,
          id,
          title: resolved.title,
          text: '',
          message: resolved.unreadable,
          href: resolved.href,
          correlationId,
        })
        return true
      }
      sendJson(response, 200, { ok: true, id, ...resolved, correlationId })
      return true
    }
    if (id.startsWith('app:')) {
      const parts = id.split(':')
      if (parts.length >= 4) {
        const slug = parts[1]
        const entity = parts[2]
        const rid = parts.slice(3).join(':')
        const resolved = resolveAppRecord(db, slug, entity, rid)
        if (resolved) {
          sendJson(response, 200, { ok: true, id, ...resolved, correlationId })
          return true
        }
      }
    }
    notFound(response, correlationId, '不支持的 corpus id')
    return true
  } catch (error) {
    console.warn('corpus_resolve_failed', id, error)
    sendJson(response, 503, {
      ok: false,
      error: { code: 'corpus_unavailable', message: '暂时读不出原文' },
      message: '暂时读不出原文',
      correlationId,
    })
    return true
  }
}
