import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAppSource, parseAppSkills, recordsViaMcp, mcpToolLocalName } from '../biz/source.mjs'
import { parseBizSystem, parseBizSystemsFile, kindConnectionOf, mcpSourceFromSystem, skillsForOperate, enabledOperateSkills, assertKindOnConnection } from '../biz/systems.mjs'
import { kindsFromDescribePayload, sheetFromListPayload, receiptFromWritePayload } from '../biz/bound-shape.mjs'
import { mergeMemoryOperateCatalog } from '../biz/vocab-sheet.mjs'

test('parseAppSource local lookup system', () => {
  assert.deepEqual(parseAppSource(null).source, { type: 'local' })
  assert.equal(parseAppSource({ type: 'lookup' }).source.type, 'lookup')
  assert.equal(parseAppSource({ type: 'system' }).error, 'source.systemId 必填')
  assert.equal(parseAppSource({ type: 'system', systemId: 'sys_a' }).source.systemId, 'sys_a')
  assert.equal(recordsViaMcp({ source: { type: 'system', systemId: 'sys_a' } }), true)
  assert.equal(recordsViaMcp({ source: { type: 'local' } }), false)
})

test('parseBizSystem requires server tools', () => {
  const ok = parseBizSystem({
    name: 'ERP',
    serverName: 'alpha',
    tools: { describe: 'desc', list: 'list' },
  })
  assert.equal(ok.system.serverName, 'alpha')
  assert.match(parseBizSystem({ name: 'ERP', serverName: 'alpha' }).error, /describe/)
  const listed = parseBizSystemsFile({ systems: [ok.system] })
  assert.equal(listed.systems.length, 1)
})

test('kindConnectionOf defaults lookup', () => {
  assert.equal(kindConnectionOf({}).type, 'lookup')
  assert.equal(kindConnectionOf({ connection: 'lookup' }).type, 'lookup')
  assert.equal(kindConnectionOf({ connection: 'sys_a' }).systemId, 'sys_a')
})

test('skillsForOperate unions connection and spec', () => {
  const skills = skillsForOperate({
    connection: { operate: { skills: [{ name: 'a', path: '/tmp/a' }] } },
    spec: { skills: [{ name: 'b', path: '/tmp/b' }] },
  })
  assert.equal(skills.length, 2)
})

test('enabledOperateSkills fails when disabled', () => {
  const bag = [{ fields: { name: 'a', path: '/tmp/a', modelInvocable: false } }]
  const failed = enabledOperateSkills(bag, [{ name: 'a', path: '/tmp/a' }])
  assert.equal(failed.code, 'skill_disabled')
  const ok = enabledOperateSkills(
    [{ fields: { name: 'a', path: '/tmp/a', modelInvocable: true } }],
    [{ name: 'a', path: '/tmp/a' }],
  )
  assert.equal(ok.skills.length, 1)
})

test('assertKindOnConnection requires memory kind on that connection', () => {
  const vocab = { kinds: [{ kind: '订单', resource: 'orders', connection: 'sys_a' }] }
  assert.equal(assertKindOnConnection(vocab, '订单', 'sys_a').kind, '订单')
  assert.equal(assertKindOnConnection(vocab, '订单', 'lookup').code, 'no_kind')
  assert.equal(assertKindOnConnection({ kinds: [] }, '订单', 'sys_a').code, 'no_kind')
})

test('mcpSourceFromSystem fills mcp slots', () => {
  const source = mcpSourceFromSystem({
    serverName: 'alpha',
    tools: { describe: 'd', list: 'l', write: 'w' },
  })
  assert.equal(source.type, 'mcp')
  assert.equal(source.list.tool, 'l')
})

test('parseAppSkills requires absolute path', () => {
  assert.deepEqual(parseAppSkills(undefined).skills, [])
  assert.match(parseAppSkills([{ name: 'x', path: 'rel' }]).error, /绝对路径/)
})

test('mcpToolLocalName strips projected prefix', () => {
  assert.equal(mcpToolLocalName('mail', 'mcp__mail__search'), 'search')
})

test('mergeMemoryOperateCatalog drops catalog-only kinds', () => {
  const merged = mergeMemoryOperateCatalog(
    { kinds: [{ kind: 'KindA', connection: 'lookup', fields: ['no'] }], relations: [] },
    { kinds: [{ kind: 'KindA', fields: ['no', 'title'] }, { kind: 'KindB' }], catalogVersion: 'schema:1' },
  )
  assert.equal(merged.kinds.length, 1)
  assert.equal(merged.kinds[0].kind, 'KindA')
  assert.equal(merged.kinds[0].connection, 'lookup')
})

test('kindsFromDescribePayload maps collections and kinds', () => {
  const fromKinds = kindsFromDescribePayload({ kinds: [{ kind: '订单', fields: ['no'] }], catalogVersion: 'v1' })
  assert.equal(fromKinds.kinds[0].kind, '订单')
  assert.match(kindsFromDescribePayload('nope').error, /词表形/)
})

test('sheetFromListPayload reads rows items arrays', () => {
  const listed = sheetFromListPayload({ items: [{ id: '1', title: 'A' }] }, { kind: '订单' })
  assert.equal(listed.sheet.kind, '订单')
  assert.equal(listed.sheet.rows.length, 1)
})

test('receiptFromWritePayload reads ok receiptId', () => {
  const ok = receiptFromWritePayload({ ok: true, receiptId: 'r1', no: 'SO-1' })
  assert.equal(ok.receipt.receiptId, 'r1')
})
