import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyHitId, hostSourceOf, sessionIdOf } from '../memory/identity.mjs'

test('session: is a session, not a card', () => {
  const hit = classifyHitId('session:session-abc:3')
  assert.equal(hit.class, 'session')
  assert.equal(hit.sessionId, 'session-abc')
  assert.equal(hit.href.panel, 'ai')
  assert.equal(hit.href.sessionId, 'session-abc')
})

test('memory: lands on the archive', () => {
  const hit = classifyHitId('memory:ab12cd34')
  assert.equal(hit.class, 'card')
  assert.equal(hit.href.pane, 'cards')
  assert.equal(hit.href.cardId, 'memory:ab12cd34')
})

test('origin prefixes land on the archive with originId', () => {
  for (const id of ['biz:t1', 'im:r1', 'task:x', 'briefing:b', 'app:item-log', 'app:s:e:1', 'file:docs/a.md']) {
    const hit = classifyHitId(id)
    assert.equal(hit.class, 'origin')
    assert.equal(hit.href.pane, 'cards')
    assert.equal(hit.href.originId, id)
  }
})

test('other ids are graph nodes', () => {
  const hit = classifyHitId('Person:张三')
  assert.equal(hit.class, 'graph')
  assert.equal(hit.href.pane, 'explore')
})

test('Host source only session: and file:', () => {
  assert.equal(hostSourceOf('session:s1'), 'session:s1')
  assert.equal(hostSourceOf('file:a.md'), 'file:a.md')
  assert.equal(hostSourceOf('biz:t1'), '')
  assert.equal(sessionIdOf('session:session-1:9'), 'session-1')
})
