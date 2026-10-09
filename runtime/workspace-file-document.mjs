import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { createId } from './db.mjs'
import { fdeRunDirectory } from './config.mjs'

export const MAX_FILE_REVISIONS = 20

export function fileRevisionBlobDir(dshHome) {
  return join(fdeRunDirectory(dshHome), 'file-revisions')
}

function sha256Of(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function normalizeCwd(root) {
  return resolve(String(root || ''))
}

function mapRevision(row) {
  return {
    id: row.id,
    versionNo: Number(row.version_no),
    ts: row.created_at,
    size: Number(row.size_bytes),
    note: row.note || '',
    sha256: row.sha256,
  }
}

export function listWorkspaceDocumentVersions(db, { cwd, relPath }) {
  const rows = db.prepare(`
    SELECT id, version_no, note, size_bytes, sha256, created_at
    FROM workspace_file_revisions
    WHERE cwd = ? AND rel_path = ?
    ORDER BY version_no DESC
  `).all(normalizeCwd(cwd), relPath)
  return rows.map(mapRevision)
}

async function pruneRevisions(db, blobDir, cwd, relPath) {
  const extra = db.prepare(`
    SELECT id, blob_name FROM workspace_file_revisions
    WHERE cwd = ? AND rel_path = ?
    ORDER BY version_no DESC
    LIMIT -1 OFFSET ?
  `).all(cwd, relPath, MAX_FILE_REVISIONS)
  const del = db.prepare('DELETE FROM workspace_file_revisions WHERE id = ?')
  const stillUsed = db.prepare('SELECT 1 FROM workspace_file_revisions WHERE blob_name = ? LIMIT 1')
  for (const row of extra) {
    del.run(row.id)
    if (!stillUsed.get(row.blob_name)) {
      const file = join(blobDir, row.blob_name)
      if (existsSync(file)) await unlink(file)
    }
  }
}

async function snapshotRevision(db, blobDir, cwd, relPath, bytes, note) {
  const hash = sha256Of(bytes)
  const last = db.prepare(`
    SELECT version_no, sha256 FROM workspace_file_revisions
    WHERE cwd = ? AND rel_path = ?
    ORDER BY version_no DESC LIMIT 1
  `).get(cwd, relPath)
  if (last && last.sha256 === hash) return
  const versionNo = last ? Number(last.version_no) + 1 : 1
  await mkdir(blobDir, { recursive: true })
  const blobPath = join(blobDir, hash)
  if (!existsSync(blobPath)) await writeFile(blobPath, bytes)
  db.prepare(`
    INSERT INTO workspace_file_revisions
      (id, cwd, rel_path, version_no, note, size_bytes, sha256, blob_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(createId('frev'), cwd, relPath, versionNo, note || '', bytes.length, hash, hash, new Date().toISOString())
  await pruneRevisions(db, blobDir, cwd, relPath)
}

async function readExisting(target) {
  try {
    return await readFile(target)
  } catch (error) {
    if (error && error.code === 'ENOENT') return null
    throw error
  }
}

export async function writeWorkspaceDocument({ db, dshHome, root, relPath, bytes, note }) {
  const cwd = normalizeCwd(root)
  const target = resolve(join(cwd, relPath))
  if (target !== cwd && !target.startsWith(cwd + sep)) throw new Error('路径越出工作区')
  const blobDir = fileRevisionBlobDir(dshHome)
  const previous = await readExisting(target)
  if (previous && previous.length && sha256Of(previous) !== sha256Of(bytes)) {
    await snapshotRevision(db, blobDir, cwd, relPath, previous, note || '保存前')
  }
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, bytes)
  return { path: relPath, versions: listWorkspaceDocumentVersions(db, { cwd, relPath }) }
}

export async function rollbackWorkspaceDocument({ db, dshHome, root, relPath, versionId }) {
  const cwd = normalizeCwd(root)
  const row = db.prepare(`
    SELECT id, blob_name, note FROM workspace_file_revisions
    WHERE cwd = ? AND rel_path = ? AND id = ?
  `).get(cwd, relPath, versionId)
  if (!row) throw new Error('没有这个版本')
  const blobDir = fileRevisionBlobDir(dshHome)
  const blobPath = join(blobDir, row.blob_name)
  const bytes = await readFile(blobPath)
  return writeWorkspaceDocument({ db, dshHome, root: cwd, relPath, bytes, note: '回滚前' })
}
