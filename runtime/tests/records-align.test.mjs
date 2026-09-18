import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')

function sheetRowIdentity(row, index = 0) {
  const id = String(row.orderId ?? row.no ?? row.id ?? '').trim()
  return id ? `${id}#${index}` : `#${index}`
}

function sheetRowRenderKey(row, index = 0, sheetIdentity = '') {
  const identity = sheetRowIdentity(row, index)
  return sheetIdentity ? `${sheetIdentity}::${identity}` : identity
}

test('history options list this session only and never dump the workspace', async () => {
  const { selectSessionHistorySurfaces } = await import('../../src/lib/biz-records-history.ts')
  const surfaces = [
    { id: 'a', sessionId: 's1', createdAt: 2 },
    { id: 'b', sessionId: 's1', createdAt: 1 },
    { id: 'c', sessionId: 's2', createdAt: 3 },
    { id: 'd', sessionId: null, createdAt: 9 },
  ]
  const none = selectSessionHistorySurfaces(surfaces, { cachedIds: new Set() })
  assert.equal(none.length, 0)
  const missingSession = selectSessionHistorySurfaces(surfaces, {
    cachedIds: new Set(['a', 'c', 'd']),
  })
  assert.equal(missingSession.length, 0)
  const scoped = selectSessionHistorySurfaces(surfaces, {
    sessionId: 's1',
    cachedIds: new Set(['a', 'c', 'd']),
  })
  assert.deepEqual(scoped.map((row) => row.id), ['a'])
})

test('pinned history blocks a different or unknown incoming surface', async () => {
  const { shouldBlockIncomingSheetForHistoryPin } = await import('../../src/lib/biz-records-history.ts')
  assert.equal(shouldBlockIncomingSheetForHistoryPin('', 'x'), false)
  assert.equal(shouldBlockIncomingSheetForHistoryPin('pin', 'pin'), false)
  assert.equal(shouldBlockIncomingSheetForHistoryPin('pin', 'other'), true)
  assert.equal(shouldBlockIncomingSheetForHistoryPin('pin', undefined), true)
})

test('row render keys include sheet identity so the same 单号 remounts', () => {
  const row = { no: 'PAY-1', orderId: 'PAY-1' }
  const a = sheetRowRenderKey(row, 0, 'fp-a')
  const b = sheetRowRenderKey(row, 0, 'fp-b')
  assert.notEqual(a, b)
  assert.equal(sheetRowIdentity(row, 0), sheetRowIdentity({ no: 'PAY-1' }, 0))
  assert.notEqual(sheetRowIdentity(row, 0), sheetRowIdentity(row, 1))
})

test('RecordsPanel keeps history pin, closes write preview, and skips empty drawers', () => {
  const src = readFileSync(join(repoRoot, 'src/components/biz/RecordsPanel.tsx'), 'utf8')
  assert.doesNotMatch(src, /useEvents\(\['biz\.sheet\.pending'\][\s\S]{0,400}historyPinnedSurfaceIdRef\.current = ''/)
  assert.doesNotMatch(src, /useEvents\(\['ai\.tool\.finished'\][\s\S]{0,400}historyPinnedSurfaceIdRef\.current = ''/)
  assert.match(src, /const normalizedRows = cloneSheetRows\(sheet\.rows\)/)
  assert.match(src, /const appliedSheet = \{ \.\.\.sheet, rows: normalizedRows/)
  assert.match(src, /sheetRowRenderKey\(row, absoluteIndex, sheetIdentity\)/)
  assert.match(src, /<tbody key=\{sheetIdentity/)
  assert.match(src, /selectSessionHistorySurfaces/)
  assert.match(src, /setDrawer\(null\)/)
  assert.match(src, /shouldOpenWritePreviewDrawer/)
  assert.match(src, /sheetHasConfirmablePreviewChanges/)
  assert.match(src, /historyOptionLabel/)
  assert.doesNotMatch(src, /scope \|\| time/)
  assert.doesNotMatch(src, /return scoped\.length \? scoped : sorted/)
})

test('query-fingerprint history ids are stable without sqlite surface id', async () => {
  const { historyIdForSheet, mergeHistorySurfaces, selectSessionHistorySurfaces: select } = await import('../../src/lib/biz-records-history.ts')
  const id = historyIdForSheet({ kind: 'T' }, '', '{"kind":"T"}')
  assert.equal(id, 'q:{"kind":"T"}')
  const merged = mergeHistorySurfaces(
    [{ id: 'bsurf_1', createdAt: 1, sessionId: 's1' }],
    [{ id, createdAt: 2, sessionId: 's1' }],
  )
  assert.equal(merged.length, 2)
  const picked = select(merged, { sessionId: 's1', cachedIds: new Set([id]) })
  assert.deepEqual(picked.map((row) => row.id), [id])
  const kept = mergeHistorySurfaces(
    [{ id: 'surf', createdAt: 1, sessionId: null }],
    [{ id: 'surf', createdAt: 2, sessionId: 's1' }],
  )
  assert.equal(kept[0]?.sessionId, 's1')
})

test('history option labels use speech or where/hop identity, never a clock', async () => {
  const { historyOptionLabel, historyConditionLabel } = await import('../../src/lib/biz-list-query.ts')
  const clockFree = historyOptionLabel({ kind: 'KindA', action: 'ActX' }, { kind: 'KindA', action: 'ActX' })
  assert.equal(clockFree, 'KindA · ActX')
  assert.doesNotMatch(clockFree, /\d{2}\/\d{2}/)
  assert.doesNotMatch(clockFree, /刚刚|分钟前|小时前/)

  const spoken = historyOptionLabel(
    { kind: 'KindA', action: 'ActX' },
    { speech: '待审且已到期的那次' },
  )
  assert.equal(spoken, 'KindA · ActX · 待审且已到期的那次')

  const hopped = historyConditionLabel({
    from: { kind: 'KindB' },
    hopWhere: [{ values: ['到期'] }],
    steps: [{ kind: 'KindB' }, { kind: 'KindA' }],
  })
  assert.match(hopped, /KindB/)
  assert.match(hopped, /到期|KindA/)
  assert.doesNotMatch(hopped, /\d{2}\/\d{2}/)
})

test('empty write previews are not confirmable; payload diffs are', async () => {
  const { sheetHasConfirmablePreviewChanges } = await import('../../src/lib/biz-sheet-display.ts')
  assert.equal(sheetHasConfirmablePreviewChanges({
    action: 'ActX',
    preview_id: 'pv_empty',
    rows: [{ no: '1', fields: { title: 'same' } }],
    columns: [{ key: 'title', label: '标题' }],
  }), false)
  assert.equal(sheetHasConfirmablePreviewChanges({
    action: 'ActX',
    preview_id: 'pv_diff',
    rows: [{ no: '1' }],
    columns: [{ key: 'title', label: '标题' }],
    changes: [{ field: 'title', label: '标题', from: '旧', to: '新' }],
  }), true)
})

test('matchSurfaceIdForSheet no longer impersonates kind+action[0]', () => {
  const src = readFileSync(join(repoRoot, 'src/lib/biz-surface-cache.ts'), 'utf8')
  assert.doesNotMatch(src, /return candidates\[0\]\?\.id/)
  assert.match(src, /row\.previewId === pid/)
})
