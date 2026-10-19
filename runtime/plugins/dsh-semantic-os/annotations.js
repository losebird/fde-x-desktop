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
export async function listAnnotations(cwd) {
  if (!cwd || !String(cwd).trim()) return { ok: false, error: 'NO_CWD' }
  try {
    const store = await readStore(cwd)
    return { ok: true, items: store.items }
  } catch (error) {
    return { ok: false, error: error && error.code === 'BAD_CWD' ? 'BAD_CWD' : 'NO_CWD' }
  }
}

/**
 * @param {string} cwd
 * @param {string} note
 * @param {string} [path]
 */
export async function addAnnotation(cwd, note, path) {
  if (!cwd || !String(cwd).trim()) return { ok: false, error: 'NO_CWD' }
  const text = String(note || '').trim()
  if (!text) return { ok: false, error: 'NO_NOTE' }
  try {
    const store = await readStore(cwd)
    const item = {
      id: randomUUID(),
      note: text,
      path: String(path || ''),
      ts: new Date().toISOString(),
    }
    store.items.push(item)
    const file = storePath(cwd)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify(store, null, 2) + '\n', 'utf8')
    return { ok: true, item, items: store.items }
  } catch (error) {
    return { ok: false, error: error && error.code === 'BAD_CWD' ? 'BAD_CWD' : 'NO_CWD' }
  }
}
