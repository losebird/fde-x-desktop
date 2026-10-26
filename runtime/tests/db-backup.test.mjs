import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { openDatabase } from '../db.mjs'
import { restoreSqliteBackup, takeSqliteBackup } from '../db-backup.mjs'
import { fileURLToPath } from 'node:url'

const migrations = join(fileURLToPath(new URL('..', import.meta.url)), 'migrations')

test('takeSqliteBackup then restoreSqliteBackup round-trips a row', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-db-bak-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const live = join(dir, 'fde-workstation.sqlite')
  const db = openDatabase(live, migrations)
  db.prepare("INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at) VALUES (?, ?, '', 'active', '{}', ?, ?)").run(
    'ws_backup_probe',
    'probe-before',
    new Date().toISOString(),
    new Date().toISOString(),
  )
  const dest = takeSqliteBackup(db, live)
  db.prepare("UPDATE workspaces SET name = ? WHERE id = ?").run('probe-after', 'ws_backup_probe')
  db.close()
  restoreSqliteBackup(dest, live)
  const restored = openDatabase(live, migrations)
  const row = restored.prepare('SELECT name FROM workspaces WHERE id = ?').get('ws_backup_probe')
  assert.equal(row.name, 'probe-before')
  restored.close()
})

test('assertSqliteBackupPath rejects paths outside backups', async () => {
  const { assertSqliteBackupPath, sqliteBackupDir } = await import('../db-backup.mjs')
  const live = '/tmp/fde-workstation.sqlite'
  const ok = join(sqliteBackupDir(live), 'fde-workstation-ok.sqlite')
  assert.equal(assertSqliteBackupPath(live, ok), ok)
  assert.throws(() => assertSqliteBackupPath(live, '/tmp/evil.sqlite'), /backup_path_invalid/)
})
