import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createId } from './db.mjs'
import { workspaceCwdForId } from './briefing/workspace.mjs'
import { emit } from './events.mjs'
import { isMailProbeEntry } from './mail-providers.mjs'
import { parseMcpPatchEntries, readMcpArchiveText } from './mcp-archive.mjs'
import { checkMcpHealth } from './routes/mcp.mjs'
import { setOsNotifyGates } from './os-notify.mjs'

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_GATES = { taskDueSoonNotify: true, mcpDownNotify: true }

function dateOnlyParts(dueAt) {
  return /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dueAt || '').trim())
}

export function dueStartMs(dueAt) {
  const dateOnly = dateOnlyParts(dueAt)
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 0, 0, 0, 0).getTime()
  }
  const ms = Date.parse(String(dueAt || ''))
  return Number.isFinite(ms) ? ms : NaN
}

export function dueEndMs(dueAt) {
  const dateOnly = dateOnlyParts(dueAt)
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 23, 59, 59, 999).getTime()
  }
  return dueStartMs(dueAt)
}

export function inDueSoonWindow(dueAt, nowMs) {
  const start = dueStartMs(dueAt)
  const end = dueEndMs(dueAt)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false
  return nowMs >= start - DAY_MS && nowMs <= end
}

export function tickDueSoon(db, { now = new Date(), emitFn = emit } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now)
  const nowIso = new Date(nowMs).toISOString()
  const tasks = db.prepare(`
    SELECT id, workspace_id, title, due_at FROM tasks
    WHERE status IN ('todo', 'doing') AND due_at IS NOT NULL AND due_at != ''
  `).all()
  const fired = []
  for (const task of tasks) {
    if (!inDueSoonWindow(task.due_at, nowMs)) continue
    const subject = `task:${task.id}:${task.due_at}`
    const existing = db.prepare('SELECT id, state FROM reminders WHERE subject_ref = ?').get(subject)
    if (existing && existing.state === 'fired') continue
    const id = existing?.id || createId('rem')
    if (existing) {
      db.prepare('UPDATE reminders SET state = ?, updated_at = ? WHERE id = ?').run('fired', nowIso, id)
    } else {
      db.prepare(`
        INSERT INTO reminders (id, workspace_id, subject_ref, remind_at, state, channel_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'fired', '{}', ?, ?)
      `).run(id, task.workspace_id, subject, nowIso, nowIso, nowIso)
    }
    emitFn('task.due.soon', {
      id: task.id,
      title: task.title,
      dueAt: task.due_at,
    }, { workspaceCwd: workspaceCwdForId(db, task.workspace_id) })
    fired.push(task.id)
  }
  return fired
}

export async function tickMcpHealth({
  listEntries,
  checkHealth = checkMcpHealth,
  state,
  emitFn = emit,
} = {}) {
  const entries = typeof listEntries === 'function' ? await listEntries() : []
  const seen = new Set()
  const fired = []
  for (const entry of entries) {
    const name = String(entry?.serverName || '').trim()
    if (!name || isMailProbeEntry(entry)) continue
    seen.add(name)
    let health
    try {
      health = await checkHealth(entry)
    } catch (error) {
      health = { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
    const ok = Boolean(health && health.ok)
    const prev = state.get(name)
    state.set(name, ok)
    if (prev === true && ok === false) {
      emitFn('mcp.health.changed', {
        serverName: name,
        ok: false,
        message: String(health?.message || '连接失败'),
      }, { workspaceCwd: null })
      fired.push(name)
    }
  }
  for (const name of [...state.keys()]) {
    if (!seen.has(name)) state.delete(name)
  }
  return fired
}

export function notifyPrefsPath(dshHome) {
  return join(dshHome || '', 'notify-prefs.json')
}

export function readNotifyPrefs(dshHome) {
  try {
    const raw = JSON.parse(readFileSync(notifyPrefsPath(dshHome), 'utf8'))
    return {
      taskDueSoonNotify: raw.taskDueSoonNotify !== false,
      mcpDownNotify: raw.mcpDownNotify !== false,
    }
  } catch {
    return { ...DEFAULT_GATES }
  }
}

export function writeNotifyPrefs(dshHome, patch = {}) {
  const next = {
    ...readNotifyPrefs(dshHome),
    ...patch,
  }
  const prefs = {
    taskDueSoonNotify: next.taskDueSoonNotify !== false,
    mcpDownNotify: next.mcpDownNotify !== false,
  }
  try {
    writeFileSync(notifyPrefsPath(dshHome), JSON.stringify(prefs))
  } catch (error) {
    console.warn('notify_prefs_write_failed', error)
  }
  setOsNotifyGates(prefs)
  return prefs
}

export function startNotifyWatch({ db, aiRuntime, intervalMs = 60_000 } = {}) {
  if (process.env.NODE_TEST_CONTEXT) return { stop() {} }
  const home = aiRuntime?.dshHome || process.env.FDE_DSH_HOME || ''
  setOsNotifyGates(readNotifyPrefs(home))
  const mcpState = new Map()
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      tickDueSoon(db)
      await tickMcpHealth({
        state: mcpState,
        listEntries: async () => parseMcpPatchEntries(await readMcpArchiveText(aiRuntime)),
      })
    } catch (error) {
      console.warn('notify_watch_tick_failed', error)
    } finally {
      running = false
    }
  }
  const timer = setInterval(() => { void tick() }, intervalMs)
  if (typeof timer.unref === 'function') timer.unref()
  const first = setTimeout(() => { void tick() }, 3_000)
  if (typeof first.unref === 'function') first.unref()
  return {
    stop() {
      clearInterval(timer)
      clearTimeout(first)
    },
  }
}
