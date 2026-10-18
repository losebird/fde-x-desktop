import { createId } from '../db.mjs'
import { isHostJobId } from '../host-catalog.mjs'
import { harvestTurnToolResults } from '../briefing/tool-official.mjs'

const MANUAL_TRIGGER_JSON = '{"kind":"manual"}'
const AI_DOWN = '核心 AI 运行时尚未连接'
const MEMORY_ONLY = '没有记忆 M1，这一步只留提案'

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

function assertAiPrompts(steps) {
  for (const step of steps) {
    if (step.kind !== 'ai') continue
    const prompt = typeof step.config.prompt === 'string' ? step.config.prompt.trim() : ''
    if (!prompt) throw rejectRun(422, 'validation_error', 'AI 步骤的提示不能为空')
  }
}

function workspaceCwd(db, workspaceId) {
  const row = db.prepare('SELECT metadata_json FROM workspaces WHERE id = ?').get(workspaceId)
  if (!row) return ''
  try {
    const meta = JSON.parse(row.metadata_json || '{}')
    const cwd = typeof meta.cwd === 'string' ? meta.cwd.trim() : ''
    return cwd.startsWith('/') ? cwd : ''
  } catch {
    return ''
  }
}

function runtimeConnected(aiRuntime) {
  if (!aiRuntime || typeof aiRuntime.status !== 'function') return false
  const status = aiRuntime.status()
  return Boolean(status && status.connected === true)
}

function promptText(config) {
  const prompt = typeof config.prompt === 'string' ? config.prompt : ''
  const lines = [prompt]
  const sourceRef = typeof config.sourceRef === 'string' ? config.sourceRef.trim() : ''
  if (sourceRef) lines.push(sourceRef)
  lines.push('任务写入走 fde_plan_task_propose。记录写入走 fde_app_records_propose。')
  return lines.join('\n')
}

function insertQueued(db, { runId, workflowId, correlationId, now, steps }) {
  const stored = steps.map((step) => ({ ...step, id: createId('wrs') }))
  db.exec('BEGIN IMMEDIATE;')
  try {
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

function claimRunning(db, runId, sessionId, now) {
  return changed(db.prepare(`
    UPDATE workflow_runs
    SET state = 'running', output_json = ?, started_at = COALESCE(started_at, ?)
    WHERE id = ? AND state = 'queued'
  `).run(JSON.stringify({ sessionId }), now, runId))
}

function markRunSucceeded(db, runId, output, now) {
  return changed(db.prepare(`
    UPDATE workflow_runs
    SET state = 'succeeded', output_json = ?, finished_at = ?
    WHERE id = ? AND state = 'running'
  `).run(JSON.stringify(output), now, runId))
}

function markRunFailed(db, runId, now) {
  return changed(db.prepare(`
    UPDATE workflow_runs
    SET state = 'failed', finished_at = COALESCE(finished_at, ?)
    WHERE id = ? AND state IN ('queued', 'running')
  `).run(now, runId))
}

function claimStepRunning(db, stepId, now) {
  return changed(db.prepare(`
    UPDATE workflow_run_steps
    SET state = 'running', started_at = COALESCE(started_at, ?)
    WHERE id = ? AND state = 'queued'
  `).run(now, stepId))
}

function markStepSucceeded(db, stepId, output, now) {
  return changed(db.prepare(`
    UPDATE workflow_run_steps
    SET state = 'succeeded', output_json = ?, error_json = NULL, finished_at = ?
    WHERE id = ? AND state = 'running'
  `).run(JSON.stringify(output), now, stepId))
}

function markStepFailed(db, stepId, message, now) {
  return changed(db.prepare(`
    UPDATE workflow_run_steps
    SET state = 'failed', error_json = ?, finished_at = COALESCE(finished_at, ?)
    WHERE id = ? AND state IN ('queued', 'running')
  `).run(JSON.stringify({ message }), now, stepId))
}

function failSteps(db, steps, message, now) {
  for (const step of steps) markStepFailed(db, step.id, message, now)
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
  failSteps(db, ctx.steps, message, now)
  markRunFailed(db, ctx.runId, now)
}

async function performRun(deps, ctx) {
  const { db, aiRuntime } = deps
  const aiSteps = ctx.steps.filter((step) => step.kind === 'ai')
  const memorySteps = ctx.steps.filter((step) => step.kind === 'memory.add')
  const skipStepsList = ctx.steps.filter((step) => step.kind !== 'ai' && step.kind !== 'memory.add')
  if (aiSteps.length === 0) {
    const now = isoNow()
    failSteps(db, memorySteps, MEMORY_ONLY, now)
    failSteps(db, skipStepsList, '没有可执行的 ai 步骤', now)
    markRunFailed(db, ctx.runId, now)
    return
  }
  if (!runtimeConnected(aiRuntime)) {
    const now = isoNow()
    failSteps(db, aiSteps, AI_DOWN, now)
    failSteps(db, memorySteps, MEMORY_ONLY, now)
    skipSteps(db, skipStepsList, now)
    markRunFailed(db, ctx.runId, now)
    return
  }

  const cwd = workspaceCwd(db, ctx.workspaceId)
  const created = await aiRuntime.call('session/create', {
    request: cwd ? { cwd } : {},
  })
  const sessionId = created && typeof created.sessionId === 'string' ? created.sessionId : ''
  if (!sessionId) {
    failRun(db, ctx, '没有建成会话')
    return
  }
  if (!claimRunning(db, ctx.runId, sessionId, isoNow())) return

  const nowClaimed = isoNow()
  failSteps(db, memorySteps, MEMORY_ONLY, nowClaimed)
  skipSteps(db, skipStepsList, nowClaimed)

  let tools = {}
  for (const step of aiSteps) {
    if (!claimStepRunning(db, step.id, isoNow())) continue
    await aiRuntime.call('session/prompt', {
      request: {
        requestId: createId('wrq'),
        sessionId,
        mode: 'queue',
        content: [{ type: 'text', text: promptText(step.config) }],
      },
    })
    const harvest = await harvestTurnToolResults(aiRuntime, sessionId)
    const now = isoNow()
    if (!harvest || harvest.ended !== true) {
      markStepFailed(db, step.id, '回合没有结束', now)
      markRunFailed(db, ctx.runId, now)
      return
    }
    tools = harvest.byTool
    markStepSucceeded(db, step.id, { sessionId, tools }, now)
  }
  const finishedAt = isoNow()
  if (memorySteps.length > 0) {
    markRunFailed(db, ctx.runId, finishedAt)
    return
  }
  markRunSucceeded(db, ctx.runId, { sessionId, tools }, finishedAt)
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

export function startWorkflowRun(deps, command) {
  const db = deps.db
  const workflowId = typeof command?.workflowId === 'string' ? command.workflowId : ''
  const correlationId = typeof command?.correlationId === 'string' ? command.correlationId : ''
  if (command?.trigger?.kind !== 'manual') throw rejectRun(422, 'validation_error', '这个运行只接受手动触发')
  if (!workflowId || isHostJobId(workflowId)) throw rejectRun(404, 'not_found', '工作流不存在')
  const workflow = db.prepare('SELECT id, workspace_id, definition_json FROM workflows WHERE id = ?').get(workflowId)
  if (!workflow) throw rejectRun(404, 'not_found', '工作流不存在')
  const steps = parseSteps(workflow.definition_json)
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
