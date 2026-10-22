/**
 * Topic groups live on this machine. The other seat gets a row from a roster envelope.
 * Dissolve drops local topics, not the pair.
 * @module dsh-lan-assist/group
 */

import { randomHex } from './crypto.js'
import { stripAttach } from './attach.js'

function sameIds(a, b) {
  const left = [...new Set((Array.isArray(a) ? a : []).filter(Boolean))].sort().join('\0')
  const right = [...new Set((Array.isArray(b) ? b : []).filter(Boolean))].sort().join('\0')
  return left === right
}

/**
 * @param {object} bag
 */
export function createGroups(bag) {
  const { store, now, snapshot, note, ensureSelf, files } = bag

  async function announce(group) {
    if (typeof bag.announceRoster !== 'function') return { ok: true, skipped: true }
    return bag.announceRoster(group)
  }

  async function createGroup({ name, members }) {
    const title = String(name || '').trim()
    const ids = [...new Set((Array.isArray(members) ? members : []).filter(Boolean))]
    if (!title) return { ok: false, error: 'EMPTY_NAME', hint: '先写群名。' }
    if (ids.length < 1) return { ok: false, error: 'NO_RECIPIENT', hint: '话题群至少要有一个已配对的人。' }
    const state = await store.get()
    for (const id of ids) {
      const peer = state.peers[id]
      if (!peer || peer.unpaired || !peer.keyHex) return { ok: false, error: 'NOT_PAIRED', peerId: id }
    }
    const id = `g_${randomHex(5)}`
    await store.update((s) => {
      ensureSelf(s)
      s.groups = Array.isArray(s.groups) ? s.groups : []
      s.groups.push({
        id,
        name: title,
        members: ids,
        createdAt: now(),
        origin: 'local',
      })
      note(s, `话题群 · ${title} · ${ids.length} 人`, now())
    })
    const roster = await announce({ id, name: title, members: ids })
    return { ok: true, groupId: id, roster, ...(await snapshot()) }
  }

  async function updateGroup({ groupId, name, members, pin, mute }) {
    const id = String(groupId || '').trim()
    if (!id) return { ok: false, error: 'NO_GROUP', hint: '没有这个话题群。' }
    const title = name == null ? null : String(name || '').trim()
    const ids = Array.isArray(members) ? [...new Set(members.filter(Boolean))] : null
    const state = await store.get()
    const group = ((state.groups || []).find((row) => row && row.id === id) || null)
    if (!group) return { ok: false, error: 'NO_GROUP', hint: '没有这个话题群。' }
    if (ids) {
      for (const mid of ids) {
        const peer = state.peers[mid]
        if (!peer || peer.unpaired || !peer.keyHex) return { ok: false, error: 'NOT_PAIRED', peerId: mid }
      }
    }
    const nameChanged = !!(title && title !== group.name)
    const membersChanged = !!(ids && !sameIds(ids, group.members))
    await store.update((s) => {
      const row = (s.groups || []).find((g) => g && g.id === id)
      if (!row) return
      title && (row.name = title)
      ids && (row.members = ids)
      typeof pin === 'boolean' && (row.pin = pin)
      typeof mute === 'boolean' && (row.mute = mute)
    })
    const nextName = title || group.name
    const nextMembers = ids || group.members
    const roster = (nameChanged || membersChanged)
      ? await announce({ id, name: nextName, members: nextMembers })
      : { ok: true, skipped: true }
    return { ok: true, roster, ...(await snapshot()) }
  }

  async function dissolveGroup(groupId) {
    const id = String(groupId || '').trim()
    if (!id) return { ok: false, error: 'NO_GROUP', hint: '没有这个话题群。' }
    const dropIds = []
    await store.update((s) => {
      s.groups = (s.groups || []).filter((g) => g && g.id !== id)
      for (const req of Object.values(s.requests || {})) {
        req && req.groupId === id && req.status !== 'closed'
          && (req.status = 'closed', req.updatedAt = now(), req.attachments = stripAttach(req.attachments), dropIds.push(req.id))
      }
      note(s, `解散话题群 · ${id}`, now())
    })
    for (const requestId of dropIds) await files.dropPrefix(requestId)
    return { ok: true, ...(await snapshot()) }
  }

  return { createGroup, updateGroup, dissolveGroup }
}
