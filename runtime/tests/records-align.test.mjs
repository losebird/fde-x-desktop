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
  assert.match(src, /source === 'lan-assist'/)
  assert.match(src, /setDrawer\(null\)/)
  assert.match(src, /shouldOpenWritePreviewDrawer/)
  assert.match(src, /sheetHasConfirmablePreviewChanges/)
  assert.match(src, /historyOptionLabel/)
  assert.match(src, /listRestoreBelongsToIncoming/)
  assert.doesNotMatch(src, /setDrawer\(\(prev\) => prev \?\?/)
  assert.doesNotMatch(src, /scope \|\| time/)
  assert.doesNotMatch(src, /return scoped\.length \? scoped : sorted/)
})

test('RecordsPanel separates connector picker from operation kind chips and cancel keeps the floated sheet', () => {
  const src = readFileSync(join(repoRoot, 'src/components/biz/RecordsPanel.tsx'), 'utf8')
  assert.match(src, />连接器</)
  assert.match(src, /connectorOptions\.map\(\(opt\) => \(\s*<option/)
  assert.doesNotMatch(src, /connectorOptions\.length > 1 && connectorOptions\.map/)
  assert.match(src, /displayBeforeWriteRef/)
  assert.match(src, /surfacedKindChips/)
  assert.doesNotMatch(src, /现查\$\{incomingKind\}/)
  assert.doesNotMatch(src, /const dismissPreviewDrawer = useCallback\(\(\) => \{[\s\S]*?restoreRecordsList\(\)/)
  assert.doesNotMatch(src, /runtimeApi\.bizPreview\(\{[\s\S]{0,500}action: '现查'/)
  assert.match(src, /extractBoundKindHints/)
  assert.match(src, /operationKindHitSheets/)
  assert.match(src, /operationKindViewRef/)
  assert.match(src, /operationBundlesAlign\(anchor, sheet\)/)
  assert.match(src, /keepPending/)
  assert.match(src, /shouldRejectIncomingCovering\(/)
  assert.match(src, /shouldSkipCoveringPending\(/)
  assert.match(src, /resolveConnectedKind\(/)
  const applyPending = src.slice(src.indexOf('const applyPendingSheet'))
  const ensureAt = applyPending.indexOf('if (isWritePreview) ensureListRestoreBeforeWritePreview')
  const sameFpAt = applyPending.indexOf('incomingFp === appliedSheetFpRef.current')
  assert.ok(ensureAt >= 0 && sameFpAt > ensureAt)
  assert.match(src, /displayedSheetRef/)
  assert.doesNotMatch(src, /if \(viewKind && incomingKind && viewKind !== incomingKind\) \{\s*if \(!isWritePreviewSheet\(sheet\)\) rememberBizPendingSheet\(sheet\)\s*return true/)
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

test('history option labels use speech, where/hop, or cached row identity, never a clock', async () => {
  const { historyOptionLabel, historyConditionLabel } = await import('../../src/lib/biz-list-query.ts')
  const clockFree = historyOptionLabel({ kind: 'KindA', action: 'ActX' }, { kind: 'KindA', action: 'ActX' })
  assert.equal(clockFree, 'KindA · ActX')
  assert.doesNotMatch(clockFree, /\d{2}\/\d{2}/)
  assert.doesNotMatch(clockFree, /刚刚|分钟前|小时前/)

  const spoken = historyOptionLabel(
    { kind: 'KindA', action: 'ActX' },
    { speech: '待审且已到期的那次', rows: [{ no: 'X-1' }] },
  )
  assert.equal(spoken, 'KindA · ActX · 待审且已到期的那次')

  const fromNo = historyOptionLabel(
    { kind: 'KindA', action: 'ActX' },
    { kind: 'KindA', action: 'ActX', rows: [{ no: 'X-1' }] },
  )
  assert.equal(fromNo, 'KindA · ActX · X-1')
  assert.doesNotMatch(fromNo, /\d{2}\/\d{2}/)
  assert.doesNotMatch(fromNo, /刚刚|分钟前|小时前/)

  const fromPk = historyOptionLabel(
    { kind: 'KindA', action: 'ActX' },
    { rows: [{ id: 'pk-9' }] },
  )
  assert.equal(fromPk, 'KindA · ActX · pk-9')

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

test('approve preview uses sheet.changes for confirmable from→to diffs', async () => {
  const { sheetHasConfirmablePreviewChanges, buildPreviewSummary } = await import('../../src/lib/biz-sheet-display.ts')
  const fieldKey = 'phase'
  const fieldLabel = '阶段'
  const sheet = {
    action: '过审',
    kind: 'KindA',
    preview_id: 'pv_phase',
    rows: [{ no: 'R-1', fields: { [fieldKey]: 'open' } }],
    columns: [{ key: fieldKey, label: fieldLabel }],
    changes: [{ field: fieldKey, label: fieldLabel, from: 'open', to: 'closed' }],
  }
  assert.equal(sheetHasConfirmablePreviewChanges(sheet), true)
  const summary = buildPreviewSummary(sheet)
  assert.equal(summary.changes.length, 1)
  assert.equal(summary.changes[0].label, fieldLabel)
  assert.equal(summary.changes[0].from, 'open')
  assert.equal(summary.changes[0].to, 'closed')
})

test('matchSurfaceIdForSheet no longer impersonates kind+action[0]', () => {
  const src = readFileSync(join(repoRoot, 'src/lib/biz-surface-cache.ts'), 'utf8')
  assert.doesNotMatch(src, /return candidates\[0\]\?\.id/)
  assert.match(src, /row\.previewId === pid/)
})

test('this-operation kinds come from from/steps; catalog of the same kind does not align', async () => {
  const { extractBoundKindHints, operationBundlesAlign, operationKindHitSheets } = await import('../../src/lib/biz-list-query.ts')
  const floated = {
    kind: 'ChildB',
    action: '现查',
    speech: 'pending ChildB ∩ expired ParentA',
    from: { kind: 'ParentA', rows: [{ no: 'PA-HIT' }] },
    hopWhere: [{ keys: ['status'], values: ['pending'] }],
    steps: [{ kind: 'ParentA' }, { kind: 'ChildB' }],
    rows: [{ no: 'CB-HIT' }],
  }
  const hints = extractBoundKindHints(floated)
  assert.ok(hints.includes('ChildB'))
  assert.ok(hints.includes('ParentA'))
  const hits = operationKindHitSheets(floated)
  const parentHit = hits.find((row) => row.kind === 'ParentA')
  const childHit = hits.find((row) => row.kind === 'ChildB')
  assert.equal(parentHit?.rows.length, 1)
  assert.equal(parentHit?.rows[0].no, 'PA-HIT')
  assert.equal(childHit?.rows.length, 1)
  assert.equal(childHit?.rows[0].no, 'CB-HIT')
  const sibling = {
    kind: 'ParentA',
    action: '现查',
    speech: 'pending ChildB ∩ expired ParentA',
    hopWhere: [{ keys: ['status'], values: ['pending'] }],
    rows: [{ no: 'PA-HIT' }],
  }
  const catalog = {
    kind: 'ChildB',
    action: '现查',
    rows: Array.from({ length: 20 }, (_, index) => ({ no: `CB-${index}` })),
  }
  assert.equal(operationBundlesAlign(floated, sibling), true)
  assert.equal(operationBundlesAlign(floated, catalog), false)
  assert.equal(hits.some((row) => Array.isArray(row.rows) && row.rows.length === 20), false)
})

test('new pending paints even when the current kind view differs; same-operation side view holds', async () => {
  const { shouldHoldSideKindView } = await import('../../src/lib/biz-list-query.ts')
  const shown = {
    kind: 'KindShown',
    action: '现查',
    speech: 'first operation speech',
    from: { kind: 'KindFrom', rows: [{ no: 'FROM-1' }] },
    hopWhere: [{ keys: ['status'], values: ['open'] }],
    steps: [{ kind: 'KindFrom' }, { kind: 'KindShown' }],
    rows: [{ no: 'SHOWN-1' }],
  }
  const sameOpIncoming = {
    kind: 'KindIncoming',
    action: '现查',
    speech: 'first operation speech',
    from: { kind: 'KindFrom', rows: [{ no: 'FROM-1' }] },
    hopWhere: [{ keys: ['status'], values: ['open'] }],
    steps: [{ kind: 'KindFrom' }, { kind: 'KindIncoming' }],
    rows: [{ no: 'IN-1' }],
  }
  const nextOpIncoming = {
    kind: 'KindNext',
    action: '现查',
    speech: 'second operation speech',
    from: { kind: 'KindOther', rows: [{ no: 'OTHER-1' }] },
    hopWhere: [{ keys: ['status'], values: ['pending'] }],
    steps: [{ kind: 'KindOther' }, { kind: 'KindNext' }],
    rows: [{ no: 'NEXT-1' }],
  }
  assert.equal(shouldHoldSideKindView('KindShown', sameOpIncoming, shown), true)
  assert.equal(shouldHoldSideKindView('KindShown', nextOpIncoming, shown), false)
  assert.equal(shouldHoldSideKindView('KindShown', sameOpIncoming, shown, true), false)
  assert.equal(shouldHoldSideKindView('', nextOpIncoming, shown), false)
  assert.equal(shouldHoldSideKindView('KindNext', nextOpIncoming, shown), false)
  assert.equal(shouldHoldSideKindView('KindShown', sameOpIncoming, { ...shown, rows: [] }), false)
})

test('empty incoming never paints over a populated list', async () => {
  const { shouldRejectEmptyIncomingSheet } = await import('../../src/lib/biz-list-query.ts')
  const shown = {
    kind: 'KindShown',
    action: '现查',
    speech: 'first operation speech',
    rows: [{ no: 'SHOWN-1' }],
  }
  const emptyPoll = {
    kind: 'KindShown',
    action: '现查',
    speech: 'first operation speech',
    rows: [],
  }
  const emptyNext = {
    kind: 'KindNext',
    action: '现查',
    speech: 'second operation speech',
    rows: [],
  }
  assert.equal(shouldRejectEmptyIncomingSheet(emptyPoll, 1, shown), true)
  assert.equal(shouldRejectEmptyIncomingSheet(emptyNext, 1, shown), true)
  assert.equal(shouldRejectEmptyIncomingSheet(emptyPoll, 0, shown), false)
})

test('empty write without preview_id and catalog dump must not cover a populated sheet', async () => {
  const {
    shouldRejectEmptyIncomingSheet,
    shouldRejectIncomingCovering,
  } = await import('../../src/lib/biz-list-query.ts')
  const { collapseKindsToConnectedTables, resolveConnectedKind } = await import('../../src/lib/connected-kind.ts')
  const shown = {
    kind: 'LongKind',
    action: '现查',
    speech: 'batch this table',
    rows: [{ no: 'ROW-1' }],
  }
  assert.equal(shouldRejectEmptyIncomingSheet({
    kind: 'LongKind',
    action: '过审',
    speech: 'batch this table',
    rows: [],
  }, 1, shown), true)
  assert.equal(shouldRejectEmptyIncomingSheet({
    kind: 'LongKind',
    action: '过审',
    speech: 'batch this table',
    preview_id: 'preview-empty-write',
    rows: [],
  }, 1, shown), true)
  const connected = collapseKindsToConnectedTables([
    { kind: 'LongKind', resource: 'res_a', catalogVersion: 'schema:1', fields: ['a', 'b', 'c'] },
    { kind: 'ShortKind', resource: 'res_a', fields: ['no'] },
    { kind: 'Orphan', fields: ['x'] },
  ])
  assert.equal(connected.kinds.map((row) => row.kind).join(), 'LongKind')
  assert.equal(resolveConnectedKind('ShortKind', connected), 'LongKind')
  assert.equal(resolveConnectedKind('Orphan', connected), '')
  assert.equal(shouldRejectEmptyIncomingSheet({
    kind: 'ShortKind',
    action: '过审',
    speech: 'batch this table',
    rows: [],
  }, 1, shown, connected), true)
  assert.equal(shouldRejectIncomingCovering({
    kind: 'LongKind',
    action: '现查',
    rows: Array.from({ length: 20 }, (_, index) => ({ no: `C-${index}` })),
  }, 1, shown), true)
})

test('RecordsPanel apply/SSE refuse another session pending', () => {
  const source = readFileSync(join(repoRoot, 'src/components/biz/RecordsPanel.tsx'), 'utf8')
  assert.match(source, /liveSid && !sheetBelongsToSession\(next, liveSid\)/)
  assert.match(source, /abortLeftoverAskTurn/)
  assert.match(source, /shouldCancelDshAfterWritePreview/)
  assert.match(source, /historySessionIdRef\.current = sid/)
})

test('AI official handoff does not paint from the shared pending slot', () => {
  const watch = readFileSync(join(repoRoot, 'runtime/lan-assist-state-watch.mjs'), 'utf8')
  assert.match(watch, /officialRoundSheet/)
  assert.match(watch, /round-end/)
  assert.doesNotMatch(watch, /pendingSheet \?\? state\?\.pendingWrite/)
  const autoOpen = readFileSync(join(repoRoot, 'src/lib/biz-records-auto-open.ts'), 'utf8')
  assert.match(autoOpen, /source === 'lan-assist'/)
})
