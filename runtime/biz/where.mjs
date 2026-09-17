/**
 * Normalize preview where clauses before lan-assist /preview.
 * Passes through gate-native terms; converts briefing { field, op, value } aliases only.
 */

function list(value) {
  return (Array.isArray(value) ? value : []).map((item) => String(item || '').trim()).filter(Boolean)
}

function normalizeAliasTerm(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
  if (Array.isArray(raw.keys) || raw.dateBefore || raw.dateAfter) return raw
  const field = String(raw.field || raw.fieldName || raw.key || '').trim()
  const op = String(raw.op || raw.operator || 'eq').trim().toLowerCase()
  const value = raw.value !== undefined ? raw.value : raw.values
  if (!field) return raw
  const values = list(value)
  if (!values.length && value !== undefined && value !== null && String(value).trim()) {
    values.push(String(value).trim())
  }
  if (!values.length) return raw
  if (/^(gte|ge|after|from|dateafter|>=)$/.test(op)) {
    return { dateAfter: [field], values }
  }
  if (/^(lte|le|before|to|datebefore|<=)$/.test(op)) {
    return { dateBefore: [field], values }
  }
  return { keys: [field], values, not: /^(ne|neq|not|!=)$/.test(op) }
}

/**
 * @param {unknown} raw
 * @returns {Array<Record<string, unknown>>}
 */
export function normalizePreviewWhere(raw) {
  const rows = Array.isArray(raw) ? raw : []
  const out = []
  for (const row of rows) {
    const norm = normalizeAliasTerm(row)
    if (Array.isArray(norm)) out.push(...norm)
    else if (norm && typeof norm === 'object') out.push(norm)
  }
  return out
}
