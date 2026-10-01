import { loadMemoryWorkspaceVocab } from './memory-vocab.mjs'
import { collapseKindsToConnectedTables } from './connected-kind.mjs'

export function mapKindsFromCatalog(catalogPayload) {
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

export function mergeConnectedKindCatalog(catalogData, memoryData) {
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

export function emptyBizVocab() {
  return { kinds: [], relations: [], catalogVersion: null, aliases: {} }
}

export function vocabHasKinds(vocab) {
  const kinds = Array.isArray(vocab?.kinds) ? vocab.kinds : []
  return kinds.some((row) => {
    if (typeof row === 'string') return Boolean(row.trim())
    if (!row || typeof row !== 'object') return false
    return Boolean(String(row.kind || row.name || '').trim())
  })
}

export function vocabCatalogVersion(vocab) {
  if (!vocab || typeof vocab !== 'object') return null
  const raw = vocab.catalogVersion ?? vocab.catalog_version ?? null
  if (Array.isArray(raw)) {
    const first = raw.map((item) => String(item || '').trim()).find(Boolean)
    return first || null
  }
  if (raw != null && String(raw).trim()) return raw
  const kinds = Array.isArray(vocab.kinds) ? vocab.kinds : []
  for (const row of kinds) {
    if (!row || typeof row !== 'object') continue
    const version = String(row.catalogVersion || '').trim()
    if (version) return row.catalogVersion
  }
  return null
}

function asVocabSheet(data) {
  return {
    kinds: Array.isArray(data?.kinds) ? data.kinds : [],
    relations: Array.isArray(data?.relations) ? data.relations : [],
    catalogVersion: data?.catalogVersion ?? null,
    aliases: data?.aliases && typeof data.aliases === 'object' && !Array.isArray(data.aliases)
      ? data.aliases
      : {},
  }
}

/**
 * Workspace 词表: `{ kinds, relations, catalogVersion, aliases }` keyed by `{ cwd }`.
 * Internally `/catalog` + memory graph merge.
 */
export async function loadBizVocab(aiRuntime, cwd) {
  const workspace = String(cwd || '').trim()
  const catalog = await aiRuntime.lanAssist('/catalog', { search: { workspace } })
  if (catalog && catalog.ok === false) {
    const error = new Error(String(catalog.hint || '事务底座未就绪'))
    error.code = String(catalog.error || 'NO_CATALOG')
    throw error
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
  return asVocabSheet(data)
}
