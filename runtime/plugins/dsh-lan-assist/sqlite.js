/**
 * Optional node:sqlite. Missing engine must not keep the plugin from loading.
 * @module dsh-lan-assist/sqlite
 */

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export function openSqlite(file) {
  let DatabaseSync
  try {
    DatabaseSync = require('node:sqlite').DatabaseSync
  } catch {
    return null
  }
  if (typeof DatabaseSync !== 'function' || !file) return null
  try {
    return new DatabaseSync(String(file))
  } catch {
    return null
  }
}
