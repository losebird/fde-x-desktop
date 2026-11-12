import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectUserLines,
  formatDistillLabel,
  installSessionDistill,
  postSessionDistill,
  shouldDistillSession,
} from '../session-distill.js'

function sessionOf({ id, cwd, preset, title, lines }) {
  const events = (lines || []).map((text) => ({
    type: 'user/message',
    data: { source: { kind: 'user' }, content: [{ type: 'text', text }] },
  }))
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
  assert.match(label, /会话收口 · 采购订单核验/)
  assert.match(label, /再补开票/)
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
})

test('installSessionDistill posts once per session', async () => {
  const listeners = {}
  const ctx = { on(name, fn) { listeners[name] = fn } }
  let n = 0
  installSessionDistill(ctx, { post: async () => { n += 1 } })
  const session = sessionOf({ id: 's9', cwd: '/ws', lines: ['一', '二'] })
  await listeners['session/after-prompt'](session)
  await listeners['session/after-prompt'](session)
  await listeners['workspace.archiveSession'](null, session)
  assert.equal(n, 1)
})
