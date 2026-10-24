import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { taskHandoffPrompt } from '../plan/task-handoff.mjs'
import { planTaskMenu } from '../plan/task-menu.mjs'

const other = '另一条不该出现的待办'

test('handoff prompt names one task and a standard session', () => {
  const built = taskHandoffPrompt({
    id: 'task_one',
    title: '回复供应商报价',
    sourceRef: 'biz:采购单:PO-2026-001',
    notes: '只要这一条',
  }, '先看交期')
  assert.equal(built.preset, 'standard')
  assert.equal(built.sessionTitle, '待办 · 回复供应商报价')
  assert.match(built.prompt, /task_one/)
  assert.match(built.prompt, /回复供应商报价/)
  assert.match(built.prompt, /biz:采购单:PO-2026-001/)
  assert.match(built.prompt, /biz_preview/)
  assert.match(built.prompt, /请到计划页确认并过账/)
  assert.equal(built.prompt.includes('fde_app_records_query'), false)
  assert.equal(built.prompt.includes('fde_app_records_propose'), false)
  assert.equal(built.prompt.includes('请在右侧确认'), false)
  assert.match(built.prompt, /fde_plan_task_propose/)
  assert.match(built.prompt, /fde_submit_result/)
  assert.match(built.prompt, /先看交期/)
  assert.equal(built.prompt.includes(other), false)
  assert.equal(built.prompt.includes('整理待办'), false)
})

function assertPlanToolsOnly(prompt, sourceRef) {
  assert.match(prompt, /fde_plan_task_propose/)
  assert.match(prompt, /fde_submit_result/)
  assert.equal(prompt.includes('fde_app_records_query'), false, sourceRef)
  assert.equal(prompt.includes('fde_app_records_propose'), false, sourceRef)
}

test('handoff prompt for a hand-built task omits app record tools', () => {
  const built = taskHandoffPrompt({
    id: 'task_two',
    title: '手建',
    sourceRef: 'fde-task:task_two',
  })
  assert.match(built.prompt, /来源：fde-task:task_two/)
  assertPlanToolsOnly(built.prompt, 'fde-task:task_two')
})

test('handoff prompt for an empty source omits app record tools', () => {
  const built = taskHandoffPrompt({
    id: 'task_empty',
    title: '空来源',
    sourceRef: '',
  })
  assert.match(built.prompt, /这条待办没有来源引用/)
  assertPlanToolsOnly(built.prompt, '')
})

test('handoff prompt omits app record tools for im and other closed sources', () => {
  const cases = [
    ['im:req_1', /来源：im:req_1/],
    ['dsh-goal:g1', /来源：dsh-goal:g1/],
    ['nope:x', /来源：nope:x/],
  ]
  for (const [sourceRef, sourceLine] of cases) {
    const built = taskHandoffPrompt({
      id: 'task_closed',
      title: '无应用来源',
      sourceRef,
    })
    assert.match(built.prompt, sourceLine)
    assertPlanToolsOnly(built.prompt, sourceRef)
  }
})

test('row menu opens a sourced task and refuses a host goal', () => {
  const sourced = planTaskMenu({
    id: 'task_one',
    title: '回复供应商报价',
    sourceRef: 'biz:采购单:PO-2026-001',
  })
  assert.equal(sourced.handoff.enabled, true)
  assert.equal(sourced.openSource.enabled, true)
  assert.equal(sourced.openSource.href.rowId, 'PO-2026-001')

  const plain = planTaskMenu({
    id: 'task_two',
    title: '手建',
    sourceRef: 'fde-task:task_two',
  })
  assert.equal(plain.handoff.enabled, true)
  assert.equal(plain.openSource.enabled, false)
  assert.match(plain.openSource.reason, /手建待办无来源/)

  const host = planTaskMenu({
    id: 'dsh-goal:g1',
    title: 'Host',
    sourceRef: 'dsh-goal:g1',
  })
  assert.equal(host.handoff.enabled, false)
  assert.equal(host.openSource.enabled, false)
})
