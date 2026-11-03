import assert from 'node:assert/strict'
import test from 'node:test'
import {
  entryKindBadge,
  formatPlanSourceRef,
  formatPlanStamp,
  formatPlanValue,
  isNoiseChange,
  runOutcomeLabel,
  visiblePlanChanges,
} from './plan-history-view.ts'

test('stamps on the same day say 今天', () => {
  const now = new Date('2026-11-03T16:00:00+08:00')
  assert.equal(formatPlanStamp('2026-11-03T15:43:00+08:00', now), '今天 15:43')
})

test('due ISO is a clock time, not the raw string', () => {
  const shown = formatPlanValue('2026-11-03T18:00:00+08:00')
  assert.equal(shown.includes('T18:00'), false)
  assert.equal(shown.includes('18:00'), true)
})

test('task source refs do not dump the id', () => {
  assert.equal(formatPlanSourceRef('fde-task:task_f0e0d7c90cc44f09902884f91cb84755'), '本条待办')
})

test('create noise is dropped', () => {
  assert.equal(isNoiseChange({ field: 'notes', before: '', after: '' }), true)
  assert.equal(isNoiseChange({ field: 'tags', before: [], after: [] }), true)
  assert.equal(isNoiseChange({
    field: 'sourceRef',
    before: null,
    after: 'fde-task:task_abc',
  }), true)
  assert.equal(isNoiseChange({ field: 'priority', before: 'med', after: 'high' }), false)
})

test('create entries only keep the after value', () => {
  const rows = visiblePlanChanges({
    at: '2026-11-03T15:41:00+08:00',
    kind: 'change',
    action: 'create',
    actor: 'you',
    legacy: false,
    label: '新建',
    changes: [
      { field: 'title', before: '', after: '核对费用单' },
      { field: 'notes', before: '', after: '' },
      { field: 'status', before: '', after: 'todo' },
      { field: 'sourceRef', before: '', after: 'fde-task:task_abc' },
    ],
  })
  assert.deepEqual(rows.map((row) => row.label), ['标题', '状态'])
  assert.equal(rows[0].created, true)
  assert.equal(rows[0].after, '核对费用单')
  assert.equal(rows[1].after, '待办')
})

test('default timezone and all-day no on create stay hidden', () => {
  assert.equal(isNoiseChange({ field: 'timezone', before: '', after: 'Asia/Shanghai' }), true)
  assert.equal(isNoiseChange({ field: 'allDay', before: null, after: false }), true)
})

test('run failed is 失败', () => {
  assert.equal(runOutcomeLabel({
    at: '',
    kind: 'run',
    action: 'workflow.run',
    actor: 'system',
    legacy: false,
    changes: null,
    label: 'failed',
    run: { id: 'r1', state: 'failed', message: '', trigger: 'manual' },
  }), '失败')
})

test('organize badge stays 整理', () => {
  assert.equal(entryKindBadge({
    at: '',
    kind: 'change',
    action: 'update',
    actor: 'you',
    legacy: false,
    label: '编辑',
    via: 'organize',
    changes: [],
  }), '整理')
})
