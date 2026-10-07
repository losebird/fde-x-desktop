import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  appsForPack,
  briefingForPack,
  briefingFromPack,
  buildHandoffPack,
  handoffHasWork,
  handoffPackLine,
  parseHandoffPack,
  specForPack,
} from '../im-handoff.mjs'

const repoRoot = join(import.meta.dirname, '..', '..')

test('old v2 session pack still parses and has work', () => {
  const raw = JSON.stringify({
    v: 2,
    kind: 'handoff',
    title: '工作交接',
    sessionIds: ['s1'],
    sessions: [{ sessionId: 's1', title: '测', files: [{ name: 'session.v4.jsonl.zstd', size: 12, data: 'aa' }] }],
    fileIds: ['notes.md'],
  })
  const parsed = parseHandoffPack(raw)
  assert.equal(parsed.kind, 'handoff')
  assert.equal(handoffHasWork(parsed), true)
  assert.equal(briefingFromPack(parsed), null)
})

test('apps and briefing bags round-trip on the same MIME', () => {
  const pack = buildHandoffPack({
    title: '工作交接',
    workspace: 'fdex',
    sessionIds: [],
    sessions: [],
    fileIds: [],
    apps: [{
      slug: 'item-log',
      name: '台账',
      status: 'active',
      spec: { spec: 'fde-app/v1', slug: 'item-log', name: '台账', _workspaceCwd: '/src/ws' },
    }],
    briefing: {
      sections: [{ id: 'tasks-today', type: 'tasks', enabled: true }],
      schedule: { at: '08:30', days: [1, 2, 3, 4, 5], onOpen: true },
      delivery: { peerId: 'pk_jia' },
    },
  })
  assert.equal(pack.kind, 'handoff')
  assert.equal(pack.v, 2)
  assert.equal(pack.apps[0].spec._workspaceCwd, undefined)
  assert.equal(pack.briefing.delivery, undefined)
  assert.equal(pack.briefing.schedule.at, '08:30')
  const parsed = parseHandoffPack(JSON.stringify(pack))
  assert.equal(handoffHasWork(parsed), true)
  assert.equal(parsed.apps[0].slug, 'item-log')
  const line = handoffPackLine({
    apps: parsed.apps,
    briefing: parsed.briefing,
  })
  assert.match(line, /1 个应用/)
  assert.match(line, /早报定义/)
  assert.doesNotMatch(line, /会话文件/)
})

test('IMWorkspace continueHandoff occupies four bags on one mouth', () => {
  const source = readFileSync(join(repoRoot, 'src/components/IMWorkspace.tsx'), 'utf8')
  assert.match(source, /from '@\/lib\/im-handoff'/)
  assert.match(source, /handoffHasWork/)
  assert.match(source, /createDeclarativeApp/)
  assert.match(source, /putDeclarativeAppSpec/)
  assert.match(source, /putBriefingDefinition/)
  assert.match(source, /delivery: \{ peerId: '' \}/)
  assert.match(source, /交接包里没有可复原的内容/)
  assert.doesNotMatch(source, /交接包里没有 AI 会话文件/)
  assert.match(source, /3\. 选择当前工作区应用/)
  assert.match(source, /4\. 早报定义/)
})

test('empty pack has no work; slug-less spec is dropped', () => {
  assert.equal(handoffHasWork(buildHandoffPack({})), false)
  assert.equal(specForPack({ name: 'x' }), null)
  assert.deepEqual(appsForPack([{ name: 'x', spec: { name: 'x' } }]), [])
  assert.equal(briefingForPack({ sections: [] }), null)
  assert.ok(briefingForPack({
    sections: [],
    schedule: { at: '08:30' },
    delivery: { peerId: 'pk' },
  }))
})
