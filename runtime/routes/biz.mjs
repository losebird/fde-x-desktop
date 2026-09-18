import { FDE_AI_WORKSPACE } from '../config.mjs'
import { loadMemoryWorkspaceVocab } from '../biz/memory-vocab.mjs'
import { generateWorkspaceVocabFromConnector } from '../biz/vocab-from-connector.mjs'
import { isGateActionCode } from '../biz/gate-action-codes.mjs'
import { normalizePreviewWhere } from '../biz/where.mjs'
import {
  createId,
  getBizWriteAuditByTraceId,
  insertBizSurface,
  insertBizWriteAudit,
  listBizSurfaces,
  listBizWriteAudits,
  listBusinessConnections,
} from '../db.mjs'
import { AiRemoteError } from '../dsh-core.mjs'
import { emit } from '../events.mjs'

function bizWriteFailureMessage(error, fallback = '过账失败，请重新预览后再试') {
  if (error instanceof AiRemoteError) {
    const msg = String(error.message || '').trim()
    if (msg && !msg.startsWith('IM 调用失败')) return msg
    return fallback
  }
  return error instanceof Error ? error.message : fallback
}

const RECORD_ACTION_ALIASES = {
  'record.update': '改行',
  'record.create': '新建',
  'record.delete': '删除',
  'record.read': '现查',
}

function resolveGateAction(rawAction) {
  const trimmed = typeof rawAction === 'string' ? rawAction.trim() : ''
  if (!trimmed) return ''
  if (RECORD_ACTION_ALIASES[trimmed]) return RECORD_ACTION_ALIASES[trimmed]
  if (trimmed.startsWith('record.')) return ''
  return trimmed
}

function vocabExtraFromBody(body) {
  if (body && Array.isArray(body.vocab)) return { vocab: body.vocab }
  const kinds = []
  if (body && Array.isArray(body.kinds)) kinds.push(...body.kinds)
  const kind = body && typeof body.kind === 'string' ? body.kind.trim() : ''
  if (kind) {
    const row = { kind }
    if (Array.isArray(body.can)) row.can = body.can
    if (row.can) kinds.push(row)
  }
  return kinds.length ? { kinds } : {}
}

function mergeVocabExtra(body, vocabExtra) {
  const fromBody = vocabExtraFromBody(body)
  const kinds = [
    ...(Array.isArray(fromBody.kinds) ? fromBody.kinds : []),
    ...(Array.isArray(vocabExtra?.kinds) ? vocabExtra.kinds : []),
  ]
  const vocab = Array.isArray(vocabExtra?.vocab) ? vocabExtra.vocab
    : (Array.isArray(fromBody.vocab) ? fromBody.vocab : undefined)
  if (vocab) return { vocab }
  if (kinds.length) return { kinds }
  return {}
}

/** Same structured bind (where + hop from) for every vocab gate action — Decision 15. */
function actionUsesStructuredBind(action, gateVocabExtra) {
  return isGateActionCode(action, gateVocabExtra)
}

function actionUsesPreviewPatch(action) {
  return action === '改行' || action === '新建'
}

