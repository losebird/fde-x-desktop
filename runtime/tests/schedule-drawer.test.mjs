import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

test('Plan.tsx schedule drawer source locks', async () => {
  const source = await readFile(join(import.meta.dirname, '../../src/pages/Plan.tsx'), 'utf8')
  assert.equal(source.includes('planDayMarkerTop(11, 30)'), false)
  assert.equal(source.includes('planNowMarker('), true)
  assert.equal(source.includes('[0,15,30,45]'), false)
  assert.equal(source.includes('type="date"'), true)
  assert.equal(source.includes('type="time"'), true)
  assert.equal(source.includes('该工作流已暂停，到点不会运行'), true)
  assert.equal(source.includes('绑定并启用'), true)
  assert.equal(source.includes('scheduleTriggerLabel'), true)
})
