/** Same occupancy as runtime/settings-schema.mjs. */

export function schemaNode(schema: Record<string, unknown> | null | undefined, uid?: unknown) {
  if (!schema || typeof schema !== 'object') return null
  const refs = schema.refs && typeof schema.refs === 'object' ? schema.refs as Record<string, unknown> : {}
  const key = uid === undefined || uid === null ? schema.uid : uid
  if (key === undefined || key === null) return null
  const hit = refs[key as string] || refs[String(key)]
  return hit && typeof hit === 'object' ? hit as Record<string, unknown> : null
}

export function objectFieldEntries(schema: Record<string, unknown> | null | undefined, uid?: unknown) {
  const node = schemaNode(schema, uid)
  if (!node || node.type !== 'object' || !node.dict || typeof node.dict !== 'object') return []
  return Object.entries(node.dict as Record<string, unknown>).map(([name, fieldUid]) => ({ name, uid: fieldUid }))
}

export function rootObjectUid(schema: Record<string, unknown> | null | undefined) {
  if (!schema || typeof schema !== 'object') return null
  const root = schemaNode(schema, schema.uid)
  return root && root.type === 'object' ? schema.uid : null
}

export function secretSlot(secrets: unknown, path: string[] | string) {
  const want = Array.isArray(path) ? path.map(String) : [String(path)]
  if (!Array.isArray(secrets)) return null
  for (const item of secrets) {
    if (typeof item === 'string' && want.length === 1 && item === want[0]) return { path: want, set: false }
    if (item && typeof item === 'object' && Array.isArray((item as { path?: unknown }).path)) {
      const slot = item as { path: unknown[]; set?: unknown }
      if (slot.path.length === want.length && slot.path.every((part, index) => String(part) === want[index])) {
        return { path: want, set: slot.set === true }
      }
    }
  }
  return null
}

export function isSecretKey(secrets: unknown, name: string) {
  return Boolean(secretSlot(secrets, [name]))
}

export function nodeType(node: Record<string, unknown> | null) {
  return String(node && node.type || '')
}

export function isScalarNode(schema: Record<string, unknown> | null | undefined, uid: unknown) {
  const node = schemaNode(schema, uid)
  const type = nodeType(node)
  if (type === 'boolean' || type === 'number' || type === 'string' || type === 'const') return true
  if (type === 'union' && unionConstOptions(schema, uid).length) return true
  return false
}

export function objectFieldsAreScalar(schema: Record<string, unknown> | null | undefined, uid: unknown) {
  const fields = objectFieldEntries(schema, uid)
  return fields.length > 0 && fields.every((field) => isScalarNode(schema, field.uid))
}

export function requiredStringFields(schema: Record<string, unknown> | null | undefined, uid: unknown) {
  return objectFieldEntries(schema, uid).filter((field) => {
    const node = schemaNode(schema, field.uid)
    if (nodeType(node) !== 'string') return false
    const meta = node?.meta && typeof node.meta === 'object' ? node.meta as { required?: unknown } : {}
    return meta.required === true
  })
}

export type SettingsCatalog = {
  keys: string[]
  rows: Array<Record<string, unknown>>
}

export function joinCatalog(
  schema: Record<string, unknown> | null | undefined,
  uid: unknown,
  catalogs: SettingsCatalog[] | null | undefined,
) {
  const required = requiredStringFields(schema, uid).map((field) => field.name)
  if (!required.length) return null
  const list = Array.isArray(catalogs) ? catalogs : []
  for (const catalog of list) {
    if (!catalog || !Array.isArray(catalog.rows) || !catalog.rows.length) continue
    const sample = catalog.rows[0] && typeof catalog.rows[0] === 'object' ? catalog.rows[0] : {}
    const keys = new Set(Array.isArray(catalog.keys) && catalog.keys.length ? catalog.keys : Object.keys(sample))
    if (required.every((name) => keys.has(name))) return catalog
  }
  return null
}

export function catalogRowKey(row: Record<string, unknown> | null | undefined, requiredKeys: string[]) {
  return (Array.isArray(requiredKeys) ? requiredKeys : []).map((key) => String(row && row[key] != null ? row[key] : '')).join('\0')
}

export function catalogRowLabel(row: Record<string, unknown> | null | undefined, requiredKeys: string[]) {
  if (!row || typeof row !== 'object') return ''
  const required = new Set(Array.isArray(requiredKeys) ? requiredKeys : [])
  const extra = Object.keys(row).filter((key) => !required.has(key) && typeof row[key] === 'string' && String(row[key]).trim())
  if (extra.length) return extra.map((key) => String(row[key])).join(' · ')
  return (Array.isArray(requiredKeys) ? requiredKeys : []).map((key) => String(row[key] ?? '')).filter(Boolean).join(' · ')
}

export function dirtyTopLevelOps(prev: unknown, next: unknown) {
  const from = prev && typeof prev === 'object' && !Array.isArray(prev) ? prev as Record<string, unknown> : {}
  const to = next && typeof next === 'object' && !Array.isArray(next) ? next as Record<string, unknown> : {}
  const ops: Array<{ op: 'set'; path: string[]; value: unknown }> = []
  for (const key of Object.keys(to)) {
    if (to[key] === undefined) continue
    if (JSON.stringify(to[key]) === JSON.stringify(from[key])) continue
    ops.push({ op: 'set', path: [key], value: to[key] })
  }
  return ops
}

export function unionConstOptions(schema: Record<string, unknown> | null | undefined, uid: unknown) {
  const node = schemaNode(schema, uid)
  if (!node || node.type !== 'union' || !Array.isArray(node.list)) return []
  const values: unknown[] = []
  for (const optionUid of node.list) {
    const option = schemaNode(schema, optionUid)
    if (option && option.type === 'const') values.push(option.value)
  }
  return node.list.length && values.length === node.list.length ? values : []
}

export function dictInnerUid(node: Record<string, unknown> | null) {
  if (!node || node.type !== 'dict') return null
  return node.inner === undefined ? null : node.inner
}
