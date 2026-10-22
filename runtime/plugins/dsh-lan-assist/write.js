/**
 * Preview, receipt and compensate speak.
 * Secretary never posts; the write mouth consumes a preview token.
 * @module dsh-lan-assist/write
 */

import { randomHex } from './crypto.js'
import { bindClueEnums, captureWriteIdentity, collectionFields, connectorCatalogPresent, hopIncomingField, hopLinkParentIds, kindLabelsMatch, mapKind, matchedWriteIdentity, relatedChildId, relatedField, relatedHopId, relatedRowLinks, registeredKinds, relationColumn, resolveConnectedKindName, resolveKindAlias, rowIdentity, schemaRelatedField, termFitsCollection, ticketColumn, writableFieldChoices } from './lookup.js'
import { enumMap, looksLikeRef, looksLikeTicket, mergeAskClue, pickNo, saysOf } from './resolve.js'
import { ensureSpoken } from './vocab/spoken.js'
import { PAGE_SIZE, normalizePlan } from './plan.js'
import { leftoverKindMissingFromCatalog, nestFromSteps, recalledUserSpeech, rowsForClickedWrite, unpreviewablePlanKind } from './slots.js'
import { WHERE_LIST_CAP, bindWhereKeys, fieldLabelsFromRawCollection, rowsMatchingWhere } from './where-pass.js'
import { createTraceLog } from './traces.js'
import { speakLookup } from './probe.js'
import {
  createSettledQueryStore,
  materializeSettledRepeat,
  previewSettledLookup,
  settledHopKey,
} from './query-settle.mjs'
import { redactEnvelopeText, refLabel } from './ref.js'

export const WORKSTATION_CONFIRM_HINT = '请在右侧确认过账'
import {
  bindSpokenCells,
  bindWhereRelationTerms,
  fkColumnForRelation,
  relationSchemaField,
  resolveRelatedId,
  statusLabelForCode,
  unboundWhereSpeak,
} from './relation-bind.js'

export { relationSchemaField } from './relation-bind.js'

export const SYSTEM_TABLES = ['users', 'fields', 'aiMessages']
export const PREVIEW_TTL_MS = 90_000

function speakWithActionAsk(speak, kind, askAction) {
  const act = String(askAction || '').trim()
  if (!act) return String(speak || '').trim()
  const who = String(kind || '').trim() || '这一格'
  const ask = `${who}先现查。这一格是现查还是${act}？人回一句再写。`
  const base = String(speak || '').trim()
  if (!base) return ask
  return `${base}${/。$/.test(base) ? '' : '。'}${ask}`
}

/**
 * @param {{ kind?: string, no?: string } | null | undefined} ref
 * @param {{ status?: string, fingerprint?: string } | null | undefined} found
 */
export function speakPreview(ref, found) {
  const label = refLabel(ref) || '这张单'
  if (!found || found.ok === false) {
    return {
      speak: `${label}：没连业务，不能装成已过账。信还能寄，点头还只是调度进会话。`,
      fresh: false,
    }
  }
  const status = String(found.status || '未知').trim() || '未知'
  const next = String(found.to || '').trim()
  const action = String(found.action || '').trim()
  const from = String(found.from || '').trim()
  let speak = `将改${label}，${next && next !== status ? `从${status} → ${next}` : `现在是${status}`}。这是预览，不是过账。`
  if (action === '删除') speak = `将删${label}，现在是${status}。这是预览，不是过账。`
  if (action === '新建') speak = `将新建${label}。这是预览，不是过账。`
  if (action === '改行' && next) speak = `将改${label}：${next}。这是预览，不是过账。`
  if (found.mine === false) speak += '负责人不是这台号。'
  return {
    speak: redactEnvelopeText(speak),
    fresh: true,
    status,
    from: from || status,
    to: next,
    fingerprint: String(found.fingerprint || status),
  }
}

function speakUnboundWrite(kind, no, cells) {
  const who = [String(kind || '').trim(), String(no || '').trim()].filter(Boolean).join(' ') || '这张单'
  const labels = (Array.isArray(cells) ? cells : [])
    .filter((cell) => cell && cell.bound !== true)
    .map((cell) => String(cell.label || cell.key || '').trim())
    .filter(Boolean)
  if (!labels.length) return `${who}这一格对不上。不能预览过账。`
  return `${who}的${labels.join('、')}对不上。不能预览过账。`
}

/**
 * Page payload for the secretary 业务 face. Not a write.
 * canWrite when a live preview_id covers one row or a bound set.
 */
export function packSheet(spec = {}) {
  const kind = String(spec.kind || '').trim()
  const action = String(spec.action || '').trim() || '现查'
  const patch = spec.patch && typeof spec.patch === 'object' ? spec.patch : {}
  const fields = spec.fields && typeof spec.fields === 'object' ? spec.fields : null
  const matches = Array.isArray(spec.matches) ? spec.matches : []
  const schemaFields = Array.isArray(spec.schemaFields) ? spec.schemaFields : []
  let rows = []
  if (matches.length) {
    rows = matches.map((item) => {
      const own = item && item.fields && typeof item.fields === 'object' ? item.fields : null
      const fallback = fields && String(item && item.no || '') === String(spec.no || '') ? fields : null
      const packedFields = own && Object.keys(own).length ? own : (fallback || {})
      const no = String((item && item.no) || packedFields.code || packedFields.name || packedFields.title || '')
      const lookup = (item && item.lookup && item.lookup.field && item.lookup.value != null)
        ? { field: String(item.lookup.field), value: String(item.lookup.value) }
        : captureWriteIdentity({ no, fields: packedFields }, schemaFields)
      return {
        no,
        status: String((item && item.status) || packedFields.status || ''),
        fields: packedFields,
        ...(lookup ? { lookup } : {}),
      }
    })
  } else if (fields && Object.keys(fields).length) {
    const no = String(spec.no || fields.code || fields.name || '')
    const lookup = captureWriteIdentity({ no, fields }, schemaFields)
    rows = [{
      no,
      status: String(spec.status || fields.status || ''),
      fields,
      ...(lookup ? { lookup } : {}),
    }]
  }
  const columns = []
  const seen = new Set()
  function schemaEnums(key) {
    const hit = schemaFields.find((item) => {
      const name = typeof item === 'string' ? item : (item && item.name)
      return String(name || '') === String(key || '')
    })
    if (!hit || typeof hit !== 'object') return undefined
    const packed = (hit.enums && typeof hit.enums === 'object' && !Array.isArray(hit.enums) && Object.keys(hit.enums).length)
      ? hit.enums
      : enumMap(hit)
    return packed && Object.keys(packed).length ? packed : undefined
  }
  function addCol(key, label, enums) {
    const name = String(key || '').trim()
    if (!name || seen.has(name)) return
    seen.add(name)
    const col = { key: name, label: label || fieldSpeak(name) }
    if (enums && typeof enums === 'object' && Object.keys(enums).length) col.enums = enums
    columns.push(col)
  }
  addCol('index', '序号')
  addCol('no', '单号')
  const hasStatus = rows.some((row) => {
    const status = String(row.status || '').trim()
    return status && status !== '未知'
  })
  if (hasStatus || action === '新建' || action === '改行') addCol('status', '状态', schemaEnums('status'))
  const usedLabels = new Set(['序号', '单号', '状态'])
  for (const row of rows) {
    for (const key of Object.keys(row.fields || {})) {
      if (key === 'no' || key === 'status' || key === 'state' || key === 'stage' || key === 'id') continue
      if (/^(orderNo|code|ticketNo|contractNo)$/.test(key) && rows.some((item) => String(item.fields[key] || '') === String(item.no || ''))) continue
      if (/^(name|title)$/i.test(key) && rows.every((item) => String(item.fields[key] || '') === String(item.no || ''))) continue
      if (hideDisplayKey(key, row.fields[key])) continue
      const label = displayColumnLabel(key, schemaFields, usedLabels)
      if (!label) continue
      usedLabels.add(label)
      addCol(key, label, schemaEnums(key))
    }
  }
  if (action === '新建' || action === '改行') {
    for (const row of writableFieldChoices(schemaFields)) {
      if (!row || !row.name) continue
      const label = displayColumnLabel(row.name, schemaFields, usedLabels)
      if (!label) continue
      usedLabels.add(label)
      addCol(row.name, label, schemaEnums(row.name))
    }
  }
  const lead = rows[0] || { fields: {} }
  const fromFallback = typeof spec.from === 'string'
    ? spec.from.trim()
    : String(spec.status || lead.status || '').trim()
  let changePatch = patch
  if (action === '过审') {
    if (!Object.keys(patch).length) {
      const toStr = String(spec.to || '').trim()
      const col = statusColumn(spec.mapped, kind, spec)
      const fromStr = (col && fieldValue(lead.fields, col)) || fromFallback
      if (col && fromStr && toStr && fromStr !== toStr) {
        changePatch = { [col]: toStr }
      }
    }
    for (const key of Object.keys(changePatch)) {
      const label = displayColumnLabel(key, schemaFields, usedLabels)
      if (!label) continue
      usedLabels.add(label)
      addCol(key, label, schemaEnums(key))
    }
  }
  const cellChanges = Array.isArray(spec.cells) && spec.cells.length
    ? spec.cells.map((cell) => {
      if (!cell || typeof cell !== 'object') return null
      const key = String(cell.key || '').trim()
      if (!key) return null
      const label = String(cell.label || '').trim() || displayColumnLabel(key, schemaFields) || fieldSpeak(key)
      const unbound = cell.bound !== true
      const to = unbound ? '' : String(cell.display ?? '').trim()
      const from = action === '新建' ? '' : (fieldValue(lead.fields, key) || fromFallback).trim()
      if (!unbound && action === '新建' && !to) return null
      if (!unbound && action !== '新建' && to === from) return null
      const picks = Array.isArray(cell.picks)
        ? cell.picks.filter((pick) => pick && pick.id != null).map((pick) => ({
          id: String(pick.id),
          label: String(pick.label || pick.id),
        }))
        : undefined
      return {
        field: key,
        label,
        from,
        to,
        ...(unbound ? { unbound: true, hint: String(cell.hint || '这一格对不上') } : {}),
        ...(picks && picks.length ? { picks } : {}),
      }
    }).filter(Boolean)
    : null
  const changes = cellChanges || Object.keys(changePatch).flatMap((key) => {
    const to = String(changePatch[key] ?? '').trim()
    const from = (fieldValue(lead.fields, key) || fromFallback).trim()
    if (action === '新建') {
      if (!to) return []
      return [{
        field: key,
        label: displayColumnLabel(key, schemaFields) || fieldSpeak(key),
        from: '',
        to,
      }]
    }
    if (to === from) return []
    return [{
      field: key,
      label: displayColumnLabel(key, schemaFields) || fieldSpeak(key),
      from,
      to,
    }]
  })
  const previewId = String(spec.preview_id || '').trim()
  const alreadyAtTarget = action === '过审'
    && rows.length > 0
    && Object.keys(patch).length > 0
    && !rows.some((row) => rowPatchMoves(row, changePatch, action, fromFallback))
  let canWrite = !!previewId && action !== '现查' && rows.length > 0
  if (action === '过审') canWrite = canWrite && rows.some((row) => rowPatchMoves(row, changePatch, action, fromFallback))
  if (spec.blockConfirm) canWrite = false
  let speak = String(spec.speak || spec.hint || '').trim()
  const askAction = String(spec.askAction || '').trim()
  if (askAction && action === '现查') speak = speakWithActionAsk(speak, kind, askAction)
  if (alreadyAtTarget) {
    const col = statusColumn(spec.mapped, kind, spec)
    const raw = ((col && fieldValue(lead.fields, col)) || String(lead.status || fromFallback || '').trim())
    let statusSay = ''
    for (const item of schemaFields) {
      const name = typeof item === 'string' ? item : (item && item.name)
      const enums = schemaEnums(name)
      if (enums && enums[raw] != null) {
        statusSay = String(enums[raw]).trim()
        break
      }
    }
    if (!statusSay) statusSay = raw || '当前状态'
    const who = [kind, String(spec.no || lead.no || spec.clue || '').trim()].filter(Boolean).join(' ') || '这张单'
    speak = `${who}已是${statusSay}。这是预览，不是过账。`
  }
  const hitTotalState = spec.hitTotalState
  const hitTotal = spec.hitTotal
  return {
    kind,
    action,
    clue: String(spec.clue || spec.no || '').trim(),
    no: String(spec.no || '').trim(),
    rows,
    columns,
    changes,
    preview_id: previewId,
    canWrite,
    batch: !!spec.batch,
    nos: Array.isArray(spec.nos) ? spec.nos : undefined,
    speak,
    workspace: String(spec.workspace || '').trim(),
    sessionId: String(spec.sessionId || '').trim(),
    nextKind: sheetNextKind(kind, spec),
    hopWhere: Array.isArray(spec.hopWhere) ? spec.hopWhere : undefined,
    where: Array.isArray(spec.where) && spec.where.length ? spec.where : undefined,
    ...(spec.from && typeof spec.from === 'object' && !Array.isArray(spec.from) ? { from: spec.from } : {}),
    ...(Array.isArray(spec.steps) && spec.steps.length ? { steps: spec.steps } : {}),
    speech: String(spec.speech || '').trim(),
    listed: !!spec.listed,
    ambiguous: !!spec.ambiguous,
    ...(spec.picked === true ? { picked: true } : {}),
    ...(alreadyAtTarget ? { alreadyAtTarget: true } : {}),
    ...(String(spec.to || '').trim() ? { to: String(spec.to).trim() } : {}),
    ...(spec.patch && typeof spec.patch === 'object' && !Array.isArray(spec.patch) && Object.keys(spec.patch).length
      ? { patch: spec.patch }
      : {}),
    fieldChoices: Array.isArray(spec.fieldChoices) ? spec.fieldChoices : undefined,
    pendingValue: spec.pendingValue,
    pickField: !!spec.pickField,
    askRest: String(spec.askRest || '').trim(),
    ...(spec.querySettled === true ? { querySettled: true } : {}),
    ...(hitTotalState ? { hitTotalState: String(hitTotalState) } : {}),
    ...(() => {
      if (hitTotalState !== 'known') return {}
      const total = hitTotal != null && Number.isFinite(Number(hitTotal))
        ? Number(hitTotal)
        : (spec.querySettled === true ? 0 : null)
      return total != null ? { hitTotal: total } : {}
    })(),
    ...(Number(spec.page) > 0 ? { page: Math.floor(Number(spec.page)) } : {}),
    ...(Number(spec.pageSize) > 0 ? { pageSize: Math.floor(Number(spec.pageSize)) } : {}),
    ...(spec.pageFull === true ? { pageFull: true } : {}),
    ...(Array.isArray(spec.peers) && spec.peers.length ? { peers: spec.peers } : {}),
    ...(String(spec.lookupNo || '').trim() ? { lookupNo: String(spec.lookupNo).trim() } : {}),
    ...(Array.isArray(spec.cells) && spec.cells.length ? { cells: spec.cells } : {}),
    ...(spec.blockConfirm ? { blockConfirm: true } : {}),
    ...(spec.statusDomain && spec.statusDomain.field && spec.statusDomain.enums
      ? { statusDomain: spec.statusDomain }
      : {}),
    ...(spec.columnMiss === true ? { columnMiss: true } : {}),
    ...(askAction && action === '现查' ? { askAction } : {}),
    ...(spec.officialBound === true ? { officialBound: true } : {}),
  }
}

function hopRelatedIds(fromKind, toKind, matches, extra) {
  return hopLinkParentIds(fromKind, toKind, matches, extra)
}

function hopRelatedField(fromKind, toKind, _matches, extra) {
  return relatedField(fromKind, toKind, extra)
}

function hopTargetKey(matches) {
  const own = (Array.isArray(matches) ? matches : []).map((item) => item && item.fields).find((fields) => fields && typeof fields === 'object') || {}
  return rowIdentity(own).key
}

function hopLinkIds(fromKind, toKind, matches, extra, relation) {
  const from = String(fromKind || '').trim()
  const to = String(toKind || '').trim()
  const rel = String(relation || '').trim()
  if (rel && from && from === to) {
    const named = relationColumn(to, rel, extra) || relationColumn(from, rel, extra)
    const col = named || (rel.endsWith('Id') ? rel : `${rel}Id`)
    const rows = Array.isArray(matches) ? matches : []
    const fkIds = [...new Set(rows.map((item) => {
      const fields = item && item.fields
      if (!fields || typeof fields !== 'object') return ''
      const raw = fields[col] ?? fields[rel]
      if (raw == null || raw === '') return ''
      if (typeof raw === 'object') return String(raw.id || raw.code || '').trim()
      return String(raw).trim()
    }).filter(Boolean))]
    if (fkIds.length) {
      return {
        ids: fkIds,
        field: rel,
        targetKey: hopTargetKey(matches),
      }
    }
    const parentIds = [...new Set(rows.map((item) => rowIdentity(item && item.fields).value).filter(Boolean))]
    if (parentIds.length && (named === rel || (!named && !col.endsWith('Id')))) {
      return {
        ids: parentIds,
        field: rel,
        targetKey: hopTargetKey(matches),
      }
    }
  }
  const incoming = hopIncomingField(fromKind, toKind, rel, extra)
  const named = incoming
    || relationColumn(toKind, relation, extra)
    || relationColumn(fromKind, relation, extra)
  const forward = hopRelatedIds(fromKind, toKind, matches, extra)
  if (forward.length) {
    return {
      ids: forward,
      field: incoming || named || hopRelatedField(fromKind, toKind, matches, extra),
      targetKey: hopTargetKey(matches),
    }
  }
  const reverse = [...new Set((Array.isArray(matches) ? matches : []).map((item) => (
    relatedChildId(toKind, fromKind, item && item.fields, extra)
  )).filter(Boolean))]
  return {
    ids: reverse,
    field: named || hopRelatedField(toKind, fromKind, matches, extra),
    targetKey: hopTargetKey(matches),
  }
}

