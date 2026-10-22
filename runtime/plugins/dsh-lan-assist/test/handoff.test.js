import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  HANDOFF_MIME,
  HANDOFF_NAME,
  isHandoffItem,
  packFromEvents,
  parsePack,
  toAttach,
  digestOf,
  seedEventsOf,
  routeOf,
  absCwd,
  fileNamesOf,
  createHandoff,
  speakPackMiss,
  mentionedPaths,
  resolveUnder,
  listPicks,
  readPick,
  writePick,
  groupPicks,
} from '../handoff.js'
import { detectPoison } from '../catalog.js'
import { canAdopt } from '../dock.js'
import { requestPublic } from '../view.js'
import { createSecretary } from '../secretary.js'
import { emptyState } from '../store.js'
import { dispatch } from '../http.js'
import { afterHandshake } from './pair-finish.js'

function eventsOf(turns) {
  return turns.map((row) => (
    row.role === 'assistant'
      ? { type: 'assistant/message', data: { content: [{ type: 'text', text: row.text }] } }
      : {
        type: 'user/message',
        data: {
          source: { kind: 'user' },
          content: [{ type: 'text', text: row.text }],
        },
      }
  ))
}

function memStore() {
  let state = emptyState()
  return {
    async get() { return state },
    async update(fn) {
      await fn(state)
      return state
    },
  }
}

test('pack keeps human and assistant text and drops tools, plugins, harness noise', () => {
  const pack = packFromEvents([
    { type: 'turn/start', data: {} },
    { type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '先切 10%' }] } },
    { type: 'tool/call', data: { name: 'bash', arguments: { command: 'rm -rf /' } } },
    { type: 'tool/result', data: { content: [{ type: 'text', text: 'secret-token' }] } },
    { type: 'assistant/message', data: { content: [{ type: 'text', text: '按 10% 切。' }] } },
    { type: 'user/message', data: { source: { kind: 'plugin', plugin: 'dsh-lan-assist' }, content: [{ type: 'text', text: '本机注入' }] } },
    { type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'Current runtime context. This snapshot' }] } },
    { type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '/export' }] } },
  ], { workspace: '/Users/ace/proj', at: 1 })
  assert.equal(pack.kind, 'handoff')
  assert.equal(pack.workspace, 'proj')
  assert.deepEqual(pack.turns.map((row) => row.role), ['user', 'assistant'])
  assert.equal(pack.turns[0].text, '先切 10%')
  assert.equal(pack.turns[1].text, '按 10% 切。')
  assert.doesNotMatch(JSON.stringify(pack), /secret-token/)
  assert.doesNotMatch(JSON.stringify(pack), /本机注入/)
})

test('attach roundtrip is base64 json and parse rejects junk', () => {
  const pack = packFromEvents(eventsOf([
    { role: 'user', text: '看灰度' },
    { role: 'assistant', text: '先切 10%' },
  ]), { title: '灰度' })
  const attach = toAttach(pack)
  assert.equal(attach.mime, HANDOFF_MIME)
  assert.equal(attach.name, HANDOFF_NAME)
  assert.ok(isHandoffItem(attach))
  assert.ok(!isHandoffItem({ name: '发票.pdf', mime: 'application/pdf' }))
  const back = parsePack(attach.data)
  assert.equal(back.title, pack.title)
  assert.equal(back.turns.length, 2)
  assert.equal(parsePack('not-json'), null)
  assert.equal(parsePack(Buffer.from(JSON.stringify({ v: 9, kind: 'handoff', turns: [{ role: 'user', text: 'x' }] }), 'utf8').toString('base64')), null)
  assert.equal(parsePack(Buffer.from(JSON.stringify({ v: 1, kind: 'handoff', turns: [] }), 'utf8').toString('base64')), null)
})

