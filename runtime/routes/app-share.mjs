import { emit } from '../events.mjs'
import { executeSetAction, findAction } from '../apps/actions.mjs'
import { specRecordsViaMcp } from '../apps/bound-records.mjs'
import {
  computeStat,
  deleteRecord,
  getRecord,
  insertRecord,
  listRecords,
  patchRecord,
} from '../apps/records.mjs'
import { resolveLiveShare } from '../apps/share.mjs'
import { isWebAppSpec } from '../apps/spec.mjs'
import { serveWebAppAsset } from '../apps/web-host.mjs'
import { getDocument, putDocument } from '../apps/documents.mjs'

function sendInvokeError(sendError, response, error, correlationId) {
  const code = String(error?.code || 'invoke_failed')
  const status = code === 'no_session' || code === 'not_projected' || code === 'timeout' ? 503 : 400
  sendError(response, status, code, error instanceof Error ? error.message : '调用失败', correlationId)
}

function publicAppPayload(resolved) {
  const { app } = resolved
  return {
    id: app.id,
    workspaceId: app.workspaceId,
    name: app.name,
    appKind: app.appKind,
    status: app.status,
    currentRevision: app.currentRevision,
    spec: app.spec,
    revisions: [],
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
    deletedAt: app.deletedAt || '',
  }
}

function requireShare(db, shareId, sendError, response, correlationId) {
  const resolved = resolveLiveShare(db, shareId)
  if (!resolved) {
    sendError(response, 404, 'not_found', '分享不存在或已停止', correlationId)
    return null
  }
  return resolved
}

function refuseBoundLedger(app, sendError, response, correlationId) {
  if (!specRecordsViaMcp(app.spec)) return false
  sendError(response, 400, 'local_ledger_only', '公开页只读写这份应用的本地台账', correlationId)
  return true
}

/**
 * Public live-instance face. ShareId is the capability; Origin is not.
 *
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @param {URL} url
 * @param {{
 *   db: import('node:sqlite').DatabaseSync,
 *   correlationId: string,
 *   sendError: Function,
 *   sendJson: Function,
 *   readJson: Function,
 * }} deps
 */
export function handlePublicWebBundle(request, response, url, { db }) {
  const match = url.pathname.match(/^\/a\/([^/]+)(?:\/(.*))?$/)
  if (!match) return false
  if (request.method !== 'GET' && request.method !== 'HEAD') return false
  const shareId = decodeURIComponent(match[1])
  const rest = match[2] ? decodeURIComponent(match[2]) : ''
  const resolved = resolveLiveShare(db, shareId)
  if (!resolved || !isWebAppSpec(resolved.app.spec)) return false
  const served = serveWebAppAsset(request, response, {
    spec: resolved.app.spec,
    workspaceCwd: resolved.workspaceCwd,
    relPath: rest,
    livePrefix: `/a/${encodeURIComponent(shareId)}`,
    storePrefix: `/api/v1/app-share/${encodeURIComponent(shareId)}/store`,
    db,
    appId: resolved.app.id,
  })
  if (!served) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
    response.end('文件不存在')
  }
  return true
}

