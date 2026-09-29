/**
 * Same utterance + same bound hop: one settled 现查. No duplicate preview round-trips.
 * @module dsh-lan-assist/query-settle
 */

import { planReceipt } from './plan-receipt.mjs'

function whereShape(where) {
  const list = Array.isArray(where) ? where : []
  return list.map((term) => {
    const keys = (Array.isArray(term && term.keys) ? term.keys : []).map((item) => String(item || '')).sort()
    const values = (Array.isArray(term && term.values) ? term.values : []).map((item) => String(item || '')).sort()
    return { keys, values }
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
}

function fromHopChain(node) {
  const hops = []
  const seen = new Set()
  let cur = node
  while (cur && typeof cur === 'object' && !Array.isArray(cur)) {
    const kind = String(cur.kind || '').trim()
    if (!kind || seen.has(kind)) break
    seen.add(kind)
    hops.push({ kind, where: whereShape(cur.where) })
    cur = cur.from
  }
  return hops
}

function hopShape(ctx = {}) {
  const plan = ctx.plan && typeof ctx.plan === 'object' ? ctx.plan : {}
  const spec = ctx.spec && typeof ctx.spec === 'object' ? ctx.spec : {}
  const from = plan.from && typeof plan.from === 'object' && String(plan.from.kind || '').trim()
    ? plan.from
    : (spec.from && typeof spec.from === 'object' ? spec.from : null)
  const fromKind = String((from && from.kind) || '').trim()
  const steps = Array.isArray(plan.steps)
    ? plan.steps.map((step) => {
      const kind = String((step && step.kind) || '').trim()
      if (!kind) return null
      return { kind, where: whereShape(step && step.where) }
    }).filter(Boolean)
    : []
  const fromWhere = whereShape(from && from.where)
  const hopWhere = whereShape(plan.hopWhere || spec.hopWhere)
  const fromHops = fromHopChain(from)
  return { fromKind, steps, fromWhere, hopWhere, fromHops }
}

/** Same utterance + same hop (kinds and bound where on each step / from / page). */
export function settledHopKey(ctx = {}) {
  const sessionId = String(ctx.sessionId || '').trim()
  const workspace = String(ctx.workspace || '').trim()
  const speech = String(ctx.userSpeech || ctx.utterance || '').trim()
    || String(ctx.speech || '').trim()
  const targetKind = String(ctx.targetKind || '').trim()
  const plan = ctx.plan && typeof ctx.plan === 'object' ? ctx.plan : {}
  const page = Number(plan.page) > 0 ? Math.floor(Number(plan.page)) : 1
  const shape = hopShape(ctx)
  const payload = {
    speech,
    targetKind,
    page,
    fromKind: shape.fromKind,
    steps: shape.steps,
    fromWhere: shape.fromWhere,
    hopWhere: shape.hopWhere,
    fromHops: shape.fromHops,
  }
  return `${sessionId}\0${workspace}\0${JSON.stringify(payload)}`
}

function sheetOf(result) {
  if (!result || typeof result !== 'object') return null
  return (result.sheet && typeof result.sheet === 'object') ? result.sheet : result
}

function sheetCarriesIdentity(sheet) {
  if (!sheet || typeof sheet !== 'object') return false
  if (String(sheet.lookupNo || '').trim()) return true
  const where = sheet.where ?? sheet.listWhere
  if (Array.isArray(where) && where.length) return true
  if (Array.isArray(sheet.hopWhere) && sheet.hopWhere.length) return true
  const from = sheet.from
  if (from && typeof from === 'object' && !Array.isArray(from) && String(from.kind || '').trim()) return true
  if (Array.isArray(sheet.steps) && sheet.steps.length) return true
  return false
}

/** Ok 现查 with object-set accounting — not a write preview or pick-wait list. */
export function previewSettledLookup(result) {
  if (!result || typeof result !== 'object' || result.ok === false) return false
  const sheet = sheetOf(result)
  if (!sheet) return false
  const action = String(result.action || sheet.action || '').trim()
  if (action !== '现查') return false
  if (String(result.preview_id || sheet.preview_id || sheet.previewId || '').trim()) return false
  if (sheet.picked === true) return false
  if (sheet.querySettled !== true) return false
  if (sheet.columnMiss === true) return false
  if (sheet.askAction && !sheetCarriesIdentity(sheet)) return false
  if (sheet.ambiguous && !sheet.querySettled) return false
  return sheetCarriesIdentity(sheet) || sheet.querySettled === true
}

export function materializeSettledRepeat(cached) {
  return planReceipt(cached, { settledRepeat: true })
}

export function createSettledQueryStore(max = 48) {
  const byKey = new Map()
  function touch(key, value) {
    if (byKey.has(key)) byKey.delete(key)
    byKey.set(key, value)
    while (byKey.size > max) {
      const oldest = byKey.keys().next().value
      byKey.delete(oldest)
    }
  }
  return {
    get(key) {
      const hit = byKey.get(key)
      if (hit == null) return null
      byKey.delete(key)
      byKey.set(key, hit)
      return hit
    },
    set(key, value) {
      touch(key, value)
    },
  }
}