test('seedEventsOf restores human and assistant turns as a closed session log', () => {
  const pack = packFromEvents(eventsOf([
    { role: 'user', text: '先切 10%' },
    { role: 'assistant', text: '按 10% 切。' },
    { role: 'user', text: '再看灰度' },
  ]))
  const events = seedEventsOf(pack, { provider: 'openai', model: 'gpt-test' })
  assert.equal(events[0].seq, 0)
  assert.equal(events.at(-1).type, 'turn/end')
  events.forEach((row, i) => assert.equal(row.seq, i))
  const users = events.filter((row) => row.type === 'user/message')
  const assistants = events.filter((row) => row.type === 'assistant/message')
  assert.equal(users.length, 2)
  assert.equal(users[0].data.content[0].text, '先切 10%')
  assert.equal(users[0].data.source.kind, 'user')
  assert.equal(assistants.length, 1)
  assert.equal(assistants[0].data.message.content[0].text, '按 10% 切。')
  assert.equal(assistants[0].data.message.source.provider, 'openai')
  assert.equal(assistants[0].data.message.source.model, 'gpt-test')
  assert.ok(!events.some((row) => row.type === 'turn/start' && !events.some((end) => end.type === 'turn/end' && end.data.turn === row.data.turn)))
  assert.equal(detectPoison('先去过账'), true)
  assert.equal(routeOf({ options: { provider: 'openai', model: 'gpt-test' } }).model, 'gpt-test')
  assert.equal(routeOf({ options: { provider: 'openai' } }), null)
  assert.equal(absCwd('/tmp/lin'), '/tmp/lin')
  assert.equal(absCwd('lin'), '')
})

test('digestOf names what is asked and where it stopped', () => {
  const pack = packFromEvents(eventsOf([
    { role: 'user', text: '我们讨论一下给协助插件增加一个新功能：好友分享的 dsh 会话' },
    { role: 'assistant', text: '先做交接包，不跨机 fork。' },
    { role: 'user', text: '勾选面按目录分组' },
    { role: 'assistant', text: '目录可收起，点标题展开。' },
  ]), { workspace: '/Users/ace/dsh-lan-assist' })
  const letter = digestOf(pack)
  assert.match(letter, /^交接 · /)
  assert.match(letter, /dsh-lan-assist/)
  assert.match(letter, /4 轮/)
  assert.match(letter, /在问：勾选面按目录分组/)
  assert.match(letter, /做到哪了：目录可收起/)
  assert.ok(letter.length > 40)
})

test('file names on a letter skip the handoff json', () => {
  const names = fileNamesOf([
    { name: HANDOFF_NAME, mime: HANDOFF_MIME },
    { name: 'a.md' },
  ])
  assert.deepEqual(names, ['a.md'])
})

test('canAdopt stays closed on an unopened handoff letter', () => {
  const req = {
    kind: 'incoming',
    excerpt: '先切 10%',
    attachments: [{ name: HANDOFF_NAME, mime: HANDOFF_MIME }],
  }
  assert.equal(canAdopt(req), false)
  assert.equal(canAdopt({ kind: 'incoming', excerpt: '先切 10%', attachments: [] }), true)
})

test('requestPublic marks a letter with a handoff attach', () => {
  const pub = requestPublic({
    id: 'req_1',
    kind: 'incoming',
    excerpt: '先切 10%',
    attachments: [{ name: HANDOFF_NAME, mime: HANDOFF_MIME, hasData: true }],
  })
  assert.equal(pub.handoff, true)
  assert.equal(requestPublic({ id: 'req_2', kind: 'incoming', excerpt: 'hi', attachments: [] }).handoff, false)
})

