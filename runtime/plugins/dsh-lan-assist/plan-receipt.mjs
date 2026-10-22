/**
 * Model-facing biz_preview receipt. Official sheet stays on the workstation.
 * @module dsh-lan-assist/plan-receipt
 */

import { PAGE_SIZE } from './plan.js'

export const SETTLED_REPEAT_NOTE = '这一句这一跳现查已结算，表在业务页，不要重复 preview。'

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function text(value) {
  return String(value || '').trim()
}

function receiptWhere(where) {
  return Array.isArray(where) && where.length ? where : undefined
}

function receiptFrom(from) {
  const node = asObject(from)
  if (!node) return undefined
  const kind = text(node.kind)
  if (!kind) return undefined
  const nested = receiptFrom(node.from)
  const where = receiptWhere(node.where)
  const no = text(node.no)
  const relation = text(node.relation)
  return {
    kind,
    ...(where ? { where } : {}),
    ...(no ? { no } : {}),
    ...(relation ? { relation } : {}),
    ...(nested ? { from: nested } : {}),
  }
}

function receiptSteps(steps) {
  if (!Array.isArray(steps) || !steps.length) return undefined
  const out = []
  for (const step of steps) {
    const node = asObject(step)
    if (!node) continue
    const kind = text(node.kind)
    if (!kind) continue
    const where = receiptWhere(node.where)
    const no = text(node.no)
    const relation = text(node.relation)
    out.push({
      kind,
      ...(where ? { where } : {}),
      ...(no ? { no } : {}),
      ...(relation ? { relation } : {}),
    })
  }
  return out.length ? out : undefined
}

function receiptNos(result, sheet, cap) {
  const listed = []
  const push = (value) => {
    const no = text(value)
    if (no && !listed.includes(no)) listed.push(no)
  }
  if (Array.isArray(result && result.nos)) {
    for (const item of result.nos) {
      push(item)
      if (listed.length >= cap) return listed
    }
  }
  const rows = Array.isArray(result && result.matches) && result.matches.length
    ? result.matches
    : (sheet && Array.isArray(sheet.rows) ? sheet.rows : [])
  for (const row of rows) {
    push(row && typeof row === 'object' ? row.no : row)
    if (listed.length >= cap) return listed
  }
  return listed
}

function receiptHit(result, sheet) {
  const stateRaw = text((sheet && sheet.hitTotalState) || (result && result.hitTotalState))
  const hitTotalState = stateRaw === 'known' || stateRaw === 'incomplete' || stateRaw === 'unknown'
    ? stateRaw
    : ''
  const given = sheet && Object.prototype.hasOwnProperty.call(sheet, 'hitTotal')
    ? sheet.hitTotal
    : (result && result.hitTotal)
  const hitTotal = given != null && Number.isFinite(Number(given)) ? Number(given) : null
  return { hitTotalState, hitTotal }
}

function receiptPatch(result, sheet) {
  const patch = (result && asObject(result.patch)) || (sheet && asObject(sheet.patch)) || null
  if (!patch || !Object.keys(patch).length) return undefined
  return patch
}

/**
 * What the model should do after this call. Gate does not fill slots.
 * @param {object} result
 * @param {{ settledRepeat?: boolean }} [extra]
 */
export function planReceiptNext(result, extra = {}) {
  if (extra.settledRepeat === true) return 'stop'
  if (!result || typeof result !== 'object') return 'continue'
  if (result.error === 'QUERY_SETTLED' || result.querySettledRepeat === true) return 'stop'
  if (result.ok === false) return 'continue'
  const sheet = asObject(result.sheet)
  const action = text(result.action || (sheet && sheet.action))
  const previewId = text(
    result.preview_id
    || result.previewId
    || (sheet && (sheet.preview_id || sheet.previewId)),
  )
  const listed = Boolean(
    result.listed
    || result.ambiguous
    || (sheet && (sheet.listed || sheet.ambiguous)),
  )
  const blockConfirm = result.blockConfirm === true || (sheet && sheet.blockConfirm === true)
  const n = Array.isArray(result.matches) && result.matches.length
    ? result.matches.length
    : (sheet && Array.isArray(sheet.rows) ? sheet.rows.length : Number(result.n) || 0)
  const cells = Array.isArray(result.cells)
    ? result.cells
    : (sheet && Array.isArray(sheet.cells) ? sheet.cells : [])
  const hasPicks = cells.some((cell) => cell && Array.isArray(cell.picks) && cell.picks.length > 0)
  if (blockConfirm && hasPicks) return 'stop'
  if (blockConfirm) return 'continue'
  if (action && action !== '现查' && previewId) return 'confirm'
  if (action && action !== '现查' && listed && n >= 2 && !previewId) return 'pick-rows'
  if (action === '现查' && (result.querySettled === true || (sheet && sheet.querySettled === true) || listed || n > 0)) {
    return 'stop'
  }
  return 'continue'
}

