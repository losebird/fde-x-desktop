import { readFile } from 'node:fs/promises'
import { realpath } from 'node:fs/promises'
import { join, resolve as resolvePath } from 'node:path'
import { resolveBizCorpusOrigin } from '../biz/corpus-origin.mjs'
import { readSessionUserOrigin } from '../biz/session-origin-text.mjs'
import { findActiveAppBySlug } from '../apps/repository.mjs'
import { getRecord } from '../apps/records.mjs'
import { listWorkspaces } from '../db.mjs'
import { filePathOf, originOfCard, sessionIdOf } from '../memory/identity.mjs'
import { bizTraceIdOf, originHref } from '../memory/origin-href.mjs'

function fallbackSendJson(response, status, body) {
  const raw = JSON.stringify(body)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(raw),
    'Cache-Control': 'no-store',
  })
  response.end(raw)
}

async function resolveImMessage(aiRuntime, requestId) {
  const thread = await aiRuntime.lanAssist('/thread', {
    search: { requestId },
  })
  const messages = Array.isArray(thread?.messages) ? thread.messages : []
  const row = messages.find((m) => String(m?.requestId || m?.id || '') === requestId) || messages[0]
  if (!row) return null
  const selfId = String(thread?.selfId || thread?.self?.id || '')
  return {
    title: String(row.fromName || row.peerName || 'IM 消息'),
    text: String(row.text || row.body || row.excerpt || '').slice(0, 8000),
    href: originHref(`im:${requestId}`, {
      mailbox: { self: { id: selfId }, requests: [row] },
    }) || { panel: 'im', requestId },
  }
}

function resolveTask(db, taskId) {
  const row = db.prepare('SELECT id, title, notes, status FROM tasks WHERE id = ?').get(taskId)
  if (!row) return null
  return {
    title: row.title,
    text: String(row.notes || row.title || '').slice(0, 8000),
    href: originHref(`task:${row.id}`) || { panel: 'plan', tab: 'todo', taskId: row.id },
  }
}

function resolveBriefing(db, briefingId) {
  const row = db.prepare('SELECT id, content_json, generated_at FROM briefings WHERE id = ?').get(briefingId)
  if (!row) return null
  let content = {}
  try {
    content = JSON.parse(row.content_json || '{}')
  } catch {
    content = {}
  }
  const ai = String(content.ai || content.aiBlock || content.summary || '').slice(0, 8000)
  const sessionId = String(content.sessionId || '').trim()
  const href = originHref(`briefing:${row.id}`, { sessionId }) || { panel: 'briefing', briefingId: row.id, ...(sessionId ? { sessionId } : {}) }
  if (!ai) {
    return {
      title: '早报',
      text: '',
      unreadable: '暂时读不出这篇早报的原文。',
      href,
    }
  }
  return {
    title: '早报',
    text: ai,
    href,
  }
}

function workspaceRowForCwd(db, workspaceCwd) {
  const rows = listWorkspaces(db)
  for (const row of rows) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    const path = typeof meta.cwd === 'string' ? meta.cwd : typeof meta.path === 'string' ? meta.path : ''
    if (path === workspaceCwd) return row
  }
  return null
}

function resolveAppSpec(db, slug, workspaceCwd) {
  const href = originHref(`app:${slug}`) || { panel: 'data', slug }
  const ws = workspaceRowForCwd(db, workspaceCwd)
  const app = findActiveAppBySlug(db, ws?.id || '', slug, workspaceCwd)
  if (!app) return null
  const spec = app.spec && typeof app.spec === 'object' ? app.spec : {}
  const desc = String(spec.description || '')
  const text = [app.name, desc].filter(Boolean).join('\n')
  return {
    title: app.name,
    text: text.slice(0, 8000),
    href,
  }
}

function resolveAppRecord(db, slug, entity, rid, workspaceCwd) {
  const href = originHref(`app:${slug}:${entity}:${rid}`) || { panel: 'data', tab: 'records', slug, entity, rowId: rid }
  const ws = workspaceRowForCwd(db, workspaceCwd)
  const app = findActiveAppBySlug(db, ws?.id || '', slug, workspaceCwd)
  if (!app) return null
  let row = null
  try {
    row = workspaceCwd ? getRecord(db, app.spec, entity, workspaceCwd, rid) : null
  } catch {
    row = null
  }
  const text = row
    ? JSON.stringify(row).slice(0, 8000)
    : `应用 ${app.name} · ${entity} #${rid}`
  return {
    title: app.name,
    text,
    href,
  }
}

async function resolveSession(sessionKey) {
  const sessionId = sessionIdOf(sessionKey.startsWith('session:') ? sessionKey : `session:${sessionKey}`)
  if (!sessionId) return null
  const text = await readSessionUserOrigin(sessionId)
  if (!text) {
    return {
      title: '会话',
      text: '',
      unreadable: '暂时读不出这场会话的原文。',
      href: originHref(`session:${sessionId}`) || { panel: 'ai', sessionId },
    }
  }
  return {
    title: '会话',
    text: text.slice(0, 8000),
    href: originHref(`session:${sessionId}`) || { panel: 'ai', sessionId },
  }
}

async function resolveFile(cwd, fileId) {
  const rel = filePathOf(fileId)
  if (!rel || !cwd || !cwd.startsWith('/')) return null
  const root = await realpath(cwd).catch(() => '')
  if (!root) return null
  const abs = rel.startsWith('/') ? rel : join(cwd, rel)
  const resolved = resolvePath(abs)
  const live = await realpath(resolved).catch(() => '')
  if (!live || live !== root && !live.startsWith(`${root}/`)) return null
  const text = await readFile(live, 'utf8').catch(() => '')
  return {
    title: rel,
    text: String(text || '').slice(0, 8000),
    href: { panel: 'files', path: rel.startsWith('/') ? live.slice(root.length + 1) || live : rel },
  }
}

