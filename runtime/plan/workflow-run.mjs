import { randomUUID } from 'node:crypto'
import { planAppSource } from '../app-source.mjs'
import { appendAudit, createId } from '../db.mjs'
import { WORKFLOW_PRESET, WORKFLOW_TOOLS, discardWorkflowAllow, stageWorkflowAllow, workflowLimitReady } from '../fde-x-dsh-bridge/lib/workflow-limit.js'
import { listWorkflowCatalog } from './workflow-catalog.mjs'
import { isHostJobId } from '../host-catalog.mjs'
import { toolTier, waitsForBackground, waitsForPerson } from './tool-risk.mjs'

const MANUAL_TRIGGER_JSON = '{"kind":"manual"}'
const AI_DOWN = '核心 AI 运行时尚未连接'
const MEMORY_ONLY = '没有记忆 M1，这一步只留提案'
const TOOLS_UNRESTRICTED = '核心 AI 暂不支持限制步骤工具，未运行'
const TOOLS_MISMATCH = '工作流会话可见工具不是查询和提案这三项，未运行'
const TOOLS_MISMATCH_CUSTOM = '工作流会话可见工具和这一步选中的工具不一致，未运行'
const TOOLS_UNCHECKED = '工作流会话的可见工具没有核对上，未运行'
const TOOLS_EMPTY = '工具清单不能为空，未运行'
const TOOLS_WAIT = '这一步选了会等人答复的工具，无人值守不能运行'
const TOOLS_BACKGROUND = '这一步选了会停下来等后台任务的工具，无人值守不能运行'
const TOOLS_ASK = '当前权限会要求确认，这一步选了会直接执行的工具，未运行'
const TOOLS_UNCONFIRMED = '直接执行的工具需要逐项确认'
const TOOLS_PERSONA = '这一步要带的人设没有核对上，未运行'

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

