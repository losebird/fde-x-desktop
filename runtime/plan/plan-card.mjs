import { parseLivePreviewId } from '../biz/confirm-mouth.mjs'
import { listOpenPlanTaskProposals } from './task-proposals.mjs'

const PROPOSE_ACTION = 'plan.task.propose'
const EXPIRED_NOTICE = '预览已过期。重新交给 AI。'
const VOIDED_NOTICE = '这份预览已作废，不会过账。'

const FACE = {
  'todo-only': {
    label: '确认',
    enabled: true,
    notice: null,
    headline: null,
    step: 'decide',
    restore: false,
    voidOnReject: false,
  },
  'linked-open': {
    label: '确认并过账',
    enabled: true,
    notice: null,
    headline: '业务改动',
    step: 'write',
    restore: true,
    voidOnReject: true,
  },
  'linked-posted': {
    label: '确认',
    enabled: true,
    notice: null,
    headline: '已过账',
    step: 'decide',
    restore: true,
    voidOnReject: false,
  },
  'linked-expired': {
    label: '确认并过账',
    enabled: false,
    notice: EXPIRED_NOTICE,
    headline: '预览已过期',
    step: 'refuse',
    restore: false,
    voidOnReject: true,
  },
  'linked-voided': {
    label: '确认并过账',
    enabled: false,
    notice: VOIDED_NOTICE,
    headline: '预览已作废',
    step: 'refuse',
    restore: false,
    voidOnReject: false,
  },
}

const unboundByDb = new WeakMap()

function unboundFor(db) {
  let held = unboundByDb.get(db)
  if (!held) {
    held = new Map()
    unboundByDb.set(db, held)
  }
  return held
}

function normalizeStatus(value) {
  if (value === 'open' || value === 'used' || value === 'expired' || value === 'absent') return value
  return 'absent'
}

function tokenOf(facts) {
  if (!facts || !facts.token || typeof facts.token !== 'object') return 'absent'
  return normalizeStatus(facts.token.status)
}

function classify(facts) {
  const previewId = parseLivePreviewId(facts && facts.previewId)
  if (!previewId) return 'todo-only'
  if (facts && facts.audit) return 'linked-posted'
  const status = tokenOf(facts)
  if (status === 'used') return 'linked-voided'
  if (status === 'open') return 'linked-open'
  return 'linked-expired'
}

function changeLines(changes) {
  if (!Array.isArray(changes)) return []
  const lines = []
  for (const row of changes) {
    if (!row || typeof row !== 'object') continue
    const label = String(row.label || row.field || '')
    const from = row.from == null ? '' : String(row.from)
    const to = row.to == null ? '' : String(row.to)
    lines.push(`${label} ${from} → ${to}`)
  }
  return lines
}

export function planCardView(facts) {
  const face = FACE[classify(facts)]
  const lines = changeLines(facts && facts.sheetChanges)
  const action = facts && typeof facts.action === 'string' ? facts.action.trim() : ''
  const headline = face.headline == null ? null : (action ? `${action} · ${face.headline}` : face.headline)
  return {
    confirm: { enabled: face.enabled, label: face.label },
    reject: { enabled: true, label: '拒绝' },
    notice: face.notice,
    business: headline == null ? null : { headline, lines },
  }
}

export function planConfirmStep(facts) {
  const token = facts && facts.token
    ? facts.token
    : { status: facts && facts.status ? facts.status : 'absent' }
  const face = FACE[classify({
    previewId: facts && facts.previewId,
    token,
    audit: facts && facts.audit,
  })]
  return {
    step: face.step,
    restore: face.restore,
    voidOnReject: face.voidOnReject,
    message: face.step === 'refuse' ? face.notice : null,
  }
}

export function postedPreviewAudit(db, previewId) {
  const id = parseLivePreviewId(previewId)
  if (!id) return null
  const row = db.prepare(`
    SELECT trace_id FROM biz_write_audit
    WHERE json_extract(lookup_bind_json, '$.previewId') = ?
    LIMIT 1
  `).get(id)
  if (!row || !row.trace_id) return null
  return { traceId: String(row.trace_id) }
}

export function previewOfferCtx(index, voidPreview) {
  const table = index && typeof index === 'object' ? index : {}
  return {
    now: Date.now(),
    tokenStatus(id) {
      const value = table[id]
      if (value === 'open' || value === 'used' || value === 'expired') return value
      return 'absent'
    },
    voidPreview(id) {
      if (typeof voidPreview === 'function') voidPreview(id)
    },
  }
}

export async function readPreviewIndex(aiRuntime) {
  if (!aiRuntime || typeof aiRuntime.lanAssist !== 'function') return {}
  try {
    const state = await aiRuntime.lanAssist('/state', { search: { sessionId: '' } })
    const index = state && state.writePreview
    return index && typeof index === 'object' ? index : {}
  } catch {
    return {}
  }
}

function sheetChangesOf(change) {
  const stored = change && change.previewChanges
  if (!stored || typeof stored !== 'object') return { action: '', changes: [] }
  return {
    action: typeof stored.action === 'string' ? stored.action : '',
    changes: Array.isArray(stored.changes) ? stored.changes : [],
  }
}

