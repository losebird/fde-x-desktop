/** Decision 15: object = connected table; spoken name = alias; graph = relations. */

function kindName(row) {
  if (!row || typeof row !== 'object') return ''
  return String(row.kind || row.label || '').trim()
}

function resourceOf(row) {
  if (!row || typeof row !== 'object') return ''
  const resource = String(row.resource || '').trim()
  if (!resource || resource === '(in graph)') return ''
  return resource
}

function catalogVersionOf(row) {
  if (!row || typeof row !== 'object') return ''
  return String(row.catalogVersion || '').trim()
}

function fieldCount(row) {
  return Array.isArray(row?.fields) ? row.fields.length : 0
}

function canCount(row) {
  return Array.isArray(row?.can) ? row.can.length : 0
}

function pickCanonicalRow(rows) {
  const ranked = [...rows].sort((a, b) => {
    const va = catalogVersionOf(a) ? 1 : 0
    const vb = catalogVersionOf(b) ? 1 : 0
    if (vb !== va) return vb - va
    if (fieldCount(b) !== fieldCount(a)) return fieldCount(b) - fieldCount(a)
    return canCount(b) - canCount(a)
  })
  return ranked[0]
}

export function collapseKindsToConnectedTables(kinds) {
  const byResource = new Map()
  for (const raw of Array.isArray(kinds) ? kinds : []) {
    const row = typeof raw === 'string'
      ? { kind: raw.trim() }
      : { ...raw, kind: kindName(raw) }
    if (!row.kind) continue
    const resource = resourceOf(row)
    if (!resource) continue
    const list = byResource.get(resource) || []
    list.push({ ...row, resource })
    byResource.set(resource, list)
  }
  const collapsed = []
  const aliases = {}
  for (const [, list] of byResource) {
    const canonical = pickCanonicalRow(list)
    const inherited = list.flatMap((row) => (Array.isArray(row.aliases) ? row.aliases : []))
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

export function resolveConnectedKind(spoken, index) {
  const name = String(spoken || '').trim()
  if (!name) return ''
  const packed = Array.isArray(index) ? collapseKindsToConnectedTables(index) : index
  if (!packed || !Array.isArray(packed.kinds) || packed.kinds.length === 0) return name
  if (packed.kinds.some((row) => row.kind === name)) return name
  const mapped = packed.aliases && packed.aliases[name]
  if (mapped) return mapped
  for (const row of packed.kinds) {
    if (Array.isArray(row.aliases) && row.aliases.includes(name)) return row.kind
  }
  return ''
}

function sheetPreviewId(sheet) {
  if (!sheet || typeof sheet !== 'object') return ''
  const id = sheet.preview_id ?? sheet.previewId
  return typeof id === 'string' ? id.trim() : ''
}

function sheetRowCount(sheet) {
  if (!sheet || typeof sheet !== 'object') return 0
  return Array.isArray(sheet.rows) ? sheet.rows.length : 0
}

export function isConnectorCatalogDump(sheet) {
  if (!sheet || typeof sheet !== 'object') return false
  if (String(sheet.action || '').trim() !== '现查') return false
  if (sheetPreviewId(sheet)) return false
  if (String(sheet.speech || '').trim()) return false
  const where = sheet.where ?? sheet.listWhere
  if (Array.isArray(where) && where.length) return false
  if (Array.isArray(sheet.hopWhere) && sheet.hopWhere.length) return false
  const from = sheet.from
  if (from && typeof from === 'object' && !Array.isArray(from) && String(from.kind || '').trim()) {
    return false
  }
  if (Array.isArray(sheet.steps) && sheet.steps.length) return false
  return true
}

export function shouldSkipCoveringPending(prev, incoming) {
  if (!prev || !incoming || typeof prev !== 'object' || typeof incoming !== 'object') return false
  const prevRows = sheetRowCount(prev)
  const nextRows = sheetRowCount(incoming)
  if (prevRows <= 0) return false
  if (nextRows > 0) {
    return isConnectorCatalogDump(incoming) && !String(incoming.speech || '').trim()
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
