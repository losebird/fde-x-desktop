import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase } from '../db.mjs'
import { getOrCreateDefinition } from '../briefing/store.mjs'
import { setBriefingClock, tickBriefingScheduler } from '../briefing/scheduler.mjs'

function insertSchedule(db, workspaceId) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO briefing_definitions
      (id, workspace_id, name, status, sources_json, sections_json, filters_json, schedule_json, delivery_json, template_json, created_at, updated_at)
    VALUES (?, ?, 'sched', 'active', '[]', '[]', '{}', ?, '{}', '{}', ?, ?)
  `).run(
    `bdef_${workspaceId}`,
    workspaceId,
    JSON.stringify({ at: '08:30', days: [1, 2, 3, 4, 5], onOpen: true }),
    now,
    now,
  )
}

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const DEFAULT_CWD = '/tmp/sched-default'

function registerWorkspace(db, id, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, 'cwd', '', 'active', ?, ?, ?)
  `).run(id, JSON.stringify(cwd ? { cwd } : {}), now, now)
}

test('a drive-letter schedule runs and an illegal stored cwd does not use the default workspace', async () => {
  const db = openDatabase(`/tmp/fde-sched-cwd-${process.pid}.sqlite`, join(repoRoot, 'runtime/migrations'))
  registerWorkspace(db, 'ws_sched_drive', 'C:/sched')
  registerWorkspace(db, 'ws_sched_bad', 'proj')
  registerWorkspace(db, 'ws_sched_empty', '')
  getOrCreateDefinition(db, 'C:/sched')
  insertSchedule(db, 'ws_sched_bad')
  insertSchedule(db, 'ws_sched_empty')
  const calls = []
  setBriefingClock(() => new Date('2026-10-19T08:30:00'))
  await tickBriefingScheduler({
    db,
    aiRuntime: { status: () => ({ connected: false }) },
    defaultCwd: DEFAULT_CWD,
    runBriefing: async (_deps, input) => {
      calls.push(input.workspaceCwd)
    },
  })
  db.close()
  assert.ok(calls.includes('C:/sched'))
  assert.equal(calls.filter((cwd) => cwd === DEFAULT_CWD).length, 1)
  assert.equal(calls.includes('proj'), false)
})