test('packSession and continueHandoff go through the secretary without waking a model here', async () => {
  const events = eventsOf([
    { role: 'user', text: '先切 10%' },
    { role: 'assistant', text: '按 10% 切。' },
  ])
  const box = { A: null, B: null }
  const sendA = async (_door, frame) => {
    if (frame.type === 'hello') return box.B.acceptHello(frame, '10.0.0.1:9527')
    if (frame.type === 'envelope') return box.B.receiveEnvelope(frame, await box.B.peerFor(frame.from))
    return { ok: true }
  }
  const sendB = async (_door, frame) => {
    if (frame.type === 'hello') return box.A.acceptHello(frame, '10.0.0.2:9527')
    if (frame.type === 'envelope') return box.A.receiveEnvelope(frame, await box.A.peerFor(frame.from))
    return { ok: true }
  }
  const now = () => 1_700_000_000_000
  const writeSlip = async () => ({ ok: true, path: ':mem:' })
  box.A = createSecretary({
    store: memStore(),
    now,
    send: sendA,
    writeSlip,
    readSession: async () => ({ events, cwd: '/tmp/proj', title: '灰度' }),
  })
  box.B = createSecretary({ store: memStore(), now, send: sendB, writeSlip })
  await box.A.setDisplayName('Ace')
  await box.B.setDisplayName('林督')
  await box.B.mintPairCode()
  const code = (await box.B.snapshot()).pairCode.code
  const hs = await box.A.handshake({ peerCode: code, door: '10.0.0.2:9527' })
  assert.equal(hs.ok, true)
  await afterHandshake(box.A, box.B, hs)
  const packed = await box.A.packSession('sess-gray')
  assert.equal(packed.ok, true)
  assert.equal(packed.attach.mime, HANDOFF_MIME)
  const empty = await createHandoff({
    readSession: async () => ({ events: [] }),
    store: memStore(),
    now,
    snapshot: async () => ({}),
    note() {},
    catalogOf: () => [],
  }).packSession('sess-empty')
  assert.equal(empty.ok, false)
  assert.equal(empty.error, 'EMPTY_HANDOFF')
  assert.match(empty.hint, new RegExp(speakPackMiss().slice(0, 8)))

  const lin = (await box.A.snapshot()).peers[0]
  const composed = await box.A.compose({
    excerpt: packed.excerpt,
    to: [lin.id],
    sessionId: 'sess-gray',
    attachments: [packed.attach, { name: '方案.md', mime: 'text/markdown', data: Buffer.from('x').toString('base64'), size: 1 }],
  })
  assert.equal(composed.ok, true)
  await box.A.confirmSend(composed.requestId)
  const incoming = (await box.B.snapshot()).requests.find((row) => row.id === composed.requestId)
  assert.equal(incoming.handoff, true)
  const read = await box.B.readHandoff(incoming.id)
  assert.equal(read.ok, true)
  assert.equal(read.requestId, incoming.id)
  assert.equal(read.messageId, `${incoming.id}:v1`)
  const viaMsg = await box.B.readHandoff(read.messageId)
  assert.equal(viaMsg.ok, true)
  assert.equal(read.pack.turns.length, 2)
  assert.ok(read.files.includes('方案.md'))
  assert.ok(!read.files.includes(HANDOFF_NAME))

  const blocked = await box.B.continueHandoff({ requestId: incoming.id, sessionId: '' })
  assert.equal(blocked.ok, false)
  assert.equal(blocked.error, 'NO_SESSION')

  const continued = await dispatch(
    box.B,
    '/handoff/continue',
    { requestId: incoming.id, workspace: '/tmp/lin', fromSessionId: 'sess-lin' },
    undefined,
    { restoreHandoff: async () => ({ ok: true, sessionId: 'sess-new' }) },
  )
  assert.equal(continued.ok, true)
  assert.equal(continued.sessionId, 'sess-new')
  assert.equal(continued.followup, undefined)
  const again = await box.B.continueHandoff({ requestId: incoming.id, sessionId: 'sess-new' })
  assert.equal(again.ok, false)
  assert.equal(again.error, 'ALREADY_ADOPTED')
})

test('mentioned paths and resolveUnder stay inside the workspace', () => {
  assert.deepEqual(mentionedPaths([{ text: '改 `handoff.js` 和 client.js' }]), ['handoff.js', 'client.js'])
  const root = resolveUnder('/tmp/proj', 'src/a.js')
  assert.ok(root.endsWith('src/a.js') || root.endsWith('src\\a.js'))
  assert.equal(resolveUnder('/tmp/proj', '../etc/passwd'), '')
  const abs = resolveUnder('/tmp/proj', '/etc/passwd')
  assert.ok(abs.startsWith('/tmp/proj'))
  assert.ok(!abs.startsWith('/etc/'))
})

