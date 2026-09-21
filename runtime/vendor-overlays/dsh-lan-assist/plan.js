/**
 * Structured business plan. The gate executes this; speech is evidence only.
 * @module dsh-lan-assist/plan
 */

import { normalizeAliasWhere } from './where-pass.js'

export const PAGE_SIZE = 20
export const BATCH_LIMIT = 100
/** @deprecated Prefer each kind's `can`; kept for callers that union catalog actions. */
export const PLAN_ACTIONS = ['现查', '改行', '删除', '新建', '过审']

function list(value) {
  return (Array.isArray(value) ? value : []).map((item) => String(item || '').trim()).filter(Boolean)
}

function normalizeTerm(raw) {
  if (!raw || typeof raw !== 'object') return null
  const keys = list(raw.keys)
  const values = list(raw.values)
  const dateBefore = list(raw.dateBefore)
  const dateAfter = list(raw.dateAfter)
  if (!keys.length && !values.length && !dateBefore.length && !dateAfter.length) return null
  return {
    keys,
    values,
    not: !!raw.not,
    dateBefore,
    dateAfter,
  }
}

function normalizeWhere(raw) {
  return normalizeAliasWhere(raw).map(normalizeTerm).filter(Boolean)
}

function normalizeStep(raw, fallbackKind) {
  const row = raw && typeof raw === 'object' ? raw : {}
  return {
    kind: String(row.kind || fallbackKind || '').trim(),
    no: String(row.no || '').trim(),
    where: normalizeWhere(row.where),
    from: String(row.from || '').trim(),
    relation: String(row.relation || '').trim(),
    join: String(row.join || '').trim() === 'or' ? 'or' : 'and',
  }
}

function flattenFromChain(from) {
  const parts = []
  const seen = new Set()
  let cur = from && typeof from === 'object' && !Array.isArray(from) ? from : null
  while (cur) {
    const kind = String(cur.kind || '').trim()
    if (!kind || seen.has(kind)) break
    seen.add(kind)
    parts.push(cur)
    const nested = cur.from
    cur = nested && typeof nested === 'object' && !Array.isArray(nested) && String(nested.kind || '').trim()
      ? nested
      : null
  }
  return parts
}

function defaultSteps(spec, where) {
  const kind = String(spec.kind || '').trim()
  const from = spec.from && typeof spec.from === 'object' ? spec.from : null
  const chain = flattenFromChain(from)
  if (!chain.length) {
    const fromKind = String((from && from.kind) || spec.fromKind || '').trim()
    if (fromKind) {
      chain.push({
        kind: fromKind,
        no: from && from.no,
        where: (from && from.where) || spec.fromWhere,
        join: from && from.join,
      })
    }
  }
  if (chain.length) {
    const steps = chain.map((row, index) => normalizeStep({
      kind: row.kind,
      no: row.no,
      where: row.where,
      from: index > 0 ? chain[index - 1].kind : '',
      relation: row.relation,
      join: row.join,
    }, row.kind))
    if (kind && kind !== steps[steps.length - 1].kind) {
      steps.push(normalizeStep({
        kind,
        no: spec.no,
        where,
        from: steps[steps.length - 1].kind,
        relation: (from && from.relation) || spec.relation || spec.via,
      }, kind))
    } else if (kind && steps.length) {
      const last = steps[steps.length - 1]
      steps[steps.length - 1] = normalizeStep({
        ...last,
        no: spec.no || last.no,
        where: where.length ? where : last.where,
      }, kind)
    }
    return steps.filter((step) => step.kind)
  }
  const steps = []
  if (kind) steps.push(normalizeStep({ kind, no: spec.no, where }, kind))
  return steps
}

/**
 * Copy structured slots. Never reads speech to invent kind, where, or patch.
 */
export function normalizePlan(spec = {}) {
  const actionRaw = String(spec.action || '').trim()
  const action = actionRaw || '现查'
  const where = normalizeWhere(spec.where)
  const steps = Array.isArray(spec.steps) && spec.steps.length
    ? spec.steps.map((row) => normalizeStep(row, spec.kind)).filter((step) => step.kind)
    : defaultSteps(spec, where)
  const structured = !!(
    (Array.isArray(spec.where) && spec.where.length)
    || (spec.from && typeof spec.from === 'object' && (spec.from.kind || spec.from.where))
    || (Array.isArray(spec.steps) && spec.steps.length)
    || String(spec.fromKind || '').trim()
  )
  return {
    action,
    speech: String(spec.speech || spec.quote || '').trim(),
    steps,
    targetIndex: steps.length ? steps.length - 1 : 0,
    patch: spec.patch && typeof spec.patch === 'object' && !Array.isArray(spec.patch) ? { ...spec.patch } : {},
    no: String(spec.no || spec.ticket || '').trim(),
    line: String(spec.line || spec.行号 || '').trim(),
    structured,
    filterRefused: spec.filterRefused === true,
    contradicts: spec.contradicts === true,
    page: Number(spec.page) > 0 ? Math.floor(Number(spec.page)) : 1,
  }
}

export function cluesFromWhere(where, join) {
  const terms = normalizeWhere(where)
  return {
    terms,
    rest: '',
    join: join === 'or' ? 'or' : 'and',
  }
}

export function bindPatchEnums(patch, schemaFields) {
  const next = { ...(patch && typeof patch === 'object' ? patch : {}) }
  for (const [key, value] of Object.entries(next)) {
    const want = String(value ?? '').trim()
    if (!want) continue
    const row = (Array.isArray(schemaFields) ? schemaFields : []).find((item) => String((item && item.name) || '') === key)
    if (!row) continue
    const packed = (row.enums && typeof row.enums === 'object' && !Array.isArray(row.enums))
      ? row.enums
      : null
    if (!packed) continue
    for (const [code, label] of Object.entries(packed)) {
      if (String(code) === want || String(label || '') === want) {
        next[key] = code
        break
      }
    }
  }
  return next
}
