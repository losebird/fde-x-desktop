/** Host settings/describe schema is a uid + refs graph. */

export function schemaNode(schema, uid) {
  if (!schema || typeof schema !== 'object') return null
  const refs = schema.refs && typeof schema.refs === 'object' ? schema.refs : {}
  const key = uid === undefined || uid === null ? schema.uid : uid
  if (key === undefined || key === null) return null
  return refs[key] || refs[String(key)] || null
}

export function objectFieldEntries(schema, uid) {
  const node = schemaNode(schema, uid)
  if (!node || node.type !== 'object' || !node.dict || typeof node.dict !== 'object') return []
  return Object.entries(node.dict).map(([name, fieldUid]) => ({ name, uid: fieldUid }))
}

export function rootObjectUid(schema) {
  if (!schema || typeof schema !== 'object') return null
  const root = schemaNode(schema, schema.uid)
  return root && root.type === 'object' ? schema.uid : null
}

export function secretSlot(secrets, path) {
  const want = Array.isArray(path) ? path.map(String) : [String(path)]
  if (!Array.isArray(secrets)) return null
  for (const item of secrets) {
    if (typeof item === 'string' && want.length === 1 && item === want[0]) return { path: want, set: false }
    if (item && typeof item === 'object' && Array.isArray(item.path) && item.path.length === want.length && item.path.every((part, index) => String(part) === want[index])) {
      return { path: want, set: item.set === true }
    }
  }
  return null
}

export function isSecretKey(secrets, name) {
  return Boolean(secretSlot(secrets, [name]))
}

export function nodeType(node) {
  return String(node && node.type || '')
}

export function isScalarNode(schema, uid) {
  const node = schemaNode(schema, uid)
  const type = nodeType(node)
  if (type === 'boolean' || type === 'number' || type === 'string' || type === 'const') return true
  if (type === 'union' && unionConstOptions(schema, uid).length) return true
  return false
}

export function objectFieldsAreScalar(schema, uid) {
  const fields = objectFieldEntries(schema, uid)
  return fields.length > 0 && fields.every((field) => isScalarNode(schema, field.uid))
}

export function requiredStringFields(schema, uid) {
  return objectFieldEntries(schema, uid).filter((field) => {
    const node = schemaNode(schema, field.uid)
    if (nodeType(node) !== 'string') return false
    const meta = node && node.meta && typeof node.meta === 'object' ? node.meta : {}
    return meta.required === true
  })
}

export function joinCatalog(schema, uid, catalogs) {
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

export function catalogRowKey(row, requiredKeys) {
  return (Array.isArray(requiredKeys) ? requiredKeys : []).map((key) => String(row && row[key] != null ? row[key] : '')).join('\0')
}

export function catalogRowLabel(row, requiredKeys) {
  if (!row || typeof row !== 'object') return ''
  const required = new Set(Array.isArray(requiredKeys) ? requiredKeys : [])
  const extra = Object.keys(row).filter((key) => !required.has(key) && typeof row[key] === 'string' && String(row[key]).trim())
  if (extra.length) return extra.map((key) => String(row[key])).join(' · ')
  return (Array.isArray(requiredKeys) ? requiredKeys : []).map((key) => String(row[key] ?? '')).filter(Boolean).join(' · ')
}

export function dirtyTopLevelOps(prev, next) {
  const from = prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {}
  const to = next && typeof next === 'object' && !Array.isArray(next) ? next : {}
  const ops = []
  for (const key of Object.keys(to)) {
    if (to[key] === undefined) continue
    if (JSON.stringify(to[key]) === JSON.stringify(from[key])) continue
    ops.push({ op: 'set', path: [key], value: to[key] })
  }
  return ops
}

export function unionConstOptions(schema, uid) {
  const node = schemaNode(schema, uid)
  if (!node || node.type !== 'union' || !Array.isArray(node.list)) return []
  const values = []
  for (const optionUid of node.list) {
    const option = schemaNode(schema, optionUid)
    if (option && option.type === 'const') values.push(option.value)
  }
  return node.list.length && values.length === node.list.length ? values : []
}

export function dictInnerUid(node) {
  if (!node || node.type !== 'dict') return null
  return node.inner === undefined ? null : node.inner
}
