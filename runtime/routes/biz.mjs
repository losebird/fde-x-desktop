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
  setBizWriteAuditRollbackState,
} from '../db.mjs'
import {
  isPermanentRollbackError,
  ROLLBACK_STATE_BLOCKED,
  ROLLBACK_STATE_ROLLED_BACK,
  rollbackBadgeFromAudit,
} from '../biz/rollback-outcome.mjs'
import { AiRemoteError } from '../dsh-core.mjs'
import { emit } from '../events.mjs'
import {
  dismissShouldClearHall,
  hallPreviewIdFromState,
  isBizPreviewDismissed,
  rememberBizPreviewDismissed,
  sheetAfterDismissedWrite,
  sheetPreviewIdFromRecord,
} from '../biz/dismissed-previews.mjs'
import { sheetPayloadFromRaw, sheetPreviewIdFromRaw } from '../biz/sheet-payload.mjs'
import {
  collapseKindsToConnectedTables,
  canonicalizeSheetKind,
  dropActionBatchLeftover,
  isSpokenActionOrBatchToken,
  resolveConnectedKind,
  shouldSkipCoveringPending,
  sheetForOfficialGet,
} from '../biz/connected-kind.mjs'
import { projectWriteConfirm, releaseEmittedConfirm } from '../biz/write-confirm.mjs'
import {
  auditRecordNo,
  captureLookupBind,
  effectiveBizKind,
  isSpokenMetaKind,
  parseLookupBind,
  rollbackPreviewRequest,
} from '../biz/audit-lookup.mjs'