export function translateBizIntent(body, cwd = FDE_AI_WORKSPACE, vocabExtra = {}) {
  const rawAction = typeof body.action === 'string' ? body.action.trim() : ''
  const action = resolveGateAction(rawAction)
  if (!action) return { error: '操作无法翻译成业务闸动作' }

  let kind = typeof body.kind === 'string' ? body.kind.trim() : ''
  let system = typeof body.system === 'string' ? body.system : ''
  let no = typeof body.no === 'string' ? body.no : ''
  const targetRef = typeof body.targetRef === 'string' ? body.targetRef : ''
  const match = targetRef.match(/^fde:\/\/external\/([^/]+)\/table\/([^/]+)(?:\/([^/]+))?$/u)
  if (match) {
    system = system || match[1]
    kind = kind || match[2]
    no = no || match[3] || ''
  }
  if (!kind) return { error: '缺少业务型（kind）。targetRef 需为 fde://external/{system}/table/{kind}' }

  const gateVocabExtra = mergeVocabExtra(body, vocabExtra)
  const input = body.input && typeof body.input === 'object' ? body.input : {}
  no = no || input.no || input.orderNo || input.orderId || ''
  const previewWhere = actionUsesStructuredBind(action, gateVocabExtra)
    ? normalizePreviewWhere(body.where ?? input.where ?? input.filter)
    : []
  const fromRaw = body.from && typeof body.from === 'object' ? body.from : null
  const fromKind = fromRaw && typeof fromRaw.kind === 'string' ? fromRaw.kind.trim() : ''
  const fromWhere = fromKind && actionUsesStructuredBind(action, gateVocabExtra)
    ? normalizePreviewWhere(fromRaw.where)
    : []
  const payload = {
    kind,
    action,
    speech: typeof body.speech === 'string' ? body.speech : rawAction,
    ...(system ? { system } : {}),
    ...(typeof body.env === 'string' && body.env ? { env: body.env } : {}),
    ...(no ? { no } : {}),
    ...(cwd ? { workspace: cwd } : {}),
    ...(actionUsesPreviewPatch(action)
      || (!actionUsesStructuredBind(action, gateVocabExtra) && Object.keys(input).length)
      ? { patch: input }
      : {}),
    ...(previewWhere.length ? { where: previewWhere } : {}),
    ...(fromKind && fromWhere.length ? { from: { kind: fromKind, where: fromWhere } } : {}),
  }
  return { payload }
}

/**
 * Emit biz.sheet.pending for all SSE clients (workspaceCwd null avoids cwd mismatch drops).
 * @param {Record<string, unknown>} sheet
 * @param {{ sessionId?: string, source?: string, workspaceCwd?: string }} [meta]
 */
export function emitBizSheetPending(sheet, { sessionId, source = 'bff', workspaceCwd } = {}) {
  if (!sheet || typeof sheet !== 'object') return false
  const kind = String(sheet.kind || '')
  const action = String(sheet.action || '')
  const previewId = sheet.preview_id ?? sheet.previewId
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  const columns = Array.isArray(sheet.columns) ? sheet.columns : []
  if (!kind || !action) return false

  emit('biz.sheet.pending', {
    kind,
    action,
    previewId: typeof previewId === 'string' ? previewId : undefined,
    rows: rows.length,
    columns,
    canWrite: Boolean(sheet.canWrite ?? sheet.can_write),
    source,
    sessionId,
    workspaceCwd: typeof workspaceCwd === 'string' ? workspaceCwd : undefined,
    sheet: {
      kind,
      action,
      preview_id: typeof previewId === 'string' ? previewId : null,
      previewId: typeof previewId === 'string' ? previewId : null,
      rows,
      columns,
      canWrite: Boolean(sheet.canWrite ?? sheet.can_write),
      sessionId,
      ...(Array.isArray(sheet.where) && sheet.where.length ? { where: sheet.where } : {}),
      ...(Array.isArray(sheet.hopWhere) && sheet.hopWhere.length ? { hopWhere: sheet.hopWhere } : {}),
    },
  }, {
    workspaceCwd: null,
    sessionId,
    source,
  })
  return true
}

function recordSurfaceFromPreview(db, workspaceCwd, body, preview, source, { emitEvent = true } = {}) {
  const sheet = preview?.sheet && typeof preview.sheet === 'object' ? preview.sheet : preview
  const kind = String(sheet?.kind || body.kind || '')
  const action = String(sheet?.action || body.action || '')
  const previewId = sheet?.preview_id ?? sheet?.previewId ?? preview?.preview_id ?? preview?.previewId
  const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
  const columns = Array.isArray(sheet?.columns) ? sheet.columns : []
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined
  const connectionId = typeof body.connectionId === 'string' ? body.connectionId : undefined
  if (!kind || !action) return

  insertBizSurface(db, {
    workspaceCwd,
    connectionId,
    kind,
    action,
    previewId: typeof previewId === 'string' ? previewId : undefined,
    sessionId,
    rowCount: rows.length,
    columnsJson: JSON.stringify(columns),
  })
  if (emitEvent) emitBizSheetPending(sheet, { sessionId, source, workspaceCwd })
}

