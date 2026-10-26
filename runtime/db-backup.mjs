import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'

const KEEP = 5

export function sqliteBackupDir(databasePath) {
  return join(dirname(resolve(databasePath)), 'backups')
}

export function nextSqliteBackupPath(databasePath, now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  return join(sqliteBackupDir(databasePath), `fde-workstation-${stamp}.sqlite`)
}

export function assertSqliteBackupPath(databasePath, candidate) {
  const root = sqliteBackupDir(databasePath)
  const file = resolve(String(candidate || ''))
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`
  if (!file.startsWith(prefix) || !file.endsWith('.sqlite')) {
    throw Object.assign(new Error('backup_path_invalid'), { code: 'backup_path_invalid' })
  }
  return file
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

export function takeSqliteBackup(db, databasePath, now = new Date()) {
  const dest = nextSqliteBackupPath(databasePath, now)
  mkdirSync(dirname(dest), { recursive: true })
  db.exec(`VACUUM INTO ${sqlString(dest)}`)
  pruneSqliteBackups(databasePath)
  return dest
}

export function listSqliteBackups(databasePath) {
  const dir = sqliteBackupDir(databasePath)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sqlite'))
    .map((name) => join(dir, name))
    .sort()
    .reverse()
}

function pruneSqliteBackups(databasePath) {
  const files = listSqliteBackups(databasePath)
  for (const extra of files.slice(KEEP)) {
    try { unlinkSync(extra) } catch { /* keep going */ }
  }
}

export function restoreSqliteBackup(backupPath, livePath) {
  const live = resolve(livePath)
  const source = resolve(backupPath)
  if (!existsSync(source)) {
    throw Object.assign(new Error('backup_missing'), { code: 'backup_missing' })
  }
  copyFileSync(source, live)
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${live}${suffix}`
    if (existsSync(sidecar)) {
      try { unlinkSync(sidecar) } catch { /* ignore */ }
    }
  }
  return live
}

export function backupPublicRow(file) {
  return { file, name: basename(file) }
}
