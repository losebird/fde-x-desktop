/** Case-file index cards. Read-only cluster; writes stay 起草. No edges. */

import { cardIsRetired } from './cards.mjs'
import { hostSourceOf, originOfCard } from './identity.mjs'

export const DOSSIER_KIND = '案卷索引'
export const DOSSIER_LINK_KIND = '案卷连边'
export const DOSSIER_CAP = 8
export const DOSSIER_BODY_CAP = 800
export const DOSSIER_EDGE_TYPES = new Set(['confirms', 'enriches'])

const PO_KEY = /\bPO-?\d{6,}\b/gi
const TICKET_KEY = /工单[:：#]?\s*([A-Z0-9-]{4,})/gi
const LIVE_MARK = /现查|库存余额|此刻库存/

function clip(text, cap) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  if (raw.length <= cap) return raw
  return `${raw.slice(0, Math.max(0, cap - 1)).trim()}…`
}

export function cardSpeech(card) {
  const row = card && typeof card === 'object' ? card : {}
  return String(row.body || row.content || row.label || row.cue || '').trim()
}

export function normalizeDossierKey(raw) {
  const text = String(raw || '').trim().toUpperCase()
  if (!text) return ''
  const po = /^PO-?(\d{6,})$/.exec(text.replace(/\s/g, ''))
  if (po) return `PO-${po[1]}`
  return text
}

export function extractDossierKeys(text) {
  const raw = String(text || '')
  const keys = []
  const push = (value) => {
    const key = normalizeDossierKey(value)
    if (key && !keys.includes(key)) keys.push(key)
  }
  for (const match of raw.matchAll(PO_KEY)) push(match[0])
  for (const match of raw.matchAll(TICKET_KEY)) push(match[1])
  return keys
}

function isIndexCard(card) {
  return Boolean(dossierKeyFromIndex(card))
}

export function dossierKeyFromIndex(card) {
  const first = (cardSpeech(card).split('\n')[0] || '').trim()
  const matched = /^规则：(.+?)\s*案卷/.exec(first)
  return matched ? normalizeDossierKey(matched[1]) : ''
}

export function suggestDossierEdge(newer, older) {
  const a = String(newer || '').toLowerCase().replace(/\s+/g, '')
  const b = String(older || '').toLowerCase().replace(/\s+/g, '')
  if (a.length < 4 || b.length < 4) return 'enriches'
  let score = 0
  if (a.includes(b) || b.includes(a)) score = 1
  else {
    const window = 4
    const total = Math.max(a.length - window + 1, 1)
    let hits = 0
    for (let i = 0; i <= a.length - window; i += 1) {
      if (b.includes(a.slice(i, i + window))) hits += 1
    }
    score = hits / total
  }
  if (score >= 0.6) return 'confirms'
  return 'enriches'
}

function isLiveOnly(card) {
  return LIVE_MARK.test(cardSpeech(card)) && extractDossierKeys(cardSpeech(card)).length === 0
}

export function formatDossierDraft({ key, members }) {
  const rows = Array.isArray(members) ? members.filter((row) => row && row.id) : []
  const known = rows.map((row) => {
    const origin = hostSourceOf(originOfCard(row) || row.origin || row.source)
    return origin ? `${row.id} ${origin}` : String(row.id)
  }).join(' ；')
  const draft = [
    `规则：${key} 案卷`,
    known ? `怎么知道：${known}` : '',
    '陷阱：键对不上就停；现查走连接器，不把档案当现在。',
    '未证实：未点头的成员不是依据。',
  ].filter(Boolean).join('\n')
  return draft.length <= DOSSIER_BODY_CAP ? draft : `${draft.slice(0, DOSSIER_BODY_CAP - 1).trim()}…`
}

export function clusterDossierMembers(cards) {
  const groups = new Map()
  for (const card of Array.isArray(cards) ? cards : []) {
    if (!card || typeof card !== 'object') continue
    if (String(card.status || '') !== '已入档') continue
    if (cardIsRetired(card) || isIndexCard(card) || isLiveOnly(card)) continue
    const id = String(card.id || '').trim()
    if (!id) continue
    for (const key of extractDossierKeys(cardSpeech(card))) {
      const list = groups.get(key) || []
      if (!list.some((row) => row.id === id)) list.push(card)
      groups.set(key, list)
    }
  }
  return groups
}

export function dossierIssue(key, members) {
  const rows = Array.isArray(members) ? members.filter((row) => row && row.id) : []
  if (rows.length < 2) return null
  const draft = formatDossierDraft({ key, members: rows })
  const first = rows[0]
  const origin = hostSourceOf(originOfCard(first) || first.origin || first.source)
  return {
    id: String(first.id),
    key,
    kind: DOSSIER_KIND,
    label: `${key} 案卷 · ${rows.length} 张已入档`,
    origin,
    draft,
    members: rows.map((row) => String(row.id)),
    actions: [
      { op: 'open', id: String(first.id) },
      { op: 'index', key, id: String(first.id) },
    ],
  }
}

export function scanDossierIssues(cards, cap = DOSSIER_CAP) {
  const limit = Number.isFinite(Number(cap)) && Number(cap) > 0 ? Math.min(Number(cap), DOSSIER_CAP) : DOSSIER_CAP
  const groups = clusterDossierMembers(cards)
  const issues = []
  for (const [key, members] of groups) {
    if (issues.length >= limit) break
    const issue = dossierIssue(key, members)
    if (issue) issues.push(issue)
  }
  return issues
}

export function dossierGroup(issues, kind = DOSSIER_KIND) {
  const items = Array.isArray(issues) ? issues.filter((row) => row && row.id) : []
  return {
    kind,
    count: items.length,
    items,
    has_more: false,
    empty: items.length === 0,
    actions: [],
  }
}

export function scanDossierLinkIssues(cards, existing = [], cap = DOSSIER_CAP) {
  const limit = Number.isFinite(Number(cap)) && Number(cap) > 0 ? Math.min(Number(cap), DOSSIER_CAP) : DOSSIER_CAP
  const linked = new Set()
  for (const edge of Array.isArray(existing) ? existing : []) {
    const src = String(edge && edge.source || '').trim()
    const tgt = String(edge && edge.target || '').trim()
    if (src && tgt) linked.add(`${src}\0${tgt}`)
  }
  const membersByKey = clusterDossierMembers(cards)
  const issues = []
  for (const card of Array.isArray(cards) ? cards : []) {
    if (issues.length >= limit) break
    const key = dossierKeyFromIndex(card)
    const indexId = String(card && card.id || '').trim()
    if (!key || !indexId) continue
    const members = (membersByKey.get(key) || []).filter((row) => String(row.id) !== indexId)
    const pending = members.filter((row) => !linked.has(`${indexId}\0${row.id}`))
    if (!pending.length) continue
    issues.push({
      id: indexId,
      key,
      kind: DOSSIER_LINK_KIND,
      label: `${key} 连边 · ${pending.length} 张成员`,
      members: pending.map((row) => String(row.id)),
      links: pending.map((row) => ({
        source: indexId,
        target: String(row.id),
        type: suggestDossierEdge(cardSpeech(card), cardSpeech(row)),
      })),
      actions: [
        { op: 'open', id: indexId },
        { op: 'link_group', key, id: indexId, members: pending.map((row) => String(row.id)) },
      ],
    })
  }
  return issues
}
