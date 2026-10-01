import { getOperation } from '../db.mjs'
import { subscribe } from '../events.mjs'
import { draftCard, memoryWriterSkipCount } from './draft.mjs'

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
      if (type === 'operation.executed') await onOperationExecuted(deps, envelope)
    } catch (error) {
      console.warn('memory_writer_handler_failed', type, error)
    }
  })()
}

export function startMemoryWriter(deps) {
  return subscribe((envelope) => handleEnvelope(deps, envelope))
}
