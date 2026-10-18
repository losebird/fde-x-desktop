import { planAppSource } from '../app-source.mjs'
import { appendAudit, createId } from '../db.mjs'
import { isHostJobId } from '../host-catalog.mjs'

const MANUAL_TRIGGER_JSON = '{"kind":"manual"}'
const AI_DOWN = '核心 AI 运行时尚未连接'
const MEMORY_ONLY = '没有记忆 M1，这一步只留提案'
const TOOLS_UNRESTRICTED = '核心 AI 暂不支持限制步骤工具，未运行'

const CARD_STATUS = {
  succeeded: 'success',
  failed: 'failed',
  cancelled: 'failed',
  queued: 'running',
  running: 'running',
  waiting: 'running',
}

const isoNow = () => new Date().toISOString()

function rejectRun(status, code, message) {
  const error = new Error(message)
  error.status = status
  error.code = code
  return error
}

function parseSteps(definitionJson) {
  let definition = {}
  try {
    definition = JSON.parse(definitionJson)
  } catch {
    definition = {}
  }
  const rawSteps = Array.isArray(definition.steps) ? definition.steps : []
  return rawSteps.map((step, index) => {
    const sequence = index + 1
    const record = step && typeof step === 'object' && !Array.isArray(step) ? step : {}
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    const config = record.config && typeof record.config === 'object' && !Array.isArray(record.config)
      ? record.config
      : {}
    return {
      stepKey: id || `step_${sequence}`,
      sequence,
      kind: typeof record.kind === 'string' ? record.kind : '',
      config,
    }
  })
}

export function hasIllegalSourceRef(steps) {
  if (!Array.isArray(steps)) return false
  for (const step of steps) {
    const config = step && typeof step === 'object' && step.config && typeof step.config === 'object' && !Array.isArray(step.config)
      ? step.config
      : null
    if (!config) continue
    const sourceRef = typeof config.sourceRef === 'string' ? config.sourceRef.trim() : ''
    if (sourceRef && !planAppSource(sourceRef)) return true
  }
  return false
}

function assertAiPrompts(steps) {
  for (const step of steps) {
    if (step.kind !== 'ai') continue
    const prompt = typeof step.config.prompt === 'string' ? step.config.prompt.trim() : ''
    if (!prompt) throw rejectRun(422, 'validation_error', 'AI 步骤的提示不能为空')
  }
}

function runtimeConnected(aiRuntime) {
  if (!aiRuntime || typeof aiRuntime.status !== 'function') return false
  const status = aiRuntime.status()
  return Boolean(status && status.connected === true)
}

function insertQueued(db, { runId, workflowId, correlationId, now, steps }) {
  const stored = steps.map((step) => ({ ...step, id: createId('wrs') }))
  db.exec('BEGIN IMMEDIATE;')
  try {
    const open = db.prepare(`
      SELECT id FROM workflow_runs
      WHERE workflow_id = ? AND state IN ('queued', 'running')
      LIMIT 1
    `).get(workflowId)
    if (open) throw rejectRun(409, 'run_in_progress', '这条工作流已有未结束的运行')
    db.prepare(`
      INSERT INTO workflow_runs
        (id, workflow_id, state, trigger_json, input_json, output_json, correlation_id, started_at, finished_at, created_at)
      VALUES (?, ?, 'queued', ?, '{}', NULL, ?, NULL, NULL, ?)
    `).run(runId, workflowId, MANUAL_TRIGGER_JSON, correlationId, now)
    const insertStep = db.prepare(`
      INSERT INTO workflow_run_steps
        (id, run_id, step_key, sequence_no, state, input_json, output_json, error_json, started_at, finished_at)
      VALUES (?, ?, ?, ?, 'queued', ?, NULL, NULL, NULL, NULL)
    `)
    for (const step of stored) {
      insertStep.run(step.id, runId, step.stepKey, step.sequence, JSON.stringify(step.config))
    }
    db.exec('COMMIT;')
  } catch (error) {
    try {
      db.exec('ROLLBACK;')
    } catch {
      /* transaction already finished */
    }
    throw error
  }
  return stored
}