function insertQueued(db, { runId, workflowId, correlationId, now, steps, triggerJson, scheduleKey }) {
  const stored = steps.map((step) => ({ ...step, id: createId('wrs') }))
  db.exec('BEGIN IMMEDIATE;')
  try {
    if (scheduleKey) {
      const inserted = db.prepare(`
        INSERT INTO workflow_runs
          (id, workflow_id, state, trigger_json, input_json, output_json, correlation_id, started_at, finished_at, created_at, schedule_key)
        SELECT ?, ?, 'queued', ?, '{}', NULL, ?, NULL, NULL, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM workflow_runs WHERE schedule_key = ?)
          AND NOT EXISTS (
            SELECT 1 FROM workflow_runs
            WHERE workflow_id = ? AND state IN ('queued', 'running')
          )
      `).run(runId, workflowId, triggerJson, correlationId, now, scheduleKey, scheduleKey, workflowId)
      if (inserted.changes !== 1) {
        const existing = db.prepare('SELECT id, state FROM workflow_runs WHERE schedule_key = ?').get(scheduleKey)
        db.exec('COMMIT;')
        return { claimed: false, existing: existing || null, steps: [] }
      }
    } else {
      const open = db.prepare(`
        SELECT id FROM workflow_runs
        WHERE workflow_id = ? AND state IN ('queued', 'running')
        LIMIT 1
      `).get(workflowId)
      if (open) throw rejectRun(409, 'run_in_progress', '这条工作流已有未结束的运行')
      db.prepare(`
        INSERT INTO workflow_runs
          (id, workflow_id, state, trigger_json, input_json, output_json, correlation_id, started_at, finished_at, created_at, schedule_key)
        VALUES (?, ?, 'queued', ?, '{}', NULL, ?, NULL, NULL, ?, ?)
      `).run(runId, workflowId, triggerJson, correlationId, now, null)
    }
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
  return { claimed: true, existing: null, steps: stored }
}

function changed(result) {
  return result.changes === 1
}

function markRunFailed(db, runId, now) {
  return changed(db.prepare(`
    UPDATE workflow_runs
    SET state = 'failed', finished_at = COALESCE(finished_at, ?)
    WHERE id = ? AND state IN ('queued', 'running')
  `).run(now, runId))
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

function namesEqual(expected, actual) {
  const left = [...expected].sort()
  const right = Array.isArray(actual) ? actual.map((name) => (typeof name === 'string' ? name : '')).sort() : []
  return left.length === right.length && left.every((name, index) => name === right[index])
}

function mismatchMessage(tools) {
  return namesEqual(tools, WORKFLOW_TOOLS) ? TOOLS_MISMATCH : TOOLS_MISMATCH_CUSTOM
}

function stepPreset(step) {
  const id = step && step.config && step.config.presetId
  return typeof id === 'string' && id ? id : ''
}

async function personaFor(aiRuntime, cwd, presetId) {
  const catalog = await listWorkflowCatalog(aiRuntime, cwd)
  const preset = (catalog.presets || []).find((row) => row.id === presetId)
  const persona = preset && preset.persona
  if (!persona || typeof persona.text !== 'string' || !persona.text) return null
  return { text: persona.text, complete: persona.complete === true }
}

function stepTools(step) {
  const config = step.config
  if (!config || !Object.hasOwn(config, 'tools')) return [...WORKFLOW_TOOLS]
  const tools = config.tools
  if (!Array.isArray(tools) || tools.length === 0) return null
  if (tools.some((name) => typeof name !== 'string' || !name)) return null
  return tools
}

async function readVisibleTools(aiRuntime, sessionId) {
  const origin = aiRuntime && typeof aiRuntime.origin === 'string' ? aiRuntime.origin : ''
  const cookie = aiRuntime && typeof aiRuntime.cookie === 'string' ? aiRuntime.cookie : ''
  if (!origin || !cookie) return { kind: 'unchecked' }
  let response
  try {
    const url = new URL('/fde-session/visible-tools', origin)
    url.searchParams.set('sessionId', sessionId)
    response = await fetch(url, { headers: { cookie, origin } })
  } catch {
    return { kind: 'unchecked' }
  }
  if (!response.ok) return { kind: 'unchecked' }
  let payload
  try {
    payload = await response.json()
  } catch {
    return { kind: 'unchecked' }
  }
  if (!payload || payload.ok !== true || !Array.isArray(payload.tools)) return { kind: 'unchecked' }
  return {
    kind: 'listed',
    tools: payload.tools,
    approval: payload.approval === 'never' ? 'never' : 'ask',
  }
}

function failRun(db, ctx, message) {
  const now = isoNow()
  failSteps(db, ctx.steps, message, now)
  markRunFailed(db, ctx.runId, now)
}

async function performRun(deps, ctx) {
  const { db, aiRuntime } = deps
  const now = isoNow()
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

  if (!workflowLimitReady()) {
    failSteps(db, aiSteps, TOOLS_UNRESTRICTED, now)
    failSteps(db, memorySteps, MEMORY_ONLY, now)
    skipSteps(db, skipStepsList, now)
    markRunFailed(db, ctx.runId, now)
    return
  }
  const cwd = workspaceCwd(db, ctx.workspaceId)
  if (!cwd) {
    failSteps(db, aiSteps, '工作区没有可用目录，未开会话', now)
    failSteps(db, memorySteps, MEMORY_ONLY, now)
    skipSteps(db, skipStepsList, now)
    markRunFailed(db, ctx.runId, now)
    return
  }
  const allowHome = aiRuntime && aiRuntime.dshHome
  const prepared = []
  const releaseSession = async (requestedId, actualId) => {
    discardWorkflowAllow(requestedId, allowHome)
    if (actualId && actualId !== requestedId) discardWorkflowAllow(actualId, allowHome)
    if (!actualId || !aiRuntime || typeof aiRuntime.call !== 'function') return
    try {
      await aiRuntime.call('workspace/archiveSession', { request: { sessionId: actualId } })
    } catch {
      /* 删不掉会话时，核对失败的结果保持不变 */
    }
  }
  const releasePrepared = async () => {
    const pending = prepared.splice(0, prepared.length)
    for (const item of pending) await releaseSession(item.requestedId, item.sessionId)
  }
  const failPrepared = async (message, extra) => {
    if (extra) await releaseSession(extra.requestedId, extra.actualId)
    await releasePrepared()
    const failedAt = isoNow()
    failSteps(db, aiSteps, message, failedAt)
    failSteps(db, memorySteps, MEMORY_ONLY, failedAt)
    skipSteps(db, skipStepsList, failedAt)
    markRunFailed(db, ctx.runId, failedAt)
  }
  for (const step of aiSteps) {
    const tools = stepTools(step)
    if (!tools) {
      await failPrepared(TOOLS_EMPTY)
      return
    }
    if (tools.some((name) => waitsForPerson(name))) {
      await failPrepared(TOOLS_WAIT)
      return
    }
    if (tools.some((name) => waitsForBackground(name))) {
      await failPrepared(TOOLS_BACKGROUND)
      return
    }
    const requestedId = `session-${randomUUID()}`
    const presetId = stepPreset(step)
    const persona = presetId ? await personaFor(aiRuntime, cwd, presetId) : null
    if (presetId && !persona) {
      await failPrepared(TOOLS_PERSONA)
      return
    }
    stageWorkflowAllow(requestedId, tools, allowHome, persona)
    let created
    try {
      created = await aiRuntime.call('session/create', {
        request: { cwd, agentPreset: WORKFLOW_PRESET, sessionId: requestedId },
      })
    } catch (error) {
      discardWorkflowAllow(requestedId, allowHome)
      await releasePrepared()
      throw error
    }
    const actualId = created && typeof created.sessionId === 'string' ? created.sessionId : ''
    if (!actualId) {
      discardWorkflowAllow(requestedId, allowHome)
      await releasePrepared()
      throw new Error('工作流会话没有建立')
    }
    const visible = await readVisibleTools(aiRuntime, actualId)
    if (visible.kind !== 'listed') {
      await failPrepared(TOOLS_UNCHECKED, { requestedId, actualId })
      return
    }
    if (!namesEqual(tools, visible.tools)) {
      await failPrepared(mismatchMessage(tools), { requestedId, actualId })
      return
    }
    if (tools.some((name) => toolTier(name) === 'danger') && visible.approval !== 'never') {
      await failPrepared(TOOLS_ASK, { requestedId, actualId })
      return
    }
    prepared.push({ step, requestedId, sessionId: actualId, tools: [...tools].sort() })
  }
  try {
    claimRunning(db, ctx.runId, aiSteps, prepared[0].sessionId, prepared[0].tools, isoNow())
  } catch (error) {
    await releasePrepared()
    throw error
  }
  for (const item of prepared) {
    await aiRuntime.call('session/prompt', {
      request: {
        requestId: createId('req'),
        sessionId: item.sessionId,
        mode: 'queue',
        content: [{ type: 'text', text: stepText(item.step) }],
      },
    })
    await followTurn(aiRuntime, item.sessionId)
    markStepSucceeded(db, item.step.id, isoNow())
  }
  const finished = isoNow()
  failSteps(db, memorySteps, MEMORY_ONLY, finished)
  skipSteps(db, skipStepsList, finished)
  if (memorySteps.length > 0) markRunFailed(db, ctx.runId, finished)
  else markRunSucceeded(db, ctx.runId, finished)
}

function workspaceCwd(db, workspaceId) {
  const row = db.prepare('SELECT metadata_json FROM workspaces WHERE id = ?').get(workspaceId)
  if (!row) return ''
  const meta = JSON.parse(row.metadata_json ?? '{}')
  const raw = typeof meta.cwd === 'string' ? meta.cwd : typeof meta.path === 'string' ? meta.path : ''
  const cwd = String(raw).trim()
  return cwd.startsWith('/') ? cwd : ''
}

function stepText(step) {
  const prompt = typeof step.config.prompt === 'string' ? step.config.prompt.trim() : ''
  const sourceRef = typeof step.config.sourceRef === 'string' ? step.config.sourceRef.trim() : ''
  if (!sourceRef) return prompt
  return `${prompt}\n来源：${sourceRef}`
}

function claimRunning(db, runId, steps, sessionId, tools, now) {
  const run = db.prepare(`
    UPDATE workflow_runs
    SET state = 'running', started_at = COALESCE(started_at, ?), output_json = ?
    WHERE id = ? AND state = 'queued'
  `).run(now, JSON.stringify({ sessionId, tools }), runId)
  if (run.changes !== 1) throw new Error('运行没能进入 running')
  for (const step of steps) {
    const updated = db.prepare(`
      UPDATE workflow_run_steps
      SET state = 'running', started_at = COALESCE(started_at, ?)
      WHERE id = ? AND state = 'queued'
    `).run(now, step.id)
    if (updated.changes !== 1) throw new Error('步骤没能进入 running')
  }
}

function markStepSucceeded(db, stepId, now) {
  const updated = db.prepare(`
    UPDATE workflow_run_steps
    SET state = 'succeeded', finished_at = COALESCE(finished_at, ?)
    WHERE id = ? AND state = 'running'
  `).run(now, stepId)
  if (updated.changes !== 1) throw new Error('步骤没能完成')
}

function markRunSucceeded(db, runId, now) {
  const updated = db.prepare(`
    UPDATE workflow_runs
    SET state = 'succeeded', finished_at = COALESCE(finished_at, ?)
    WHERE id = ? AND state = 'running'
  `).run(now, runId)
  if (updated.changes !== 1) throw new Error('运行没能完成')
}

async function followTurn(aiRuntime, sessionId) {
  if (!aiRuntime || typeof aiRuntime.stream !== 'function') throw new Error('会话没有结束这一轮')
  const stream = aiRuntime.stream('session/follow', {
    request: {
      address: { kind: 'session', sessionId },
      maxMessages: 80,
    },
  })
  for await (const frame of stream) {
    const event = frame && frame.type === 'event' ? frame.event : null
    if (event && event.type === 'turn/end') return
  }
  throw new Error('会话没有结束这一轮')
}

function continueRun(deps, ctx) {
  queueMicrotask(() => {
    performRun(deps, ctx).catch((error) => {
      const message = error instanceof Error && error.message ? error.message : '运行失败'
      failRun(deps.db, ctx, message)
    })
  })
}

export function readWorkflowRuns(db, workflowIds) {
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
    SELECT id, workflow_id, state, output_json
    FROM workflow_runs
    WHERE workflow_id IN (${placeholders})
    ORDER BY created_at DESC, rowid DESC
  `).all(...ids)
  const grouped = new Map()
  for (const row of rows) {
    let message = ''
    let sessionId = ''
    if (row.output_json) {
      const output = JSON.parse(row.output_json)
      message = typeof output.message === 'string' ? output.message : ''
      sessionId = typeof output.sessionId === 'string' ? output.sessionId : ''
    }
    const list = grouped.get(row.workflow_id) || []
    const run = { id: row.id, state: row.state, message }
    if (sessionId) run.sessionId = sessionId
    list.push(run)
    grouped.set(row.workflow_id, list)
  }
  return grouped
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

function auditInterrupted(db, row, targetRef, action, now) {
  appendAudit(db, {
    workspaceId: row.workspace_id,
    actorId: 'actor_system',
    action,
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
      auditInterrupted(db, step, `fde://plan/workflow-run-steps/${step.id}`, 'workflow_run_step.reaped', now)
    }
    for (const run of runs) {
      if (failRun.run(now, run.id).changes !== 1) continue
      auditInterrupted(db, run, `fde://plan/workflow-runs/${run.id}`, 'workflow_run.reaped', now)
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

function unconfirmedScheduleDanger(definitionJson) {
  let definition = {}
  try {
    definition = JSON.parse(definitionJson)
  } catch {
    definition = {}
  }
  const confirmed = new Set(Array.isArray(definition.confirmedDanger)
    ? definition.confirmedDanger.filter((name) => typeof name === 'string')
    : [])
  const steps = Array.isArray(definition.steps) ? definition.steps : []
  for (const step of steps) {
    if (!step || step.kind !== 'ai' || !step.config || typeof step.config !== 'object' || Array.isArray(step.config)) continue
    if (!Object.hasOwn(step.config, 'tools') || !Array.isArray(step.config.tools)) continue
    for (const name of step.config.tools) {
      if (typeof name === 'string' && toolTier(name) === 'danger' && !confirmed.has(name)) return TOOLS_UNCONFIRMED
    }
  }
  return ''
}

function acceptedTrigger(command) {
  const trigger = command?.trigger
  if (trigger?.kind === 'manual') return { json: MANUAL_TRIGGER_JSON, scheduleKey: null }
  if (trigger?.kind !== 'schedule') throw rejectRun(422, 'validation_error', '这个运行只接受手动触发')
  const eventId = typeof trigger.eventId === 'string' ? trigger.eventId : ''
  const occurrence = typeof trigger.occurrence === 'string' ? trigger.occurrence : ''
  if (!eventId || !occurrence) throw rejectRun(422, 'validation_error', '这个运行只接受手动触发')
  return {
    json: JSON.stringify({ kind: 'schedule', eventId, occurrence }),
    scheduleKey: `${eventId}@${occurrence}`,
  }
}

export function startWorkflowRun(deps, command) {
  const db = deps.db
  const workflowId = typeof command?.workflowId === 'string' ? command.workflowId : ''
  const correlationId = typeof command?.correlationId === 'string' ? command.correlationId : ''
  const workspaceId = typeof command?.workspaceId === 'string' ? command.workspaceId.trim() : ''
  const trigger = acceptedTrigger(command)
  if (!workspaceId) throw rejectRun(400, 'missing_workspace_id', '缺少 workspaceId')
  if (!workflowId || isHostJobId(workflowId)) throw rejectRun(404, 'not_found', '工作流不存在')
  const workflow = db.prepare('SELECT id, workspace_id, definition_json FROM workflows WHERE id = ?').get(workflowId)
  if (!workflow || workflow.workspace_id !== workspaceId) throw rejectRun(404, 'not_found', '工作流不存在')
  const steps = parseSteps(workflow.definition_json)
  if (hasIllegalSourceRef(steps)) throw rejectRun(422, 'invalid_source_ref', '来源引用不合法')
  assertAiPrompts(steps)
  const runId = createId('wfr')
  const queued = insertQueued(db, {
    runId,
    workflowId,
    correlationId,
    now: isoNow(),
    steps,
    triggerJson: trigger.json,
    scheduleKey: trigger.scheduleKey,
  })
  if (!queued.claimed) {
    if (queued.existing) {
      return {
        id: queued.existing.id,
        workflowId,
        state: queued.existing.state,
        correlationId,
        already: true,
      }
    }
    return {
      id: '',
      workflowId,
      state: 'queued',
      correlationId,
      busy: true,
    }
  }
  if (trigger.scheduleKey) {
    const blocked = unconfirmedScheduleDanger(workflow.definition_json)
    if (blocked) {
      failRun(db, { runId, steps: queued.steps }, blocked)
      return {
        id: runId,
        workflowId,
        state: 'failed',
        correlationId,
      }
    }
  }
  continueRun(deps, {
    runId,
    workspaceId: workflow.workspace_id,
    steps: queued.steps,
  })
  return {
    id: runId,
    workflowId,
    state: 'queued',
    correlationId,
  }
}
