/**
 * Attachment bytes live under lan-assist/files, not inside state.json.
 * Snapshot and the mailbox JSON only keep a pointer.
 * @module dsh-lan-assist/files
 */

import { mkdir, readdir, readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { replaceFile } from './disk.js'

export function safeFileId(id) {
  return String(id || '').replace(/[^A-Za-z0-9._:-]/g, '_')
}

/**
 * @param {{ root?: string }} [opts] assist home (…/lan-assist). Empty root = memory.
 */
export function createFileStore(opts = {}) {
  const root = opts.root ? join(opts.root, 'files') : ''
  const mem = new Map()

  async function ensure() {
    if (root) await mkdir(root, { recursive: true, mode: 0o700 })
  }

  function pathOf(id) {
    return join(root, safeFileId(id))
  }

  return {
    root,
    async put(id, data) {
      const key = safeFileId(id)
      const payload = String(data || '')
      if (!key || !payload) return ''
      if (!root) {
        mem.set(key, payload)
        return key
      }
      await ensure()
      await replaceFile(pathOf(key), payload)
      return key
    },
    async get(id) {
      const key = safeFileId(id)
      if (!key) return ''
      if (!root) return mem.get(key) || ''
      try { return await readFile(pathOf(key), 'utf8') } catch { return '' }
    },
    async drop(id) {
      const key = safeFileId(id)
      if (!key) return
      if (!root) {
        mem.delete(key)
        return
      }
      try { await unlink(pathOf(key)) } catch { /* missing */ }
    },
    async dropPrefix(prefix) {
      const p = safeFileId(prefix)
      if (!p) return
      if (!root) {
        for (const key of [...mem.keys()]) {
          if (key === p || key.startsWith(p + ':') || key.startsWith(p + '.')) mem.delete(key)
        }
        return
      }
      let names = []
      try { names = await readdir(root) } catch { return }
      await Promise.all(names
        .filter((name) => name === p || name.startsWith(p + ':') || name.startsWith(p + '.'))
        .map((name) => unlink(join(root, name)).catch(() => undefined)))
    },
  }
}
