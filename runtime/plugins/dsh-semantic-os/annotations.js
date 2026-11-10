/**
 * Product change-registry notebook on disk.
 * Not the engine GraphSession annotations store (those vanish on restart).
 * @module dsh-semantic-os/annotations
 */

import { realpathSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'

const VERSION = 1

function storePath(cwd) {
  if (!cwd || !String(cwd).trim()) {
    const err = new Error('NO_CWD')
    err.code = 'NO_CWD'
    throw err
  }
  let root
  try {
    root = realpathSync(String(cwd).trim())
  } catch {
    const err = new Error('BAD_CWD')
    err.code = 'BAD_CWD'
    throw err
  }
  return join(root, '.dsh', 'semantic-os', 'annotations.json')
}

function blank() {
  return { version: VERSION, items: [] }
}

async function readStore(cwd) {
  const file = storePath(cwd)
  try {
    const raw = JSON.parse(await readFile(file, 'utf8'))
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw.items)) return blank()
    return { version: VERSION, items: raw.items }
  } catch (error) {
    if (error && (error.code === 'NO_CWD' || error.code === 'BAD_CWD')) throw error
    return blank()
  }
}

/**
 * @param {string} cwd
 */
export async function listAnnotations(cwd, nodeId) {
  if (!cwd || !String(cwd).trim()) return { ok: false, error: 'NO_CWD' }
  try {
    const store = await readStore(cwd)
    const want = String(nodeId || '').trim()
    const items = want
      ? store.items.filter((row) => String(row.node_id || row.path || '') === want)
      : store.items
    return { ok: true, items: items.map(asExplorer) }
  } catch (error) {
    return { ok: false, error: error && error.code === 'BAD_CWD' ? 'BAD_CWD' : 'NO_CWD' }
  }
}

function asExplorer(row) {
  const id = String(row.annotation_id || row.id || '')
  return {
    ...row,
    annotation_id: id,
    id,
    node_id: String(row.node_id || row.path || ''),
    content: String(row.content || row.note || ''),
    note: String(row.note || row.content || ''),
    tags: Array.isArray(row.tags) ? row.tags : [],
    visibility: row.visibility || 'private',
  }
}

/**
 * @param {string} cwd
 * @param {string} note
 * @param {string} [path]
 */
export async function addAnnotation(cwd, note, path, extra = {}) {
  if (!cwd || !String(cwd).trim()) return { ok: false, error: 'NO_CWD' }
  const text = String(note || extra.content || extra.note || '').trim()
  if (!text) return { ok: false, error: 'NO_NOTE' }
  try {
    const store = await readStore(cwd)
    const id = String(extra.annotation_id || extra.id || randomUUID())
    const item = asExplorer({
      id,
      annotation_id: id,
      note: text,
      content: text,
      path: String(path || extra.path || extra.node_id || ''),
      node_id: String(extra.node_id || path || ''),
      tags: Array.isArray(extra.tags) ? extra.tags : [],
      visibility: extra.visibility || 'private',
      ts: extra.ts || new Date().toISOString(),
    })
    store.items.push(item)
    const file = storePath(cwd)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify(store, null, 2) + '\n', 'utf8')
    return { ok: true, item, items: store.items.map(asExplorer) }
  } catch (error) {
    return { ok: false, error: error && error.code === 'BAD_CWD' ? 'BAD_CWD' : 'NO_CWD' }
  }
}

export async function deleteAnnotation(cwd, id) {
  if (!cwd || !String(cwd).trim()) return { ok: false, error: 'NO_CWD' }
  const want = String(id || '').trim()
  if (!want) return { ok: false, error: 'NO_PATH' }
  try {
    const store = await readStore(cwd)
    const next = store.items.filter((row) => String(row.annotation_id || row.id || '') !== want)
    if (next.length === store.items.length) return { ok: false, error: 'NO_NOTE' }
    store.items = next
    const file = storePath(cwd)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify(store, null, 2) + '\n', 'utf8')
    return { ok: true, deleted: want, items: store.items.map(asExplorer) }
  } catch (error) {
    return { ok: false, error: error && error.code === 'BAD_CWD' ? 'BAD_CWD' : 'NO_CWD' }
  }
}
