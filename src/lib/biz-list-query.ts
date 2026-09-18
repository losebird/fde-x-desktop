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

/** Kind strings bound to one gate operation (sheet metadata only — no literals). */
export function extractBoundKindHints(sheet: Record<string, unknown> | null | undefined): string[] {
  if (!sheet || typeof sheet !== 'object') return []
  const kinds = new Set<string>()
  const add = (value: unknown) => {
    const name = String(value || '').trim()
    if (name) kinds.add(name)
  }
  add(sheet.kind)
  add(sheet.nextKind ?? sheet.via)
  const walkFrom = (raw: unknown, depth = 0) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || depth > 8) return
    const row = raw as Record<string, unknown>
    add(row.kind)
    walkFrom(row.from, depth + 1)
  }
  walkFrom(sheet.from)
  walkFrom(sheet.related)
  if (Array.isArray(sheet.steps)) {
    for (const step of sheet.steps) {
      if (step && typeof step === 'object' && !Array.isArray(step)) {
        add((step as Record<string, unknown>).kind)
      }
    }
  }
  return [...kinds]
}

function stableFromSlice(raw: unknown, depth = 0): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || depth > 8) return null
  const row = raw as Record<string, unknown>
  const kind = String(row.kind || '').trim()
  if (!kind) return null
  const nested = stableFromSlice(row.from, depth + 1)
  const where = stableWhereSlice(Array.isArray(row.where) ? row.where : [])
  return {
    kind,
    ...(where.length ? { where } : {}),
    ...(nested ? { from: nested } : {}),
  }
}

function stableStepsSlice(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return ''
      return String((row as Record<string, unknown>).kind || '').trim()
    })
    .filter(Boolean)
}

function hopWhereJson(sheet: Record<string, unknown>): string {
  const hop = sheet.hopWhere
  if (!Array.isArray(hop) || !hop.length) return ''
  return JSON.stringify(stableWhereSlice(hop))
}

function directWhereJson(sheet: Record<string, unknown>): string {
  const direct = sheet.where ?? sheet.listWhere
  if (!Array.isArray(direct) || !direct.length) return ''
  return JSON.stringify(stableWhereSlice(direct))
}

/** Same AI operation (speech / hop link / shared scope) — not global session surfaces. */
export function operationBundlesAlign(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown> | null | undefined,
): boolean {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (listQueryFingerprint(a) === listQueryFingerprint(b)) return true
  const speechA = String(a.speech || '').trim()
  const speechB = String(b.speech || '').trim()
  if (speechA.length > 0 && speechA === speechB) return true
  const scopeA = listQueryScopeKey(a)
  const scopeB = listQueryScopeKey(b)
  if (scopeA && scopeA === scopeB) {
    const whereA = extractSheetListWhere(a)
    const whereB = extractSheetListWhere(b)
    if (whereA.length > 0 || whereB.length > 0) return true
    const kindA = String(a.kind || '').trim()
    const kindB = String(b.kind || '').trim()
    if (kindA && kindB && kindA === kindB) return true
  }
  const hopA = hopWhereJson(a)
  const whereB = directWhereJson(b)
  if (hopA && whereB && hopA === whereB) return true
  const hopB = hopWhereJson(b)
  const whereA = directWhereJson(a)
  if (hopB && whereA && hopB === whereA) return true
  return false
}

export function listQueryScopeKey(sheet: Record<string, unknown> | null | undefined): string {
  if (!sheet || typeof sheet !== 'object') return ''
  const where = stableWhereSlice(extractSheetListWhere(sheet))
  return JSON.stringify({ where })
}

export function briefQueryScopeLabel(sheet: Record<string, unknown> | null | undefined): string {
  const where = extractSheetListWhere(sheet)
  if (!where.length) return ''
  const parts = where.slice(0, 2).map((row) => {
    if (!row || typeof row !== 'object') return ''
    const item = row as Record<string, unknown>
    const keys = Array.isArray(item.keys) ? item.keys.map(String).join(',') : ''
    const field = item.field ?? item.fieldName ?? item.key
    const label = keys || (field ? String(field) : '')
    const values = Array.isArray(item.values) ? item.values.map(String).join(',') : ''
    const value = values || (item.value != null ? String(item.value) : '')
    if (!label && !value) return ''
    if (!value) return label
    return `${label}=${value}`
  }).filter(Boolean)
  if (!parts.length) return `${where.length} 项条件`
  const more = where.length > 2 ? ` +${where.length - 2}` : ''
  return `${parts.join(' · ')}${more}`
}

export function listQueryFingerprint(sheet: Record<string, unknown> | null | undefined): string {
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
