/** Decision 15: object = connected table; spoken name = alias; graph = relations. */

export type ConnectedKindRow = {
  kind: string
  label?: string
  resource?: string
  catalogVersion?: string
  fields?: unknown[]
  can?: unknown[]
  aliases?: string[]
  clues?: Array<{ role?: string; say?: unknown; says?: unknown }>
}

export type ConnectedKindIndex = {
  kinds: ConnectedKindRow[]
  aliases: Record<string, string>
}

function kindName(row: ConnectedKindRow | Record<string, unknown> | null | undefined): string {
  if (!row || typeof row !== 'object') return ''
  return String((row as ConnectedKindRow).kind || (row as { label?: string }).label || '').trim()
}

function resourceOf(row: ConnectedKindRow | Record<string, unknown> | null | undefined): string {
  if (!row || typeof row !== 'object') return ''
  return String((row as ConnectedKindRow).resource || '').trim()
}

function catalogVersionOf(row: ConnectedKindRow | Record<string, unknown> | null | undefined): string {
  if (!row || typeof row !== 'object') return ''
  return String((row as ConnectedKindRow).catalogVersion || '').trim()
}

function fieldCount(row: ConnectedKindRow): number {
  return Array.isArray(row.fields) ? row.fields.length : 0
}

function canCount(row: ConnectedKindRow): number {
  return Array.isArray(row.can) ? row.can.length : 0
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  if (typeof value === 'string') {
    return value.split(/[,，、\s]+/).map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function oralAndGraphAliasTokens(row: ConnectedKindRow): string[] {
  const out = [...stringList(row.aliases)]
  for (const clue of Array.isArray(row.clues) ? row.clues : []) {
    if (!clue || typeof clue !== 'object') continue
    if (String(clue.role || '').trim() !== '型') continue
    out.push(...stringList(clue.say ?? clue.says))
  }
  return out.filter(Boolean)
}

function pickCanonicalRow(rows: ConnectedKindRow[]): ConnectedKindRow {
  const ranked = [...rows].sort((a, b) => {
    const va = catalogVersionOf(a) ? 1 : 0
    const vb = catalogVersionOf(b) ? 1 : 0
    if (vb !== va) return vb - va
    if (fieldCount(b) !== fieldCount(a)) return fieldCount(b) - fieldCount(a)
    return canCount(b) - canCount(a)
  })
  return ranked[0]
}

function connectorResourcesFrom(
  rows: ConnectedKindRow[],
  explicit?: Iterable<string> | Set<string>,
): Set<string> {
  if (explicit) {
    const packed = new Set([...explicit].map((item) => String(item || '').trim()).filter(Boolean))
    if (packed.size) return packed
  }
  const fromCatalog = new Set<string>()
  for (const row of rows) {
    const resource = resourceOf(row)
    if (resource && catalogVersionOf(row)) fromCatalog.add(resource)
  }
  return fromCatalog
}

function isConnectedResource(resource: string, connectorResources: Set<string>): boolean {
  if (!resource) return false
  if (connectorResources.size) return connectorResources.has(resource)
  return /^[A-Za-z][A-Za-z0-9._-]*$/.test(resource)
}

export function collapseKindsToConnectedTables(
  kinds: Array<ConnectedKindRow | Record<string, unknown> | string> | null | undefined,
  opts: { connectorResources?: Iterable<string> | Set<string> } = {},
): ConnectedKindIndex {
  const rows: ConnectedKindRow[] = []
  for (const raw of Array.isArray(kinds) ? kinds : []) {
    const row = typeof raw === 'string'
      ? { kind: raw.trim() }
      : { ...raw, kind: kindName(raw) } as ConnectedKindRow
    if (!row.kind) continue
    rows.push(row)
  }
  const connectorResources = connectorResourcesFrom(rows, opts.connectorResources)
  const byResource = new Map<string, ConnectedKindRow[]>()
  for (const row of rows) {
    const resource = resourceOf(row)
    if (!isConnectedResource(resource, connectorResources)) continue
    const list = byResource.get(resource) || []
    list.push({ ...row, resource })
    byResource.set(resource, list)
  }
  const collapsed: ConnectedKindRow[] = []
  const aliases: Record<string, string> = {}
  for (const [, list] of byResource) {
    const canonical = pickCanonicalRow(list)
    const inherited = list.flatMap((row) => oralAndGraphAliasTokens(row))
    const aliasNames = [...new Set([
      ...list.map((row) => row.kind).filter((name) => name !== canonical.kind),
      ...inherited,
    ])].filter((name) => name && name !== canonical.kind)
    collapsed.push({
      ...canonical,
      label: canonical.label || canonical.kind,
      aliases: aliasNames,
    })
    aliases[canonical.kind] = canonical.kind
    for (const name of aliasNames) aliases[name] = canonical.kind
  }
  return { kinds: collapsed, aliases }
}

export function resolveConnectedKind(
  spoken: string,
  index: ConnectedKindIndex | ConnectedKindRow[] | null | undefined,
): string {
  const name = String(spoken || '').trim()
  if (!name) return ''
  const packed = Array.isArray(index) ? collapseKindsToConnectedTables(index) : index
  if (!packed || packed.kinds.length === 0) return name
  if (packed.kinds.some((row) => row.kind === name)) return name
  const mapped = packed.aliases[name]
  if (mapped) return mapped
  for (const row of packed.kinds) {
    if (Array.isArray(row.aliases) && row.aliases.includes(name)) return row.kind
  }
  return ''
}

function sheetPreviewId(sheet: Record<string, unknown> | null | undefined): string {
  if (!sheet || typeof sheet !== 'object') return ''
  const id = sheet.preview_id ?? sheet.previewId
  return typeof id === 'string' ? id.trim() : ''
}

function sheetRowCount(sheet: Record<string, unknown> | null | undefined): number {
  if (!sheet || typeof sheet !== 'object') return 0
  return Array.isArray(sheet.rows) ? sheet.rows.length : 0
}

export function isConnectorCatalogDump(sheet: Record<string, unknown> | null | undefined): boolean {
  if (!sheet || typeof sheet !== 'object') return false
  if (String(sheet.action || '').trim() !== '现查') return false
  if (sheetPreviewId(sheet)) return false
  if (String(sheet.speech || '').trim()) return false
  const where = sheet.where ?? sheet.listWhere
  if (Array.isArray(where) && where.length) return false
  if (Array.isArray(sheet.hopWhere) && sheet.hopWhere.length) return false
  const from = sheet.from
  if (from && typeof from === 'object' && !Array.isArray(from) && String((from as { kind?: string }).kind || '').trim()) {
    return false
  }
  if (Array.isArray(sheet.steps) && sheet.steps.length) return false
  return true
}

/** BFF/watch/remember: do not cover a populated this-utterance sheet. */
export function shouldSkipCoveringPending(
  prev: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown> | null | undefined,
): boolean {
  if (!prev || !incoming || typeof prev !== 'object' || typeof incoming !== 'object') return false
  const prevRows = sheetRowCount(prev)
  const nextRows = sheetRowCount(incoming)
  if (prevRows <= 0) return false
  if (nextRows > 0) {
    return isConnectorCatalogDump(incoming)
      && !String(incoming.speech || '').trim()
  }
  const prevSpeech = String(prev.speech || '').trim()
  const nextSpeech = String(incoming.speech || '').trim()
  if (prevSpeech && nextSpeech && prevSpeech === nextSpeech) return true
  if (isConnectorCatalogDump(incoming)) return true
  const action = String(incoming.action || '').trim()
  if (action && action !== '现查' && !sheetPreviewId(incoming)) return true
  if (nextRows === 0 && prevRows > 0) return true
  return false
}
