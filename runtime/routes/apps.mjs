import { canonicalWorkspaceCwd } from '../cwd.mjs'
import { resolveHttpWorkspace } from '../http-workspace.mjs'
import { resolveAllowedRequestOrigin, FDE_AI_WORKSPACE, FDE_RUNTIME_PORT } from '../config.mjs'
import { verifyUiToken } from './bridge.mjs'
import { appendAudit, createId, enqueueEvent } from '../db.mjs'
import { emit } from '../events.mjs'
import { resolveWorkspaceIdOrFail } from '../briefing/workspace.mjs'
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
  computeBoundStat,
  listBoundRecords,
  specRecordsViaMcp,
  writeBoundRecord,
} from '../apps/bound-records.mjs'
import { resolveOperateSkills } from '../biz/systems-store.mjs'
import {
  activateApp,
  appIsTrashed,
  createAppDraft,
  findActiveAppBySlug,
  getAppById,
  listApps,
  purgeApp,
  putAppSpec,
  restoreApp,
  rollbackApp,
  trashApp,
} from '../apps/repository.mjs'
import {
  liveShareForApp,
  mintShare,
  publicShareUrl,
  requestListenPort,
  revokeLiveSharesForApp,
} from '../apps/share.mjs'
import { isWebAppSpec } from '../apps/spec.mjs'
import { writeBundleFiles } from '../apps/bundle.mjs'
import { serveWebAppAsset } from '../apps/web-host.mjs'
import { getDocument, putDocument } from '../apps/documents.mjs'
import { confirmRecordProposal, proposeRecordUpdate, rejectRecordProposal } from '../apps/record-proposals.mjs'

function sharePayload(request, share) {
  if (!share) return null
  const port = requestListenPort(request, FDE_RUNTIME_PORT)
  const url = publicShareUrl(share.id, { port })
  const loopback = publicShareUrl(share.id, { port, host: '127.0.0.1' })
  return {
    shareId: share.id,
    url,
    urls: [
      { kind: 'lan', url },
      { kind: 'loopback', url: loopback },
    ],
    createdAt: share.createdAt,
  }
}

function specWorkspaceCwd(spec) {
  return canonicalWorkspaceCwd(spec?._workspaceCwd) || canonicalWorkspaceCwd(FDE_AI_WORKSPACE) || FDE_AI_WORKSPACE
}

function rejectAppWorkspace(resolved, response, correlationId, sendError) {
  if (resolved?.error === 'missing_workspace') {
    sendError(response, 404, 'not_found', '工作区未登记', correlationId)
    return true
  }
  if (!resolved?.error) return false
  sendError(response, 400, 'workspace_invalid', '工作区必须是绝对路径', correlationId)
  return true
}

function idForSuppliedPath(db, cwd) {
  return resolveWorkspaceIdOrFail(db, { cwd, source: 'request' })
}

function appIdentity(db, url, body, slots) {
  const resolved = resolveHttpWorkspace({
    url,
    body,
    role: 'id-or-path',
    whenAbsent: 'omit',
    slots,
  })
  if (resolved.error) return resolved
  if (resolved.cwd) {
    const found = idForSuppliedPath(db, resolved.cwd)
    if (found.error) return found
    return { workspaceId: found.workspaceId, hint: resolved.cwd }
  }
  const ident = resolveWorkspaceIdOrFail(db, resolved)
  return { workspaceId: ident.workspaceId, hint: '' }
}

function appRecordCwd(url, body, spec, aiRuntime, place) {
  const pathSlots = place === 'body'
    ? [['body', 'workspaceCwd'], ['body', 'cwd']]
    : [['query', 'cwd']]
  const named = resolveHttpWorkspace({
    url,
    body,
    role: 'path',
    whenAbsent: 'omit',
    slots: pathSlots,
  })
  if (named.error) return named
  if (named.cwd) return { cwd: named.cwd }
  const identSlots = place === 'body' ? [['body', 'workspace']] : [['query', 'workspace']]
  const ident = resolveHttpWorkspace({
    url,
    body,
    role: 'id-or-path',
    whenAbsent: 'omit',
    slots: identSlots,
  })
  if (ident.cwd) return { cwd: ident.cwd }
  const fromSpec = canonicalWorkspaceCwd(spec?._workspaceCwd)
  if (fromSpec) return { cwd: fromSpec }
  return resolveHttpWorkspace({
    runtimeCwd: aiRuntime?.cwd,
    fallbackCwd: FDE_AI_WORKSPACE,
    slots: [],
  })
}