export function listPlanTaskCards(db, workspaceId, tokenIndex) {
  const index = tokenIndex && typeof tokenIndex === 'object' ? tokenIndex : {}
  return listOpenPlanTaskProposals(db, workspaceId).map((item) => {
    const previewId = parseLivePreviewId(item.change && item.change.previewId)
    const diff = sheetChangesOf(item.change)
    const audit = previewId ? postedPreviewAudit(db, previewId) : null
    const raw = previewId ? index[previewId] : null
    const status = raw === 'open' || raw === 'used' || raw === 'expired' ? raw : 'absent'
    return {
      ...item,
      card: planCardView({
        previewId,
        token: previewId ? { status } : null,
        audit,
        sheetChanges: diff.changes,
        action: diff.action,
      }),
    }
  })
}

function runningTaskId(db, sessionId) {
  const sid = String(sessionId || '').trim()
  if (!sid) return ''
  const row = db.prepare(`
    SELECT task_id FROM task_ai_runs
    WHERE session_id = ? AND state = 'running'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(sid)
  return row ? String(row.task_id || '') : ''
}

function awaitingForTask(db, taskId) {
  return db.prepare(`
    SELECT id, plan_json FROM operations
    WHERE state = 'awaiting_approval' AND action = ?
      AND json_extract(plan_json, '$.taskId') = ?
    ORDER BY created_at ASC
  `).all(PROPOSE_ACTION, taskId).map((row) => ({
    id: row.id,
    plan: JSON.parse(row.plan_json),
  }))
}

function previewOn(plan) {
  return parseLivePreviewId(plan && plan.change && plan.change.previewId)
}

function diffFrom(event, previewId) {
  return {
    previewId,
    action: typeof event.action === 'string' ? event.action : '',
    changes: Array.isArray(event.changes) ? event.changes : [],
  }
}

function writeBoundPreview(db, proposalId, diff) {
  const row = db.prepare('SELECT plan_json FROM operations WHERE id = ?').get(proposalId)
  if (!row) return false
  const plan = JSON.parse(row.plan_json)
  const change = plan.change && typeof plan.change === 'object' ? { ...plan.change } : {}
  change.previewId = diff.previewId
  change.previewChanges = { action: diff.action, changes: diff.changes }
  plan.change = change
  const json = JSON.stringify(plan)
  db.prepare('UPDATE operations SET plan_json = ?, input_json = ? WHERE id = ?').run(json, json, proposalId)
  return true
}

function primaryHolds(db, previewId, ctx) {
  const read = ctx && typeof ctx.tokenStatus === 'function' ? ctx.tokenStatus(previewId) : 'absent'
  const status = normalizeStatus(read)
  if (status === 'open') return true
  if (status === 'used' && postedPreviewAudit(db, previewId)) return true
  return false
}

function assignUnbound(db, event) {
  const taskId = String(event.taskId || '').trim()
  const proposalId = String(event.proposalId || '').trim()
  const held = unboundFor(db).get(taskId)
  if (!held || !proposalId) return { mouth: 'plan' }
  const row = db.prepare('SELECT state, plan_json FROM operations WHERE id = ?').get(proposalId)
  if (!row || row.state !== 'awaiting_approval') return { mouth: 'plan' }
  const plan = JSON.parse(row.plan_json)
  if (String(plan.taskId || '') !== taskId) return { mouth: 'plan' }
  if (previewOn(plan)) return { mouth: 'plan' }
  writeBoundPreview(db, proposalId, held)
  unboundFor(db).delete(taskId)
  return { mouth: 'plan' }
}

function voidPreview(ctx, previewId) {
  if (ctx && typeof ctx.voidPreview === 'function') ctx.voidPreview(previewId)
}

function mintOntoTask(db, taskId, previewId, event, ctx) {
  const proposals = awaitingForTask(db, taskId)
  const primaries = proposals.filter((row) => previewOn(row.plan))
  if (primaries.some((row) => previewOn(row.plan) === previewId)) return { mouth: 'plan' }
  const diff = diffFrom(event, previewId)
  const held = unboundFor(db).get(taskId)
  if (primaries.some((row) => primaryHolds(db, previewOn(row.plan), ctx))) {
    if (held && held.previewId === previewId) unboundFor(db).delete(taskId)
    voidPreview(ctx, previewId)
    return { mouth: 'plan', discardedPreviewId: previewId }
  }
  if (primaries.length === 0) {
    const empty = proposals.find((row) => !previewOn(row.plan))
    if (empty) {
      if (held && held.previewId !== previewId) voidPreview(ctx, held.previewId)
      writeBoundPreview(db, empty.id, diff)
      unboundFor(db).delete(taskId)
      return { mouth: 'plan', boundProposalId: empty.id }
    }
  }
  if (held && held.previewId !== previewId) voidPreview(ctx, held.previewId)
  unboundFor(db).set(taskId, diff)
  return { mouth: 'plan' }
}

export function offerHandoffPreview(db, event, ctx) {
  if (!event || event.type === 'propose') return assignUnbound(db, event || {})
  if (event.type !== 'mint') return { mouth: 'drawer' }
  const previewId = parseLivePreviewId(event.previewId)
  if (event.workstation === true || !previewId) return { mouth: 'drawer' }
  const taskId = runningTaskId(db, event.sessionId)
  if (!taskId) return { mouth: 'drawer' }
  return mintOntoTask(db, taskId, previewId, event, ctx || {})
}
