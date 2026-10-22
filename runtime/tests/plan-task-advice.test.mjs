import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderContextForPrompt } from '../context-pack.mjs'

const quote = {
  id: 'task_quote',
  title: '回复供应商报价',
  status: 'todo',
  priority: 'med',
  dueAt: '2026-10-20',
}

const pack = {
  tasks: {
    today: [quote],
    overdue: 2,
  },
}

test('default task lines stay byte-identical when task ids are off', () => {
  const expected = '【今日待办】\n- 回复供应商报价（todo）\n逾期 2 条'
  assert.equal(renderContextForPrompt(pack), expected)
  assert.equal(renderContextForPrompt(pack, new Set()), expected)
  assert.equal(renderContextForPrompt(pack, new Set(), { taskIds: false }), expected)
  assert.equal(renderContextForPrompt(pack, new Set(), {}).includes('[task_'), false)
})

test('taskIds render option prints id, priority, and due', () => {
  const text = renderContextForPrompt(pack, new Set(), { taskIds: true })
  assert.equal(
    text,
    '【今日待办】\n- [task_quote] 回复供应商报价（todo · 中 · 10/20）\n逾期 2 条',
  )
})

test('parseTaskAdvice accepts update, archive, and merge and rejects the mismatch shapes', async () => {
  const { parseTaskAdvice, taskAdviceSchema } = await import('../plan/task-advice.mjs')
  const tasks = [
    quote,
    { id: 'task_sample', title: '跟进样品', status: 'doing', priority: 'low' },
    { id: 'dsh-goal:goal_1', title: 'Host 目标', status: 'todo', priority: 'med' },
  ]
  const itemSchema = taskAdviceSchema.properties.suggestions.items
  assert.deepEqual(itemSchema.properties.op.enum, ['update', 'archive', 'merge'])
  assert.equal(itemSchema.properties.patch.properties.dueAt.type, 'string')
  assert.equal(itemSchema.properties.patch.properties.due, undefined)

  const merged = parseTaskAdvice({
    suggestions: [{ taskIds: ['task_quote', 'task_sample'], reason: '重复' }],
  }, tasks)
  assert.equal(merged.accepted.length, 0)
  assert.equal(merged.rejected.length, 1)
  assert.equal(merged.rejected[0].index, 0)
  assert.match(merged.rejected[0].reason, /taskId/)

  const medium = parseTaskAdvice({
    suggestions: [{
      op: 'update',
      taskId: 'task_quote',
      reason: '升高',
      patch: { priority: 'medium' },
    }],
  }, tasks)
  assert.equal(medium.accepted.length, 0)
  assert.match(medium.rejected[0].reason, /priority/)

  const titled = parseTaskAdvice({
    suggestions: [{
      op: 'update',
      taskId: '回复供应商报价',
      reason: '改标题',
      patch: { title: '新标题' },
    }],
  }, tasks)
  assert.equal(titled.accepted.length, 0)
  assert.match(titled.rejected[0].reason, /对不上/)

  const textSuggestions = parseTaskAdvice({ suggestions: '合并这两条' }, tasks)
  assert.equal(textSuggestions.accepted.length, 0)
  assert.match(textSuggestions.rejected[0].reason, /不是数组/)

  const mixed = parseTaskAdvice({
    summary: '两件可做',
    suggestions: [
      { op: 'update', taskId: 'task_quote', reason: '提高优先级', patch: { priority: 'high', dueAt: '2026-10-21' } },
      { op: 'archive', taskId: 'task_sample', reason: '做完了' },
      { op: 'merge', taskId: 'task_sample', mergeInto: 'task_quote', reason: '重复' },
      { op: 'update', taskId: 'task_quote', reason: '旧字段', patch: { due: '2026-10-22' } },
      { op: 'merge', taskId: 'task_quote', mergeInto: 'task_quote', reason: '自己' },
      { op: 'update', taskId: 'dsh-goal:goal_1', reason: '改标题', patch: { title: '不行' } },
      { op: 'update', taskId: 'dsh-goal:goal_1', reason: '完成', patch: { status: 'done' } },
    ],
  }, tasks)
  assert.equal(mixed.summary, '两件可做')
  assert.equal(mixed.accepted.length, 4)
  assert.equal(mixed.accepted[0].op, 'update')
  assert.equal(mixed.accepted[0].patch.priority, 'high')
  assert.equal(mixed.accepted[0].patch.dueAt, '2026-10-21')
  assert.equal(mixed.accepted[1].op, 'archive')
  assert.equal(mixed.accepted[2].op, 'merge')
  assert.equal(mixed.accepted[2].mergeInto, 'task_quote')
  assert.equal(mixed.accepted[3].op, 'update')
  assert.equal(mixed.accepted[3].patch.status, 'done')
  assert.equal(mixed.rejected.length, 3)
  assert.match(mixed.rejected[0].reason, /dueAt/)
  assert.match(mixed.rejected[1].reason, /自己/)
  assert.match(mixed.rejected[2].reason, /Host goal/)

  assert.doesNotThrow(() => parseTaskAdvice(null, tasks))
  assert.doesNotThrow(() => parseTaskAdvice('nope', tasks))
  const empty = parseTaskAdvice(null, tasks)
  assert.equal(empty.accepted.length, 0)
  assert.ok(empty.rejected.length >= 1)
})

