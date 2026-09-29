import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

test('hand preview and lan-assist hall do not paint as official pending', async () => {
  const { shouldApplyPendingSheetSource } = await import('../../src/lib/biz-pending-stage.ts')
  assert.equal(shouldApplyPendingSheetSource('ui'), false)
  assert.equal(shouldApplyPendingSheetSource('lan-assist'), false)
  assert.equal(shouldApplyPendingSheetSource('round-end'), true)
  assert.equal(shouldApplyPendingSheetSource('focus-kind'), true)
  assert.equal(shouldApplyPendingSheetSource(''), true)
})

test('write pending headline is 待确认 only with a token', async () => {
  const { writePendingHeadline } = await import('../../src/lib/biz-pending-stage.ts')
  assert.equal(
    writePendingHeadline({ action: '改行', kind: '客户', rows: 1, previewId: 'pv_1' }),
    'AI 拟改 客户 1 行 · 待确认',
  )
  assert.equal(
    writePendingHeadline({ action: '改行', kind: '客户', rows: 2, listed: true, lookupBound: true }),
    'AI 拟改 客户 2 行 · 待点选',
  )
  assert.equal(
    writePendingHeadline({ action: '改行', kind: '客户', rows: 302, listed: true }),
    'AI 拟改 客户 302 行',
  )
  assert.equal(
    writePendingHeadline({ action: '改行', kind: '客户', rows: 0, lookupBound: true }),
    '客户格对不上',
  )
  assert.equal(
    writePendingHeadline({ action: '改行', kind: '客户', rows: 1, blockConfirm: true }),
    '客户格对不上',
  )
  assert.equal(
    writePendingHeadline({ action: '改行', kind: '客户', rows: 2, listed: true, blockConfirm: true }),
    '客户格对不上',
  )
  assert.equal(
    writePendingHeadline({ action: '改行', kind: '客户', rows: 1, hasPicks: true }),
    'AI 拟改 客户 · 待点格',
  )
  const { writePendingViewFromSheet } = await import('../../src/lib/biz-pending-stage.ts')
  const live = writePendingViewFromSheet({
    action: '改行',
    kind: '客户',
    preview_id: 'pv_1',
    rows: [{ no: 'C-1' }],
  })
  assert.equal(writePendingHeadline(live), 'AI 拟改 客户 1 行 · 待确认')
  const closed = writePendingViewFromSheet({
    action: '改行',
    kind: '客户',
    preview_id: 'pv_1',
    writeToken: 'used',
    rows: [{ no: 'C-1' }],
    blockConfirm: true,
  })
  assert.equal(writePendingHeadline(closed), '客户格对不上')
  const indexed = writePendingViewFromSheet({
    action: '改行',
    kind: '客户',
    preview_id: 'pv_1',
    rows: [{ no: 'C-1' }],
  }, { tokenIndex: { pv_1: 'used' } })
  assert.equal(writePendingHeadline(indexed), 'AI 拟改 客户 1 行')
  assert.match(
    writePendingHeadline({ action: '现查', kind: '客户', rows: 8, sessionId: 'session-abcdef12xxxx' }),
    /^AI 刚查了 客户 · 8 行 · 会话 session-/,
  )
})

test('writeTargetNo uses sheet identity then the only row then the selection', async () => {
  const { writeTargetNo } = await import('../../src/lib/biz-sheet-display.ts')
  assert.equal(writeTargetNo({ no: 'CUST-9', rows: [{ no: 'A' }, { no: 'B' }] }), 'CUST-9')
  assert.equal(writeTargetNo({ rows: [{ no: 'ONLY' }] }), 'ONLY')
  assert.equal(writeTargetNo({ rows: [{ no: 'A' }, { no: 'B' }] }), '')
  assert.equal(writeTargetNo({ rows: [{ no: 'A' }, { no: 'B' }] }, { no: 'B' }), 'B')
  assert.equal(writeTargetNo({
    listed: true,
    no: 'LEAD',
    rows: [{ no: 'A' }, { no: 'B' }],
  }, { no: 'B' }), 'B')
  assert.equal(writeTargetNo({
    listed: true,
    no: 'LEAD',
    rows: [{ no: 'A' }, { no: 'B' }],
  }), '')
  const { writeTargetRow } = await import('../../src/lib/biz-sheet-display.ts')
  assert.equal(writeTargetRow({
    listed: true,
    rows: [{ no: 'A' }, { no: 'B' }],
  }, { no: 'B' })?.no, 'B')
})

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