export async function handleAppShareRoutes(request, response, url, deps) {
  const { db, correlationId, sendError, sendJson, readJson } = deps
  const pathname = url.pathname
  if (!pathname.startsWith('/api/v1/app-share/')) return false

  const rest = pathname.slice('/api/v1/app-share/'.length)
  const parts = rest.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
  const shareId = parts[0] || ''
  if (!shareId) {
    sendError(response, 404, 'not_found', '分享不存在或已停止', correlationId)
    return true
  }

  if (request.method === 'GET' && parts.length === 1) {
    const resolved = requireShare(db, shareId, sendError, response, correlationId)
    if (!resolved) return true
    sendJson(response, 200, { ok: true, data: publicAppPayload(resolved), correlationId })
    return true
  }

  if (parts[1] === 'store' && parts.length === 3) {
    const resolved = requireShare(db, shareId, sendError, response, correlationId)
    if (!resolved) return true
    if (!isWebAppSpec(resolved.app.spec)) {
      sendError(response, 404, 'not_found', '不是托管 Web 应用', correlationId)
      return true
    }
    const key = parts[2]
    const slug = String(resolved.app.spec?.slug || resolved.share.slug || '')
    if (request.method === 'GET') {
      const value = getDocument(db, { appId: resolved.app.id, workspaceCwd: resolved.workspaceCwd, key })
      sendJson(response, 200, { ok: true, data: value, correlationId })
      return true
    }
    if (request.method === 'PUT' || request.method === 'POST') {
      const body = await readJson(request)
      try {
        const saved = putDocument(db, {
          appId: resolved.app.id,
          slug,
          workspaceCwd: resolved.workspaceCwd,
          key,
          value: body && Object.prototype.hasOwnProperty.call(body, 'value') ? body.value : body,
        })
        sendJson(response, 200, { ok: true, data: saved, correlationId })
      } catch (error) {
        sendError(response, 400, error?.code || 'validation_error', error instanceof Error ? error.message : '写入失败', correlationId)
      }
      return true
    }
  }

  const resolved = requireShare(db, shareId, sendError, response, correlationId)
  if (!resolved) return true
  const { app, workspaceCwd } = resolved
  const workspaceId = app.workspaceId
  const slug = app.spec?.slug || resolved.share.slug

  if (request.method === 'GET' && parts.length === 3 && parts[1] === 'stats') {
    const viewId = parts[2]
    const view = app.spec.views?.find((v) => v.id === viewId && v.type === 'stat')
    if (!view || view.type !== 'stat') {
      sendError(response, 404, 'not_found', '统计视图不存在', correlationId)
      return true
    }
    if (refuseBoundLedger(app, sendError, response, correlationId)) return true
    const value = computeStat(db, app.spec, view, workspaceCwd)
    sendJson(response, 200, { ok: true, data: value, correlationId })
    return true
  }

  if (request.method === 'POST' && parts.length === 3 && parts[1] === 'actions') {
    const actionName = parts[2]
    const action = findAction(app.spec, actionName)
    if (!action) {
      sendError(response, 404, 'not_found', '动作不存在', correlationId)
      return true
    }
    if (action.kind !== 'set') {
      sendError(response, 403, 'owner_only', '过账和问 AI 留在工作台', correlationId)
      return true
    }
    if (refuseBoundLedger(app, sendError, response, correlationId)) return true
    const body = await readJson(request)
    const rids = Array.isArray(body.rids) ? body.rids.map(String) : []
    if (action.approval === 'required') {
      sendError(response, 403, 'owner_only', '过账和问 AI 留在工作台', correlationId)
      return true
    }
    const applied = executeSetAction(db, {
      workspaceId,
      appId: app.id,
      spec: app.spec,
      action,
      rids,
      workspaceCwd,
      correlationId,
    })
    emit('app.record.changed', {
      slug,
      entity: action.entity,
      rids,
      op: 'set',
    }, { workspaceCwd })
    sendJson(response, 200, { ok: true, data: applied, correlationId })
    return true
  }

  if (parts.length === 2) {
    const entity = parts[1]
    if (refuseBoundLedger(app, sendError, response, correlationId)) return true
    if (request.method === 'GET') {
      let filter = {}
      try {
        const raw = url.searchParams.get('filter')
        if (raw) filter = JSON.parse(raw)
      } catch {
        sendError(response, 400, 'validation_error', 'filter 不是有效 JSON', correlationId)
        return true
      }
      const sortField = url.searchParams.get('sort') || undefined
      const sortDir = url.searchParams.get('dir') || 'desc'
      const data = listRecords(db, app.spec, entity, workspaceCwd, {
        filter,
        sort: sortField ? { field: sortField, dir: sortDir } : undefined,
        page: Number(url.searchParams.get('page') ?? 1),
        size: Number(url.searchParams.get('size') ?? 20),
      })
      sendJson(response, 200, { ok: true, data, correlationId })
      return true
    }
    if (request.method === 'POST') {
      const body = await readJson(request)
      try {
        const row = insertRecord(db, app.spec, entity, workspaceCwd, body)
        emit('app.record.changed', {
          slug,
          entity,
          rid: row.id,
          op: 'insert',
          row,
        }, { workspaceCwd })
        sendJson(response, 201, { ok: true, data: row, correlationId })
      } catch (error) {
        if (error?.code === 'validation_error') {
          sendJson(response, 422, { ok: false, errors: error.errors, correlationId })
        } else {
          sendInvokeError(sendError, response, error, correlationId)
        }
      }
      return true
    }
  }

  if (parts.length === 3) {
    const entity = parts[1]
    const rid = parts[2]
    if (refuseBoundLedger(app, sendError, response, correlationId)) return true
    if (request.method === 'GET') {
      const row = getRecord(db, app.spec, entity, workspaceCwd, rid)
      if (!row) {
        sendError(response, 404, 'not_found', '记录不存在', correlationId)
        return true
      }
      sendJson(response, 200, { ok: true, data: row, correlationId })
      return true
    }
    if (request.method === 'PATCH') {
      const body = await readJson(request)
      try {
        const row = patchRecord(db, app.spec, entity, workspaceCwd, rid, body)
        if (!row) {
          sendError(response, 404, 'not_found', '记录不存在', correlationId)
          return true
        }
        emit('app.record.changed', {
          slug,
          entity,
          rid,
          op: 'update',
          row,
        }, { workspaceCwd })
        sendJson(response, 200, { ok: true, data: row, correlationId })
      } catch (error) {
        if (error?.code === 'validation_error') {
          sendJson(response, 422, { ok: false, errors: error.errors, correlationId })
        } else {
          sendInvokeError(sendError, response, error, correlationId)
        }
      }
      return true
    }
    if (request.method === 'DELETE') {
      const ok = deleteRecord(db, app.spec, entity, workspaceCwd, rid)
      if (!ok) {
        sendError(response, 404, 'not_found', '记录不存在', correlationId)
        return true
      }
      emit('app.record.changed', {
        slug,
        entity,
        rid,
        op: 'delete',
      }, { workspaceCwd })
      sendJson(response, 200, { ok: true, correlationId })
      return true
    }
  }

  sendError(response, 404, 'not_found', '接口不存在', correlationId)
  return true
}
