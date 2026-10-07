import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readBizSystems, writeBizSystems, upsertBizSystem, writeLookupOperate } from '../biz/systems-store.mjs'

test('profile biz-systems round-trip', async () => {
  const home = await mkdtemp(join(tmpdir(), 'fde-biz-sys-'))
  const aiRuntime = { dshHome: home, profileName: 'fde-x' }
  const empty = await readBizSystems(aiRuntime)
  assert.deepEqual(empty.systems, [])
  assert.deepEqual(empty.lookup.operate.skills, [])
  const saved = await upsertBizSystem(aiRuntime, {
    name: 'ERP',
    serverName: 'alpha',
    tools: { describe: 'desc', list: 'list' },
  })
  assert.equal(saved.systems.length, 1)
  assert.equal(saved.systems[0].name, 'ERP')
  const read = await readBizSystems(aiRuntime)
  assert.equal(read.systems[0].serverName, 'alpha')
  assert.deepEqual(read.lookup.operate.skills, [])
  const withSkills = await writeLookupOperate(aiRuntime, [{ name: 'pack', path: '/tmp/pack' }])
  assert.equal(withSkills.lookup.operate.skills[0].name, 'pack')
  assert.equal(withSkills.systems[0].name, 'ERP')
  const replaced = await writeBizSystems(aiRuntime, [])
  assert.equal(replaced.systems.length, 0)
  assert.equal(replaced.lookup.operate.skills[0].name, 'pack')
  await rm(home, { recursive: true, force: true })
})
