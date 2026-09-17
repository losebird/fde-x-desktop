import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { emit } from '../events.mjs'
import { buildContextPack } from '../context-pack.mjs'
import { draftMemoryFromBridge } from '../memory/writer.mjs'
import { fdeRunDirectory, FDE_DSH_HOME } from '../config.mjs'
import { handleAppsBridge } from './apps.mjs'

const READY_TTL_MS = 10 * 60 * 1000

/**
 * @param {string} [dshHome]
 */
export async function ensureBridgeToken(dshHome = FDE_DSH_HOME) {
  const dir = fdeRunDirectory(dshHome)
  await mkdir(dir, { recursive: true })
  const tokenPath = join(dir, 'bridge.token')
  if (existsSync(tokenPath)) {
    return String(await readFile(tokenPath, 'utf8')).trim()
  }
  const token = randomBytes(32).toString('hex')
  await writeFile(tokenPath, `${token}\n`, 'utf8')
  return token
}

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {string} expected
 */
export function verifyBridgeToken(request, expected) {
  const raw = request.headers['x-fde-bridge-token']
  const value = typeof raw === 'string' ? raw.trim() : Array.isArray(raw) ? String(raw[0] || '').trim() : ''
  return Boolean(value && expected && value === expected)
}

function bridgeError(response, status, error, message, correlationId) {
  const body = JSON.stringify({ ok: false, error, message, correlationId })
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  response.end(body)
}

function bridgeOk(response, status, data, correlationId) {
  const body = JSON.stringify({ ok: true, data, correlationId })
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  response.end(body)
}

async function readJsonBody(request, limit = 4 * 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) throw new Error('body_too_large')
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  return JSON.parse(raw)
}

function notImplemented(response, correlationId, owner) {
  bridgeError(
    response,
    501,
    'not_implemented',
    `该能力由规格 ${owner} 实现，当前仅保留桥接握手`,
    correlationId,
  )
}

/**
 * Bridge token routes (no Origin gate). Returns true when handled.
 */
