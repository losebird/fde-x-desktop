/**
 * Attachment bytes live in files/, mailbox JSON only keeps a pointer.
 * @module dsh-lan-assist/attach
 */

import { ATTACH_MAX_BYTES } from './home.js'

export function publicAttach(list) {
  return (Array.isArray(list) ? list : []).map((item) => ({
    name: String((item && item.name) || 'file'),
    size: Number((item && item.size) || 0),
    mime: String((item && item.mime) || ''),
    hasData: !!(item && (item.data || item.bytes || item.fileId || item.hasData)),
  }))
}

export function stripAttach(list) {
  return (Array.isArray(list) ? list : []).map((item) => ({
    name: String((item && item.name) || 'file'),
    size: Number((item && item.size) || 0),
    mime: String((item && item.mime) || ''),
    over: !!(item && item.over),
    hasData: false,
  }))
}

export function sanitizeAttach(list) {
  return (Array.isArray(list) ? list : []).map((item) => {
    const data = String((item && (item.data || item.bytes)) || '')
    const size = Number((item && item.size) || 0) || (data ? Buffer.byteLength(data, 'utf8') : 0)
    return {
      name: String((item && item.name) || 'file'),
      size,
      mime: String((item && item.mime) || ''),
      over: !!(item && item.over) || size > ATTACH_MAX_BYTES,
      data,
    }
  }).filter((item) => item.name)
}

export function listHasBytes(list) {
  return (list || []).some((item) => item && (item.data || item.bytes))
}

export function listHasFiles(list) {
  return (list || []).some((item) => item && (item.data || item.bytes || item.fileId))
}

export function requestHasFiles(req) {
  return !!(req && (
    listHasFiles(req.attachments)
    || listHasFiles(req.replyAttachments)
    || (req.replies || []).some((rep) => listHasFiles(rep && rep.attachments))
  ))
}

/**
 * @param {{ put: Function, get: Function }} files
 */
export function createAttachStore(files) {
  async function persistList(ownerId, list) {
    const rows = Array.isArray(list) ? list : []
    const out = []
    for (let i = 0; i < rows.length; i++) {
      const item = rows[i] || {}
      const payload = String(item.data || item.bytes || '')
      const fileId = payload || item.fileId ? String(item.fileId || `${ownerId}.${i}`) : ''
      payload && fileId && await files.put(fileId, payload)
      out.push({
        name: String(item.name || 'file'),
        size: Number(item.size || 0),
        mime: String(item.mime || ''),
        over: !!item.over,
        fileId,
        hasData: !!(payload || item.hasData || item.fileId),
      })
    }
    return out
  }

  async function hydrateList(list) {
    const out = []
    for (const item of (Array.isArray(list) ? list : [])) {
      const payload = String((item && (item.data || item.bytes)) || '')
      const data = payload || (item && item.fileId ? await files.get(item.fileId) : '')
      out.push(Object.assign({}, item, { data }))
    }
    return out
  }

  async function spillOnce(store) {
    const state = await store.get()
    const reqs = (state && state.requests) || {}
    const next = {}
    let dirty = false
    for (const [id, req] of Object.entries(reqs)) {
      let row = req
      row && listHasBytes(row.attachments) && (row = Object.assign({}, row, { attachments: await persistList(row.id, row.attachments) }), dirty = true)
      row && listHasBytes(row.replyAttachments) && (row = Object.assign({}, row, { replyAttachments: await persistList(`${row.id}.reply`, row.replyAttachments) }), dirty = true)
      const replies = row && row.replies
      const need = replies && replies.some((rep) => listHasBytes(rep && rep.attachments))
      if (need) {
        const kept = []
        for (let i = 0; i < replies.length; i++) {
          const rep = replies[i]
          kept.push(listHasBytes(rep && rep.attachments)
            ? Object.assign({}, rep, { attachments: await persistList(`${row.id}.r${i}`, rep.attachments) })
            : rep)
        }
        row = Object.assign({}, row, { replies: kept })
        dirty = true
      }
      row && (next[id] = row)
    }
    dirty && await store.update((s) => {
      for (const id of Object.keys(next)) s.requests[id] = next[id]
    })
  }

  async function bytesOf(item) {
    return String((item && (item.data || item.bytes)) || '') || (item && item.fileId ? await files.get(item.fileId) : '')
  }

  return { persistList, hydrateList, spillOnce, bytesOf }
}