function changed(result) {
  return result.changes === 1
}

function claimRunning(db, runId, now) {
  db.prepare(`
    UPDATE workflow_runs
    SET state = 'running', started_at = COALESCE(started_at, ?)
    WHERE id = ? AND state = 'queued'
  `).run(now, runId)
}

function claimStepRunning(db, stepId, now) {
  db.prepare(`
    UPDATE workflow_run_steps
    SET state = 'running', started_at = COALESCE(started_at, ?)
    WHERE id = ? AND state = 'queued'
  `).run(now, stepId)
}

function markRunFailed(db, runId, now) {
  return changed(db.prepare(`
    UPDATE workflow_runs
    SET state = 'failed', finished_at = COALESCE(finished_at, ?)
    WHERE id = ? AND state = 'running'
  `).run(now, runId))
}

function markStepFailed(db, stepId, message, now) {
  return changed(db.prepare(`
    UPDATE workflow_run_steps
    SET state = 'failed', error_json = ?, finished_at = COALESCE(finished_at, ?)
    WHERE id = ? AND state = 'running'
  `).run(JSON.stringify({ message }), now, stepId))
}

function failSteps(db, steps, message, now) {
  for (const step of steps) {
    claimStepRunning(db, step.id, now)
    markStepFailed(db, step.id, message, now)
  }
}

function markStepSkipped(db, stepId, now) {
  return changed(db.prepare(`
    UPDATE workflow_run_steps
    SET state = 'skipped', finished_at = COALESCE(finished_at, ?)
    WHERE id = ? AND state = 'queued'
  `).run(now, stepId))
}

function skipSteps(db, steps, now) {
  for (const step of steps) markStepSkipped(db, step.id, now)
}

function failRun(db, ctx, message) {
  const now = isoNow()
  claimRunning(db, ctx.runId, now)
  failSteps(db, ctx.steps, message, now)
  markRunFailed(db, ctx.runId, now)
}

async function performRun(deps, ctx) {
  const { db, aiRuntime } = deps
  const now = isoNow()
  claimRunning(db, ctx.runId, now)
  const aiSteps = ctx.steps.filter((step) => step.kind === 'ai')
  const memorySteps = ctx.steps.filter((step) => step.kind === 'memory.add')
  const skipStepsList = ctx.steps.filter((step) => step.kind !== 'ai' && step.kind !== 'memory.add')
  if (aiSteps.length === 0) {
    failSteps(db, memorySteps, MEMORY_ONLY, now)
    failSteps(db, skipStepsList, '没有可执行的 ai 步骤', now)
    markRunFailed(db, ctx.runId, now)
    return
  }
  if (!runtimeConnected(aiRuntime)) {
    failSteps(db, aiSteps, AI_DOWN, now)
    failSteps(db, memorySteps, MEMORY_ONLY, now)
    skipSteps(db, skipStepsList, now)
    markRunFailed(db, ctx.runId, now)
    return
  }

  failSteps(db, aiSteps, TOOLS_UNRESTRICTED, now)
  failSteps(db, memorySteps, MEMORY_ONLY, now)
  skipSteps(db, skipStepsList, now)
  markRunFailed(db, ctx.runId, now)
}

function continueRun(deps, ctx) {
  queueMicrotask(() => {
    performRun(deps, ctx).catch((error) => {
      const message = error instanceof Error && error.message ? error.message : '运行失败'
      failRun(deps.db, ctx, message)
    })
  })
}

