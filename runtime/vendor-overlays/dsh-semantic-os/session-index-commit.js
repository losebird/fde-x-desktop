/**
 * session-ingest.js saves the cursor before index_passages settles
 * (42e228fa session-ingest.js L416-L432). A cursor counts only after
 * those passage rows are in texts.json.
 * @module dsh-semantic-os/session-index-commit
 */

import { mkdirSync, readFileSync, realpathSync, watch } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

function homeDir() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

function cursorPath() {
  return join(homeDir(), 'semantic-os', 'session-cursors.json')
}

function passageFiles(cwd) {
  const files = [join(cwd, '.dsh', 'semantic-os', 'passages', 'texts.json')]
  try {
    const real = realpathSync(cwd)
    if (real !== cwd) files.push(join(real, '.dsh', 'semantic-os', 'passages', 'texts.json'))
  } catch {
    /* cwd is not a directory yet */
  }
  return files
}

function passageMap(cwd) {
  const map = new Map()
  for (const file of passageFiles(cwd)) {
    let parsed
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      continue
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'string') continue
      const text = value.trim()
      if (key && text) map.set(key, text)
    }
  }
  return map
}

function itemHas(map, row) {
  const stored = map.get(row.id)
  if (typeof stored !== 'string' || stored.length < 2) return false
  if (stored === row.text) return true
  // passages.py stores at most 1200 characters.
  return stored.length >= 1200 && row.text.startsWith(stored)
}

async function readCursors() {
  let text
  try {
    text = await readFile(cursorPath(), 'utf8')
  } catch (error) {
    if (error && error.code === 'ENOENT') return {}
    throw error
  }
  const parsed = JSON.parse(text)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

let cursorWriteSeq = 0

async function writeCursors(map) {
  const path = cursorPath()
  cursorWriteSeq += 1
  const temp = `${path}.${process.pid}.${Date.now()}.${cursorWriteSeq}.tmp`
  await mkdir(dirname(path), { recursive: true })
  try {
    await writeFile(temp, `${JSON.stringify(map, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(temp, path)
  } finally {
    await rm(temp, { force: true })
  }
}

async function rowsThrough(persistence, id, claimed, eventText) {
  const packed = await persistence.readFrom(id, 0)
  const events = packed && Array.isArray(packed.events) ? packed.events : []
  const rows = []
  for (const event of events) {
    const seq = event && Number.isFinite(event.seq) ? event.seq : -1
    if (seq < 0 || seq > claimed) continue
    const text = eventText(event).trim().slice(0, 20_000)
    if (text.length < 2) continue
    rows.push({
      id: `session:${id}:${seq}`,
      text,
      time: Number(event.ts || event.timestamp) || 0,
      seq,
    })
  }
  rows.sort((a, b) => a.seq - b.seq)
  return rows
}

function provenCursor(rows, map) {
  let proven = -1
  for (const row of rows) {
    if (!itemHas(map, row)) break
    proven = row.seq
  }
  return proven
}

async function commitOnce(deps) {
  const persistence = deps.getPersistence()
  if (!persistence || typeof persistence.list !== 'function' || typeof persistence.readFrom !== 'function') return
  const cursors = await readCursors()
  const headers = await persistence.list()
  const list = Array.isArray(headers) ? headers : []
  for (const header of list) {
    const id = deps.headerId(header)
    const cwd = String(deps.headerCwd(header) || '').replace(/[\r\n\t]/g, '')
    const claimed = Number(cursors[id])
    if (!id || !cwd || !Number.isFinite(claimed) || claimed < 0) continue
    const rows = await rowsThrough(persistence, id, claimed, deps.eventText)
    const storedNow = passageMap(cwd)
    const missing = rows.filter((row) => !itemHas(storedNow, row))
    if (!missing.length) continue
    const proven = provenCursor(rows, storedNow)
    const rewound = { ...cursors }
    if (proven >= 0) rewound[id] = proven
    else delete rewound[id]
    await writeCursors(rewound)
    const body = await deps.postPython(deps.sidecar, {
      op: 'index_passages',
      cwd,
      args: {
        rows: missing.map((row) => ({ id: row.id, text: row.text, time: row.time })),
      },
    })
    const stored = passageMap(cwd)
    const still = missing.filter((row) => !itemHas(stored, row))
    if (!body || body.error || body.ok === false || still.length) {
      const detail = (body && (body.error || body.detail)) || (still[0] && still[0].id) || 'passages missing'
      throw new Error(`index_passages did not store ${id}: ${detail}`)
    }
    const current = await readCursors()
    const seen = Number(current[id])
    current[id] = Number.isFinite(seen) ? Math.max(seen, claimed) : claimed
    await writeCursors(current)
  }
}

export function attachSessionIndexCommit(deps) {
  if (!deps || typeof deps.postPython !== 'function' || typeof deps.getPersistence !== 'function') {
    throw new TypeError('session index commit needs postPython and getPersistence')
  }
  if (typeof deps.eventText !== 'function' || typeof deps.headerId !== 'function' || typeof deps.headerCwd !== 'function') {
    throw new TypeError('session index commit needs eventText, headerId, and headerCwd')
  }
  const dir = join(homeDir(), 'semantic-os')
  mkdirSync(dir, { recursive: true })
  let tail = Promise.resolve()
  let pending = tail
  let closed = false

  function poke() {
    const run = tail.then(() => commitOnce(deps))
    pending = run
    tail = run.then(() => {}, () => {})
    return run
  }

  const watcher = watch(dir, { persistent: false }, (_event, filename) => {
    if (closed) return
    const name = filename == null ? '' : String(filename)
    if (name !== 'session-cursors.json') return
    poke()
  })
  poke()

  return {
    poke,
    whenSettled() {
      return (async () => {
        await new Promise((resolve) => setImmediate(resolve))
        await pending
        await new Promise((resolve) => setImmediate(resolve))
        await pending
      })()
    },
    close() {
      if (closed) return
      closed = true
      watcher.close()
    },
  }
}