function bizWriteFailureMessage(error, fallback = '过账失败，请重新预览后再试') {
  if (error instanceof AiRemoteError) {
    const msg = String(error.message || '').trim()
    if (msg && !msg.startsWith('IM 调用失败')) return msg
    const payload = error.details && error.details.payload
    const lines = payload && Array.isArray(payload.lines) ? payload.lines : []
    const line0 = lines.find((row) => row && (row.hint || row.error))
    const hint = line0 && String(line0.hint || '').trim()
    if (hint) return hint
    if (line0 && String(line0.error || '') === 'EXPIRED') return '预览过期了。要写再预览一次。'
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

function enrichAuditAction(action) {
  const resolved = resolveGateAction(action)
  return resolved || String(action || '').trim()
}

function columnKeysFromAudit(audit) {
  const cols = Array.isArray(audit?.columns) ? audit.columns : []
  const keys = new Set()
  const labels = new Set()
  for (const col of cols) {
    if (!col || typeof col !== 'object') continue
    const key = String(col.key || '').trim()
    const label = String(col.label || '').trim()
    if (key) keys.add(key)
    if (label) labels.add(label)
  }
  for (const change of Array.isArray(audit?.changes) ? audit.changes : []) {
    if (!change || typeof change !== 'object') continue
    const label = String(change.label || '').trim()
    if (label) labels.add(label)
  }
  return { keys, labels }
}

function inferKindFromCatalog(audit, kinds) {
  const { keys, labels } = columnKeysFromAudit(audit)
  if (!keys.size && !labels.size) return ''
  let bestKind = ''
  let bestScore = 0
  for (const row of Array.isArray(kinds) ? kinds : []) {
    const kind = String(row.kind || '').trim()
    if (!kind || isSpokenMetaKind(kind)) continue
    const fields = Array.isArray(row.fields) ? row.fields : []
    let score = 0
    for (const field of fields) {
      if (typeof field === 'string') {
        const token = field.trim()
        if (!token) continue
        if (keys.has(token)) score += 2
        if (labels.has(token)) score += 2
        continue
      }
      if (!field || typeof field !== 'object') continue
      const fk = String(field.key || field.name || '').trim()
      const fl = String(field.label || field.title || '').trim()
      if (fk && keys.has(fk)) score += 2
      if (fl && labels.has(fl)) score += 1
    }
    const ticketField = String(row.ticketField || '').trim()
    if (ticketField && keys.has(ticketField)) score += 3
    if (score > bestScore) {
      bestScore = score
      bestKind = kind
    }
  }
  return bestScore >= 4 ? bestKind : ''
}

async function loadWorkspaceKinds(aiRuntime, workspace) {
  try {
    const catalog = await aiRuntime.lanAssist('/catalog', { search: { workspace } })
    if (catalog && catalog.ok === false) return []
    let data = mapKindsFromCatalog(catalog)
    if (workspace.startsWith('/')) {
      try {
        const fromMemory = await loadMemoryWorkspaceVocab(aiRuntime, workspace)
        data = mergeConnectedKindCatalog(data, fromMemory)
      } catch { /* keep catalog kinds */ }
    } else if (!data.kinds.length) {
      const fromMemory = await loadMemoryWorkspaceVocab(aiRuntime, workspace)
      if (fromMemory.kinds.length) data = fromMemory
    }
    return data.kinds || []
  } catch {
    return []
  }
}

async function resolveAuditBizKind(aiRuntime, workspace, audit, traceRow) {
  const bind = parseLookupBind(audit)
  let kind = effectiveBizKind(bind.bizKind, audit?.kind)
  if (kind && !isSpokenMetaKind(kind)) return kind
  const kinds = await loadWorkspaceKinds(aiRuntime, workspace)
  kind = inferKindFromCatalog(audit, kinds)
  if (kind && !isSpokenMetaKind(kind)) return kind
  kind = effectiveBizKind(traceRow?.kind)
  return kind && !isSpokenMetaKind(kind) ? kind : ''
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

function normalizeFromHop(raw, action, gateVocabExtra, depth = 0) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || depth > 8) return null
  const kind = typeof raw.kind === 'string' ? raw.kind.trim() : ''
  if (!kind) return null
  if (!actionUsesStructuredBind(action, gateVocabExtra)) return null
  const where = normalizePreviewWhere(raw.where)
  const nested = normalizeFromHop(raw.from, action, gateVocabExtra, depth + 1)
  return {
    kind,
    ...(where.length ? { where } : {}),
    ...(nested ? { from: nested } : {}),
    ...(typeof raw.no === 'string' && raw.no.trim() ? { no: raw.no.trim() } : {}),
    ...(typeof raw.relation === 'string' && raw.relation.trim() ? { relation: raw.relation.trim() } : {}),
    ...(raw.join === 'or' ? { join: 'or' } : {}),
  }
}

export function translateBizIntent(body, cwd = FDE_AI_WORKSPACE, vocabExtra = {}) {
  const rawAction = typeof body.action === 'string' ? body.action.trim() : ''
  const action = resolveGateAction(rawAction)
  if (!action) return { error: '操作无法翻译成业务闸动作' }

  let kind = typeof body.kind === 'string' ? body.kind.trim() : ''
  let system = typeof body.system === 'string' ? body.system : ''
  let no = typeof body.no === 'string' ? body.no : ''
  const speech = typeof body.speech === 'string' ? body.speech : rawAction
  const targetRef = typeof body.targetRef === 'string' ? body.targetRef : ''
  const match = targetRef.match(/^fde:\/\/external\/([^/]+)\/table\/([^/]+)(?:\/([^/]+))?$/u)
  if (match) {
    system = system || match[1]
    kind = kind || match[2]
    no = no || match[3] || ''
  }

  const rawKinds = Array.isArray(vocabExtra?.kinds)
    ? vocabExtra.kinds
    : (Array.isArray(vocabExtra?.vocab) ? vocabExtra.vocab : [])
  const fillerVocab = Array.isArray(vocabExtra?.vocab) ? vocabExtra.vocab : rawKinds
  if (kind && isSpokenActionOrBatchToken(kind, fillerVocab)) kind = ''
  if (!kind) return { error: '缺少业务型（kind）。targetRef 需为 fde://external/{system}/table/{kind}' }

  if (rawKinds.length) {
    const collapsed = collapseKindsToConnectedTables(rawKinds)
    if (vocabExtra?.aliases && typeof vocabExtra.aliases === 'object') {
      Object.assign(collapsed.aliases, vocabExtra.aliases)
    }
    const resolved = resolveConnectedKind(kind, collapsed)
    if (!resolved) return { error: '该对象没有连接业务表' }
    kind = resolved
  }

  const gateVocabExtra = mergeVocabExtra(body, vocabExtra)
  const input = body.input && typeof body.input === 'object' ? body.input : {}
  no = dropActionBatchLeftover(no || input.no || input.orderNo || input.orderId || '', speech, fillerVocab)
  const previewWhere = actionUsesStructuredBind(action, gateVocabExtra)
    ? normalizePreviewWhere(body.where ?? input.where ?? input.filter)
    : []
  const fromRaw = (body.from && typeof body.from === 'object' && !Array.isArray(body.from))
    ? body.from
    : (input.from && typeof input.from === 'object' && !Array.isArray(input.from) ? input.from : null)
  const fromHop = normalizeFromHop(fromRaw, action, gateVocabExtra)
  const stepsRaw = Array.isArray(body.steps) ? body.steps
    : (Array.isArray(input.steps) ? input.steps : [])
  const steps = stepsRaw
    .filter((row) => row && typeof row === 'object' && String(row.kind || '').trim())
    .map((row) => ({
      kind: String(row.kind).trim(),
      ...(Array.isArray(row.where) ? { where: normalizePreviewWhere(row.where) } : {}),
      ...(typeof row.no === 'string' && row.no.trim() ? { no: row.no.trim() } : {}),
      ...(typeof row.from === 'string' && row.from.trim() ? { from: row.from.trim() } : {}),
      ...(typeof row.relation === 'string' && row.relation.trim() ? { relation: row.relation.trim() } : {}),
    }))
  const payload = {
    kind,
    action,
    speech,
    ...(typeof body.relation === 'string' && body.relation.trim() ? { relation: body.relation.trim() } : {}),
    ...(system ? { system } : {}),
    ...(typeof body.env === 'string' && body.env ? { env: body.env } : {}),
    ...(no ? { no } : {}),
    ...(cwd ? { workspace: cwd } : {}),
    ...(actionUsesPreviewPatch(action)
      || (!actionUsesStructuredBind(action, gateVocabExtra) && Object.keys(input).length)
      ? { patch: input }
      : {}),
    ...(previewWhere.length ? { where: previewWhere } : {}),
    ...(fromHop ? { from: fromHop } : {}),
    ...(steps.length ? { steps } : {}),
    ...(body.picked === true ? { picked: true } : {}),
    ...(body.replay === true ? { replay: true } : {}),
    ...(Number(body.page) > 0 ? { page: Math.floor(Number(body.page)) } : {}),
  }
  return { payload }
}

/**
 * Emit biz.sheet.pending for all SSE clients (workspaceCwd null avoids cwd mismatch drops).
 * @param {Record<string, unknown>} sheet
 * @param {{ sessionId?: string, source?: string, workspaceCwd?: string }} [meta]
 */
const lastEmittedPendingBySession = new Map()

function lastEmittedSessionKey(sessionId, sheet) {
  const sid = String(sessionId || sheet?.sessionId || '').trim()
  return sid || '__global__'
}

function peekLastEmittedPending(sessionId) {
  const key = lastEmittedSessionKey(sessionId, null)
  return lastEmittedPendingBySession.get(key) ?? null
}

function releaseLastEmittedConfirm(sessionId, previewId) {
  const wanted = String(previewId || '').trim()
  const keys = []
  const named = String(sessionId || '').trim()
  if (named) keys.push(lastEmittedSessionKey(named, null))
  else keys.push(...lastEmittedPendingBySession.keys())
  for (const key of keys) {
    const last = lastEmittedPendingBySession.get(key)
    if (!last || typeof last !== 'object') continue
    const id = sheetPreviewIdFromRecord(last)
    if (wanted && id && id !== wanted) continue
    lastEmittedPendingBySession.set(key, releaseEmittedConfirm(last))
  }
}

export function emitBizSheetPending(sheet, { sessionId, source = 'bff', workspaceCwd, surfaceId, hallSheet, force = false, writePreview } = {}) {
  const normalized = sheetPayloadFromRaw(sheet)
  if (!normalized) return false
  const emitKey = lastEmittedSessionKey(sessionId, normalized)
  const lastEmitted = lastEmittedPendingBySession.get(emitKey) ?? null
  if (!force && shouldSkipCoveringPending(lastEmitted, normalized)) return false
  const hall = hallSheet && typeof hallSheet === 'object' ? hallSheet : null
  if (!force && hall && shouldSkipCoveringPending(hall, normalized)) return false
  const previewId = sheetPreviewIdFromRecord(normalized)
  if (previewId && isBizPreviewDismissed(previewId)) return false
  const kind = String(normalized.kind || '')
  const action = String(normalized.action || '')
  const rows = Array.isArray(normalized.rows) ? normalized.rows : []
  const columns = Array.isArray(normalized.columns) ? normalized.columns : []
  if (!kind || !action) return false

  let payloadSheet = {
    ...normalized,
    sessionId,
    ...(typeof sheet.speech === 'string' && sheet.speech ? { speech: sheet.speech } : {}),
  }
  if (writePreview && typeof writePreview === 'object') {
    payloadSheet = projectWriteConfirm(payloadSheet, writePreview)
  }

  emit('biz.sheet.pending', {
    kind,
    action,
    previewId: previewId || undefined,
    rows: rows.length,
    columns,
    canWrite: Boolean(payloadSheet.canWrite ?? payloadSheet.can_write),
    source,
    sessionId,
    surfaceId: typeof surfaceId === 'string' ? surfaceId : undefined,
    workspaceCwd: typeof workspaceCwd === 'string' ? workspaceCwd : undefined,
    sheet: payloadSheet,
  }, {
    workspaceCwd: null,
    sessionId,
    source,
  })
  lastEmittedPendingBySession.set(emitKey, payloadSheet)
  return true
}

function recordSurfaceFromPreview(db, workspaceCwd, body, preview, source, { emitEvent = true, hallSheet } = {}) {
  const sheet = preview?.sheet && typeof preview.sheet === 'object' ? preview.sheet : preview
  const kind = String(sheet?.kind || body.kind || '')
  const action = String(sheet?.action || body.action || '')
  const previewId = sheet?.preview_id ?? sheet?.previewId ?? preview?.preview_id ?? preview?.previewId
  const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
  const columns = Array.isArray(sheet?.columns) ? sheet.columns : []
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined
  const connectionId = typeof body.connectionId === 'string' ? body.connectionId : undefined
  if (!kind || !action) return

  const surfaceId = insertBizSurface(db, {
    workspaceCwd,
    connectionId,
    kind,
    action,
    previewId: typeof previewId === 'string' ? previewId : undefined,
    sessionId,
    rowCount: rows.length,
    columnsJson: JSON.stringify(columns),
  })
  if (emitEvent) emitBizSheetPending(sheet, { sessionId, source, workspaceCwd, surfaceId, hallSheet })
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
  const normalized = String(action || '').trim()
  if (normalized === '回退') return false
  return normalized === '改行' && Array.isArray(changes) && changes.length > 0
}

function markRollbackBlockedIfPermanent(db, traceId, code, status) {
  if (!traceId) return
  if (isPermanentRollbackError(code, status)) {
    setBizWriteAuditRollbackState(db, traceId, ROLLBACK_STATE_BLOCKED)
  }
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
    const action = enrichAuditAction(row?.action || audit?.action || '')
    enriched.push({
      ...row,
      id: traceId,
      traceId,
      at: Number(row?.at || audit?.writtenAt || 0),
      kind: effectiveBizKind(audit?.kind, row?.kind),
      no: String(row?.no || audit?.recordNo || ''),
      action,
      receiptId: String(row?.receipt_id || row?.receiptId || audit?.receiptId || ''),
      sessionId: String(row?.sessionId || row?.session_id || audit?.sessionId || ''),
      source: String(audit?.source || (row?.sessionId || row?.session_id ? 'ai' : 'workstation')),
      changes,
      columns: audit?.columns?.length ? audit.columns : (Array.isArray(row?.columns) ? row.columns : []),
      changesSummary: summarizeAuditChanges(changes),
      rollbackState: String(audit?.rollbackState || 'none'),
      rollbackBadge: rollbackBadgeFromAudit(action, changes, audit?.rollbackState),
      canRollback: rollbackBadgeFromAudit(action, changes, audit?.rollbackState) === 'can',
    })
  }
  for (const audit of audits) {
    if (seen.has(audit.traceId)) continue
    enriched.push({
      id: audit.traceId,
      traceId: audit.traceId,
      at: audit.writtenAt,
      kind: effectiveBizKind(audit.kind),
      no: audit.recordNo,
      action: enrichAuditAction(audit.action),
      receiptId: audit.receiptId,
      sessionId: audit.sessionId,
      source: audit.source,
      changes: audit.changes,
      columns: audit.columns,
      changesSummary: summarizeAuditChanges(audit.changes),
      rollbackState: String(audit.rollbackState || 'none'),
      rollbackBadge: rollbackBadgeFromAudit(enrichAuditAction(audit.action), audit.changes, audit.rollbackState),
      canRollback: rollbackBadgeFromAudit(enrichAuditAction(audit.action), audit.changes, audit.rollbackState) === 'can',
    })
  }
  enriched.sort((a, b) => Number(b.at || 0) - Number(a.at || 0))
  return enriched.slice(0, limit)
}

