import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { openDatabase } from '../db.mjs'
import {
  MAX_FILE_REVISIONS,
  listWorkspaceDocumentVersions,
  rollbackWorkspaceDocument,
  writeWorkspaceDocument,
} from '../workspace-file-document.mjs'

const migrations = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

function tempRoot() {
  const root = join(tmpdir(), `fde-filedoc-${process.pid}-${Date.now()}`)
  mkdirSync(join(root, 'ws'), { recursive: true })
  return root
}

test('write snapshots previous bytes and rollback restores them', async () => {
  const root = tempRoot()
  const db = openDatabase(join(root, 't.sqlite'), migrations)
  const cwd = join(root, 'ws')
  const dshHome = join(root, 'home')
  try {
    const first = await writeWorkspaceDocument({
      db, dshHome, root: cwd, relPath: 'a.md', bytes: Buffer.from('one', 'utf8'),
    })
    assert.equal(first.versions.length, 0)
    assert.equal(readFileSync(join(cwd, 'a.md'), 'utf8'), 'one')
    const second = await writeWorkspaceDocument({
      db, dshHome, root: cwd, relPath: 'a.md', bytes: Buffer.from('two', 'utf8'), note: '保存前',
    })
    assert.equal(second.versions.length, 1)
    assert.equal(second.versions[0].note, '保存前')
    assert.equal(readFileSync(join(cwd, 'a.md'), 'utf8'), 'two')
    const rolled = await rollbackWorkspaceDocument({
      db, dshHome, root: cwd, relPath: 'a.md', versionId: second.versions[0].id,
    })
    assert.equal(readFileSync(join(cwd, 'a.md'), 'utf8'), 'one')
    assert.equal(rolled.versions.length, 2)
  } finally {
    db.close()
    rmSync(root, { recursive: true, force: true })
  }
})

test('identical hash is not snapshotted twice and fifo keeps 20', async () => {
  const root = tempRoot()
  const db = openDatabase(join(root, 't.sqlite'), migrations)
  const cwd = join(root, 'ws')
  const dshHome = join(root, 'home')
  try {
    await writeWorkspaceDocument({ db, dshHome, root: cwd, relPath: 'n.txt', bytes: Buffer.from('v0') })
    await writeWorkspaceDocument({ db, dshHome, root: cwd, relPath: 'n.txt', bytes: Buffer.from('v0') })
    assert.equal(listWorkspaceDocumentVersions(db, { cwd, relPath: 'n.txt' }).length, 0)
    for (let i = 1; i <= 22; i += 1) {
      await writeWorkspaceDocument({
        db, dshHome, root: cwd, relPath: 'n.txt', bytes: Buffer.from(`v${i}`),
      })
    }
    const versions = listWorkspaceDocumentVersions(db, { cwd, relPath: 'n.txt' })
    assert.equal(versions.length, MAX_FILE_REVISIONS)
  } finally {
    db.close()
    rmSync(root, { recursive: true, force: true })
  }
})

test('write rejects path escape', async () => {
  const root = tempRoot()
  const db = openDatabase(join(root, 't.sqlite'), migrations)
  try {
    await assert.rejects(() => writeWorkspaceDocument({
      db, dshHome: join(root, 'home'), root: join(root, 'ws'), relPath: '../x.txt', bytes: Buffer.from('x'),
    }), /越出/)
  } finally {
    db.close()
    rmSync(root, { recursive: true, force: true })
  }
})