function resolveBizWorkspace(url, aiRuntime) {
  const fromQuery = String(url.searchParams.get('workspace') || url.searchParams.get('cwd') || '').trim()
  if (fromQuery.startsWith('/')) return fromQuery
  const fromRuntime = typeof aiRuntime?.cwd === 'string' ? aiRuntime.cwd.trim() : ''
  if (fromRuntime.startsWith('/')) return fromRuntime
  return FDE_AI_WORKSPACE
}

function resolveActiveBizCwd(url, body, aiRuntime, requestMemoryCwd) {
  const explicit = requestMemoryCwd(url, body)
  if (explicit) return explicit
  const fromBodyWorkspace = body && typeof body.workspace === 'string' ? body.workspace.trim() : ''
  if (fromBodyWorkspace.startsWith('/')) return fromBodyWorkspace
  return resolveBizWorkspace(url, aiRuntime)
}

async function runConnectorVocabGenerate(aiRuntime, {
  workspace,
  dialect,
  baseUrl,
  token,
  catalogVersion,
}) {
  return generateWorkspaceVocabFromConnector({
    workspace,
    dialect,
    baseUrl,
    token,
    catalogVersion,
    persistBatch: (batch) => aiRuntime.patchWorkspaceVocab(workspace, batch),
  })
}

function summarizeAuditChanges(changes) {
  const list = Array.isArray(changes) ? changes : []
  if (!list.length) return '—'
  const labels = list
    .map((item) => String((item && (item.label || item.field || item.key)) || '').trim())
    .filter(Boolean)
  if (!labels.length) return `${list.length} 项变更`
  const head = labels.slice(0, 3).join('、')
  return labels.length > 3 ? `${head} 等 ${labels.length} 项` : head
}

function canRollbackAudit(action, changes) {
  return String(action || '') === '改行' && Array.isArray(changes) && changes.length > 0
}

function patchFromRollbackChanges(changes) {
  const patch = {}
  for (const item of Array.isArray(changes) ? changes : []) {
    const key = String((item && (item.field || item.key)) || '').trim()
    if (!key) continue
    patch[key] = item.from
  }
  return patch
}

async function capturePendingSheet(aiRuntime, previewId) {
  try {
    const state = await aiRuntime.lanAssist('/state', { search: { sessionId: '' } })
    const raw = state?.pendingSheet ?? state?.pendingWrite
    const sheet = raw?.sheet && typeof raw.sheet === 'object' ? raw.sheet : raw
    if (!sheet || typeof sheet !== 'object') return null
    const pid = String(sheet.preview_id || sheet.previewId || '').trim()
    if (pid && previewId && pid !== previewId) return null
    return sheet
  } catch {
    return null
  }
}

