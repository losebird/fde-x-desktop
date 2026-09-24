import test from 'node:test'
import assert from 'node:assert/strict'

test('shouldCancelDshAfterHitSetPick only after waitingPick write preview', async () => {
  const {
    shouldAbortLeftoverAskForWritePreview,
    shouldCancelDshAfterHitSetPick,
    shouldCancelDshAfterWritePreview,
    resolveHitSetPickCancelSessionId,
  } = await import('../../src/lib/biz-hit-set-pick-cancel.ts')

  assert.equal(shouldCancelDshAfterWritePreview('改行', 'pv1'), true)
  assert.equal(shouldCancelDshAfterWritePreview('过审', 'pv1'), true)
  assert.equal(shouldCancelDshAfterWritePreview('现查', 'pv1'), false)
  assert.equal(shouldCancelDshAfterWritePreview('改行', ''), false)

  assert.equal(shouldCancelDshAfterHitSetPick(true, '改行', 'pv1'), true)
  assert.equal(shouldCancelDshAfterHitSetPick(false, '改行', 'pv1'), false)
  assert.equal(shouldCancelDshAfterHitSetPick(true, '改行', ''), false)
  assert.equal(shouldCancelDshAfterHitSetPick(true, '现查', 'pv1'), false)

  assert.equal(shouldAbortLeftoverAskForWritePreview({ action: '改行', preview_id: 'pv1', picked: true }), true)
  assert.equal(shouldAbortLeftoverAskForWritePreview({ action: '新建', preview_id: 'pv1', changes: [{ field: 'x' }] }), true)
  assert.equal(shouldAbortLeftoverAskForWritePreview({ action: '新建', preview_id: 'pv1', changes: [] }), false)

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
