import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readSessionUserOrigin } from '../biz/session-origin-text.mjs'

test('session origin keeps user turns then assistant replies, skips dumps', async () => {
  const sessionRoot = '/tmp/fde-x-session-origin-assist'
  const sid = 'session-origin-assist'
  await rm(sessionRoot, { recursive: true, force: true }).catch(() => undefined)
  await mkdir(join(sessionRoot, 'ws', sid), { recursive: true })
  await writeFile(join(sessionRoot, 'ws', sid, 'session.v3.jsonl'), [
    JSON.stringify({ type: 'session/header', data: { id: sid, cwd: '/tmp/ws' } }),
    JSON.stringify({ type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '继续处理' }] } }),
    JSON.stringify({ type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '{"ok":true}' }] } }),
    JSON.stringify({
      type: 'assistant/message',
      data: { message: { content: [{ type: 'reasoning', text: 'think' }, { type: 'text', text: '单号无连字符，库里是 PO20250407926' }] } },
    }),
    JSON.stringify({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '{"ok":false}' }] } } }),
    '',
  ].join('\n'), 'utf8')
  const text = await readSessionUserOrigin(sid, { sessionRoot })
  assert.match(text, /继续处理/)
  assert.match(text, /库里是 PO20250407926/)
  assert.equal(text.includes('{"ok":true}'), false)
  assert.equal(text.includes('think'), false)
  assert.ok(text.indexOf('继续处理') < text.indexOf('库里是'))
})
