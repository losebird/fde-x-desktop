import { quoteTable } from './apps/spec.mjs'

const COLUMN = /^[A-Za-z_][A-Za-z0-9_]*$/

export function quotedAssignments(patch, allowed) {
  const keys = Object.keys(patch && typeof patch === 'object' ? patch : {}).filter(
    (key) => allowed.has(key) && COLUMN.test(key),
  )
  return {
    keys,
    sql: keys.map((key) => `${quoteTable(key)} = ?`).join(', '),
    values: keys.map((key) => patch[key]),
  }
}
