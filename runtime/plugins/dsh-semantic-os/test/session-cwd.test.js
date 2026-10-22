import assert from 'node:assert/strict'
import test from 'node:test'
import { cwdFromSnap, cwdOf } from '../session-cwd.js'

const os = '/Users/zxz/Documents/ai-project/dsh-semantic-os'
const lan = '/Users/zxz/Documents/ai-project/dsh-lan-assist'
const eyes = '/Users/zxz/Documents/ai-project/dsh-eyes'

function snap(current, rows) {
  const byId = {}
  const ids = []
  for (const [id, cwd] of rows) {
    byId[id] = { cwd }
    ids.push(id)
  }
  return { byId, ids, current }
}

test('cwd follows the addressed session, not the first row in the list', () => {
  const s = snap('s-lan', [
    ['s-os', os],
    ['s-lan', lan],
    ['s-eyes', eyes],
  ])
  assert.equal(cwdFromSnap(s, 's-os'), os)
  assert.equal(cwdFromSnap(s, 's-lan'), lan)
  assert.equal(cwdFromSnap(s, 's-eyes'), eyes)
})

test('switching current without sessionId uses snap.current only', () => {
  const s1 = snap('s-os', [['s-os', os], ['s-lan', lan]])
  const s2 = snap('s-lan', [['s-os', os], ['s-lan', lan]])
  const s3 = snap('s-eyes', [['s-os', os], ['s-lan', lan], ['s-eyes', eyes]])
  assert.equal(cwdFromSnap(s1, ''), os)
  assert.equal(cwdFromSnap(s2, ''), lan)
  assert.equal(cwdFromSnap(s3, ''), eyes)
})

test('stale sessionId must not fall back to a neighbor cwd', () => {
  const s = snap('s-eyes', [
    ['s-os', os],
    ['s-lan', lan],
    ['s-eyes', eyes],
  ])
  assert.equal(cwdFromSnap(s, 'gone'), '')
  assert.notEqual(cwdFromSnap(s, 'gone'), lan)
  assert.notEqual(cwdFromSnap(s, 'gone'), os)
})

test('cwdOf reads sessions.list.getSnapshot().current', () => {
  let current = 's-os'
  const sessions = {
    list: {
      getSnapshot: () => snap(current, [['s-os', os], ['s-lan', lan]]),
    },
  }
  assert.equal(cwdOf(sessions, 's-os'), os)
  current = 's-lan'
  assert.equal(cwdOf(sessions, 's-lan'), lan)
  assert.equal(cwdOf(sessions, ''), lan)
})


test('useSessions must be called as a selector hook', () => {
  function useSessions(sel) {
    if (typeof sel !== 'function') throw new TypeError('selector required')
    return sel(snap('s-lan', [['s-os', os], ['s-lan', lan]]))
  }
  assert.throws(() => useSessions(), /selector required/)
  const got = useSessions((s) => s)
  assert.equal(cwdFromSnap(got, ''), lan)
})
