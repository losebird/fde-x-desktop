import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { planDayMarkerTop, planNowMarker, scheduleInstants } from '../plan/plan-day-hours.mjs'
import { scheduleTriggerLabel } from '../plan/schedule-outcome.mjs'

test('planNowMarker follows the live clock within the day grid', () => {
  assert.equal(planNowMarker(new Date(2026, 9, 19, 14, 7, 30)), planDayMarkerTop(14, 7))
  assert.equal(planNowMarker(new Date(2026, 9, 19, 11, 30)), planDayMarkerTop(11, 30))
  assert.equal(planNowMarker(new Date(2026, 9, 19, 2, 15)), null)
  assert.equal(planNowMarker(new Date(2026, 9, 19, 22, 0)), null)
  assert.equal(planNowMarker(new Date(2026, 9, 19, 6, 0)), planDayMarkerTop(6, 0))
  assert.equal(planNowMarker(new Date(2026, 9, 19, 21, 59)), planDayMarkerTop(21, 59))
})

test('scheduleInstants builds local wall-clock ISO strings', () => {
  const { start, end } = scheduleInstants('2026-10-21', '14:07', '15:08')
  const startDate = new Date(start)
  assert.equal(startDate.getFullYear(), 2026)
  assert.equal(startDate.getMonth(), 9)
  assert.equal(startDate.getDate(), 21)
  assert.equal(startDate.getHours(), 14)
  assert.equal(startDate.getMinutes(), 7)
  const endDate = new Date(end)
  assert.equal(endDate.getMinutes(), 8)
})

test('scheduleTriggerLabel maps run outcomes for the UI', () => {
  assert.equal(scheduleTriggerLabel({ state: 'succeeded', message: '' }), '已运行')
  assert.equal(scheduleTriggerLabel({ state: 'running', message: '' }), '运行中')
  assert.equal(scheduleTriggerLabel({ state: 'queued', message: '' }), '运行中')
  assert.equal(scheduleTriggerLabel({ state: 'cancelled', message: '错过' }), '错过')
  assert.equal(scheduleTriggerLabel({ state: 'cancelled', message: '工作流已暂停，未运行' }), '跳过：工作流已暂停')
  assert.equal(scheduleTriggerLabel({ state: 'cancelled', message: '上一次运行还没结束，未运行' }), '跳过：上一次运行还没结束')
  assert.equal(scheduleTriggerLabel({ state: 'failed', message: 'AI 步骤的提示不能为空' }), '失败：AI 步骤的提示不能为空')
  assert.equal(scheduleTriggerLabel(null), '')
})
