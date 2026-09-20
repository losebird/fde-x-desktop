/**
 * Preview, receipt and compensate speak.
 * Secretary never posts; the write mouth consumes a preview token.
 * @module dsh-lan-assist/write
 */

import { randomHex } from './crypto.js'
import { connectorCatalogPresent, mapKind, relatedChildId, relatedField, relatedHopId, registeredKinds, resolveConnectedKindName, schemaHasField, ticketColumn, writableFieldChoices } from './lookup.js'
import { enumMap, looksLikeRef, looksLikeTicket, mergeAskClue, pickNo, saysOf } from './resolve.js'
import { ensureSpoken } from './vocab/spoken.js'
import { BATCH_LIMIT, bindPatchEnums, normalizePlan } from './plan.js'
import { dropSpokenBatchRowId, enrichStructuredSlots, kindMentions, leftoverKindMissingFromCatalog, leftoverNameIdentity, nestFromSteps, pickHopSpeech, recalledUserSpeech, recoverWriteIntent, relatedMentionedKinds, spokenWantsBatch } from './slots.js'
import { previewRowCap } from './where-pass.js'
import { createTraceLog } from './traces.js'
import { speakLookup } from './probe.js'
import { redactEnvelopeText, refLabel } from './ref.js'

export const SYSTEM_TABLES = ['users', 'fields', 'aiMessages']
export const PREVIEW_TTL_MS = 90_000

const HOP_XIANCHA_CACHE_MAX = 32
const hopXianchaCache = new Map()

function hopXianchaCacheKey(sessionId, workspace, speech) {
  return `${String(sessionId || '')}\0${String(workspace || '')}\0${String(speech || '')}\0现查`
}

