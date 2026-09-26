import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

test('failed TOO_MANY / ok:false sheets must not stage', async () => {
  const { isFailedRoundEndSheet, shouldStageRoundEndPending } = await import('../../src/lib/biz-pending-stage.ts')
  const dirty = {
    ok: false,
    error: 'TOO_MANY',
    action: '过审',
    kind: 'KindBill',
    rows: Array.from({ length: 100 }, (_, i) => ({ no: `R-${i}` })),
  }
  assert.equal(isFailedRoundEndSheet(dirty), true)
  assert.equal(shouldStageRoundEndPending(dirty), false)

  const okList = {
    ok: true,
    action: '现查',
    kind: 'KindBill',
    speech: '待审的费用报销',
    rows: [{ no: 'B-1' }],
    hitTotal: 96,
    querySettled: true,
  }
  assert.equal(shouldStageRoundEndPending(okList), true)
})

test('successful 现查 round-end focuses even on operations subview', () => {
  const repoRoot = join(import.meta.dirname, '..', '..')
  const auto = readFileSync(join(repoRoot, 'src/lib/biz-records-auto-open.ts'), 'utf8')
  const panel = readFileSync(join(repoRoot, 'src/components/biz/RecordsPanel.tsx'), 'utf8')
  assert.match(auto, /shouldFocusBizRecordsForPending/)
  assert.match(auto, /action === '现查'/)
  assert.match(panel, /shouldFocusBizRecordsForPending/)
})

test('new utterance replaces populated pending in skip logic', async () => {
  const { isNewSpokenUtterance, shouldSkipCoveringPending } = await import('../../src/lib/connected-kind.ts')
  const ticket = {
    kind: 'KindTicket',
    action: '现查',
    speech: '停用客户还有哪些没关的工单？',
    rows: [{ no: 'T-1' }],
  }
  const expense = {
    kind: 'KindBill',
    action: '现查',
    speech: '待审的费用报销',
    rows: [{ no: 'B-1' }],
  }
  assert.equal(isNewSpokenUtterance(ticket, expense), true)
  assert.equal(shouldSkipCoveringPending(ticket, expense), false)
})
