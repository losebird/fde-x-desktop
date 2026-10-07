import { getOperation } from '../db.mjs'
import { subscribe } from '../events.mjs'
import { draftCard, memoryWriterSkipCount } from './draft.mjs'
import { instanceOriginOf } from './identity.mjs'

export { draftCard, memoryWriterSkipCount }

function clip(text, max = 500) {
  const s = String(text || '').trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

async function semanticPython(aiRuntime, op, args, cwd) {
  return aiRuntime.semanticOs('/python', { op, args, ...(cwd ? { cwd } : {}) })
}

async function recordDecision(deps, { workspaceCwd, category, scenario, reasoning, outcome, refs }) {
  if (!deps.aiRuntime?.status?.().connected) return
  try {
    await semanticPython(deps.aiRuntime, 'record_decision', {
      category,
      scenario,
      reasoning: clip(reasoning, 500),
      outcome: clip(outcome, 500),
      confidence: 1,
      because: Array.isArray(refs) ? refs : [],
    }, workspaceCwd)
  } catch (error) {
    console.warn('memory_writer_record_decision_failed', error)
  }
}

export async function draftMemoryFromBridge(deps, input) {
  const refs = Array.isArray(input.refs) ? input.refs.map(String).filter(Boolean) : []
  const origin = String(input.origin || refs[0] || '').trim()
  return draftCard(deps, {
    cwd: input.workspaceCwd || input.cwd,
    origin,
    cause: input.cause === 'choice' ? 'choice' : 'correction',
    label: input.label || [input.title, input.body].filter(Boolean).join('\n'),
    auto: input.auto !== false,
  })
}

function enoughLabel(parts) {
  const text = parts.filter(Boolean).join('\n').trim()
  return text.length >= 8 ? text : `${text} 记录`.trim()
}

async function draftFromEvent(deps, { cwd, origin, label, sessionId }) {
  if (!cwd) return
  if (!instanceOriginOf(origin)) return
  await draftCard(deps, {
    cwd,
    origin,
    label: enoughLabel([label]),
    auto: false,
    sessionId,
  })
}

async function onBizWriteDone(deps, envelope) {
  const cwd = envelope.workspaceCwd
  const payload = envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : {}
  const traceId = String(payload.traceId || '').trim()
  const kind = String(payload.kind || '').trim()
  const action = String(payload.action || '').trim()
  const origin = traceId.startsWith('trace_') ? `biz:${traceId}` : (traceId ? `biz:trace_${traceId}` : '')
  const recordNo = String(payload.recordNo || payload.no || '').trim()
  await draftFromEvent(deps, {
    cwd,
    origin,
    label: enoughLabel([`过账 ${kind} ${action}`, recordNo, traceId]),
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
  await draftFromEvent(deps, {
    cwd,
    origin,
    label: enoughLabel([payload.title, payload.summary, `${slug} ${entity}`]),
    sessionId: envelope.sessionId,
  })
}

async function onTaskChanged(deps, envelope) {
  const cwd = envelope.workspaceCwd
  const payload = envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : {}
  if (String(payload.op || '') === 'delete') return
  if (String(payload.status || '') !== 'done') return
  const id = String(payload.id || '').trim()
  await draftFromEvent(deps, {
    cwd,
    origin: id ? `task:${id}` : '',
    label: enoughLabel([payload.title, '任务完成']),
  })
}

async function onBriefingReady(deps, envelope) {
  const cwd = envelope.workspaceCwd
  const payload = envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : {}
  const briefingId = String(payload.briefingId || '').trim()
  await draftFromEvent(deps, {
    cwd,
    origin: briefingId ? `briefing:${briefingId}` : '',
    label: enoughLabel(['早报', payload.status, briefingId]),
  })
}

async function onOperationExecuted(deps, envelope) {
  const cwd = envelope.workspaceCwd
  const operationId = String(envelope.payload?.operationId || '')
  if (!cwd || !operationId) return
  const op = getOperation(deps.db, operationId)
  if (!op) return
  await recordDecision(deps, {
    workspaceCwd: cwd,
    category: 'biz',
    scenario: `${op.action || op.targetRef}`,
    reasoning: clip(JSON.stringify(op.plan || {})),
    outcome: clip(JSON.stringify(envelope.payload?.receipt || envelope.payload?.result || {})),
    refs: [`operation:${operationId}`],
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