/**
 * Slim plan receipt for the chat tool result. Never carries row bodies.
 * @param {object} result
 * @param {{ settledRepeat?: boolean }} [extra]
 */
export function planReceipt(result, extra = {}) {
  if (!result || typeof result !== 'object') return result
  const settledRepeat = extra.settledRepeat === true
    || result.querySettledRepeat === true
    || result.error === 'QUERY_SETTLED'
  const sheet = asObject(result.sheet)
  const kind = text((sheet && sheet.kind) || result.kind)
  const action = text((sheet && sheet.action) || result.action) || (settledRepeat ? '现查' : '')
  const previewId = text(
    result.preview_id
    || result.previewId
    || (sheet && (sheet.preview_id || sheet.previewId)),
  )
  const listed = Boolean(
    result.listed
    || result.ambiguous
    || (sheet && (sheet.listed || sheet.ambiguous))
    || settledRepeat,
  )
  const { hitTotalState, hitTotal } = receiptHit(result, sheet)
  const nos = settledRepeat ? [] : receiptNos(result, sheet, PAGE_SIZE)
  const rowCount = Array.isArray(result.matches) && result.matches.length
    ? result.matches.length
    : (sheet && Array.isArray(sheet.rows) ? sheet.rows.length : 0)
  const n = hitTotalState === 'known' && hitTotal != null ? hitTotal : (settledRepeat ? (hitTotal != null ? hitTotal : 0) : rowCount)
  let speak = text(result.speak || (sheet && sheet.speak) || result.hint)
  if (settledRepeat && speak && !speak.includes('已结算')) {
    speak = `${speak}${/。$/.test(speak) ? '' : '。'}${SETTLED_REPEAT_NOTE}`
  } else if (settledRepeat && !speak) {
    speak = SETTLED_REPEAT_NOTE
  }
  const next = planReceiptNext({
    ...result,
    action,
    listed,
    preview_id: previewId,
    n: rowCount,
    matches: result.matches,
    sheet,
  }, { settledRepeat })
  const where = receiptWhere((sheet && sheet.where) || result.where)
  const hopWhere = receiptWhere((sheet && sheet.hopWhere) || result.hopWhere)
  const from = receiptFrom((sheet && sheet.from) || result.from)
  const steps = receiptSteps((sheet && sheet.steps) || result.steps)
  const patch = receiptPatch(result, sheet)
  const to = text(result.to || (sheet && sheet.to))
  const no = text(result.no || (sheet && sheet.no))
  const failed = result.ok === false && !settledRepeat
  const receipt = {
    ok: settledRepeat ? true : result.ok !== false,
    kind,
    action,
    speak,
    next,
  }
  if (settledRepeat) {
    receipt.error = 'QUERY_SETTLED'
    receipt.querySettled = true
    receipt.querySettledRepeat = true
    receipt.listed = true
  } else if (failed || text(result.error)) {
    if (failed) receipt.ok = false
    if (text(result.error)) receipt.error = text(result.error)
    if (text(result.hint)) receipt.hint = text(result.hint)
  }
  if (no) receipt.no = no
  if (listed && !settledRepeat) receipt.listed = true
  if (result.ambiguous === true || (sheet && sheet.ambiguous === true)) receipt.ambiguous = true
  if (previewId) receipt.preview_id = previewId
  const canWrite = result.canWrite === true || result.can_write === true
    || (sheet && (sheet.canWrite === true || sheet.can_write === true))
  if (canWrite) receipt.canWrite = true
  if (result.blockConfirm === true || (sheet && sheet.blockConfirm === true)) receipt.blockConfirm = true
  if (to) receipt.to = to
  if (patch) receipt.patch = patch
  const domain = asObject(result.statusDomain) || asObject(sheet && sheet.statusDomain)
  if (domain && text(domain.field) && asObject(domain.enums) && Object.keys(domain.enums).length) {
    receipt.status = { field: text(domain.field), enums: domain.enums }
  }
  if (result.batch === true || (sheet && sheet.batch === true)) receipt.batch = true
  if (Number.isFinite(n)) receipt.n = n
  if (nos.length) receipt.nos = nos
  if (hitTotalState) receipt.hitTotalState = hitTotalState
  if (hitTotalState === 'known' && hitTotal != null) receipt.hitTotal = hitTotal
  else if (settledRepeat && hitTotal != null) receipt.hitTotal = hitTotal
  const page = Number((sheet && sheet.page) || result.page)
  if (Number.isFinite(page) && page > 0) receipt.page = Math.floor(page)
  const pageSize = Number((sheet && sheet.pageSize) || result.pageSize)
  if (Number.isFinite(pageSize) && pageSize > 0) receipt.pageSize = Math.floor(pageSize)
  if (where) receipt.where = where
  if (hopWhere) receipt.hopWhere = hopWhere
  if (from) receipt.from = from
  if (steps) receipt.steps = steps
  const speech = text(result.speech || (sheet && sheet.speech))
  if (speech) receipt.speech = speech
  return receipt
}
