import './support/no-stray-processes.mjs'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDiskSessionPersistence } from '../semantic-os-session-persist.mjs'
import { createExtract } from '../plugins/dsh-semantic-os/extract-llm.js'

test('disk persistence lists and reads jsonl sessions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-sem-sess-'))
  const dir = join(root, 'proj', 'session-abc')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'session.jsonl'), [
    JSON.stringify({ type: 'session/header', id: 'session-abc', cwd: '/tmp/ws', seq: 0 }),
    JSON.stringify({ type: 'user/message', seq: 1, data: { source: { kind: 'user' }, content: 'hello graph' } }),
    JSON.stringify({ type: 'assistant/message', seq: 2, data: { message: { content: 'ok' } } }),
    '',
  ].join('\n'), 'utf8')
  try {
    const persistence = createDiskSessionPersistence(root)
    const listed = await persistence.list()
    assert.equal(listed.some((row) => row.id === 'session-abc' && row.cwd === '/tmp/ws'), true)
    const packed = await persistence.readFrom('session-abc', 1)
    assert.equal(packed.events.length, 2)
    assert.equal(packed.events[0].seq, 1)
    const later = await persistence.readFrom('session-abc', 2)
    assert.equal(later.events.length, 1)
    assert.equal(later.events[0].seq, 2)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('extract without a DSH key skips instead of throwing', async () => {
  const extract = createExtract({})
  const got = await extract.extract('张三把方案定了')
  assert.equal(Array.isArray(got.entities), true)
  assert.equal(got.via === 'skip' || got.via === 'cache' || got.via === 'dsh-llm', true)
})
