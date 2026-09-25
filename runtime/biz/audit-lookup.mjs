import { normalizePreviewWhere } from './where.mjs'

/** lan-assist speakReceipt() meta kinds — not vocab gate kinds */
const SPOKEN_META_KINDS = new Set(['receipt', 'compensate'])

export function isSpokenMetaKind(kind) {
  return SPOKEN_META_KINDS.has(String(kind || '').trim())
}

export function effectiveBizKind(...candidates) {
  for (const raw of candidates) {
    const k = String(raw || '').trim()
    if (k && !isSpokenMetaKind(k)) return k
  }
  for (const raw of candidates) {
    const k = String(raw || '').trim()
    if (k) return k
  }
  return ''
}

/**
 * Bind captured at write time — same connector lookup as the original preview/write.
 * @param {Record<string, unknown> | null | undefined} sheet
 * @param {Record<string, unknown> | null | undefined} body
 */
export function captureLookupBind(sheet, body) {
  const src = sheet && typeof sheet === 'object' ? sheet : {}
  const bind = {}
  const where = normalizePreviewWhere(src.where ?? body?.where)
  if (where.length) bind.where = where
  const hopWhere = normalizePreviewWhere(src.hopWhere ?? body?.hopWhere)
  if (hopWhere.length) bind.hopWhere = hopWhere
  const fromRaw = (body?.from && typeof body.from === 'object' ? body.from : src.from)
  if (fromRaw && typeof fromRaw === 'object' && !Array.isArray(fromRaw)) {
    const fromKind = String(fromRaw.kind || '').trim()
    const fromWhere = normalizePreviewWhere(fromRaw.where)
    if (fromKind && fromWhere.length) bind.from = { kind: fromKind, where: fromWhere }
  }
  const related = src.related ?? body?.related
  if (related && typeof related === 'object' && !Array.isArray(related)) {
    bind.related = related
  }
  for (const key of ['line', 'connectionId', 'system', 'env']) {
    const v = String(src[key] ?? body?.[key] ?? '').trim()
    if (v) bind[key] = v
  }
  const bizKind = effectiveBizKind(src?.kind, body?.kind)
  if (bizKind) bind.bizKind = bizKind
  const speech = String(src.speech ?? body?.speech ?? '').trim()
  if (speech) bind.speech = speech
  const sessionId = String(src.sessionId ?? body?.sessionId ?? body?.session_id ?? '').trim()
  if (sessionId) bind.sessionId = sessionId
  return bind
}

export function parseLookupBind(audit) {
  const raw = audit?.lookupBind ?? audit?.lookup_bind_json
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch { /* ignore */ }
  }
  return {}
}

/**
 * Row key used for connector lookup — prefer sheet/body from write, never receipt speak kind.
 */
export function auditRecordNo(sheet, body, written) {
  const fromSheet = String(sheet?.no || sheet?.clue || '').trim()
  const fromBody = String(body?.no || '').trim()
  const fromWritten = String(written?.no || '').trim()
  return fromSheet || fromBody || fromWritten
}

/** Row primary key stored on the write audit. Not the business code, not speech. */
export function rollbackRowKey(audit) {
  return String(audit?.receiptId || audit?.receipt_id || '').trim()
}

/**
 * One authority for which row a rollback preview looks up: the audit object
 * plus that row's primary key. Empty speech stays empty so find-row does not
 * treat a marker as a name. Where/hop from the original utterance do not
 * choose the row again.
 * @param {Record<string, unknown> | null | undefined} audit
 * @param {string} kind
 * @param {Record<string, unknown>} patch
 * @param {string} workspace
 */
export function rollbackPreviewRequest(audit, kind, patch, workspace) {
  const rowKey = rollbackRowKey(audit)
  const objectKind = String(kind || audit?.kind || '').trim()
  if (!rowKey || !objectKind) {
    return {
      ok: false,
      missed: true,
      hint: '这一行对不上。历史里没有行主键，不能去猜。',
    }
  }
  return {
    ok: true,
    body: rollbackPreviewBody(parseLookupBind(audit), objectKind, rowKey, patch, workspace),
  }
}

/**
 * @param {Record<string, unknown>} bind
 * @param {string} kind
 * @param {string} rowKey
 * @param {Record<string, unknown>} patch
 * @param {string} workspace
 */
export function rollbackPreviewBody(bind, kind, rowKey, patch, workspace) {
  const source = bind && typeof bind === 'object' ? bind : {}
  const body = {
    kind,
    action: '改行',
    no: String(rowKey || '').trim(),
    workspace,
    patch,
  }
  for (const key of ['line', 'connectionId', 'system', 'env']) {
    const v = String(source[key] || '').trim()
    if (v) body[key] = v
  }
  return body
}
