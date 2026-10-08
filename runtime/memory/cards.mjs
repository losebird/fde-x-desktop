import { createHash } from 'node:crypto'
import { looksLikeJsonDump } from '../biz/session-origin-text.mjs'
import { hostSourceOf, instanceOriginOf, originOfCard } from './identity.mjs'

export function compactText(label) {
  return String(label || '').replace(/\s+/g, ' ').trim()
}

export function validateMemoryCardLabel(label) {
  return compactText(label).length >= 8
}

export function displayLabel(label) {
  const text = String(label || '').trim()
  const firstLine = text.split(/\n/u)[0]?.trim() || ''
  const candidate = firstLine.length >= 8 ? firstLine : compactText(text)
  return candidate.slice(0, 160)
}

export function cueFromOriginDoc(doc) {
  const text = String(doc && doc.text || '').trim()
  if (text && !looksLikeJsonDump(text)) return displayLabel(text)
  const title = String(doc && doc.title || '').trim()
  if (title && !looksLikeJsonDump(title)) return displayLabel(title)
  return ''
}

export function cardCue(card) {
  const row = card && typeof card === 'object' ? card : {}
  const cue = String(row.cue || '').trim()
  if (cue) return cue
  return displayLabel(row.label || row.content || row.body || row.title)
}

export function namedCardIds(row) {
  const ids = []
  const push = (value) => {
    const id = String(value || '').trim()
    if (id && !ids.includes(id)) ids.push(id)
  }
  const item = row && typeof row === 'object' ? row : {}
  push(item.id)
  push(item.other)
  for (const extra of Array.isArray(item.ids) ? item.ids : []) push(extra)
  return ids
}

function originForCue(card) {
  const row = card && typeof card === 'object' ? card : {}
  return instanceOriginOf(originOfCard(row) || row.origin || row.id)
}

export async function attachCuesOnCards(cards, loadOriginDoc) {
  const list = Array.isArray(cards) ? cards.filter((row) => row && typeof row === 'object') : []
  const load = typeof loadOriginDoc === 'function' ? loadOriginDoc : null
  return Promise.all(list.map(async (card) => {
    const origin = originForCue(card)
    if (origin && load) {
      try {
        const doc = await load(origin)
        const fromOrigin = cueFromOriginDoc(doc)
        if (fromOrigin) return { ...card, cue: fromOrigin }
      } catch {
        /* keep stored label */
      }
    }
    const cue = cardCue(card)
    return { ...card, cue }
  }))
}

function originFromMap(originMap, id) {
  if (!(originMap instanceof Map)) return ''
  return String(originMap.get(id) || '')
}

function readableText(value, depth = 0) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (depth > 2 || typeof value !== 'object') return ''
  if (Array.isArray(value)) return value.map((item) => readableText(item, depth + 1)).filter(Boolean).join('\n')
  return readableText(value.then || value.body || value.label || value.content || value.text, depth + 1)
}

export function cardFromOpenedNode(id, opened) {
  const row = opened && typeof opened === 'object' && !opened.error ? opened : {}
  const node = row.node && typeof row.node === 'object' ? row.node : row
  const body = readableText(node.then || node.body || node.label || node.content || node.text)
  const label = readableText(node.label) || body
  const meta = node.metadata && typeof node.metadata === 'object' ? node.metadata : {}
  const props = node.properties && typeof node.properties === 'object' ? node.properties : {}
  const then = node.then && typeof node.then === 'object' ? node.then : {}
  return {
    id: String(node.id || id || '').trim() || String(id || ''),
    label,
    origin: node.origin,
    content: body,
    body,
    type: node.type || props.type || meta.type || row.type,
    status: node.status || then.status || meta.status || props.status,
    valid_until: node.valid_until || then.valid_until || meta.valid_until || props.valid_until,
    metadata: node.metadata,
    properties: node.properties,
    then: node.then,
  }
}

export function cardStatusOf(card) {
  const row = card && typeof card === 'object' ? card : {}
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const props = row.properties && typeof row.properties === 'object' ? row.properties : {}
  const then = row.then && typeof row.then === 'object' ? row.then : {}
  return String(row.status || then.status || meta.status || props.status || '').trim()
}

export function cardIsRetired(card) {
  return cardStatusOf(card) === '已停用'
}

const VOCAB_TYPES = new Set([
  'skos:concept',
  'owl:class',
  'owl:ontology',
  'owl:objectproperty',
  'owl:datatypeproperty',
  'skos:conceptscheme',
])

