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

function sourceToken(value) {
  const text = String(value || '')
  if (!text || /\s/.test(text)) return ''
  return text
}

function bizTaskSource(rest) {
  if (rest.startsWith('trace_')) {
    const traceId = sourceToken(rest)
    if (!traceId || traceId.includes(':') || traceId.includes('/')) return null
    return {
      kind: 'biz-trace',
      label: `操作记录 ${traceId}`,
      href: { panel: 'data', tab: 'operations', traceId },
    }
  }
  const slash = rest.indexOf('/')
  const colon = rest.indexOf(':')
  if (slash > 0 && (colon === -1 || slash < colon)) {
    const connection = sourceToken(rest.slice(0, slash))
    const after = rest.slice(slash + 1)
    const split = after.indexOf(':')
    if (!connection || split <= 0) return null
    const kind = sourceToken(after.slice(0, split))
    const rowId = sourceToken(after.slice(split + 1))
    if (!kind || !rowId) return null
    return {
      kind: 'biz-record',
      label: `${connection} · ${kind} ${rowId}`,
      href: { panel: 'data', tab: 'records', kind, rowId, connection },
    }
  }
  if (colon <= 0) return null
  const kind = sourceToken(rest.slice(0, colon))
  const rowId = sourceToken(rest.slice(colon + 1))
  if (!kind || !rowId) return null
  return {
    kind: 'biz-record',
    label: `${kind} ${rowId}`,
    href: { panel: 'data', tab: 'records', kind, rowId },
  }
}

function classifyTaskSource(raw) {
  if (raw.startsWith('app:')) {
    const handle = planAppSource(raw)
    if (!handle) return { legal: false, open: null }
    const label = handle.kind === 'row' ? `应用记录 ${handle.rid}` : `应用 ${handle.ledgerId}`
    return { legal: true, open: { ...handle, label } }
  }
  if (raw.startsWith('fde-task:')) {
    return { legal: Boolean(sourceToken(raw.slice('fde-task:'.length))), open: null }
  }
  if (raw.startsWith('dsh-goal:')) {
    return { legal: Boolean(sourceToken(raw.slice('dsh-goal:'.length))), open: null }
  }
  if (raw.startsWith('im:')) {
    const requestId = sourceToken(raw.slice(3))
    if (!requestId) return { legal: false, open: null }
    return {
      legal: true,
      open: { kind: 'im', label: `IM ${requestId}`, href: { panel: 'im', requestId } },
    }
  }
  if (raw.startsWith('biz:')) {
    const open = bizTaskSource(raw.slice(4))
    return open ? { legal: true, open } : { legal: false, open: null }
  }
  return { legal: false, open: null }
}

export function planTaskSource(sourceRef) {
  const raw = String(sourceRef ?? '').trim()
  if (!raw) return null
  return classifyTaskSource(raw).open
}

export function taskSourceProblem(sourceRef) {
  const raw = String(sourceRef ?? '').trim()
  if (!raw) return null
  return classifyTaskSource(raw).legal ? null : 'invalid_source_ref'
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
  const open = planTaskSource(sourceRef)
  if (open && open.kind === 'biz-record') {
    const fields = { kind: open.href.kind, rowId: open.href.rowId }
    if (open.href.connection) fields.connection = open.href.connection
    return fields
  }
  if (open && open.kind === 'biz-trace') return { traceId: open.href.traceId }
  if (open && open.kind === 'im') return { requestId: open.href.requestId }
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
