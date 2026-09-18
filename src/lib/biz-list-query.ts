/** Stable fingerprint for list 现查 sheets (kind + optional where), generic — no field literals. */

function stableWhereSlice(raw: unknown): unknown {
  if (!Array.isArray(raw)) return []
  return raw.map((row) => {
    if (!row || typeof row !== 'object') return row
    const item = row as Record<string, unknown>
    const keys = Array.isArray(item.keys) ? [...item.keys].map(String).sort() : undefined
    const values = Array.isArray(item.values) ? [...item.values].map(String).sort() : undefined
    const dateBefore = Array.isArray(item.dateBefore) ? [...item.dateBefore].map(String).sort() : undefined
    const dateAfter = Array.isArray(item.dateAfter) ? [...item.dateAfter].map(String).sort() : undefined
    const field = item.field ?? item.fieldName ?? item.key
    const op = item.op ?? item.operator
    const value = item.value ?? item.values
    return {
      ...(keys ? { keys } : {}),
      ...(values ? { values } : {}),
      ...(dateBefore ? { dateBefore } : {}),
      ...(dateAfter ? { dateAfter } : {}),
      ...(field ? { field: String(field) } : {}),
      ...(op ? { op: String(op) } : {}),
      ...(value !== undefined ? { value } : {}),
      ...(item.not ? { not: true } : {}),
    }
  })
}

export function extractSheetListWhere(sheet: Record<string, unknown> | null | undefined): unknown[] {
  if (!sheet || typeof sheet !== 'object') return []
  const direct = sheet.where ?? sheet.listWhere
  if (Array.isArray(direct) && direct.length) return direct
  const hop = sheet.hopWhere
  if (Array.isArray(hop) && hop.length) return hop
  return []
}

export function listQueryFingerprint(sheet: Record<string, unknown> | null | undefined): string {
  if (!sheet || typeof sheet !== 'object') return ''
  const kind = String(sheet.kind || '').trim()
  const action = String(sheet.action || '').trim()
  const where = stableWhereSlice(extractSheetListWhere(sheet))
  return JSON.stringify({ kind, action, where })
}

export function listSnapshotCacheKey(kind: string, sheet: Record<string, unknown>): string {
  const k = String(kind || sheet.kind || '').trim()
  const fp = listQueryFingerprint({ ...sheet, kind: k })
  return `kind:${k}:q:${fp}`
}

export function sheetRowsFingerprint(sheet: Record<string, unknown> | null | undefined): string {
  if (!sheet || typeof sheet !== 'object') return ''
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  const first = rows[0] && typeof rows[0] === 'object'
    ? String((rows[0] as { no?: string }).no || '')
    : ''
  const last = rows.length > 1 && rows[rows.length - 1] && typeof rows[rows.length - 1] === 'object'
    ? String((rows[rows.length - 1] as { no?: string }).no || '')
    : first
  return JSON.stringify({
    fp: listQueryFingerprint(sheet),
    n: rows.length,
    first,
    last,
    previewId: String(sheet.preview_id ?? sheet.previewId ?? ''),
  })
}
