const LEDGER_ID = /^app_[0-9a-f]{32}$/
const RECORD_ID = /^rec[0-9a-f]{32}$/

export function formatPlanAppSource(input) {
  const row = input && typeof input === 'object' ? input : {}
  const ledgerId = typeof row.ledgerId === 'string' ? row.ledgerId : ''
  if (!LEDGER_ID.test(ledgerId)) return null
  if (row.rowId == null || row.rowId === '') return `app:${ledgerId}`
  const rowId = typeof row.rowId === 'string' ? row.rowId : ''
  if (!RECORD_ID.test(rowId)) return null
  return `app:${ledgerId}:${rowId}`
}

export function planAppSource(sourceRef) {
  const raw = String(sourceRef ?? '').trim()
  if (!raw.startsWith('app:')) return null
  const parts = raw.slice(4).split(':')
  if (parts.length === 1 && LEDGER_ID.test(parts[0])) {
    const ledgerId = parts[0]
    return {
      kind: 'app',
      ledgerId,
      href: { panel: 'data', workspaceAppId: ledgerId },
    }
  }
  if (parts.length === 2 && LEDGER_ID.test(parts[0]) && RECORD_ID.test(parts[1])) {
    const ledgerId = parts[0]
    const rid = parts[1]
    return {
      kind: 'row',
      ledgerId,
      rid,
      href: { panel: 'data', workspaceAppId: ledgerId, appRid: rid },
    }
  }
  return null
}

function specOf(loaded) {
  if (!loaded || typeof loaded !== 'object') return null
  const spec = loaded.spec
  if (!spec || typeof spec !== 'object') return null
  return spec
}

function slugOf(spec) {
  return spec && typeof spec.slug === 'string' ? spec.slug : ''
}

function entityName(entity) {
  return entity && typeof entity.name === 'string' ? entity.name : ''
}

function askBag(slug, entity, rid) {
  const fields = {}
  if (slug) fields.slug = slug
  if (entity) fields.entity = entity
  if (rid) fields.rid = rid
  return fields
}

export async function focusEntityFor(spec, rid, probeRow) {
  if (!spec || typeof spec !== 'object') return ''
  const entities = Array.isArray(spec.entities) ? spec.entities : []
  if (!entities.length) return ''
  if (entities.length === 1) return entityName(entities[0])
  const slug = slugOf(spec)
  if (!slug) return ''
  const hits = []
  for (const entity of entities) {
    const name = entityName(entity)
    if (!name) continue
    if (await probeRow(slug, name, rid)) hits.push(name)
  }
  return hits.length === 1 ? hits[0] : ''
}

export async function planAskFields(sourceRef, deps) {
  const handle = planAppSource(sourceRef)
  if (!handle) return {}
  const spec = specOf(await deps.loadApp(handle.ledgerId))
  if (handle.kind === 'app') {
    const slug = slugOf(spec)
    return slug ? { slug } : {}
  }
  if (!spec) return { rid: handle.rid }
  const entity = await focusEntityFor(spec, handle.rid, deps.probeRow)
  return askBag(slugOf(spec), entity, handle.rid)
}
