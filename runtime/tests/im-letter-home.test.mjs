import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  homeForIncoming,
  homeForOutgoing,
  incomingUnread,
  letterHome,
  localCwdSet,
  mailOnLane,
  normalizeCwd,
  placeEmptyHomes,
  talkHomes,
  talkKey,
  talkMemberIds,
  unreadByHome,
  unreadSheet,
  unreadOfTalk,
  unreadOfRoster,
  topicTalkId,
  dmTalkId,
  imPaneOpen,
  imUnreadMouth,
  imBrowseOccupancy,
  imBrowseForVisibleTalk,
  followLetter,
  laneOfLetterHome,
} from '../vendor-overlays/dsh-lan-assist/letter-home.js'

const a = '/Users/zxz/ws-a'
const b = '/Users/zxz/ws-b'
const locals = localCwdSet([{ cwd: a }, { cwd: `${b}/` }])
const self = 'pk_self'
const peer = 'pk_jia'

function letter(partial) {
  return {
    id: 'req_x',
    kind: 'incoming',
    unread: true,
    from: peer,
    to: [self],
    workspace: '',
    threadId: '',
    groupId: '',
    ...partial,
  }
}

describe('im letter home', () => {
  test('normalizeCwd drops trailing slash and ignores sender-relative paths', () => {
    assert.equal(normalizeCwd(`${a}/`), a)
    assert.equal(normalizeCwd('工作台宣传图'), '')
    assert.equal(normalizeCwd(''), '')
  })

  test('incoming receive does not copy sender workspace', () => {
    const state = { requests: {} }
    assert.equal(homeForIncoming(state, { workspace: '/Users/other/proj', threadId: '' }), '')
  })

  test('incoming receive follows parent letter workspace', () => {
    const state = {
      requests: {
        req_root: { id: 'req_root', workspace: a },
      },
    }
    assert.equal(homeForIncoming(state, { workspace: '/Users/other/proj', threadId: 'req_root' }), a)
  })

  test('incoming receive walks empty parents to the stamped ancestor', () => {
    const state = {
      requests: {
        req_root: { id: 'req_root', workspace: a },
        req_mid: { id: 'req_mid', workspace: '', threadId: 'req_root' },
      },
    }
    assert.equal(homeForIncoming(state, { workspace: '/Users/other/proj', threadId: 'req_mid' }), a)
  })

  test('outgoing stamp is the home; sender path is unassigned', () => {
    const sent = letter({ id: 'req_out', kind: 'outgoing', unread: false, from: self, to: [peer], workspace: a })
    const foreign = letter({ id: 'req_in', workspace: '/Users/other/proj' })
    assert.equal(letterHome(sent, [sent, foreign], locals), a)
    assert.equal(letterHome(foreign, [sent, foreign], locals), a)
  })

  test('two local talks with the same peer leave new incoming unassigned', () => {
    const inA = letter({ id: 'req_a', kind: 'outgoing', unread: false, from: self, to: [peer], workspace: a })
    const inB = letter({ id: 'req_b', kind: 'outgoing', unread: false, from: self, to: [peer], workspace: b })
    const fresh = letter({ id: 'req_new', workspace: '/Users/other/proj' })
    assert.equal(letterHome(fresh, [inA, inB, fresh], locals), '')
  })

  test('unread splits by home and unassigned', () => {
    const rows = [
      letter({ id: 'u1', workspace: a, from: 'p1', to: [self] }),
      letter({ id: 'u2', workspace: a, from: 'p1', to: [self] }),
      letter({ id: 'u3', workspace: '', from: 'p2', to: [self] }),
      letter({ id: 'out', kind: 'outgoing', unread: true, from: self, to: ['p3'], workspace: b }),
    ]
    const got = unreadByHome(rows, locals)
    assert.equal(got.byCwd[a], 2)
    assert.equal(got.byCwd[b], 0)
    assert.equal(got.unassigned, 1)
  })

  test('talkKey is the same for outgoing and incoming of a pair', () => {
    const out = letter({ kind: 'outgoing', from: self, to: [peer] })
    const inn = letter({ from: peer, to: [self] })
    assert.equal(talkKey(out), talkKey(inn))
    assert.equal(talkKey(out), dmTalkId(self, peer))
  })

  test('talkKey for a group letter is the topic root, not the roster', () => {
    const root = letter({ id: 'req_root', topic: true, groupId: 'g_1', threadId: '' })
    const follow = letter({ id: 'req_follow', groupId: 'g_1', threadId: 'req_root' })
    const other = letter({ id: 'req_other', topic: true, groupId: 'g_1', threadId: '' })
    assert.equal(talkKey(root), topicTalkId('req_root'))
    assert.equal(talkKey(follow), topicTalkId('req_root'))
    assert.equal(talkKey(other), topicTalkId('req_other'))
    assert.notEqual(talkKey(root), talkKey(other))
    assert.notEqual(talkKey(root), 'g:g_1')
  })

  test('thread public row without unread boolean is unread until self read stamp', () => {
    const open = letter({ id: 'req_t', unread: undefined, reads: {}, workspace: a })
    delete open.unread
    assert.equal(incomingUnread(open, self), true)
    assert.equal(unreadByHome([open], locals).byCwd[a], 1)
    const seen = { ...open, reads: { [self]: 1 } }
    assert.equal(incomingUnread(seen, self), false)
    assert.equal(unreadByHome([seen], locals).byCwd[a], 0)
  })

  test('withdrawn incoming is not unread even without a hall unread flag', () => {
    const gone = letter({ unread: undefined, status: 'withdrawn', reads: {} })
    delete gone.unread
    assert.equal(incomingUnread(gone, self), false)
  })

  test('roster envelope is not unread', () => {
    const roster = letter({ roster: true, groupId: 'g_1', unread: true })
    assert.equal(incomingUnread(roster, self), false)
    assert.equal(unreadByHome([roster], locals).unassigned, 0)
  })

  test('outgoing follow-up inherits the root home; current cwd does not rewrite it', () => {
    const state = {
      self: { id: self },
      requests: {
        req_root: { id: 'req_root', workspace: a, topic: true, groupId: 'g_1' },
      },
    }
    assert.equal(homeForOutgoing(state, { threadId: 'req_root', workspace: b, groupId: 'g_1' }), a)
  })

  test('outgoing follow-up of an unassigned root stamps send cwd', () => {
    const state = {
      self: { id: self },
      requests: {
        req_root: { id: 'req_root', workspace: '', topic: true, groupId: 'g_1' },
      },
    }
    assert.equal(homeForOutgoing(state, { threadId: 'req_root', workspace: a, groupId: 'g_1' }), a)
  })

  test('empty is not a unique home so a reply stamps send cwd', () => {
    const state = {
      self: { id: self },
      requests: {
        req_in: { id: 'req_in', from: peer, to: [self], workspace: '' },
      },
    }
    assert.deepEqual([...talkHomes(state.requests, dmTalkId(self, peer))], [])
    assert.equal(homeForOutgoing(state, { to: [peer], workspace: a }), a)
    assert.equal(homeForIncoming(state, { from: peer, to: [self], workspace: '/Users/other/proj' }), '')
  })

  test('incoming DM inherits the unique local talk home', () => {
    const state = {
      self: { id: self },
      requests: {
        req_1: { id: 'req_1', from: self, to: [peer], workspace: a },
      },
    }
    assert.equal(homeForIncoming(state, { from: peer, to: [self], workspace: '/Users/other/proj' }), a)
  })

  test('topic follow-up with two homes stays unassigned', () => {
    const state = {
      self: { id: self },
      requests: {
        req_root: { id: 'req_root', workspace: '', topic: true, groupId: 'g_1' },
        req_a: { id: 'req_a', workspace: a, groupId: 'g_1', threadId: 'req_root' },
        req_b: { id: 'req_b', workspace: b, groupId: 'g_1', threadId: 'req_root' },
      },
    }
    assert.equal(homeForOutgoing(state, { threadId: 'req_root', workspace: a, groupId: 'g_1' }), '')
    assert.equal(homeForIncoming(state, { threadId: 'req_root', groupId: 'g_1', workspace: '/Users/other/proj' }), '')
  })

  test('two local homes keep incoming and outgoing unassigned', () => {
    const state = {
      self: { id: self },
      requests: {
        req_a: { id: 'req_a', from: self, to: [peer], workspace: a },
        req_b: { id: 'req_b', from: self, to: [peer], workspace: b },
      },
    }
    assert.equal(homeForIncoming(state, { from: peer, to: [self], workspace: '/Users/other/proj' }), '')
    assert.equal(homeForOutgoing(state, { to: [peer], workspace: a }), '')
  })

  test('placeEmptyHomes fills empty talk members and leaves other talks', () => {
    const rows = {
      req_root: { id: 'req_root', topic: true, groupId: 'g_1', threadId: '', workspace: '' },
      req_follow: { id: 'req_follow', groupId: 'g_1', threadId: 'req_root', workspace: '' },
      req_kept: { id: 'req_kept', groupId: 'g_1', threadId: 'req_root', workspace: b },
      req_other: { id: 'req_other', topic: true, groupId: 'g_1', threadId: '', workspace: '' },
    }
    const placed = placeEmptyHomes(rows, ['req_follow'], a, 9)
    assert.deepEqual(new Set(placed), new Set(['req_root', 'req_follow']))
    assert.equal(rows.req_root.workspace, a)
    assert.equal(rows.req_follow.workspace, a)
    assert.equal(rows.req_follow.updatedAt, 9)
    assert.equal(rows.req_kept.workspace, b)
    assert.equal(rows.req_other.workspace, '')
  })

  test('new topic stamps send-time cwd', () => {
    const state = { self: { id: self }, requests: {} }
    assert.equal(homeForOutgoing(state, { groupId: 'g_1', workspace: a }), a)
  })

  test('first 1:1 stamps cwd; later 1:1 inherits the unique home', () => {
    const empty = { self: { id: self }, requests: {} }
    assert.equal(homeForOutgoing(empty, { to: [peer], workspace: a }), a)
    const existing = {
      self: { id: self },
      requests: {
        req_1: { id: 'req_1', from: self, to: [peer], workspace: a },
      },
    }
    assert.equal(homeForOutgoing(existing, { to: [peer], workspace: b }), a)
  })

  test('归到 expands to the topic root and its follow-ups', () => {
    const rows = {
      req_root: { id: 'req_root', topic: true, groupId: 'g_1', threadId: '' },
      req_follow: { id: 'req_follow', groupId: 'g_1', threadId: 'req_root' },
      req_other: { id: 'req_other', topic: true, groupId: 'g_1', threadId: '' },
    }
    assert.deepEqual(new Set(talkMemberIds(rows, 'req_follow')), new Set(['req_root', 'req_follow']))
    assert.deepEqual(talkMemberIds(rows, 'req_other'), ['req_other'])
  })

  test('projection: other-home mail stays off this screen; empty roster is unassigned', () => {
    assert.equal(mailOnLane([a], 'workspace', a), true)
    assert.equal(mailOnLane([a], 'workspace', b), false)
    assert.equal(mailOnLane([a], 'unassigned', a), false)
    assert.equal(mailOnLane([''], 'unassigned', a), true)
    assert.equal(mailOnLane([], 'unassigned', a, true), true)
    assert.equal(mailOnLane([], 'workspace', a, true), false)
    assert.equal(mailOnLane([a, ''], 'workspace', a), true)
    assert.equal(mailOnLane([a, ''], 'unassigned', a), true)
  })

  test('IM pane is open only when full, half, or floating', () => {
    assert.equal(imPaneOpen('tab', false), false)
    assert.equal(imPaneOpen('closed', false), false)
    assert.equal(imPaneOpen('full', false), true)
    assert.equal(imPaneOpen('half', false), true)
    assert.equal(imPaneOpen('tab', { x: 1 }), true)
  })

  test('mixed-home talk folds to unassigned until 归到', () => {
    const rows = [
      letter({ id: 'u1', workspace: a }),
      letter({ id: 'u2', workspace: b }),
    ]
    const sheet = unreadSheet(rows, locals, self)
    assert.equal(sheet.talks.length, 1)
    assert.equal(sheet.talks[0].home, '')
    assert.equal(sheet.unassigned, 2)
    assert.equal(sheet.byCwd[a], 0)
    assert.equal(sheet.byCwd[b], 0)
  })

  test('unread sheet folds by talk, roster lane, and home', () => {
    const root = letter({ id: 'req_root', topic: true, groupId: 'g_1', workspace: a, unread: false, kind: 'outgoing', from: self, to: [peer] })
    const follow = letter({ id: 'req_555', groupId: 'g_1', threadId: 'req_root', workspace: a })
    const other = letter({ id: 'req_other', topic: true, groupId: 'g_1', workspace: b })
    const dm = letter({ id: 'req_dm', workspace: a, from: 'p_dm', to: [self] })
    const open = letter({ id: 'req_open', workspace: '', from: 'p_open', to: [self] })
    const sheet = unreadSheet([root, follow, other, dm, open], locals, self)
    assert.equal(unreadOfTalk(sheet, topicTalkId('req_root')), 1)
    assert.equal(unreadOfTalk(sheet, topicTalkId('req_other')), 1)
    assert.equal(unreadOfRoster(sheet, 'g_1', 'workspace', a), 1)
    assert.equal(unreadOfRoster(sheet, 'g_1', 'workspace', b), 1)
    assert.equal(sheet.byCwd[a], 2)
    assert.equal(sheet.byCwd[b], 1)
    assert.equal(sheet.unassigned, 1)
    assert.equal(imUnreadMouth(sheet, true, a), 1)
    assert.equal(imUnreadMouth(sheet, false, a), 3)
  })

  test('unread mouth: IM closed counts current home plus unassigned; IM open keeps unassigned', () => {
    const split = unreadByHome([
      letter({ id: 'here', workspace: a, from: 'p1', to: [self] }),
      letter({ id: 'open', workspace: '', from: 'p2', to: [self] }),
      letter({ id: 'other', workspace: b, from: 'p3', to: [self] }),
    ], locals)
    assert.equal(imUnreadMouth(split, false, a), 2)
    assert.equal(imUnreadMouth(split, true, a), 1)
    assert.equal(imUnreadMouth(split, false, b), 2)
    assert.equal(imUnreadMouth(split, true, b), 1)
    assert.equal(imUnreadMouth(split, false, ''), 1)
  })

  test('occupancy keeps the talk; missing roster id closes it; lane mismatch does not', () => {
    const open = { threadId: 'g_1', topicId: 'req_root', lane: 'workspace' }
    assert.deepEqual(imBrowseOccupancy(open), open)
    assert.deepEqual(imBrowseForVisibleTalk(open, () => true), open)
    assert.deepEqual(imBrowseForVisibleTalk(open, () => false), { threadId: null, topicId: null, lane: 'workspace' })
    assert.deepEqual(imBrowseForVisibleTalk({ threadId: 'p1', topicId: 'gone', lane: 'unassigned' }, () => true), {
      threadId: 'p1',
      topicId: 'gone',
      lane: 'unassigned',
    })
    assert.deepEqual(imBrowseForVisibleTalk({ threadId: null, topicId: 'x', lane: 'workspace' }, () => true), {
      threadId: null,
      topicId: null,
      lane: 'workspace',
    })
  })

  test('followLetter keeps the talk and lanes empty home to unassigned', () => {
    assert.equal(laneOfLetterHome(''), 'unassigned')
    assert.equal(laneOfLetterHome(a), 'workspace')
    const open = { threadId: 'p1', topicId: 't1', lane: 'workspace' }
    assert.deepEqual(followLetter(open, { threadId: 'p1', home: '' }), {
      threadId: 'p1',
      topicId: 't1',
      lane: 'unassigned',
    })
    assert.deepEqual(followLetter(open, { threadId: 'p1', home: a }), {
      threadId: 'p1',
      topicId: 't1',
      lane: 'workspace',
    })
    assert.deepEqual(followLetter(open, { threadId: 'p2', home: '', topicId: null }), {
      threadId: 'p2',
      topicId: null,
      lane: 'unassigned',
    })
  })
})
