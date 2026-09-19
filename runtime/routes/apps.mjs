import { resolveAllowedRequestOrigin, FDE_AI_WORKSPACE } from '../config.mjs'
import { appendAudit, createId, enqueueEvent } from '../db.mjs'
import { emit } from '../events.mjs'
import { workspaceIdForCwd } from '../briefing/workspace.mjs'
import {
  buildAgentActionJobs,
  buildBizPreviewIntents,
  executeSetAction,
  findAction,
  planSetActionWithApproval,
} from '../apps/actions.mjs'
import {
  computeStat,
  deleteRecord,
  getRecord,
  insertRecord,
  listRecords,
  patchRecord,
} from '../apps/records.mjs'
import {
  activateApp,
  archiveApp,
  createAppDraft,
  discardDraftApp,
  findActiveAppBySlug,
  getAppById,
  listApps,
  purgeApp,
  putAppSpec,
  rollbackApp,
} from '../apps/repository.mjs'

function defaultWorkspaceCwd() {
  return FDE_AI_WORKSPACE
}

function resolveWorkspaceId(db, queryWorkspace) {
  const raw = String(queryWorkspace || '').trim()
  if (!raw) return 'ws_personal'
  if (raw.startsWith('/')) return workspaceIdForCwd(db, raw)
  return raw
}

function resolveWorkspaceCwd(queryWorkspace, spec) {
  const raw = String(queryWorkspace || '').trim()
  if (raw.startsWith('/')) return raw
  if (spec?._workspaceCwd) return String(spec._workspaceCwd)
  return defaultWorkspaceCwd()
}

function cwdHint(queryWorkspace) {
  const raw = String(queryWorkspace || '').trim()
  return raw.startsWith('/') ? raw : ''
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} workspaceId
 * @param {string} slug
 * @param {string} [workspaceCwd]
 */
function requireActiveApp(db, workspaceId, slug, workspaceCwd) {
  const app = findActiveAppBySlug(db, workspaceId, slug, workspaceCwd)
  if (!app) return null
  return app
}

function recordChangePayload(app, extra) {
  const spec = app?.spec && typeof app.spec === 'object' ? app.spec : {}
  const entityName = String(extra.entity || '')
  const row = extra.row && typeof extra.row === 'object' ? extra.row : null
  const ent = Array.isArray(spec.entities) ? spec.entities.find((item) => item && item.name === entityName) : null
  const titleField = ent && typeof ent.titleField === 'string' ? ent.titleField : ''
  const title = row && titleField && row[titleField] ? String(row[titleField]) : String(spec.name || extra.title || '')
  return {
    slug: spec.slug,
    memoryOnWrite: spec.memory && spec.memory.onWrite,
    memory: spec.memory,
    title,
    summary: extra.summary || title,
    ...extra,
    row: undefined,
  }
}

function recordAppOperation(db, {
  workspaceId,
  appId,
  targetRef,
  action,
  input,
  plan,
  correlationId,
}) {
  const id = createId('op')
  const now = new Date().toISOString()
  db.exec('BEGIN IMMEDIATE;')
  try {
    db.prepare(`
      INSERT INTO operations
        (id, workspace_id, connection_id, app_id, requested_by, target_ref, action, operation_kind,
         risk_level, execution_mode, state, idempotency_key, expected_version, input_json, plan_json,
         correlation_id, causation_id, created_at, updated_at)
      VALUES (?, ?, NULL, ?, 'actor_local_user', ?, ?, 'write', 'low', 'dry_run', 'succeeded', ?, NULL, ?, ?, ?, NULL, ?, ?)
    `).run(
      id,
      workspaceId,
      appId,
      targetRef,
      action,
      createId('idem'),
      JSON.stringify(input),
      JSON.stringify(plan || {}),
      correlationId,
      now,
      now,
    )
    db.prepare(`
      INSERT INTO operation_steps
        (id, operation_id, sequence_no, step_kind, state, tool_ref, input_json, output_json, error_json, started_at, finished_at)
      VALUES (?, ?, 0, 'app.record', 'succeeded', 'apps/records', ?, '{}', NULL, ?, ?)
    `).run(createId('opstep'), id, JSON.stringify(input), now, now)
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
  return id
}

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
 *   readJson: Function,
 * }} deps
 */