async function resolveMemoryCard(aiRuntime, cwd, cardId) {
  if (!aiRuntime || typeof aiRuntime.semanticOs !== 'function') return null
  const payload = await aiRuntime.semanticOs('/python', {
    op: 'list_memory_cards',
    args: { include_filed: true, limit: 80 },
    ...(cwd ? { cwd } : {}),
  })
  const cards = Array.isArray(payload?.cards) ? payload.cards : []
  const row = cards.find((item) => String(item?.id || item?.card_id || '') === cardId)
  if (!row) return null
  const text = String(row.cue || row.label || row.content || row.body || '').slice(0, 8000)
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const origin = originOfCard(row)
  const originLand = origin ? originHref(origin) : null
  return {
    title: String(row.cue || row.label || cardId),
    text,
    href: originLand || originHref(cardId) || { panel: 'memory', pane: 'cards', cardId },
    status: String(row.status || meta.status || ''),
    origin,
  }
}

function cwdOf(url) {
  const raw = String(url?.searchParams?.get('cwd') || url?.searchParams?.get('workspace') || '').trim()
  return raw.startsWith('/') ? raw : ''
}

/**
 * Official origin reader. Event writers and 打开来源 both call this.
 * @returns {Promise<{ ok: boolean, title?: string, text?: string, href?: Record<string, unknown>, message?: string, missing?: boolean }>}
 */
export async function loadOrigin(deps, id) {
  const { db, aiRuntime, url } = deps
  const cwd = cwdOf(url) || String(deps.cwd || '')
  if (id.startsWith('biz:')) {
    const traceId = bizTraceIdOf(id)
    if (!traceId) return { ok: false, missing: true, message: '不支持的 corpus id' }
    const resolved = await resolveBizCorpusOrigin({
      db,
      aiRuntime,
      traceId,
      url,
    })
    if (resolved.ok) return { ok: true, title: resolved.title, text: resolved.text, href: resolved.href }
    return { ok: false, title: '当时原文', text: '', message: resolved.message || '暂时读不出原文', href: resolved.href }
  }
  if (id.startsWith('im:')) {
    const resolved = await resolveImMessage(aiRuntime, id.slice(3))
    if (!resolved) return { ok: false, missing: true, message: '找不到该 IM 消息' }
    return { ok: true, ...resolved }
  }
  if (id.startsWith('task:')) {
    const resolved = resolveTask(db, id.slice(5))
    if (!resolved) return { ok: false, missing: true, message: '找不到该任务' }
    return { ok: true, ...resolved }
  }
  if (id.startsWith('briefing:')) {
    const resolved = resolveBriefing(db, id.slice(9))
    if (!resolved) return { ok: false, missing: true, message: '找不到该早报' }
    if (resolved.unreadable) {
      return { ok: false, title: resolved.title, text: '', message: resolved.unreadable, href: resolved.href }
    }
    return { ok: true, ...resolved }
  }
  if (id.startsWith('app:')) {
    const parts = id.split(':')
    if (parts.length >= 4) {
      const slug = parts[1]
      const entity = parts[2]
      const rid = parts.slice(3).join(':')
      const resolved = resolveAppRecord(db, slug, entity, rid, cwd)
      if (resolved) return { ok: true, ...resolved }
      return { ok: false, missing: true, message: '找不到该应用记录' }
    }
    if (parts[1]) {
      const resolved = resolveAppSpec(db, parts[1], cwd)
      if (resolved) return { ok: true, ...resolved }
    }
    return { ok: false, missing: true, message: '找不到该应用' }
  }
  if (id.startsWith('session:')) {
    const resolved = await resolveSession(id)
    if (!resolved) return { ok: false, missing: true, message: '找不到该会话' }
    if (resolved.unreadable) {
      return { ok: false, title: resolved.title, text: '', message: resolved.unreadable, href: resolved.href }
    }
    return { ok: true, ...resolved }
  }
  if (id.startsWith('file:')) {
    const resolved = await resolveFile(cwd, id)
    if (!resolved) return { ok: false, missing: true, message: '找不到该文件' }
    return { ok: true, ...resolved }
  }
  if (id.startsWith('memory:')) {
    const resolved = await resolveMemoryCard(aiRuntime, cwd, id)
    if (!resolved) return { ok: false, missing: true, message: '找不到该记忆卡片' }
    return { ok: true, ...resolved }
  }
  return { ok: false, missing: true, message: '不支持的 corpus id' }
}

/**
 * GET /api/v1/corpus/:id
 */
export async function handleCorpusRoute(request, response, url, deps) {
  const match = url.pathname.match(/^\/api\/v1\/corpus\/([^/]+)$/)
  if (!match || request.method !== 'GET') return false
  const { db, aiRuntime, correlationId } = deps
  const sendJson = typeof deps.sendJson === 'function' ? deps.sendJson : fallbackSendJson
  const notFound = (message) => sendJson(response, 404, {
    ok: false,
    error: { code: 'not_found', message },
    message,
    correlationId,
  })
  const id = decodeURIComponent(match[1])

  try {
    const resolved = await loadOrigin({ db, aiRuntime, url, cwd: cwdOf(url) }, id)
    if (resolved.missing) {
      notFound(resolved.message || '找不到原文')
      return true
    }
    sendJson(response, 200, {
      ok: Boolean(resolved.ok),
      id,
      title: resolved.title,
      text: resolved.text || '',
      message: resolved.message,
      href: resolved.href,
      status: resolved.status,
      origin: resolved.origin,
      correlationId,
    })
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
