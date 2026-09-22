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
  if (Array.isArray(sheet.peers)) {
    for (const peer of sheet.peers) {
      if (peer && typeof peer === 'object' && !Array.isArray(peer)) {
        add((peer as Record<string, unknown>).kind)
      }
    }
  }
  return [...kinds]
}

function whereValues(node: Record<string, unknown>): string[] {
  const terms = [
    ...(Array.isArray(node.where) ? node.where : []),
    ...(Array.isArray(node.hopWhere) ? node.hopWhere : []),
  ]
  const values: string[] = []
  for (const term of terms) {
    if (!term || typeof term !== 'object' || Array.isArray(term)) continue
    const list = (term as Record<string, unknown>).values
    if (!Array.isArray(list)) continue
    for (const item of list) {
      const text = String(item ?? '').trim()
      if (text) values.push(text)
    }
  }
  return values
}

function conditionTexts(node: Record<string, unknown>): string[] {
  const columns = Array.isArray(node.columns) ? node.columns : []
  return whereValues(node).map((value) => {
    for (const col of columns) {
      if (!col || typeof col !== 'object' || Array.isArray(col)) continue
      const enums = (col as Record<string, unknown>).enums
      if (!enums || typeof enums !== 'object' || Array.isArray(enums)) continue
      const label = (enums as Record<string, unknown>)[value]
      const text = String(label ?? '').trim()
      if (text) return text
    }
    return value
  })
}

/** Condition values already bound onto this kind. Not a row count. */
export function kindChipConditionLabels(
  sheet: Record<string, unknown> | null | undefined,
  chipKind: string,
): string[] {
  const wanted = String(chipKind || '').trim()
  if (!sheet || typeof sheet !== 'object' || !wanted) return []
  const found: string[] = []
  const take = (node: unknown) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return
    const row = node as Record<string, unknown>
    if (String(row.kind || '').trim() !== wanted) return
    found.push(...conditionTexts(row))
  }
  take(sheet)
  take(sheet.from)
  if (Array.isArray(sheet.steps)) {
    for (const step of sheet.steps) take(step)
  }
  if (Array.isArray(sheet.peers)) {
    for (const peer of sheet.peers) take(peer)
  }
  return [...new Set(found)]
}

/**
 * Packed rows on a source kind are not an upstream headcount.
 * Only the result kind shows a numeric badge.
 */
export function kindChipShowsRowCount(chipKind: string, resultKind: string): boolean {
  const chip = String(chipKind || '').trim()
  const result = String(resultKind || '').trim()
  if (!chip || !result) return false
  return chip === result
}

/** This operation's hit sheet per bound kind (from/steps rows), not a catalog dump. */
export function operationKindHitSheets(sheet: Record<string, unknown> | null | undefined): Record<string, unknown>[] {
  if (!sheet || typeof sheet !== 'object') return []
  const out: Record<string, unknown>[] = []
  const seen = new Set<string>()
  const push = (kind: string, rows: unknown, columns: unknown, extra?: Record<string, unknown>) => {
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
      ...(extra || {}),
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
  if (Array.isArray(sheet.peers)) {
    for (const peer of sheet.peers) {
      if (!peer || typeof peer !== 'object' || Array.isArray(peer)) continue
      const row = peer as Record<string, unknown>
      if (!Object.prototype.hasOwnProperty.call(row, 'rows')) continue
      push(String(row.kind || ''), row.rows, row.columns, {
        where: row.where,
        from: undefined,
        steps: undefined,
        peers: undefined,
        hopWhere: undefined,
        hitTotal: row.hitTotal,
        hitTotalState: row.hitTotalState,
        querySettled: row.querySettled,
        page: row.page,
        pageSize: row.pageSize,
        pageFull: row.pageFull,
        speech: sheet.speech,
      })
    }
  }
  return out
}

function kindNamesEqual(
  wanted: string,
  candidate: string,
  kindCatalog: ConnectedKindIndex | ConnectedKindRow[] | null | undefined,
): boolean {
  const a = String(wanted || '').trim()
  const b = String(candidate || '').trim()
  if (!a || !b) return false
  if (a === b) return true
  if (!kindCatalog) return false
  const resolvedA = resolveConnectedKind(a, kindCatalog) || a
  const resolvedB = resolveConnectedKind(b, kindCatalog) || b
  return resolvedA === resolvedB
}

/** Exact object name on this operation side; alias fold only when names differ. */
export function operationKindMatches(
  wanted: string,
  candidate: string,
  kindCatalog?: ConnectedKindIndex | ConnectedKindRow[] | null,
): boolean {
  const a = String(wanted || '').trim()
  const b = String(candidate || '').trim()
  if (!a || !b) return false
  if (a === b) return true
  return kindNamesEqual(a, b, kindCatalog)
}

function stampSheetPagination(
  hit: Record<string, unknown>,
  base: Record<string, unknown>,
): Record<string, unknown> {
  const basePageSize = Number(base.pageSize)
  const hitPageSize = Number(hit.pageSize)
  const pageSize = Number.isFinite(hitPageSize) && hitPageSize > 0
    ? Math.floor(hitPageSize)
    : (Number.isFinite(basePageSize) && basePageSize > 0 ? Math.floor(basePageSize) : undefined)
  const sameKind = String(hit.kind || '').trim() === String(base.kind || '').trim()
  const basePage = Number(base.page)
  const hitPage = Number(hit.page)
  const page = Number.isFinite(hitPage) && hitPage > 0
    ? Math.floor(hitPage)
    : (sameKind && Number.isFinite(basePage) && basePage > 0 ? Math.floor(basePage) : 1)
  return {
    ...hit,
    ...(pageSize ? { pageSize } : {}),
    page,
  }
}

/** One bound kind as the official list view (main row, hop side, or shared-enum peer). */
export function materializeOperationKindSheet(
  sheet: Record<string, unknown> | null | undefined,
  kind: string,
  kindCatalog?: ConnectedKindIndex | ConnectedKindRow[] | null,
): Record<string, unknown> | null {
  const wanted = String(kind || '').trim()
  if (!sheet || typeof sheet !== 'object' || !wanted) return null
  const hits = operationKindHitSheets(sheet)
  let hit = hits.find((row) => String(row.kind || '').trim() === wanted)
  if (!hit) hit = hits.find((row) => kindNamesEqual(wanted, String(row.kind || ''), kindCatalog))
  if (!hit) return null
  const basePeers = Array.isArray(sheet.peers) ? sheet.peers : []
  const stamped: Record<string, unknown> = stampSheetPagination({
    ...hit,
    ...(typeof sheet.speech === 'string' && sheet.speech ? { speech: sheet.speech } : {}),
    ...(sheet.sessionId ? { sessionId: sheet.sessionId } : {}),
    ...(typeof sheet.workspace === 'string' && sheet.workspace ? { workspace: sheet.workspace } : {}),
    ...(basePeers.length ? { peers: basePeers } : {}),
  }, sheet)
  if (stamped.querySettled !== true && stamped.hitTotalState === 'known') {
    stamped.querySettled = true
  }
  return stamped
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

/** Empty incoming must not paint over a populated list (including new speech and 现查 polls). */
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
    page: Number(sheet.page) > 0 ? Math.floor(Number(sheet.page)) : 0,
    previewId: String(sheet.preview_id ?? sheet.previewId ?? ''),
  })
}
