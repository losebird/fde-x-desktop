const SQL_FN = 'fde_canonical_workspace_cwd'
const installed = new WeakSet()

export function canonicalWorkspaceCwd(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const absolute = text.startsWith('/')
    || text.startsWith('\\\\')
    || /^[A-Za-z]:[\\/]/.test(text)
  if (!absolute) return ''
  let slashed = text.replace(/\\/g, '/')
  if (/^[A-Za-z]:/.test(slashed)) slashed = slashed[0].toUpperCase() + slashed.slice(1)
  if (/^\/+$/.test(slashed)) return '/'
  if (/^[A-Za-z]:\/+$/.test(slashed)) return `${slashed[0]}:/`
  return slashed.replace(/\/+$/u, '')
}

export function sameWorkspaceCwd(left, right) {
  const a = canonicalWorkspaceCwd(left)
  const b = canonicalWorkspaceCwd(right)
  return Boolean(a && b && a === b)
}

export function installCanonicalWorkspaceCwd(db) {
  if (installed.has(db)) return
  db.function(SQL_FN, { deterministic: true }, (value) => canonicalWorkspaceCwd(value))
  installed.add(db)
}

export function canonicalWorkspaceCwdSql(db) {
  installCanonicalWorkspaceCwd(db)
  return SQL_FN
}

export function workspaceCwdEqual(db, columnSql, cwd) {
  const canonical = canonicalWorkspaceCwd(cwd)
  if (!canonical) return { sql: `${columnSql} = ?`, params: [cwd] }
  installCanonicalWorkspaceCwd(db)
  return { sql: `${SQL_FN}(${columnSql}) = ?`, params: [canonical] }
}

export function workspaceCacheKey(value) {
  return canonicalWorkspaceCwd(value) || String(value ?? '')
}

export function sameWorkspaceCacheKey(stored, query) {
  return sameWorkspaceCwd(stored, query) || String(stored ?? '') === String(query ?? '')
}
