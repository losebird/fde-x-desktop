import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createWorkspaceAuthority } from '../workspace-authority.js'

test('workspace authority accepts live and persisted session cwd only', async () => {
  const live = await mkdtemp(join(tmpdir(), 'dsos-live-'))
  const persisted = await mkdtemp(join(tmpdir(), 'dsos-persisted-'))
  const foreign = await mkdtemp(join(tmpdir(), 'dsos-foreign-'))
  try {
    const authority = createWorkspaceAuthority()
    authority.setSessions({ list: () => [{ header: { cwd: live } }] })
    authority.setPersistence({ list: async () => [{ cwd: persisted }] })
    assert.equal(await authority.allows(live), true)
    assert.equal(await authority.allows(persisted), true)
    assert.equal(await authority.allows(foreign), false)
    assert.equal(await authority.allows(''), false)
  } finally {
    await Promise.all([live, persisted, foreign].map((path) => rm(path, { recursive: true, force: true })))
  }
})

test('workspace authority canonicalizes symlink-equivalent paths', async (t) => {
  const { symlink } = await import('node:fs/promises')
  const root = await mkdtemp(join(tmpdir(), 'dsos-authority-'))
  const real = join(root, 'real')
  const alias = join(root, 'alias')
  const { mkdir } = await import('node:fs/promises')
  await mkdir(real)
  try {
    await symlink(real, alias, 'dir')
  } catch (error) {
    await rm(root, { recursive: true, force: true })
    t.skip(`symlink unavailable: ${error.message}`)
    return
  }
  try {
    const authority = createWorkspaceAuthority()
    authority.setSessions({ list: () => [{ header: { cwd: alias } }] })
    assert.equal(await authority.allows(real), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
