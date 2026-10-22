import { createId } from '../db.mjs'
import { canonicalWorkspaceCwd, workspaceCwdEqual } from '../cwd.mjs'

const KEY_RE = /^[A-Za-z0-9._-]{1,80}$/
const MAX_JSON = 2 * 1024 * 1024

export function assertDocKey(key) {
  const value = String(key || '')
  if (!KEY_RE.test(value)) {
    const err = new Error('文档键无效')
    err.code = 'validation_error'
    throw err
  }
  return value
}

function findDocumentRow(db, { appId, workspaceCwd, key }) {
  const docKey = assertDocKey(key)
  const match = workspaceCwdEqual(db, 'workspace_cwd', workspaceCwd)
  return db.prepare(`
    SELECT id, json, workspace_cwd FROM app_documents
    WHERE app_id = ? AND ${match.sql} AND doc_key = ?
    ORDER BY CASE WHEN workspace_cwd = ? THEN 0 ELSE 1 END, updated_at DESC
    LIMIT 1
  `).get(appId, ...match.params, docKey, canonicalWorkspaceCwd(workspaceCwd))
}

export function getDocument(db, { appId, workspaceCwd, key }) {
  const row = findDocumentRow(db, { appId, workspaceCwd, key })
  if (!row) return null
  try {
    return JSON.parse(row.json)
  } catch {
    return null
  }
}

export function putDocument(db, { appId, slug, workspaceCwd, key, value }) {
  const docKey = assertDocKey(key)
  const json = JSON.stringify(value === undefined ? null : value)
  if (Buffer.byteLength(json, 'utf8') > MAX_JSON) {
    const err = new Error('文档太大')
    err.code = 'validation_error'
    throw err
  }
  const now = new Date().toISOString()
  const existing = findDocumentRow(db, { appId, workspaceCwd, key: docKey })
  if (existing) {
    db.prepare(`
      UPDATE app_documents SET json = ?, updated_at = ?, slug = ? WHERE id = ?
    `).run(json, now, slug, existing.id)
    return { id: existing.id, key: docKey, updatedAt: now }
  }
  const id = createId('adoc')
  db.prepare(`
    INSERT INTO app_documents (id, app_id, slug, workspace_cwd, doc_key, json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, appId, slug, workspaceCwd, docKey, json, now)
  return { id, key: docKey, updatedAt: now }
}
