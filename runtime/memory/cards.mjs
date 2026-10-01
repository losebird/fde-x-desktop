import { createHash } from 'node:crypto'
import { hostSourceOf, instanceOriginOf, originOfCard } from './identity.mjs'

export function compactText(label) {
  return String(label || '').replace(/\s+/g, ' ').trim()
}

export function validateMemoryCardLabel(label) {
  return compactText(label).length >= 8
}

function displayLabel(label) {
  const text = String(label || '').trim()
  const firstLine = text.split(/\n/u)[0]?.trim() || ''
  const candidate = firstLine.length >= 8 ? firstLine : compactText(text)
  return candidate.slice(0, 160)
}

export function cueCauseOf(cause) {
  return cause === 'choice' ? 'choice' : 'correction'
}

export function cueKey(origin, text, cause) {
  return `${String(origin || '').trim()}\n${compactText(text)}\n${cueCauseOf(cause)}`
}

export function cueIdOf(origin, text, cause) {
  const hash = createHash('sha1').update(cueKey(origin, text, cause)).digest('hex').slice(0, 16)
  return `memory:${hash}`
}

export function cueFoldKey(row) {
  const item = row && typeof row === 'object' ? row : {}
  const props = item.properties && typeof item.properties === 'object' ? item.properties : {}
  const meta = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  const origin = instanceOriginOf(originOfCard(item)) || String(originOfCard(item) || '').trim()
  const text = compactText(item.label || item.content || item.body || '')
  const cause = cueCauseOf(item.cause || props.cause || meta.cause)
  return `${origin}\0${text}\0${cause}`
}

export function collapseCueCards(rows) {
  const list = Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : []
  const by = new Map()
  for (const row of list) {
    const key = cueFoldKey(row)
    const prev = by.get(key)
    const id = String(row.id || '')
    if (!prev) {
      by.set(key, { ...row, ids: id ? [id] : [] })
      continue
    }
    const prevStatus = String(prev.status || '')
    const nextStatus = String(row.status || '')
    const keepNext = prevStatus !== '已入档' && nextStatus === '已入档'
    const kept = keepNext ? { ...row, ids: prev.ids } : prev
    if (id && !kept.ids.includes(id)) kept.ids.push(id)
    by.set(key, kept)
  }
  return [...by.values()]
}

export function draftMemoryCardInsert(label, cause, extra = {}) {
  const body = String(label || '').trim()
  const causeValue = cueCauseOf(cause)
  const origin = instanceOriginOf(extra.origin)
  const id = cueIdOf(origin, body, causeValue)
  const source = hostSourceOf(origin)
  return {
    op: 'add_node',
    args: {
      id,
      type: '记忆卡片',
      label: displayLabel(body),
      metadata: {
        status: '起草',
        kind: '记忆卡片',
        cause: causeValue,
        auto: extra.auto === true,
        ...(origin ? { origin } : {}),
        ...(source ? { source } : {}),
      },
    },
  }
}

export function asDraftCard(result, label) {
  const body = String(label || '').trim()
  const row = result && typeof result === 'object' ? result : {}
  const id = String(row.id || row.node_id || row.card_id || '')
  return {
    id,
    status: '起草',
    label: displayLabel(body),
    body,
  }
}
