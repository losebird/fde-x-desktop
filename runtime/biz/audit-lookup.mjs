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

/**
 * @param {Record<string, unknown>} bind
 * @param {string} kind
 * @param {string} recordNo
 * @param {Record<string, unknown>} patch
 * @param {string} workspace
 */
export function rollbackPreviewBody(bind, kind, recordNo, patch, workspace) {
  const body = {
    kind,
    action: '改行',
    no: String(recordNo || '').trim(),
    workspace,
    patch,
    speech: '回退',
  }
  if (bind.where && Array.isArray(bind.where) && bind.where.length) body.where = bind.where
  if (bind.hopWhere && Array.isArray(bind.hopWhere) && bind.hopWhere.length) body.hopWhere = bind.hopWhere
  if (bind.from && typeof bind.from === 'object') body.from = bind.from
  if (bind.related && typeof bind.related === 'object') body.related = bind.related
  for (const key of ['line', 'connectionId', 'system', 'env']) {
    const v = String(bind[key] || '').trim()
    if (v) body[key] = v
  }
  return body
}