function sendInvokeError(sendError, response, error, correlationId) {
  const code = String(error?.code || 'invoke_failed')
  const status = code === 'no_session' || code === 'not_projected' || code === 'timeout' ? 503 : 400
  sendError(response, status, code, error instanceof Error ? error.message : '调用失败', correlationId)
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
 *   aiRuntime?: object,
 *   allowedOrigins: Set<string>,
 *   correlationId: string,
 *   sendError: Function,
 *   sendJson: Function,
 *   readJson: Function,
 *   uiToken?: string,
 * }} deps
 */
export async function handleAppsRoutes(request, response, url, deps) {
  const { db, aiRuntime, allowedOrigins, correlationId, sendError, sendJson, readJson, uiToken } = deps
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

  const proposalMatch = pathname.match(/^\/api\/v1\/apps\/record-proposals\/([^/]+)\/(confirm|reject)$/)
  if (request.method === 'POST' && proposalMatch) {
    if (!verifyUiToken(request, uiToken)) {
      sendError(response, 401, 'ui_token_invalid', '缺少或无效的页面令牌', correlationId)
      return true
    }
    await readJson(request)
    const operationId = decodeURIComponent(proposalMatch[1])
    const decision = proposalMatch[2]
    try {
      const result = decision === 'confirm'
        ? confirmRecordProposal(db, operationId, { correlationId })
        : rejectRecordProposal(db, operationId, { correlationId })
      if (result.kind === 'not_found' || result.kind === 'not_proposal') {
        sendError(response, 404, 'not_found', '提案不存在', correlationId)
        return true
      }
      if (result.kind === 'invalid_state') {
        sendError(response, 409, 'invalid_state', '提案已经确认或拒绝', correlationId, { state: result.operation?.state })
        return true
      }
      if (result.kind === 'stale') {
        sendError(response, 409, 'stale_record', '记录在提案之后已变更', correlationId, { state: result.operation?.state })
        return true
      }
      sendJson(response, 200, { ok: true, data: result.operation, correlationId })
    } catch (error) {
      if (error?.code === 'validation_error') {
        sendJson(response, 422, { ok: false, errors: error.errors, correlationId })
        return true
      }
      throw error
    }
    return true
  }

  if (request.method === 'GET' && pathname === '/api/v1/apps') {
    const identity = appIdentity(db, url, null, [['query', 'workspace'], ['query', 'cwd']])
    if (rejectAppWorkspace(identity, response, correlationId, sendError)) return true
    const workspaceId = identity.workspaceId
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
        deletedAt: row.deletedAt || '',
      })),
      correlationId,
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/v1/apps') {
    const body = await readJson(request)
    const pathResolved = resolveHttpWorkspace({
      body,
      slots: [['body', 'workspaceCwd'], ['body', 'cwd']],
      runtimeCwd: aiRuntime?.cwd,
      fallbackCwd: FDE_AI_WORKSPACE,
    })
    if (rejectAppWorkspace(pathResolved, response, correlationId, sendError)) return true
    const workspaceCwd = pathResolved.cwd
    const identity = appIdentity(db, null, body, [['body', 'workspace']])
    if (rejectAppWorkspace(identity, response, correlationId, sendError)) return true
    let workspaceId = typeof body.workspaceId === 'string' && body.workspaceId ? body.workspaceId : ''
    if (!workspaceId && identity.hint) {
      const found = idForSuppliedPath(db, identity.hint)
      if (rejectAppWorkspace(found, response, correlationId, sendError)) return true
      workspaceId = found.workspaceId
    } else if (!workspaceId && body.workspace) {
      workspaceId = identity.workspaceId
    } else if (!workspaceId && pathResolved.source === 'request') {
      const found = idForSuppliedPath(db, workspaceCwd)
      if (rejectAppWorkspace(found, response, correlationId, sendError)) return true
      workspaceId = found.workspaceId
    } else if (!workspaceId) {
      const found = resolveWorkspaceIdOrFail(db, pathResolved)
      if (rejectAppWorkspace(found, response, correlationId, sendError)) return true
      workspaceId = found.workspaceId
    }
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
    if (Array.isArray(body.files)) {
      const created = getAppById(db, result.data.appId)
      if (created && isWebAppSpec(created.spec)) {
        try {
          writeBundleFiles(workspaceCwd, created.spec, body.files)
        } catch (error) {
          sendJson(response, 422, {
            ok: false,
            errors: [{ path: 'files', message: error instanceof Error ? error.message : '写包失败' }],
            correlationId,
          })
          return true
        }
      }
    }
    sendJson(response, 201, { ok: true, data: result.data, correlationId })
    return true
  }

  const liveMatch = pathname.match(/^\/api\/v1\/apps\/([^/]+)\/live(?:\/(.*))?$/)
  if (liveMatch && (request.method === 'GET' || request.method === 'HEAD')) {
    const app = getAppById(db, decodeURIComponent(liveMatch[1]))
    if (!app || appIsTrashed(app)) {
      sendError(response, 404, 'not_found', '应用不存在', correlationId)
      return true
    }
    if (!isWebAppSpec(app.spec)) {
      sendError(response, 404, 'not_found', '不是托管 Web 应用', correlationId)
      return true
    }
    const cwd = specWorkspaceCwd(app.spec)
    const rel = liveMatch[2] ? decodeURIComponent(liveMatch[2]) : ''
    const served = serveWebAppAsset(request, response, {
      spec: app.spec,
      workspaceCwd: cwd,
      relPath: rel,
      livePrefix: `/api/v1/apps/${encodeURIComponent(app.id)}/live`,
      storePrefix: `/api/v1/apps/${encodeURIComponent(app.id)}/store`,
      db,
      appId: app.id,
    })
    if (!served) sendError(response, 404, 'not_found', '文件不存在', correlationId)
    return true
  }

  const storeMatch = pathname.match(/^\/api\/v1\/apps\/([^/]+)\/store\/([^/]+)$/)
  if (storeMatch) {
    const app = getAppById(db, decodeURIComponent(storeMatch[1]))
    if (!app || appIsTrashed(app)) {
      sendError(response, 404, 'not_found', '应用不存在', correlationId)
      return true
    }
    if (!isWebAppSpec(app.spec)) {
      sendError(response, 404, 'not_found', '不是托管 Web 应用', correlationId)
      return true
    }
    const cwd = specWorkspaceCwd(app.spec)
    const key = decodeURIComponent(storeMatch[2])
    const slug = String(app.spec.slug || app.slug || '')
    if (request.method === 'GET') {
      const value = getDocument(db, { appId: app.id, workspaceCwd: cwd, key })
      sendJson(response, 200, { ok: true, data: value, correlationId })
      return true
    }
    if (request.method === 'PUT' || request.method === 'POST') {
      const body = await readJson(request)
      try {
        const saved = putDocument(db, {
          appId: app.id,
          slug,
          workspaceCwd: cwd,
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
      const result = trashApp(db, appId, { correlationId })
      if (result.kind === 'not_found') {
        sendError(response, 404, 'not_found', '应用不存在', correlationId)
        return true
      }
      sendJson(response, 200, { ok: true, data: result.data, correlationId })
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
    if (result.kind === 'trashed') {
      sendError(response, 409, 'trashed', '应用在已删除里，请先恢复', correlationId)
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
    const result = activateApp(db, appId, { correlationId })
    if (result.kind === 'not_found') {
      sendError(response, 404, 'not_found', '应用不存在', correlationId)
      return true
    }
    if (result.kind === 'validation') {
      sendJson(response, 422, { ok: false, errors: result.errors, correlationId })
      return true
    }
    if (result.kind === 'trashed') {
      sendError(response, 409, 'trashed', '应用在已删除里，请先恢复', correlationId)
      return true
    }
    if (result.kind === 'breaking') {
      sendJson(response, 422, { ok: false, error: 'breaking_change', errors: result.errors, correlationId })
      return true
    }
    sendJson(response, 200, { ok: true, data: result.data, correlationId })
    return true
  }

  const restoreMatch = pathname.match(/^\/api\/v1\/apps\/([^/]+)\/restore$/)
  if (request.method === 'POST' && restoreMatch) {
    const result = restoreApp(db, decodeURIComponent(restoreMatch[1]), { correlationId })
    if (result.kind === 'not_found') {
      sendError(response, 404, 'not_found', '应用不存在', correlationId)
      return true
    }
    if (result.kind === 'not_trashed') {
      sendError(response, 409, 'not_trashed', '应用不在已删除里', correlationId)
      return true
    }
    if (result.kind === 'slug_taken') {
      sendError(response, 409, 'slug_taken', '同名还在用', correlationId)
      return true
    }
    sendJson(response, 200, { ok: true, data: result.data, correlationId })
    return true
  }

  const purgeMatch = pathname.match(/^\/api\/v1\/apps\/([^/]+)\/purge$/)
  if (request.method === 'POST' && purgeMatch) {
    const result = purgeApp(db, decodeURIComponent(purgeMatch[1]), { correlationId })
    if (result.kind === 'not_found') {
      sendError(response, 404, 'not_found', '应用不存在', correlationId)
      return true
    }
    if (result.kind === 'not_trashed') {
      sendError(response, 409, 'not_trashed', '先删除进已删除，再彻底删除', correlationId)
      return true
    }
    sendJson(response, 200, { ok: true, data: result.data, correlationId })
    return true
  }

  const shareMatch = pathname.match(/^\/api\/v1\/apps\/([^/]+)\/share$/)
  if (shareMatch) {
    const appId = decodeURIComponent(shareMatch[1])
    const app = getAppById(db, appId)
    if (!app) {
      sendError(response, 404, 'not_found', '应用不存在', correlationId)
      return true
    }
    if (request.method === 'GET') {
      sendJson(response, 200, { ok: true, data: sharePayload(request, liveShareForApp(db, appId)), correlationId })
      return true
    }
    if (request.method === 'POST') {
      if (app.status !== 'active' || appIsTrashed(app)) {
        sendError(response, 409, 'not_active', '只有运行中的应用可以分享', correlationId)
        return true
      }
      const slug = String(app.spec?.slug || app.slug || '')
      const workspaceCwd = specWorkspaceCwd(app.spec)
      if (!slug || !canonicalWorkspaceCwd(workspaceCwd)) {
        sendError(response, 422, 'validation_error', '应用没有可分享的工作区', correlationId)
        return true
      }
      const share = mintShare(db, { appId, slug, workspaceCwd })
      sendJson(response, 200, { ok: true, data: sharePayload(request, share), correlationId })
      return true
    }
    if (request.method === 'DELETE') {
      const result = revokeLiveSharesForApp(db, appId)
      sendJson(response, 200, { ok: true, data: result, correlationId })
      return true
    }
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
    const identity = appIdentity(db, url, null, [['query', 'workspace'], ['query', 'cwd']])
    if (rejectAppWorkspace(identity, response, correlationId, sendError)) return true
    const app = requireActiveApp(db, identity.workspaceId, slug, identity.hint)
    if (!app) {
      sendError(response, 404, 'not_found', '应用未激活', correlationId)
      return true
    }
    const view = app.spec.views?.find((v) => v.id === viewId && v.type === 'stat')
    if (!view || view.type !== 'stat') {
      sendError(response, 404, 'not_found', '统计视图不存在', correlationId)
      return true
    }
    const record = appRecordCwd(url, null, app.spec, aiRuntime, 'query')
    if (rejectAppWorkspace(record, response, correlationId, sendError)) return true
    const workspaceCwd = record.cwd
    if (specRecordsViaMcp(db, app.spec, workspaceCwd)) {
      try {
        const value = await computeBoundStat({ db, aiRuntime }, app.spec, view, workspaceCwd)
        sendJson(response, 200, { ok: true, data: value || { value: 0, label: view.label || '统计' }, correlationId })
      } catch (error) {
        sendInvokeError(sendError, response, error, correlationId)
      }
      return true
    }
    const value = computeStat(db, app.spec, view, workspaceCwd)
    sendJson(response, 200, { ok: true, data: value, correlationId })
    return true
  }

  const actionMatch = pathname.match(/^\/api\/v1\/apps\/([^/]+)\/actions\/([^/]+)$/)
  if (request.method === 'POST' && actionMatch) {
    const slug = decodeURIComponent(actionMatch[1])
    const actionName = decodeURIComponent(actionMatch[2])
    const body = await readJson(request)
    const identity = appIdentity(db, null, body, [['body', 'workspace']])
    if (rejectAppWorkspace(identity, response, correlationId, sendError)) return true
    const workspaceId = body.workspaceId ?? identity.workspaceId
    const hint = resolveHttpWorkspace({
      body,
      role: 'id-or-path',
      whenAbsent: 'omit',
      slots: [['body', 'workspaceCwd'], ['body', 'workspace']],
    })
    const app = requireActiveApp(db, workspaceId, slug, hint.cwd || '')
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
    const record = appRecordCwd(null, body, app.spec, aiRuntime, 'body')
    if (rejectAppWorkspace(record, response, correlationId, sendError)) return true
    const workspaceCwd = record.cwd
    if (action.kind === 'set') {
      if (specRecordsViaMcp(db, app.spec, workspaceCwd)) {
        sendError(response, 400, 'no_set', 'set 只在本地台账可用', correlationId)
        return true
      }
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
      const resolved = await resolveOperateSkills(aiRuntime, app.spec, workspaceCwd)
      if (resolved.error) {
        sendError(response, resolved.code === 'no_session' ? 503 : 400, resolved.code || 'skill_missing', resolved.error, correlationId)
        return true
      }
      const jobs = buildAgentActionJobs(action, rows, { ...app.spec, skills: resolved.skills })
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
    const identity = appIdentity(db, null, body, [['body', 'workspace']])
    if (rejectAppWorkspace(identity, response, correlationId, sendError)) return true
    const workspaceId = body.workspaceId ?? identity.workspaceId
    const hint = resolveHttpWorkspace({
      body,
      role: 'id-or-path',
      whenAbsent: 'omit',
      slots: [['body', 'workspaceCwd'], ['body', 'workspace']],
    })
    const app = requireActiveApp(db, workspaceId, slug, hint.cwd || '')
    if (!app) {
      sendError(response, 404, 'not_found', '应用未激活', correlationId)
      return true
    }
    const record = appRecordCwd(null, body, app.spec, aiRuntime, 'body')
    if (rejectAppWorkspace(record, response, correlationId, sendError)) return true
    const workspaceCwd = record.cwd
    if (specRecordsViaMcp(db, app.spec, workspaceCwd)) {
      try {
        const written = await writeBoundRecord({ db, aiRuntime }, app.spec, entity, workspaceCwd, {
          op: 'insert',
          row: body,
        })
        sendJson(response, 201, { ok: true, data: written, correlationId })
      } catch (error) {
        sendInvokeError(sendError, response, error, correlationId)
      }
      return true
    }
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
    const identity = appIdentity(db, url, null, [['query', 'workspace'], ['query', 'cwd']])
    if (rejectAppWorkspace(identity, response, correlationId, sendError)) return true
    const app = requireActiveApp(db, identity.workspaceId, slug, identity.hint)
    if (!app) {
      sendError(response, 404, 'not_found', '应用未激活', correlationId)
      return true
    }
    const record = appRecordCwd(url, null, app.spec, aiRuntime, 'query')
    if (rejectAppWorkspace(record, response, correlationId, sendError)) return true
    const workspaceCwd = record.cwd
    if (specRecordsViaMcp(db, app.spec, workspaceCwd)) {
      let filter = {}
      try {
        const raw = url.searchParams.get('filter')
        if (raw) filter = JSON.parse(raw)
      } catch {
        sendError(response, 400, 'validation_error', 'filter 不是有效 JSON', correlationId)
        return true
      }
      try {
        const data = await listBoundRecords({ db, aiRuntime }, app.spec, entity, workspaceCwd, {
          filter,
          page: Number(url.searchParams.get('page') ?? 1),
          size: Number(url.searchParams.get('size') ?? 20),
        })
        sendJson(response, 200, { ok: true, data, correlationId })
      } catch (error) {
        sendInvokeError(sendError, response, error, correlationId)
      }
      return true
    }
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
    const identity = appIdentity(db, url, null, [['query', 'workspace'], ['query', 'cwd']])
    if (rejectAppWorkspace(identity, response, correlationId, sendError)) return true
    const workspaceId = identity.workspaceId
    const app = requireActiveApp(db, workspaceId, slug, identity.hint)
    if (!app) {
      sendError(response, 404, 'not_found', '应用未激活', correlationId)
      return true
    }
    const record = appRecordCwd(url, null, app.spec, aiRuntime, 'query')
    if (rejectAppWorkspace(record, response, correlationId, sendError)) return true
    const workspaceCwd = record.cwd
    const bound = specRecordsViaMcp(db, app.spec, workspaceCwd)

    if (request.method === 'GET') {
      if (bound) {
        try {
          const listed = await listBoundRecords({ db, aiRuntime }, app.spec, entity, workspaceCwd, { size: 100 })
          const row = (listed?.rows || []).find((item) => String(item.id || item.no || '') === rid)
          if (!row) {
            sendError(response, 404, 'not_found', '记录不存在', correlationId)
            return true
          }
          sendJson(response, 200, { ok: true, data: row, correlationId })
        } catch (error) {
          sendInvokeError(sendError, response, error, correlationId)
        }
        return true
      }
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
      if (bound) {
        try {
          const written = await writeBoundRecord({ db, aiRuntime }, app.spec, entity, workspaceCwd, {
            op: 'patch',
            rid,
            row: body,
          })
          sendJson(response, 200, { ok: true, data: written, correlationId })
        } catch (error) {
          sendInvokeError(sendError, response, error, correlationId)
        }
        return true
      }
      if (!verifyUiToken(request, uiToken)) {
        sendError(response, 401, 'ui_token_invalid', '缺少或无效的页面令牌', correlationId)
        return true
      }
      try {
        const row = patchRecord(db, app.spec, entity, workspaceCwd, rid, body)
        if (!row) {
          sendError(response, 404, 'not_found', '记录不存在', correlationId)
          return true
        }
        const targetRef = `fde://workstation/app/${slug}/${entity}/${rid}`
        recordAppOperation(db, {
          workspaceId,
          appId: app.id,
          targetRef,
          action: 'app.record.patch',
          input: body,
          plan: { diff: body },
          correlationId,
        })
        appendAudit(db, {
          workspaceId,
          actorId: 'actor_local_user',
          action: 'app.record.patch',
          targetRef,
          outcome: 'succeeded',
          riskLevel: 'low',
          correlationId,
          details: { slug, entity, rid },
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
      if (bound) {
        try {
          await writeBoundRecord({ db, aiRuntime }, app.spec, entity, workspaceCwd, {
            op: 'delete',
            rid,
          })
          sendJson(response, 200, { ok: true, correlationId })
        } catch (error) {
          sendInvokeError(sendError, response, error, correlationId)
        }
        return true
      }
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
export async function handleAppsBridge(sub, body, db, workspaceCwd, aiRuntime) {
  const found = resolveWorkspaceIdOrFail(db, workspaceCwd ? { cwd: workspaceCwd, source: 'request' } : {})
  if (found.error) return { ok: false, status: 404, errors: [{ path: 'workspaceCwd', message: '工作区未登记' }] }
  const workspaceId = found.workspaceId
  if (sub === 'app-spec-submit') {
    const spec = body.spec
    if (!spec || typeof spec !== 'object') {
      return { ok: false, errors: [{ path: 'spec', message: 'spec 必填' }] }
    }
    const appId = typeof body.appId === 'string' ? body.appId.trim() : ''
    if (appId) {
      let result
      try {
        result = putAppSpec(db, appId, { spec, changeNote: 'builder 修订' })
      } catch (error) {
        return { ok: false, errors: [{ path: 'spec', message: error instanceof Error ? error.message : '修订失败' }] }
      }
      if (result.kind === 'not_found') {
        return { ok: false, errors: [{ path: 'appId', message: '应用不存在' }] }
      }
      if (result.kind === 'validation') {
        return { ok: false, errors: result.errors }
      }
      if (result.kind === 'trashed') {
        return { ok: false, errors: [{ path: 'appId', message: '应用在已删除里，请先恢复' }] }
      }
      if (result.kind === 'breaking') {
        return { ok: false, errors: result.errors, error: 'breaking_change' }
      }
      if (Array.isArray(body.files) && workspaceCwd) {
        const app = getAppById(db, appId)
        if (app && isWebAppSpec(app.spec)) {
          try {
            writeBundleFiles(workspaceCwd, app.spec, body.files)
          } catch (error) {
            return { ok: false, errors: [{ path: 'files', message: error instanceof Error ? error.message : '写包失败' }] }
          }
        }
      }
      return { ok: true, appId, revision: result.data.revision }
    }
    const result = createAppDraft(db, {
      workspaceId,
      workspaceCwd,
      spec,
    })
    if (!result.ok) return { ok: false, errors: result.errors }
    if (Array.isArray(body.files) && workspaceCwd) {
      const app = getAppById(db, result.data.appId)
      if (app && isWebAppSpec(app.spec)) {
        try {
          writeBundleFiles(workspaceCwd, app.spec, body.files)
        } catch (error) {
          return { ok: false, errors: [{ path: 'files', message: error instanceof Error ? error.message : '写包失败' }] }
        }
      }
    }
    return { ok: true, appId: result.data.appId, revision: result.data.revision }
  }
  if (sub === 'app-records-query') {
    const slug = String(body.slug || '')
    const entity = String(body.entity || '')
    const app = findActiveAppBySlug(db, workspaceId, slug, workspaceCwd)
    if (!app) return { ok: false, error: 'app_not_active', message: '应用未激活' }
    const limit = Math.min(200, Number(body.limit ?? 50))
    const filter = body.filter && typeof body.filter === 'object' ? body.filter : {}
    if (specRecordsViaMcp(db, app.spec, workspaceCwd)) {
      try {
        const data = await listBoundRecords({ db, aiRuntime }, app.spec, entity, workspaceCwd, {
          filter,
          size: limit,
          page: 1,
        })
        return { ok: true, rows: data?.rows || [], total: data?.total || 0 }
      } catch (error) {
        return { ok: false, error: error?.code || 'invoke_failed', message: error instanceof Error ? error.message : '调用失败' }
      }
    }
    const data = listRecords(db, app.spec, entity, workspaceCwd, {
      filter,
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
    if (op !== 'update') {
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
    const proposed = proposeRecordUpdate(db, {
      workspaceId,
      app,
      entity,
      workspaceCwd,
      rows: body.rows,
    })
    if (!proposed.ok) return proposed
    return { ok: true, proposalId: proposed.proposalId, proposal: proposed.plan }
  }
  return null
}