test('a later organize generation is discarded and abort settles as cancelled', async () => {
  const { createAskFlight, settleAskWait } = await import('../plan/ask-flight.mjs')
  const flight = createAskFlight()
  const first = flight.begin()
  const second = flight.begin()
  assert.equal(first.signal.aborted, true)
  assert.equal(second.signal.aborted, false)
  const late = flight.accept(first.generation, { ok: true, data: { kept: false } })
  assert.equal(late.ok, false)
  assert.equal(late.error, 'stale')
  assert.equal(late.discarded, true)
  const current = flight.accept(second.generation, { ok: true, data: { kept: true } })
  assert.equal(current.ok, true)
  assert.equal(current.data.kept, true)
  flight.cancelActive()
  assert.equal(second.signal.aborted, true)

  const pendingController = new AbortController()
  const pending = settleAskWait(pendingController.signal, () => new Promise(() => {}))
  pendingController.abort()
  assert.deepEqual(await pending, { ok: false, error: 'cancelled' })

  const already = new AbortController()
  already.abort()
  let ran = false
  const skipped = await settleAskWait(already.signal, async () => {
    ran = true
    return true
  })
  assert.equal(ran, false)
  assert.deepEqual(skipped, { ok: false, error: 'cancelled' })
})

test('organize session reuse keeps the newest standard session and skips other presets', async () => {
  const { pickOrganizeSession, organizeSessionTitle } = await import('../plan/organize-session.mjs')
  assert.equal(organizeSessionTitle(new Date(2026, 9, 19, 14, 5)), '整理待办 · 10/19 14:05')
  const picked = pickOrganizeSession([
    { sessionId: 'old', title: '整理待办 · 1/1 00:00', agentPreset: 'standard', updatedAt: 1, cwd: '/w' },
    { sessionId: 'wf', title: '整理待办 · 2/2 00:00', agentPreset: 'fde-workflow', updatedAt: 9, cwd: '/w' },
    { sessionId: 'near', title: '整理待办事项', agentPreset: 'standard', updatedAt: 8, cwd: '/w' },
    { sessionId: 'new', title: '整理待办 · 3/3 00:00', agentPreset: 'standard', updatedAt: 5, cwd: '/w/' },
    { sessionId: 'other', title: '待办 · x', agentPreset: 'standard', updatedAt: 9, cwd: '/w' },
    { sessionId: 'gone', title: '整理待办 · 归档', agentPreset: 'standard', updatedAt: 7, cwd: '/w', archived: true },
  ], '/w')
  assert.equal(picked.sessionId, 'new')
  assert.equal(pickOrganizeSession([
    { sessionId: 'blank', title: '整理待办 · 1/1', agentPreset: 'standard', updatedAt: 3 },
  ], '/w'), null)
})
