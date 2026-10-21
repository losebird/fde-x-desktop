/**
 * Workspace SQLite ledger of local outgoing letters. Not live ERP.
 * Incoming letters stay in the mailbox; their workspace is the sender's.
 * Diary is for nod ingest. Graph facts stay 当时.
 * @module dsh-lan-assist/mail-proj
 */

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { openSqlite } from './sqlite.js'
import { clip } from './dock.js'
import { messageIdOf } from './conversation.js'
import { traceDir } from './traces.js'

export const MAIL_REL = '.dsh/lan-assist/mail.projection.md'
const CAP = 100
const CREATE = `CREATE TABLE IF NOT EXISTS mail (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT '',
  from_name TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  ref_kind TEXT NOT NULL DEFAULT '',
  no TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  message_id TEXT NOT NULL DEFAULT '',
  at INTEGER NOT NULL
)`

const dbs = new Map()

function pack(row) {
  const ref = row && row.ref && typeof row.ref === 'object' ? row.ref : {}
  const id = String((row && row.id) || '').trim()
  return {
    id,
    kind: String((row && row.kind) || 'outgoing').trim() || 'outgoing',
    from: String((row && (row.fromName || row.from)) || '').trim(),
    excerpt: clip(String((row && row.excerpt) || '').replace(/\d{8,}/g, '').replace(/\s+/g, ' '), 80),
    refKind: String((row && (row.refKind || row.ref_kind)) || ref.kind || '').trim(),
    no: String((row && row.no) || ref.no || '').trim(),
    sessionId: String((row && (row.sessionId || row.session_id)) || '').trim(),
    messageId: String((row && (row.messageId || row.message_id)) || '').trim() || messageIdOf(id, 'v1'),
    at: Number((row && (row.at || row.updatedAt)) || Date.now()),
  }
}

function render(rows) {
  const lines = ['# 信件投影', '', '本机发出的信。不是现查。进图要点头 ingest 本文件。', '']
  for (const row of rows) {
    const bits = [row.from || row.from_name, row.refKind || row.ref_kind, row.no, row.excerpt].filter(Boolean)
    if (row.id && bits.length) {
      const mid = row.messageId || messageIdOf(row.id, 'v1')
      const where = row.sessionId ? ` session:${row.sessionId}` : ''
      lines.push(`- 出自 ${mid} ${bits.join(' ')}${where}`)
    }
  }
  return `${lines.join('\n')}\n`
}

async function ingestJsonl(db, dir) {
  let text = ''
  try { text = await readFile(join(dir, 'mail.projection.jsonl'), 'utf8') } catch { return }
  const insert = db.prepare(
    'INSERT OR IGNORE INTO mail (id, kind, from_name, excerpt, ref_kind, no, session_id, message_id, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
  for (const line of text.split('\n')) {
    const raw = String(line || '').trim()
    if (!raw || raw[0] !== '{') continue
    let row
    try { row = JSON.parse(raw) } catch { continue }
    const packed = pack(row)
    if (!packed.id) continue
    try {
      insert.run(
        packed.id, packed.kind, packed.from, packed.excerpt,
        packed.refKind, packed.no, packed.sessionId, packed.messageId, packed.at,
      )
    } catch { /* skip a bad line */ }
  }
}

async function dbFor(workspace) {
  const dir = traceDir(workspace)
  if (!dir) return null
  if (dbs.has(dir)) return dbs.get(dir)
  try {
    await mkdir(dir, { recursive: true, mode: 0o700 })
    const db = openSqlite(join(dir, 'mail.sqlite'))
    if (!db) return null
    db.exec(CREATE)
    await ingestJsonl(db, dir)
    dbs.set(dir, db)
    return db
  } catch {
    return null
  }
}

async function rewriteDiary(dir, db) {
  let rows = []
  if (db) {
    rows = (db.prepare('SELECT id, kind, from_name, excerpt, ref_kind, no, session_id, message_id, at FROM mail ORDER BY at DESC LIMIT ?').all(CAP) || []).map((row) => ({
      id: row.id,
      kind: row.kind,
      from: row.from_name,
      excerpt: row.excerpt,
      refKind: row.ref_kind,
      no: row.no,
      sessionId: row.session_id,
      messageId: row.message_id,
      at: row.at,
    }))
  }
  if (!rows.length) {
    let text = ''
    try { text = await readFile(join(dir, 'mail.projection.jsonl'), 'utf8') } catch { text = '' }
    for (const line of text.split('\n')) {
      const raw = String(line || '').trim()
      if (!raw || raw[0] !== '{') continue
      try { rows.push(pack(JSON.parse(raw))) } catch { /* skip */ }
    }
    rows = rows.filter((row) => row && row.id).slice(-CAP).reverse()
  }
  await writeFile(join(dir, 'mail.projection.md'), render(rows), 'utf8')
}

export async function findMail(workspace, spec = {}) {
  const db = await dbFor(workspace)
  if (!db) return []
  const id = String((spec && spec.id) || '').trim()
  const no = String((spec && spec.no) || '').trim()
  const cap = Math.min(Math.max(Number(spec && spec.limit) || 20, 1), CAP)
  const sql = 'SELECT id, kind, from_name, excerpt, ref_kind, no, session_id, message_id, at FROM mail'
  function asRow(row) {
    if (!row) return null
    return {
      id: row.id,
      kind: row.kind,
      from: row.from_name,
      excerpt: row.excerpt,
      refKind: row.ref_kind,
      no: row.no,
      sessionId: row.session_id,
      messageId: row.message_id,
      at: row.at,
    }
  }
  if (id) {
    const row = asRow(db.prepare(`${sql} WHERE id = ?`).get(id))
    return row ? [row] : []
  }
  if (no) {
    return db.prepare(`${sql} WHERE no = ? ORDER BY at DESC LIMIT ?`).all(no, cap).map(asRow)
  }
  return db.prepare(`${sql} ORDER BY at DESC LIMIT ?`).all(cap).map(asRow)
}

export async function rememberMail(workspace, row) {
  const cwd = String(workspace || '').trim()
  const packed = pack(row)
  if (!cwd || !packed.id) return
  const dir = join(cwd, '.dsh', 'lan-assist')
  await mkdir(dir, { recursive: true, mode: 0o700 })
  await appendFile(join(dir, 'mail.projection.jsonl'), `${JSON.stringify(packed)}\n`, 'utf8')
  const db = await dbFor(cwd)
  if (db) {
    try {
      db.prepare(
        'INSERT OR IGNORE INTO mail (id, kind, from_name, excerpt, ref_kind, no, session_id, message_id, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        packed.id, packed.kind, packed.from, packed.excerpt,
        packed.refKind, packed.no, packed.sessionId, packed.messageId, packed.at,
      )
    } catch { /* diary still writes */ }
  }
  await rewriteDiary(dir, db)
}
