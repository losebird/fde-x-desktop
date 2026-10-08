/** Memory health sheet. Host scan + archive origin attach. 闸 does not invent kinds or ops. */

import { cardIsRetired, collapseCueCards, namedCardIds } from './cards.mjs'
import { attachCardOrigin } from './draft.mjs'
import { hostSourceOf, originOfCard } from './identity.mjs'
import { originKindOf } from './origin-entity.mjs'

export const HEALTH_PAGE = 80
export const HOST_UNSOURCED_KIND = '无出处'
export const HOST_DUP_KIND = '重复'

const LINK_EDGE = 'confirms'

export function healthItemKey(row) {
  const item = row && typeof row === 'object' ? row : {}
  return `${item.kind || ''}\0${item.id || ''}\0${item.other || ''}`
}

export function itemHasOrigin(row) {
  return Boolean(hostSourceOf(originOfCard(row)))
}

export function foldCueItems(items) {
  return collapseCueCards(asItems(items)).map((row) => {
    const ids = Array.isArray(row.ids) ? row.ids.map(String).filter(Boolean) : []
    const id = String(row.id || ids[0] || '')
    return { ...row, id, ids }
  })
}

export function retireGroupIds(items) {
  const ids = []
  for (const row of asItems(items)) {
    const extra = Array.isArray(row.ids) ? row.ids.map((item) => String(item || '').trim()).filter(Boolean) : []
    if (extra.length) {
      for (const id of extra) {
        if (!ids.includes(id)) ids.push(id)
      }
      continue
    }
    const id = String(row.id || '').trim()
    if (id && !ids.includes(id)) ids.push(id)
  }
  return ids
}

function asItems(value) {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === 'object') : []
}

function actionOp(row) {
  return row && typeof row === 'object' ? String(row.op || '') : ''
}

function hasOp(item, op) {
  return asItems(item?.actions).some((row) => actionOp(row) === op)
}

export function filterSourceActions(row) {
  const item = row && typeof row === 'object' ? { ...row } : {}
  const origin = originOfCard(item)
  const allowed = hostSourceOf(origin)
  item.actions = asItems(item.actions).filter((action) => {
    if (actionOp(action) !== 'source') return true
    return Boolean(allowed || hostSourceOf(action.source))
  })
  return item
}

export function healthNamedIds(item) {
  return namedCardIds(item)
}

export function collectHealthCardIds(health, extraItems) {
  const ids = []
  const pushItem = (item) => {
    for (const id of healthNamedIds(item)) {
      if (!ids.includes(id)) ids.push(id)
    }
  }
  for (const group of asItems(health && health.groups)) {
    for (const item of asItems(group.items)) pushItem(item)
  }
  for (const item of asItems(extraItems)) pushItem(item)
  return ids
}

export function groupActionsOf(items) {
  const rows = asItems(items)
  if (!rows.length) return []
  const canRetireAll = rows.every((row) => hasOp(row, 'retire'))
  const writeOps = new Set()
  for (const row of rows) {
    for (const action of asItems(row.actions)) {
      const op = actionOp(action)
      if (op && op !== 'open') writeOps.add(op)
    }
  }
  const onlyRetire = canRetireAll && [...writeOps].every((op) => op === 'retire')
  const actions = []
  if (canRetireAll) actions.push('retire_group')
  if (onlyRetire) actions.push('mute')
  return actions
}

export function attachHealthItem(row, originMap) {
  return filterSourceActions(attachCardOrigin(row, originMap))
}

export function reshapeUnsoursedGroup(group, originMap, offset, dupOffset, page) {
  const host = group && typeof group === 'object' ? group : {}
  const items = foldCueItems(
    asItems(host.items)
      .map((row) => attachHealthItem(row, originMap))
      .filter((row) => !itemHasOrigin(row)),
  )
  const hasMore = Boolean(host.has_more)
  return {
    ...host,
    kind: String(host.kind || HOST_UNSOURCED_KIND),
    items,
    count: items.length,
    has_more: hasMore,
    empty: items.length === 0,
    actions: groupActionsOf(items),
    next: hasMore ? { offset: offset + page, dup_offset: dupOffset } : null,
  }
}

