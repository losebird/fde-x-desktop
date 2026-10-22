import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hallRequests, inThread, isDirectChat, isTopicRoot, lastBodyOf, lastLineOf, letterGoneFor, requestShell, sameDirectTalk } from '../hall.js'

test('hall shell keeps last line and unread, not versions', () => {
  const req = {
    id: 'req_a',
    kind: 'incoming',
    status: 'open',
    from: 'pk_lin',
    to: ['pk_ace'],
    excerpt: '先切 10%。回滚脚本今晚我改完。对账告警先别关。',
    versions: [{ n: 1, body: '先切 10%。回滚脚本今晚我改完。对账告警先别关。' }],
    replies: [{ body: '先看回滚窗口。' }],
    reads: {},
  }
  const shell = requestShell(req, 'pk_ace')
  assert.equal(shell.versions, undefined)
  assert.equal(shell.replies, 1)
  assert.equal(shell.unread, true)
  assert.equal(shell.seenReplies, 0)
  const out = requestShell({
    id: 'req_b', kind: 'outgoing', status: 'replied', from: 'pk_ace', to: ['pk_lin'],
    excerpt: '先切', replies: [{ body: '先看回滚窗口。' }], seenReplies: 0,
  }, 'pk_ace')
  assert.equal(out.unread, true)
  const seen = requestShell({
    id: 'req_b', kind: 'outgoing', status: 'replied', from: 'pk_ace', to: ['pk_lin'],
    excerpt: '先切', replies: [{ body: '先看回滚窗口。' }], seenReplies: 1,
  }, 'pk_ace')
  assert.equal(seen.unread, false)
  assert.equal(lastBodyOf(req), '先看回滚窗口。')
  assert.ok(String(shell.last).length <= 40)
})

test('group topics are not 1:1 chat', () => {
  assert.equal(isDirectChat({ excerpt: '先切' }), true)
  assert.equal(isDirectChat({ topic: true, groupId: 'g1' }), false)
  assert.equal(isDirectChat({ groupId: 'g1' }), false)
  assert.equal(isDirectChat(null), false)
  assert.equal(sameDirectTalk(
    { from: 'pk_lin', to: ['pk_ace'] },
    { from: 'pk_ace', to: ['pk_lin'] },
  ), true)
  assert.equal(sameDirectTalk(
    { from: 'pk_lin', to: ['pk_ace'] },
    { from: 'pk_ace', to: ['pk_xxx'] },
  ), false)
  assert.equal(sameDirectTalk(
    { from: 'pk_lin', to: ['pk_ace'], groupId: 'g1' },
    { from: 'pk_ace', to: ['pk_lin'], groupId: 'g1' },
  ), false)
  assert.equal(isTopicRoot({ topic: true, groupId: 'g1' }), true)
  assert.equal(isTopicRoot({ topic: true, groupId: 'g1', threadId: 'req_root' }), false)
  assert.equal(inThread({ id: 'req_root', topic: true }, 'req_root'), true)
  assert.equal(inThread({ id: 'req_child', threadId: 'req_root' }, 'req_root'), true)
  assert.equal(inThread({ id: 'req_other' }, 'req_root'), false)
})

test('closed letters stay out of the hall list', () => {
  const state = {
    requests: {
      live: { id: 'live', status: 'open', excerpt: '在' },
      dead: { id: 'dead', status: 'closed', excerpt: '关了' },
    },
  }
  const list = hallRequests(state, 'pk_ace')
  assert.equal(list.length, 1)
  assert.equal(list[0].id, 'live')
})

test('lastLineOf and letterGoneFor stay honest', () => {
  assert.equal(lastLineOf([]), '还没有往来')
  assert.equal(lastLineOf([{ updatedAt: 2, last: '后一句' }, { updatedAt: 1, last: '先一句' }]), '后一句')
  assert.equal(letterGoneFor({ status: 'withdrawn' }, 'pk_lin'), true)
  assert.equal(letterGoneFor({ kind: 'outgoing', withdrawn: ['pk_lin'] }, 'pk_lin'), true)
  assert.equal(letterGoneFor({ kind: 'outgoing', withdrawn: ['pk_lin'] }, 'pk_other'), false)
  assert.equal(letterGoneFor({ kind: 'incoming', withdrawn: ['pk_ace'] }, 'pk_lin'), false)
  assert.equal(letterGoneFor({ status: 'open', withdrawn: [] }, 'pk_lin'), false)
})

test('replyDraft already sent is not shown again', async () => {
  const { liveReplyDraft, requestPublic } = await import('../view.js')
  assert.equal(liveReplyDraft({ replyDraft: 'hello', versions: [{ body: 'hello' }] }), '')
  assert.equal(requestPublic({ replyDraft: 'hello', versions: [{ body: 'hello' }] }).replyDraft, '')
  assert.equal(liveReplyDraft({ replyDraft: '还没发' }), '还没发')
  assert.equal(liveReplyDraft(
    { id: 'in', replyDraft: '这是现查。', versions: [{ body: '停用的供应商' }] },
    [
      { id: 'in', versions: [{ body: '停用的供应商' }] },
      { id: 'child', threadId: 'in', excerpt: '这是现查。', body: '这是现查。' },
    ],
  ), '')
  const incoming = {
    id: 'in',
    kind: 'incoming',
    from: 'pk_lin',
    to: ['pk_ace'],
    replyDraft: '来信是在问这个项目。',
    versions: [{ body: '这个项目怎么样？' }],
  }
  const mailed = {
    id: 'out',
    kind: 'outgoing',
    from: 'pk_ace',
    to: ['pk_lin'],
    excerpt: '来信是在问这个项目。',
    body: '来信是在问这个项目。',
    versions: [{ body: '来信是在问这个项目。' }],
  }
  assert.equal(liveReplyDraft(incoming, [incoming, mailed]), '')
  assert.equal(requestPublic(incoming, [incoming, mailed]).replyDraft, '')
  assert.equal(liveReplyDraft(incoming, [
    incoming,
    { id: 'other', kind: 'outgoing', from: 'pk_ace', to: ['pk_xxx'], excerpt: '来信是在问这个项目。', body: '来信是在问这个项目。' },
  ]), '来信是在问这个项目。')
})