function memoryStillCounts(card) {
  const row = card && typeof card === 'object' ? card : {}
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const props = row.properties && typeof row.properties === 'object' ? row.properties : {}
  const then = row.then && typeof row.then === 'object' ? row.then : {}
  const until = String(row.valid_until || then.valid_until || meta.valid_until || props.valid_until || '').trim()
  if (!until) return row.current !== false
  const when = Date.parse(until)
  if (Number.isNaN(when)) return row.current !== false
  return when >= Date.now()
}

function isMemoryCardNode(card) {
  const row = card && typeof card === 'object' ? card : {}
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const props = row.properties && typeof row.properties === 'object' ? row.properties : {}
  const type = String(row.type || props.type || meta.type || '').trim()
  const kind = String(row.kind || props.kind || meta.kind || '').trim()
  const id = String(row.id || '').trim()
  return type === '记忆卡片' || kind === '记忆卡片' || id.startsWith('memory:')
}

export function nodeMayCite(card) {
  const row = card && typeof card === 'object' ? card : {}
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const props = row.properties && typeof row.properties === 'object' ? row.properties : {}
  const id = String(row.id || '').trim()
  const type = String(row.type || props.type || meta.type || '').trim().toLowerCase()
  if (!id) return false
  if (type === 'decision') return cardStatusOf(row) === '已生效'
  if (isMemoryCardNode(row)) {
    const status = cardStatusOf(row)
    if (!status || status === '起草' || status === '已停用') return false
    return memoryStillCounts(row)
  }
  if (id.startsWith('session:') || id.startsWith('file:')) return true
  if (VOCAB_TYPES.has(type)) return false
  if (type === 'document') return true
  return false
}

export function nodeWasOpened(card) {
  const row = card && typeof card === 'object' ? card : {}
  return Boolean(
    row.type
    || row.content
    || row.body
    || row.status
    || row.label
    || row.then
    || row.properties
    || row.metadata
    || row.valid_until,
  )
}

export async function loadNamedCards(aiRuntime, cwd, ids) {
  const want = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean))]
  const byId = new Map()
  if (!want.length || !aiRuntime || typeof aiRuntime.semanticOs !== 'function') return byId
  const remaining = new Set(want)
  const page = 80
  let offset = 0
  while (remaining.size) {
    const listed = await aiRuntime.semanticOs('/python', {
      op: 'list_memory_cards',
      args: { include_filed: true, limit: page, offset },
      ...(cwd ? { cwd } : {}),
    }).catch(() => ({ cards: [] }))
    const cards = Array.isArray(listed?.cards) ? listed.cards : []
    for (const row of cards) {
      const id = String(row && row.id || '').trim()
      if (!id) continue
      byId.set(id, row)
      remaining.delete(id)
    }
    if (!listed?.has_more || !cards.length) break
    offset += cards.length
  }
  await Promise.all([...remaining].map(async (id) => {
    try {
      const opened = await aiRuntime.semanticOs('/python', {
        op: 'open_node',
        args: { id },
        ...(cwd ? { cwd } : {}),
      })
      byId.set(id, cardFromOpenedNode(id, opened))
    } catch {
      byId.set(id, { id })
    }
  }))
  return byId
}

export async function attachCuesOnGroups(groups, loadOriginDoc, originMap, cardById) {
  const list = Array.isArray(groups) ? groups : []
  const cards = cardById instanceof Map ? cardById : new Map()
  return Promise.all(list.map(async (group) => {
    const rows = Array.isArray(group && group.items) ? group.items.filter((row) => row && typeof row === 'object') : []
    const items = await Promise.all(rows.map(async (item) => {
      const ids = namedCardIds(item)
      const stubs = ids.map((id) => {
        const listed = cards.get(id)
        if (listed && typeof listed === 'object') {
          return {
            ...listed,
            origin: originOfCard(listed) || originFromMap(originMap, id) || listed.origin,
          }
        }
        return {
          id,
          origin: originFromMap(originMap, id) || (id === item.id ? originOfCard(item) : ''),
          label: id === item.id ? item.label : '',
        }
      })
      const faced = await attachCuesOnCards(stubs, loadOriginDoc)
      const cues = []
      for (const card of faced) {
        const cue = cardCue(card)
        if (!cue) continue
        if (ids.includes(cue)) continue
        if (ids.some((id) => cue.includes(id))) continue
        if (!cues.includes(cue)) cues.push(cue)
      }
      return {
        ...item,
        cue: cues.join(' · '),
        named: faced.map((card) => ({
          id: card.id,
          cue: cardCue(card) && !ids.includes(cardCue(card)) && !ids.some((id) => cardCue(card).includes(id))
            ? cardCue(card)
            : '',
        })),
      }
    }))
    return { ...group, items }
  }))
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
        ...(extra.sessionId ? { sessionId: String(extra.sessionId) } : {}),
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
