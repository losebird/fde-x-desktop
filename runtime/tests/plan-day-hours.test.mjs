import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { PLAN_DAY_HOURS, PLAN_DAY_ORIGIN_HOUR, planDayMarkerTop, planDayOffsetMinutes } from '../plan/plan-day-hours.mjs'

test('计划日视图覆盖 6:00 到 21:00', () => {
  assert.deepEqual(PLAN_DAY_HOURS, Array.from({ length: 16 }, (_, index) => 6 + index))
  assert.equal(PLAN_DAY_ORIGIN_HOUR, 6)
  const morning = new Date(2026, 9, 19, 6, 0, 0, 0)
  const evening = new Date(2026, 9, 19, 21, 0, 0, 0)
  assert.equal(planDayOffsetMinutes(morning.toISOString()), 0)
  assert.equal(planDayOffsetMinutes(evening.toISOString()), 15 * 60)
  assert.equal(planDayMarkerTop(11, 30), 5.5 * 56 + 14)
  const source = readFileSync(new URL('../../src/pages/Plan.tsx', import.meta.url), 'utf8')
  assert.equal(source.includes('PLAN_DAY_HOURS'), true)
  assert.equal(source.includes('planDayOffsetMinutes'), true)
  assert.equal(source.includes('- 7 * 60'), false)
})
