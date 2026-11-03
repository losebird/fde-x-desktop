import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

function displayTitle(raw) {
  return String(raw || '').replace(/<\|[^|]*\|>/g, '').replace(/\s+/g, ' ').trim()
}

function noticeFromEvent(event) {
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {}
  if (event.type === 'task.done' && payload.source === 'session') {
    const title = displayTitle(payload.title)
    const sessionId = String(payload.sessionId || event.sessionId || '').trim()
    const cwd = String(payload.cwd || event.workspaceCwd || '').trim()
    return {
      title: title ? `会话完成：${title}` : '会话任务完成',
      href: 'ai',
      ...(sessionId ? { sessionId } : {}),
      ...(cwd ? { cwd } : {}),
      gate: 'done',
    }
  }
  if (event.type === 'task.changed' && payload.status === 'done') {
    const title = displayTitle(payload.title)
    return { title: title ? `任务完成：${title}` : '任务完成', href: 'plan', gate: 'done' }
  }
  if (event.type === 'ai.result.ready') return { title: '任务完成', href: 'ai', gate: 'done' }
  if (event.type === 'task.due.soon') {
    const title = displayTitle(payload.title)
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

test('session titles drop model end tokens', () => {
  const notice = noticeFromEvent({
    type: 'task.done',
    payload: { source: 'session', title: '测试<|eos|>', sessionId: 'session-a' },
  })
  assert.equal(notice.title, '会话完成：测试')
})

test('session turn-end becomes a session notice', () => {
  const notice = noticeFromEvent({
    type: 'task.done',
    sessionId: 'session-abc',
    payload: { source: 'session', title: '哈喽', sessionId: 'session-abc' },
  })
  assert.equal(notice.title, '会话完成：哈喽')
  assert.equal(notice.href, 'ai')
  assert.equal(notice.sessionId, 'session-abc')
})

test('session turn-end without a title still keeps the session id', () => {
  const notice = noticeFromEvent({
    type: 'task.done',
    sessionId: 'session-xyz',
    payload: { source: 'session', sessionId: 'session-xyz' },
  })
  assert.equal(notice.title, '会话任务完成')
  assert.equal(notice.sessionId, 'session-xyz')
})

test('due-soon becomes a plan notice', () => {
  const notice = noticeFromEvent({ type: 'task.due.soon', payload: { title: '写周报', dueAt: '2026-11-03' } })
  assert.equal(notice.title, '即将到期：写周报')
  assert.equal(notice.href, 'plan')
  assert.equal(notice.gate, 'due')
})

test('session notice lands the matching session', () => {
  const notice = noticeFromEvent({
    type: 'task.done',
    payload: { source: 'session', title: '房贷计算器', sessionId: 'session-loan' },
  })
  assert.equal(notice.sessionId, 'session-loan')
  assert.deepEqual(
    { panel: 'ai', sessionId: notice.sessionId },
    { panel: 'ai', sessionId: 'session-loan' },
  )
})

test('session notice carries the workspace path', () => {
  const notice = noticeFromEvent({
    type: 'task.done',
    payload: {
      source: 'session',
      title: '房贷计算器',
      sessionId: 'session-loan',
      cwd: '/Users/zxz/Documents/ai-project/fdex测试2',
    },
  })
  assert.equal(notice.cwd, '/Users/zxz/Documents/ai-project/fdex测试2')
})

test('mcp down becomes a connector notice', () => {
  const notice = noticeFromEvent({ type: 'mcp.health.changed', payload: { ok: false, serverName: 'playwright' } })
  assert.equal(notice.title, '连接器异常：playwright')
  assert.equal(notice.href, 'mcp')
})

test('packaged notices go through the desktop bridge, not in-page audio', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../src/lib/task-notify.ts'), 'utf8')
  const show = src.slice(src.indexOf('function showOsNotice'))
  assert.match(show, /desktop\?\.notify/)
  assert.match(show, /sessionId: notice.sessionId/)
  assert.match(show, /id,/)
  assert.ok(show.indexOf('desktop?.notify') < show.indexOf('playNoticeSound()'))
})

test('applyTaskNotice does not re-alert an event already in the bell', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../src/lib/task-notify.ts'), 'utf8')
  assert.match(src, /notifications.some\(\(row\) => row.id === rowId\)/)
})

test('event stream remembers since across app restarts', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../src/lib/events.ts'), 'utf8')
  assert.match(src, /localStorage.getItem\(SESSION_SINCE_KEY\)/)
  assert.match(src, /localStorage.setItem\(SESSION_SINCE_KEY/)
  assert.doesNotMatch(src, /sessionStorage.setItem\(SESSION_SINCE_KEY/)
})

test('activateOsNotice marks the bell row read and lands the session', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../src/lib/notify-inbox.ts'), 'utf8')
  assert.match(src, /function activateOsNotice/)
  assert.match(src, /markNotifRead\(id\)/)
  assert.match(src, /openRef\(landNoticeHref/)
})