function enrichTraceRows(db, workspace, traceRows, limit) {
  const audits = listBizWriteAudits(db, workspace, limit)
  const auditByTrace = new Map(audits.map((row) => [row.traceId, row]))
  const seen = new Set()
  const enriched = []
  for (const row of Array.isArray(traceRows) ? traceRows : []) {
    const traceId = String(row?.id || row?.traceId || '').trim()
    if (!traceId) continue
    seen.add(traceId)
    const audit = auditByTrace.get(traceId)
    const changes = audit?.changes?.length ? audit.changes : []
    const action = String(row?.action || audit?.action || '')
    enriched.push({
      ...row,
      id: traceId,
      traceId,
      at: Number(row?.at || audit?.writtenAt || 0),
      kind: String(row?.kind || audit?.kind || ''),
      no: String(row?.no || audit?.recordNo || ''),
      action,
      receiptId: String(row?.receipt_id || row?.receiptId || audit?.receiptId || ''),
      sessionId: String(row?.sessionId || row?.session_id || audit?.sessionId || ''),
      source: String(audit?.source || (row?.sessionId || row?.session_id ? 'ai' : 'workstation')),
      changes,
      changesSummary: summarizeAuditChanges(changes),
      canRollback: canRollbackAudit(action, changes),
    })
  }
  for (const audit of audits) {
    if (seen.has(audit.traceId)) continue
    enriched.push({
      id: audit.traceId,
      traceId: audit.traceId,
      at: audit.writtenAt,
      kind: audit.kind,
      no: audit.recordNo,
      action: audit.action,
      receiptId: audit.receiptId,
      sessionId: audit.sessionId,
      source: audit.source,
      changes: audit.changes,
      changesSummary: summarizeAuditChanges(audit.changes),
      canRollback: canRollbackAudit(audit.action, audit.changes),
    })
  }
  enriched.sort((a, b) => Number(b.at || 0) - Number(a.at || 0))
  return enriched.slice(0, limit)
}

function mapKindsFromCatalog(catalogPayload) {
  const kindsRaw = Array.isArray(catalogPayload?.kinds) ? catalogPayload.kinds : []
  const kinds = kindsRaw.map((row) => {
    if (typeof row === 'string') return { kind: row, label: row, fields: [] }
    const kind = String(row.kind || row.name || '')
    const label = String(row.label || row.speak || kind)
    const fields = Array.isArray(row.fields) ? row.fields : []
    const can = Array.isArray(row.can) ? row.can : undefined
    const relations = Array.isArray(row.relations) ? row.relations : undefined
    const fieldLabels = row.fieldLabels && typeof row.fieldLabels === 'object' && !Array.isArray(row.fieldLabels)
      ? row.fieldLabels
      : undefined
    const ticketField = typeof row.ticketField === 'string' && row.ticketField.trim() ? row.ticketField.trim() : undefined
    return {
      kind,
      label,
      fields,
      ...(can ? { can } : {}),
      ...(relations ? { relations } : {}),
      ...(ticketField ? { ticketField } : {}),
      ...(fieldLabels ? { fieldLabels } : {}),
    }
  })
  return {
    kinds,
    relations: Array.isArray(catalogPayload?.relations) ? catalogPayload.relations : [],
    catalogVersion: catalogPayload?.catalogVersion ?? catalogPayload?.catalog_version ?? null,
  }
}

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @param {URL} url
 */
