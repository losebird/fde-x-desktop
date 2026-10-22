import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BATCH_LIMIT, bindPatchEnums, cluesFromWhere, normalizePlan, PAGE_SIZE } from '../plan.js'

test('normalizePlan copies slots and never invents where from speech', () => {
  const plan = normalizePlan({
    kind: '客户',
    action: '改行',
    speech: '把停用客户恒通改成成交',
    where: [{ keys: ['status'], values: ['停用'] }, { keys: ['name'], values: ['恒通'] }],
    patch: { status: '成交' },
  })
  assert.equal(plan.structured, true)
  assert.equal(plan.steps[0].kind, '客户')
  assert.equal(plan.steps[0].where.length, 2)
  assert.equal(plan.patch.status, '成交')
  assert.equal(plan.speech, '把停用客户恒通改成成交')
})

test('speech-only spec is not a structured plan', () => {
  const plan = normalizePlan({
    kind: '合同',
    action: '现查',
    speech: '待审回款挂在哪些合同上？把已到期的那些摊出来。',
  })
  assert.equal(plan.structured, false)
  assert.equal(plan.steps[0].where.length, 0)
})

test('from becomes a parent step then the target kind', () => {
  const plan = normalizePlan({
    kind: '工单',
    action: '改行',
    from: { kind: '客户', where: [{ keys: ['name'], values: ['武汉云启电子'] }] },
    where: [{ keys: ['priority'], values: ['紧急'] }],
    patch: { status: '已解决' },
  })
  assert.equal(plan.steps[0].kind, '客户')
  assert.equal(plan.steps[1].kind, '工单')
  assert.equal(plan.steps[1].from, '客户')
})

test('from.join is copied onto the parent step', () => {
  const plan = normalizePlan({
    kind: '订单',
    from: { kind: '合同', join: 'or', where: [{ keys: ['status'], values: ['expired'] }] },
  })
  assert.equal(plan.steps[0].join, 'or')
  assert.equal(plan.steps[1].kind, '订单')
})

test('cluesFromWhere does not keep leftover speech as rest', () => {
  const clues = cluesFromWhere([{ keys: ['status'], values: ['待审'] }])
  assert.equal(clues.rest, '')
  assert.equal(clues.terms[0].values[0], '待审')
})

test('bindPatchEnums maps labels to codes', () => {
  const patch = bindPatchEnums({ status: '成交' }, [
    { name: 'status', enums: { inactive: '停用', active: '成交' } },
  ])
  assert.equal(patch.status, 'active')
})

test('page size is 20', () => {
  assert.equal(PAGE_SIZE, 20)
})

test('batch writes freeze at most 100 rows', () => {
  assert.equal(BATCH_LIMIT, 100)
})
