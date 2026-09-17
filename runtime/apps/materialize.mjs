import { createId, execControlledDdl } from '../db.mjs'
import { detectBreakingSpecChange, quoteTable, tableNameForEntity } from './spec.mjs'

/**
 * @param {string} fieldType
 */
function sqliteType(fieldType) {
  if (fieldType === 'number') return 'REAL'
  if (fieldType === 'bool') return 'INTEGER'
  return 'TEXT'
}

/**
 * @param {Record<string, unknown>} spec
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {Record<string, unknown>} [previousSpec]
 * @returns {{ ddl: string[], applied: string[] }}
 */
export function planMaterializeDdl(spec, db, previousSpec = null) {
  if (previousSpec) {
    const breaking = detectBreakingSpecChange(previousSpec, spec)
    if (breaking.length > 0) {
      throw Object.assign(new Error('breaking_change'), { code: 'breaking_change', details: breaking })
    }
  }

  const slug = String(spec.slug)
  const ddl = []
  const applied = []

  for (const ent of spec.entities) {
    const table = tableNameForEntity(slug, ent.name)
    const quoted = quoteTable(table)
    const exists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    ).get(table)

    const fieldDefs = []
    for (const field of ent.fields) {
      fieldDefs.push(`"${field.name}" ${sqliteType(String(field.type))}`)
    }

    if (!exists) {
      const createSql = `CREATE TABLE IF NOT EXISTS ${quoted} (
        id TEXT PRIMARY KEY,
        workspace_cwd TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        ${fieldDefs.join(',\n        ')}
      )`
      ddl.push(createSql)
      applied.push(createSql)
      for (const field of ent.fields) {
        if (field.unique) {
          const idx = `CREATE UNIQUE INDEX IF NOT EXISTS "${table}__${field.name}__uniq" ON ${quoted} ("${field.name}")`
          ddl.push(idx)
          applied.push(idx)
        }
      }
      continue
    }

    const info = db.prepare(`PRAGMA table_info(${quoted})`).all()
    const existingCols = new Set(info.map((row) => row.name))
    for (const field of ent.fields) {
      if (existingCols.has(field.name)) continue
      const alter = `ALTER TABLE ${quoted} ADD COLUMN "${field.name}" ${sqliteType(String(field.type))}`
      ddl.push(alter)
      applied.push(alter)
      if (field.unique) {
        const idx = `CREATE UNIQUE INDEX IF NOT EXISTS "${table}__${field.name}__uniq" ON ${quoted} ("${field.name}")`
        ddl.push(idx)
        applied.push(idx)
      }
    }
    if (!existingCols.has('deleted_at')) {
      const alter = `ALTER TABLE ${quoted} ADD COLUMN deleted_at INTEGER`
      ddl.push(alter)
      applied.push(alter)
    }
  }

  return { ddl, applied }
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {Record<string, unknown>} spec
 * @param {Record<string, unknown>} [previousSpec]
 */
export function applyMaterialize(db, spec, previousSpec = null) {
  const { ddl, applied } = planMaterializeDdl(spec, db, previousSpec)
  db.exec('BEGIN IMMEDIATE;')
  try {
    for (const statement of ddl) {
      execControlledDdl(db, statement)
    }
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
  return { applied, revisionNote: createId('ddl') }
}