export async function handleBizRoutes(request, response, url, deps) {
  const {
    db,
    aiRuntime,
    readJson,
    sendJson,
    sendError,
    correlationId,
    stripSecrets,
    normalizeBaseUrl,
    exchangeNocoBaseToken,
    requestMemoryCwd,
  } = deps

  if (!url.pathname.startsWith('/api/v1/biz')) return false

  if (request.method === 'POST' && url.pathname === '/api/v1/biz/vocab/generate') {
    const body = await readJson(request)
    const workspace = resolveActiveBizCwd(url, body, aiRuntime, requestMemoryCwd)
    const baseUrl = normalizeBaseUrl(body.baseUrl)
    let token = typeof body.token === 'string' ? body.token.trim() : ''
    const account = typeof body.account === 'string' ? body.account.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (account && password && baseUrl) {
      try {
        token = await exchangeNocoBaseToken(baseUrl, account, password)
      } catch (error) {
        if (!token) {
          sendError(response, 401, error.code || 'EXPIRED', error.message || '业务系统登录失败', correlationId)
          return true
        }
      }
    }
    if (!token && !baseUrl) {
      sendError(response, 400, 'validation_error', '需要已登记的连接器 token，或同时提供 baseUrl 与 token（或账号密码）', correlationId)
      return true
    }
    try {
      const result = await runConnectorVocabGenerate(aiRuntime, {
        workspace,
        dialect: body.dialect || 'nocobase',
        baseUrl,
        token,
        catalogVersion: body.catalogVersion,
      })
      if (result && result.ok === false) {
        sendError(response, 400, String(result.error || 'vocab_generate_failed'), String(result.hint || result.error || '词表生成失败'), correlationId)
        return true
      }
      sendJson(response, 200, { data: stripSecrets(result), correlationId })
    } catch (error) {
      sendError(response, 503, 'vocab_generate_failed', error instanceof Error ? error.message : '词表生成失败', correlationId)
    }
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/biz/kinds') {
    const workspace = resolveActiveBizCwd(url, null, aiRuntime, requestMemoryCwd)
    try {
      const catalog = await aiRuntime.lanAssist('/catalog', { search: { workspace } })
      if (catalog && catalog.ok === false) {
        sendError(response, 503, catalog.error || 'NO_CATALOG', catalog.hint || '事务底座未就绪', correlationId)
        return true
      }
      let data = mapKindsFromCatalog(catalog)
      if (!data.kinds.length && workspace.startsWith('/')) {
        const fromMemory = await loadMemoryWorkspaceVocab(aiRuntime, workspace)
        if (fromMemory.kinds.length) data = fromMemory
      }
      sendJson(response, 200, { data, correlationId })
    } catch (error) {
      sendError(response, 503, 'lan_assist_unavailable', error instanceof Error ? error.message : '事务底座未就绪', correlationId)
    }
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/biz/traces') {
    const workspace = resolveActiveBizCwd(url, null, aiRuntime, requestMemoryCwd)
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? 50)))
    const traceId = String(url.searchParams.get('id') || url.searchParams.get('traceId') || '').trim()
    if (traceId) {
      const audit = getBizWriteAuditByTraceId(db, traceId)
      if (audit) {
        sendJson(response, 200, {
          data: {
            row: {
              id: audit.traceId,
              traceId: audit.traceId,
              at: audit.writtenAt,
              kind: audit.kind,
              no: audit.recordNo,
              action: audit.action,
              receiptId: audit.receiptId,
              sessionId: audit.sessionId,
              source: audit.source,
              changes: audit.changes,
              columns: audit.columns,
              changesSummary: summarizeAuditChanges(audit.changes),
              canRollback: canRollbackAudit(audit.action, audit.changes),
            },
          },
          correlationId,
        })
        return true
      }
      try {
        const traces = await aiRuntime.lanAssist('/traces', { search: { workspace, id: traceId } })
        const row = traces?.row || (Array.isArray(traces?.rows) ? traces.rows[0] : null)
        if (row) {
          sendJson(response, 200, { data: { row: enrichTraceRows(db, workspace, [row], 1)[0] }, correlationId })
          return true
        }
      } catch { /* fall through */ }
      sendError(response, 404, 'not_found', '找不到该操作记录', correlationId)
      return true
    }
    try {
      const traces = await aiRuntime.lanAssist('/traces', { search: { workspace, limit: String(limit) } })
      const traceRows = Array.isArray(traces?.rows) ? traces.rows : []
      const rows = enrichTraceRows(db, workspace, traceRows, limit)
      sendJson(response, 200, { data: { rows, receipt: traces?.receipt ?? null }, correlationId })
    } catch (error) {
      const rows = enrichTraceRows(db, workspace, [], limit)
      if (rows.length) {
        sendJson(response, 200, { data: { rows, receipt: null }, correlationId })
        return true
      }
      sendError(response, 503, 'lan_assist_unavailable', error instanceof Error ? error.message : '事务底座未就绪', correlationId)
    }
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/biz/rollback/preview') {
    const body = await readJson(request)
    const traceId = String(body.trace_id || body.traceId || '').trim()
    if (!traceId) {
      sendError(response, 400, 'validation_error', 'trace_id 不能为空', correlationId)
      return true
    }
    const workspace = resolveActiveBizCwd(url, body, aiRuntime, requestMemoryCwd)
    const audit = getBizWriteAuditByTraceId(db, traceId)
    if (!audit || !Array.isArray(audit.changes) || !audit.changes.length) {
      sendError(response, 404, 'not_found', '找不到可回退的字段记录', correlationId)
      return true
    }
    if (!canRollbackAudit(audit.action, audit.changes)) {
      sendError(response, 400, 'rollback_unsupported', '当前仅支持带字段差异的改行回退', correlationId)
      return true
    }
    const patch = patchFromRollbackChanges(audit.changes)
    if (!Object.keys(patch).length) {
      sendError(response, 400, 'rollback_unsupported', '没有可恢复的字段值', correlationId)
      return true
    }
    try {
      const preview = await aiRuntime.lanAssist('/preview', {
        method: 'POST',
        body: {
          kind: audit.kind,
          action: '改行',
          no: audit.recordNo,
          workspace,
          patch,
          speech: '回退',
        },
      })
      if (preview && preview.ok === false) {
        sendError(response, 400, String(preview.error || 'preview_failed'), String(preview.hint || preview.speak || '回退预览失败'), correlationId)
        return true
      }
      const sheet = preview?.sheet && typeof preview.sheet === 'object' ? preview.sheet : preview
      sendJson(response, 200, {
        data: {
          audit,
          preview,
          sheet,
          rollbackChanges: audit.changes.map((item) => ({
            label: String(item.label || item.field || item.key || ''),
            from: item.to,
            to: item.from,
            field: item.field || item.key,
          })),
        },
        correlationId,
      })
    } catch (error) {
      sendError(response, 503, 'lan_assist_unavailable', error instanceof Error ? error.message : '事务底座未就绪', correlationId)
    }
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/biz/surfaces') {
    const workspace = String(url.searchParams.get('workspace') || url.searchParams.get('cwd') || '').trim()
    const workspaceCwd = workspace.startsWith('/') ? workspace : FDE_AI_WORKSPACE
    const limit = Number(url.searchParams.get('limit') ?? 20)
    const items = listBizSurfaces(db, workspaceCwd, limit)
    sendJson(response, 200, { items, correlationId })
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/biz/pending-sheet') {
    try {
      const state = await aiRuntime.lanAssist('/state', { search: { sessionId: '' } })
      if (!state || state.ok === false) {
        sendJson(response, 200, { data: { sheet: null }, correlationId })
        return true
      }
      const raw = state.pendingSheet ?? state.pendingWrite
      if (!raw || typeof raw !== 'object') {
        sendJson(response, 200, { data: { sheet: null }, correlationId })
        return true
      }
      const sheet = {
        kind: String(raw.kind || ''),
        action: String(raw.action || ''),
        preview_id: raw.preview_id ?? raw.previewId ?? null,
        previewId: raw.preview_id ?? raw.previewId ?? null,
        rows: Array.isArray(raw.rows) ? raw.rows : [],
        columns: Array.isArray(raw.columns) ? raw.columns : [],
        canWrite: Boolean(raw.canWrite ?? raw.can_write),
        sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : undefined,
        ...(Array.isArray(raw.where) && raw.where.length ? { where: raw.where } : {}),
        ...(Array.isArray(raw.hopWhere) && raw.hopWhere.length ? { hopWhere: raw.hopWhere } : {}),
      }
      sendJson(response, 200, { data: { sheet: stripSecrets(sheet) }, correlationId })
    } catch (error) {
      sendError(response, 503, 'lan_assist_unavailable', error instanceof Error ? error.message : '事务底座未就绪', correlationId)
    }
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/biz/connections') {
    const workspaceId = url.searchParams.get('workspace') ?? url.searchParams.get('workspaceId') ?? 'ws_personal'
    const items = listBusinessConnections(db, { workspaceId })
    let online = false
    let catalogVersion = null
    try {
      const state = await aiRuntime.lanAssist('/state', { search: { sessionId: '' } })
      online = Boolean(state && state.ok !== false)
      catalogVersion = state?.catalogVersion ?? state?.catalog_version ?? null
    } catch {
      online = false
    }
    sendJson(response, 200, {
      items: items.map((row) => ({ ...row, lanAssistOnline: online, catalogVersion })),
      correlationId,
    })
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/biz/preview') {
    const body = await readJson(request)
    const described = await aiRuntime.lanAssist('/state', { search: { sessionId: '' } })
    if (described && described.ok === false) {
      sendError(response, 400, described.error || 'NO_CATALOG', described.hint || '目录没读成', correlationId)
      return true
    }
    const bizWorkspace = resolveActiveBizCwd(url, body, aiRuntime, requestMemoryCwd)
    let previewVocabExtra = {}
    try {
      const fromMemory = await loadMemoryWorkspaceVocab(aiRuntime, bizWorkspace)
      if (fromMemory.kinds?.length) previewVocabExtra = { kinds: fromMemory.kinds }
    } catch { /* spoken seed still applies in gate-action-codes */ }
    const translated = translateBizIntent(body, bizWorkspace, previewVocabExtra)
    if (translated.error) {
      sendError(response, 400, 'validation_error', translated.error, correlationId)
      return true
    }
    const preview = await aiRuntime.lanAssist('/preview', { method: 'POST', body: translated.payload })
    const bizCwd = requestMemoryCwd(url, body) || FDE_AI_WORKSPACE
    recordSurfaceFromPreview(db, bizCwd, body, preview, 'ui')
    sendJson(response, 200, { data: preview, correlationId })
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/biz/catalog') {
    const state = await aiRuntime.lanAssist('/state', { search: { sessionId: '' } })
    const items = Array.isArray(state.catalog) ? state.catalog : []
    sendJson(response, 200, { data: { items }, correlationId })
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/biz/catalog') {
    const body = await readJson(request)
    const result = await aiRuntime.lanAssist('/catalog/publish', {
      method: 'POST',
      body: { ...body, workspace: body.workspace || aiRuntime.cwd, confirm: body.confirm === true },
    })
    sendJson(response, 200, { data: stripSecrets(result), correlationId })
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/biz/lookup') {
    const body = await readJson(request)
    if (!aiRuntime.status().connected) {
      try {
        await aiRuntime.start()
      } catch {
        sendError(response, 503, 'ai/not-connected', '请先在运行环境连接本地核心', correlationId)
        return true
      }
    }
    const baseUrl = normalizeBaseUrl(body.baseUrl)
    const account = typeof body.account === 'string' ? body.account.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    let token = typeof body.token === 'string' ? body.token.trim() : ''
    if (account && password) {
      try {
        token = await exchangeNocoBaseToken(baseUrl, account, password)
      } catch (error) {
        if (!token) {
          sendError(response, 401, error.code || 'EXPIRED', error.message || '业务系统登录失败', correlationId)
          return true
        }
      }
    }
    if (!baseUrl) {
      sendError(response, 400, 'validation_error', '地址不能为空', correlationId)
      return true
    }
    if (!token) {
      sendError(response, 400, 'validation_error', '需要 API Key，或账号加密码用来换 token', correlationId)
      return true
    }
    const saved = await aiRuntime.lanAssist('/lookup/config', {
      method: 'POST',
      body: {
        system: body.system,
        env: body.env,
        dialect: body.dialect || 'nocobase',
        baseUrl,
        token,
      },
    })
    let vocabGenerated = null
    const shouldGenerate = body.generateVocab !== false && body.syncVocab !== false
    if (shouldGenerate && token && baseUrl) {
      const workspace = resolveActiveBizCwd(url, body, aiRuntime, requestMemoryCwd)
      try {
        vocabGenerated = await runConnectorVocabGenerate(aiRuntime, {
          workspace,
          dialect: body.dialect || 'nocobase',
          baseUrl,
          token,
        })
      } catch (error) {
        vocabGenerated = {
          ok: false,
          error: error instanceof Error ? error.message : 'vocab_generate_failed',
        }
      }
    }
    sendJson(response, 200, {
      data: stripSecrets({
        ...saved,
        ...(vocabGenerated ? { vocabGenerate: vocabGenerated } : {}),
      }),
      correlationId,
    })
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/biz/preview/dismiss') {
    try {
      const dismissed = await aiRuntime.lanAssist('/write/cancel', { method: 'POST', body: {} })
      sendJson(response, 200, { data: dismissed, correlationId })
    } catch (error) {
      sendError(
        response,
        503,
        'biz_dismiss_failed',
        bizWriteFailureMessage(error, '无法关闭预览，请稍后重试'),
        correlationId,
      )
    }
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/biz/write') {
    const body = await readJson(request)
    if (typeof body.preview_id !== 'string' || !body.preview_id) {
      sendError(response, 400, 'validation_error', 'preview_id 不能为空', correlationId)
      return true
    }
    const bizWorkspace = resolveActiveBizCwd(url, body, aiRuntime, requestMemoryCwd)
    const pendingSheet = await capturePendingSheet(aiRuntime, body.preview_id)
    let written
    try {
      written = await aiRuntime.lanAssist('/write', {
        method: 'POST',
        body: {
          preview_id: body.preview_id,
          trace_id: body.trace_id,
          ...(bizWorkspace ? { workspace: bizWorkspace } : {}),
        },
      })
    } catch (error) {
      sendError(
        response,
        400,
        error instanceof AiRemoteError ? (error.code || 'biz_write_failed') : 'biz_write_failed',
        bizWriteFailureMessage(error),
        correlationId,
      )
      return true
    }
    if (written && written.ok === false) {
      sendError(
        response,
        400,
        String(written.error || 'biz_write_failed'),
        String(written.hint || written.speak || written.error || '过账失败，请重新预览后再试'),
        correlationId,
      )
      return true
    }
    const bizCwd = requestMemoryCwd(url, body) || bizWorkspace || FDE_AI_WORKSPACE
    const sheet = pendingSheet && typeof pendingSheet === 'object' ? pendingSheet : null
    const auditChanges = Array.isArray(body.changes)
      ? body.changes
      : (Array.isArray(sheet?.changes) ? sheet.changes : [])
    const traceId = String(body.trace_id || written?.trace_id || written?.traceId || createId('trace'))
    try {
      insertBizWriteAudit(db, {
        workspaceCwd: bizCwd,
        traceId,
        kind: String(written?.kind || sheet?.kind || body.kind || ''),
        action: String(written?.action || sheet?.action || body.action || ''),
        recordNo: String(written?.no || sheet?.no || body.no || ''),
        receiptId: String(written?.receipt_id || written?.receiptId || ''),
        sessionId: String(sheet?.sessionId || body.session_id || body.sessionId || ''),
        source: String(body.source || (sheet?.sessionId ? 'ai' : 'workstation')),
        changes: auditChanges,
        columns: Array.isArray(sheet?.columns) ? sheet.columns : (Array.isArray(body.columns) ? body.columns : []),
      })
    } catch { /* audit must not block write */ }
    emit('biz.write.done', {
      kind: String(written?.kind || ''),
      action: String(written?.action || ''),
      traceId,
      receiptId: String(written?.receipt_id || written?.receiptId || ''),
      operationId: typeof body.operationId === 'string' ? body.operationId : undefined,
    }, { workspaceCwd: bizCwd, source: 'bff' })
    sendJson(response, 200, { data: { ...written, trace_id: traceId, traceId }, correlationId })
    return true
  }

  return false
}

export { recordSurfaceFromPreview }
