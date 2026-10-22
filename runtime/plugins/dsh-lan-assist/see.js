/**
 * Attachment bytes stay on this machine. Eyes wait for a click.
 * @module dsh-lan-assist/see
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import { speakSeeFailed, speakSeeMissing } from './probe.js'
import { requestIdOf } from './conversation.js'

function underWorkspace(cwd, dest) {
  const root = resolve(String(cwd || ''))
  const path = resolve(String(dest || ''))
  const prefix = root.endsWith(sep) ? root : root + sep
  return path === root || path.startsWith(prefix)
}

/**
 * @param {object} bag
 */
export function createSee(bag) {
  const { store, now, snapshot, note, attach, hydrateList, opts } = bag

  function payloadBytes(data, mime) {
    const raw = String(data || '')
    const kind = String(mime || '')
    if (!raw) return Buffer.alloc(0)
    if (!kind || /^text\/|^application\/(json|xml|javascript|x-sh)\b/i.test(kind)) {
      return Buffer.from(raw, 'utf8')
    }
    const buf = Buffer.from(raw, 'base64')
    return buf.length ? buf : Buffer.from(raw, 'utf8')
  }

  async function getAttachment(requestId, index) {
    requestId = requestIdOf(requestId)
    const state = await store.get()
    const req = state.requests[requestId]
    if (!req) return { ok: false, error: 'NO_REQUEST' }
    const item = (req.attachments || [])[Number(index)]
    if (!item) return { ok: false, error: 'NO_FILE' }
    const data = await attach.bytesOf(item)
    if (!data) return { ok: false, error: 'NO_FILE', hint: '没有可预览的字节。' }
    return {
      ok: true,
      name: String(item.name || 'file'),
      mime: String(item.mime || ''),
      size: Number(item.size || 0),
      data,
    }
  }

  async function copyAttachment(spec = {}) {
    const cwd = String((spec && spec.workspace) || '').trim()
    if (!cwd) return { ok: false, error: 'NO_CWD', hint: '这封没绑工作区，不能另存。' }
    const got = await getAttachment(spec.requestId, spec.index)
    if (!got.ok) return got
    const safe = (basename(got.name || 'file').replace(/[\\/]/g, '').replace(/[^\w.\u4e00-\u9fff-]+/g, '_') || 'file')
    const dir = join(resolve(cwd), '.dsh', 'lan-assist', 'inbox-copies')
    const dest = join(dir, `${now()}-${safe}`)
    if (!underWorkspace(cwd, dest)) return { ok: false, error: 'PATH', hint: '不能写到工作区外面。' }
    try {
      await mkdir(dir, { recursive: true, mode: 0o700 })
      await writeFile(dest, payloadBytes(got.data, got.mime))
    } catch {
      return { ok: false, error: 'WRITE', hint: '没另存成。' }
    }
    await store.update((s) => note(s, `附件另存 · ${safe}`, now()))
    return { ok: true, path: join('.dsh', 'lan-assist', 'inbox-copies', basename(dest)), name: safe }
  }

  async function seeAttachment(requestId) {
    requestId = requestIdOf(requestId)
    const state = await store.get()
    const req = state.requests[requestId]
    if (!req) return { ok: false, error: 'NO_REQUEST' }
    if (typeof opts.see !== 'function') {
      return { ok: false, error: 'NO_EYES', hint: speakSeeMissing(), ...(await snapshot()) }
    }
    try {
      const seen = await opts.see({
        requestId,
        attachments: await hydrateList(req.attachments || []),
        ref: req.ref || null,
        workspace: req.workspace || '',
      })
      if (seen && seen.error === 'NO_EYES') {
        return { ok: false, error: 'NO_EYES', hint: speakSeeMissing(), ...(await snapshot()) }
      }
      if (!seen || seen.ok === false) {
        return { ok: false, error: 'UNSEEN', hint: speakSeeFailed(), ...(await snapshot()) }
      }
      await store.update((s) => {
        const row = s.requests[requestId]
        row && (row.seen = { at: now(), text: String(seen.text || '').slice(0, 400), ok: true }, note(s, `看看 · ${requestId} · 人点了才交眼睛`, now()))
      })
      return { ok: true, seen: String(seen.text || ''), ...(await snapshot()) }
    } catch {
      return { ok: false, error: 'UNSEEN', hint: speakSeeFailed(), ...(await snapshot()) }
    }
  }

  return { getAttachment, copyAttachment, seeAttachment }
}
