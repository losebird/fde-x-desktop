/**
 * First-turn Host flip: route_intent then maybe one search.
 * Result is a compact recall card, not a graph dump into system rules.
 * @module dsh-semantic-os/first-turn
 */

import { loadSpokenSeed, speechHasConnectorLookup, speechHasSpokenRole } from '../dsh-lan-assist/live-write-intent.mjs'
import { speechHoldsWorkstationWrite } from '../dsh-lan-assist/slots.js'

const SEARCH_INTENTS = new Set(['查询', '出处', '催待办'])
const CARD_CAP = 1600
const HIT_CAP = 4
const SNIP = 180
const spokenSeed = loadSpokenSeed()

function hasRole(text, role) {
  return speechHasSpokenRole(text, spokenSeed, role)
}

export function routeIntent(text) {
  const raw = String(text || '').trim()
  if (!raw) return { intent: '闲聊', tool: '' }
  if (hasRole(raw, '出处')) return { intent: '出处', tool: 'lineage' }
  if (hasRole(raw, '定了') && !hasRole(raw, '拍板')) return { intent: '查询', tool: 'search_text' }
  if (hasRole(raw, '拍板')) return { intent: '拍板', tool: 'brief_for_decision' }
  if (hasRole(raw, '记忆卡')) return { intent: '查询', tool: 'list_memory_cards' }
  if (speechHoldsWorkstationWrite(raw)) return { intent: '现况', tool: 'biz_preview' }
  if (speechHasConnectorLookup(raw, spokenSeed)) return { intent: '现况', tool: 'biz_preview' }
  if (hasRole(raw, '业务动作')) return { intent: '业务动作', tool: 'brief_for_decision' }
  if (hasRole(raw, '过账') && hasRole(raw, '过账帮忙')) return { intent: '业务动作', tool: 'brief_for_decision' }
  if (hasRole(raw, '催待办')) return { intent: '催待办', tool: 'search_text' }
  if (hasRole(raw, '闲聊')) return { intent: '闲聊', tool: '' }
  return { intent: '查询', tool: 'search_text' }
}

export function needsSearch(intent) {
  return SEARCH_INTENTS.has(String(intent || ''))
}

export function userSpeechFromEvent(event) {
  if (!event || event.type !== 'user/message') return ''
  return speechFromUserMessage(event.data || {})
}

export function speechFromUserMessage(message) {
  if (!message || typeof message !== 'object') return ''
  const source = message.source || {}
  if (source.kind && source.kind !== 'user') return ''
  if (source.plugin) return ''
  return textFromContent(message.content)
}

export function resolveFirstTurnSpeech({ events, remembered } = {}) {
  return firstHumanSpeech(events) || String(remembered || '').trim()
}

function textFromContent(content) {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  return content.map((part) => {
    if (!part) return ''
    if (typeof part === 'string') return part
    if (part.type === 'text' && typeof part.text === 'string') return part.text
    return ''
  }).join('').trim()
}

export function firstHumanSpeech(events) {
  const list = Array.isArray(events) ? events : []
  const lines = []
  for (const event of list) {
    const text = userSpeechFromEvent(event)
    if (text) lines.push(text)
  }
  if (lines.length !== 1) return ''
  return lines[0]
}

export function clipHit(row) {
  const node = row && row.node && typeof row.node === 'object' ? row.node : {}
  const id = String(node.id || '')
  const raw = String(node.content || (node.properties && node.properties.content) || '')
  const then = row && row.then && row.then.label ? String(row.then.label) : ''
  const grade = row && row.knowledge_grade ? String(row.knowledge_grade) : ''
  const snippet = raw.replace(/\s+/g, ' ').trim().slice(0, SNIP)
  if (!id || !snippet) return ''
  const marks = [then, grade].filter(Boolean).join(' · ')
  return `- ${id}${marks ? ` · ${marks}` : ''}\n  ${snippet}`
}

export function formatHandoff({ intent, tool, hits, sessionId }) {
  const lines = [
    '本回合 Host 已代调（工具回执，不是把图灌进 system）。',
    `intent: ${intent || ''}`,
    `tool: ${tool || '（不开检索）'}`,
  ]
  if (sessionId) lines.push(`session: ${sessionId}`)
  const packed = Array.isArray(hits) ? hits.map(clipHit).filter(Boolean).slice(0, HIT_CAP) : []
  if (packed.length) {
    lines.push('hits:')
    lines.push(...packed)
  } else if (needsSearch(intent)) {
    lines.push('hits: （这一拍没有摘录）')
  }
  const text = lines.join('\n').trim()
  return text.length <= CARD_CAP ? text : `${text.slice(0, CARD_CAP - 1)}…`
}

export function parseSearchHits(packed) {
  let data = packed
  if (typeof packed === 'string') {
    try { data = JSON.parse(packed) } catch { return [] }
  }
  if (!data || typeof data !== 'object' || data.error) return []
  return Array.isArray(data.results) ? data.results : []
}

export function eventsFromAssembleContext(context) {
  const session = (context && context.agent && context.agent.session)
    || (context && context.session)
    || null
  if (session && Array.isArray(session.events)) return session.events
  if (context && Array.isArray(context.events)) return context.events
  if (context && Array.isArray(context.messages)) return context.messages
  return []
}

export function sessionIdFromAssembleContext(context) {
  const session = (context && context.agent && context.agent.session) || (context && context.session) || null
  return String((session && (session.id || session.sessionId)) || (context && context.sessionId) || '').trim()
}

export async function flipFirstTurn({ text, search }) {
  const routed = routeIntent(text)
  let hits = []
  if (needsSearch(routed.intent) && typeof search === 'function') {
    try {
      hits = parseSearchHits(await search(String(text || '').trim(), routed))
    } catch {
      hits = []
    }
  }
  return { ...routed, hits }
}

export function createFirstTurnCache() {
  /** @type {Map<string, { speech: string, card: string, wait: Promise<string> | null }>} */
  const map = new Map()

  function peek(sessionId) {
    const hit = map.get(String(sessionId || ''))
    return hit && hit.card ? hit.card : ''
  }

  function speechOf(sessionId) {
    const hit = map.get(String(sessionId || ''))
    return hit && hit.speech ? hit.speech : ''
  }

  function noteSpeech(sessionId, speech) {
    const id = String(sessionId || '').trim()
    const line = String(speech || '').trim()
    if (!id || !line) return
    const hit = map.get(id)
    if (hit && hit.speech) return
    map.set(id, { speech: line, card: (hit && hit.card) || '', wait: (hit && hit.wait) || null })
  }

  async function ensure(sessionId, speech, search) {
    const id = String(sessionId || '').trim()
    const line = String(speech || '').trim()
    if (!id || !line) return ''
    const hit = map.get(id)
    if (hit && hit.card) return hit.card
    if (hit && hit.wait) return hit.wait
    let settle
    const wait = new Promise((resolve) => { settle = resolve })
    map.set(id, { speech: line, card: '', wait })
    try {
      const flipped = await flipFirstTurn({ text: line, search })
      const card = formatHandoff({ ...flipped, sessionId: id })
      map.set(id, { speech: line, card, wait: null })
      settle(card)
      return card
    } catch {
      map.set(id, { speech: line, card: '', wait: null })
      settle('')
      return ''
    }
  }

  return { peek, ensure, noteSpeech, speechOf }
}
