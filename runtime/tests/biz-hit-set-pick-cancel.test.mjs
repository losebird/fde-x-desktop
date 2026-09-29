import test from 'node:test'
import assert from 'node:assert/strict'

test('leftover Ask aborts when the workstation holds a write or pick', async () => {
  const {
    shouldAbortLeftoverAskForWritePreview,
    shouldCancelDshAfterWritePreview,
    isWorkstationHeldWrite,
    resolveHitSetPickCancelSessionId,
  } = await import('../../src/lib/biz-hit-set-pick-cancel.ts')

  assert.equal(shouldCancelDshAfterWritePreview('改行', 'pv1'), true)
  assert.equal(shouldCancelDshAfterWritePreview('过审', 'pv1'), true)
  assert.equal(shouldCancelDshAfterWritePreview('现查', 'pv1'), false)
  assert.equal(shouldCancelDshAfterWritePreview('改行', ''), false)

  assert.equal(isWorkstationHeldWrite({ action: '改行', preview_id: 'pv1', picked: true }), true)
  assert.equal(isWorkstationHeldWrite({
    action: '改行',
    listed: true,
    ambiguous: true,
    rows: [{ no: 'HIT-1' }, { no: 'HIT-2' }],
  }), true)
  assert.equal(isWorkstationHeldWrite({ action: '现查', listed: true, rows: [{ no: 'HIT-1' }] }), false)

  assert.equal(shouldAbortLeftoverAskForWritePreview({ action: '改行', preview_id: 'pv1', picked: true }), true)
  assert.equal(shouldAbortLeftoverAskForWritePreview({
    action: '改行',
    listed: true,
    ambiguous: true,
    rows: [{ no: 'HIT-1' }, { no: 'HIT-2' }],
  }), true)
  assert.equal(shouldAbortLeftoverAskForWritePreview({
    action: '过审',
    preview_id: 'pv1',
    changes: [{ field: 'status' }],
  }), true)
  assert.equal(shouldAbortLeftoverAskForWritePreview({ action: '新建', preview_id: 'pv1', canWrite: true }), true)
  assert.equal(shouldAbortLeftoverAskForWritePreview({ action: '新建', preview_id: 'pv1', changes: [] }), true)
  assert.equal(shouldAbortLeftoverAskForWritePreview({ action: '现查', preview_id: 'pv1' }), false)
  assert.equal(shouldAbortLeftoverAskForWritePreview({ action: '改行', preview_id: '' }), false)

  assert.equal(
    resolveHitSetPickCancelSessionId({
      bindSheet: { sessionId: 'bind' },
      pendingSheet: { sessionId: 'pending' },
      activeAiSessionId: 'active',
      historySessionId: 'hist',
    }),
    'bind',
  )
  assert.equal(
    resolveHitSetPickCancelSessionId({
      bindSheet: null,
      pendingSheet: { sessionId: 'pending' },
      activeAiSessionId: 'active',
    }),
    'pending',
  )
})
