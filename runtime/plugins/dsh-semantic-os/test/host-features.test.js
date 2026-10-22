import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createBridge, deleteBridge, listBridges, listBridgePeers, BRIDGE_PROTOCOL, PLUGIN_VERSION } from '../bridge.js'
import { addAnnotation, listAnnotations } from '../annotations.js'
import { listLeftIds, listPeople, savePeople } from '../people.js'
import { registerGate } from '../gate.js'

async function withHome(fn) {
  const previous = process.env.DSH_HOME
  const home = await mkdtemp(join(tmpdir(), 'dsos-host-features-'))
  process.env.DSH_HOME = home
  try { await fn(home) } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    await rm(home, { recursive: true, force: true })
  }
}

test('bridge: create, list by cwd, delete, and version mismatch', async () => {
  await withHome(async () => {
    const created = await createBridge({ sourceCwd: '/a', targetCwd: '/b', sourceNode: 'n1', targetNode: 'n2' })
    assert.equal(created.ok, true)
    assert.equal(created.link.protocol, BRIDGE_PROTOCOL)
    const listA = await listBridges('/a')
    assert.equal(listA.length, 1)
    const listC = await listBridges('/c')
    assert.equal(listC.length, 0)
    const del = await deleteBridge(created.link.id, '/a')
    assert.equal(del.ok, true)
    assert.equal((await listBridges('/a')).length, 0)
    const mismatch = await createBridge({ sourceCwd: '/a', targetCwd: '/b', sourceNode: 'n1', targetNode: 'n2', pluginVersion: '9.9.9' })
    assert.equal(mismatch.ok, false)
    assert.equal(mismatch.error, 'version_mismatch')
    const byCwd = await createBridge({ sourceCwd: '/here', targetCwd: '/there' })
    assert.equal(byCwd.ok, true)
    assert.equal(byCwd.link.sourceNode, 'workspace')
    assert.equal(byCwd.link.targetNode, 'workspace')
  })
})

test('bridge: listBridgePeers returns the other cwd once', async () => {
  await withHome(async () => {
    await createBridge({ sourceCwd: '/here', targetCwd: '/there', sourceNode: 'a', targetNode: 'b' })
    await createBridge({ sourceCwd: '/there', targetCwd: '/here', sourceNode: 'c', targetNode: 'd' })
    assert.deepEqual(await listBridgePeers('/here'), ['/there'])
    assert.deepEqual(await listBridgePeers('/there'), ['/here'])
    assert.deepEqual(await listBridgePeers('/none'), [])
  })
})

test('annotations: add, list, and input validation', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'dsos-annotations-'))
  try {
    assert.equal((await addAnnotation(cwd, '', '')).ok, false)
    const added = await addAnnotation(cwd, 'changed the schema', '/src/x.ts')
    assert.equal(added.ok, true)
    assert.equal(added.items.length, 1)
    const listed = await listAnnotations(cwd)
    assert.equal(listed.ok, true)
    assert.equal(listed.items.length, 1)
    assert.equal(listed.items[0].note, 'changed the schema')
  } finally { await rm(cwd, { recursive: true, force: true }) }
})

test('people: save, list, and left-ids for collaboration', async () => {
  await withHome(async () => {
    const saved = await savePeople([
      { id: 'u1', displayName: 'Alice', status: 'active' },
      { id: 'u2', displayName: 'Bob', status: 'left' },
      { id: 'u3', displayName: 'Carol', status: 'left', businessAccount: 'biz-c' },
      { displayName: '', status: 'active' },
    ])
    assert.equal(saved.ok, true)
    assert.equal(saved.people.length, 3)
    const listed = await listPeople()
    assert.equal(listed.people.length, 3)
    const left = await listLeftIds()
    assert.deepEqual(left.ids.sort(), ['u2', 'u3'])
  })
})