test('listPicks prefers mentioned files and skips junk dirs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-handoff-'))
  try {
    await writeFile(join(root, 'handoff.js'), 'export const x = 1\n')
    await writeFile(join(root, 'README.md'), '# hi\n')
    await mkdir(join(root, 'node_modules', 'x'), { recursive: true })
    await writeFile(join(root, 'node_modules', 'x', 'index.js'), 'nope\n')
    const picks = await listPicks(root, ['handoff.js'])
    assert.equal(picks[0].path, 'handoff.js')
    assert.ok(picks.some((row) => row.path === 'README.md'))
    assert.ok(!picks.some((row) => String(row.path).includes('node_modules')))
    const got = await readPick(root, 'README.md')
    assert.equal(got.ok, true)
    assert.equal(got.attach.name, 'README.md')
    assert.ok(got.attach.data)
    const denied = await readPick(root, '../README.md')
    assert.equal(denied.ok, false)
    assert.equal(denied.error, 'BAD_PATH')
    const saved = await writePick(root, 'README.md', '# edited\n')
    assert.equal(saved.ok, true)
    assert.equal(await readFile(join(root, 'README.md'), 'utf8'), '# edited\n')
    const escaped = await writePick(root, '../README.md', 'nope')
    assert.equal(escaped.ok, false)
    assert.equal(escaped.error, 'BAD_PATH')
    const missing = await writePick(root, 'nope.md', 'x')
    assert.equal(missing.ok, false)
    assert.equal(missing.error, 'NO_FILE')
    await mkdir(join(root, '.dsh', 'lan-assist'), { recursive: true })
    await writeFile(join(root, '.dsh', 'lan-assist', 'traces.projection.jsonl'), '{}\n')
    const locked = await writePick(root, '.dsh/lan-assist/traces.projection.jsonl', 'hack\n')
    assert.equal(locked.ok, false)
    assert.equal(locked.error, 'PATH')
    await mkdir(join(root, '.dsh', 'lan-assist', 'inbox-copies'), { recursive: true })
    await writeFile(join(root, '.dsh', 'lan-assist', 'inbox-copies', 'note.md'), 'old\n')
    const copy = await writePick(root, '.dsh/lan-assist/inbox-copies/note.md', 'new\n')
    assert.equal(copy.ok, true)
    assert.equal(await readFile(join(root, '.dsh', 'lan-assist', 'inbox-copies', 'note.md'), 'utf8'), 'new\n')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('groupPicks folders files by directory, root first', () => {
  const groups = groupPicks([
    { path: 'vocab/spoken.json', name: 'spoken.json', size: 2 },
    { path: 'handoff.js', name: 'handoff.js', size: 1 },
    { path: 'test/handoff.test.js', name: 'handoff.test.js', size: 3 },
    { path: 'vocab/spoken.js', name: 'spoken.js', size: 4 },
  ])
  assert.equal(groups[0].dir, '')
  assert.deepEqual(groups[0].rows.map((row) => row.name), ['handoff.js'])
  assert.equal(groups[1].dir, 'test')
  assert.equal(groups[2].dir, 'vocab')
  assert.deepEqual(groups[2].rows.map((row) => row.name), ['spoken.js', 'spoken.json'])
})

test('http dispatch packs and continues without inventing a followup adapter', async () => {
  const events = eventsOf([{ role: 'user', text: '看灰度' }])
  const store = memStore()
  const secretary = createSecretary({
    store,
    now: () => 1,
    readSession: async () => ({ events, cwd: '/tmp/p' }),
    writeSlip: async () => ({ ok: true, path: ':mem:' }),
  })
  const packed = await dispatch(secretary, '/handoff/pack', { sessionId: 's' })
  assert.equal(packed.ok, true)
  assert.ok(Array.isArray(packed.picks))
  const missed = await dispatch(secretary, '/handoff/continue', { requestId: 'nope', sessionId: 's' })
  assert.equal(missed.ok, false)
  const file = await dispatch(secretary, '/handoff/file', { sessionId: 's', path: '../x' })
  assert.equal(file.ok, false)
  const noCwd = await dispatch(secretary, '/workspace/save', { path: 'README.md', text: 'x' })
  assert.equal(noCwd.ok, false)
  assert.equal(noCwd.error, 'NO_CWD')
})