export async function handleAppsRoutes(request, response, url, deps) {
  const { db, allowedOrigins, correlationId, sendError, sendJson, readJson } = deps
  const pathname = url.pathname
  if (!pathname.startsWith('/api/v1/apps') && !pathname.startsWith('/api/v1/bridge/app-')) {
    return false
  }

  const writeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method ?? '')
  if (writeMethod) {
    const origin = resolveAllowedRequestOrigin(request, allowedOrigins)
    if (!origin) {
      sendError(response, 403, 'origin_not_allowed', '当前页面来源不被允许', correlationId)
      return true
    }
  }

  if (request.method === 'GET' && pathname === '/api/v1/apps') {
    const workspaceId = resolveWorkspaceId(db, url.searchParams.get('workspace'))
    const items = listApps(db, workspaceId)
    sendJson(response, 200, {
      ok: true,
      data: items.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        slug: row.slug,
        revision: row.currentRevision,
        appKind: row.appKind,
      })),
      correlationId,
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/v1/apps') {
    const body = await readJson(request)
    const workspaceId = body.workspaceId ?? resolveWorkspaceId(db, body.workspace)
    const workspaceCwd = typeof body.workspaceCwd === 'string' ? body.workspaceCwd : defaultWorkspaceCwd()
    const spec = body.spec
    if (!spec || typeof spec !== 'object') {
      sendError(response, 400, 'validation_error', 'spec 不能为空', correlationId)
      return true
    }
    const result = createAppDraft(db, {
      workspaceId,
      workspaceCwd,
      spec,
      correlationId,
    })
    if (!result.ok) {
      sendJson(response, 422, { ok: false, errors: result.errors, correlationId })
      return true
    }
    sendJson(response, 201, { ok: true, data: result.data, correlationId })
    return true
  }

  const appIdMatch = pathname.match(/^\/api\/v1\/apps\/([^/]+)$/)
  if (appIdMatch && !pathname.includes('/', `/api/v1/apps/${appIdMatch[1]}`.length)) {
    const appId = decodeURIComponent(appIdMatch[1])
    if (request.method === 'GET') {
      const app = getAppById(db, appId)
      if (!app) {
        sendError(response, 404, 'not_found', '应用不存在', correlationId)
        return true
      }
      sendJson(response, 200, { ok: true, data: app, correlationId })
      return true
    }
    if (request.method === 'DELETE') {
      const result = discardDraftApp(db, appId, { correlationId })
      if (result.kind === 'not_found') {
        sendError(response, 404, 'not_found', '应用不存在', correlationId)
        return true
      }
      if (result.kind === 'not_draft') {
        sendError(response, 409, 'not_draft', '运行中的应用请确认后归档，或勾选连数据一起删', correlationId)
        return true
      }
      sendJson(response, 200, { ok: true, correlationId })
      return true
    }
  }

  const specMatch = pathname.match(/^\/api\/v1\/apps\/([^/]+)\/spec$/)
  if (request.method === 'PUT' && specMatch) {
    const body = await readJson(request)
    const result = putAppSpec(db, decodeURIComponent(specMatch[1]), {
      spec: body.spec,
      changeNote: body.changeNote,
      correlationId,
    })
    if (result.kind === 'not_found') {
      sendError(response, 404, 'not_found', '应用不存在', correlationId)
      return true
    }
    if (result.kind === 'validation') {
      sendJson(response, 422, { ok: false, errors: result.errors, correlationId })
      return true
    }
    if (result.kind === 'breaking') {
      sendJson(response, 422, { ok: false, error: 'breaking_change', errors: result.errors, correlationId })
      return true
    }
    sendJson(response, 200, { ok: true, data: result.data, correlationId })
    return true
  }

  const activateMatch = pathname.match(/^\/api\/v1\/apps\/([^/]+)\/activate$/)
  if (request.method === 'POST' && activateMatch) {
    const appId = decodeURIComponent(activateMatch[1])
    const result = activateApp(db, appId, { emit, correlationId })
    if (result.kind === 'not_found') {
      sendError(response, 404, 'not_found', '应用不存在', correlationId)
      return true
    }
    if (result.kind === 'validation') {
      sendJson(response, 422, { ok: false, errors: result.errors, correlationId })
      return true
    }
    if (result.kind === 'breaking') {
      sendJson(response, 422, { ok: false, error: 'breaking_change', errors: result.errors, correlationId })
      return true
    }
    sendJson(response, 200, { ok: true, data: result.data, correlationId })
    return true
  }

  const archiveMatch = pathname.match(/^\/api\/v1\/apps\/([^/]+)\/archive$/)
  if (request.method === 'POST' && archiveMatch) {
    const ok = archiveApp(db, decodeURIComponent(archiveMatch[1]))
    if (!ok) {
      sendError(response, 404, 'not_found', '应用不存在', correlationId)
      return true
    }
    sendJson(response, 200, { ok: true, correlationId })
    return true
  }

  const purgeMatch = pathname.match(/^\/api\/v1\/apps\/([^/]+)\/purge$/)
  if (request.method === 'POST' && purgeMatch) {
    const result = purgeApp(db, decodeURIComponent(purgeMatch[1]), { correlationId })
    if (result.kind === 'not_found') {
      sendError(response, 404, 'not_found', '应用不存在', correlationId)
      return true
    }
    if (result.kind === 'use_discard') {
      sendError(response, 409, 'use_discard', '草稿请直接删除，不要走硬删', correlationId)
      return true
    }
    sendJson(response, 200, { ok: true, data: result.data, correlationId })
    return true
  }

  const rollbackMatch = pathname.match(/^\/api\/v1\/apps\/([^/]+)\/rollback$/)
  if (request.method === 'POST' && rollbackMatch) {
    const body = await readJson(request)
    const revision = Number(body.revision)
    const result = rollbackApp(db, decodeURIComponent(rollbackMatch[1]), revision)
    if (!result) {
      sendError(response, 404, 'not_found', '修订不存在', correlationId)
      return true
    }
    sendJson(response, 200, { ok: true, data: result, correlationId })
    return true
  }

  const statsMatch = pathname.match(/^\/api\/v1\/apps\/([^/]+)\/stats\/([^/]+)$/)
  if (request.method === 'GET' && statsMatch) {
    const slug = decodeURIComponent(statsMatch[1])
    const viewId = decodeURIComponent(statsMatch[2])
    const workspaceQuery = url.searchParams.get('workspace')
    const workspaceId = resolveWorkspaceId(db, workspaceQuery)
    const app = requireActiveApp(db, workspaceId, slug, cwdHint(workspaceQuery))
    if (!app) {
      sendError(response, 404, 'not_found', '应用未激活', correlationId)
      return true
    }
    const view = app.spec.views?.find((v) => v.id === viewId && v.type === 'stat')
    if (!view || view.type !== 'stat') {
      sendError(response, 404, 'not_found', '统计视图不存在', correlationId)
      return true
    }
    const workspaceCwd = resolveWorkspaceCwd(url.searchParams.get('workspace'), app.spec)
    const value = computeStat(db, app.spec, view, workspaceCwd)
    sendJson(response, 200, { ok: true, data: value, correlationId })
    return true
  }

  const actionMatch = pathname.match(/^\/api\/v1\/apps\/([^/]+)\/actions\/([^/]+)$/)
  if (request.method === 'POST' && actionMatch) {
    const slug = decodeURIComponent(actionMatch[1])
    const actionName = decodeURIComponent(actionMatch[2])
    const body = await readJson(request)
    const workspaceQuery = body.workspaceCwd ?? body.workspace
    const workspaceId = resolveWorkspaceId(db, body.workspaceId ?? body.workspace)
    const app = requireActiveApp(db, workspaceId, slug, cwdHint(workspaceQuery))
    if (!app) {
      sendError(response, 404, 'not_found', '应用未激活', correlationId)
      return true
    }
    const action = findAction(app.spec, actionName)
    if (!action) {
      sendError(response, 404, 'not_found', '动作不存在', correlationId)
      return true
    }
    const rids = Array.isArray(body.rids) ? body.rids.map(String) : []
    const workspaceCwd = resolveWorkspaceCwd(body.workspaceCwd ?? body.workspace, app.spec)
    if (action.kind === 'set') {
      if (action.approval === 'required') {
        const planned = planSetActionWithApproval(db, {
          workspaceId,
          appId: app.id,
          action,
          rids,
          correlationId,
        })
        sendJson(response, 200, { ok: true, data: planned, correlationId })
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
      emit('app.record.changed', recordChangePayload(app, {
        entity: action.entity,
        rids,
        op: 'set',
      }), { workspaceCwd })
      sendJson(response, 200, { ok: true, data: applied, correlationId })
      return true
    }
    if (action.kind === 'biz') {
      const rows = rids.map((rid) => getRecord(db, app.spec, String(action.entity), workspaceCwd, rid)).filter(Boolean)
      const intents = buildBizPreviewIntents(action, rows)
      sendJson(response, 200, {
        ok: true,
        data: { step: 'preview', intents },
        correlationId,
      })
      return true
    }
    if (action.kind === 'agent') {
      const rows = rids.map((rid) => getRecord(db, app.spec, String(action.entity), workspaceCwd, rid)).filter(Boolean)
      const jobs = buildAgentActionJobs(action, rows)
      sendJson(response, 200, {
        ok: true,
        data: { step: 'agent', jobs },
        correlationId,
      })
      return true
    }
    sendError(response, 400, 'validation_error', '未知动作类型', correlationId)
    return true
  }

  const entityListMatch = pathname.match(/^\/api\/v1\/apps\/([^/]+)\/([^/]+)$/)
  if (request.method === 'POST' && entityListMatch) {
    const slug = decodeURIComponent(entityListMatch[1])
    const entity = decodeURIComponent(entityListMatch[2])
    const body = await readJson(request)
    const workspaceQuery = body.workspaceCwd ?? body.workspace
    const workspaceId = resolveWorkspaceId(db, body.workspaceId ?? body.workspace)
    const app = requireActiveApp(db, workspaceId, slug, cwdHint(workspaceQuery))
    if (!app) {
      sendError(response, 404, 'not_found', '应用未激活', correlationId)
      return true
    }
    const workspaceCwd = resolveWorkspaceCwd(body.workspaceCwd ?? body.workspace, app.spec)
    try {
      const row = insertRecord(db, app.spec, entity, workspaceCwd, body)
      recordAppOperation(db, {
        workspaceId,
        appId: app.id,
        targetRef: `fde://workstation/app/${slug}/${entity}/${row.id}`,
        action: 'app.record.insert',
        input: body,
        plan: { row },
        correlationId,
      })
      emit('app.record.changed', recordChangePayload(app, {
        entity,
        rid: row.id,
        op: 'insert',
        row,
      }), { workspaceCwd })
      sendJson(response, 201, { ok: true, data: row, correlationId })
    } catch (error) {
      if (error?.code === 'validation_error') {
        sendJson(response, 422, { ok: false, errors: error.errors, correlationId })
      } else {
        throw error
      }
    }
    return true
  }

  if (request.method === 'GET' && entityListMatch) {
    const slug = decodeURIComponent(entityListMatch[1])
    const entity = decodeURIComponent(entityListMatch[2])
    const workspaceQuery = url.searchParams.get('workspace')
    const workspaceId = resolveWorkspaceId(db, workspaceQuery)
    const app = requireActiveApp(db, workspaceId, slug, cwdHint(workspaceQuery))
    if (!app) {
      sendError(response, 404, 'not_found', '应用未激活', correlationId)
      return true
    }
    const workspaceCwd = resolveWorkspaceCwd(url.searchParams.get('workspace'), app.spec)
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

  const entityRowMatch = pathname.match(/^\/api\/v1\/apps\/([^/]+)\/([^/]+)\/([^/]+)$/)
  if (entityRowMatch) {
    const slug = decodeURIComponent(entityRowMatch[1])
    const entity = decodeURIComponent(entityRowMatch[2])
    const rid = decodeURIComponent(entityRowMatch[3])
    const workspaceQuery = url.searchParams.get('workspace')
    const workspaceId = resolveWorkspaceId(db, workspaceQuery)
    const app = requireActiveApp(db, workspaceId, slug, cwdHint(workspaceQuery))
    if (!app) {
      sendError(response, 404, 'not_found', '应用未激活', correlationId)
      return true
    }
    const workspaceCwd = resolveWorkspaceCwd(url.searchParams.get('workspace'), app.spec)

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
        recordAppOperation(db, {
          workspaceId,
          appId: app.id,
          targetRef: `fde://workstation/app/${slug}/${entity}/${rid}`,
          action: 'app.record.patch',
          input: body,
          plan: { diff: body },
          correlationId,
        })
        emit('app.record.changed', recordChangePayload(app, {
          entity,
          rid,
          op: 'update',
          row,
        }), { workspaceCwd })
        sendJson(response, 200, { ok: true, data: row, correlationId })
      } catch (error) {
        if (error?.code === 'validation_error') {
          sendJson(response, 422, { ok: false, errors: error.errors, correlationId })
        } else {
          throw error
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
      recordAppOperation(db, {
        workspaceId,
        appId: app.id,
        targetRef: `fde://workstation/app/${slug}/${entity}/${rid}`,
        action: 'app.record.delete',
        input: { rid },
        plan: {},
        correlationId,
      })
      emit('app.record.changed', recordChangePayload(app, {
        entity,
        rid,
        op: 'delete',
      }), { workspaceCwd })
      sendJson(response, 200, { ok: true, correlationId })
      return true
    }
  }

  return false
}

/**
 * Bridge handlers (called from bridge.mjs).
 * @param {string} sub
 * @param {Record<string, unknown>} body
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} workspaceCwd
 */
export function handleAppsBridge(sub, body, db, workspaceCwd) {
  const workspaceId = workspaceCwd ? workspaceIdForCwd(db, workspaceCwd) : 'ws_personal'
  if (sub === 'app-spec-submit') {
    const spec = body.spec
    if (!spec || typeof spec !== 'object') {
      return { ok: false, errors: [{ path: 'spec', message: 'spec 必填' }] }
    }
    const appId = typeof body.appId === 'string' ? body.appId.trim() : ''
    if (appId) {
      const result = putAppSpec(db, appId, { spec, changeNote: 'builder 修订' })
      if (result.kind === 'not_found') {
        return { ok: false, errors: [{ path: 'appId', message: '应用不存在' }] }
      }
      if (result.kind === 'validation') {
        return { ok: false, errors: result.errors }
      }
      if (result.kind === 'breaking') {
        return { ok: false, errors: result.errors, error: 'breaking_change' }
      }
      return { ok: true, appId, revision: result.data.revision }
    }
    const result = createAppDraft(db, {
      workspaceId,
      workspaceCwd,
      spec,
    })
    if (!result.ok) return { ok: false, errors: result.errors }
    return { ok: true, appId: result.data.appId, revision: result.data.revision }
  }
  if (sub === 'app-records-query') {
    const slug = String(body.slug || '')
    const entity = String(body.entity || '')
    const app = findActiveAppBySlug(db, workspaceId, slug, workspaceCwd)
    if (!app) return { ok: false, error: 'app_not_active', message: '应用未激活' }
    const limit = Math.min(200, Number(body.limit ?? 50))
    const data = listRecords(db, app.spec, entity, workspaceCwd, {
      filter: body.filter && typeof body.filter === 'object' ? body.filter : {},
      size: limit,
      page: 1,
    })
    return { ok: true, rows: data.rows, total: data.total }
  }
  if (sub === 'app-records-propose') {
    const slug = String(body.slug || '')
    const entity = String(body.entity || '')
    const app = findActiveAppBySlug(db, workspaceId, slug, workspaceCwd)
    if (!app) return { ok: false, error: 'app_not_active', message: '应用未激活' }
    const op = String(body.op || 'insert')
    return {
      ok: true,
      proposal: {
        kind: 'app.record',
        slug,
        entity,
        op,
        rows: body.rows,
        note: '仅提案，不写库',
      },
    }
  }
  return null
}