test('gate: hard gates deny when not ready, no cwd, or export escapes cwd', async () => {
  let handler = null
  const ctx = { on: (event, h) => { if (event === 'tools/pre-execute') handler = h } }
  const sidecar = { snapshot: () => ({ ready: false, port: null }) }
  registerGate(ctx, {
    sidecar,
    getConfig: () => ({}),
    policy: async () => ({ ok: true }),
  })
  assert.ok(handler, 'gate registered')

  const exec = (name, args, cwd) => ({ name, arguments: args || {}, agent: { session: { header: { cwd } } } })
  const next = async () => ({ kind: 'allow' })

  const notReady = await handler(exec('add_entity', {}, '/ws'), next)
  assert.equal(notReady.kind, 'deny')
  assert.equal(notReady.reason, 'gate.hard.notReady')

  const briefNotReady = await handler(exec('brief_for_decision', { scenario: '发版' }, '/ws'), next)
  assert.equal(briefNotReady.kind, 'deny')
  assert.equal(briefNotReady.reason, 'gate.hard.notReady')

  sidecar.snapshot = () => ({ ready: true, port: 12345 })
  const noCwd = await handler(exec('add_entity', {}, ''), next)
  assert.equal(noCwd.kind, 'deny')
  assert.equal(noCwd.reason, 'gate.hard.noCwd')

  const escape = await handler(exec('export_graph', { path: '/etc/passwd' }, '/ws'), next)
  assert.equal(escape.kind, 'ask')
  assert.match(escape.reason, /gate\.hard\.exportOutsideCwd/)

  const noEvidence = await handler(exec('record_decision', { outcome: '发' }, '/ws'), next)
  assert.equal(noEvidence.kind, 'deny')
  assert.equal(noEvidence.reason, 'gate.hard.decisionNeedsBrief')

  const withEvidence = await handler(exec('record_decision', { because: ['n1'] }, '/ws'), next)
  assert.equal(withEvidence.kind, 'allow')

  const liveNoReceipt = await handler(exec('record_decision', {
    status: '已生效',
    nod_kind: '业务过账',
    because: ['n1'],
    leads_to: ['n2'],
  }, '/ws'), next)
  assert.equal(liveNoReceipt.kind, 'deny')
  assert.equal(liveNoReceipt.reason, 'gate.hard.decisionNeedsReceipt')

  const liveNoNod = await handler(exec('record_decision', {
    status: '已生效',
    because: ['n1'],
    leads_to: ['n2'],
    receipt_id: 'rcp-12',
  }, '/ws'), next)
  assert.equal(liveNoNod.kind, 'deny')
  assert.equal(liveNoNod.reason, 'gate.hard.nodNotPosting')

  const liveOk = await handler(exec('record_decision', {
    status: '已生效',
    nod_kind: '业务过账',
    because: ['n1'],
    leads_to: ['n2'],
    receipt_id: 'rcp-12',
  }, '/ws'), next)
  assert.equal(liveOk.kind, 'allow')

  const consent = await handler(exec('record_decision', {
    status: '已生效',
    nod_kind: '会签同意',
    because: ['n1'],
    leads_to: ['n2'],
    receipt_id: 'rcp-12',
  }, '/ws'), next)
  assert.equal(consent.kind, 'deny')
  assert.equal(consent.reason, 'gate.hard.nodNotPosting')

  const erase = await handler(exec('erase_ledger', { kind: 'pii' }, '/ws'), next)
  assert.equal(erase.kind, 'deny')
  assert.equal(erase.reason, 'gate.hard.eraseNeedsNod')

  const emptyVocab = await handler(exec('upsert_workspace_vocab', { name: '本机业务单据型' }, '/ws'), next)
  assert.equal(emptyVocab.kind, 'deny')
  assert.equal(emptyVocab.reason, 'gate.hard.vocabNeedsConcepts')

  const vocabOk = await handler(exec('upsert_workspace_vocab', {
    name: '本机业务单据型 · 单据',
    concepts: [{ id: 'purchase-order', label: '采购单', fields: ['单号', '状态'], can: ['现查', '过审'] }],
  }, '/ws'), next)
  assert.equal(vocabOk.kind, 'allow')

  const sourceNoNod = await handler(exec('source_memory_card', { id: 'memory:1', source: 'session:s1' }, '/ws'), next)
  assert.equal(sourceNoNod.kind, 'deny')
  assert.equal(sourceNoNod.reason, 'gate.hard.memoryNeedsNod')
  const renewNoNod = await handler(exec('renew_memory_card', { id: 'memory:1' }, '/ws'), next)
  assert.equal(renewNoNod.kind, 'deny')
  assert.equal(renewNoNod.reason, 'gate.hard.memoryNeedsNod')
  const muteNoNod = await handler(exec('mute_health_kind', { kind: '报告噪音' }, '/ws'), next)
  assert.equal(muteNoNod.kind, 'deny')
  assert.equal(muteNoNod.reason, 'gate.hard.memoryNeedsNod')
  const sourceOk = await handler(exec('source_memory_card', { id: 'memory:1', source: 'session:s1', nodded: true }, '/ws'), next)
  assert.equal(sourceOk.kind, 'allow')
})