export async function handleBridgeRoutes(request, response, url, deps) {
  const { db, bridgeToken, correlationId, readJson, aiRuntime } = deps
  if (!url.pathname.startsWith('/api/v1/bridge/')) return false

  if (!verifyBridgeToken(request, bridgeToken)) {
    bridgeError(response, 401, 'bridge_unauthorized', '桥接令牌无效或缺失', correlationId)
    return true
  }

  if (request.method !== 'POST') {
    bridgeError(response, 405, 'method_not_allowed', '仅支持 POST', correlationId)
    return true
  }

  const sub = url.pathname.slice('/api/v1/bridge/'.length)
  let body = {}
  try {
    body = typeof readJson === 'function' ? await readJson(request) : await readJsonBody(request)
  } catch {
    bridgeError(response, 400, 'invalid_json', '请求体不是合法 JSON', correlationId)
    return true
  }

  const workspaceCwd = typeof body.workspaceCwd === 'string' && body.workspaceCwd.startsWith('/')
    ? body.workspaceCwd
    : ''
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''

  if (sub === 'submit-result') {
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : ''
    const kind = body.kind === 'text' || body.kind === 'json' ? body.kind : ''
    if (!requestId || !kind || body.data === undefined) {
      bridgeError(response, 400, 'validation_error', '需要 requestId、kind、data', correlationId)
      return true
    }
    if (!workspaceCwd) {
      bridgeError(response, 400, 'validation_error', '需要工作区 cwd', correlationId)
      return true
    }
    const createdAt = Date.now()
    const dataJson = JSON.stringify(body.data)
    db.prepare(`
      INSERT INTO ai_results (request_id, workspace_cwd, session_id, kind, data_json, summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(request_id) DO UPDATE SET
        workspace_cwd = excluded.workspace_cwd,
        session_id = excluded.session_id,
        kind = excluded.kind,
        data_json = excluded.data_json,
        summary = excluded.summary,
        created_at = excluded.created_at
    `).run(
      requestId,
      workspaceCwd,
      sessionId || null,
      kind,
      dataJson,
      typeof body.summary === 'string' ? body.summary : null,
      createdAt,
    )
    emit('ai.result.ready', { requestId }, { workspaceCwd, sessionId: sessionId || undefined })
    bridgeOk(response, 200, { ok: true }, correlationId)
    return true
  }

  if (sub === 'context') {
    const scope = Array.isArray(body.scope) ? body.scope : []
    if (!scope.length) {
      bridgeError(response, 400, 'validation_error', 'scope 不能为空', correlationId)
      return true
    }
    const { pack, warnings } = await buildContextPack(
      { db, aiRuntime },
      {
        workspaceCwd,
        scopes: scope,
        sessionId,
        query: typeof body.query === 'string' ? body.query : undefined,
        intentKind: body.intentKind,
      },
    )
    bridgeOk(response, 200, { ...pack, warnings }, correlationId)
    return true
  }

  if (sub === 'app-spec-submit' || sub === 'app-records-query' || sub === 'app-records-propose') {
    const bridgeResult = handleAppsBridge(sub, body, db, workspaceCwd)
    if (bridgeResult) {
      bridgeOk(response, bridgeResult.ok === false ? 422 : 200, bridgeResult, correlationId)
      return true
    }
    notImplemented(response, correlationId, '04')
    return true
  }
  if (sub === 'briefing-submit') {
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : ''
    const sections = Array.isArray(body.sections) ? body.sections : null
    if (!requestId || !sections) {
      bridgeError(response, 400, 'validation_error', '需要 requestId、sections', correlationId)
      return true
    }
    const { mergeBriefingSubmit } = await import('../briefing/run.mjs')
    const result = mergeBriefingSubmit(db, requestId, sections)
    if (!result.ok) {
      bridgeError(response, 404, result.error || 'not_found', '找不到对应早报任务', correlationId)
      return true
    }
    bridgeOk(response, 200, result, correlationId)
    return true
  }
  if (sub === 'memory-draft') {
    if (!workspaceCwd) {
      bridgeError(response, 400, 'validation_error', '需要工作区 cwd', correlationId)
      return true
    }
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const cardBody = typeof body.body === 'string' ? body.body.trim() : ''
    const layer = typeof body.layer === 'string' ? body.layer.trim() : 'project'
    const refs = Array.isArray(body.refs) ? body.refs.map(String) : []
    if (!title || !cardBody || !refs.length) {
      bridgeError(response, 400, 'validation_error', '需要 title、body、refs', correlationId)
      return true
    }
    const result = await draftMemoryFromBridge({ db, aiRuntime }, {
      workspaceCwd,
      title,
      body: cardBody,
      layer,
      refs,
    })
    bridgeOk(response, 200, result, correlationId)
    return true
  }

  bridgeError(response, 404, 'not_found', '未知桥接路由', correlationId)
  return true
}

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @param {URL} url
 */
export function handleAiResultGet(request, response, url, deps) {
  const { db, correlationId, sendJson, sendError } = deps
  const match = url.pathname.match(/^\/api\/v1\/ai\/results\/([^/]+)$/)
  if (!match || request.method !== 'GET') return false

  const requestId = decodeURIComponent(match[1])
  const row = db.prepare('SELECT * FROM ai_results WHERE request_id = ?').get(requestId)
  if (!row) {
    sendJson(response, 200, {
      data: { status: 'pending', requestId },
      correlationId,
    })
    return true
  }

  const age = Date.now() - Number(row.created_at)
  if (age > READY_TTL_MS) {
    sendJson(response, 200, {
      data: { status: 'expired', requestId },
      correlationId,
    })
    return true
  }

  let data
  try {
    data = JSON.parse(String(row.data_json))
  } catch {
    sendError(response, 500, 'corrupt_result', '结果数据损坏', correlationId)
    return true
  }

  sendJson(response, 200, {
    data: {
      status: 'ready',
      requestId,
      kind: row.kind,
      data,
      summary: row.summary ?? undefined,
      sessionId: row.session_id ?? undefined,
    },
    correlationId,
  })
  return true
}
