import { createId } from '../db.mjs'
import { quoteTable, tableNameForEntity } from './spec.mjs'

/**
 * @param {Record<string, unknown>} spec
 * @param {string} entityName
 */
export function getEntityDef(spec, entityName) {
  const ent = spec.entities?.find((e) => e.name === entityName)
  if (!ent) throw Object.assign(new Error('entity_not_found'), { code: 'not_found' })
  return ent
}

/**
 * @param {Record<string, unknown>} field
 * @param {unknown} value
 * @param {string} path
 * @param {{ path: string, message: string }[]} errors
 */
function validateFieldValue(field, value, path, errors) {
  if (value === undefined || value === null || value === '') {
    if (field.required) errors.push({ path, message: '必填' })
    return
  }
  switch (field.type) {
    case 'text':
    case 'longtext':
    case 'date':
    case 'datetime':
      if (typeof value !== 'string') errors.push({ path, message: '必须是字符串' })
      break
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) errors.push({ path, message: '必须是数字' })
      break
    case 'bool':
      if (typeof value !== 'boolean' && value !== 0 && value !== 1) errors.push({ path, message: '必须是布尔' })
      break
    case 'enum':
      if (!Array.isArray(field.options) || !field.options.includes(value)) {
        errors.push({ path, message: '不在允许选项内' })
      }
      break
    case 'ref':
      if (typeof value !== 'string') errors.push({ path, message: '必须是字符串' })
      break
    case 'json':
      try {
        if (typeof value === 'string') JSON.parse(value)
      } catch {
        errors.push({ path, message: 'JSON 无效' })
      }
      break
    default:
      break
  }
}

/**
 * @param {Record<string, unknown>} spec
 * @param {string} entityName
 * @param {Record<string, unknown>} row
 */
export function validateRecordInput(spec, entityName, row) {
  const ent = getEntityDef(spec, entityName)
  const errors = []
  for (const field of ent.fields) {
    validateFieldValue(field, row[field.name], field.name, errors)
  }
  return errors
}

/**
 * @param {Record<string, unknown>} spec
 * @param {string} entityName
 */
