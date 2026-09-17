import { getOrCreateDefinition, listScheduledDefinitions } from './store.mjs'
import { runBriefing } from './run.mjs'
import { listWorkspaces } from '../db.mjs'

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

function workspaceCwdForDefinition(db, workspaceId) {
  const row = db.prepare('SELECT metadata_json FROM workspaces WHERE id = ?').get(workspaceId)
  if (row) {
    try {
      const meta = JSON.parse(row.metadata_json || '{}')
      const path = typeof meta.cwd === 'string' ? meta.cwd : typeof meta.path === 'string' ? meta.path : ''
      if (path.startsWith('/')) return path
    } catch { /* fall through */ }
  }
  for (const ws of listWorkspaces(db)) {
    if (ws.id === workspaceId) {
      const meta = ws.metadata && typeof ws.metadata === 'object' ? ws.metadata : {}
      const path = typeof meta.cwd === 'string' ? meta.cwd : typeof meta.path === 'string' ? meta.path : ''
      if (path.startsWith('/')) return path
    }
  }
  return ''
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
  const row = db.prepare(`
    SELECT generated_at, created_at FROM briefings
    WHERE workspace_cwd = ?
    ORDER BY COALESCE(generated_at, created_at) DESC LIMIT 1
  `).get(workspaceCwd)
  if (!row) return null
  const ts = new Date(row.generated_at || row.created_at)
  const now = clock()
  if (ts.toDateString() === now.toDateString()) return row
  return null
}

export function shouldRunOnOpen(db, workspaceCwd) {
  const definition = getOrCreateDefinition(db, workspaceCwd)
  if (!definition.schedule?.onOpen) return false
  return !latestBriefingToday(db, workspaceCwd)
}

/**
 * @param {{ db: import('node:sqlite').DatabaseSync, aiRuntime: object, defaultCwd: string }} deps
 */
export function startBriefingScheduler(deps) {
  const tick = async () => {
    const now = clock()
    const dayKey = now.toDateString()
    for (const row of listScheduledDefinitions(deps.db)) {
      let schedule = {}
      try {
        schedule = JSON.parse(row.schedule_json || '{}')
      } catch { continue }
      if (!shouldFireSchedule(schedule, now)) continue
      const at = schedule.at || '08:30'
      const key = scheduleKey(row.id, dayKey, at)
      if (firedToday.has(key)) continue
      firedToday.set(key, true)
      const workspaceCwd = workspaceCwdForDefinition(deps.db, row.workspace_id) || deps.defaultCwd
      if (!workspaceCwd.startsWith('/')) continue
      try {
        const connected = deps.aiRuntime?.status?.().connected
        await runBriefing(deps, {
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

  const timer = setInterval(() => {
    void tick()
  }, TICK_MS)
  timer.unref?.()
  return timer
}

export function rescheduleBriefingForWorkspace(db, workspaceCwd) {
  getOrCreateDefinition(db, workspaceCwd)
}