function mergePlanPeerRows(left, right) {
  const out = []
  const seen = new Set()
  for (const row of [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])]) {
    if (!row || !row.kind) continue
    const key = `${String(row.kind).trim()}\0${String(row.relation || '').trim()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

function planStepsForSheet(plan) {
  return (plan && Array.isArray(plan.steps) ? plan.steps : [])
    .filter((step) => step && step.kind)
    .map((step) => ({
      kind: step.kind,
      ...(String(step.from || '').trim() ? { from: step.from } : {}),
      ...(String(step.relation || '').trim() ? { relation: step.relation } : {}),
      ...(Array.isArray(step.where) && step.where.length ? { where: step.where } : {}),
    }))
}

function coerceJsonSlot(value) {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text) return value
  const start = text[0]
  if (start !== '{' && start !== '[') return value
  try {
    return JSON.parse(text)
  } catch {
    return value
  }
}

function coercePreviewSpec(spec) {
  if (!spec || typeof spec !== 'object') return spec
  const next = { ...spec }
  for (const key of ['where', 'from', 'steps', 'patch', 'hopWhere']) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) continue
    next[key] = coerceJsonSlot(next[key])
  }
  return next
}

function sheetWhereFromPlan(plan, spec = {}) {
  const targetStep = (plan && plan.steps && plan.steps[plan.targetIndex]) || (plan && plan.steps && plan.steps[0])
  const startStep = plan && plan.steps && plan.steps[0]
  const listWhere = (targetStep && targetStep.where && targetStep.where.length)
    ? targetStep.where
    : (Array.isArray(spec.where) && spec.where.length ? spec.where : undefined)
  const hopWhere = (plan && plan.steps && plan.steps.length > 1 && startStep && startStep.where && startStep.where.length)
    ? startStep.where
    : undefined
  return { where: listWhere, hopWhere }
}

function lookupBindExtra(plan, spec = {}) {
  const { where, hopWhere } = sheetWhereFromPlan(plan, spec)
  const no = String((plan && plan.no) || '').trim()
  return {
    clue: plan && plan.no,
    speech: plan && plan.speech,
    ...(where && where.length ? { where } : {}),
    ...(hopWhere && hopWhere.length ? { hopWhere } : {}),
    ...(no ? { lookupNo: no } : {}),
  }
}

function speakConstrainedMiss(kind, plan, spec = {}) {
  const { where, hopWhere } = sheetWhereFromPlan(plan, spec)
  const bits = []
  const take = (terms) => {
    for (const term of Array.isArray(terms) ? terms : []) {
      const vals = Array.isArray(term && term.values)
        ? term.values.map((item) => String(item ?? '').trim()).filter(Boolean)
        : []
      if (vals.length) bits.push(vals.join('、'))
    }
  }
  take(where)
  take(hopWhere)
  const who = String(kind || '').trim() || '这张单'
  if (!bits.length) return `${who}对不上。`
  return `${who}对不上（${bits.join('，')}）。`
}

function listHitAccount(found, allRows, listing) {
  const rows = Array.isArray(allRows) ? allRows : []
  const reported = found && found.hitTotalState
  const state = reported === 'incomplete' || reported === 'unknown' || reported === 'known' ? reported : ''
  if (listing) {
    let hitTotalState = state || 'unknown'
    let hitTotal = null
    if (hitTotalState === 'known') {
      const given = Number(found && found.hitTotal)
      if (Number.isFinite(given)) hitTotal = given
      else hitTotalState = 'unknown'
    }
    return { hitTotal, hitTotalState }
  }
  if (rows.length >= WHERE_LIST_CAP) return { hitTotal: null, hitTotalState: 'incomplete' }
  if (state === 'incomplete') return { hitTotal: null, hitTotalState: 'incomplete' }
  return { hitTotal: rows.length, hitTotalState: 'known' }
}

function whereTermsConstrain(where) {
  if (!Array.isArray(where)) return false
  return where.some((term) => {
    if (!term || typeof term !== 'object') return false
    const vals = Array.isArray(term.values)
      ? term.values.map((item) => String(item ?? '').trim()).filter(Boolean)
      : []
    if (!vals.length) return false
    if (term.text === true || term.textPass === 'contains') return true
    const keys = Array.isArray(term.keys) ? term.keys.map((item) => String(item || '').trim()).filter(Boolean) : []
    return keys.length > 0
  })
}

function writeLookupBound(plan, spec = {}) {
  const no = String((plan && plan.no) || (spec && spec.no) || '').trim()
  if (no && (looksLikeTicket(no) || looksLikeRef(no))) return true
  if (spec && spec.lookup && spec.lookup.field && spec.lookup.value != null) return true
  if (spec && spec.picked === true && no) return true
  const related = spec && spec.related
  if (related && related.kind && Array.isArray(related.ids) && related.ids.length) return true
  if (textColumnTerms(plan).length > 0) return true
  if (whereTermsConstrain(plan && plan.where)) return true
  if (whereTermsConstrain(plan && plan.from && plan.from.where)) return true
  const steps = plan && Array.isArray(plan.steps) ? plan.steps : []
  return steps.some((step) => {
    const stepNo = String((step && step.no) || '').trim()
    if (stepNo && (looksLikeTicket(stepNo) || looksLikeRef(stepNo))) return true
    return whereTermsConstrain(step && step.where)
  })
}

function writeHasIdentity(plan, spec = {}) {
  return writeLookupBound(plan, spec)
}

function lookupEquals(lookup, field, value) {
  if (!lookup || !field) return false
  return String(lookup.field || '').trim() === String(field).trim()
    && String(lookup.value ?? '').trim() === String(value).trim()
}

function matchPickedRow(rows, spec = {}) {
  const list = Array.isArray(rows) ? rows : []
  const lookup = spec && spec.lookup && typeof spec.lookup === 'object' ? spec.lookup : null
  const field = lookup ? String(lookup.field || '').trim() : ''
  const value = lookup && lookup.value != null ? String(lookup.value).trim() : ''
  if (field && value) {
    const hit = list.find((row) => {
      if (!row || typeof row !== 'object') return false
      if (lookupEquals(row.lookup, field, value)) return true
      const fields = row.fields && typeof row.fields === 'object' ? row.fields : {}
      return String(fields[field] ?? row[field] ?? '').trim() === value
    })
    if (hit) return hit
  }
  const no = String((spec && spec.no) || '').trim()
  if (!no) return null
  return list.find((row) => {
    if (!row || typeof row !== 'object') return false
    if (String(row.no || '').trim() === no) return true
    const fields = row.fields && typeof row.fields === 'object' ? row.fields : {}
    if (String(fields.id ?? '').trim() === no) return true
    if (lookupEquals(row.lookup, row.lookup && row.lookup.field, no)) return true
    return Object.keys(fields).some((key) => (
      (/^(code|no)$/i.test(key) || /(No|Code|Number)$/.test(key))
      && String(fields[key] ?? '').trim() === no
    ))
  }) || null
}

function tokenListBind(plan, spec) {
  const { where } = sheetWhereFromPlan(plan, spec)
  const bind = {}
  if (Array.isArray(where) && where.length) bind.where = where
  const from = plan && plan.from
  if (from && typeof from === 'object' && !Array.isArray(from) && String(from.kind || '').trim()) {
    bind.from = from
  }
  if (Array.isArray(plan && plan.steps) && plan.steps.length) bind.steps = plan.steps
  return Object.keys(bind).length ? bind : null
}

function vocabDeclaresHop(fromKind, toKind, extra) {
  const from = String(fromKind || '').trim()
  const to = String(toKind || '').trim()
  if (!from || !to) return false
  for (const row of Array.isArray(extra && extra.vocab) ? extra.vocab : []) {
    for (const rel of Array.isArray(row && row.relations) ? row.relations : []) {
      if (!rel || typeof rel !== 'object') continue
      const frm = resolveKindAlias(String(rel.from || rel.fromKind || '').trim(), extra)
      const dest = resolveKindAlias(String(rel.to || rel.toKind || '').trim(), extra)
      if (kindLabelsMatch(frm, from) && kindLabelsMatch(dest, to)) return true
    }
  }
  return false
}

function kindOnCatalog(kind, extra) {
  const name = String(kind || '').trim()
  if (!name) return false
  return !unpreviewablePlanKind({ kind: name, steps: [{ kind: name }] }, extra)
}

function missingPlanRelation(plan, extra) {
  const steps = Array.isArray(plan && plan.steps) ? plan.steps : []
  for (let i = 1; i < steps.length; i += 1) {
    const toKind = String((steps[i] && steps[i].kind) || '').trim()
    const fromKind = String((steps[i] && steps[i].from) || (steps[i - 1] && steps[i - 1].kind) || '').trim()
    if (!fromKind || !toKind || fromKind === toKind) continue
    if (!kindOnCatalog(fromKind, extra) || !kindOnCatalog(toKind, extra)) continue
    const rel = String((steps[i] && steps[i].relation) || '').trim()
    const linked = schemaRelatedField(fromKind, toKind, extra)
      || hopIncomingField(fromKind, toKind, rel, extra)
      || vocabDeclaresHop(fromKind, toKind, extra)
    if (!linked) return { from: fromKind, to: toKind }
  }
  return null
}

function catalogVersionOf(vocab) {
  for (const row of Array.isArray(vocab) ? vocab : []) {
    const version = String((row && row.catalogVersion) || '').trim()
    if (version) return version
  }
  return ''
}

function sheetNextKind(kind, spec = {}) {
  const next = String(spec.nextKind || spec.via || '').trim()
  if (!next || next === String(kind || '').trim()) return ''
  return next
}

function keepHoppedMatches(rows, hopIds, fromKind, toKind, extra, fieldName) {
  const idSet = new Set((Array.isArray(hopIds) ? hopIds : []).map((item) => String(item)))
  if (!idSet.size) return []
  const named = String(fieldName || '').trim()
  const field = named || relatedField(fromKind, toKind, extra)
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (field && relatedRowLinks(row && row.fields, field, idSet)) return true
    if (named) return false
    const id = relatedChildId(fromKind, toKind, row && row.fields, extra)
    return id && idSet.has(String(id))
  })
}

export function stampParentLabels(fromKind, parents, children, toKind, extra) {
  const byId = new Map()
  for (const parent of Array.isArray(parents) ? parents : []) {
    const id = relatedHopId(fromKind, toKind, parent && parent.fields, extra)
    if (id) byId.set(String(id), parent)
  }
  const fk = relatedField(fromKind, toKind, extra)
  const labelKey = fk && /Id$/.test(fk) ? fk.slice(0, -2) : (fromKind || 'parent')
  return (Array.isArray(children) ? children : []).map((child) => {
    const fields = child && child.fields && typeof child.fields === 'object' ? { ...child.fields } : {}
    const id = relatedHopId(fromKind, toKind, fields, extra) || String(fields[relatedField(fromKind, toKind, extra)] || '').trim()
    const parent = id ? byId.get(String(id)) : null
    if (parent && !String(fields[labelKey] || '').trim()) {
      const label = String((parent.no) || (parent.fields && (parent.fields.code || parent.fields.name || parent.fields.title)) || '').trim()
      if (label) fields[labelKey] = label
    }
    return { ...child, fields }
  })
}

/** Parents that still participate in this hop's surviving children — not the step's unfiltered list. */
export function keepParentsForChildren(parents, children, fromKind, toKind, extra) {
  const childIds = new Set()
  for (const child of Array.isArray(children) ? children : []) {
    const fields = child && child.fields && typeof child.fields === 'object' ? child.fields : {}
    const id = relatedChildId(fromKind, toKind, fields, extra)
      || relatedHopId(fromKind, toKind, fields, extra)
    if (id) childIds.add(String(id))
  }
  if (!childIds.size) return []
  return (Array.isArray(parents) ? parents : []).filter((parent) => {
    const id = relatedHopId(fromKind, toKind, parent && parent.fields, extra)
    return id && childIds.has(String(id))
  })
}

function pruneHopHits(hitsByKind, steps, extra) {
  const chain = (Array.isArray(steps) ? steps : []).filter((step) => step && step.kind)
  for (let i = chain.length - 1; i >= 1; i -= 1) {
    const childKind = String(chain[i].kind || '').trim()
    const parentKind = String(chain[i - 1].kind || '').trim()
    if (!childKind || !parentKind || parentKind === childKind) continue
    hitsByKind.set(
      parentKind,
      keepParentsForChildren(hitsByKind.get(parentKind), hitsByKind.get(childKind), parentKind, childKind, extra),
    )
  }
}

async function decorateFromHits(fromNode, hitsByKind, extra = {}) {
  if (!fromNode || typeof fromNode !== 'object') return fromNode
  const kind = String(fromNode.kind || '').trim()
  const matches = (hitsByKind && typeof hitsByKind.get === 'function' && kind)
    ? (hitsByKind.get(kind) || [])
    : []
  let schemaFields = Array.isArray(extra.schemaFields) ? extra.schemaFields : []
  if (typeof extra.fieldsOf === 'function' && kind) {
    try {
      const loaded = await extra.fieldsOf(kind, extra.vocab)
      if (Array.isArray(loaded) && loaded.length) schemaFields = loaded
    } catch { /* keep empty schema; rows still pack */ }
  }
  const packed = packSheet({
    kind,
    action: '现查',
    matches: Array.isArray(matches) ? matches : [],
    schemaFields,
    vocab: extra.vocab,
  })
  const nested = fromNode.from && typeof fromNode.from === 'object' && !Array.isArray(fromNode.from)
    ? await decorateFromHits(fromNode.from, hitsByKind, extra)
    : undefined
  return {
    ...fromNode,
    rows: packed.rows,
    columns: packed.columns,
    ...(nested ? { from: nested } : {}),
  }
}

async function withSheet(result, extra = {}) {
  let schemaFields = extra.schemaFields
  const sheetKind = String((result && result.kind) || extra.kind || '').trim()
  if (typeof extra.fieldsOf === 'function' && sheetKind) {
    try {
      const loaded = await extra.fieldsOf(sheetKind, extra.vocab)
      if (Array.isArray(loaded) && loaded.length) schemaFields = loaded
    } catch { /* keep the already loaded schema */ }
  }
  const ask = String((extra && extra.askAction) || (result && result.askAction) || '').trim()
  const packed = stampWorkstationConfirm({
    ...result,
    ...(ask ? { askAction: ask } : {}),
  })
  const sheet = packSheet({ ...packed, ...extra, schemaFields })
  if (result && result.ok === false) {
    sheet.ok = false
    if (result.error) sheet.error = String(result.error)
    if (result.hint) sheet.hint = String(result.hint)
  }
  const out = { ...packed, sheet }
  if (sheet && sheet.speak) out.speak = sheet.speak
  if (packed.confirm) out.confirm = packed.confirm
  if (packed.hint) out.hint = packed.hint
  delete out.vocab
  return out
}

function stampWorkstationConfirm(result) {
  if (!result || typeof result !== 'object') return result
  if (result.ok === false) return result
  const action = String(result.action || '').trim()
  const previewId = String(result.preview_id || result.previewId || '').trim()
  if (!previewId || action === '现查') return result
  const hint = String(result.hint || '').trim() || WORKSTATION_CONFIRM_HINT
  const speak = String(result.speak || '').trim()
  return {
    ...result,
    confirm: 'workstation',
    hint,
    speak: speak.includes(WORKSTATION_CONFIRM_HINT)
      ? speak
      : [speak, WORKSTATION_CONFIRM_HINT].filter(Boolean).join(' '),
  }
}

function hideDisplayKey(key, value) {
  const name = String(key || '')
  if (name === 'id' || /Id$|_id$/.test(name)) return true
  if (/^(createdAt)$/i.test(name)) return true
  const text = value != null && typeof value !== 'object' ? String(value) : ''
  if (/^(owner|assignee|createdBy|updatedBy)$/i.test(name) && /^\d+$/.test(text)) return true
  if (text && /^\d{12,}$/.test(text) && !/no|code|ticket/i.test(name)) return true
  return false
}

function displayColumnLabel(key, schemaFields, usedLabels) {
  const list = Array.isArray(schemaFields) ? schemaFields : []
  const hit = list.find((item) => {
    const name = typeof item === 'string' ? item : (item && item.name)
    return String(name || '') === String(key || '')
  })
  const title = hit && typeof hit === 'object' ? String(hit.title || '').trim() : ''
  const label = (title && /[\u4e00-\u9fff]/.test(title)) ? title : fieldSpeak(key)
  if (usedLabels && usedLabels.has(label)) return ''
  return label
}

/**
 * @param {{ fingerprint?: string } | null | undefined} preview
 * @param {{ fingerprint?: string, status?: string, ok?: boolean } | null | undefined} next
 */
export function previewStillHolds(preview, next) {
  if (!preview || !preview.fingerprint) return { ok: false, error: 'NEED_PREVIEW', hint: '先预览。旧画面不能拿去写。' }
  if (!next || next.ok === false) {
    return { ok: false, error: 'NO_LOOKUP', hint: '点头前再查失败。没连上，不能装成已过账。' }
  }
  const fingerprint = String(next.fingerprint || next.status || '')
  if (fingerprint !== String(preview.fingerprint)) {
    return { ok: false, error: 'STALE', hint: '刚才那版不是现在这版。不要拿旧预览去写。' }
  }
  return { ok: true, fingerprint, status: next.status || preview.status || '' }
}

/**
 * @param {{ kind?: string, no?: string } | null | undefined} ref
 * @param {{ receiptId?: string, ok?: boolean, failed?: boolean } | null | undefined} result
 */
export function speakReceipt(ref, result) {
  const label = refLabel(ref) || '这张单'
  if (result && result.failed) {
    return {
      kind: 'compensate',
      speak: `刚才那笔业务侧失败了：${label}。要不要走冲正。秘书不执行冲正。`,
    }
  }
  const receiptId = result && String(result.receiptId || '').trim()
  if (!receiptId) {
    return {
      kind: 'receipt',
      speak: `写了但没回执：${label}。不能记已处理。`,
    }
  }
  return {
    kind: 'receipt',
    speak: `库里已改上：${label}。有回执才算写上了。`,
    receiptId,
  }
}

export function speakBundlePreview(lines, extra = {}) {
  const rows = Array.isArray(lines) ? lines.filter(Boolean) : []
  if (!rows.length) return extra.replaced ? '上一笔没写，已被这开口换掉。' : '先预览。'
  const body = rows.map((row) => String(row.speak || row.hint || '').replace(/。这是预览，不是过账。?$/, '')).filter(Boolean)
  const head = extra.replaced ? '上一笔没写，已被这开口换掉。' : ''
  const tail = rows.some((row) => row.ok !== false && row.preview_id) ? '这是预览，不是过账。' : ''
  return redactEnvelopeText([head, ...body, tail].filter(Boolean).join('\n'))
}

export function speakBundleReceipt(results) {
  const rows = Array.isArray(results) ? results : []
  if (!rows.length) return '没有可写的行。'
  const lines = rows.map((row) => {
    if (!row) return ''
    const label = [row.kind, row.no].filter(Boolean).join(' ') || '这张单'
    const change = patchChange(row.patch, null)
    if (row.failed || row.ok === false) {
      return row.speak || (change && change.speak
        ? `${label}没写成：${change.speak}`
        : `没写成：${label}`)
    }
    return change && change.speak
      ? `库里已改上：${label}。${change.speak}。有回执才算写上了。`
      : (row.speak || `库里已改上：${label}。有回执才算写上了。`)
  }).filter(Boolean)
  return lines.join('\n')
}

export function speakAlreadyWritten(ref) {
  const label = refLabel(ref) || '这张单'
  return `同一封再点，不会二次过账。${label}已经有回执。`
}

/**
 * @param {unknown} kind
 */
export function isSystemTable(kind) {
  return SYSTEM_TABLES.includes(String(kind || '').trim())
}

/**
 * @param {unknown} kind
 * @param {Array<{ kind?: string, label?: string, can?: string[] }>} [vocab]
 */
function pickProp(node, props, keys) {
  for (const key of keys) {
    if (node && node[key] != null && node[key] !== '') return node[key]
    if (props && props[key] != null && props[key] !== '') return props[key]
  }
  return undefined
}

function conceptLabel(node, props) {
  return String(pickProp(node, props, [
    'content',
    'prefLabel',
    'skos:prefLabel',
    'label',
    'rdfs:label',
  ]) || '').trim()
}

export function stringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (typeof value === 'string') {
    return value.split(/[,，、\s]+/).map((item) => item.trim()).filter(Boolean)
  }
  return []
}

export function kindsFromGraphNodes(nodes) {
  const out = []
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!node || String(node.type || '') !== 'skos:Concept') continue
    const props = node.properties && typeof node.properties === 'object' ? node.properties : {}
    const kind = conceptLabel(node, props)
    if (!kind) continue
    const fields = stringList(pickProp(node, props, ['fields']))
    const can = stringList(pickProp(node, props, ['can']))
    const rawResource = String(pickProp(node, props, ['resource', 'collection']) || '').trim()
    const ticketField = String(pickProp(node, props, ['ticketField', 'ticket_field']) || '').trim()
    const dateField = String(pickProp(node, props, ['dateField', 'date_field']) || '').trim()
    const fieldLabels = pickProp(node, props, ['fieldLabels', 'field_labels'])
    if (ticketField) fields.unshift(ticketField)
    if (!fields.length && !can.length && !rawResource) continue
    const packed = {
      kind,
      fields: [...new Set(fields.filter(Boolean))],
      can: can.length ? can : ['现查'],
    }
    const uri = String(node.id || pickProp(node, props, ['id', 'uri']) || '').trim()
    const slug = uri.includes('#') ? uri.split('#').pop() : uri
    if (uri.includes('#') || /^[A-Za-z][A-Za-z0-9_-]{0,48}$/.test(slug)) packed.id = slug
    if (rawResource) packed.resource = rawResource
    if (ticketField) packed.ticketField = ticketField
    if (dateField) packed.dateField = dateField
    if (fieldLabels && typeof fieldLabels === 'object' && !Array.isArray(fieldLabels)) {
      packed.fieldLabels = fieldLabels
    }
    const clues = pickProp(node, props, ['clues'])
    if (clues != null) packed.clues = clues
    const catalogVersion = String(pickProp(node, props, ['catalogVersion', 'catalog_version']) || '').trim()
    if (catalogVersion) packed.catalogVersion = catalogVersion
    const connection = String(pickProp(node, props, ['connection']) || '').trim()
    if (connection) packed.connection = connection
    const relations = pickProp(node, props, ['relations'])
    if (Array.isArray(relations) && relations.length) packed.relations = relations
    if (kind === '口语' || packed.id === 'spoken') packed.spoken = true
    out.push(packed)
  }
  return out
}

export function vocabRow(kind, vocab) {
  const key = String(kind || '').trim()
  if (!key) return null
  for (const row of vocab || []) {
    if (!row) continue
    const name = String(row.kind || row.label || '').trim()
    if (name === key) {
      const can = Array.isArray(row.can) ? row.can.map((item) => String(item).trim()).filter(Boolean) : []
      const packed = { kind: name, can, fields: Array.isArray(row.fields) ? row.fields : [] }
      if (row.id) packed.id = row.id
      if (row.clues != null) packed.clues = row.clues
      if (row.resource) packed.resource = row.resource
      if (row.ticketField) packed.ticketField = row.ticketField
      if (row.fieldLabels && typeof row.fieldLabels === 'object' && !Array.isArray(row.fieldLabels)) {
        packed.fieldLabels = row.fieldLabels
      }
      return packed
    }
  }
  return null
}

/**
 * @param {unknown} action
 * @param {{ can?: string[] } | null} row
 */
export function actionAllowed(action, row) {
  const act = String(action || '').trim()
  const can = (row && row.can) || []
  if (!act) return false
  return can.includes(act)
}

function textColumnTerms(source) {
  const out = []
  const take = (where) => {
    for (const term of Array.isArray(where) ? where : []) {
      if (term && term.text === true) out.push(term)
    }
  }
  take(source && source.where)
  for (const step of (source && source.steps) || []) take(step && step.where)
  return out
}

/**
 * Write mouth. Lookup stays GET-only. Secretary mailbox never calls this.
 * @param {{
 *   vocab?: Array<Record<string, unknown>>,
 *   lookupTodo?: Function,
 *   postWrite?: Function,
 *   now?: () => number,
 * }} [opts]
 */
export function createGate(opts = {}) {
  const staticVocab = Array.isArray(opts.vocab) && opts.vocab.length ? opts.vocab : null
  const now = opts.now || (() => Date.now())
  /** @type {Map<string, Record<string, unknown>>} */
  const tokens = new Map()
  const traces = opts.traces || createTraceLog()
  const rememberedAsk = new Map()
  const settledQueries = createSettledQueryStore()

  function refuse(error, hint) {
    return { ok: false, error, hint }
  }

  function noteAsk(workspace, rest) {
    const cwd = String(workspace || '').trim()
    const bit = String(rest || '').trim()
    if (!cwd || !bit) return
    const list = rememberedAsk.get(cwd) || []
    if (!list.includes(bit)) list.push(bit)
    rememberedAsk.set(cwd, list)
  }

  function applyRememberedAsk(vocab, workspace) {
    const list = rememberedAsk.get(String(workspace || '').trim()) || []
    if (!list.length) return vocab
    const rows = Array.isArray(vocab) ? vocab.slice() : []
    const i = rows.findIndex((row) => row && (row.spoken || row.kind === '口语' || row.id === 'spoken'))
    if (i < 0) return rows
    let clues = rows[i].clues
    for (const rest of list) clues = mergeAskClue(clues, rest)
    rows[i] = { ...rows[i], clues, spoken: true }
    return rows
  }

  async function vocabFor(workspace) {
    if (typeof opts.loadVocab === 'function') {
      const cwd = String(workspace || '').trim()
      if (!cwd) return { ok: false, error: 'NO_CWD', hint: '这封没绑工作区，读不了词表。' }
      try {
        const loaded = await opts.loadVocab(cwd)
        return { ok: true, vocab: applyRememberedAsk(Array.isArray(loaded) ? loaded : [], cwd) }
      } catch {
        return { ok: false, error: 'NO_VOCAB', hint: '词表没读成。不能装成能写。' }
      }
    }
    if (staticVocab) return { ok: true, vocab: applyRememberedAsk(staticVocab, workspace) }
    return { ok: false, error: 'NO_VOCAB', hint: '词表没读成。不能装成能写。' }
  }

  function recognize(kind, action, patch, vocab, extra = {}) {
    const name = String(kind || '').trim()
    if (isSystemTable(name)) return refuse('SYSTEM_TABLE', `${name}是系统表，不能写。`)
    const row = vocabRow(name, vocab)
    const mapped = mapKind(name, { vocab, ...extra })
    if (!row || !mapped) return refuse('UNKNOWN_KIND', `${name || '这个型'}没登记。词表和连接器都要有，不能装成能写。`)
    const act = String(action || '').trim() || '现查'
    if (!actionAllowed(act, row)) {
      if (act === '过审') return refuse('ACTION_DENIED', `${name}词表没有「过审」，不能预览过审。`)
      return refuse('ACTION_DENIED', `${name}现在只许现查，不能预览这个动作。`)
    }
    return { ok: true, kind: name, action: act, mapped, row }
  }

  async function schemaForSlotWhere(kind, vocab, workspace) {
    let schemaFields = []
    if (typeof opts.fieldsOf === 'function') {
      try {
        const loaded = await opts.fieldsOf(kind, vocab)
        if (Array.isArray(loaded)) schemaFields = loaded
      } catch { /* collections may still bind */ }
    }
    let collections = []
    if (typeof opts.collectionsOf === 'function') {
      try {
        const loaded = await opts.collectionsOf(workspace)
        if (Array.isArray(loaded)) collections = loaded
      } catch { /* fieldsOf may still bind */ }
    }
    const extra = { vocab, collections }
    const mapped = mapKind(kind, extra)
    const collFields = mapped && mapped.resource ? collectionFields(mapped.resource, collections) : []
    const fields = collFields.length ? collFields : schemaFields
    return {
      fields,
      rawFieldLabels: fieldLabelsFromRawCollection(mapped && mapped.resource, collections),
    }
  }

  async function bindSlotWhere(kind, where, vocab, schema) {
    const claimed = Array.isArray(where) ? where : []
    if (!claimed.length) return { where: claimed }
    const fields = Array.isArray(schema && schema.fields) ? schema.fields : []
    if (!fields.length) return { where: claimed }
    const vocabRows = Array.isArray(vocab) ? vocab : []
    const vocabHit = vocabRow(kind, vocabRows)
    let terms = bindWhereKeys(claimed, kind, vocabRows, fields, schema.rawFieldLabels)
    terms = bindClueEnums(terms, fields, vocabRows)
    const unfit = terms.filter((term) => !termFitsCollection(term, fields, vocabHit, schema.rawFieldLabels))
    if (unfit.length) {
      return {
        error: {
          ok: false,
          error: 'WHERE_UNBOUND',
          status: '没有',
          matches: [],
          hint: unboundWhereSpeak(kind, unfit, fields, vocabRows),
        },
      }
    }
    const bound = await bindWhereRelationTerms(terms, fields, { kind, vocab: vocabRows }, {}, vocabHit, schema.rawFieldLabels)
    if (bound.unbound.length) {
      return {
        error: {
          ok: false,
          error: 'WHERE_UNBOUND',
          status: '没有',
          matches: [],
          hint: unboundWhereSpeak(kind, bound.unbound, fields, vocabRows),
        },
      }
    }
    return { where: bound.terms }
  }

  async function probe(spec) {
    if (typeof opts.lookupTodo !== 'function') return { ok: false, error: 'NO_CONNECTOR' }
    try {
      let where = spec.where
      if (Array.isArray(where) && where.length) {
        const schema = await schemaForSlotWhere(spec.kind, spec.vocab, spec.workspace)
        const bound = await bindSlotWhere(spec.kind, where, spec.vocab, schema)
        if (bound.error) return bound.error
        where = bound.where
      }
      return await opts.lookupTodo({
        kind: spec.kind,
        no: spec.no,
        line: spec.line,
        workspace: spec.workspace || '',
        staffId: spec.staffId || '',
        vocab: spec.vocab,
        mapped: spec.mapped,
        speech: '',
        related: spec.related,
        asAsk: !!spec.asAsk,
        where,
        join: spec.join,
        limit: spec.limit,
      })
    } catch {
      return { ok: false, error: 'LOOKUP' }
    }
  }

  async function probeRow(spec) {
    if (typeof opts.lookupTodo !== 'function') return { ok: false, error: 'NO_CONNECTOR' }
    try {
      return await opts.lookupTodo({
        kind: spec.kind,
        no: spec.no,
        line: spec.line,
        workspace: spec.workspace || '',
        staffId: spec.staffId || '',
        vocab: spec.vocab,
        mapped: spec.mapped,
        speech: '',
      })
    } catch {
      return { ok: false, error: 'LOOKUP' }
    }
  }

  async function lookupPublishedSelfEdge(kindName, relationField, spec, loaded, extra) {
    const kind = String(kindName || '').trim()
    const relation = String(relationField || '').trim()
    if (!kind || !relation) return { ok: false, error: 'NOT_FOUND', matches: [] }
    const mapped = mapKind(kind, extra)
    const resource = mapped && mapped.resource
    const schemaFields = resource ? collectionFields(resource, extra.collections) : []
    const col = relationColumn(kind, relation, extra) || (relation.endsWith('Id') ? relation : `${relation}Id`)
    const fieldRow = schemaFields.find((row) => row && (row.name === col || row.name === relation))
    const isSelfM2o = fieldRow
      && /^(m2o|belongsTo|o2o)$/i.test(String(fieldRow.interface || fieldRow.type || ''))
      && String(fieldRow.target || '').trim() === String(resource || '').trim()
    if (isSelfM2o) {
      return await probe({
        kind,
        no: '',
        workspace: spec.workspace,
        staffId: spec.staffId,
        vocab: loaded.vocab,
        structured: true,
        speech: '',
        limit: WHERE_LIST_CAP,
        related: { kind, field: relation, filled: true },
      })
    }
    const fkName = relationColumn(kind, relation, extra) || (relation.endsWith('Id') ? relation : `${relation}Id`)
    if (fkName && schemaFields.some((row) => row && row.name === fkName)) {
      return await probe({
        kind,
        no: '',
        workspace: spec.workspace,
        staffId: spec.staffId,
        vocab: loaded.vocab,
        structured: true,
        speech: '',
        limit: WHERE_LIST_CAP,
        related: { kind, field: relation, filled: true },
      })
    }
    const parentFound = await probe({
      kind,
      no: '',
      workspace: spec.workspace,
      staffId: spec.staffId,
      vocab: loaded.vocab,
      structured: true,
      speech: '',
      limit: WHERE_LIST_CAP,
    })
    if (!parentFound || parentFound.ok === false) {
      return parentFound && parentFound.ok === false
        ? parentFound
        : { ok: false, error: 'NOT_FOUND', matches: [] }
    }
    const parentMatches = parentFound.matches && parentFound.matches.length
      ? parentFound.matches
      : [{ no: parentFound.no, status: parentFound.status, fields: parentFound.fields || {} }]
    const link = hopLinkIds(kind, kind, parentMatches, extra, relation)
    if (!link.ids.length) {
      return {
        ok: true,
        matches: [],
        listed: true,
        querySettled: true,
        hitTotal: 0,
        hitTotalState: parentFound.hitTotalState === 'incomplete' ? 'incomplete' : 'known',
      }
    }
    const hopped = await probe({
      kind,
      no: '',
      workspace: spec.workspace,
      staffId: spec.staffId,
      vocab: loaded.vocab,
      structured: true,
      speech: '',
      limit: WHERE_LIST_CAP,
      related: { kind, ids: link.ids, field: link.field, targetKey: link.targetKey },
    })
    const nextRows = keepHoppedMatches(hopped && hopped.matches, link.ids, kind, kind, extra, link.field)
    if (!nextRows.length) {
      const lookupFailed = hopped && hopped.ok === false && hopped.error && hopped.error !== 'NOT_FOUND'
      return {
        ok: true,
        matches: [],
        listed: true,
        querySettled: true,
        hitTotal: 0,
        hitTotalState: lookupFailed || (hopped && hopped.hitTotalState === 'incomplete') ? 'incomplete' : 'known',
      }
    }
    let hitTotalState = hopped && hopped.hitTotalState === 'incomplete' ? 'incomplete' : 'known'
    let hitTotal = null
    if (hitTotalState === 'known') {
      const given = Number(hopped && hopped.hitTotal)
      if (Number.isFinite(given)) hitTotal = given
      else hitTotal = 0
    }
    return {
      ok: true,
      matches: nextRows,
      listed: true,
      querySettled: true,
      hitTotalState,
      ...(hitTotalState === 'known' ? { hitTotal } : {}),
    }
  }

  async function previewStructured(plan, spec, loaded) {
    const extra = { vocab: loaded.vocab }
    if (typeof opts.collectionsOf === 'function') {
      try {
        extra.collections = await opts.collectionsOf(spec.workspace)
      } catch { /* collections optional for hop FK */ }
    }
    const start = plan.steps[0]
    const target = plan.steps[plan.targetIndex] || start
    if (!start || !start.kind) return refuse('UNKNOWN_KIND', '没有型，预览走不了。')
    const recognized = recognize(target.kind, plan.action, plan.patch, loaded.vocab, extra)
    if (!recognized.ok) return recognized
    let schemaFields = []
    if (typeof opts.fieldsOf === 'function') {
      try { schemaFields = await opts.fieldsOf(recognized.kind, loaded.vocab) } catch { schemaFields = [] }
    }
    if (!Array.isArray(schemaFields)) schemaFields = []
    async function sheet(result, more = {}) {
      const hopFrom = plan.steps && plan.steps.length > 1
        ? String(plan.steps[0].kind || '').trim()
        : ''
      const hopFromWhere = hopFrom && Array.isArray(plan.steps[0].where) && plan.steps[0].where.length
        ? plan.steps[0].where
        : undefined
      const fromSlot = (more && more.from)
        || (hopFrom ? { kind: hopFrom, ...(hopFromWhere ? { where: hopFromWhere } : {}) } : undefined)
      const stepsMeta = planStepsForSheet(plan)
      const rest = { ...(more || {}) }
      delete rest.from
      delete rest.steps
      return withSheet(result, {
        vocab: loaded.vocab,
        schemaFields,
        fieldsOf: opts.fieldsOf,
        sessionId: spec.sessionId,
        ...(fromSlot ? { from: fromSlot } : {}),
        ...(stepsMeta.length > 1 ? { steps: stepsMeta } : {}),
        ...(sidePeers.length ? { peers: sidePeers } : {}),
        ...(spec.picked === true ? { picked: true } : {}),
        ...(String(spec.askAction || '').trim() ? { askAction: String(spec.askAction).trim() } : {}),
        ...rest,
      })
    }
    let sidePeers = []
    async function packPeerSheets() {
      const listed = Array.isArray(plan.peers) ? plan.peers : []
      const out = []
      for (const peer of listed) {
        const peerKind = String(peer && peer.kind || '').trim()
        const peerRelation = String(peer && peer.relation || '').trim()
        if (!peerKind) continue
        if (peerKind === recognized.kind && !peerRelation) continue
        const found = peerRelation
          ? await lookupPublishedSelfEdge(peerKind, peerRelation, spec, loaded, extra)
          : await probe({
            kind: peerKind,
            no: '',
            workspace: spec.workspace,
            staffId: spec.staffId,
            vocab: loaded.vocab,
            structured: true,
            speech: '',
            where: peer.where,
            limit: WHERE_LIST_CAP,
          })
        const matches = found && Array.isArray(found.matches) ? found.matches : []
        let peerSchema = []
        if (typeof opts.fieldsOf === 'function') {
          try {
            const loadedFields = await opts.fieldsOf(peerKind, loaded.vocab)
            if (Array.isArray(loadedFields)) peerSchema = loadedFields
          } catch { /* peer still packs rows */ }
        }
        const failed = found && found.ok === false && found.error && found.error !== 'NOT_FOUND'
        let hitTotalState = found && found.hitTotalState === 'incomplete'
          ? 'incomplete'
          : (failed ? 'unknown' : 'known')
        let hitTotal = null
        if (hitTotalState === 'known') {
          const given = Number(found && found.hitTotal)
          if (Number.isFinite(given)) hitTotal = given
          else if (!failed) hitTotal = 0
          else hitTotalState = 'unknown'
        }
        const packed = packSheet({
          kind: peerKind,
          action: '现查',
          matches: matches.slice(0, PAGE_SIZE),
          schemaFields: peerSchema,
          vocab: loaded.vocab,
          where: peer.where,
          speech: plan.speech,
          querySettled: true,
          hitTotalState,
          ...(hitTotalState === 'known' ? { hitTotal } : {}),
        })
        out.push({
          kind: peerKind,
          ...(peerRelation ? { relation: peerRelation } : {}),
          where: peer.where,
          rows: packed.rows,
          columns: packed.columns,
          action: '现查',
          querySettled: true,
          hitTotalState,
          ...(hitTotalState === 'known' ? { hitTotal } : {}),
          page: 1,
          pageSize: PAGE_SIZE,
          pageFull: packed.rows.length >= PAGE_SIZE,
        })
      }
      return out
    }
    if (recognized.action === '现查' && !(spec.related && spec.related.kind)) {
      sidePeers = await packPeerSheets()
    }
    plan.packedPeers = sidePeers
    function columnMissHint(kindName, terms) {
      const titles = [...new Set((Array.isArray(terms) ? terms : []).map((term) => (
        String(term.title || (term.keys && term.keys[0]) || '').trim()
      )).filter(Boolean))]
      if (!titles.length) return ''
      const who = String(kindName || '').trim() || '这张单'
      return `${who}的${titles.join('、')}这一列对不上，0 条，不是没去查。`
    }
    function missSpeak(kindName, found) {
      const terms = textColumnTerms(plan)
      const missed = !found || found.ok === false
      if (missed && terms.length) {
        const hint = columnMissHint(kindName, terms)
        if (hint) return { speak: hint, columnMiss: true }
      }
      return {
        speak: speakLookup({ kind: kindName, no: '' }, found && found.ok === false ? found : { ok: false, error: 'NOT_FOUND' }),
      }
    }
    async function settledList(kindName, account) {
      const page = Number(plan.page) > 0 ? Math.floor(Number(plan.page)) : 1
      const state = account && account.hitTotalState === 'incomplete' ? 'incomplete' : 'known'
      const total = state === 'known' ? 0 : null
      const missed = writeLookupBound(plan, spec)
        ? { speak: speakConstrainedMiss(kindName, plan, spec) }
        : missSpeak(kindName, { ok: false, error: 'NOT_FOUND' })
      return sheet({
        ok: true,
        kind: kindName,
        no: '',
        action: '现查',
        speak: missed.speak,
        matches: [],
        listed: true,
        querySettled: true,
        hitTotal: total,
        hitTotalState: state,
        page,
        pageSize: PAGE_SIZE,
        pageFull: false,
      }, {
        kind: kindName,
        action: '现查',
        speech: plan.speech,
        matches: [],
        querySettled: true,
        hitTotal: total,
        hitTotalState: state,
        page,
        pageSize: PAGE_SIZE,
        ...sheetWhereFromPlan(plan, spec),
        ...(missed.columnMiss ? { columnMiss: true } : {}),
      })
    }
    if ((plan.filterRefused || plan.contradicts) && recognized.action === '现查') {
      return settledList(recognized.kind, { hitTotalState: 'known' })
    }
    const patchAction = recognized.action === '改行' || recognized.action === '新建' || recognized.action === '过审'
    const spokenBind = patchAction
      ? await bindSpokenPreview(plan.patch, schemaFields, recognized, loaded.vocab, spec.workspace)
      : { writePatch: {}, displayPatch: {}, cells: [], blockConfirm: false }
    const displayPatch = spokenBind.displayPatch || {}
    const writePatch = spokenBind.writePatch || {}
    const spokenCells = Array.isArray(spokenBind.cells) ? spokenBind.cells : []
    const blockConfirm = spokenBind.blockConfirm === true
    for (let i = 0; i < plan.steps.length; i += 1) {
      const step = plan.steps[i]
      if (!step || !step.kind) continue
      let claimed = Array.isArray(step.where) && step.where.length ? step.where : []
      if (!claimed.length && i === plan.targetIndex && Array.isArray(spec.where) && spec.where.length) {
        claimed = spec.where
      }
      if (!claimed.length) continue
      const schema = await schemaForSlotWhere(step.kind, loaded.vocab, spec.workspace)
      const bound = await bindSlotWhere(step.kind, claimed, loaded.vocab, schema)
      if (bound.error) {
        const err = bound.error
        const missedSpeak = err && err.hint
          ? { speak: String(err.hint) }
          : missSpeak(step.kind, err)
        return await sheet(refuse(String((err && err.error) || 'WHERE_UNBOUND'), missedSpeak.speak), {
          kind: step.kind, no: '', action: recognized.action, clue: plan.no, speech: plan.speech,
          speak: missedSpeak.speak, matches: [],
          ...sheetWhereFromPlan(plan, spec),
          ...(missedSpeak.columnMiss ? { columnMiss: true } : {}),
        })
      }
      step.where = bound.where
    }
    if (spec.related && spec.related.kind) {
      const hopped = await probe({
        kind: recognized.kind, no: plan.no, line: plan.line, workspace: spec.workspace, staffId: spec.staffId,
        vocab: loaded.vocab, structured: true, speech: '', where: (target && target.where) || start.where,
        related: spec.related, asAsk: !!spec.asAsk,
      })
      const rows = (hopped && hopped.ok && hopped.matches && hopped.matches.length)
        ? hopped.matches
        : (hopped && hopped.ok && hopped.no ? [{ no: hopped.no, status: hopped.status, fields: hopped.fields || {} }] : [])
      if (!rows.length) {
        const missed = missSpeak(recognized.kind, hopped && hopped.ok === false ? hopped : { ok: false, error: 'NOT_FOUND' })
        return await sheet(refuse('NOT_FOUND', missed.speak), {
          kind: recognized.kind, no: '', action: recognized.action, clue: plan.no, speech: plan.speech, speak: missed.speak, matches: [],
          ...(missed.columnMiss ? { columnMiss: true } : {}),
        })
      }
      return finishStructured(recognized, rows, hopped, writePatch, plan, spec, loaded, schemaFields, recognized.kind, undefined, extra, displayPatch, spokenCells, blockConfirm)
    }
    if (recognized.action === '新建') {
      const labelNo = looksLikeTicket(plan.no) ? plan.no : '新单'
      const spoken = speakPreview({ kind: recognized.kind, no: labelNo }, {
        ok: true, status: '未建', to: '新建', action: '新建', fingerprint: `new:${recognized.kind}:${labelNo}`, mine: true,
      })
      const issue = !blockConfirm && writePatch && Object.keys(writePatch).length > 0
      const previewId = issue ? `pv_${randomHex(8)}` : ''
      const token = {
        preview_id: previewId, kind: recognized.kind, no: String(plan.no || labelNo).trim(), line: plan.line,
        action: '新建', patch: writePatch, from: '未建', to: '新建', fingerprint: spoken.fingerprint,
        expiresAt: now() + PREVIEW_TTL_MS, used: false, speak: spoken.speak, vocab: loaded.vocab, mapped: recognized.mapped,
        blockConfirm,
      }
      if (issue) tokens.set(previewId, token)
      const fromSlot = nestFromSteps(plan.steps)
      const stepsMeta = planStepsForSheet(plan)
      const hopMeta = sheetWhereFromPlan(plan, spec)
      return await sheet({
        ok: true, ...token, patch: displayPatch, speak: spoken.speak, status: '未建', fields: { ...displayPatch },
        matches: [{ no: labelNo, status: '未建', fields: { ...displayPatch } }],
        cells: spokenCells,
        blockConfirm,
      }, {
        action: '新建', no: labelNo, speech: plan.speech,
        ...(fromSlot ? { from: fromSlot } : {}),
        ...(stepsMeta.length > 1 ? { steps: stepsMeta } : {}),
        ...(hopMeta.where ? { where: hopMeta.where } : {}),
        ...(hopMeta.hopWhere ? { hopWhere: hopMeta.hopWhere } : {}),
      })
    }
    const hopFromPlan = sheetWhereFromPlan(plan, spec)
    const startWhere = (Array.isArray(start.where) && start.where.length)
      ? start.where
      : (Array.isArray(hopFromPlan.hopWhere) && hopFromPlan.hopWhere.length
        ? hopFromPlan.hopWhere
        : (Array.isArray(spec.hopWhere) && spec.hopWhere.length ? spec.hopWhere : undefined))
    const parentFound = await probe({
      ...spec,
      kind: start.kind,
      no: start.no || (plan.steps.length === 1 ? plan.no : ''),
      line: plan.line,
      vocab: loaded.vocab,
      structured: true,
      speech: '',
      where: startWhere,
      related: undefined,
      join: start.join,
      limit: WHERE_LIST_CAP,
    })
    if (!parentFound || parentFound.ok === false) {
      const emptyKind = target.kind
      const missKind = (parentFound && parentFound.error === 'WHERE_UNBOUND') ? start.kind : emptyKind
      const missed = parentFound && parentFound.error === 'NOT_FOUND'
      const filtered = plan.steps.length > 1 || (Array.isArray(startWhere) && startWhere.length > 0)
      if (recognized.action === '现查' && missed && filtered) {
        return settledList(emptyKind, {
          hitTotalState: parentFound && parentFound.hitTotalState === 'incomplete' ? 'incomplete' : 'known',
        })
      }
      const missedSpeak = (parentFound && parentFound.error === 'NO_CONNECTOR')
        ? { speak: `${emptyKind}：没连业务，不能装成已查。` }
        : (writeLookupBound(plan, spec)
          ? { speak: speakConstrainedMiss(missKind, plan, spec) }
          : missSpeak(missKind, parentFound && parentFound.ok === false ? parentFound : { ok: false, error: 'NOT_FOUND' }))
      return await sheet(refuse(parentFound && parentFound.error ? parentFound.error : 'NOT_FOUND', missedSpeak.speak), {
        kind: emptyKind, no: '', action: recognized.action, clue: plan.no, speech: plan.speech, speak: missedSpeak.speak, matches: [],
        ...sheetWhereFromPlan(plan, spec),
        ...(missedSpeak.columnMiss ? { columnMiss: true } : {}),
      })
    }
    const parentMatches = parentFound.matches && parentFound.matches.length
      ? parentFound.matches
      : [{ no: parentFound.no, status: parentFound.status, fields: parentFound.fields || {} }]
    if (plan.steps.length > 1) {
      let matches = parentMatches
      let found = parentFound
      let prevKind = start.kind
      const hitsByKind = new Map()
      hitsByKind.set(start.kind, parentMatches)
      let upstreamIncomplete = parentFound && parentFound.hitTotalState === 'incomplete'
      for (let i = 1; i < plan.steps.length; i += 1) {
        const step = plan.steps[i]
        const hopKind = String(step && step.kind || '').trim()
        if (!hopKind) continue
        if (!matches.length) {
          if (recognized.action === '现查') {
            return settledList(hopKind, { hitTotalState: upstreamIncomplete ? 'incomplete' : 'known' })
          }
          const missed = writeLookupBound(plan, spec)
            ? { speak: speakConstrainedMiss(hopKind, plan, spec) }
            : missSpeak(hopKind, { ok: false, error: 'NOT_FOUND' })
          return await sheet(refuse('NOT_FOUND', missed.speak), {
            kind: hopKind, no: '', action: recognized.action, clue: plan.no, speech: plan.speech, speak: missed.speak, matches: [],
            ...(missed.columnMiss ? { columnMiss: true } : {}),
          })
        }
        const link = hopLinkIds(prevKind, hopKind, matches, extra, step && step.relation)
        const hopped = link.ids.length
          ? await probe({
            kind: hopKind, no: '', workspace: spec.workspace, staffId: spec.staffId, vocab: loaded.vocab,
            structured: true, speech: '', where: step.where, limit: WHERE_LIST_CAP,
            related: { kind: prevKind, ids: link.ids, field: link.field, targetKey: link.targetKey },
          })
          : { ok: false, error: 'NOT_FOUND', matches: [] }
        if (hopped && hopped.hitTotalState === 'incomplete') upstreamIncomplete = true
        const nextRows = keepHoppedMatches(hopped && hopped.matches, link.ids, prevKind, hopKind, extra, link.field)
        if (!nextRows.length) {
          if (recognized.action === '现查') {
            const lookupFailed = hopped && hopped.ok === false && hopped.error && hopped.error !== 'NOT_FOUND'
            return settledList(hopKind, {
              hitTotalState: lookupFailed || upstreamIncomplete ? 'incomplete' : 'known',
            })
          }
          const missed = writeLookupBound(plan, spec)
            ? { speak: speakConstrainedMiss(hopKind, plan, spec) }
            : missSpeak(hopKind, hopped && hopped.ok === false ? hopped : { ok: false, error: 'NOT_FOUND' })
          return await sheet(refuse('NOT_FOUND', missed.speak), {
            kind: hopKind, no: '', action: recognized.action, clue: plan.no, speech: plan.speech, speak: missed.speak, matches: [],
            ...(missed.columnMiss ? { columnMiss: true } : {}),
          })
        }
        matches = stampParentLabels(prevKind, matches, nextRows, hopKind, extra)
        found = hopped
        hitsByKind.set(hopKind, nextRows)
        pruneHopHits(hitsByKind, plan.steps.slice(0, i + 1), extra)
        prevKind = hopKind
      }
      pruneHopHits(hitsByKind, plan.steps, extra)
      const targetRows = hitsByKind.get(target.kind) || matches
      if (upstreamIncomplete && found) found = { ...found, hitTotalState: 'incomplete', hitTotal: null }
      return finishStructured(recognized, targetRows, found, writePatch, plan, spec, loaded, schemaFields, target.kind, hitsByKind, extra, displayPatch, spokenCells, blockConfirm)
    }
    return finishStructured(recognized, parentMatches, parentFound, writePatch, plan, spec, loaded, schemaFields, recognized.kind, undefined, extra, displayPatch, spokenCells, blockConfirm)
  }

  async function finishStructured(recognized, matches, found, writePatch, plan, spec, loaded, schemaFields, kind, hitsByKind, hopExtra, displayPatch = writePatch, spokenCells = [], blockConfirm = false) {
    const sheetKind = kind || recognized.kind
    const matched = Array.isArray(matches) ? matches : []
    const looked = String(plan.no || '').trim()
    const rowClick = spec.picked === true || looksLikeTicket(looked) || looksLikeRef(looked)
    const targetWhere = sheetWhereFromPlan(plan, spec).where
    const writeHits = recognized.action !== '现查' && Array.isArray(targetWhere) && targetWhere.length
      ? rowsMatchingWhere(matched, targetWhere, schemaFields)
      : matched
    const allRows = (recognized.action === '现查' || !rowClick)
      ? writeHits
      : rowsForClickedWrite(writeHits, looked)
    const listing = recognized.action === '现查'
    const page = Number(plan.page) > 0 ? Math.floor(Number(plan.page)) : 1
    const fullBound = spec.confirmSet === true
    let rows = listing && !fullBound
      ? allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      : allRows.slice(0, WHERE_LIST_CAP)
    const { hitTotal, hitTotalState } = listHitAccount(found, allRows, listing)
    const listExtra = listing
      ? {
        querySettled: true,
        hitTotal,
        hitTotalState,
        page,
        pageSize: PAGE_SIZE,
        pageFull: rows.length >= PAGE_SIZE,
      }
      : {
        hitTotal,
        hitTotalState,
        page: 1,
        ...(rows.length ? { pageSize: rows.length } : {}),
      }
    const speak = speakLookup({ kind: sheetKind, no: rows.length === 1 ? rows[0].no : '' }, {
      ...found,
      matches: rows,
      listed: rows.length > 1,
      ambiguous: rows.length > 1,
      hitTotal,
      hitTotalState,
      pageRows: rows.length,
    })
    async function sheet(result, more = {}) {
      const hopFrom = plan.steps && plan.steps.length > 1
        ? String(plan.steps[0].kind || '').trim()
        : ''
      const hopFromWhere = hopFrom && plan.steps[0].where && plan.steps[0].where.length
        ? plan.steps[0].where
        : undefined
      const rawFrom = (more && more.from)
        || nestFromSteps(plan.steps)
        || (hopFrom ? { kind: hopFrom, ...(hopFromWhere ? { where: hopFromWhere } : {}) } : undefined)
      const fromSlot = rawFrom
        ? await decorateFromHits(rawFrom, hitsByKind, {
          vocab: loaded.vocab,
          fieldsOf: opts.fieldsOf,
          collections: hopExtra && hopExtra.collections,
        })
        : undefined
      const stepsMeta = planStepsForSheet(plan)
      const hopMeta = sheetWhereFromPlan(plan, spec)
      const restMore = { ...more }
      delete restMore.from
      const packedPeers = Array.isArray(plan && plan.packedPeers) ? plan.packedPeers : []
      return withSheet(result, {
        vocab: loaded.vocab,
        schemaFields,
        fieldsOf: opts.fieldsOf,
        ...(fromSlot ? { from: fromSlot } : {}),
        ...(stepsMeta.length > 1 ? { steps: stepsMeta } : {}),
        ...(hopMeta.hopWhere ? { hopWhere: hopMeta.hopWhere } : {}),
        ...(packedPeers.length ? { peers: packedPeers } : {}),
        ...(String(spec.askAction || '').trim() ? { askAction: String(spec.askAction).trim() } : {}),
        ...restMore,
      })
    }
    if (recognized.action === '现查') {
      const { where: listWhere, hopWhere } = sheetWhereFromPlan(plan, spec)
      const stepsMeta = planStepsForSheet(plan)
      return await sheet({
        ok: true, kind: sheetKind, no: rows.length === 1 ? rows[0].no : '',
        action: recognized.action, speak, status: found && found.status, fields: rows[0] && rows[0].fields || {},
        matches: rows, fingerprint: found && found.fingerprint,
        listed: rows.length > 1, ambiguous: rows.length > 1,
        workspace: (found && found.workspace) || spec.workspace || '',
      }, {
        ...lookupBindExtra(plan, spec),
        ...(stepsMeta.length > 1 ? { steps: stepsMeta } : {}),
        ...listExtra,
      })
    }
    const previewPatch = previewWritePatch(recognized, writePatch, found, spec, plan, schemaFields)
    const bound = writeLookupBound(plan, spec)
    const missTarget = recognized.action === '过审' && !(previewPatch && Object.keys(previewPatch).length)
    const domain = recognized.action === '过审'
      ? statusDomainOf(schemaFields, recognized.mapped, recognized.kind, found)
      : undefined
    const toolTo = String((spec && spec.to) || (plan && plan.to) || '').trim()
    if (spec.picked === true && rows.length) {
      const hit = matchPickedRow(rows, spec)
      if (!hit) {
        return await sheet(refuse('NO_LOOKUP', '对不上这一行，不能过账。'), {
          kind: sheetKind, action: recognized.action, matches: [], speech: plan.speech,
        })
      }
      rows = [hit]
    }
    if (missTarget) {
      const missSpeak = speakMissTarget(sheetKind, toolTo, domain)
      return await sheet({
        ok: false, error: 'MISS_TARGET', hint: missSpeak, kind: sheetKind, no: rows.length === 1 ? rows[0].no : '',
        action: recognized.action, speak: missSpeak,
        patch: displayPatch && Object.keys(displayPatch).length ? displayPatch : {},
        preview_id: '', matches: rows, cells: spokenCells,
        status: found && found.status, fields: (rows[0] && rows[0].fields) || {},
        fingerprint: found && found.fingerprint,
        workspace: (found && found.workspace) || spec.workspace || '',
        statusDomain: domain,
        to: toolTo || undefined,
      }, { clue: plan.no, speech: plan.speech, ...lookupBindExtra(plan, spec), ...listExtra })
    }
    if (rows.length !== 1) {
      if (bound && !rows.length) {
        return await sheet({
          ok: true, kind: sheetKind, no: '', action: recognized.action,
          speak: speakConstrainedMiss(sheetKind, plan, spec),
          patch: displayPatch, preview_id: '', cells: spokenCells,
          status: found && found.status, fields: {}, matches: [],
          workspace: (found && found.workspace) || spec.workspace || '',
        }, { ...lookupBindExtra(plan, spec), ...listExtra })
      }
      if (!bound) {
        return await sheet(refuse('NO_REF', `${sheetKind}要指出改哪几条，不能整表当预览。`), {
          kind: sheetKind, action: recognized.action, matches: [], speech: plan.speech,
        })
      }
      const listedPatch = recognized.action === '删除'
        ? undefined
        : (previewPatch && Object.keys(previewPatch).length ? previewPatch : displayPatch)
      const mintSet = spec.batch === true
        && boundWriteChange(recognized, previewPatch, writePatch, blockConfirm)
        && rows.length >= 2
      const rowLookups = mintSet ? collectRowLookups(rows, schemaFields, previewPatch) : []
      if (mintSet && rowLookups.length === rows.length) {
        const nos = rowLookups.map((row) => row.no).filter(Boolean)
        const setPatch = recognized.action === '删除' ? undefined : previewPatch
        const approveCol = statusColumn(recognized.mapped, recognized.kind, found)
        const to = recognized.action === '过审'
          ? (statusLabelForCode(schemaFields, setPatch && approveCol ? setPatch[approveCol] : '') || patchSpeak(setPatch))
          : recognized.action === '删除' ? '删除' : patchSpeak(writePatch)
        const fingerprint = setMembershipFingerprint(recognized.kind, rows, setPatch)
        const spoken = speakPreview({ kind: recognized.kind, no: '' }, {
          ok: true, status: rows[0] && rows[0].status, from: rows[0] && rows[0].status, to,
          action: recognized.action, fingerprint, mine: found && found.mine,
        })
        const previewId = `pv_${randomHex(8)}`
        const listBind = tokenListBind(plan, spec)
        const token = {
          preview_id: previewId, kind: recognized.kind, no: '', nos, line: plan.line, action: recognized.action,
          patch: setPatch,
          vocab: loaded.vocab, mapped: recognized.mapped, catalogVersion: catalogVersionOf(loaded.vocab),
          workspace: spec.workspace || '',
          system: String(spec.system || (found && found.system) || '').trim(),
          env: String(spec.env || (found && found.env) || '').trim(),
          connectionId: String((found && found.connectionId) || spec.connectionId || '').trim(),
          from: spoken.from, to: spoken.to || to, fingerprint,
          expiresAt: now() + PREVIEW_TTL_MS, used: false, speak: spoken.speak,
          speech: String(plan.speech || spec.speech || '').trim(),
          sessionId: String(spec.sessionId || '').trim(),
          rowLookups,
          batch: true,
          fromFields: pickFromFields(rows[0] && rows[0].fields, setPatch),
          ...(listBind ? { listBind } : {}),
        }
        tokens.set(previewId, token)
        const sheetPatch = displayPatch && Object.keys(displayPatch).length ? displayPatch : token.patch
        return await sheet({
          ok: true, ...token, patch: sheetPatch, speak: spoken.speak,
          fields: (rows[0] && rows[0].fields) || {}, status: rows[0] && rows[0].status, matches: rows,
          cells: spokenCells, listed: false, ambiguous: false, batch: true, nos,
          statusDomain: domain,
        }, { clue: plan.no, speech: plan.speech, where: tokenListWhere(token), ...listExtra })
      }
      return await sheet({
        ok: true, kind: sheetKind, no: '', action: recognized.action, speak,
        patch: listedPatch,
        status: found && found.status, fields: {}, matches: rows,
        fingerprint: found && found.fingerprint, listed: true, ambiguous: true,
        preview_id: '',
        workspace: (found && found.workspace) || spec.workspace || '',
        cells: spokenCells,
        blockConfirm,
        to: toolTo || undefined,
        statusDomain: domain,
      }, { ...lookupBindExtra(plan, spec), ...listExtra })
    }
    if (recognized.action === '改行' && (!(writePatch && Object.keys(writePatch).length) || blockConfirm)) {
      if (!(writePatch && Object.keys(writePatch).length) && !spokenCells.length) {
        return await sheet(refuse('NO_PATCH', '改行要指出字段。'), {
          kind: sheetKind, no: rows[0].no, action: recognized.action, speech: plan.speech, matches: rows,
        })
      }
      return await sheet({
        ok: true, kind: sheetKind, no: rows[0].no, action: recognized.action,
        speak: speakUnboundWrite(sheetKind, rows[0].no, spokenCells),
        patch: displayPatch, preview_id: '', cells: spokenCells, blockConfirm: true,
        status: found && found.status, fields: (rows[0] && rows[0].fields) || {}, matches: rows,
      }, { clue: plan.no, speech: plan.speech })
    }
    const row = rows[0]
    const rowPk = row && row.fields && row.fields.id != null ? String(row.fields.id).trim() : ''
    const resolvedNo = (looked && rowPk && looked === rowPk)
      ? looked
      : String(row.no || plan.no).trim()
    const change = recognized.action === '改行' ? patchChange(displayPatch, row.fields) : null
    if (recognized.action === '过审' && blockConfirm) {
      return await sheet({
        ok: true, kind: sheetKind, no: resolvedNo, action: recognized.action,
        speak: speakUnboundWrite(sheetKind, resolvedNo, spokenCells),
        patch: displayPatch && Object.keys(displayPatch).length ? displayPatch : {},
        preview_id: '', matches: rows, cells: spokenCells, blockConfirm: true,
        status: found && found.status, fields: (rows[0] && rows[0].fields) || {},
        fingerprint: found && found.fingerprint,
        workspace: (found && found.workspace) || spec.workspace || '',
        statusDomain: domain,
      }, { clue: plan.no, speech: plan.speech })
    }
    const approveCol = statusColumn(recognized.mapped, recognized.kind, found)
    const to = recognized.action === '过审'
      ? (statusLabelForCode(schemaFields, previewPatch && approveCol ? previewPatch[approveCol] : '') || patchSpeak(previewPatch))
      : recognized.action === '删除' ? '删除' : (change && change.speak) || patchSpeak(writePatch)
    const spoken = speakPreview({ kind: recognized.kind, no: resolvedNo }, {
      ok: true, status: row.status, from: change ? change.from : row.status, to,
      action: recognized.action, fingerprint: found && found.fingerprint, mine: found && found.mine,
    })
    const rowLookup = (spec.lookup && spec.lookup.field && spec.lookup.value != null)
      ? { field: String(spec.lookup.field), value: String(spec.lookup.value) }
      : captureWriteIdentity(row, schemaFields)
    if (!rowLookup) {
      return await sheet(refuse('NO_IDENTITY', `${sheetKind}缺身份。`), {
        kind: sheetKind, no: resolvedNo, action: recognized.action, speech: plan.speech, matches: rows,
      })
    }
    const previewId = `pv_${randomHex(8)}`
    const listBind = tokenListBind(plan, spec)
    const token = {
      preview_id: previewId, kind: recognized.kind, no: resolvedNo, line: plan.line, action: recognized.action,
      patch: previewPatch,
      vocab: loaded.vocab, mapped: recognized.mapped, catalogVersion: catalogVersionOf(loaded.vocab),
      workspace: spec.workspace || '',
      system: String(spec.system || (found && found.system) || '').trim(),
      env: String(spec.env || (found && found.env) || '').trim(),
      connectionId: String((found && found.connectionId) || spec.connectionId || '').trim(),
      from: spoken.from, to: spoken.to || to, fingerprint: spoken.fingerprint,
      expiresAt: now() + PREVIEW_TTL_MS, used: false, speak: spoken.speak,
      speech: String(plan.speech || spec.speech || '').trim(),
      sessionId: String(spec.sessionId || '').trim(),
      lookup: rowLookup,
      fromFields: pickFromFields(row && row.fields, previewPatch),
      ...(listBind ? { listBind } : {}),
    }
    tokens.set(previewId, token)
    const sheetPatch = displayPatch && Object.keys(displayPatch).length ? displayPatch : token.patch
    return await sheet({
      ok: true, ...token, patch: sheetPatch, speak: spoken.speak, fields: row.fields || {}, status: row.status, matches: rows,
      cells: spokenCells,
      blockConfirm,
      statusDomain: domain,
      ...(spec.picked === true ? { picked: true } : {}),
    }, { clue: plan.no, speech: plan.speech, where: tokenListWhere(token) })
  }

  async function previewConn(workspace) {
    if (typeof opts.resolveConnections !== 'function') return null
    try {
      const resolved = await opts.resolveConnections()
      const listed = Array.isArray(resolved && resolved.connections) ? resolved.connections : []
      return listed.find((row) => row && row.baseUrl) || null
    } catch {
      return null
    }
  }

  async function bindSpokenPreview(patch, schemaFields, recognized, vocab, workspace) {
    const source = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {}
    const spec = { kind: recognized.kind, mapped: recognized.mapped, vocab }
    const conn = await previewConn(workspace)
    const fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch : null)
    if (conn && typeof opts.collectionsOf === 'function' && (!Array.isArray(conn.collections) || !conn.collections.length)) {
      try {
        const loadedCols = await opts.collectionsOf(workspace)
        if (Array.isArray(loadedCols) && loadedCols.length) conn.collections = loadedCols
      } catch { /* catalog optional */ }
    }
    const ctx = {
      extra: { vocab, collections: conn && conn.collections },
      conn: conn || {},
      fetchImpl,
      schemaFields,
    }
    try {
      return await bindSpokenCells(source, schemaFields, spec, ctx)
    } catch {
      return bindSpokenCells(source, schemaFields, spec, { extra: { vocab }, schemaFields })
    }
  }

  async function preview(spec = {}) {
    spec = coercePreviewSpec(spec)
    const kind = String(spec.kind || '').trim()
    const no = String(spec.no || spec.ticket || '').trim()
    const line = String(spec.line || spec.行号 || '').trim()
    const loaded = await vocabFor(spec.workspace)
    if (!loaded.ok) return refuse(loaded.error, loaded.hint)
    if (spec.saveAsk) {
      const rest = String(spec.askRest || spec.rest || '').trim()
      if (!rest) return refuse('NO_REF', '没有要记的问句。')
      noteAsk(spec.workspace, rest)
      const spoken = loaded.vocab.find((row) => row && (row.spoken || row.kind === '口语' || row.id === 'spoken'))
      const row = spoken || vocabRow(kind, loaded.vocab)
      if (row) row.clues = mergeAskClue(row.clues, rest)
      if (typeof opts.saveVocab === 'function' && row) {
        try {
          await opts.saveVocab(spec.workspace, {
            id: row.id || row.kind || 'spoken',
            label: row.kind || '口语',
            clues: row.clues,
            resource: row.resource,
            ticketField: row.ticketField,
            fields: row.fields,
            can: row.can,
          })
        } catch { /* graph may refuse python upsert; in-memory 问句 still peels */ }
      }
      const again = await vocabFor(spec.workspace)
      if (again.ok) loaded.vocab = again.vocab
      spec.asAsk = true
    }
    const enrichExtra = { vocab: loaded.vocab }
    if (typeof opts.collectionsOf === 'function') {
      try {
        enrichExtra.collections = await opts.collectionsOf(spec.workspace)
      } catch { /* collections optional for enrich */ }
    }
    const identityLookup = spec.lookupLocked === true
      || (spec.rereadAfterWrite === true && spec.confirmSet !== true)
    const frozenSpeech = typeof opts.roundSpeech === 'function'
      ? String(opts.roundSpeech(spec.sessionId) || '').trim()
      : ''
    const userSpeech = identityLookup
      ? ''
      : (frozenSpeech || String(spec.userSpeech || '').trim() || recalledUserSpeech(spec.sessionId))
    const replaying = spec.replay === true && Array.isArray(spec.steps) && spec.steps.length
    if (identityLookup) {
      spec = { ...spec, speech: '', userSpeech: '' }
      const nos = Array.isArray(spec.nos) ? spec.nos.map((item) => String(item || '').trim()).filter(Boolean) : []
      const one = String(spec.no || '').trim() || (nos.length === 1 ? nos[0] : '')
      if (one) spec = { ...spec, no: one }
      else if (nos.length) {
        const mapped = mapKind(String(spec.kind || '').trim(), loaded.vocab)
        const field = ticketColumn(mapped, spec.kind)
        if (field) spec = { ...spec, where: [{ keys: [field], values: nos }] }
        else {
          const parts = []
          for (const n of nos) {
            const part = await preview({
              ...spec,
              no: n,
              nos: undefined,
              where: undefined,
              speech: '',
              userSpeech: '',
              lookupLocked: spec.lookupLocked === true,
              rereadAfterWrite: spec.rereadAfterWrite === true,
            })
            if (part && (part.sheet || part.rows || part.matches)) parts.push(part)
          }
          return mergeIdentityLookups(parts)
        }
      }
    }
    const lookupAction = String(spec.action || '').trim() || '现查'
    const bindOfficialLookup = !replaying
      && spec.picked !== true
      && spec.rereadAfterWrite !== true
      && spec.lookupLocked !== true
      && ['现查', '改行', '删除', '过审', '新建'].includes(lookupAction)
    let enriched = {
      ...spec,
      kind: String(spec.kind || '').trim(),
      action: lookupAction,
      speech: String(spec.speech || spec.quote || '').trim(),
    }
    if (!replaying && spec.lookupLocked === true && String(spec.action || '').trim() === '现查') {
      enriched = { ...enriched, action: '现查' }
      delete enriched.patch
    }
    const catalogExtra = { vocab: loaded.vocab, ...enrichExtra }
    const plan = normalizePlan(enriched)
    let resolvedKind = String(
      (plan.steps[plan.targetIndex] && plan.steps[plan.targetIndex].kind)
      || enriched.kind
      || spec.kind
      || ''
    ).trim()
    const connectedKind = resolveConnectedKindName(resolvedKind, catalogExtra)
    if (connectedKind) {
      resolvedKind = connectedKind
      spec.kind = connectedKind
      enriched.kind = connectedKind
      plan.kind = connectedKind
    }
    if (Array.isArray(plan.steps)) {
      const collapsed = []
      for (const step of plan.steps) {
        if (!step) continue
        const connected = resolveConnectedKindName(step.kind, catalogExtra) || String(step.kind || '').trim()
        if (connected) step.kind = connected
        const prev = collapsed[collapsed.length - 1]
        if (prev && prev.kind === step.kind && !String(step.relation || '').trim()) {
          if ((!Array.isArray(prev.where) || !prev.where.length) && Array.isArray(step.where) && step.where.length) {
            collapsed[collapsed.length - 1] = step
          }
          continue
        }
        collapsed.push(step)
      }
      plan.steps = collapsed
      plan.targetIndex = collapsed.length ? collapsed.length - 1 : 0
    }
    if (spec.from && typeof spec.from === 'object' && spec.from.kind) {
      const connectedFrom = resolveConnectedKindName(spec.from.kind, catalogExtra)
      if (connectedFrom) spec.from = { ...spec.from, kind: connectedFrom }
    }
    const identityNo = String(spec.no || spec.ticket || '').trim()
    if (
      identityNo
      && spec.picked !== true
      && spec.lookupLocked !== true
      && spec.rereadAfterWrite !== true
      && spec.confirmSet !== true
      && !thisCallCarriesBind(spec)
    ) {
      plan.steps = [{
        kind: resolvedKind || String(spec.kind || '').trim(),
        no: identityNo,
        where: [],
        from: '',
        relation: '',
        join: 'and',
      }]
      plan.targetIndex = 0
      plan.no = identityNo
    }
    const missRel = missingPlanRelation(plan, catalogExtra)
    if (missRel) return refuse('NO_RELATION', `${missRel.from}到${missRel.to}缺关系。`)
    const miss = unpreviewablePlanKind(plan, catalogExtra)
    if (miss) return refuse('NO_CONNECTOR', `${miss}：没连业务，不能装成已查。`)
    const writeActs = ['改行', '删除', '过审']
    if (
      !replaying
      && spec.picked !== true
      && spec.lookupLocked !== true
      && spec.rereadAfterWrite !== true
      && writeActs.includes(lookupAction)
      && !writeHasIdentity(plan, spec)
    ) {
      const who = resolvedKind || String(spec.kind || '').trim() || '这张单'
      return refuse('NO_IDENTITY', `${who}缺身份。`)
    }
    const sessionId = String(spec.sessionId || '').trim()
    const workspaceKey = String(spec.workspace || '')
    const settledKey = (plan.action === '现查' && sessionId && !replaying && spec.picked !== true && spec.rereadAfterWrite !== true && spec.confirmSet !== true)
      ? settledHopKey({
        sessionId,
        workspace: workspaceKey,
        userSpeech,
        speech: plan.speech,
        plan,
        spec,
        targetKind: resolvedKind,
      })
      : ''
    if (settledKey) {
      const cached = settledQueries.get(settledKey)
      if (cached && previewSettledLookup(cached)) return materializeSettledRepeat(cached)
    }
    if (spec.picked === true) enriched.picked = true
    if (spec.lookup && spec.lookup.field && spec.lookup.value != null) {
      enriched.lookup = { field: String(spec.lookup.field), value: String(spec.lookup.value) }
    }
    const result = await previewStructured(plan, enriched, loaded)
    if (plan.action === '现查' && bindOfficialLookup && result && typeof result === 'object') {
      result.officialBound = true
      if (result.sheet && typeof result.sheet === 'object') result.sheet.officialBound = true
    }
    if (settledKey && previewSettledLookup(result)) settledQueries.set(settledKey, result)
    return result
  }

  function mergeIdentityLookups(parts) {
    if (!Array.isArray(parts) || !parts.length) return null
    const rows = []
    for (const part of parts) {
      const sheet = part && part.sheet && typeof part.sheet === 'object' ? part.sheet : part
      const list = Array.isArray(sheet && sheet.rows)
        ? sheet.rows
        : (Array.isArray(sheet && sheet.matches) ? sheet.matches : [])
      for (const row of list) if (row) rows.push(row)
    }
    const lead = parts[0].sheet && typeof parts[0].sheet === 'object' ? parts[0].sheet : parts[0]
    const nos = rows.map((row) => String((row && row.no) || '').trim()).filter(Boolean)
    const sheet = {
      ...lead,
      action: '现查',
      preview_id: '',
      canWrite: false,
      speech: '',
      rows,
      nos,
    }
    return { ...parts[0], ok: true, action: '现查', sheet }
  }

  async function rereadWrittenIdentity(token, spec) {
    const kind = String((token && token.kind) || '').trim()
    if (!kind) return null
    const rawNo = String(token.no || '').trim()
    const identityNo = (rawNo && !(token.action === '新建' && rawNo === '新单') ? rawNo : '')
    const nos = Array.isArray(token.nos) ? token.nos.map((item) => String(item || '').trim()).filter(Boolean) : []
    const lookup = token.lookup && token.lookup.field && token.lookup.value != null
      ? { field: String(token.lookup.field), value: String(token.lookup.value) }
      : null
    if (!identityNo && !lookup && !nos.length) return null
    try {
      return await preview({
        kind,
        action: '现查',
        sessionId: String(spec.sessionId || token.sessionId || '').trim(),
        workspace: spec.workspace || token.workspace || '',
        speech: '',
        userSpeech: '',
        rereadAfterWrite: true,
        ...(identityNo ? { no: identityNo } : {}),
        ...(nos.length && !identityNo ? { nos } : {}),
        ...(lookup && !nos.length ? { lookup } : {}),
      })
    } catch {
      return null
    }
  }

  async function rereadBoundSet(token, spec) {
    const bind = token && token.listBind && typeof token.listBind === 'object' ? token.listBind : {}
    try {
      return await preview({
        kind: token.kind,
        action: '现查',
        sessionId: String(spec.sessionId || token.sessionId || '').trim(),
        workspace: spec.workspace || token.workspace || '',
        speech: '',
        userSpeech: '',
        rereadAfterWrite: true,
        confirmSet: true,
        ...(Array.isArray(bind.where) && bind.where.length ? { where: bind.where } : {}),
        ...(bind.from && typeof bind.from === 'object' ? { from: bind.from } : {}),
        ...(Array.isArray(bind.steps) && bind.steps.length ? { steps: bind.steps } : {}),
      })
    } catch {
      return null
    }
  }

  async function withIdentityReread(okResult, token, spec) {
    if (!okResult || okResult.ok === false) return okResult
    const looked = await rereadWrittenIdentity(token, spec)
    const sheet = looked && looked.sheet && typeof looked.sheet === 'object' ? looked.sheet : null
    const identityNo = String(token.no || '').trim()
    const identityNos = new Set(
      identityNo
        ? [identityNo]
        : (Array.isArray(token.nos) ? token.nos.map((item) => String(item || '').trim()).filter(Boolean) : []),
    )
    const rows = sheet && Array.isArray(sheet.rows) ? sheet.rows : []
    const identityRows = rows.filter((row) => {
      if (!row || typeof row !== 'object') return false
      const no = String(row.no || '').trim()
      if (!no) return false
      return identityNos.size ? identityNos.has(no) : true
    })
    if (!sheet || identityRows.length <= 0) return okResult
    return {
      ...okResult,
      sheet: {
        ...sheet,
        action: '现查',
        preview_id: '',
        canWrite: false,
        querySettled: true,
        wroteReceipt: true,
        speech: '',
        rows: identityRows,
        ...(identityNo ? { no: identityNo, lookupNo: identityNo } : { nos: [...identityNos] }),
      },
    }
  }

  async function writeBoundSet(token, spec, previewId, traceId, schemaFields) {
    const frozenNos = Array.isArray(token.nos) ? token.nos.map((item) => String(item || '').trim()).filter(Boolean) : []
    const live = await rereadBoundSet(token, spec)
    const liveSheet = live && live.sheet && typeof live.sheet === 'object' ? live.sheet : live
    const liveRows = liveSheet && Array.isArray(liveSheet.rows) ? liveSheet.rows : []
    const liveNos = liveRows.map((row) => String((row && row.no) || '').trim()).filter(Boolean)
    if (!sameNos(liveNos, frozenNos)) {
      return refuse('STALE', '刚才那版不是现在这版。不要拿旧预览去写。')
    }
    const liveByNo = new Map()
    for (const row of liveRows) {
      const no = String((row && row.no) || '').trim()
      if (no) liveByNo.set(no, row)
    }
    const rowLookups = Array.isArray(token.rowLookups) ? token.rowLookups : []
    for (const row of rowLookups) {
      const liveRow = liveByNo.get(String((row && row.no) || '').trim())
      const found = liveRow
        ? {
          ok: true,
          no: liveRow.no,
          status: liveRow.status,
          fields: liveRow.fields || {},
        }
        : { ok: false, error: 'NO_LOOKUP' }
      const hold = patchedFieldsHold({
        ...token,
        fromFields: row && row.fromFields,
      }, found, schemaFields)
      if (!hold.ok) return { ok: false, error: hold.error, hint: hold.hint }
    }
    const ref = { kind: token.kind, no: frozenNos[0] || '' }
    token.posting = true
    tokens.set(previewId, token)
    if (typeof opts.postWrite !== 'function') {
      token.used = true
      token.posting = false
      tokens.set(previewId, token)
      const spoken = speakReceipt(ref, {})
      return withIdentityReread({
        ok: true, receiptId: '', preview_id: previewId, trace_id: traceId, speak: spoken.speak, kind: spoken.kind,
      }, token, spec)
    }
    const written = []
    for (const row of rowLookups) {
      const liveRow = liveByNo.get(String((row && row.no) || '').trim())
      let posted
      try {
        posted = await opts.postWrite(writeMouthSpec(token, {
          no: row.no,
          lookup: row.lookup,
          fields: (liveRow && liveRow.fields) || {},
          workspace: spec.workspace || token.workspace,
          preview_id: previewId,
          trace_id: traceId,
        }))
      } catch (error) {
        posted = { ok: false, failed: true, error: error instanceof Error ? error.message : String(error) }
      }
      if (!posted || posted.ok === false || posted.failed) {
        token.posting = false
        tokens.set(previewId, token)
        const spoken = speakReceipt({ kind: token.kind, no: row.no }, { failed: true })
        const hint = String((posted && posted.hint) || spoken.speak)
        return {
          ok: false,
          error: 'WRITE_FAILED',
          failed: true,
          hint,
          speak: hint,
          kind: spoken.kind,
          preview_id: previewId,
          no: row.no,
        }
      }
      written.push(row.no)
    }
    token.used = true
    token.posting = false
    tokens.set(previewId, token)
    let verified = true
    if (token.patch && Object.keys(token.patch).length && (token.action === '改行' || token.action === '过审')) {
      for (const no of written) {
        const after = await probeRow({
          kind: token.kind, no, line: token.line,
          workspace: token.workspace, vocab: token.vocab, mapped: token.mapped,
        })
        if (!patchApplied(token.patch, after && after.fields, schemaFields)) {
          verified = false
          break
        }
      }
    }
    const receiptId = written.length ? `set:${written.length}` : ''
    if (traceId) await traces.remember(traceId, spec.workspace || token.workspace, {
      kind: token.kind, no: written.join(','), action: token.action, receiptId, sessionId: spec.sessionId || token.sessionId,
    })
    const spoken = speakReceipt({ kind: token.kind, no: written[0] || '' }, { receiptId, ok: true })
    const hint = verified ? undefined : '业务已收，回读对不上。'
    return withIdentityReread({
      ok: true,
      receiptId,
      no: written[0] || '',
      nos: written,
      preview_id: previewId,
      trace_id: traceId,
      speak: hint ? `${spoken.speak}${hint}` : spoken.speak,
      kind: spoken.kind,
      verified,
      ...(hint ? { hint } : {}),
    }, token, spec)
  }

  async function write(spec = {}) {
    const previewId = String(spec.preview_id || spec.previewId || '').trim()
    if (!previewId) return refuse('NEED_PREVIEW', '先预览。旧画面不能拿去写。')
    const token = tokens.get(previewId)
    if (!token) return refuse('NEED_PREVIEW', '先预览。没有这张令牌，不能写。')
    if (token.used) return refuse('USED', '这张预览已经用过。要写再预览一次。')
    if (token.posting) return refuse('USED', '正在过账。')
    if (now() > Number(token.expiresAt || 0)) return refuse('EXPIRED', '预览过期了。要写再预览一次。')
    const traceId = String(spec.trace_id || spec.traceId || '').trim()
    if (traceId && await traces.seen(traceId, spec.workspace || token.workspace)) {
      return refuse('DUP_TRACE', '同一笔只许成功一次。')
    }
    if (token.action === '改行' && (!token.patch || !Object.keys(token.patch).length)) {
      return refuse('NO_PATCH', '改行要指出字段。')
    }
    if (token.action === '过审' && (!token.patch || !Object.keys(token.patch).length)) {
      return refuse('NO_PATCH', '过审要指出落到哪一档。')
    }
    if (token.action === '新建' && (!token.patch || !Object.keys(token.patch).length)) {
      return refuse('NO_PATCH', '空牌不能过账。')
    }
    if (token.blockConfirm) return refuse('UNBOUND', '这一格对不上')
    const writeExtra = { vocab: token.vocab }
    if (typeof opts.collectionsOf === 'function') {
      try {
        writeExtra.collections = await opts.collectionsOf(spec.workspace || token.workspace)
      } catch { /* catalog optional */ }
    }
    const connectedWrite = resolveConnectedKindName(token.kind, writeExtra)
    if (connectedWrite) token.kind = connectedWrite
    if (leftoverKindMissingFromCatalog(token.kind, writeExtra)) {
      return refuse('NO_CONNECTOR', `${token.kind}：没连业务，不能装成已过账。`)
    }
    if (connectorCatalogPresent(writeExtra) && !resolveConnectedKindName(token.kind, writeExtra) && !mapKind(token.kind, writeExtra)) {
      return refuse('NO_CONNECTOR', `${token.kind}：没连业务，不能装成已过账。`)
    }
    if (token.catalogVersion) {
      const live = await vocabFor(spec.workspace || token.workspace)
      const nowVersion = live && live.ok ? catalogVersionOf(live.vocab) : catalogVersionOf(token.vocab)
      if (nowVersion && nowVersion !== token.catalogVersion) {
        return refuse('STALE_CATALOG', '目录已发布新版本。要写再预览一次。')
      }
    }
    let lookup
    let rowFields
    const schemaFields = collectionFields(token.mapped && token.mapped.resource, writeExtra.collections)
    if (token.action !== '新建' && isSetWriteToken(token)) {
      return writeBoundSet(token, spec, previewId, traceId, schemaFields)
    }
    if (token.action !== '新建') {
      lookup = (token.lookup && token.lookup.field && token.lookup.value != null)
        ? { field: String(token.lookup.field), value: String(token.lookup.value) }
        : null
      if (!lookup) return refuse('NO_LOOKUP', '对不上这一行，不能过账。')
      let found
      if (typeof opts.lookupTodo === 'function') {
        found = await opts.lookupTodo({
          kind: token.kind,
          no: '',
          line: token.line,
          workspace: token.workspace,
          vocab: token.vocab,
          mapped: token.mapped,
          speech: '',
          where: [{ keys: [lookup.field], values: [lookup.value] }],
        })
      }
      if (!found || found.ok === false) {
        return refuse('NO_LOOKUP', '对不上这一行，不能过账。')
      }
      const hold = patchedFieldsHold(token, found, schemaFields)
      if (!hold.ok) return { ok: false, error: hold.error, hint: hold.hint }
      rowFields = found.fields
    } else {
      lookup = token.lookup || null
    }
    const ref = { kind: token.kind, no: token.no }
    token.posting = true
    tokens.set(previewId, token)
    if (typeof opts.postWrite !== 'function') {
      token.used = true
      token.posting = false
      tokens.set(previewId, token)
      const spoken = speakReceipt(ref, {})
      return withIdentityReread({
        ok: true, receiptId: '', preview_id: previewId, trace_id: traceId, speak: spoken.speak, kind: spoken.kind,
      }, token, spec)
    }
    let posted
    try {
      posted = await opts.postWrite(writeMouthSpec(token, {
        lookup,
        fields: rowFields,
        workspace: spec.workspace || token.workspace,
        preview_id: previewId,
        trace_id: traceId,
      }))
    } catch (error) {
      posted = { ok: false, failed: true, error: error instanceof Error ? error.message : String(error) }
    }
    if (!posted || posted.ok === false || posted.failed) {
      token.posting = false
      tokens.set(previewId, token)
      const spoken = speakReceipt(ref, { failed: true })
      const hint = String((posted && posted.hint) || spoken.speak)
      return {
        ok: false,
        error: 'WRITE_FAILED',
        failed: true,
        hint,
        speak: hint,
        kind: spoken.kind,
        preview_id: previewId,
      }
    }
    token.used = true
    token.posting = false
    const postedNo = String((posted && posted.no) || '').trim()
    const planNo = String(token.no || '').trim()
    const createNo = postedNo || (planNo && planNo !== '新单' && looksLikeTicket(planNo) ? planNo : '')
    if (token.action === '新建' && createNo) {
      token.no = createNo
      ref.no = createNo
    }
    tokens.set(previewId, token)
    let verified = true
    let verifyHint
    if (token.action === '新建') {
      if (!createNo) {
        verified = false
        verifyHint = '写了但没回单号。'
      } else {
        const after = await probeRow({
          kind: token.kind, no: createNo, line: token.line,
          workspace: token.workspace, vocab: token.vocab, mapped: token.mapped,
        })
        verified = Boolean(after && after.ok !== false && (String(after.no || '').trim() || (after.fields && Object.keys(after.fields).length)))
      }
    } else if (token.patch && Object.keys(token.patch).length && (token.action === '改行' || token.action === '过审')) {
      const after = await probeRow({
        kind: token.kind, no: ref.no, line: token.line,
        workspace: token.workspace, vocab: token.vocab, mapped: token.mapped,
      })
      verified = patchApplied(token.patch, after && after.fields, schemaFields)
    }
    const receiptId = String(posted.receiptId || '').trim()
    if (traceId) await traces.remember(traceId, spec.workspace || token.workspace, {
      kind: token.kind, no: ref.no, action: token.action, receiptId, sessionId: spec.sessionId || token.sessionId,
    })
    const spoken = speakReceipt(ref, { receiptId, ok: true })
    const hint = verified ? undefined : (verifyHint || '业务已收，回读对不上。')
    return withIdentityReread({
      ok: true,
      receiptId,
      no: ref.no,
      preview_id: previewId,
      trace_id: traceId,
      speak: hint ? `${spoken.speak}${hint}` : spoken.speak,
      kind: spoken.kind,
      verified,
      ...(hint ? { hint } : {}),
    }, token, spec)
  }

  async function fileAskClue(spec = {}) {
    const rest = String(spec.rest || spec.askRest || '').trim()
    const kind = String(spec.kind || '').trim()
    const speech = String(spec.speech || spec.quote || '').trim()
    if (!rest || !kind) return refuse('NO_REF', '没有要记的问句。')
    const loaded = await vocabFor(spec.workspace)
    if (!loaded.ok) return refuse(loaded.error, loaded.hint)
    const row = vocabRow(kind, loaded.vocab)
    if (!row) return refuse('UNKNOWN_KIND', `${kind}没登记。词表和连接器都要有，不能装成能写。`)
    const clues = mergeAskClue(row.clues, rest)
    if (typeof opts.saveVocab === 'function') {
      const saved = await opts.saveVocab(spec.workspace, {
        id: row.id || kind,
        label: kind,
        clues,
        resource: row.resource,
        ticketField: row.ticketField,
        fields: row.fields,
        can: row.can,
      })
      if (saved && saved.ok === false) return refuse(saved.error || 'NO_VOCAB', saved.hint || '问句没记上。')
    }
    return preview({
      kind,
      no: '',
      action: spec.action || '现查',
      speech,
      patch: spec.patch,
      workspace: spec.workspace,
      staffId: spec.staffId,
      sessionId: spec.sessionId,
      asAsk: true,
      saveAsk: false,
      askRest: rest,
    })
  }

  function previewTokenIndex() {
    const index = {}
    const t = now()
    for (const [id, token] of tokens.entries()) {
      const key = String(id || '').trim()
      if (!key || !token) continue
      if (token.used) index[key] = 'used'
      else if (t > Number(token.expiresAt || 0)) index[key] = 'expired'
      else index[key] = 'open'
    }
    return index
  }

  return { preview, write, fileAskClue, tokens, previewTokenIndex }
}

const FIELD_SPEAK = new Map([
  ['phone', '电话'], ['mobile', '电话'], ['电话', '电话'], ['手机', '电话'],
  ['remark', '备注'], ['remarks', '备注'], ['notes', '备注'], ['备注', '备注'],
  ['status', '状态'], ['状态', '状态'],
  ['address', '地址'], ['地址', '地址'],
  ['warehouse', '仓库'], ['仓库', '仓库'],
  ['supplier', '供应商'], ['供应商', '供应商'],
  ['customer', '客户'], ['客户', '客户'],
  ['contract', '合同'], ['合同', '合同'],
  ['employee', '员工'], ['员工', '员工'],
  ['contact', '联系人'], ['联系人', '联系人'],
  ['position', '职位'], ['职位', '职位'],
  ['name', '名称'], ['title', '名称'], ['名称', '名称'],
  ['owner', '负责人'], ['负责人', '负责人'],
  ['assignee', '负责人'], ['createdBy', '用户'], ['updatedBy', '用户'],
  ['updatedAt', '更新时间'], ['updated_at', '更新时间'],
  ['priority', '优先级'], ['优先级', '优先级'],
  ['category', '类别'], ['类别', '类别'], ['分类', '类别'],
  ['amount', '金额'], ['total', '金额'], ['金额', '金额'],
  ['qty', '数量'], ['quantity', '数量'], ['数量', '数量'],
  ['enddate', '到期日'], ['duedate', '到期日'], ['expire', '到期日'], ['到期日', '到期日'],
])

function fieldSpeak(key) {
  const name = String(key || '').trim()
  if (!name) return '该行'
  const hit = FIELD_SPEAK.get(name) || FIELD_SPEAK.get(name.toLowerCase())
  if (hit) return hit
  if (/电话|手机/.test(name)) return '电话'
  if (/remark|notes|备注/i.test(name)) return '备注'
  if (/status|状态/i.test(name)) return '状态'
  if (/address|地址/i.test(name)) return '地址'
  if (/warehouse/i.test(name)) return '仓库'
  if (/contact/i.test(name)) return '联系人'
  if (/position|职位/i.test(name)) return '职位'
  if (/名称|title/i.test(name)) return '名称'
  if (/owner|负责人/i.test(name)) return '负责人'
  if (/priority|优先级/i.test(name)) return '优先级'
  if (/category|类别|分类/i.test(name)) return '类别'
  if (/amount|金额|total/i.test(name)) return '金额'
  if (/qty|quantity|数量/i.test(name)) return '数量'
  if (/endDate|dueDate|expire/i.test(name)) return '到期日'
  return name
}

function scalarField(value) {
  if (value == null || value === '') return ''
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) return value.map((item) => scalarField(item)).filter(Boolean).join(',')
  return String(value.value ?? value.code ?? value.name ?? value.label ?? '').trim()
}

function rowPatchMoves(row, changePatch, action, fromFallback) {
  const patch = changePatch && typeof changePatch === 'object' ? changePatch : {}
  const fields = (row && row.fields && typeof row.fields === 'object') ? row.fields : {}
  const fromBase = String((row && row.status) || fromFallback || '').trim()
  return Object.keys(patch).some((key) => {
    const to = String(patch[key] ?? '').trim()
    const from = (fieldValue(fields, key) || fromBase).trim()
    if (action === '新建') return Boolean(to)
    return Boolean(to) && to !== from
  })
}

function fieldValue(fields, key) {
  if (!fields || typeof fields !== 'object') return ''
  const want = String(key || '').trim()
  if (fields[want] != null && fields[want] !== '') return scalarField(fields[want])
  const aliases = {
    phone: ['phone', 'mobile', 'tel', 'telephone', '电话', '手机'],
    mobile: ['mobile', 'phone', 'tel', '电话', '手机'],
    remark: ['remark', 'remarks', 'notes', 'note', '备注'],
    remarks: ['remarks', 'remark', 'notes', 'note', '备注'],
    notes: ['notes', 'note', 'remarks', 'remark', '备注'],
    备注: ['备注', 'remarks', 'remark', 'notes', 'note'],
    address: ['address', 'addr', '地址'],
    地址: ['地址', 'address', 'addr'],
  }
  for (const name of aliases[want] || []) {
    if (fields[name] != null && fields[name] !== '') return scalarField(fields[name])
  }
  return ''
}

function patchChange(patch, fields) {
  if (!patch || typeof patch !== 'object') return null
  const keys = Object.keys(patch)
  if (!keys.length) return null
  const parts = keys.map((key) => {
    const label = fieldSpeak(key)
    const next = String(patch[key] ?? '').trim()
    const prev = fieldValue(fields, key)
    if (prev && next) return `将${label}从 ${prev} 改为 ${next}`
    if (next) return `将${label}改为 ${next}`
    return `将改${label}`
  })
  return {
    speak: parts.join('；'),
    from: fieldValue(fields, keys[0]) || '',
    to: String(patch[keys[0]] ?? '').trim(),
  }
}

function rowHasField(fields, key) {
  if (!fields || typeof fields !== 'object') return false
  const want = String(key || '').trim()
  if (!want) return false
  if (Object.prototype.hasOwnProperty.call(fields, want)) return true
  const aliases = {
    phone: ['phone', 'mobile', 'tel', 'telephone', '电话', '手机'],
    mobile: ['mobile', 'phone', 'tel', '电话', '手机'],
    remark: ['remark', 'remarks', 'notes', 'note', '备注'],
    remarks: ['remarks', 'remark', 'notes', 'note', '备注'],
    notes: ['notes', 'note', 'remarks', 'remark', '备注'],
    备注: ['备注', 'remarks', 'remark', 'notes', 'note'],
    address: ['address', 'addr', '地址'],
    地址: ['地址', 'address', 'addr'],
  }
  return (aliases[want] || []).some((name) => Object.prototype.hasOwnProperty.call(fields, name))
}

export function patchApplied(patch, fields, schemaFields) {
  if (!patch || typeof patch !== 'object') return true
  if (!fields || typeof fields !== 'object') return false
  return Object.keys(patch).every((key) => {
    if (!rowHasField(fields, key)) return false
    return fieldMatchesPatch(fields, key, patch[key], schemaFields)
  })
}

function fieldMatchesPatch(fields, key, wantRaw, schemaFields) {
  const want = String(wantRaw ?? '').trim()
  const got = fieldValue(fields, key)
  if (!want) return !got
  if (got === want) return true
  const packed = enumMap(schemaFieldNamed(schemaFields, key))
  if (packed && Object.keys(packed).length) {
    for (const [code, label] of Object.entries(packed)) {
      const lab = String(label || '').trim()
      if (want !== String(code) && want !== lab) continue
      if (got === String(code) || got === lab) return true
    }
  }
  return false
}

function schemaFieldNamed(schemaFields, key) {
  const want = String(key || '').trim()
  if (!want) return null
  return (Array.isArray(schemaFields) ? schemaFields : []).find((row) => {
    const name = typeof row === 'string' ? row : (row && row.name)
    return String(name || '') === want
  }) || null
}

function tokenListWhere(token) {
  if (!token || typeof token !== 'object') return undefined
  const bind = token.listBind && Array.isArray(token.listBind.where) ? token.listBind.where : null
  if (bind && bind.length) return bind
  if (Array.isArray(token.where) && token.where.length) return token.where
  return undefined
}

function pickFromFields(fields, patch) {
  if (!patch || typeof patch !== 'object') return undefined
  const src = fields && typeof fields === 'object' ? fields : {}
  const out = {}
  for (const key of Object.keys(patch)) {
    out[key] = rowHasField(src, key) ? src[key] : ''
  }
  return out
}

function patchedFieldsHold(token, found, schemaFields) {
  if (!found || found.ok === false) {
    return { ok: false, error: 'NO_LOOKUP', hint: '点头前再查失败。没连上，不能装成已过账。' }
  }
  const patch = token && token.patch && typeof token.patch === 'object' ? token.patch : null
  if (!patch || !Object.keys(patch).length) return { ok: true }
  const fromFields = token && token.fromFields && typeof token.fromFields === 'object' ? token.fromFields : {}
  const fields = found.fields && typeof found.fields === 'object' ? found.fields : {}
  for (const key of Object.keys(patch)) {
    if (fieldMatchesPatch(fields, key, patch[key], schemaFields)) continue
    if (fieldMatchesPatch(fields, key, scalarField(fromFields[key]), schemaFields)) continue
    return { ok: false, error: 'STALE', hint: '刚才那版不是现在这版。不要拿旧预览去写。' }
  }
  return { ok: true }
}

function writeMouthSpec(token, extra = {}) {
  return {
    kind: token.kind,
    no: extra.no || token.no,
    line: token.line,
    action: token.action,
    patch: token.patch,
    lookup: extra.lookup || token.lookup,
    fields: extra.fields,
    mapped: token.mapped,
    vocab: token.vocab,
    connectionId: token.connectionId,
    workspace: extra.workspace || token.workspace,
    preview_id: extra.preview_id,
    trace_id: extra.trace_id,
    sessionId: token.sessionId,
    system: token.system,
    env: token.env,
  }
}

function patchSpeak(patch) {
  if (!patch || typeof patch !== 'object') return '该行'
  const keys = Object.keys(patch)
  return keys.length ? keys.map((key) => fieldSpeak(key)).join('、') : '该行'
}

/**
 * Optional write mouth. Never used by lookup GET.
 * @param {{
 *   resolve?: () => Promise<Record<string, unknown>>,
 *   fetchImpl?: typeof fetch,
 * }} [opts]
 */
export function createNocoWrite(opts = {}) {
  const fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch : null)
  return {
    async write(spec) {
      const resolved = typeof opts.resolve === 'function' ? await opts.resolve() : {}
      const extra = { ...resolved, vocab: ensureSpoken(spec.vocab || resolved.vocab) }
      const listed = Array.isArray(extra.connections) ? extra.connections : []
      const wanted = String(spec.connectionId || '').trim()
      const conn = listed.find((row) => row && row.baseUrl && (!wanted || row.id === wanted)) || listed.find((row) => row && row.baseUrl) || extra
      const baseUrl = String((conn && conn.baseUrl) || '').replace(/\/+$/, '')
      const token = String((conn && conn.token) || extra.token || '')
      if (!baseUrl) return { ok: false, error: 'NO_CONNECTOR' }
      if (!fetchImpl) return { ok: false, error: 'NO_FETCH' }
      const vocab = spec.vocab || extra.vocab
      const mapped = spec.mapped && spec.mapped.resource
        ? spec.mapped
        : mapKind(spec.kind, { vocab, kinds: conn && conn.kinds, collections: conn && conn.collections })
      if (!mapped) return { ok: false, error: 'UNKNOWN_KIND' }
      const look = spec.line || spec.no
      if (spec.action !== '新建' && !look) return { ok: false, error: 'NO_REF' }
      let schemaFields = []
      if (spec.kind && conn.collections) {
        schemaFields = collectionFields(mapped.resource, conn.collections)
      }
      let values
      if (spec.action === '过审') {
        const fromPatch = spec.patch && typeof spec.patch === 'object' && !Array.isArray(spec.patch)
          ? spec.patch
          : null
        if (fromPatch && Object.keys(fromPatch).length) {
          values = await shapePatch(fromPatch, { ...spec, vocab }, { extra: { ...extra, vocab }, conn, fetchImpl, schemaFields })
        } else {
          const col = statusColumn(mapped, spec.kind, conn)
          const code = toolToStatusCode(schemaFields, spec.to, col)
          values = col && code ? { [col]: code } : null
        }
        if (!values || !Object.keys(values).length) {
          return { ok: false, failed: true, error: 'NO_PATCH', hint: '过审下一状态收成不了枚举 code。' }
        }
      } else if (spec.action === '删除') {
        values = undefined
      } else {
        values = await shapePatch(spec.patch, { ...spec, vocab }, { extra: { ...extra, vocab }, conn, fetchImpl, schemaFields })
      }
      const identity = spec.action === '新建'
        ? null
        : resolveWriteIdentity(spec, look, schemaFields, mapped)
      if (spec.action !== '新建' && !identity) {
        return { ok: false, failed: true, error: 'NO_LOOKUP', hint: '对不上这一行，不能过账。' }
      }
      const dest = writeDest(conn, mapped, look, spec.action, spec.kind, identity)
      if (!dest) return { ok: false, error: 'NO_WRITE_PATH', failed: true }
      const dialect = String((conn && conn.dialect) || 'nocobase') === 'rest' ? 'rest' : 'nocobase'
      const body = dest.method === 'GET' || dest.method === 'DELETE' || !values
        ? undefined
        : JSON.stringify(dialect === 'rest' ? { values } : values)
      let res
      try {
        res = await fetchImpl(dest.url, {
          method: dest.method,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body,
        })
      } catch {
        return { ok: false, failed: true, error: 'UNREACHABLE' }
      }
      if (!res || !res.ok) {
        let reply = {}
        try { reply = await res.json() } catch { reply = {} }
        return { ok: false, failed: true, error: 'WRITE', hint: writeFailSpeak(reply) }
      }
      let reply = {}
      try { reply = await res.json() } catch { reply = {} }
      if (spec.action !== '新建' && affectedWriteCount(reply) <= 0) {
        return { ok: false, failed: true, error: 'WRITE_FAILED', hint: '业务回了，但没有改到行。不能记已处理。' }
      }
      const receiptId = pickReceiptId(reply)
      const created = createdNo(reply, mapped, extra)
      return { ok: true, receiptId, no: created || receiptId }
    },
  }
}

export async function shapePatch(patch, spec, ctx = {}) {
  if (!patch || typeof patch !== 'object') return {}
  const extra = ctx.extra || spec
  const schemaFields = Array.isArray(ctx.schemaFields) ? ctx.schemaFields : []
  const ident = new Set(saysOf(extra, '单号列').filter((item) => /No$|^code$|^no$|^id$/i.test(item)).map((item) => String(item).toLowerCase()).concat(['no']))
  const out = {}
  for (const [key, value] of Object.entries(patch)) {
    const name = String(key || '').trim()
    if (!name) continue
    if (/^(customer|supplier|owner|assignee)(Phone|Mobile|Tel|Telephone)$/i.test(name)) continue
    if (/phone|mobile|tel|telephone|电话|手机/i.test(name) && !contactKind(spec)) continue
    if (ident.has(name.toLowerCase()) && !looksLikeRef(value)) continue
    if (ident.has(name.toLowerCase()) && looksLikeRef(value)) {
      const field = ticketColumn(spec.mapped, spec.kind) || name
      if (field && field !== 'no') out[field] = value
      else if (name !== 'no') out[name] = value
      continue
    }
    const rel = relationSchemaField(schemaFields, name)
    if (rel) {
      if (value == null || value === '') continue
      const writeKey = fkColumnForRelation(rel, name)
      if (/^\d+$/.test(String(value))) {
        out[writeKey] = String(value)
        continue
      }
      const id = await resolveRelatedId(name, value, spec, { ...ctx, fieldRow: rel })
      if (id) out[writeKey] = id
      continue
    }
    if (/Id$/i.test(name)) {
      const stem = name.replace(/Id$/i, '')
      const relId = relationSchemaField(schemaFields, stem)
      if (/^\d+$/.test(String(value))) out[name] = String(value)
      else if (relId) {
        const id = await resolveRelatedId(stem, value, spec, { ...ctx, fieldRow: relId })
        if (id) out[name] = id
      }
      continue
    }
    if (/^(备注|remark|remarks|notes)$/i.test(name) && orderLike(spec)) {
      out.remarks = value
      continue
    }
    out[name] = value
  }
  return out
}

function writeFailSpeak(reply) {
  if (!reply || typeof reply !== 'object') return ''
  const bits = []
  if (Array.isArray(reply.errors)) {
    for (const row of reply.errors) {
      if (typeof row === 'string') bits.push(row)
      else if (row && typeof row === 'object') bits.push(String(row.message || row.field || '').trim())
    }
  }
  const msg = String(reply.message || reply.error || '').trim()
  if (msg) bits.push(msg)
  return [...new Set(bits.filter(Boolean))].join('；')
}

function contactKind(spec) {
  const resource = String((spec && spec.mapped && spec.mapped.resource) || '').toLowerCase()
  return /customer|contact|supplier/.test(resource)
}

function orderLike(spec) {
  const resource = String((spec && spec.mapped && spec.mapped.resource) || '').toLowerCase()
  return /order/.test(resource) && !/item/.test(resource)
}

function createdNo(reply, mapped, extra) {
  const first = reply && (Array.isArray(reply.data) ? reply.data[0] : (reply.data && typeof reply.data === 'object' ? reply.data : reply))
  if (!first || typeof first !== 'object') return String(pickReceiptId(reply) || '').trim()
  return pickNo(first, mapped && mapped.fields, extra) || String(first.id != null ? first.id : '').trim() || pickReceiptId(reply)
}

function pickReceiptId(reply) {
  if (!reply || typeof reply !== 'object') return ''
  if (reply.data != null && typeof reply.data !== 'object') return String(reply.data).trim()
  const first = Array.isArray(reply.data) ? reply.data[0] : reply.data
  const raw = reply.receiptId
    || reply.id
    || (first && typeof first === 'object' && (first.receiptId || first.id))
    || ''
  return String(raw || '').trim()
}

function toolToStatusCode(schemaFields, to, statusCol) {
  const want = String(to || '').trim()
  if (!want) return ''
  const fields = Array.isArray(schemaFields) ? schemaFields : []
  const named = String(statusCol || '').trim()
  const scan = named
    ? fields.filter((field) => String((field && field.name) || '') === named)
    : fields
  let sawEnum = false
  for (const field of scan) {
    const packed = enumMap(field)
    if (!packed || typeof packed !== 'object') continue
    if (!Object.keys(packed).length) continue
    sawEnum = true
    for (const [code, label] of Object.entries(packed)) {
      if (want === String(code) || want === String(label || '').trim()) return String(code)
    }
  }
  return sawEnum ? '' : want
}

function previewWritePatch(recognized, writePatch, found, spec, plan, schemaFields) {
  const act = String(recognized.action || '').trim()
  if (act === '改行') {
    return writePatch && Object.keys(writePatch).length ? { ...writePatch } : undefined
  }
  if (act !== '过审') return undefined
  if (writePatch && Object.keys(writePatch).length) return { ...writePatch }
  const toolTo = String((spec && spec.to) || (plan && plan.to) || '').trim()
  const col = statusColumn(recognized.mapped, recognized.kind, found)
  const code = toolToStatusCode(schemaFields, toolTo, col)
  if (!col || !code) return undefined
  return { [col]: code }
}

function statusDomainOf(schemaFields, mapped, kind, found) {
  const col = statusColumn(mapped, kind, found)
  if (!col) return undefined
  const fields = Array.isArray(schemaFields) ? schemaFields : []
  const row = fields.find((item) => {
    const name = typeof item === 'string' ? item : (item && item.name)
    return String(name || '') === col
  })
  if (!row || typeof row !== 'object') return undefined
  const packed = (row.enums && typeof row.enums === 'object' && !Array.isArray(row.enums) && Object.keys(row.enums).length)
    ? row.enums
    : enumMap(row)
  if (!packed || !Object.keys(packed).length) return undefined
  return { field: col, enums: packed }
}

function speakMissTarget(kind, to, domain) {
  const who = String(kind || '').trim() || '这张单'
  const want = String(to || '').trim() || '这一档'
  const pairs = domain && domain.enums && typeof domain.enums === 'object'
    ? Object.entries(domain.enums)
      .map(([code, label]) => `${code}=${String(label || '').trim() || code}`)
      .filter(Boolean)
      .join('、')
    : ''
  const head = `${who}状态对不上「${want}」。`
  return pairs ? `${head}这档是${pairs}。` : `${head}这档对不上。`
}

function boundWriteChange(recognized, previewPatch, writePatch, blockConfirm) {
  const act = String((recognized && recognized.action) || '').trim()
  if (act === '删除') return true
  if (act === '过审') return !!(previewPatch && Object.keys(previewPatch).length)
  if (act === '改行') return !!(writePatch && Object.keys(writePatch).length) && !blockConfirm
  return false
}

function thisCallCarriesBind(spec) {
  if (!spec || typeof spec !== 'object') return false
  const where = spec.where
  if (typeof where === 'string' && where.trim()) return true
  if (Array.isArray(where) && where.length) return true
  if (spec.from && typeof spec.from === 'object' && !Array.isArray(spec.from) && String(spec.from.kind || '').trim()) {
    return true
  }
  if (Array.isArray(spec.steps) && spec.steps.length) return true
  return false
}

function collectRowLookups(rows, schemaFields, previewPatch) {
  const out = []
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== 'object') continue
    const lookup = (row.lookup && row.lookup.field && row.lookup.value != null)
      ? { field: String(row.lookup.field), value: String(row.lookup.value) }
      : captureWriteIdentity(row, schemaFields)
    if (!lookup) continue
    out.push({
      no: String(row.no || '').trim(),
      lookup,
      fromFields: pickFromFields(row.fields, previewPatch),
      status: String(row.status || '').trim(),
    })
  }
  return out
}

function setMembershipFingerprint(kind, rows, patch) {
  const parts = (Array.isArray(rows) ? rows : [])
    .map((row) => `${String((row && row.no) || '').trim()}:${String((row && row.status) || '').trim()}`)
    .filter((item) => item !== ':')
    .sort()
  const patchKeys = patch && typeof patch === 'object'
    ? Object.keys(patch).sort().map((key) => `${key}=${String(patch[key] ?? '').trim()}`).join(',')
    : ''
  return `${String(kind || '').trim()}:set:${parts.join(',')}:${patchKeys}`
}

function sameNos(left, right) {
  const a = [...new Set((Array.isArray(left) ? left : []).map((item) => String(item || '').trim()).filter(Boolean))].sort()
  const b = [...new Set((Array.isArray(right) ? right : []).map((item) => String(item || '').trim()).filter(Boolean))].sort()
  return a.length === b.length && a.every((no, index) => no === b[index])
}

function isSetWriteToken(token) {
  return Boolean(
    token
    && token.batch === true
    && Array.isArray(token.rowLookups)
    && token.rowLookups.length >= 2,
  )
}

function statusColumn(mapped, kind, conn) {
  const named = String((conn && conn.statusField) || '').trim()
  if (named) return named
  const fields = Array.isArray(mapped && mapped.fields) ? mapped.fields : []
  for (const item of fields) {
    const name = String(item || '').trim()
    if (/^(status|stage|state|workflowStatus)$/i.test(name)) return name
  }
  const resource = String((mapped && mapped.resource) || '').toLowerCase()
  if (/opportunit|lead/.test(resource)) return 'stage'
  return 'status'
}

function resolveWriteIdentity(spec, look, schemaFields, mapped) {
  const given = spec && spec.lookup
  const field = String(given && given.field || '').trim()
  const value = String(given && given.value != null ? given.value : '').trim()
  if (field && value) return { field, value }
  const row = spec && spec.fields
  return matchedWriteIdentity(row, look, schemaFields, mapped)
}

function affectedWriteCount(reply) {
  if (!reply || typeof reply !== 'object') return 0
  const hasData = Object.prototype.hasOwnProperty.call(reply, 'data')
  const data = hasData ? reply.data : reply
  if (data == null || data === '') return 0
  if (typeof data === 'number') return data
  if (typeof data === 'boolean') return data ? 1 : 0
  if (Array.isArray(data)) return data.length
  if (typeof data === 'object') {
    if (data.id != null && String(data.id).trim() !== '') return 1
    const raw = data.count != null ? data.count : data.affected
    const count = Number(raw)
    if (Number.isFinite(count)) {
      const keys = Object.keys(data)
      if (keys.every((key) => key === 'count' || key === 'affected' || key === 'meta')) return count
    }
    return 0
  }
  return 0
}

function writeDest(conn, mapped, look, action, kind, identity) {
  const baseUrl = String((conn && conn.baseUrl) || '').replace(/\/+$/, '')
  if (!baseUrl) return null
  const dialect = String((conn && conn.dialect) || 'nocobase') === 'rest' ? 'rest' : 'nocobase'
  const act = String(action || '').trim()
  const picked = identity && String(identity.field || '').trim() && String(identity.value ?? '').trim()
    ? { field: String(identity.field).trim(), value: String(identity.value).trim() }
    : null
  const field = picked
    ? picked.field
    : String((conn && conn.ticketField) || ticketColumn(mapped, kind))
  const needle = picked ? picked.value : look
  if (dialect === 'rest') {
    const raw = String((conn && (conn.writePath || conn.updatePath)) || '').trim()
    if (!raw) return null
    if (act !== '新建' && !picked) return null
    const path = raw
      .replace(/\{no\}|\{ticket\}/g, encodeURIComponent(needle))
      .replace(/\{kind\}/g, encodeURIComponent(mapped.resource || ''))
      .replace(/\{field\}/g, encodeURIComponent(field))
    const method = act === '删除'
      ? 'DELETE'
      : act === '新建'
        ? 'POST'
        : (String(conn.writeMethod || 'POST').toUpperCase() || 'POST')
    return { url: `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, method }
  }
  if (act === '新建') {
    return { url: `${baseUrl}/api/${mapped.resource}:create`, method: 'POST' }
  }
  if (!picked) return null
  const filter = encodeURIComponent(JSON.stringify({ [picked.field]: picked.value }))
  const verb = act === '删除' ? 'destroy' : 'update'
  return { url: `${baseUrl}/api/${mapped.resource}:${verb}?filter=${filter}`, method: 'POST' }
}
