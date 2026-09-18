import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')

function selectSessionHistorySurfaces(surfaces, opts) {
  const cachedIds = opts.cachedIds
  const cached = surfaces.filter((row) => cachedIds.has(row.id))
  const sessionKey = String(opts.sessionId || '').trim()
  const scoped = sessionKey
    ? cached.filter((row) => !row.sessionId || row.sessionId === sessionKey)
    : cached
  return [...scoped].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

function shouldBlockIncomingSheetForHistoryPin(pinnedSurfaceId, incomingSurfaceId) {
  const pinned = String(pinnedSurfaceId || '').trim()
  if (!pinned) return false
  const incoming = String(incomingSurfaceId || '').trim()
  if (!incoming) return true
  return incoming !== pinned
}

function sheetRowIdentity(row, index = 0) {
  const id = String(row.orderId ?? row.no ?? row.id ?? '').trim()
  return id ? `${id}#${index}` : `#${index}`
}

function sheetRowRenderKey(row, index = 0, sheetIdentity = '') {
  const identity = sheetRowIdentity(row, index)
  return sheetIdentity ? `${sheetIdentity}::${identity}` : identity
}

test('history options never dump uncached workspace surfaces', () => {
  const surfaces = [
    { id: 'a', sessionId: 's1', createdAt: 2 },
    { id: 'b', sessionId: 's1', createdAt: 1 },
    { id: 'c', sessionId: 's2', createdAt: 3 },
  ]
  const none = selectSessionHistorySurfaces(surfaces, { cachedIds: new Set() })
  assert.equal(none.length, 0)
  const missingSession = selectSessionHistorySurfaces(surfaces, {
    cachedIds: new Set(['a', 'c']),
  })
  assert.deepEqual(missingSession.map((row) => row.id), ['c', 'a'])
  const scoped = selectSessionHistorySurfaces(surfaces, {
    sessionId: 's1',
    cachedIds: new Set(['a', 'c']),
  })
  assert.deepEqual(scoped.map((row) => row.id), ['a'])
})

test('pinned history blocks a different or unknown incoming surface', () => {
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

test('RecordsPanel keeps history pin across SSE and clones applySheet rows', () => {
  const src = readFileSync(join(repoRoot, 'src/components/biz/RecordsPanel.tsx'), 'utf8')
  assert.doesNotMatch(src, /useEvents\(\['biz\.sheet\.pending'\][\s\S]{0,400}historyPinnedSurfaceIdRef\.current = ''/)
  assert.doesNotMatch(src, /useEvents\(\['ai\.tool\.finished'\][\s\S]{0,400}historyPinnedSurfaceIdRef\.current = ''/)
  assert.match(src, /const normalizedRows = cloneSheetRows\(sheet\.rows\)/)
  assert.match(src, /const appliedSheet = \{ \.\.\.sheet, rows: normalizedRows/)
  assert.match(src, /sheetRowRenderKey\(row, absoluteIndex, sheetIdentity\)/)
  assert.match(src, /<tbody key=\{sheetIdentity/)
  assert.match(src, /selectSessionHistorySurfaces/)
  assert.doesNotMatch(src, /return scoped\.length \? scoped : sorted/)
})

test('matchSurfaceIdForSheet no longer impersonates kind+action[0]', () => {
  const src = readFileSync(join(repoRoot, 'src/lib/biz-surface-cache.ts'), 'utf8')
  assert.doesNotMatch(src, /return candidates\[0\]\?\.id/)
  assert.match(src, /row\.previewId === pid/)
})