export function dupPairOps(left, right) {
  const lid = String((left && left.id) || '')
  const rid = String((right && right.id) || '')
  if (!lid || !rid) return { unary: [], binary: [] }
  const ltype = String((left && left.type) || '')
  const rtype = String((right && right.type) || '')
  if (ltype && rtype && ltype !== rtype) return { unary: [], binary: [] }
  const unary = [
    { op: 'open', id: lid },
    { op: 'retire', id: lid },
    { op: 'open', id: rid },
    { op: 'retire', id: rid },
  ]
  const binary = []
  if (originKindOf(lid) === 'memory' && originKindOf(rid) === 'memory') {
    binary.push({ op: 'link', other: rid, type: LINK_EDGE })
  }
  if (ltype && rtype && ltype === rtype) {
    binary.push({ op: 'merge', other: rid })
  }
  return { unary, binary }
}

export function liveDuplicateBag(dups, cardById) {
  const rows = Array.isArray(dups) ? dups : Array.isArray(dups?.duplicates) ? dups.duplicates : []
  const cards = cardById instanceof Map ? cardById : new Map()
  const live = rows.filter((row) => {
    const left = row && typeof row.entity_a === 'object' ? row.entity_a : {}
    const right = row && typeof row.entity_b === 'object' ? row.entity_b : {}
    const lid = String(left.id || '')
    const rid = String(right.id || '')
    if (cardIsRetired(left) || cardIsRetired(right)) return false
    if (lid && cardIsRetired(cards.get(lid))) return false
    if (rid && cardIsRetired(cards.get(rid))) return false
    return true
  })
  return { duplicates: live }
}

export function dupIssuesFromEnrich(dups, kind = HOST_DUP_KIND) {
  const rows = Array.isArray(dups) ? dups : Array.isArray(dups?.duplicates) ? dups.duplicates : []
  const issues = []
  for (const row of rows) {
    const left = row && typeof row.entity_a === 'object' ? row.entity_a : {}
    const right = row && typeof row.entity_b === 'object' ? row.entity_b : {}
    const lid = String(left.id || '')
    const rid = String(right.id || '')
    const { unary, binary } = dupPairOps(left, right)
    if (!unary.length && !binary.length) continue
    const hasLink = binary.some((action) => action.op === 'link')
    issues.push({
      id: lid,
      kind,
      other: rid,
      ...(hasLink ? { type: LINK_EDGE } : {}),
      actions: [...unary, ...binary],
    })
  }
  return issues
}

export function reshapeDupGroup(dups, offset, dupOffset, page, kind = HOST_DUP_KIND) {
  const issues = dupIssuesFromEnrich(dups, kind)
  const items = issues.slice(dupOffset, dupOffset + page)
  const hasMore = dupOffset + items.length < issues.length
  return {
    kind,
    count: issues.length,
    items,
    has_more: hasMore,
    empty: issues.length === 0,
    actions: [],
    next: hasMore ? { offset, dup_offset: dupOffset + page } : null,
  }
}

function passGroup(group, originMap, offset, dupOffset, page) {
  const host = group && typeof group === 'object' ? group : {}
  const items = foldCueItems(asItems(host.items).map((row) => attachHealthItem(row, originMap)))
  const hasMore = Boolean(host.has_more)
  return {
    ...host,
    items,
    actions: groupActionsOf(items),
    next: hasMore ? { offset: offset + page, dup_offset: dupOffset } : null,
  }
}

