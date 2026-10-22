/**
 * Topic group row on this machine. The other seat gets a row only from an envelope.
 * @module dsh-lan-assist/roster
 */

export function isRoster(row) {
  return !!(row && row.roster)
}

export function visibleMembers(visible, selfId) {
  const me = String(selfId || '')
  return [...new Set((Array.isArray(visible) ? visible : [])
    .map((id) => String(id || ''))
    .filter((id) => id && id !== me))]
}

/** Letter dest = membership minus self. Pairing is a per-peer flush condition. */
export function destOf(members, extra, selfId) {
  return visibleMembers([
    ...(Array.isArray(members) ? members : []),
    ...(Array.isArray(extra) ? extra : []),
  ], selfId)
}

export function upsertGroup(state, inner, peer, now, origin) {
  const groupId = String((inner && inner.groupId) || '')
  const groupName = String((inner && inner.groupName) || '')
  if (!state || !groupId || !groupName) return null
  state.groups = Array.isArray(state.groups) ? state.groups : []
  const selfId = state.self && state.self.id
  const members = visibleMembers(inner && inner.visible, selfId)
  const existing = state.groups.find((row) => row && row.id === groupId)
  if (existing) {
    existing.name = groupName
    if (members.length) existing.members = members
    return existing
  }
  const row = {
    id: groupId,
    name: groupName,
    members: members.length ? members : (peer && peer.id ? [String(peer.id)] : []),
    createdAt: now(),
    origin: origin || 'roster',
  }
  state.groups.push(row)
  return row
}
