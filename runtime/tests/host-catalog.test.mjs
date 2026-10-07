import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  KIND_ORDER,
  ORIGIN_DSH_GOAL,
  ORIGIN_DSH_JOB,
  ORIGIN_DSH_SCHEDULE,
  ORIGIN_FDE_TASK,
  PAGE_CATALOG,
  SEAM_CATALOG,
  SEAM_SESSION,
  collectGoals,
  hostGoalId,
  isHostGoalId,
  isHostJobId,
  isHostScheduleId,
  mergeTaskRows,
  mutateHostGoal,
  seamOfKind,
  surfaceOfKind,
  taskFromGoalView,
} from '../host-catalog.mjs'

test('known kinds land on existing FDE-X pages; unknown kind overflows to settings plugins', () => {
  assert.equal(seamOfKind('session'), SEAM_SESSION)
  assert.equal(surfaceOfKind('file').href.panel, 'files')
  assert.equal(surfaceOfKind('mcp').href.panel, 'mcp')
  assert.equal(surfaceOfKind('skill').href.panel, 'skills')
  assert.equal(surfaceOfKind('officeToPdf').href.panel, 'skills')
  assert.equal(surfaceOfKind('goal').href.tab, 'todo')
  assert.equal(surfaceOfKind('schedule').href.tab, 'schedule')
  assert.equal(surfaceOfKind('job').href.tab, 'workflow')
  assert.equal(surfaceOfKind('workflow').href.tab, 'workflow')
  assert.equal(surfaceOfKind('plugin').href.panel, 'settings')
  assert.equal(surfaceOfKind('terminal').href.accessory, 'terminal')
  assert.equal(surfaceOfKind('shortcut').href.section, 'shortcuts')
  const overflow = surfaceOfKind('browser-use')
  assert.equal(overflow.seam, SEAM_CATALOG)
  assert.equal(overflow.href.panel, 'settings')
  assert.equal(overflow.href.section, 'core')
  assert.ok(PAGE_CATALOG.every((page) => page.href && page.href.panel))
  assert.ok(KIND_ORDER.includes('file'))
})

test('goal view maps to a plan row with dsh-goal origin', () => {
  const row = taskFromGoalView({
    id: 'g1',
    objective: '收口工单',
    phase: 'active',
    revision: 3,
    createdAt: 1,
    updatedAt: 2,
  }, 'ws-a')
  assert.equal(row.id, `${ORIGIN_DSH_GOAL}g1`)
  assert.equal(row.sourceRef, `${ORIGIN_DSH_GOAL}g1`)
  assert.equal(row.status, 'doing')
  assert.equal(row.workspaceId, 'ws-a')
  assert.equal(isHostGoalId(row.id), true)
  assert.equal(hostGoalId('g1'), row.id)
})

test('merge keeps local fde-task rows and host goal rows as one sheet', () => {
  const merged = mergeTaskRows(
    [{ id: 'task_1', title: '本地', sourceRef: `${ORIGIN_FDE_TASK}task_1` }],
    [{ id: `${ORIGIN_DSH_GOAL}g1`, title: 'Host', sourceRef: `${ORIGIN_DSH_GOAL}g1` }],
  )
  assert.equal(merged.length, 2)
  assert.ok(merged.some((row) => row.id === 'task_1'))
  assert.ok(merged.some((row) => row.id === `${ORIGIN_DSH_GOAL}g1`))
})

test('collectGoals reads goals/get per primary session and swallows empty Host', async () => {
  const calls = []
  const aiRuntime = {
    async call(endpoint, args) {
      calls.push({ endpoint, args })
      if (endpoint === 'session/list') {
        return [
          { sessionId: 's1', cwd: '/ws/a' },
          { sessionId: 'child', cwd: '/ws/a', origin: 'subagent' },
          { sessionId: 's2', cwd: '/ws/b' },
        ]
      }
      if (endpoint === 'goals/get' && args.agentId === 's1') {
        return { id: 'g1', objective: '收口', phase: 'active', revision: 1, createdAt: 1, updatedAt: 1 }
      }
      throw new Error('no goal')
    },
  }
  const rows = await collectGoals(aiRuntime, { workspaceId: 'ws-a', cwd: '/ws/a' })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, `${ORIGIN_DSH_GOAL}g1`)
  assert.equal(calls.filter((row) => row.endpoint === 'goals/get').length, 1)
  const empty = await collectGoals(undefined, { workspaceId: 'ws-a' })
  assert.deepEqual(empty, [])
})

test('mutateHostGoal completes through goals/complete with ref', async () => {
  const calls = []
  const aiRuntime = {
    async call(endpoint, args) {
      calls.push({ endpoint, args })
      if (endpoint === 'goals/get') {
        return { id: 'g1', objective: '收口', phase: 'active', revision: 4, createdAt: 1, updatedAt: 1 }
      }
      if (endpoint === 'goals/complete') return {}
      throw new Error(endpoint)
    },
  }
  await mutateHostGoal(aiRuntime, { id: `${ORIGIN_DSH_GOAL}g1`, status: 'done', sessionId: 's1' })
  const complete = calls.find((row) => row.endpoint === 'goals/complete')
  assert.equal(complete.args.agentId, 's1')
  assert.deepEqual(complete.args.ref, { id: 'g1', revision: 4 })
})

test('schedule and job origin prefixes stay distinct from local plan rows', () => {
  assert.equal(isHostScheduleId(`${ORIGIN_DSH_SCHEDULE}sch1`), true)
  assert.equal(isHostJobId(`${ORIGIN_DSH_JOB}j1`), true)
  assert.equal(isHostScheduleId('cevt_1'), false)
  assert.equal(isHostJobId('wf_1'), false)
  const merged = mergeTaskRows(
    [{ id: 'cevt_1', title: '本地' }],
    [{ id: `${ORIGIN_DSH_SCHEDULE}sch1`, title: 'Host' }],
  )
  assert.equal(merged.length, 2)
})
