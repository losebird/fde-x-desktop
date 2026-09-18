/** @module runtime/biz/sheet-fingerprint — stable list 现查 identity (kind, action, where). */

function stableWhereSlice(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((row) => {
    if (!row || typeof row !== 'object') return row
    const keys = Array.isArray(row.keys) ? [...row.keys].map(String).sort() : undefined
    const values = Array.isArray(row.values) ? [...row.values].map(String).sort() : undefined
    const dateBefore = Array.isArray(row.dateBefore) ? [...row.dateBefore].map(String).sort() : undefined
    const dateAfter = Array.isArray(row.dateAfter) ? [...row.dateAfter].map(String).sort() : undefined
    const field = row.field ?? row.fieldName ?? row.key
    const op = row.op ?? row.operator
    const value = row.value ?? row.values
    return {
      ...(keys ? { keys } : {}),
      ...(values ? { values } : {}),
      ...(dateBefore ? { dateBefore } : {}),
      ...(dateAfter ? { dateAfter } : {}),
      ...(field ? { field: String(field) } : {}),
      ...(op ? { op: String(op) } : {}),
      ...(value !== undefined ? { value } : {}),
      ...(row.not ? { not: true } : {}),
    }
  })
}

export function extractSheetListWhere(sheet) {
  if (!sheet || typeof sheet !== 'object') return []
  const direct = sheet.where ?? sheet.listWhere
  if (Array.isArray(direct) && direct.length) return direct
  const hop = sheet.hopWhere
  if (Array.isArray(hop) && hop.length) return hop
  return []
}

function stableFromSlice(raw, depth = 0) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || depth > 8) return null
  const kind = String(raw.kind || '').trim()
  if (!kind) return null
  const nested = stableFromSlice(raw.from, depth + 1)
  const where = stableWhereSlice(Array.isArray(raw.where) ? raw.where : [])
  return {
    kind,
    ...(where.length ? { where } : {}),
    ...(nested ? { from: nested } : {}),
  }
}

function stableStepsSlice(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((row) => {
    if (!row || typeof row !== 'object') return ''
    return String(row.kind || '').trim()
  }).filter(Boolean)
}

export function listQueryFingerprint(sheet) {
  if (!sheet || typeof sheet !== 'object') return ''
  const kind = String(sheet.kind || '').trim()
  const action = String(sheet.action || '').trim()
  const direct = sheet.where ?? sheet.listWhere
  const where = stableWhereSlice(Array.isArray(direct) ? direct : [])
  const hopWhere = stableWhereSlice(Array.isArray(sheet.hopWhere) ? sheet.hopWhere : [])
  const from = stableFromSlice(sheet.from)
  const steps = stableStepsSlice(sheet.steps)
  return JSON.stringify({ kind, action, where, hopWhere, from, steps })
}

export function pendingSheetWatchFingerprint(sheet) {
  if (!sheet || typeof sheet !== 'object') return ''
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  const previewId = sheet.preview_id ?? sheet.previewId ?? ''
  const firstNo = rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || '') : ''
  const lastNo = rows.length > 1 && rows[rows.length - 1] && typeof rows[rows.length - 1] === 'object'
    ? String(rows[rows.length - 1].no || '')
    : firstNo
  return JSON.stringify({
    query: listQueryFingerprint(sheet),
    kind: sheet.kind,
    action: sheet.action,
    previewId,
    rowCount: rows.length,
    firstNo,
    lastNo,
    columnsLen: Array.isArray(sheet.columns) ? sheet.columns.length : 0,
    canWrite: sheet.canWrite ?? sheet.can_write,
    speech: String(sheet.speech || '').slice(0, 120),
  })
}