export function readLatestRunCards(db, workflowIds) {
  if (!Array.isArray(workflowIds) || workflowIds.length === 0) return new Map()
  const ids = []
  const seen = new Set()
  for (const id of workflowIds) {
    if (typeof id !== 'string' || !id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  if (ids.length === 0) return new Map()
  const placeholders = ids.map(() => '?').join(', ')
  const rows = db.prepare(`
    SELECT workflow_id, state, finished_at, started_at, created_at
    FROM workflow_runs
    WHERE workflow_id IN (${placeholders})
    ORDER BY created_at DESC, rowid DESC
  `).all(...ids)
  const cards = new Map()
  for (const row of rows) {
    if (cards.has(row.workflow_id)) continue
    cards.set(row.workflow_id, {
      lastRunAt: row.finished_at || row.started_at || row.created_at,
      lastRunStatus: CARD_STATUS[row.state] || 'failed',
    })
  }
  return cards
}

const INTERRUPTED = '上次运行被中断'

function auditInterrupted(db, row, targetRef, now) {
  appendAudit(db, {
    workspaceId: row.workspace_id,
    actorId: 'actor_system',
    action: 'plan.workflow_run.interrupt',
    targetRef,
    outcome: 'failed',
    riskLevel: 'low',
    correlationId: row.correlation_id || '',
    details: { message: INTERRUPTED, previousState: row.state },
    occurredAt: now,
  })
}

export function failInterruptedRuns(db) {
  const runs = db.prepare(`
    SELECT r.id, r.state, r.correlation_id, w.workspace_id
    FROM workflow_runs r
    LEFT JOIN workflows w ON w.id = r.workflow_id
    WHERE r.state IN ('queued', 'running')
  `).all()
  const steps = db.prepare(`
    SELECT s.id, s.state, r.correlation_id, w.workspace_id
    FROM workflow_run_steps s
    JOIN workflow_runs r ON r.id = s.run_id
    LEFT JOIN workflows w ON w.id = r.workflow_id
    WHERE s.state IN ('queued', 'running')
  `).all()
  if (runs.length === 0 && steps.length === 0) return
  const now = isoNow()
  db.exec('BEGIN IMMEDIATE;')
  try {
    const failStep = db.prepare(`
      UPDATE workflow_run_steps
      SET state = 'failed', error_json = ?, finished_at = COALESCE(finished_at, ?)
      WHERE id = ? AND state IN ('queued', 'running')
    `)
    const failRun = db.prepare(`
      UPDATE workflow_runs
      SET state = 'failed', finished_at = COALESCE(finished_at, ?)
      WHERE id = ? AND state IN ('queued', 'running')
    `)
    for (const step of steps) {
      if (failStep.run(JSON.stringify({ message: INTERRUPTED }), now, step.id).changes !== 1) continue
      auditInterrupted(db, step, `fde://plan/workflow-run-steps/${step.id}`, now)
    }
    for (const run of runs) {
      if (failRun.run(now, run.id).changes !== 1) continue
      auditInterrupted(db, run, `fde://plan/workflow-runs/${run.id}`, now)
    }
    db.exec('COMMIT;')
  } catch (error) {
    try {
      db.exec('ROLLBACK;')
    } catch {
      /* transaction already finished */
    }
    throw error
  }
}

export function startWorkflowRun(deps, command) {
  const db = deps.db
  const workflowId = typeof command?.workflowId === 'string' ? command.workflowId : ''
  const correlationId = typeof command?.correlationId === 'string' ? command.correlationId : ''
  const workspaceId = typeof command?.workspaceId === 'string' ? command.workspaceId.trim() : ''
  if (command?.trigger?.kind !== 'manual') throw rejectRun(422, 'validation_error', '这个运行只接受手动触发')
  if (!workspaceId) throw rejectRun(400, 'missing_workspace_id', '缺少 workspaceId')
  if (!workflowId || isHostJobId(workflowId)) throw rejectRun(404, 'not_found', '工作流不存在')
  const workflow = db.prepare('SELECT id, workspace_id, definition_json FROM workflows WHERE id = ?').get(workflowId)
  if (!workflow || workflow.workspace_id !== workspaceId) throw rejectRun(404, 'not_found', '工作流不存在')
  const steps = parseSteps(workflow.definition_json)
  if (hasIllegalSourceRef(steps)) throw rejectRun(422, 'invalid_source_ref', '来源引用不合法')
  assertAiPrompts(steps)
  const runId = createId('wfr')
  const storedSteps = insertQueued(db, {
    runId,
    workflowId,
    correlationId,
    now: isoNow(),
    steps,
  })
  continueRun(deps, {
    runId,
    workspaceId: workflow.workspace_id,
    steps: storedSteps,
  })
  return {
    id: runId,
    workflowId,
    state: 'queued',
    correlationId,
  }
}
