import { findInFlightBriefing, getLatestBriefing, getOrCreateDefinition, listScheduledDefinitions } from './store.mjs'
import { runBriefing } from './run.mjs'
import { canonicalWorkspaceCwd } from '../cwd.mjs'

const TICK_MS = 60_000
const firedToday = new Map()

/** @type {() => Date} */
let clock = () => new Date()

export function setBriefingClock(fn) {
  clock = typeof fn === 'function' ? fn : () => new Date()
}

function scheduleKey(definitionId, dayKey, at) {
  return `${definitionId}:${dayKey}:${at}`
}

function rawWorkspacePath(meta) {
  if (!meta || typeof meta !== 'object') return ''
  if (typeof meta.cwd === 'string' && meta.cwd.trim()) return meta.cwd
  if (typeof meta.path === 'string' && meta.path.trim()) return meta.path
  return ''
}

function storedWorkspaceCwd(db, workspaceId) {
  const row = db.prepare('SELECT metadata_json FROM workspaces WHERE id = ?').get(workspaceId)
  if (!row) return { cwd: '' }
  const raw = rawWorkspacePath(JSON.parse(row.metadata_json || '{}'))
  if (!raw) return { cwd: '' }
  const cwd = canonicalWorkspaceCwd(raw)
  if (!cwd) return { illegal: true, raw }
  return { cwd }
}

function shouldFireSchedule(schedule, now) {
  if (!schedule || typeof schedule !== 'object') return false
  const at = typeof schedule.at === 'string' ? schedule.at : ''
  if (!/^\d{2}:\d{2}$/u.test(at)) return false
  const days = Array.isArray(schedule.days) ? schedule.days : [1, 2, 3, 4, 5]
  const day = now.getDay()
  if (!days.includes(day)) return false
  const [hh, mm] = at.split(':').map((n) => Number(n))
  const current = now.getHours() * 60 + now.getMinutes()
  const target = hh * 60 + mm
  return current >= target && current < target + 2
}

function latestBriefingToday(db, workspaceCwd) {
  const row = getLatestBriefing(db, workspaceCwd)
  if (!row) return null
  const ts = new Date(row.generatedAt)
  const now = clock()
  if (ts.toDateString() === now.toDateString()) return row
  return null
}

export function shouldRunOnOpen(db, workspaceCwd) {
  let definition
  try {
    definition = getOrCreateDefinition(db, workspaceCwd)
  } catch (error) {
    if (error && error.code === 'missing_workspace') return false
    throw error
  }
  if (!definition.schedule?.onOpen) return false
  return !latestBriefingToday(db, workspaceCwd)
}

/**
 * @param {{ db: import('node:sqlite').DatabaseSync, aiRuntime: object, defaultCwd: string }} deps
 */
export async function tickBriefingScheduler(deps) {
  const now = clock()
  const dayKey = now.toDateString()
  const execute = typeof deps.runBriefing === 'function' ? deps.runBriefing : runBriefing
  for (const row of listScheduledDefinitions(deps.db)) {
    let schedule = {}
    try {
      schedule = JSON.parse(row.schedule_json || '{}')
    } catch { continue }
    if (!shouldFireSchedule(schedule, now)) continue
    const at = schedule.at || '08:30'
    const key = scheduleKey(row.id, dayKey, at)
    const stored = storedWorkspaceCwd(deps.db, row.workspace_id)
    if (stored.illegal) {
      console.warn('briefing_schedule_skipped', row.id, stored.raw)
      continue
    }
    const workspaceCwd = stored.cwd || canonicalWorkspaceCwd(deps.defaultCwd)
    if (!workspaceCwd) continue
    if (firedToday.has(key)) continue
    firedToday.set(key, true)
    try {
      if (findInFlightBriefing(deps.db, workspaceCwd)) continue
      const connected = deps.aiRuntime?.status?.().connected
      await execute(deps, {
        workspaceCwd,
        mode: connected ? 'full' : 'internal-only',
      })
    } catch (error) {
      console.warn('briefing_scheduled_run_failed', row.id, error)
    }
  }
  if (firedToday.size > 500) {
    for (const k of firedToday.keys()) {
      if (!k.includes(dayKey)) firedToday.delete(k)
    }
  }
}

export function startBriefingScheduler(deps) {
  const timer = setInterval(() => {
    void tickBriefingScheduler(deps)
  }, TICK_MS)
  timer.unref?.()
  return timer
}

export function rescheduleBriefingForWorkspace(db, workspaceCwd) {
  getOrCreateDefinition(db, workspaceCwd)
}
