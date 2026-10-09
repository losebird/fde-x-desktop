import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { seedDshWorkspaceStore, seedDshWorkspaceStoreSync, workspaceStoreHasRows } from '../dsh-workspace-seed.mjs'

const emptyStore = JSON.stringify({
  unit: { name: 'workspace', version: 2 },
  global: { initialized: true, workspaceIds: [], archivedSessionIds: [], pinnedSessionIds: [] },
  tables: { workspaces: {} },
})

const filledStore = JSON.stringify({
  unit: { name: 'workspace', version: 2 },
  global: { initialized: true, workspaceIds: ['ws-a'], archivedSessionIds: [], pinnedSessionIds: [] },
  tables: { workspaces: { 'ws-a': { path: '/tmp/proj', title: 'proj' } } },
})

test('workspaceStoreHasRows reads Host catalog', () => {
  assert.equal(workspaceStoreHasRows(emptyStore), false)
  assert.equal(workspaceStoreHasRows(filledStore), true)
  assert.equal(workspaceStoreHasRows('not-json'), false)
})

test('seed copies fde home over empty dest store', async () => {
  const root = join(tmpdir(), `fde-ws-seed-${process.pid}-${Date.now()}`)
  const fde = join(root, 'fde')
  const destHome = join(root, 'desktop-home')
  mkdirSync(join(fde, 'storages'), { recursive: true })
  mkdirSync(join(destHome, 'storages'), { recursive: true })
  writeFileSync(join(fde, 'storages', 'workspace.json'), filledStore)
  writeFileSync(join(destHome, 'storages', 'workspace.json'), emptyStore)
  try {
    const first = await seedDshWorkspaceStore(destHome, {
      officialHome: join(root, 'missing-official'),
      fdeHome: fde,
    })
    assert.equal(first.copied, true)
    assert.equal(readFileSync(first.dest, 'utf8'), filledStore)
    const again = seedDshWorkspaceStoreSync(destHome, { fdeHome: fde, officialHome: join(root, 'missing-official') })
    assert.equal(again.copied, false)
    assert.equal(again.reason, 'already')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('seed prefers fde home over official', async () => {
  const root = join(tmpdir(), `fde-ws-pref-${process.pid}-${Date.now()}`)
  const official = join(root, 'official')
  const fde = join(root, 'fde')
  const destHome = join(root, 'desktop-home')
  mkdirSync(join(official, 'storages'), { recursive: true })
  mkdirSync(join(fde, 'storages'), { recursive: true })
  writeFileSync(join(official, 'storages', 'workspace.json'), JSON.stringify({
    global: { workspaceIds: ['off'] },
    tables: { workspaces: { off: { title: 'official' } } },
  }))
  writeFileSync(join(fde, 'storages', 'workspace.json'), JSON.stringify({
    global: { workspaceIds: ['fde'] },
    tables: { workspaces: { fde: { title: 'fde' } } },
  }))
  try {
    const seeded = await seedDshWorkspaceStore(destHome, { officialHome: official, fdeHome: fde })
    assert.equal(seeded.copied, true)
    assert.match(readFileSync(seeded.dest, 'utf8'), /"fde"/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
