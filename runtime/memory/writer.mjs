import { getOperation, memoryWriteCardByOrigins } from '../db.mjs'
import { subscribe } from '../events.mjs'
import { cardFromOpenedNode, nodeMayCite, nodeWasOpened } from './cards.mjs'
import { draftCard, memoryWriterSkipCount } from './draft.mjs'
import { instanceOriginOf } from './identity.mjs'

export { draftCard, memoryWriterSkipCount }

function clip(text, max = 500) {
  const s = String(text || '').trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function uniqueIds(list) {
  const out = []
  for (const item of Array.isArray(list) ? list : []) {
    const id = String(item || '').trim()
    if (id && !out.includes(id)) out.push(id)
  }
  return out
}

async function semanticPython(aiRuntime, op, args, cwd) {
  return aiRuntime.semanticOs('/python', { op, args, ...(cwd ? { cwd } : {}) })
}

function bizOriginFromTrace(traceId) {
  const id = String(traceId || '').trim()
  if (!id) return ''
  if (id.startsWith('biz:')) return instanceOriginOf(id)
  if (id.startsWith('trace_')) return `biz:${id}`
  return `biz:trace_${id}`
}

export function choiceOriginRefs(envelope, op) {
  const payload = envelope && envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : {}
  const receipt = payload.receipt && typeof payload.receipt === 'object' ? payload.receipt : {}
  const refs = []
  const sessionId = String((envelope && envelope.sessionId) || '').trim()
  if (sessionId) refs.push(`session:${sessionId}`)
  for (const trace of [payload.traceId, receipt.traceId, receipt.trace_id]) {
    const origin = bizOriginFromTrace(trace)
    if (origin) refs.push(origin)
  }
  const origin = instanceOriginOf(payload.origin || '')
  if (origin) refs.push(origin)
  const target = instanceOriginOf((op && op.targetRef) || '')
  if (target) refs.push(target)
  return uniqueIds(refs)
}

async function openCitable(aiRuntime, cwd, id) {
  const nid = String(id || '').trim()
  if (!nid || !aiRuntime) return null
  try {
    const opened = await semanticPython(aiRuntime, 'open_node', { id: nid }, cwd)
    if (!opened || opened.error) return null
    const card = cardFromOpenedNode(nid, opened)
    if (!nodeWasOpened(card) || !nodeMayCite(card)) return null
    return card
  } catch {
    return null
  }
}

export async function resolveCitableBecause(deps, cwd, refs) {
  const raw = uniqueIds(refs)
  const candidates = [...raw]
  if (deps.db) {
    for (const cardId of memoryWriteCardByOrigins(deps.db, raw).values()) {
      if (!candidates.includes(cardId)) candidates.push(cardId)
    }
  }
  const because = []
  for (const id of candidates) {
    const card = await openCitable(deps.aiRuntime, cwd, id)
    if (!card) continue
    const nid = String(card.id || id).trim()
    if (nid && !because.includes(nid)) because.push(nid)
  }
  return because
}

export async function recordDecisionFromChoice(deps, input = {}) {
  if (!deps.aiRuntime?.status?.().connected) return { skipped: true, reason: 'semantic_down' }
  const cwd = String(input.workspaceCwd || input.cwd || '').trim()
  const scenario = String(input.scenario || '').trim()
  const reasoning = clip(input.reasoning, 500)
  const outcome = clip(input.outcome, 500)
  const category = String(input.category || '').trim()
  if (!cwd || !scenario || !reasoning || !outcome || !category) {
    return { skipped: true, reason: 'incomplete' }
  }
  const because = await resolveCitableBecause(deps, cwd, input.refs)
  if (!because.length) return { skipped: true, reason: 'NO_BECAUSE' }
  const leadsTo = uniqueIds(input.leadsTo)
  const leads = leadsTo.length ? await resolveCitableBecause(deps, cwd, leadsTo) : []
  const confidence = Number(input.confidence)
  const args = {
    category,
    scenario,
    reasoning,
    outcome,
    confidence: Number.isFinite(confidence) ? confidence : 1,
    because,
  }
  const decisionMaker = String(input.decisionMaker || '').trim()
  if (decisionMaker) args.decision_maker = decisionMaker
  if (leads.length) args.leads_to = leads
  try {
    await semanticPython(deps.aiRuntime, 'record_decision', args, cwd)
    return { ok: true, because, leads_to: leads }
  } catch (error) {
    console.warn('memory_writer_record_decision_failed', error)
    return { ok: false, error }
  }
}

export async function draftMemoryFromBridge(deps, input) {
  const refs = Array.isArray(input.refs) ? input.refs.map(String).filter(Boolean) : []
  const origin = String(input.origin || refs[0] || '').trim()
  const given = String(input.label || [input.title, input.body].filter(Boolean).join('\n')).trim()
  return draftCard(deps, {
    cwd: input.workspaceCwd || input.cwd,
    origin,
    cause: input.cause === 'choice' ? 'choice' : 'correction',
    ...(given ? { label: given } : {}),
    auto: input.auto !== false,
  })
}

async function draftFromEvent(deps, { cwd, origin, sessionId, label }) {
  if (!cwd) return
  if (!instanceOriginOf(origin)) return
  const given = String(label || '').trim()
  await draftCard(deps, {
    cwd,
    origin,
    ...(given ? { label: given } : {}),
    auto: true,
    sessionId,
  })
}

async function onBizWriteDone(deps, envelope) {
  const cwd = envelope.workspaceCwd
  const payload = envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : {}
  const traceId = String(payload.traceId || '').trim()
  const origin = traceId.startsWith('trace_') ? `biz:${traceId}` : (traceId ? `biz:trace_${traceId}` : '')
  await draftFromEvent(deps, {
    cwd,
    origin,
    sessionId: envelope.sessionId,
  })
}

async function onAppRecordChanged(deps, envelope) {
  const cwd = envelope.workspaceCwd
  const payload = envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : {}
  const op = String(payload.op || '')
  if (op === 'delete') return
  if (payload.memoryOnWrite !== 'draft-card') return
  const slug = String(payload.slug || '').trim()
  const entity = String(payload.entity || '').trim()
  const rid = String(payload.rid || payload.id || '').trim()
  const origin = slug && entity && rid ? `app:${slug}:${entity}:${rid}` : ''
  const given = origin ? '' : [payload.title, payload.summary, slug && entity ? `${slug} ${entity}` : ''].filter(Boolean).join('\n')
  await draftFromEvent(deps, {
    cwd,
    origin,
    label: given,
    sessionId: envelope.sessionId,
  })
}

async function onTaskChanged(deps, envelope) {
  const cwd = envelope.workspaceCwd
  const payload = envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : {}
  if (String(payload.op || '') === 'delete') return
  if (String(payload.status || '') !== 'done') return
  const id = String(payload.id || '').trim()
  const origin = id ? `task:${id}` : ''
  await draftFromEvent(deps, {
    cwd,
    origin,
    label: origin ? '' : payload.title,
  })
}

async function onBriefingReady(deps, envelope) {
  const cwd = envelope.workspaceCwd
  const payload = envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : {}
  const briefingId = String(payload.briefingId || '').trim()
  const origin = briefingId ? `briefing:${briefingId}` : ''
  await draftFromEvent(deps, {
    cwd,
    origin,
    label: origin ? '' : payload.status,
  })
}

async function onOperationExecuted(deps, envelope) {
  const cwd = envelope.workspaceCwd
  const operationId = String(envelope.payload?.operationId || '')
  if (!cwd || !operationId) return
  const op = getOperation(deps.db, operationId)
  if (!op) return
  await recordDecisionFromChoice(deps, {
    workspaceCwd: cwd,
    category: String(op.action || op.operationKind || '').trim(),
    scenario: `${op.action || op.targetRef}`,
    reasoning: clip(JSON.stringify(op.plan || {})),
    outcome: clip(JSON.stringify(envelope.payload?.receipt || envelope.payload?.result || {})),
    confidence: 1,
    decisionMaker: op.requestedBy,
    refs: choiceOriginRefs(envelope, op),
  })
}

function handleEnvelope(deps, envelope) {
  const type = envelope?.type
  if (!type) return
  void (async () => {
    try {
      if (type === 'biz.write.done') await onBizWriteDone(deps, envelope)
      else if (type === 'app.record.changed') await onAppRecordChanged(deps, envelope)
      else if (type === 'task.changed') await onTaskChanged(deps, envelope)
      else if (type === 'briefing.ready') await onBriefingReady(deps, envelope)
      else if (type === 'operation.executed') await onOperationExecuted(deps, envelope)
    } catch (error) {
      console.warn('memory_writer_handler_failed', type, error)
    }
  })()
}

export function startMemoryWriter(deps) {
  return subscribe((envelope) => handleEnvelope(deps, envelope))
}
