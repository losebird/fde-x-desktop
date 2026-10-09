import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadOrigin } from '../routes/corpus.mjs'

const root = join(import.meta.dirname, '../..')

test('attachToCurrentAi is the file send mouth', () => {
  const turn = readFileSync(join(root, 'src/lib/current-turn.ts'), 'utf8')
  assert.match(turn, /export async function attachToCurrentAi/)
  assert.match(turn, /currentAiTarget\(\)/)
  assert.match(turn, /\/api\/v1\/files\/raw/)
  assert.match(turn, /sink\.attach/)
  const files = readFileSync(join(root, 'src/pages/Files.tsx'), 'utf8')
  assert.match(files, /attachToCurrentAi/)
  assert.match(files, /sendToCurrentAi\(current\)/)
  assert.match(files, /sendToCurrentAi\(f\)/)
  assert.doesNotMatch(files, /fde-x-attach-file/)
  const ai = readFileSync(join(root, 'src/pages/AI.tsx'), 'utf8')
  assert.match(ai, /attachToCurrentAi/)
  assert.match(ai, /attach: \(opts\) =>/)
  assert.doesNotMatch(ai, /fde-x-attach-file/)
})

test('memory origin session lands via classifyHitId before corpus', () => {
  const mem = readFileSync(join(root, 'src/pages/Memory.tsx'), 'utf8')
  assert.match(mem, /function openOriginLand/)
  assert.match(mem, /classifyHitId\(id\)/)
  assert.match(mem, /land\.class === 'session'/)
  assert.match(mem, /openOriginLand\(id, setNote\)/)
  assert.match(mem, /openOriginLand\(hitId, setNote\)/)
})

test('§15.7 empty draft create uses name and goal and createBusinessApp', () => {
  const wizard = readFileSync(join(root, 'src/components/apps/AppCreateWizard.tsx'), 'utf8')
  assert.match(wizard, /createBusinessApp/)
  assert.match(wizard, /kind: 'ai-generated-draft'/)
  assert.match(wizard, /screens: \[\]/)
  assert.match(wizard, /创建草稿/)
  assert.match(wizard, /currentAiTarget\(\)/)
  const data = readFileSync(join(root, 'src/pages/Data.tsx'), 'utf8')
  assert.match(data, /hasAiSession \? '创建应用' : '创建草稿'/)
  assert.match(data, /个草稿/)
  assert.doesNotMatch(data, /个由 AI 创建/)
})

test('§15.3 remember card body carries peerId and messageId', () => {
  const im = readFileSync(join(root, 'src/components/IMWorkspace.tsx'), 'utf8')
  assert.match(im, /peerId \$\{peerId\}/)
  assert.match(im, /messageId \$\{message\.id\}/)
})

test('§15.8 briefing connector miss is a dash stat', () => {
  const source = readFileSync(join(root, 'runtime/briefing/collectors.mjs'), 'utf8')
  assert.match(source, /function noConnectorSection/)
  assert.match(source, /value: '—'/)
  assert.match(source, /noConnectorSection\(def\)/)
})

test('memory card with session origin lands on that session', async () => {
  const resolved = await loadOrigin({
    db: {},
    url: { searchParams: new URLSearchParams() },
    aiRuntime: {
      semanticOs: async () => ({
        cards: [{ id: 'memory:c1', cue: '摘录', metadata: { origin: 'session:session-abc' } }],
      }),
    },
  }, 'memory:c1')
  assert.equal(resolved.ok, true)
  assert.equal(resolved.href.panel, 'ai')
  assert.equal(resolved.href.sessionId, 'session-abc')
  assert.equal(resolved.origin, 'session:session-abc')
})
