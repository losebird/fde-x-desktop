import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectUserLines,
  formatDistillLabel,
  installSessionDistill,
  postSessionDistill,
  shouldDistillSession,
} from '../session-distill.js'

function sessionOf({ id, cwd, preset, title, lines, assistants }) {
  const events = []
  for (const text of lines || []) {
    events.push({
      type: 'user/message',
      data: { source: { kind: 'user' }, content: [{ type: 'text', text }] },
    })
  }
  for (const text of assistants || []) {
    events.push({
      type: 'assistant/message',
      data: { message: { content: [{ type: 'text', text }] } },
    })
  }
  return {
    id,
    header: { id, cwd, agentPreset: preset || '', title: title || '' },
    seq: events.length,
    eventAt(index) { return events[index] },
  }
}

test('skips briefing and thin sessions', () => {
  assert.equal(shouldDistillSession(sessionOf({ id: 's1', cwd: '/ws', lines: ['一'] })), false)
  assert.equal(shouldDistillSession(sessionOf({
    id: 's2', cwd: '/ws', preset: 'fde-briefing', lines: ['一', '二'],
  })), false)
  assert.equal(shouldDistillSession(sessionOf({ id: 's3', cwd: '/ws', lines: ['一', '二'] })), true)
})

test('label is a short close-out not a transcript dump', () => {
  const session = sessionOf({
    id: 's1',
    cwd: '/ws',
    title: '采购订单核验',
    lines: ['先对账', '再补开票', 'Current runtime context. skip'],
  })
  const label = formatDistillLabel(session, collectUserLines(session))
  assert.match(label, /规则：采购订单核验/)
  assert.match(label, /怎么知道：session:s1/)
  assert.match(label, /未证实：/)
  assert.match(label, /再补开票/)
  assert.equal(label.includes('Current runtime context'), false)
  assert.ok(label.length <= 400)
})

test('label prefers last assistant close-out and trap marks', () => {
  const session = sessionOf({
    id: 'session-po',
    cwd: '/ws',
    title: '采购订单核验',
    lines: ['继续处理', '先记下缺口，单号补齐后再对数量'],
    assistants: [
      '现况未读到该采购单、收货和关联进项发票；发票型无数量列。未放行，不过账。',
    ],
  })
  const label = formatDistillLabel(session, collectUserLines(session))
  assert.match(label, /规则：现况未读到该采购单/)
  assert.match(label, /怎么知道：session:session-po/)
  assert.match(label, /陷阱：/)
  assert.match(label, /未放行/)
  assert.match(label, /未证实：/)
  assert.ok(label.length <= 400)
})

test('postSessionDistill posts one session origin card', async () => {
  const posts = []
  const session = sessionOf({ id: 'session-abc', cwd: '/ws/a', title: '核验', lines: ['问一', '问二'] })
  const result = await postSessionDistill(session, {
    env: { FDE_RUNTIME_PORT: '9', FDE_DSH_HOME: '/tmp/x' },
    readFile: async () => 'tok',
    fetch: async (href, init) => {
      posts.push({ href, init })
      return { ok: true, json: async () => ({ ok: true }) }
    },
  })
  assert.equal(result.ok, true)
  assert.equal(result.origin, 'session:session-abc')
  const body = JSON.parse(posts[0].init.body)
  assert.equal(body.origin, 'session:session-abc')
  assert.equal(body.cwd, '/ws/a')
  assert.match(body.label, /核验/)
  assert.equal(posts[0].init.headers.Origin, 'http://127.0.0.1:9')
})

test('installSessionDistill counts the current user/message that is not yet in eventAt', async () => {
  const listeners = {}
  const ctx = { on(name, fn) { listeners[name] = fn } }
  let n = 0
  installSessionDistill(ctx, { post: async () => { n += 1 } })
  const session = sessionOf({ id: 's-lag', cwd: '/ws', lines: ['一'] })
  const second = { type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '二' }] } }
  await listeners['session/event'](session, second)
  assert.equal(n, 1)
})

test('installSessionDistill posts once per session', async () => {
  const listeners = {}
  const ctx = { on(name, fn) { listeners[name] = fn } }
  let n = 0
  installSessionDistill(ctx, { post: async () => { n += 1 } })
  const session = sessionOf({ id: 's9', cwd: '/ws', lines: ['一', '二'] })
  const user = { type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '二' }] } }
  await listeners['session/event'](session, user)
  await listeners['session/event'](session, user)
  await listeners['workspace.archiveSession'](null, session)
  assert.equal(n, 1)
})
