/** Low-risk auto-file: promote 起草 → 已入档 without a human click. Conflicts stay 起草. */

import { memoryWriteOriginByCardIds } from '../db.mjs'
import { hostSourceOf, originOfCard } from './identity.mjs'

export const AUTOFILE_SCAN_CAP = 20

const HIGH_RISK_RULE = /未放行|不过账|不要过账|未读到|NOT_FOUND|不要 biz_write/
const CONFLICT_MARK = /出处与卡片不一致/
const INDEX_MARK = /案卷/

function ruleLineOf(label) {
  const lines = String(label || '').split('\n').map((row) => row.trim()).filter(Boolean)
  return lines.find((row) => row.startsWith('规则：')) || lines[0] || ''
}

export function originFromLabel(label) {
  const line = String(label || '').split('\n').find((row) => row.trim().startsWith('怎么知道：')) || ''
  const matched = line.match(/session:[^\s；]+|file:[^\s；]+/u)
  return hostSourceOf(matched ? matched[0] : '')
}

export function isLowRiskAutoFile(input = {}) {
  const label = String(input.label || input.body || '').trim()
  if (!label.includes('规则：') || !label.includes('怎么知道：')) return false
  if (CONFLICT_MARK.test(label)) return false
  const rawOrigin = String(input.origin || '').trim()
  if (rawOrigin && !hostSourceOf(rawOrigin)) return false
  const origin = hostSourceOf(rawOrigin) || originFromLabel(label)
  if (!origin.startsWith('session:') && !origin.startsWith('file:')) return false
  const rule = ruleLineOf(label)
  if (INDEX_MARK.test(rule)) return true
  if (HIGH_RISK_RULE.test(rule)) return false
  return true
}

function cardLabel(card) {
  const row = card && typeof card === 'object' ? card : {}
  return String(row.body || row.content || row.label || '').trim()
}

export async function fileLowRiskDrafts(deps, input = {}) {
  const cwd = String(input.cwd || input.workspaceCwd || '').trim()
  const limit = Number.isFinite(Number(input.limit)) && Number(input.limit) > 0
    ? Math.min(Number(input.limit), AUTOFILE_SCAN_CAP)
    : AUTOFILE_SCAN_CAP
  const aiRuntime = deps && deps.aiRuntime
  if (!cwd || !aiRuntime || typeof aiRuntime.semanticOs !== 'function') {
    return { ok: false, filed: [], scanned: 0 }
  }
  if (!aiRuntime.status?.().connected) return { ok: false, filed: [], scanned: 0, reason: 'semantic_down' }
  let listed
  try {
    listed = await aiRuntime.semanticOs('/python', {
      op: 'list_memory_cards',
      args: { limit: 80 },
      cwd,
    })
  } catch {
    return { ok: false, filed: [], scanned: 0 }
  }
  const rows = Array.isArray(listed?.cards) ? listed.cards : []
  const drafts = rows.filter((row) => {
    const status = String(row && row.status || '起草')
    return status === '起草' || status === ''
  })
  const ids = drafts.map((row) => String(row.id || '')).filter(Boolean)
  const originMap = deps.db ? memoryWriteOriginByCardIds(deps.db, ids) : new Map()
  const filed = []
  let scanned = 0
  for (const card of drafts) {
    if (filed.length >= limit) break
    scanned += 1
    const id = String(card.id || '').trim()
    if (!id) continue
    const origin = hostSourceOf(originOfCard(card) || (originMap instanceof Map ? originMap.get(id) : '') || card.origin || card.source) || originFromLabel(cardLabel(card))
    if (!isLowRiskAutoFile({ label: cardLabel(card), origin })) continue
    try {
      const nod = await aiRuntime.semanticOs('/python', {
        op: 'nod_memory_card',
        args: { id, nodded: true },
        cwd,
      })
      if (nod && typeof nod === 'object' && !nod.error && nod.ok !== false) filed.push(id)
    } catch {
      /* keep 起草 */
    }
  }
  return { ok: true, filed, scanned }
}
