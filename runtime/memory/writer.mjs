import { getOperation } from '../db.mjs'
import { emit, subscribe } from '../events.mjs'

const DEDUP_MS = 24 * 60 * 60 * 1000

let skipCount = 0

export function memoryWriterSkipCount() {
  return skipCount
}

function primaryRef(refs) {
  const list = Array.isArray(refs) ? refs.map(String).filter(Boolean) : []
  return list[0] || ''
}

function shouldSkipDedup(db, ref) {
  if (!ref) return false
  const row = db.prepare('SELECT written_at FROM memory_write_log WHERE ref = ?').get(ref)
  if (!row) return false
  return Date.now() - Number(row.written_at) < DEDUP_MS
}

function rememberWrite(db, ref, cardId) {
  db.prepare(`
    INSERT INTO memory_write_log (ref, card_id, written_at)
    VALUES (?, ?, ?)
    ON CONFLICT(ref) DO UPDATE SET card_id = excluded.card_id, written_at = excluded.written_at
  `).run(ref, cardId || null, Date.now())
}

function clip(text, max = 500) {
  const s = String(text || '').trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

async function semanticPython(aiRuntime, op, args, cwd) {
  return aiRuntime.semanticOs('/python', { op, args, ...(cwd ? { cwd } : {}) })
}

async function draftCard(deps, { workspaceCwd, title, body, layer, refs }) {
  const ref = primaryRef(refs)
  if (!ref || shouldSkipDedup(deps.db, ref)) return { skipped: true, reason: 'dedup' }
  if (!deps.aiRuntime?.status?.().connected) {
    skipCount += 1
    return { skipped: true, reason: 'semantic_down' }
  }
  try {
    const label = `${title}\n${body}`.trim()
    const drafted = await semanticPython(deps.aiRuntime, 'draft_memory_card', {
      label,
      layer: layer || 'project',
      refs,
      cause: 'choice',
    }, workspaceCwd)
    const cardId = String(drafted?.card_id || drafted?.id || drafted?.cardId || '')
    rememberWrite(deps.db, ref, cardId)
    emit('memory.card.drafted', { ref, cardId, title }, { workspaceCwd, source: 'memory-writer' })
    return { ok: true, cardId, drafted }
  } catch (error) {
    console.warn('memory_writer_draft_failed', error)
    return { ok: false, error }
  }
}

async function indexPassage(deps, { workspaceCwd, id, text }) {
  if (!deps.aiRuntime?.status?.().connected) {
    skipCount += 1
    return
  }
  try {
    await semanticPython(deps.aiRuntime, 'index_passages', {
      rows: [{ id, text: clip(text, 500) }],
    }, workspaceCwd)
  } catch (error) {
    console.warn('memory_writer_index_failed', error)
  }
}

async function recordDecision(deps, { workspaceCwd, category, scenario, reasoning, outcome, refs }) {
  if (!deps.aiRuntime?.status?.().connected) {
    skipCount += 1
    return
  }
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
  const result = await draftCard(deps, input)
  const ref = primaryRef(input.refs)
  if (result.ok && ref) {
    await indexPassage(deps, { workspaceCwd: input.workspaceCwd, id: ref, text: input.body })
  }
  return result
}

async function onBizWriteDone(deps, envelope) {
  const cwd = envelope.workspaceCwd
  if (!cwd) return
  const p = envelope.payload || {}
  const traceId = String(p.traceId || p.trace_id || '')
  const ref = traceId ? `biz:${traceId}` : ''
  if (!ref) return
  const title = `过账 ${String(p.kind || '')} ${String(p.action || '')}`.trim()
  const body = clip(`receipt ${String(p.receiptId || p.receipt_id || '')} · ${String(p.action || '')}`)
  await draftCard(deps, { workspaceCwd: cwd, title, body, layer: 'project', refs: [ref] })
  await indexPassage(deps, { workspaceCwd: cwd, id: ref, text: body })
}

async function onAppRecordChanged(deps, envelope) {
  const cwd = envelope.workspaceCwd
  if (!cwd) return
  const p = envelope.payload || {}
  if (p.op === 'delete') return
  const memoryOnWrite = p.memoryOnWrite || p.memory?.onWrite
  if (memoryOnWrite !== 'draft-card') return
  const slug = String(p.slug || '')
  const entity = String(p.entity || '')
  const rid = String(p.rid || p.id || '')
  const ref = `app:${slug}:${entity}:${rid}`
  const title = String(p.title || `应用记录 ${entity}`)
  const body = clip(typeof p.summary === 'string' ? p.summary : JSON.stringify(p.fields || p.row || {}))
  await draftCard(deps, { workspaceCwd: cwd, title, body, layer: 'project', refs: [ref] })
  await indexPassage(deps, { workspaceCwd: cwd, id: ref, text: body })
}

async function onTaskChanged(deps, envelope) {
  const cwd = envelope.workspaceCwd
  if (!cwd) return
  const p = envelope.payload || {}
  if (p.op !== 'update') return
  const row = deps.db.prepare('SELECT id, title, status FROM tasks WHERE id = ?').get(String(p.id || ''))
  if (!row || row.status !== 'done') return
  const ref = `task:${row.id}`
  const title = `完成：${row.title}`
  const body = clip(row.title)
  await draftCard(deps, { workspaceCwd: cwd, title, body, layer: 'daily', refs: [ref] })
  await indexPassage(deps, { workspaceCwd: cwd, id: ref, text: body })
}

async function onBriefingReady(deps, envelope) {
  const cwd = envelope.workspaceCwd
  if (!cwd) return
  const p = envelope.payload || {}
  const id = String(p.id || p.briefingId || '')
  if (!id) return
  const ref = `briefing:${id}`
  const aiBlock = clip(String(p.ai || p.aiBlock || p.content || ''))
  const title = String(p.title || '早报')
  await draftCard(deps, { workspaceCwd: cwd, title, body: aiBlock, layer: 'daily', refs: [ref] })
  await indexPassage(deps, { workspaceCwd: cwd, id: ref, text: aiBlock })
}

async function onImMessageSent(deps, envelope) {
  const cwd = envelope.workspaceCwd
  if (!cwd) return
  const p = envelope.payload || {}
  const requestId = String(p.requestId || p.id || '')
  if (!requestId) return
  const ref = `im:${requestId}`
  const title = `IM 发送 · ${String(p.peer || p.peerName || '')}`.trim()
  const body = clip(String(p.text || p.excerpt || ''))
  await draftCard(deps, { workspaceCwd: cwd, title, body, layer: 'project', refs: [ref] })
  await indexPassage(deps, { workspaceCwd: cwd, id: ref, text: body })
}

async function onOperationExecuted(deps, envelope) {
  const cwd = envelope.workspaceCwd
  if (!cwd) return
  const p = envelope.payload || {}
  const operationId = String(p.operationId || '')
  if (!operationId) return
  const op = getOperation(deps.db, operationId)
  if (!op) return
  const planSummary = clip(JSON.stringify(op.plan || {}))
  const receiptSummary = clip(JSON.stringify(p.receipt || p.result || {}))
  await recordDecision(deps, {
    workspaceCwd: cwd,
    category: 'biz',
    scenario: `${op.action || op.targetRef}`,
    reasoning: planSummary,
    outcome: receiptSummary,
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
      else if (type === 'im.message.sent') await onImMessageSent(deps, envelope)
      else if (type === 'operation.executed') await onOperationExecuted(deps, envelope)
    } catch (error) {
      console.warn('memory_writer_handler_failed', type, error)
    }
  })()
}

export function startMemoryWriter(deps) {
  return subscribe((envelope) => handleEnvelope(deps, envelope))
}
