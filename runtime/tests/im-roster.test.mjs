import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { destOf, isRoster, upsertGroup, visibleMembers } from '../vendor-overlays/dsh-lan-assist/roster.js'

const self = 'pk_self'
const a = 'pk_a'
const b = 'pk_b'

describe('im roster envelope', () => {
  test('roster flag is the identity of a membership envelope', () => {
    assert.equal(isRoster({ roster: true, groupId: 'g_1' }), true)
    assert.equal(isRoster({ groupId: 'g_1', topic: true }), false)
  })

  test('each machine stores everyone except self', () => {
    assert.deepEqual(visibleMembers([self, a, b], self), [a, b])
    assert.deepEqual(visibleMembers([self, a, b], a), [self, b])
  })

  test('letter dest is membership minus self; an unpaired seat stays in dest', () => {
    assert.deepEqual(destOf([self, a, b], [], a), [self, b])
    assert.deepEqual(destOf([a, b], [a], self), [a, b])
    assert.deepEqual(destOf([self], [], self), [])
  })

  test('receive roster upserts the group and does not need a topic', () => {
    const state = { self: { id: a }, groups: [] }
    const row = upsertGroup(state, {
      groupId: 'g_gray',
      groupName: '灰度上线',
      visible: [self, a, b],
      roster: true,
    }, { id: self }, () => 10, 'roster')
    assert.equal(row.id, 'g_gray')
    assert.equal(row.origin, 'roster')
    assert.deepEqual(row.members, [self, b])
    assert.equal(state.groups.length, 1)
  })

  test('a later roster updates name and members on the existing row', () => {
    const state = { self: { id: a }, groups: [] }
    upsertGroup(state, {
      groupId: 'g_gray',
      groupName: '灰度上线',
      visible: [self, a],
    }, { id: self }, () => 10, 'roster')
    upsertGroup(state, {
      groupId: 'g_gray',
      groupName: '灰度上线·改',
      visible: [self, a, b],
    }, { id: self }, () => 11, 'roster')
    assert.equal(state.groups.length, 1)
    assert.equal(state.groups[0].name, '灰度上线·改')
    assert.deepEqual(state.groups[0].members, [self, b])
  })

  test('local origin stays when a topic letter upserts the same id', () => {
    const state = {
      self: { id: self },
      groups: [{ id: 'g_gray', name: '灰度上线', members: [a], origin: 'local', createdAt: 1 }],
    }
    const row = upsertGroup(state, {
      groupId: 'g_gray',
      groupName: '灰度上线',
      visible: [self, a, b],
    }, { id: a }, () => 12, 'roster')
    assert.equal(row.origin, 'local')
    assert.deepEqual(row.members, [a, b])
  })
})
