/** Dreaming proofread: card vs origin transcript. Read-only scan; writes stay 起草. */

import { cardIsRetired } from './cards.mjs'
import { hostSourceOf, originOfCard, sessionIdOf } from './identity.mjs'

export const PROOFREAD_KIND = '与出处不符'
export const PROOFREAD_SCAN_CAP = 20
export const PROOFREAD_ISSUE_CAP = 12

const DENY_MARK = /未读到|没有该|0 条|NOT_FOUND|找不到该|不存在该/
const REVISE_MARK = /格式|连字符|库里是|其实是|应为|不是未读到|单号无连字符|对不上/
const HIT_MARK = /命中|已找到|预览成功|条记录|\brows\b/
const SELF_DRAFT = /出处与卡片不一致/

function clip(text, cap) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  if (raw.length <= cap) return raw
  return `${raw.slice(0, Math.max(0, cap - 1)).trim()}…`
}

export function cardSpeech(card) {
  const row = card && typeof card === 'object' ? card : {}
  return String(row.body || row.content || row.label || '').trim()
}

export function originSpeech(doc) {
  const row = doc && typeof doc === 'object' ? doc : {}
  return String(row.text || row.title || '').trim()
}

export function proofreadConflict(cardText, originText) {
  const card = String(cardText || '')
  const origin = String(originText || '')
  if (!card || !origin) return ''
  if (SELF_DRAFT.test(card)) return ''
  if (DENY_MARK.test(card) && REVISE_MARK.test(origin)) return '卡写未读到，出处在改口径（格式/单号）'
  if (DENY_MARK.test(card) && !DENY_MARK.test(origin) && HIT_MARK.test(origin)) return '卡写未读到，出处里有命中'
  return ''
}

export function formatProofreadDraft({ cardId, origin, cardText, reason }) {
  const trap = clip(cardText, 80)
  const known = [origin, cardId ? `旧卡 ${cardId}` : ''].filter(Boolean).join(' ；')
  return [
    '规则：出处与卡片不一致；以出处为准，不沿用卡上的旧结论。',
    known ? `怎么知道：${known}` : '',
    `陷阱：${reason || '与出处不符'}。${trap}`.trim(),
    '未证实：待现查',
  ].filter(Boolean).join('\n')
}

export function proofreadIssue(card, originDoc) {
  const row = card && typeof card === 'object' ? card : {}
  const id = String(row.id || '').trim()
  if (!id || cardIsRetired(row)) return null
  const origin = hostSourceOf(originOfCard(row) || row.origin || row.source)
  if (!origin.startsWith('session:') && !origin.startsWith('file:')) return null
  const reason = proofreadConflict(cardSpeech(row), originSpeech(originDoc))
  if (!reason) return null
  const draft = formatProofreadDraft({
    cardId: id,
    origin,
    cardText: cardSpeech(row),
    reason,
  })
  return {
    id,
    kind: PROOFREAD_KIND,
    label: reason,
    origin,
    draft,
    type: 'replaces',
    sessionId: sessionIdOf(origin),
    actions: [
      { op: 'open', id },
      { op: 'correct', id },
    ],
  }
}

export function proofreadGroup(issues) {
  const items = Array.isArray(issues) ? issues.filter((row) => row && row.id) : []
  return {
    kind: PROOFREAD_KIND,
    count: items.length,
    items,
    has_more: false,
    empty: items.length === 0,
    actions: [],
  }
}

export async function scanProofreadIssues(cards, loadOrigin, cap = PROOFREAD_ISSUE_CAP) {
  const limit = Number.isFinite(Number(cap)) && Number(cap) > 0 ? Math.min(Number(cap), PROOFREAD_ISSUE_CAP) : PROOFREAD_ISSUE_CAP
  const list = Array.isArray(cards) ? cards.filter((row) => row && typeof row === 'object') : []
  const denyFirst = []
  const rest = []
  for (const card of list) {
    if (DENY_MARK.test(cardSpeech(card))) denyFirst.push(card)
    else rest.push(card)
  }
  const ordered = denyFirst.concat(rest)
  const load = typeof loadOrigin === 'function' ? loadOrigin : null
  const issues = []
  let scanned = 0
  for (const card of ordered) {
    if (issues.length >= limit) break
    if (scanned >= PROOFREAD_SCAN_CAP) break
    const origin = hostSourceOf(originOfCard(card) || card.origin || card.source)
    if (!origin) continue
    scanned += 1
    if (!load) continue
    let doc
    try { doc = await load(origin) } catch { continue }
    const issue = proofreadIssue(card, doc)
    if (issue) issues.push(issue)
  }
  return issues
}
