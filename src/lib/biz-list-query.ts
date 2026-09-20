/** Stable fingerprint for list 现查 sheets (kind + optional where), generic — no field literals. */

import {
  isConnectorCatalogDump,
  resolveConnectedKind,
  type ConnectedKindIndex,
  type ConnectedKindRow,
} from './connected-kind.ts'

export type { ConnectedKindIndex, ConnectedKindRow }

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

/** This operation's hit sheet per bound kind (from/steps rows), not a catalog dump. */
export function operationKindHitSheets(sheet: Record<string, unknown> | null | undefined): Record<string, unknown>[] {
  if (!sheet || typeof sheet !== 'object') return []
  const out: Record<string, unknown>[] = []
  const seen = new Set<string>()
  const push = (kind: string, rows: unknown, columns: unknown) => {
    const name = String(kind || '').trim()
    if (!name || seen.has(name)) return
    seen.add(name)
    const same = name === String(sheet.kind || '').trim()
    out.push({
      ...sheet,
      kind: name,
      rows: Array.isArray(rows) ? rows : [],
      columns: Array.isArray(columns) ? columns : [],
      action: same ? sheet.action : '现查',
      preview_id: same ? sheet.preview_id : undefined,
      previewId: same ? sheet.previewId : undefined,
      canWrite: same ? sheet.canWrite : false,
    })
  }
  push(String(sheet.kind || ''), sheet.rows, sheet.columns)
  const walk = (raw: unknown, depth = 0) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || depth > 8) return
    const row = raw as Record<string, unknown>
    if (Object.prototype.hasOwnProperty.call(row, 'rows')) {
      push(String(row.kind || ''), row.rows, row.columns)
    }
    walk(row.from, depth + 1)
  }
  walk(sheet.from)
  walk(sheet.related)
  if (Array.isArray(sheet.steps)) {
    for (const step of sheet.steps) {
      if (!step || typeof step !== 'object' || Array.isArray(step)) continue
      const row = step as Record<string, unknown>
      if (Object.prototype.hasOwnProperty.call(row, 'rows')) {
        push(String(row.kind || ''), row.rows, row.columns)
      }
    }
  }
  return out
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
    ...(Array.isArray(where) && where.length ? { where } : {}),
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

/**
 * Keep a hop-side kind view only while the incoming pending is the same operation
 * and that side actually has rows (a person clicked the chip). An empty kind view
 * must not hold over a populated pending. A new pending (different speech/where/hop)
 * must paint, even when kinds differ.
 */
export function shouldHoldSideKindView(
  viewKind: string,
  incoming: Record<string, unknown> | null | undefined,
  displayed: Record<string, unknown> | null | undefined,
  incomingIsWritePreview = false,
): boolean {
  const view = String(viewKind || '').trim()
  const incomingKind = incoming && typeof incoming === 'object' ? String(incoming.kind || '').trim() : ''
  if (!view || !incomingKind || view === incomingKind) return false
  if (incomingIsWritePreview) return false
  const shownRows = displayed && Array.isArray(displayed.rows) ? displayed.rows.length : 0
  if (shownRows <= 0) return false
  return Boolean(displayed && operationBundlesAlign(displayed, incoming))
}

/** Empty poll of the same 现查 must not wipe a surfaced list. A new speech/where/hop must paint. */
export function shouldRejectEmptyIncomingSheet(
  incoming: Record<string, unknown> | null | undefined,
  displayedRowCount: number,
  displayed?: Record<string, unknown> | null,
  connected?: ConnectedKindIndex | ConnectedKindRow[] | null,
): boolean {
  if (displayedRowCount <= 0) return false
  if (!incoming || typeof incoming !== 'object') return false
  const incomingCount = Array.isArray(incoming.rows) ? incoming.rows.length : 0
  if (incomingCount > 0) return false
  const incomingKind = String(incoming.kind || '').trim()
  const shownKind = displayed ? String(displayed.kind || '').trim() : ''
  const hasCatalog = Array.isArray(connected)
    ? connected.length > 0
    : Boolean(connected && connected.kinds.length > 0)
  if (hasCatalog) {
    const canonicalIn = resolveConnectedKind(incomingKind, connected)
    if (!canonicalIn) return true
    const canonicalShown = resolveConnectedKind(shownKind, connected)
    if (canonicalIn && canonicalShown && canonicalIn === canonicalShown) return true
  }
  const action = String(incoming.action || '').trim()
  const previewId = String(incoming.preview_id ?? incoming.previewId ?? '').trim()
  if (action && action !== '现查' && !previewId) return true
  if (action !== '现查') return false
  if (displayed && !operationBundlesAlign(displayed, incoming)) return false
  return true
}

