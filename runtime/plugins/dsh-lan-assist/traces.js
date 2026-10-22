/**
 * Workspace trace ledger. SQLite in the cwd, not DSH storageDomain.
 * Existing traces.jsonl is ingested once, then ignored.
 * @module dsh-lan-assist/traces
 */

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { openSqlite } from './sqlite.js'

const CREATE = `CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT '',
  no TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  receipt_id TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  at INTEGER NOT NULL
)`

const SELECT = 'SELECT id, kind, no, action, receipt_id, session_id, source, at FROM traces'
const PAGE_CAP = 20

function ensureSchema(db) {
  db.exec(CREATE)
  const cols = db.prepare('PRAGMA table_info(traces)').all()
  if (!cols.some((col) => col && col.name === 'session_id')) {
    db.exec('ALTER TABLE traces ADD COLUMN session_id TEXT NOT NULL DEFAULT ""')
  }
}

export function traceDir(workspace) {
  const cwd = String(workspace || '').trim()
  return cwd ? join(cwd, '.dsh', 'lan-assist') : ''
}

export const PROJECTION_REL = '.dsh/lan-assist/traces.projection.md'

export function projectionPath(workspace) {
  const dir = traceDir(workspace)
  return dir ? join(dir, 'traces.projection.jsonl') : ''
}

function packProjection(row) {
  return {
    id: String((row && row.id) || ''),
    kind: String((row && row.kind) || ''),
    no: String((row && row.no) || ''),
    action: String((row && row.action) || ''),
    receipt_id: String((row && (row.receipt_id || row.receiptId)) || ''),
    sessionId: String((row && (row.sessionId || row.session_id)) || ''),
    source: String((row && row.source) || ''),
    at: Number((row && row.at) || 0),
  }
}

async function writeDiary(dir, rows) {
  const lines = ['# 账本投影', '', '只读回执，不是现查。进图要点头 ingest 本文件。', '']
  for (const row of Array.isArray(rows) ? rows : []) {
    const packed = packProjection(row)
    if (!packed.id) continue
    const bits = [packed.kind, packed.no, packed.action, packed.receipt_id].filter(Boolean)
    if (bits.length) {
      const where = packed.sessionId ? ` session:${packed.sessionId}` : ''
      lines.push(`- 出自 ${packed.id} ${bits.join(' ')}${where}`)
    }
  }
  await writeFile(join(dir, 'traces.projection.md'), `${lines.join('\n')}\n`, 'utf8')
}

async function writeProjection(dir, rows) {
  const lines = (Array.isArray(rows) ? rows : []).map(packProjection).filter((row) => row.id).map((row) => JSON.stringify(row))
  await writeFile(join(dir, 'traces.projection.jsonl'), lines.length ? `${lines.join('\n')}\n` : '', 'utf8')
  await writeDiary(dir, rows)
}

async function appendProjection(dir, row, db) {
  const packed = packProjection(row)
  if (!packed.id) return
  await appendFile(join(dir, 'traces.projection.jsonl'), `${JSON.stringify(packed)}\n`, 'utf8')
  if (db) {
    const recent = db.prepare(`${SELECT} ORDER BY at DESC LIMIT 100`).all()
    await writeDiary(dir, recent)
  }
}

export function createTraceLog() {
  const mem = new Set()
  const dbs = new Map()

  async function dbFor(workspace) {
    const dir = traceDir(workspace)
    if (!dir) return null
    if (dbs.has(dir)) return dbs.get(dir)
    try {
      await mkdir(dir, { recursive: true })
      const db = openSqlite(join(dir, 'traces.sqlite'))
      if (!db) return null
      ensureSchema(db)
      await ingestJsonl(db, dir)
      try {
        await readFile(join(dir, 'traces.projection.jsonl'), 'utf8')
      } catch {
        await writeProjection(dir, db.prepare(`${SELECT} ORDER BY at`).all())
      }
      dbs.set(dir, db)
      return db
    } catch {
      return null
    }
  }

  return {
    async seen(id, workspace) {
      const key = String(id || '').trim()
      if (!key) return false
      if (mem.has(key)) return true
      const db = await dbFor(workspace)
      if (!db) return false
      const row = db.prepare('SELECT id FROM traces WHERE id = ?').get(key)
      if (!row) return false
      mem.add(key)
      return true
    },
    async remember(id, workspace, meta) {
      const key = String(id || '').trim()
      if (!key) return
      mem.add(key)
      const db = await dbFor(workspace)
      if (!db) return
      const dir = traceDir(workspace)
      try {
        const source = `file:${join(dir, 'traces.sqlite')}`
        const at = Number((meta && meta.at) || Date.now())
        const row = {
          id: key,
          kind: String((meta && meta.kind) || '').trim(),
          no: String((meta && meta.no) || '').trim(),
          action: String((meta && meta.action) || '').trim(),
          receipt_id: String((meta && meta.receiptId) || '').trim(),
          sessionId: String((meta && meta.sessionId) || '').trim(),
          source,
          at,
        }
        const wrote = db.prepare(
          'INSERT OR IGNORE INTO traces (id, kind, no, action, receipt_id, session_id, source, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(row.id, row.kind, row.no, row.action, row.receipt_id, row.sessionId, row.source, row.at)
        if (wrote && wrote.changes) await appendProjection(dir, row, db)
      } catch { /* memory still holds this process */ }
    },
    async open(id, workspace) {
      const key = String(id || '').trim()
      if (!key) return null
      const db = await dbFor(workspace)
      if (!db) return null
      const row = db.prepare(`${SELECT} WHERE id = ?`).get(key)
      return row ? packProjection(row) : null
    },
    async recent(workspace, limit) {
      const db = await dbFor(workspace)
      if (!db) return []
      const cap = Math.min(Math.max(Number(limit) || 20, 1), PAGE_CAP)
      return db.prepare(`${SELECT} ORDER BY at DESC LIMIT ?`).all(cap).map(packProjection)
    },
    async byNo(workspace, no, limit) {
      const ticket = String(no || '').trim()
      if (!ticket) return []
      const db = await dbFor(workspace)
      if (!db) return []
      const cap = Math.min(Math.max(Number(limit) || 20, 1), PAGE_CAP)
      return db.prepare(`${SELECT} WHERE no = ? ORDER BY at DESC LIMIT ?`).all(ticket, cap).map(packProjection)
    },
  }
}

async function ingestJsonl(db, dir) {
  let text = ''
  try {
    text = await readFile(join(dir, 'traces.jsonl'), 'utf8')
  } catch {
    return
  }
  const insert = db.prepare(
    'INSERT OR IGNORE INTO traces (id, kind, no, action, receipt_id, session_id, source, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
  const source = `file:${join(dir, 'traces.sqlite')}`
  for (const line of text.split('\n')) {
    const raw = String(line || '').trim()
    if (!raw) continue
    let id = raw
    let kind = ''
    let no = ''
    let action = ''
    let receiptId = ''
    let at = Date.now()
    if (raw[0] === '{') {
      try {
        const row = JSON.parse(raw)
        id = String((row && row.id) || '').trim()
        kind = String((row && row.kind) || '').trim()
        no = String((row && row.no) || '').trim()
        action = String((row && row.action) || '').trim()
        receiptId = String((row && (row.receiptId || row.receipt_id)) || '').trim()
        at = Number((row && row.at) || Date.now())
      } catch {
        id = raw
      }
    }
    if (!id) continue
    try {
      insert.run(id, kind, no, action, receiptId, '', source, Number.isFinite(at) ? at : Date.now())
    } catch { /* skip a bad line */ }
  }
}
