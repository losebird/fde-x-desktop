import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import { openDatabase } from '../db.mjs'
import { getOrCreateDefinition } from '../briefing/store.mjs'
import { runBriefing } from '../briefing/run.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrations = join(repoRoot, 'runtime', 'migrations')
const wsCwd = '/tmp/fde-x-briefing-inflight-ws'

function makeDb(path) {
  return openDatabase(path, migrations)
}

function registerWorkspace(db, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT OR REPLACE INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES ('ws_inflight', 't', '', 'active', ?, ?, ?)
  `).run(JSON.stringify({ cwd }), now, now)
}

test('a second full run joins the in-flight briefing and does not prompt again', async () => {
  const path = '/tmp/fde-x-briefing-inflight.sqlite'
  await rm(path, { force: true }).catch(() => undefined)
  const db = makeDb(path)
  registerWorkspace(db, wsCwd)
  getOrCreateDefinition(db, wsCwd)
  let prompts = 0
  const aiRuntime = {
    status: () => ({ connected: true }),
    call: async (endpoint) => {
      if (endpoint === 'session/list') {
        return { items: [{ sessionId: 'sess-a', cwd: wsCwd, origin: 'user', updatedAt: 2, running: false }] }
      }
      if (endpoint === 'session/prompt') {
        prompts += 1
        return {}
      }
      return {}
    },
    async *stream() {
      yield { type: 'event', event: { type: 'turn/start', data: {} } }
      yield { type: 'event', event: { type: 'turn/end', data: {} } }
    },
  }
  const first = runBriefing({ db, aiRuntime }, { workspaceCwd: wsCwd, mode: 'full' })
  const second = runBriefing({ db, aiRuntime }, { workspaceCwd: wsCwd, mode: 'full' })
  const [a, b] = await Promise.all([first, second])
  assert.equal(a.briefingId, b.briefingId)
  assert.equal(Boolean(a.joined) && Boolean(b.joined), false)
  assert.equal(Boolean(a.joined) || Boolean(b.joined), true)
  assert.equal(prompts, 1)
  db.close()
})

test('onOpen full skips the canvas-selected session', async () => {
  const path = '/tmp/fde-x-briefing-canvas.sqlite'
  await rm(path, { force: true }).catch(() => undefined)
  const db = makeDb(path)
  registerWorkspace(db, wsCwd)
  getOrCreateDefinition(db, wsCwd)
  let prompts = 0
  const aiRuntime = {
    status: () => ({ connected: true }),
    call: async (endpoint) => {
      if (endpoint === 'session/list') {
        return { items: [{ sessionId: 'sess-canvas', cwd: wsCwd, origin: 'user', updatedAt: 9, running: false }] }
      }
      if (endpoint === 'session/prompt') {
        prompts += 1
        return {}
      }
      return {}
    },
  }
  await runBriefing({ db, aiRuntime }, { workspaceCwd: wsCwd, mode: 'internal-only' })
  const full = await runBriefing({ db, aiRuntime }, {
    workspaceCwd: wsCwd,
    mode: 'full',
    skipIfCanvas: true,
    canvasSessionId: 'sess-canvas',
  })
  assert.equal(full.skippedCanvas, true)
  assert.equal(prompts, 0)
  db.close()
})

test('Briefing land uses onOpen=0; openRef increments land', () => {
  const briefing = readFileSync(join(repoRoot, 'src/pages/Briefing.tsx'), 'utf8')
  assert.match(briefing, /briefingLand/)
  assert.match(briefing, /refresh\(false\)/)
  assert.match(briefing, /refresh\(true\)/)
  const openRef = readFileSync(join(repoRoot, 'src/lib/open-ref.ts'), 'utf8')
  assert.match(openRef, /setBriefingBrowse\(\{ land:/)
  const routes = readFileSync(join(repoRoot, 'runtime/routes/briefing.mjs'), 'utf8')
  assert.match(routes, /skipIfCanvas: true/)
  assert.match(routes, /canvasSessionId/)
})