/** Catalog page-1 dump and empty/fake covering must not replace this-utterance rows. */
export function shouldRejectIncomingCovering(
  incoming: Record<string, unknown> | null | undefined,
  displayedRowCount: number,
  displayed?: Record<string, unknown> | null,
  connected?: ConnectedKindIndex | ConnectedKindRow[] | null,
): boolean {
  if (shouldRejectEmptyIncomingSheet(incoming, displayedRowCount, displayed, connected)) return true
  if (displayedRowCount <= 0) return false
  if (!incoming || typeof incoming !== 'object') return false
  if (!isConnectorCatalogDump(incoming)) return false
  if (displayed && isConnectorCatalogDump(displayed)) return false
  return true
}

export function listQueryScopeKey(sheet: Record<string, unknown> | null | undefined): string {
  if (!sheet || typeof sheet !== 'object') return ''
  const where = stableWhereSlice(extractSheetListWhere(sheet))
  return JSON.stringify({ where })
}

export function briefQueryScopeLabel(sheet: Record<string, unknown> | null | undefined): string {
  if (!sheet || typeof sheet !== 'object') return ''
  const speech = String(sheet.speech || '').trim()
  if (speech) return speech

  const hopBits: string[] = []
  const from = sheet.from && typeof sheet.from === 'object' && !Array.isArray(sheet.from)
    ? sheet.from as Record<string, unknown>
    : null
  const fromKind = from ? String(from.kind || '').trim() : ''
  if (fromKind) hopBits.push(`从${fromKind}`)
  const steps = Array.isArray(sheet.steps)
    ? sheet.steps
      .map((row) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) return ''
        return String((row as Record<string, unknown>).kind || '').trim()
      })
      .filter(Boolean)
    : []
  if (steps.length > 1) hopBits.push(steps.join('→'))

  const where = extractSheetListWhere(sheet)
  const values: string[] = []
  for (const row of where.slice(0, 3)) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    if (Array.isArray(item.values)) {
      for (const value of item.values) {
        const text = String(value || '').trim()
        if (text) values.push(text)
      }
    } else if (item.value != null && item.value !== '') {
      values.push(String(item.value))
    }
  }
  const whereBit = values.length
    ? values.slice(0, 4).join('、')
    : (where.length ? `${where.length} 项条件` : '')
  return [...hopBits, whereBit].filter(Boolean).join(' · ')
}

/** Speech if present, else where/hop identity. Never a clock. */
export function historyConditionLabel(sheet: Record<string, unknown> | null | undefined): string {
  const brief = briefQueryScopeLabel(sheet)
  if (brief) return brief
  if (!sheet || typeof sheet !== 'object') return ''

  const steps = Array.isArray(sheet.steps)
    ? sheet.steps
      .map((row) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) return ''
        return String((row as Record<string, unknown>).kind || '').trim()
      })
      .filter(Boolean)
    : []
  if (steps.length) return steps.join('→')

  const from = sheet.from && typeof sheet.from === 'object' && !Array.isArray(sheet.from)
    ? sheet.from as Record<string, unknown>
    : null
  const fromKind = from ? String(from.kind || '').trim() : ''
  if (fromKind) return `从${fromKind}`

  const where = extractSheetListWhere(sheet)
  if (where.length) return `${where.length} 项条件`
  return ''
}

/** Cached row no/pk for a surface. Never a clock. */
export function historySheetRowIdentity(sheet: Record<string, unknown> | null | undefined): string {
  if (!sheet || typeof sheet !== 'object') return ''
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const rec = row as Record<string, unknown>
    const id = String(rec.no ?? rec.orderId ?? rec.id ?? '').trim()
    if (id) return id
  }
  return String(sheet.no || '').trim()
}

export function historyOptionLabel(
  surface: { kind?: string; action?: string },
  sheet?: Record<string, unknown> | null,
): string {
  const kind = String(surface.kind || '').trim()
  const action = String(surface.action || '').trim()
  const condition = historyConditionLabel(sheet) || historySheetRowIdentity(sheet)
  return [kind, action, condition].filter(Boolean).join(' · ')
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