export function listColumns(spec, entityName, view) {
  const ent = getEntityDef(spec, entityName)
  const fields = ent.fields.map((f) => f.name)
  if (view?.columns?.length) {
    const listed = view.columns.map(String)
    return [...listed, ...fields.filter((name) => !listed.includes(name))]
  }
  return fields
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {Record<string, unknown>} spec
 * @param {string} entityName
 * @param {string} workspaceCwd
 * @param {{ filter?: Record<string, unknown>, sort?: { field: string, dir: string }, page?: number, size?: number }} opts
 */
export function listRecords(db, spec, entityName, workspaceCwd, opts = {}) {
  const table = tableNameForEntity(String(spec.slug), entityName)
  const quoted = quoteTable(table)
  const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table)
  if (!exists) {
    return { rows: [], columns: listColumns(spec, entityName), total: 0 }
  }

  const where = ['workspace_cwd = ?', '(deleted_at IS NULL OR deleted_at = 0)']
  const params = [workspaceCwd]
  if (opts.filter && typeof opts.filter === 'object') {
    for (const [key, val] of Object.entries(opts.filter)) {
      if (val === undefined || val === '') continue
      where.push(`"${key}" = ?`)
      params.push(val)
    }
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const totalRow = db.prepare(`SELECT COUNT(*) AS c FROM ${quoted} ${whereSql}`).get(...params)
  const total = Number(totalRow?.c ?? 0)

  let orderSql = 'ORDER BY updated_at DESC'
  if (opts.sort?.field) {
    const dir = opts.sort.dir === 'asc' ? 'ASC' : 'DESC'
    orderSql = `ORDER BY "${opts.sort.field}" ${dir}`
  }
  const page = Math.max(1, Number(opts.page ?? 1))
  const size = Math.max(1, Math.min(100, Number(opts.size ?? 20)))
  const offset = (page - 1) * size

  const rows = db.prepare(
    `SELECT * FROM ${quoted} ${whereSql} ${orderSql} LIMIT ? OFFSET ?`,
  ).all(...params, size, offset)

  return {
    rows: rows.map((row) => formatRow(row, spec, entityName)),
    columns: listColumns(spec, entityName),
    total,
    page,
    size,
    approximate: total > 100_000,
  }
}

/**
 * @param {Record<string, unknown>} row
 */
function formatRow(row, spec, entityName) {
  const ent = getEntityDef(spec, entityName)
  const out = { id: row.id }
  for (const field of ent.fields) {
    let val = row[field.name]
    if (field.type === 'bool') val = val === 1 || val === true
    if (field.type === 'json' && typeof val === 'string') {
      try { val = JSON.parse(val) } catch { /* keep string */ }
    }
    out[field.name] = val
    if (field.type === 'ref' && typeof field.ref === 'string' && field.ref.startsWith('biz:')) {
      const snapKey = `${field.name}__display`
      out.display = out.display || {}
      out.display[field.name] = row[snapKey] ?? val
    }
  }
  out.created_at = row.created_at
  out.updated_at = row.updated_at
  return out
}

export function getRecord(db, spec, entityName, workspaceCwd, rid) {
  const table = tableNameForEntity(String(spec.slug), entityName)
  const quoted = quoteTable(table)
  const row = db.prepare(
    `SELECT * FROM ${quoted} WHERE id = ? AND workspace_cwd = ? AND (deleted_at IS NULL OR deleted_at = 0)`,
  ).get(rid, workspaceCwd)
  if (!row) return null
  return formatRow(row, spec, entityName)
}

export function insertRecord(db, spec, entityName, workspaceCwd, input) {
  const errors = validateRecordInput(spec, entityName, input)
  if (errors.length) throw Object.assign(new Error('validation'), { code: 'validation_error', errors })
  const table = tableNameForEntity(String(spec.slug), entityName)
  const quoted = quoteTable(table)
  const ent = getEntityDef(spec, entityName)
  const id = createId('rec').replace(/^rec_/, 'rec')
  const now = Date.now()
  const cols = ['id', 'workspace_cwd', 'created_at', 'updated_at']
  const vals = [id, workspaceCwd, now, now]
  const placeholders = ['?', '?', '?', '?']
  for (const field of ent.fields) {
    if (input[field.name] === undefined) continue
    cols.push(`"${field.name}"`)
    placeholders.push('?')
    vals.push(serializeField(field, input[field.name]))
    if (field.type === 'ref' && typeof field.ref === 'string' && field.ref.startsWith('biz:') && input[`${field.name}__display`]) {
      cols.push(`"${field.name}__display"`)
      placeholders.push('?')
      vals.push(String(input[`${field.name}__display`]))
    }
  }
  db.prepare(
    `INSERT INTO ${quoted} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
  ).run(...vals)
  return getRecord(db, spec, entityName, workspaceCwd, id)
}

export function patchRecord(db, spec, entityName, workspaceCwd, rid, input) {
  const existing = getRecord(db, spec, entityName, workspaceCwd, rid)
  if (!existing) return null
  const merged = { ...existing, ...input }
  const errors = validateRecordInput(spec, entityName, merged)
  if (errors.length) throw Object.assign(new Error('validation'), { code: 'validation_error', errors })
  const table = tableNameForEntity(String(spec.slug), entityName)
  const quoted = quoteTable(table)
  const ent = getEntityDef(spec, entityName)
  const sets = ['updated_at = ?']
  const vals = [Date.now()]
  for (const field of ent.fields) {
    if (input[field.name] === undefined) continue
    sets.push(`"${field.name}" = ?`)
    vals.push(serializeField(field, input[field.name]))
  }
  vals.push(rid, workspaceCwd)
  db.prepare(
    `UPDATE ${quoted} SET ${sets.join(', ')} WHERE id = ? AND workspace_cwd = ?`,
  ).run(...vals)
  return getRecord(db, spec, entityName, workspaceCwd, rid)
}

export function deleteRecord(db, spec, entityName, workspaceCwd, rid) {
  const table = tableNameForEntity(String(spec.slug), entityName)
  const quoted = quoteTable(table)
  const now = Date.now()
  const result = db.prepare(
    `UPDATE ${quoted} SET deleted_at = ?, updated_at = ? WHERE id = ? AND workspace_cwd = ? AND (deleted_at IS NULL OR deleted_at = 0)`,
  ).run(now, now, rid, workspaceCwd)
  return result.changes > 0
}

/**
 * @param {Record<string, unknown>} field
 * @param {unknown} value
 */
function serializeField(field, value) {
  if (field.type === 'bool') return value ? 1 : 0
  if (field.type === 'json') return typeof value === 'string' ? value : JSON.stringify(value)
  return value
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {Record<string, unknown>} spec
 * @param {Record<string, unknown>} view
 * @param {string} workspaceCwd
 */
export function computeStat(db, spec, view, workspaceCwd) {
  const entityName = String(view.entity)
  const table = tableNameForEntity(String(spec.slug), entityName)
  const quoted = quoteTable(table)
  const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table)
  if (!exists) return { value: 0, label: view.label || '统计' }
  const metric = view.metric || { fn: 'count' }
  const fn = String(metric.fn || 'count')
  let sql
  if (fn === 'count') {
    sql = `SELECT COUNT(*) AS v FROM ${quoted} WHERE workspace_cwd = ? AND (deleted_at IS NULL OR deleted_at = 0)`
  } else if (fn === 'sum' && metric.field) {
    sql = `SELECT SUM("${metric.field}") AS v FROM ${quoted} WHERE workspace_cwd = ? AND (deleted_at IS NULL OR deleted_at = 0)`
  } else if (fn === 'avg' && metric.field) {
    sql = `SELECT AVG("${metric.field}") AS v FROM ${quoted} WHERE workspace_cwd = ? AND (deleted_at IS NULL OR deleted_at = 0)`
  } else {
    sql = `SELECT COUNT(*) AS v FROM ${quoted} WHERE workspace_cwd = ? AND (deleted_at IS NULL OR deleted_at = 0)`
  }
  const row = db.prepare(sql).get(workspaceCwd)
  return { value: row?.v ?? 0, label: view.label || '统计' }
}