function hopXianchaCacheSet(key, value) {
  if (hopXianchaCache.has(key)) hopXianchaCache.delete(key)
  hopXianchaCache.set(key, value)
  while (hopXianchaCache.size > HOP_XIANCHA_CACHE_MAX) {
    const oldest = hopXianchaCache.keys().next().value
    hopXianchaCache.delete(oldest)
  }
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

/**
 * Page payload for the secretary 业务 face. Not a write.
 * 0 / 1 / many rows; canWrite only when one row and a live preview_id.
 */
export function packSheet(spec = {}) {
  const kind = String(spec.kind || '').trim()
  const action = String(spec.action || '').trim() || '现查'
  const patch = spec.patch && typeof spec.patch === 'object' ? spec.patch : {}
  const fields = spec.fields && typeof spec.fields === 'object' ? spec.fields : null
  const matches = Array.isArray(spec.matches) ? spec.matches : []
  let rows = []
  if (matches.length) {
    rows = matches.map((item) => {
      const own = item && item.fields && typeof item.fields === 'object' ? item.fields : null
      const fallback = fields && String(item && item.no || '') === String(spec.no || '') ? fields : null
      const packedFields = own && Object.keys(own).length ? own : (fallback || {})
      const no = String((item && item.no) || packedFields.code || packedFields.name || packedFields.title || '')
      return {
        no,
        status: String((item && item.status) || packedFields.status || ''),
        fields: packedFields,
      }
    })
  } else if (fields && Object.keys(fields).length) {
    rows = [{
      no: String(spec.no || fields.code || fields.name || ''),
      status: String(spec.status || fields.status || ''),
      fields,
    }]
  }
  const columns = []
  const seen = new Set()
  const schemaFields = Array.isArray(spec.schemaFields) ? spec.schemaFields : []
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
  const changes = Object.keys(changePatch).flatMap((key) => {
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
  const many = rows.length > 1
  const previewId = String(spec.preview_id || '').trim()
  const alreadyAtTarget = action === '过审' && rows.length > 0 && changes.length === 0
  let canWrite = !!previewId && action !== '现查' && (!many || !!spec.batch)
  if (action === '过审') canWrite = canWrite && changes.length > 0
  let speak = String(spec.speak || spec.hint || '').trim()
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
    ...(alreadyAtTarget ? { alreadyAtTarget: true } : {}),
    ...(spec.patch && typeof spec.patch === 'object' && !Array.isArray(spec.patch) && Object.keys(spec.patch).length
      ? { patch: spec.patch }
      : {}),
    fieldChoices: Array.isArray(spec.fieldChoices) ? spec.fieldChoices : undefined,
    pendingValue: spec.pendingValue,
    pickField: !!spec.pickField,
    askRest: String(spec.askRest || '').trim(),
  }
}

function hopRelatedIds(fromKind, toKind, matches, extra) {
  if (!toKind) return []
  return [...new Set((Array.isArray(matches) ? matches : []).map((item) => (
    relatedHopId(fromKind, toKind, item && item.fields, extra)
  )).filter(Boolean))]
}

function hopRelatedField(fromKind, toKind, _matches, extra) {
  return relatedField(fromKind, toKind, extra)
}

function hopLinkIds(fromKind, toKind, matches, extra) {
  const forward = hopRelatedIds(fromKind, toKind, matches, extra)
  if (forward.length) {
    return {
      ids: forward,
      field: hopRelatedField(fromKind, toKind, matches, extra),
    }
  }
  const reverse = [...new Set((Array.isArray(matches) ? matches : []).map((item) => (
    relatedChildId(toKind, fromKind, item && item.fields, extra)
  )).filter(Boolean))]
  return {
    ids: reverse,
    field: hopRelatedField(toKind, fromKind, matches, extra),
  }
}

function stepHasBind(step) {
  if (!step || typeof step !== 'object') return false
  if (String(step.no || '').trim()) return true
  return Array.isArray(step.where) && step.where.length > 0
}

/** Probe the first hop step that actually filters; empty ancestor where is not a base table. */
function firstBoundStepIndex(steps) {
  const list = Array.isArray(steps) ? steps : []
  const idx = list.findIndex(stepHasBind)
  return idx >= 0 ? idx : 0
}

function planStepsForSheet(plan) {
  return (plan && Array.isArray(plan.steps) ? plan.steps : [])
    .filter((step) => step && step.kind)
    .map((step) => ({
      kind: step.kind,
      ...(Array.isArray(step.where) && step.where.length ? { where: step.where } : {}),
    }))
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

function writeHasIdentity(plan, spec = {}) {
  if (String((plan && plan.no) || (spec && spec.no) || '').trim()) return true
  if (spec && spec.related && spec.related.kind) return true
  const steps = plan && Array.isArray(plan.steps) ? plan.steps : []
  return steps.some((step) => (
    String((step && step.no) || '').trim()
    || (Array.isArray(step && step.where) && step.where.length)
  ))
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

function keepHoppedMatches(rows, hopIds, fromKind, toKind, extra) {
  const idSet = new Set((Array.isArray(hopIds) ? hopIds : []).map((item) => String(item)))
  if (!idSet.size) return []
  return (Array.isArray(rows) ? rows : []).filter((row) => {
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
    if (!childKind || !parentKind) continue
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

function hopSheetHasKindHits(result) {
  const sheet = result && result.sheet && typeof result.sheet === 'object' ? result.sheet : result
  if (!sheet || typeof sheet !== 'object') return false
  const from = sheet.from
  if (!from || typeof from !== 'object' || Array.isArray(from)) return true
  return Array.isArray(from.rows)
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
  const sheet = packSheet({ ...result, ...extra, schemaFields })
  const out = { ...result, sheet }
  delete out.vocab
  return out
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

export function nextStatus(action, status) {
  if (String(action || '') === '过审') return '已过'
  return String(status || '未知').trim() || '未知'
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

  async function probe(spec) {
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
        related: spec.related,
        asAsk: !!spec.asAsk,
        where: spec.where,
        join: spec.join,
      })
    } catch {
      return { ok: false, error: 'LOOKUP' }
    }
  }

  async function previewStructured(plan, spec, loaded) {
    const extra = { vocab: loaded.vocab }
    if (typeof opts.collectionsOf === 'function') {
      try {
        extra.collections = await opts.collectionsOf(spec.workspace)
      } catch { /* collections optional for hop FK */ }
    }
    const probeIndex = firstBoundStepIndex(plan.steps)
    const start = plan.steps[probeIndex] || plan.steps[0]
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
      return withSheet(result, { vocab: loaded.vocab, schemaFields, fieldsOf: opts.fieldsOf, ...more })
    }
    let writePatch = (recognized.action === '改行' || recognized.action === '新建')
      ? bindPatchEnums({ ...plan.patch }, schemaFields)
      : {}
    if (schemaFields.length && writePatch && Object.keys(writePatch).length) {
      writePatch = Object.fromEntries(Object.entries(writePatch).filter(([key]) => schemaHasField(schemaFields, key)))
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
        const hopSpeak = speakLookup({ kind: recognized.kind, no: '' }, hopped && hopped.ok === false ? hopped : { ok: false, error: 'NOT_FOUND' })
        return await sheet(refuse('NOT_FOUND', hopSpeak), {
          kind: recognized.kind, no: '', action: recognized.action, clue: plan.no, speech: plan.speech, speak: hopSpeak, matches: [],
        })
      }
      return finishStructured(recognized, rows, hopped, writePatch, plan, spec, loaded, schemaFields, recognized.kind)
    }
    if (recognized.action === '新建') {
      const labelNo = looksLikeTicket(plan.no) ? plan.no : '新单'
      const spoken = speakPreview({ kind: recognized.kind, no: labelNo }, {
        ok: true, status: '未建', to: '新建', action: '新建', fingerprint: `new:${recognized.kind}:${labelNo}`, mine: true,
      })
      const previewId = `pv_${randomHex(8)}`
      const token = {
        preview_id: previewId, kind: recognized.kind, no: String(plan.no || labelNo).trim(), line: plan.line,
        action: '新建', patch: writePatch, from: '未建', to: '新建', fingerprint: spoken.fingerprint,
        expiresAt: now() + PREVIEW_TTL_MS, used: false, speak: spoken.speak, vocab: loaded.vocab, mapped: recognized.mapped,
      }
      tokens.set(previewId, token)
      const fromSlot = nestFromSteps(plan.steps)
      const stepsMeta = planStepsForSheet(plan)
      const hopMeta = sheetWhereFromPlan(plan, spec)
      return await sheet({
        ok: true, ...token, speak: spoken.speak, status: '未建', fields: { ...writePatch },
        matches: [{ no: labelNo, status: '未建', fields: { ...writePatch } }],
      }, {
        action: '新建', no: labelNo, speech: plan.speech,
        ...(fromSlot ? { from: fromSlot } : {}),
        ...(stepsMeta.length > 1 ? { steps: stepsMeta } : {}),
        ...(hopMeta.where ? { where: hopMeta.where } : {}),
        ...(hopMeta.hopWhere ? { hopWhere: hopMeta.hopWhere } : {}),
      })
    }
    const parentFound = await probe({
      ...spec,
      kind: start.kind,
      no: start.no || (plan.steps.length === 1 ? plan.no : ''),
      line: plan.line,
      vocab: loaded.vocab,
      structured: true,
      speech: '',
      where: start.where,
      join: start.join,
    })
    if (!parentFound || parentFound.ok === false) {
      const emptyKind = target.kind
      const speak = (parentFound && parentFound.error === 'NO_CONNECTOR')
        ? `${emptyKind}：没连业务，不能装成已查。`
        : speakLookup({ kind: emptyKind, no: '' }, parentFound && parentFound.ok === false ? parentFound : { ok: false, error: 'NOT_FOUND' })
      return await sheet(refuse(parentFound && parentFound.error ? parentFound.error : 'NOT_FOUND', speak), {
        kind: emptyKind, no: '', action: recognized.action, clue: plan.no, speech: plan.speech, speak, matches: [],
        ...sheetWhereFromPlan(plan, spec),
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
      for (let i = probeIndex + 1; i < plan.steps.length; i += 1) {
        const step = plan.steps[i]
        const hopKind = String(step && step.kind || '').trim()
        if (!hopKind || hopKind === prevKind) continue
        if (!matches.length) {
          const hopSpeak = speakLookup({ kind: hopKind, no: '' }, { ok: false, error: 'NOT_FOUND' })
          return await sheet(refuse('NOT_FOUND', hopSpeak), {
            kind: hopKind, no: '', action: recognized.action, clue: plan.no, speech: plan.speech, speak: hopSpeak, matches: [],
          })
        }
        const link = hopLinkIds(prevKind, hopKind, matches, extra)
        const hopped = link.ids.length
          ? await probe({
            kind: hopKind, no: '', workspace: spec.workspace, staffId: spec.staffId, vocab: loaded.vocab,
            structured: true, speech: '', where: step.where,
            related: { kind: prevKind, ids: link.ids, field: link.field },
          })
          : { ok: false, error: 'NOT_FOUND', matches: [] }
        const kept = keepHoppedMatches(hopped && hopped.matches, link.ids, prevKind, hopKind, extra)
        const nextRows = kept.length
          ? kept
          : (Array.isArray(hopped && hopped.matches) ? hopped.matches : [])
        if (!nextRows.length) {
          const hopSpeak = speakLookup({ kind: hopKind, no: '' }, hopped && hopped.ok === false ? hopped : { ok: false, error: 'NOT_FOUND' })
          return await sheet(refuse('NOT_FOUND', hopSpeak), {
            kind: hopKind, no: '', action: recognized.action, clue: plan.no, speech: plan.speech, speak: hopSpeak, matches: [],
          })
        }
        matches = stampParentLabels(prevKind, matches, nextRows, hopKind, extra)
        found = hopped
        hitsByKind.set(hopKind, nextRows)
        pruneHopHits(hitsByKind, plan.steps.slice(probeIndex, i + 1), extra)
        prevKind = hopKind
      }
      for (let i = probeIndex - 1; i >= 0; i -= 1) {
        const ancestorKind = String((plan.steps[i] && plan.steps[i].kind) || '').trim()
        const childKind = String((plan.steps[i + 1] && plan.steps[i + 1].kind) || '').trim()
        if (!ancestorKind || !childKind) continue
        const childRows = hitsByKind.get(childKind) || []
        const ids = [...new Set((Array.isArray(childRows) ? childRows : []).map((item) => (
          relatedChildId(ancestorKind, childKind, item && item.fields, extra)
        )).filter(Boolean))]
        if (!ids.length) {
          hitsByKind.set(ancestorKind, [])
          continue
        }
        const hopped = await probe({
          kind: ancestorKind, no: '', workspace: spec.workspace, staffId: spec.staffId, vocab: loaded.vocab,
          structured: true, speech: '', where: plan.steps[i].where,
          related: { kind: childKind, ids, field: 'id' },
        })
        const nextRows = Array.isArray(hopped && hopped.matches) ? hopped.matches : []
        const idSet = new Set(ids.map((item) => String(item)))
        const kept = nextRows.filter((row) => {
          const fields = row && row.fields && typeof row.fields === 'object' ? row.fields : {}
          return idSet.has(String(fields.id || row.no || ''))
        })
        hitsByKind.set(ancestorKind, kept.length ? kept : nextRows)
      }
      pruneHopHits(hitsByKind, plan.steps, extra)
      const targetRows = hitsByKind.get(target.kind) || matches
      return finishStructured(recognized, targetRows, found, writePatch, plan, spec, loaded, schemaFields, target.kind, hitsByKind, extra)
    }
    return finishStructured(recognized, parentMatches, parentFound, writePatch, plan, spec, loaded, schemaFields, recognized.kind)
  }

  async function finishStructured(recognized, matches, found, writePatch, plan, spec, loaded, schemaFields, kind, hitsByKind, hopExtra) {
    const sheetKind = kind || recognized.kind
    const rowCap = previewRowCap(plan.structured)
    const rows = (Array.isArray(matches) ? matches : []).slice(0, rowCap)
    const speak = speakLookup({ kind: sheetKind, no: rows.length === 1 ? rows[0].no : '' }, {
      ...found, matches: rows, listed: rows.length > 1, ambiguous: rows.length > 1,
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
      return withSheet(result, {
        vocab: loaded.vocab,
        schemaFields,
        fieldsOf: opts.fieldsOf,
        ...(fromSlot ? { from: fromSlot } : {}),
        ...(stepsMeta.length > 1 ? { steps: stepsMeta } : {}),
        ...(hopMeta.hopWhere ? { hopWhere: hopMeta.hopWhere } : {}),
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
        clue: plan.no,
        speech: plan.speech,
        where: listWhere,
        hopWhere,
        ...(stepsMeta.length > 1 ? { steps: stepsMeta } : {}),
      })
    }
    if (rows.length !== 1) {
      const bag = { vocab: loaded.vocab, ...(hopExtra && typeof hopExtra === 'object' ? hopExtra : {}) }
      const nameIdentity = leftoverNameIdentity(plan.speech, loaded.vocab, bag, spec)
      const wantsBatch = spec.batch === true || spokenWantsBatch(plan.speech, loaded.vocab, bag)
      if (nameIdentity && !wantsBatch && spec.picked !== true) {
        return await sheet({
          ok: true, kind: sheetKind, no: '', action: recognized.action, speak,
          patch: recognized.action === '现查' ? undefined : writePatch,
          status: found && found.status, fields: {}, matches: rows,
          fingerprint: found && found.fingerprint, listed: true, ambiguous: true,
          workspace: (found && found.workspace) || spec.workspace || '',
        }, { clue: plan.no, speech: plan.speech })
      }
      const identity = writeHasIdentity(plan, spec)
      const writeable = (spec.batch === true || wantsBatch || identity) && (
        recognized.action === '删除' || recognized.action === '过审'
        || (recognized.action === '改行' && writePatch && Object.keys(writePatch).length)
      )
      if (!writeable || !rows.length) {
        if (!identity && rows.length > 1) {
          return await sheet(refuse('NO_REF', `${sheetKind}要指出改哪几条，不能整表当预览。`), {
            kind: sheetKind, action: recognized.action, matches: [], speech: plan.speech,
          })
        }
        return await sheet({
          ok: true, kind: sheetKind, no: '', action: recognized.action, speak,
          patch: recognized.action === '现查' ? undefined : writePatch,
          status: found && found.status, fields: {}, matches: rows,
          fingerprint: found && found.fingerprint, listed: true, ambiguous: true,
          workspace: (found && found.workspace) || spec.workspace || '',
        }, { clue: plan.no, speech: plan.speech })
      }
      if (rows.length > BATCH_LIMIT) {
        return await sheet(refuse('TOO_MANY', `${sheetKind}一次最多改 ${BATCH_LIMIT} 条。勾少一点再预览。`), {
          kind: sheetKind, action: recognized.action, matches: rows.slice(0, BATCH_LIMIT), speech: plan.speech,
        })
      }
      const nos = rows.map((row) => String(row.no || '').trim()).filter(Boolean)
      const catalogVersion = catalogVersionOf(loaded.vocab)
      const previewId = `pv_${randomHex(8)}`
      const token = {
        preview_id: previewId, kind: recognized.kind, no: '', nos, batch: true, line: plan.line,
        action: recognized.action, patch: recognized.action === '改行' ? { ...(writePatch || {}) } : undefined,
        vocab: loaded.vocab, mapped: recognized.mapped, catalogVersion,
        workspace: spec.workspace || '',
        system: String(spec.system || (found && found.system) || '').trim(),
        env: String(spec.env || (found && found.env) || '').trim(),
        connectionId: String((found && found.connectionId) || spec.connectionId || '').trim(),
        from: rows.length, to: recognized.action, fingerprint: `batch:${recognized.kind}:${nos.join(',')}`,
        expiresAt: now() + PREVIEW_TTL_MS, used: false,
        speak: `${recognized.action}${sheetKind}${nos.length}条。这是预览，不是过账。`,
      }
      tokens.set(previewId, token)
      return await sheet({
        ok: true, ...token, speak: token.speak, matches: rows, listed: true,
        workspace: (found && found.workspace) || spec.workspace || '',
      }, { clue: plan.no, speech: plan.speech, batch: true, nos })
    }
    if (recognized.action === '改行' && !(writePatch && Object.keys(writePatch).length)) {
      return await sheet(refuse('NO_PATCH', '改行要指出字段。'), {
        kind: sheetKind, no: rows[0].no, action: recognized.action, speech: plan.speech, matches: rows,
      })
    }
    const row = rows[0]
    const resolvedNo = String(row.no || plan.no).trim()
    const change = recognized.action === '改行' ? patchChange(writePatch, row.fields) : null
    const to = recognized.action === '过审'
      ? nextStatus('过审', row.status)
      : recognized.action === '删除' ? '删除' : (change && change.speak) || patchSpeak(writePatch)
    const spoken = speakPreview({ kind: recognized.kind, no: resolvedNo }, {
      ok: true, status: row.status, from: change ? change.from : row.status, to,
      action: recognized.action, fingerprint: found && found.fingerprint, mine: found && found.mine,
    })
    const previewId = `pv_${randomHex(8)}`
    const token = {
      preview_id: previewId, kind: recognized.kind, no: resolvedNo, line: plan.line, action: recognized.action,
      patch: buildPreviewPatch(recognized, writePatch, found, to),
      vocab: loaded.vocab, mapped: recognized.mapped, catalogVersion: catalogVersionOf(loaded.vocab),
      workspace: spec.workspace || '',
      system: String(spec.system || (found && found.system) || '').trim(),
      env: String(spec.env || (found && found.env) || '').trim(),
      connectionId: String((found && found.connectionId) || spec.connectionId || '').trim(),
      from: spoken.from, to: spoken.to || to, fingerprint: spoken.fingerprint,
      expiresAt: now() + PREVIEW_TTL_MS, used: false, speak: spoken.speak,
    }
    tokens.set(previewId, token)
    return await sheet({
      ok: true, ...token, speak: spoken.speak, fields: row.fields || {}, status: row.status, matches: rows,
    }, { clue: plan.no, speech: plan.speech })
  }

  async function preview(spec = {}) {
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
    const userSpeech = String(spec.userSpeech || '').trim() || recalledUserSpeech(spec.sessionId)
    const picked = pickHopSpeech(spec.speech || spec.quote, userSpeech, loaded.vocab, enrichExtra)
    if (picked) spec = { ...spec, speech: picked, userSpeech }
    if (typeof opts.fieldsOf === 'function') {
      const mentioned = new Set()
      const speech = String(spec.speech || spec.quote || '').trim()
      if (kind) mentioned.add(kind)
      const registered = registeredKinds(enrichExtra)
      for (const row of kindMentions(speech, registered, enrichExtra)) {
        mentioned.add(row.kind)
      }
      const schemaByKind = {}
      for (const kindName of mentioned) {
        try {
          const fields = await opts.fieldsOf(kindName, loaded.vocab)
          if (Array.isArray(fields) && fields.length) schemaByKind[kindName] = fields
        } catch { /* skip kind */ }
      }
      enrichExtra.schemaByKind = schemaByKind
    }
    const recovered = recoverWriteIntent(spec, loaded.vocab, enrichExtra)
    const enriched = enrichStructuredSlots(recovered, loaded.vocab, enrichExtra)
    const catalogExtra = { vocab: loaded.vocab, ...enrichExtra }
    const batchSpeech = String(enriched.speech || spec.speech || spec.quote || userSpeech || '').trim()
    const keptNo = dropSpokenBatchRowId(enriched.no || spec.no, batchSpeech, loaded.vocab, catalogExtra)
    if (keptNo) {
      enriched.no = keptNo
      spec.no = keptNo
    } else {
      delete enriched.no
      delete spec.no
    }
    if (Array.isArray(enriched.steps)) {
      enriched.steps = enriched.steps.map((step) => {
        if (!step || typeof step !== 'object') return step
        const stepNo = dropSpokenBatchRowId(step.no, batchSpeech, loaded.vocab, catalogExtra)
        if (!stepNo) {
          const copy = { ...step }
          delete copy.no
          return copy
        }
        return { ...step, no: stepNo }
      })
    }
    const plan = normalizePlan(enriched)
    plan.no = dropSpokenBatchRowId(plan.no, batchSpeech, loaded.vocab, catalogExtra)
    if (Array.isArray(plan.steps)) {
      for (const step of plan.steps) {
        if (!step) continue
        step.no = dropSpokenBatchRowId(step.no, batchSpeech, loaded.vocab, catalogExtra)
      }
    }
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
        if (prev && prev.kind === step.kind) {
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
    if (leftoverKindMissingFromCatalog(resolvedKind, catalogExtra)) {
      return refuse('NO_CONNECTOR', `${resolvedKind}：没连业务，不能装成已查。`)
    }
    if (connectorCatalogPresent(catalogExtra) && !resolveConnectedKindName(resolvedKind, catalogExtra) && !mapKind(resolvedKind, catalogExtra)) {
      return refuse('NO_CONNECTOR', `${resolvedKind}：没连业务，不能装成已查。`)
    }
    const sessionId = String(spec.sessionId || '').trim()
    const workspaceKey = String(spec.workspace || '')
    const speechForHop = String(plan.speech || '').trim()
    const rememberedHop = String(userSpeech || '').trim()
    const hopSpeech = (
      relatedMentionedKinds(speechForHop, loaded.vocab, enrichExtra).related.length >= 2
        ? speechForHop
        : (relatedMentionedKinds(rememberedHop, loaded.vocab, enrichExtra).related.length >= 2 ? rememberedHop : '')
    )
    if (plan.action === '现查' && sessionId && hopSpeech) {
      const cached = hopXianchaCache.get(hopXianchaCacheKey(sessionId, workspaceKey, hopSpeech))
      if (cached && hopSheetHasKindHits(cached)) return cached
    }
    const result = await previewStructured(plan, enriched, loaded)
    if (
      plan.action === '现查'
      && Array.isArray(plan.steps) && plan.steps.length >= 2
      && sessionId
      && hopSpeech
      && result && result.ok !== false
    ) {
      hopXianchaCacheSet(hopXianchaCacheKey(sessionId, workspaceKey, hopSpeech), result)
      if (speechForHop && speechForHop !== hopSpeech) {
        hopXianchaCacheSet(hopXianchaCacheKey(sessionId, workspaceKey, speechForHop), result)
      }
    }
    return result
  }

  async function write(spec = {}) {
    const previewId = String(spec.preview_id || spec.previewId || '').trim()
    if (!previewId) return refuse('NEED_PREVIEW', '先预览。旧画面不能拿去写。')
    const token = tokens.get(previewId)
    if (!token) return refuse('NEED_PREVIEW', '先预览。没有这张令牌，不能写。')
    if (token.used) return refuse('USED', '这张预览已经用过。要写再预览一次。')
    if (now() > Number(token.expiresAt || 0)) return refuse('EXPIRED', '预览过期了。要写再预览一次。')
    const traceId = String(spec.trace_id || spec.traceId || '').trim()
    if (traceId && await traces.seen(traceId, spec.workspace || token.workspace)) {
      return refuse('DUP_TRACE', '同一笔只许成功一次。')
    }
    if (token.action === '改行' && (!token.patch || !Object.keys(token.patch).length)) {
      return refuse('NO_PATCH', '改行要指出字段。')
    }
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
    if (token.batch && Array.isArray(token.nos)) {
      if (token.action === '删除' && spec.confirm !== true && spec.confirmDelete !== true) {
        return refuse('NEED_CONFIRM', '批量删除要单独确认。')
      }
      const nos = token.nos.map((item) => String(item || '').trim()).filter(Boolean).slice(0, BATCH_LIMIT)
      token.used = true
      tokens.set(previewId, token)
      const done = []
      const failed = []
      if (typeof opts.postWrite !== 'function') {
        if (traceId) await traces.remember(traceId, spec.workspace || token.workspace, {
          kind: token.kind, action: token.action, no: nos.join(','), sessionId: spec.sessionId || token.sessionId,
        })
        return { ok: true, preview_id: previewId, trace_id: traceId, nos, done: nos, speak: `已按预览处理${nos.length}条。` }
      }
      for (const no of nos) {
        try {
          const posted = await opts.postWrite({ ...token, no, batch: false, nos: undefined, preview_id: previewId, trace_id: traceId ? `${traceId}:${no}` : '' })
          if (!posted || posted.ok === false || posted.failed) failed.push(no)
          else done.push(no)
        } catch {
          failed.push(no)
        }
      }
      if (failed.length) {
        return {
          ok: false, error: 'WRITE_FAILED', failed: true, preview_id: previewId, done, nos: failed,
          hint: `写到一半停了。成了 ${done.length} 条，没成 ${failed.join('、')}。`,
          speak: `写到一半停了。成了 ${done.length} 条，没成 ${failed.join('、')}。`,
        }
      }
      if (traceId) await traces.remember(traceId, spec.workspace || token.workspace, {
        kind: token.kind, action: token.action, no: done.join(','), sessionId: spec.sessionId || token.sessionId,
      })
      return { ok: true, preview_id: previewId, trace_id: traceId, nos, done, speak: `已按预览处理${done.length}条。` }
    }
    if (token.action !== '新建') {
      const found = await probe(token)
      const gate = previewStillHolds(token, found)
      if (!gate.ok) return { ok: false, error: gate.error, hint: gate.hint }
    }
    token.used = true
    tokens.set(previewId, token)
    const ref = { kind: token.kind, no: token.no }
    if (typeof opts.postWrite !== 'function') {
      const spoken = speakReceipt(ref, {})
      return { ok: true, receiptId: '', preview_id: previewId, trace_id: traceId, speak: spoken.speak, kind: spoken.kind }
    }
    let posted
    try {
      posted = await opts.postWrite({
        ...token,
        preview_id: previewId,
        trace_id: traceId,
      })
    } catch (error) {
      posted = { ok: false, failed: true, error: error instanceof Error ? error.message : String(error) }
    }
    if (posted && posted.ok !== false && !posted.failed && token.action === '新建' && posted.no) {
      token.no = posted.no
      ref.no = posted.no
      tokens.set(previewId, token)
    }
    if (!posted || posted.ok === false || posted.failed) {
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
    if (token.action === '改行' && token.patch && Object.keys(token.patch).length) {
      const after = await probe(token)
      if (!patchApplied(token.patch, after && after.fields)) {
        const spoken = speakReceipt(ref, { failed: true })
        return {
          ok: false,
          error: 'WRITE_FAILED',
          failed: true,
          hint: '业务回了，但字段还是旧的。不能记已处理。',
          speak: '业务回了，但字段还是旧的。不能记已处理。',
          kind: spoken.kind,
          preview_id: previewId,
        }
      }
    }
    const receiptId = String(posted.receiptId || '').trim()
    if (traceId) await traces.remember(traceId, spec.workspace || token.workspace, {
      kind: token.kind, no: ref.no, action: token.action, receiptId, sessionId: spec.sessionId || token.sessionId,
    })
    const spoken = speakReceipt(ref, { receiptId, ok: true })
    return {
      ok: true,
      receiptId,
      no: ref.no,
      preview_id: previewId,
      trace_id: traceId,
      speak: spoken.speak,
      kind: spoken.kind,
    }
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

  return { preview, write, fileAskClue, tokens }
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

function fieldValue(fields, key) {
  if (!fields || typeof fields !== 'object') return ''
  const want = String(key || '').trim()
  if (fields[want] != null && fields[want] !== '') return String(fields[want])
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
    if (fields[name] != null && fields[name] !== '') return String(fields[name])
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

function patchApplied(patch, fields) {
  if (!patch || typeof patch !== 'object') return true
  if (!fields || typeof fields !== 'object') return false
  return Object.keys(patch).every((key) => {
    if (!rowHasField(fields, key)) return false
    return fieldValue(fields, key) === String(patch[key] ?? '')
  })
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
      const values = spec.action === '过审'
        ? { [statusColumn(mapped, spec.kind, conn)]: spec.to || '已过' }
        : spec.action === '删除'
          ? undefined
          : await shapePatch(spec.patch, { ...spec, vocab }, { extra: { ...extra, vocab }, conn, fetchImpl })
      const dest = writeDest(conn, mapped, look, spec.action, spec.kind)
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
      const receiptId = pickReceiptId(reply)
      const created = createdNo(reply, mapped, extra)
      return { ok: true, receiptId, no: created || receiptId }
    },
  }
}

async function shapePatch(patch, spec, ctx = {}) {
  if (!patch || typeof patch !== 'object') return {}
  const extra = ctx.extra || spec
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
    if (/Id$/i.test(name)) {
      if (/^\d+$/.test(String(value))) out[name] = String(value)
      else {
        const id = await resolveRelatedId(name, value, spec, ctx)
        if (id) out[name] = id
      }
      continue
    }
    if ((relationStemOf(name, extra) || kindForFkName(name, extra)) && value != null && value !== '') {
      const id = await resolveRelatedId(name, value, spec, ctx)
      if (id) out[`${name}Id`] = id
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

function kindForFkName(name, extra) {
  const stem = String(name || '').replace(/Id$/i, '')
  if (!stem) return ''
  for (const kind of registeredKinds(extra)) {
    const mapped = mapKind(kind, extra)
    const want = String((mapped && mapped.resource) || '').toLowerCase()
    if (want && resourceStemOf(want) === stem.toLowerCase()) return kind
  }
  return ''
}

function resourceStemOf(resource) {
  const last = String(resource || '').split('/').pop() || ''
  const parts = last.replace(/^(biz|crm|erp|oa)_/i, '').split(/[_-]/).filter(Boolean)
  if (/^(records|items|logs|movements)$/i.test(parts[parts.length - 1] || '')) parts.pop()
  const end = String(parts.pop() || '').replace(/ies$/i, 'y').replace(/s$/i, '')
  return end.toLowerCase()
}

async function resolveRelatedId(name, value, spec, ctx) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (/^\d+$/.test(raw)) return raw
  const extra = { vocab: spec.vocab, kinds: (ctx.conn && ctx.conn.kinds), collections: (ctx.conn && ctx.conn.collections), ...(ctx.extra || {}) }
  extra.vocab = ensureSpoken(extra.vocab)
  const kind = kindForFkName(name, extra)
  if (!kind) return ''
  const conn = ctx.conn || {}
  const mapped = mapKind(kind, extra)
  if (!mapped || !mapped.resource) return ''
  const fetchImpl = ctx.fetchImpl
  const baseUrl = String(conn.baseUrl || '').replace(/\/+$/, '')
  const token = String(conn.token || extra.token || '')
  if (!baseUrl || !fetchImpl) return ''
  const tf = ticketColumn(mapped, kind)
  const ors = []
  if (tf) ors.push({ [tf]: raw })
  ors.push({ name: { $includes: raw } })
  ors.push({ title: { $includes: raw } })
  if (tf !== 'code') ors.push({ code: raw })
  const filter = encodeURIComponent(JSON.stringify(ors.length === 1 ? ors[0] : { $or: ors }))
  try {
    const res = await fetchImpl(`${baseUrl}/api/${mapped.resource}:list?pageSize=5&filter=${filter}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    })
    const body = await res.json().catch(() => ({}))
    const rows = Array.isArray(body.data) ? body.data : (body.data ? [body.data] : [])
    const hit = rows.filter((row) => row && row.id != null && /^\d+$/.test(String(row.id)))
    if (hit.length !== 1) return ''
    return String(hit[0].id)
  } catch {
    return ''
  }
}

function relationStemOf(key, extra) {
  const name = String(key || '').replace(/Id$/i, '')
  if (!name) return ''
  const listed = saysOf(extra, '关联列')
  if (!listed.length) return ''
  return listed.some((item) => item.toLowerCase() === name.toLowerCase()) ? name.toLowerCase() : ''
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

function buildPreviewPatch(recognized, writePatch, found, toStatus) {
  const act = String(recognized.action || '').trim()
  if (act === '改行') return { ...(writePatch || {}) }
  if (act === '过审') {
    const col = statusColumn(recognized.mapped, recognized.kind, found)
    const to = String(toStatus ?? '').trim()
    if (!col || !to) return undefined
    return { [col]: to }
  }
  return undefined
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

function writeDest(conn, mapped, look, action, kind) {
  const baseUrl = String((conn && conn.baseUrl) || '').replace(/\/+$/, '')
  if (!baseUrl) return null
  const dialect = String((conn && conn.dialect) || 'nocobase') === 'rest' ? 'rest' : 'nocobase'
  const act = String(action || '').trim()
  const field = String((conn && conn.ticketField) || ticketColumn(mapped, kind))
  if (dialect === 'rest') {
    const raw = String((conn && (conn.writePath || conn.updatePath)) || '').trim()
    if (!raw) return null
    const path = raw
      .replace(/\{no\}|\{ticket\}/g, encodeURIComponent(look))
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
  const filter = encodeURIComponent(JSON.stringify({ [field]: look }))
  const verb = act === '删除' ? 'destroy' : 'update'
  return { url: `${baseUrl}/api/${mapped.resource}:${verb}?filter=${filter}`, method: 'POST' }
}