async function enrichTraceRowsAsync(db, aiRuntime, workspace, traceRows, limit) {
  const enriched = enrichTraceRows(db, workspace, traceRows, limit)
  if (!enriched.some((row) => isSpokenMetaKind(row.kind))) return enriched
  const kinds = await loadWorkspaceKinds(aiRuntime, workspace)
  if (!kinds.length) return enriched
  return enriched.map((row) => {
    if (!isSpokenMetaKind(row.kind)) return row
    const audit = getBizWriteAuditByTraceId(db, row.traceId)
    const inferred = inferKindFromCatalog(audit || { columns: row.columns }, kinds)
    return inferred ? { ...row, kind: inferred } : row
  })
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
    const resource = typeof row.resource === 'string' && row.resource.trim() ? row.resource.trim() : undefined
    const catalogVersion = typeof row.catalogVersion === 'string' && row.catalogVersion.trim()
      ? row.catalogVersion.trim()
      : undefined
    const aliases = Array.isArray(row.aliases) ? row.aliases.map(String).filter(Boolean) : undefined
    return {
      kind,
      label,
      fields,
      ...(can ? { can } : {}),
      ...(relations ? { relations } : {}),
      ...(ticketField ? { ticketField } : {}),
      ...(fieldLabels ? { fieldLabels } : {}),
      ...(resource ? { resource } : {}),
      ...(catalogVersion ? { catalogVersion } : {}),
      ...(aliases && aliases.length ? { aliases } : {}),
    }
  })
  return {
    kinds,
    relations: Array.isArray(catalogPayload?.relations) ? catalogPayload.relations : [],
    catalogVersion: catalogPayload?.catalogVersion ?? catalogPayload?.catalog_version ?? null,
  }
}

