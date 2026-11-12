import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { civilClock, cronFieldMatches, cronMatches, cronOccurrences, parseCronExpr } from '../plan/cron-match.mjs'

test('cron 字段支持星号、列表、范围和步长', () => {
  assert.equal(cronFieldMatches('*', 7, 0, 59), true)
  assert.equal(cronFieldMatches('16', 16, 0, 59), true)
  assert.equal(cronFieldMatches('16', 15, 0, 59), false)
  assert.equal(cronFieldMatches('1,15,30', 15, 0, 59), true)
  assert.equal(cronFieldMatches('9-11', 10, 0, 23), true)
  assert.equal(cronFieldMatches('*/15', 0, 0, 59), true)
  assert.equal(cronFieldMatches('*/15', 15, 0, 59), true)
  assert.equal(cronFieldMatches('*/15', 16, 0, 59), false)
  assert.equal(parseCronExpr('16 18 * * *').hour, '18')
  assert.equal(parseCronExpr('a b'), null)
})

test('5 段 cron 对齐上海时间的分钟', () => {
  const at = Date.parse('2026-11-11T10:16:00.000Z')
  const clock = civilClock(at, 'Asia/Shanghai')
  assert.equal(clock.hour, 18)
  assert.equal(clock.minute, 16)
  assert.equal(cronMatches('16 18 * * *', clock), true)
  assert.equal(cronMatches('0 18 * * *', clock), false)
  const hits = cronOccurrences('16 18 * * *', 'Asia/Shanghai', at - 60_000, at + 60_000)
  assert.equal(hits.includes('2026-11-11T10:16:00.000Z'), true)
})
