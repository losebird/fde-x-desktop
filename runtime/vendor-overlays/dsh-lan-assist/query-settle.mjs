/**
 * Same utterance + same bound hop: one settled 现查. No duplicate preview round-trips.
 * @module dsh-lan-assist/query-settle
 */

function stableWhere(where) {
  if (!Array.isArray(where) || !where.length) return []
  return where.map((term) => {
    if (!term || typeof term !== 'object') return null
    const keys = (Array.isArray(term.keys) ? term.keys : []).map(String).sort()
    const values = (Array.isArray(term.values) ? term.values : []).map(String).sort()
    const dateBefore = (Array.isArray(term.dateBefore) ? term.dateBefore : []).map(String).sort()
    const dateAfter = (Array.isArray(term.dateAfter) ? term.dateAfter : []).map(String).sort()
    return {
      keys,
      values,
      not: !!term.not,
      dateBefore,
      dateAfter,
    }
  }).filter(Boolean)
}

function stableSteps(steps) {
  if (!Array.isArray(steps) || !steps.length) return []
  return steps.map((step) => {
    if (!step || typeof step !== 'object') return null
    return {
      kind: String(step.kind || '').trim(),
      no: String(step.no || '').trim(),
      from: String(step.from || '').trim(),
      relation: String(step.relation || '').trim(),
      join: String(step.join || '').trim() === 'or' ? 'or' : 'and',
      where: stableWhere(step.where),
    }
  }).filter(Boolean)
}

function stableFrom(from) {
  if (!from || typeof from !== 'object' || Array.isArray(from)) return null
  const kind = String(from.kind || '').trim()
  if (!kind) return null
  return {
    kind,
    no: String(from.no || '').trim(),
    where: stableWhere(from.where),
  }
}

function planBind(plan, spec = {}) {
  const targetStep = (plan && plan.steps && plan.steps[plan.targetIndex])
    || (plan && plan.steps && plan.steps[0])
  const startStep = plan && plan.steps && plan.steps[0]
  const listWhere = (targetStep && targetStep.where && targetStep.where.length)
    ? targetStep.where
    : (Array.isArray(spec.where) && spec.where.length ? spec.where : [])
  const hopWhere = (plan && plan.steps && plan.steps.length > 1 && startStep && startStep.where && startStep.where.length)
    ? startStep.where
    : []
  return { listWhere, hopWhere }
}

/** Stable hop bind key: utterance + target kind + bound steps/where/from + page. */
export function settledHopKey(ctx = {}) {
  const sessionId = String(ctx.sessionId || '').trim()
  const workspace = String(ctx.workspace || '').trim()
  const speech = String(ctx.speech || '').trim()
  const targetKind = String(ctx.targetKind || '').trim()
  const plan = ctx.plan && typeof ctx.plan === 'object' ? ctx.plan : {}
  const spec = ctx.spec && typeof ctx.spec === 'object' ? ctx.spec : {}
  const page = Number(plan.page) > 0 ? Math.floor(Number(plan.page)) : 1
  const lookupNo = String(plan.no || spec.no || '').trim()
  const { listWhere, hopWhere } = planBind(plan, spec)
  const payload = {
    speech,
    targetKind,
    lookupNo,
    page,
    steps: stableSteps(plan.steps),
    listWhere: stableWhere(listWhere),
    hopWhere: stableWhere(hopWhere),
    from: stableFrom(spec.from),
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

const SETTLED_REPEAT_NOTE = '这一句这一跳现查已结算，表在业务页，不要重复 preview。'

export function materializeSettledRepeat(cached) {
  if (!cached || typeof cached !== 'object') return cached
  const prior = String(cached.speak || sheetOf(cached)?.speak || '').trim()
  const speak = prior.includes('已结算')
    ? prior
    : `${prior}${/。$/.test(prior) || !prior ? '' : '。'}${SETTLED_REPEAT_NOTE}`
  const sheet = sheetOf(cached)
  const nextSheet = sheet
    ? { ...sheet, speak, querySettledRepeat: true, error: 'QUERY_SETTLED' }
    : sheet
  return {
    ...cached,
    ok: true,
    error: 'QUERY_SETTLED',
    querySettledRepeat: true,
    speak,
    ...(nextSheet ? { sheet: nextSheet } : {}),
  }
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
