import { createId } from '../db.mjs'
import { startWorkflowRun } from './workflow-run.mjs'
import { SCHEDULE_BUSY_MESSAGE, SCHEDULE_MISSED_MESSAGE, SCHEDULE_PAUSED_MESSAGE } from './schedule-outcome.mjs'

const BUSY_GRACE_MS = 30_000

function civilParts(instant, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const bag = {}
  for (const part of fmt.formatToParts(new Date(instant))) {
    if (part.type !== 'literal') bag[part.type] = part.value
  }
  let year = Number(bag.year)
  let month = Number(bag.month)
  let day = Number(bag.day)
  let hour = Number(bag.hour)
  if (hour === 24) {
    hour = 0
    const next = new Date(Date.UTC(year, month - 1, day) + 24 * 60 * 60 * 1000)
    year = next.getUTCFullYear()
    month = next.getUTCMonth() + 1
    day = next.getUTCDate()
  }
  return {
    year,
    month,
    day,
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
  }
}

function zonedInstant(year, month, day, hour, minute, second, timeZone) {
  const want = Date.UTC(year, month - 1, day, hour, minute, second)
  let guess = want
  for (let pass = 0; pass < 2; pass += 1) {
    const got = civilParts(guess, timeZone)
    const gotMs = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute, got.second)
    const delta = want - gotMs
    if (delta === 0) return new Date(guess).toISOString()
    guess += delta
  }
  const got = civilParts(guess, timeZone)
  const gotMs = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute, got.second)
  if (gotMs !== want) {
    throw new Error(`无法把日程时间换到 ${timeZone}`)
  }
  return new Date(guess).toISOString()
}

function addCivilDays(year, month, day, days) {
  const next = new Date(Date.UTC(year, month - 1, day) + days * 24 * 60 * 60 * 1000)
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() }
}

function civilKey(parts) {
  return parts.year * 10000 + parts.month * 100 + parts.day
}

export function occurrenceInstants(event, untilMs) {
  const startMs = Date.parse(event.start_at)
  const zone = typeof event.timezone === 'string' && event.timezone ? event.timezone : 'Asia/Shanghai'
  if (event.recurrence === 'once') {
    if (startMs <= untilMs) return [new Date(startMs).toISOString()]
    return []
  }
  const createdMs = Date.parse(event.created_at)
  const bound = Math.floor(Math.max(startMs, createdMs) / 1000) * 1000
  const clock = civilParts(startMs, zone)
  let cursor = civilParts(bound, zone)
  const untilKey = civilKey(civilParts(untilMs, zone))
  const points = []
  while (civilKey(cursor) <= untilKey) {
    const iso = zonedInstant(cursor.year, cursor.month, cursor.day, clock.hour, clock.minute, clock.second, zone)
    const at = Date.parse(iso)
    if (at >= bound && at <= untilMs) points.push(iso)
    cursor = { ...addCivilDays(cursor.year, cursor.month, cursor.day, 1), hour: 0, minute: 0, second: 0 }
  }
  return points
}

function recordScheduleResult(db, row, occurrence, state, message) {
  const scheduleKey = `${row.id}@${occurrence}`
  const now = new Date().toISOString()
  const runId = createId('wfr')
  db.exec('BEGIN IMMEDIATE;')
  try {
    db.prepare(`
      INSERT INTO workflow_runs
        (id, workflow_id, state, trigger_json, input_json, output_json, correlation_id, started_at, finished_at, created_at, schedule_key)
      SELECT ?, ?, ?, ?, '{}', ?, ?, NULL, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM workflow_runs WHERE schedule_key = ?)
    `).run(
      runId,
      row.workflow_id,
      state,
      JSON.stringify({ kind: 'schedule', eventId: row.id, occurrence }),
      JSON.stringify({ message }),
      `schedule:${row.id}:${occurrence}`,
      now,
      now,
      scheduleKey,
      scheduleKey,
    )
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

function hasScheduleRun(db, scheduleKey) {
  return Boolean(db.prepare('SELECT 1 AS hit FROM workflow_runs WHERE schedule_key = ?').get(scheduleKey))
}

function businessFailureMessage(error) {
  const status = error && typeof error === 'object' && typeof error.status === 'number' ? error.status : 0
  const message = error instanceof Error ? error.message : ''
  if (status < 400 || status >= 500 || !message) return ''
  return message
}

function fireOccurrence(deps, row, occurrence, now, bootedAt, started) {
  const at = Date.parse(occurrence)
  if (at > now.getTime()) return
  const scheduleKey = `${row.id}@${occurrence}`
  if (hasScheduleRun(deps.db, scheduleKey)) return
  if (row.workflow_status !== 'active') {
    recordScheduleResult(deps.db, row, occurrence, 'cancelled', SCHEDULE_PAUSED_MESSAGE)
    return
  }
  if (at < bootedAt.getTime()) {
    recordScheduleResult(deps.db, row, occurrence, 'cancelled', SCHEDULE_MISSED_MESSAGE)
    return
  }
  const ticket = startWorkflowRun(deps, {
    workflowId: row.workflow_id,
    workspaceId: row.workspace_id,
    correlationId: `schedule:${row.id}:${occurrence}`,
    trigger: { kind: 'schedule', eventId: row.id, occurrence },
  })
  if (ticket.already) return
  if (ticket.busy) {
    if (now.getTime() - at >= BUSY_GRACE_MS) {
      recordScheduleResult(deps.db, row, occurrence, 'cancelled', SCHEDULE_BUSY_MESSAGE)
    }
    return
  }
  started.push(ticket)
}

export async function tickWorkflowSchedules(deps, clock) {
  const now = clock.now instanceof Date ? clock.now : new Date(clock.now)
  const bootedAt = clock.bootedAt instanceof Date ? clock.bootedAt : new Date(clock.bootedAt)
  const rows = deps.db.prepare(`
    SELECT e.id, e.workspace_id, e.start_at, e.timezone, e.recurrence, e.workflow_id, e.created_at,
           w.status AS workflow_status, w.workspace_id AS workflow_workspace_id
    FROM calendar_events e
    JOIN workflows w ON w.id = e.workflow_id
    WHERE e.workflow_id IS NOT NULL
      AND e.recurrence IN ('once', 'daily')
      AND w.status IN ('active', 'paused')
      AND w.workspace_id = e.workspace_id
  `).all()
  const started = []
  for (const row of rows) {
    let points = []
    try {
      points = occurrenceInstants(row, now.getTime())
    } catch (error) {
      console.error('workflow_schedule_tick_failed', error)
      continue
    }
    for (const occurrence of points) {
      try {
        fireOccurrence(deps, row, occurrence, now, bootedAt, started)
      } catch (error) {
        const message = businessFailureMessage(error)
        if (message) {
          try {
            recordScheduleResult(deps.db, row, occurrence, 'failed', message)
          } catch (writeError) {
            console.error('workflow_schedule_tick_failed', writeError)
          }
          continue
        }
        console.error('workflow_schedule_tick_failed', error)
      }
    }
  }
  return { started }
}
