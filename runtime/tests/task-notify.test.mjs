import assert from 'node:assert/strict'
import test from 'node:test'

function noticeFromEvent(event) {
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {}
  if (event.type === 'task.done' && payload.source === 'session') {
    const title = String(payload.title || '').trim()
    return { title: title ? `会话完成：${title}` : '会话任务完成', href: 'ai', gate: 'done' }
  }
  if (event.type === 'task.changed' && payload.status === 'done') {
    const title = String(payload.title || '').trim()
    return { title: title ? `任务完成：${title}` : '任务完成', href: 'plan', gate: 'done' }
  }
  if (event.type === 'ai.result.ready') return { title: '任务完成', href: 'ai', gate: 'done' }
  if (event.type === 'task.due.soon') {
    const title = String(payload.title || '').trim()
    return { title: title ? `即将到期：${title}` : '任务即将到期', href: 'plan', gate: 'due' }
  }
  if (event.type === 'mcp.health.changed' && payload.ok === false) {
    const name = String(payload.serverName || '').trim()
    return { title: name ? `连接器异常：${name}` : '连接器异常', href: 'mcp', gate: 'mcp' }
  }
  return null
}

test('task.changed done becomes a plan notice', () => {
  const notice = noticeFromEvent({ type: 'task.changed', payload: { status: 'done', title: '写周报' } })
  assert.equal(notice.title, '任务完成：写周报')
  assert.equal(notice.href, 'plan')
})

test('todo updates do not notify', () => {
  assert.equal(noticeFromEvent({ type: 'task.changed', payload: { status: 'todo', title: '写周报' } }), null)
})

test('session turn-end becomes a session notice', () => {
  const notice = noticeFromEvent({ type: 'task.done', payload: { source: 'session', title: '哈喽' } })
  assert.equal(notice.title, '会话完成：哈喽')
  assert.equal(notice.href, 'ai')
})

test('due-soon becomes a plan notice', () => {
  const notice = noticeFromEvent({ type: 'task.due.soon', payload: { title: '写周报', dueAt: '2026-11-03' } })
  assert.equal(notice.title, '即将到期：写周报')
  assert.equal(notice.href, 'plan')
  assert.equal(notice.gate, 'due')
})

test('mcp down becomes a connector notice', () => {
  const notice = noticeFromEvent({ type: 'mcp.health.changed', payload: { ok: false, serverName: 'playwright' } })
  assert.equal(notice.title, '连接器异常：playwright')
  assert.equal(notice.href, 'mcp')
})