function mergeConnectedKindCatalog(catalogData, memoryData) {
  const catalogKinds = Array.isArray(catalogData?.kinds) ? catalogData.kinds : []
  const memoryKinds = Array.isArray(memoryData?.kinds) ? memoryData.kinds : []
  const byName = new Map()
  for (const row of catalogKinds) {
    const kind = String(row?.kind || '').trim()
    if (kind) byName.set(kind, { ...row })
  }
  for (const row of memoryKinds) {
    const kind = String(row?.kind || '').trim()
    if (!kind) continue
    const prev = byName.get(kind) || {}
    byName.set(kind, {
      ...prev,
      ...row,
      kind,
      resource: row.resource || prev.resource,
      catalogVersion: row.catalogVersion || prev.catalogVersion,
      aliases: [...new Set([
        ...(Array.isArray(prev.aliases) ? prev.aliases : []),
        ...(Array.isArray(row.aliases) ? row.aliases : []),
      ])],
    })
  }
  const collapsed = collapseKindsToConnectedTables([...byName.values()])
  return {
    kinds: collapsed.kinds,
    aliases: collapsed.aliases,
    relations: Array.isArray(memoryData?.relations) && memoryData.relations.length
      ? memoryData.relations
      : (Array.isArray(catalogData?.relations) ? catalogData.relations : []),
    catalogVersion: catalogData?.catalogVersion ?? memoryData?.catalogVersion ?? null,
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
      if (workspace.startsWith('/')) {
        try {
          const fromMemory = await loadMemoryWorkspaceVocab(aiRuntime, workspace)
          data = mergeConnectedKindCatalog(data, fromMemory)
        } catch { /* catalog kinds still returned */ }
      } else if (!data.kinds.length) {
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
        const resolvedKind = await resolveAuditBizKind(aiRuntime, workspace, audit, null)
        const action = enrichAuditAction(audit.action)
        sendJson(response, 200, {
          data: {
            row: {
              id: audit.traceId,
              traceId: audit.traceId,
              at: audit.writtenAt,
              kind: resolvedKind || audit.kind,
              no: audit.recordNo,
              action,
              receiptId: audit.receiptId,
              sessionId: audit.sessionId,
              source: audit.source,
              changes: audit.changes,
              columns: audit.columns,
              changesSummary: summarizeAuditChanges(audit.changes),
              rollbackState: String(audit.rollbackState || 'none'),
              rollbackBadge: rollbackBadgeFromAudit(action, audit.changes, audit.rollbackState),
              canRollback: rollbackBadgeFromAudit(action, audit.changes, audit.rollbackState) === 'can',
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
          sendJson(response, 200, { data: { row: (await enrichTraceRowsAsync(db, aiRuntime, workspace, [row], 1))[0] }, correlationId })
          return true
        }
      } catch { /* fall through */ }
      sendError(response, 404, 'not_found', '找不到该操作记录', correlationId)
      return true
    }
    try {
      const traces = await aiRuntime.lanAssist('/traces', { search: { workspace, limit: String(limit) } })
      const traceRows = Array.isArray(traces?.rows) ? traces.rows : []
      const rows = await enrichTraceRowsAsync(db, aiRuntime, workspace, traceRows, limit)
      sendJson(response, 200, { data: { rows, receipt: traces?.receipt ?? null }, correlationId })
    } catch (error) {
      const rows = await enrichTraceRowsAsync(db, aiRuntime, workspace, [], limit)
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
      markRollbackBlockedIfPermanent(db, traceId, 'not_found', 404)
      sendError(response, 404, 'not_found', '找不到可回退的字段记录', correlationId)
      return true
    }
    const auditAction = enrichAuditAction(audit.action)
    if (!canRollbackAudit(auditAction, audit.changes)) {
      markRollbackBlockedIfPermanent(db, traceId, 'rollback_unsupported', 400)
      sendError(response, 400, 'rollback_unsupported', '当前仅支持带字段差异的改行回退', correlationId)
      return true
    }
    const patch = patchFromRollbackChanges(audit.changes)
    if (!Object.keys(patch).length) {
      markRollbackBlockedIfPermanent(db, traceId, 'rollback_unsupported', 400)
      sendError(response, 400, 'rollback_unsupported', '没有可恢复的字段值', correlationId)
      return true
    }
    let traceRow = null
    try {
      const traces = await aiRuntime.lanAssist('/traces', { search: { workspace, id: traceId } })
      traceRow = traces?.row || (Array.isArray(traces?.rows) ? traces.rows[0] : null)
    } catch { /* trace optional */ }
    const rollbackKind = await resolveAuditBizKind(aiRuntime, workspace, audit, traceRow)
    if (!rollbackKind || isSpokenMetaKind(rollbackKind)) {
      markRollbackBlockedIfPermanent(db, traceId, 'rollback_unsupported', 400)
      sendError(response, 400, 'rollback_unsupported', '回退需要词表里的业务型；请确认该型已在词表与连接器登记', correlationId)
      return true
    }
    const requested = rollbackPreviewRequest(audit, rollbackKind, patch, workspace)
    if (!requested.ok) {
      markRollbackBlockedIfPermanent(db, traceId, 'rollback_unsupported', 400)
      sendError(response, 400, 'rollback_unsupported', requested.hint, correlationId)
      return true
    }
    const rowKey = String(requested.body.no || '').trim()
    try {
      const preview = await aiRuntime.lanAssist('/preview', {
        method: 'POST',
        body: requested.body,
      })
      if (preview && preview.ok === false) {
        const previewCode = String(preview.error || 'preview_failed')
        const speak = String(preview.hint || preview.speak || preview.sheet?.speak || '').trim()
        const hint = previewCode === 'NOT_FOUND'
          ? `按当时写入的对象「${rollbackKind}」和行主键「${rowKey}」在源系统没有找到同一条。`
          : (speak || '回退预览失败')
        markRollbackBlockedIfPermanent(db, traceId, previewCode, 400)
        sendError(response, 400, previewCode, hint, correlationId)
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

  if (request.method === 'POST' && url.pathname === '/api/v1/biz/focus-kind') {
    try {
      const body = await readJson(request)
      const sessionId = String(body.sessionId || '').trim()
      const kind = String(body.kind || '').trim()
      if (!sessionId || !kind) {
        sendError(response, 400, 'validation_error', 'sessionId 与 kind 必填', correlationId)
        return true
      }
      const focused = await aiRuntime.lanAssist('/focus-kind', { method: 'POST', body: { sessionId, kind } })
      if (!focused || focused.ok === false) {
        sendError(response, 400, String(focused?.error || 'focus_failed'), String(focused?.hint || '无法切换该型'), correlationId)
        return true
      }
      const rawSheet = focused.sheet && typeof focused.sheet === 'object' ? focused.sheet : null
      if (!rawSheet) {
        sendError(response, 400, 'focus_failed', '没有可展示的官方表', correlationId)
        return true
      }
      const bizCwd = requestMemoryCwd(url, body) || FDE_AI_WORKSPACE
      let handed = sheetPayloadFromRaw(rawSheet)
      try {
        const kinds = await loadWorkspaceKinds(aiRuntime, bizCwd)
        handed = canonicalizeSheetKind(handed, kinds) || handed
      } catch { /* keep focused sheet */ }
      if (handed && sessionId && !String(handed.sessionId || '').trim()) {
        handed = { ...handed, sessionId }
      }
      emitBizSheetPending(handed, { sessionId, source: 'focus-kind', workspaceCwd: bizCwd, force: true })
      sendJson(response, 200, { data: { sheet: handed ? stripSecrets(handed) : null }, correlationId })
    } catch (error) {
      sendError(response, 503, 'lan_assist_unavailable', error instanceof Error ? error.message : '事务底座未就绪', correlationId)
    }
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/biz/pending-sheet') {
    try {
      const querySessionId = String(url.searchParams.get('sessionId') || '').trim()
      const state = await aiRuntime.lanAssist('/state', { search: { sessionId: querySessionId } })
      if (!state || state.ok === false) {
        sendJson(response, 200, { data: { sheet: null }, correlationId })
        return true
      }
      const officialRaw = state.officialRoundSheet
      const official = sheetAfterDismissedWrite(sheetPayloadFromRaw(officialRaw))
      const writePreview = state.writePreview && typeof state.writePreview === 'object' ? state.writePreview : null
      const bizCwd = requestMemoryCwd(url, {}) || FDE_AI_WORKSPACE
      let handed = official
      if (handed) {
        try {
          const kinds = await loadWorkspaceKinds(aiRuntime, bizCwd)
          const next = canonicalizeSheetKind(handed, kinds)
          handed = next || null
        } catch { /* keep official sheet */ }
      }
      if (handed && writePreview) handed = projectWriteConfirm(handed, writePreview)
      const lastRaw = querySessionId ? peekLastEmittedPending(querySessionId) : null
      const lastEmitted = writePreview ? projectWriteConfirm(lastRaw, writePreview) : lastRaw
      const served = sheetForOfficialGet(handed, lastEmitted, querySessionId)
      sendJson(response, 200, {
        data: { sheet: served ? stripSecrets(served) : null },
        correlationId,
      })
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
      if (fromMemory.kinds?.length) {
        previewVocabExtra = { kinds: fromMemory.kinds, aliases: fromMemory.aliases }
      }
    } catch { /* spoken seed still applies in gate-action-codes */ }
    const translated = translateBizIntent(body, bizWorkspace, previewVocabExtra)
    if (translated.error) {
      sendError(response, 400, 'validation_error', translated.error, correlationId)
      return true
    }
    const previewSessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
    let previewHall = null
    try {
      const gateState = await aiRuntime.lanAssist('/state', { search: { sessionId: previewSessionId } })
      if (gateState && gateState.ok !== false) {
        previewHall = sheetAfterDismissedWrite(
          sheetPayloadFromRaw(gateState.pendingSheet ?? gateState.pendingWrite),
        )
      }
    } catch { /* emit still guarded by lastEmitted */ }
    const preview = await aiRuntime.lanAssist('/preview', { method: 'POST', body: translated.payload })
    const bizCwd = requestMemoryCwd(url, body) || FDE_AI_WORKSPACE
    const previewSheet = preview?.sheet && typeof preview.sheet === 'object' ? preview.sheet : preview
    const normalizedPreview = sheetPayloadFromRaw(previewSheet)
    const skipEmit = Boolean(
      body.replay === true
      || (
        normalizedPreview
        && previewHall
        && shouldSkipCoveringPending(previewHall, normalizedPreview)
      ),
    )
    if (body.replay !== true) {
      recordSurfaceFromPreview(db, bizCwd, body, preview, 'ui', {
        emitEvent: !skipEmit,
        hallSheet: previewHall,
      })
    }
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
    const body = await readJson(request).catch(() => ({}))
    let previewId = typeof body.preview_id === 'string' ? body.preview_id.trim() : ''
    let hall = {}
    try {
      hall = await aiRuntime.lanAssist('/state', { search: { sessionId: '' } })
    } catch {
      hall = {}
    }
    if (!previewId) previewId = hallPreviewIdFromState(hall) || sheetPreviewIdFromRaw(hall?.pendingSheet ?? hall?.pendingWrite)
    if (previewId) rememberBizPreviewDismissed(previewId)
    try {
      const liveId = hallPreviewIdFromState(hall)
      let dismissed = { ok: true, skipped: true }
      if (dismissShouldClearHall(liveId, previewId)) {
        dismissed = await aiRuntime.lanAssist('/write/cancel', {
          method: 'POST',
          body: { preview_id: previewId },
        })
      }
      sendJson(response, 200, { data: { ...dismissed, preview_id: previewId || undefined }, correlationId })
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
    const rollbackOfTraceId = String(body.rollback_of_trace_id || body.rollbackOfTraceId || '').trim()
    const bizWorkspace = resolveActiveBizCwd(url, body, aiRuntime, requestMemoryCwd)
    const writeSource = String(body.source || '').trim()
    if (writeSource !== 'workstation') {
      sendError(response, 403, 'biz_write_forbidden', '请在右侧确认过账', correlationId)
      return true
    }
    const pendingSheet = await capturePendingSheet(aiRuntime, body.preview_id)
    let written
    try {
      written = await aiRuntime.lanAssist('/write', {
        method: 'POST',
        body: {
          preview_id: body.preview_id,
          trace_id: body.trace_id,
          source: writeSource,
          ...(bizWorkspace ? { workspace: bizWorkspace } : {}),
        },
      })
    } catch (error) {
      const code = error instanceof AiRemoteError ? (error.code || 'biz_write_failed') : 'biz_write_failed'
      markRollbackBlockedIfPermanent(db, rollbackOfTraceId, code, 400)
      sendError(
        response,
        400,
        code,
        bizWriteFailureMessage(error),
        correlationId,
      )
      return true
    }
    if (written && written.ok === false) {
      const lines = Array.isArray(written.lines) ? written.lines : []
      const line0 = lines.find((row) => row && (row.hint || row.error))
      const code = String((line0 && line0.error) || written.error || 'biz_write_failed')
      markRollbackBlockedIfPermanent(db, rollbackOfTraceId, code, 400)
      sendError(
        response,
        400,
        code,
        String(
          (line0 && line0.hint)
            || written.hint
            || written.speak
            || (line0 && line0.error === 'EXPIRED' ? '预览过期了。要写再预览一次。' : '')
            || written.error
            || '过账失败，请重新预览后再试',
        ),
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
    const isRollbackWrite = Boolean(rollbackOfTraceId)
    const lookupBind = captureLookupBind(sheet, body)
    if (isRollbackWrite) {
      const original = getBizWriteAuditByTraceId(db, rollbackOfTraceId)
      const originalBind = parseLookupBind(original)
      const rollbackMarker = String(lookupBind.speech || '').trim()
      const originalSpeech = String(originalBind.speech || '').trim()
      if ((!rollbackMarker || rollbackMarker === '回退') && originalSpeech && originalSpeech !== '回退') {
        lookupBind.speech = originalSpeech
      }
      if (!lookupBind.sessionId && originalBind.sessionId) lookupBind.sessionId = originalBind.sessionId
      if (!lookupBind.sessionId && original?.sessionId) lookupBind.sessionId = original.sessionId
    }
    try {
      insertBizWriteAudit(db, {
        workspaceCwd: bizCwd,
        traceId,
        kind: effectiveBizKind(sheet?.kind, body.kind),
        action: isRollbackWrite
          ? '回退'
          : String(sheet?.action || body.action || written?.action || ''),
        recordNo: auditRecordNo(sheet, body, written),
        receiptId: String(written?.receipt_id || written?.receiptId || ''),
        sessionId: String(sheet?.sessionId || body.session_id || body.sessionId || lookupBind.sessionId || ''),
        source: String(body.source || (sheet?.sessionId ? 'ai' : 'workstation')),
        changes: auditChanges,
        columns: Array.isArray(sheet?.columns) ? sheet.columns : (Array.isArray(body.columns) ? body.columns : []),
        lookupBind,
      })
    } catch { /* audit must not block write */ }
    if (rollbackOfTraceId) {
      setBizWriteAuditRollbackState(db, rollbackOfTraceId, ROLLBACK_STATE_ROLLED_BACK)
    }
    releaseLastEmittedConfirm(
      String(sheet?.sessionId || body.sessionId || body.session_id || ''),
      body.preview_id,
    )
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