export function buildHealthSheet({
  health,
  dups,
  originMap,
  offset = 0,
  dupOffset = 0,
  page = HEALTH_PAGE,
} = {}) {
  const host = health && typeof health === 'object' ? health : {}
  const hostOffset = Math.max(0, Number(offset) || 0)
  const hostDupOffset = Math.max(0, Number(dupOffset) || 0)
  const pageSize = Math.max(1, Number(page) || HEALTH_PAGE)
  const groups = []
  let placedDup = false
  for (const group of asItems(host.groups)) {
    const kind = String(group.kind || '')
    if (kind === HOST_DUP_KIND) {
      groups.push(reshapeDupGroup(dups, hostOffset, hostDupOffset, pageSize, kind))
      placedDup = true
      continue
    }
    if (kind === HOST_UNSOURCED_KIND) {
      groups.push(reshapeUnsoursedGroup(group, originMap, hostOffset, hostDupOffset, pageSize))
      continue
    }
    groups.push(passGroup(group, originMap, hostOffset, hostDupOffset, pageSize))
  }
  if (!placedDup) {
    groups.push(reshapeDupGroup(dups, hostOffset, hostDupOffset, pageSize))
  }
  return {
    ok: true,
    writes: false,
    groups,
    offset: hostOffset,
    dup_offset: hostDupOffset,
    muted: Array.isArray(host.muted) ? host.muted : [],
  }
}

export function mergeHealthGroups(prev, next) {
  const prior = asItems(prev)
  const incoming = asItems(next)
  const byKind = Object.fromEntries(prior.map((row) => [String(row.kind || ''), row]))
  return incoming.map((row) => {
    const kind = String(row.kind || '')
    const old = byKind[kind]
    const fresh = asItems(row.items)
    if (!old) {
      return { ...row, items: fresh, count: Math.max(fresh.length, Number(row.count || 0)) }
    }
    const seen = new Set(asItems(old.items).map(healthItemKey))
    const extra = fresh.filter((item) => !seen.has(healthItemKey(item)))
    const items = asItems(old.items).concat(extra)
    return { ...row, items, count: Math.max(items.length, Number(row.count || 0)) }
  })
}

export function healthWritePlan(body) {
  const row = body && typeof body === 'object' ? body : {}
  if (row.nodded !== true) return { error: 'nodded' }
  const op = String(row.op || '')
  const id = String(row.id || '').trim()
  if (op === 'retire') {
    if (!id) return { error: 'NO_PATH' }
    return { python: 'retire_memory_card', args: { id, nodded: true } }
  }
  if (op === 'retire_group') {
    const ids = retireGroupIds([{ ids: row.ids }])
    if (!ids.length) return { error: 'NO_PATH' }
    return { python: 'retire_memory_card', args: { ids, nodded: true }, ids }
  }
  if (op === 'source') {
    const source = hostSourceOf(row.source)
    if (!id || !source) return { error: 'NOT_A_SESSION' }
    return { python: 'source_memory_card', args: { id, source, nodded: true } }
  }
  if (op === 'link') {
    const target = String(row.other || '').trim()
    const type = String(row.type || LINK_EDGE).trim() || LINK_EDGE
    if (!id || !target) return { error: 'NO_PATH' }
    return { python: 'nod_memory_edge', args: { source: id, target, type, nodded: true } }
  }
  if (op === 'renew') {
    if (!id) return { error: 'NO_PATH' }
    return { python: 'renew_memory_card', args: { id, nodded: true } }
  }
  if (op === 'mute') {
    const kind = String(row.kind || '').trim()
    if (!kind) return { error: 'NO_PATH' }
    return { python: 'mute_health_kind', args: { kind, nodded: true } }
  }
  if (op === 'extract') {
    if (!id) return { error: 'NO_PATH' }
    return { path: '/extract-session', body: { id, nodded: true } }
  }
  if (op === 'merge') {
    const other = String(row.other || '').trim()
    if (!id || !other) return { error: 'NO_PATH' }
    if (originKindOf(id) === 'memory' && originKindOf(other) === 'memory') {
      return { python: 'retire_memory_card', args: { id: other, nodded: true } }
    }
    return {
      path: '/api/enrich/merge',
      body: { primary_id: id, duplicate_ids: [other], confirm: true, nodded: true },
    }
  }
  return { error: 'unknown_op' }
}
