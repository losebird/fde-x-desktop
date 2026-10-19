import { test } from 'node:test'
import assert from 'node:assert/strict'
import { composerDraftOf, consumeDraftsOnSend, dropReplyDraft, mergeDraft } from '../draft-state.js'

test('mergeDraft grows a letter and does not shrink it to a code fence', () => {
  assert.equal(mergeDraft('', '你好，口语可以挂在同一条词上。'), '你好，口语可以挂在同一条词上。')
  assert.equal(mergeDraft('你好。', '你好。再补一句。'), '你好。再补一句。')
  assert.equal(mergeDraft('你好，口语可以挂在同一条词上。\n\n{ "role": "问句" }', '{ "role": "问句" }'), '你好，口语可以挂在同一条词上。\n\n{ "role": "问句" }')
  assert.equal(mergeDraft('电话现在是 137。', '现在是 potential。'), '电话现在是 137。\n\n现在是 potential。')
})

test('composerDraftOf fills an empty box and grows a draft we still own', () => {
  assert.equal(composerDraftOf('', '先说一句。', '', ''), '先说一句。')
  assert.equal(composerDraftOf('先说一句。', '先说一句。再补安装。', '', '先说一句。'), '先说一句。再补安装。')
  assert.equal(composerDraftOf('先说一句。', '先说一句。', '', '先说一句。'), null)
})

test('composerDraftOf does not clobber a user edit or an already sent draft', () => {
  assert.equal(composerDraftOf('我自己改的', '先说一句。再补安装。', '', '先说一句。'), null)
  assert.equal(composerDraftOf('', '先说一句。', '先说一句。', ''), null)
})

test('consumeDraftsOnSend only clears 1:1 incomings from the recipient', () => {
  const lin = { id: 'in-lin', kind: 'incoming', from: 'pk_lin', replyDraft: '给林督' }
  const chen = { id: 'in-chen', kind: 'incoming', from: 'pk_chen', replyDraft: '给陈工' }
  const topic = { id: 'topic', kind: 'incoming', from: 'pk_lin', groupId: 'g1', topic: true, replyDraft: '群稿' }
  const state = { requests: { [lin.id]: lin, [chen.id]: chen, [topic.id]: topic } }
  consumeDraftsOnSend(state, { to: ['pk_lin'] })
  assert.equal(lin.replyDraft, '')
  assert.equal(chen.replyDraft, '给陈工')
  assert.equal(topic.replyDraft, '群稿')
  dropReplyDraft(topic)
  assert.equal(topic.replyDraft, '')
})
