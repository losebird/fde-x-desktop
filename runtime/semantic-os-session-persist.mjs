/**
 * Read DSH session logs from disk so BFF session ingest does not need Host inject.
 */
import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { homedir } from 'node:os'
import { promisify } from 'node:util'
import { zstdDecompress } from 'node:zlib'
import { FDE_DSH_HOME } from './config.mjs'
import { findSessionDir, isSessionLogName, readLogHeader, safeSessionFileName } from './session-tree.mjs'

const zstdDecompressAsync = promisify(zstdDecompress)
const ZSTD_MAGIC = 4247762216

export function sessionRootOf(explicit) {
  const given = String(explicit || process.env.FDE_DSH_SESSION_ROOT || '').trim()
  if (given) return given
  return join(FDE_DSH_HOME || join(homedir(), '.dsh-fde-x'), 'sessions')
}

function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) break
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) break
    offset += 4
    if (offset >= buffer.length) break
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 32) !== 0
    const checksum = (descriptor & 4) !== 0
    const dictionaryFlag = descriptor & 3
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    offset += (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    for (;;) {
      if (buffer.length - offset < 3) break
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 3
      const blockSize = blockHeader >>> 3
      const payloadBytes = blockType === 1 ? 1 : blockSize
      offset += payloadBytes
      if (lastBlock) break
    }
    if (checksum) offset += 4
    frames.push({ start, end: offset })
  }
  return frames
}

async function linesOfLog(path, buf) {
  const name = basename(path)
  if (name.endsWith('.jsonl') && !name.endsWith('.jsonl.zstd') && !name.endsWith('.zstd')) {
    return buf.toString('utf8').split('\n')
  }
  if (!name.endsWith('.zstd')) return []
  const frames = scanZstdFrames(buf)
  const lines = []
  for (const frame of frames) {
    const text = (await zstdDecompressAsync(buf.subarray(frame.start, frame.end))).toString('utf8')
    for (const line of text.split('\n')) {
      if (line.trim()) lines.push(line)
    }
  }
  return lines
}

function headerFields(raw) {
  if (!raw || typeof raw !== 'object') return { id: '', cwd: '' }
  const data = raw.data && typeof raw.data === 'object' ? raw.data : {}
  const nested = data.header && typeof data.header === 'object' ? data.header : {}
  const meta = (raw.meta && typeof raw.meta === 'object' ? raw.meta : null)
    || (data.meta && typeof data.meta === 'object' ? data.meta : {})
  const id = String(raw.id || data.id || nested.id || meta.id || '')
  const cwd = String(raw.cwd || data.cwd || nested.cwd || meta.cwd || '')
  return { id, cwd }
}

async function walkSessionDirs(root, depth = 0) {
  if (depth > 3) return []
  let entries = []
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return []
  }
  const found = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(root, entry.name)
    let names = []
    try {
      names = await readdir(dir)
    } catch {
      continue
    }
    if (names.some((name) => safeSessionFileName(name) && isSessionLogName(name))) found.push(dir)
    found.push(...await walkSessionDirs(dir, depth + 1))
  }
  return found
}

async function eventsFromDir(dir) {
  let names = []
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const logs = names.filter((name) => safeSessionFileName(name) && isSessionLogName(name))
  logs.sort((left, right) => Number(right.endsWith('.zstd')) - Number(left.endsWith('.zstd')) || right.length - left.length)
  const events = []
  for (const name of logs) {
    let buf
    try {
      buf = await readFile(join(dir, name))
    } catch {
      continue
    }
    const lines = await linesOfLog(join(dir, name), buf)
    for (const line of lines) {
      const raw = String(line || '').trim()
      if (!raw) continue
      try {
        events.push(JSON.parse(raw))
      } catch {
        continue
      }
    }
    if (events.length) break
  }
  return events
}

export function createDiskSessionPersistence(sessionRoot = sessionRootOf()) {
  const root = String(sessionRoot || '').trim()
  return {
    async list() {
      const dirs = await walkSessionDirs(root)
      const out = []
      const seen = new Set()
      for (const dir of dirs) {
        const header = await readLogHeader(dir)
        const fields = headerFields(header)
        const id = fields.id || basename(dir)
        if (!id || seen.has(id)) continue
        seen.add(id)
        out.push({ id, cwd: fields.cwd })
      }
      return out
    },
    async readFrom(id, fromSeq = 0) {
      const dir = await findSessionDir(root, id)
      if (!dir) return { events: [] }
      const from = Number(fromSeq) || 0
      const events = (await eventsFromDir(dir)).filter((event) => {
        const seq = event && Number.isFinite(event.seq) ? event.seq : 0
        return seq >= from
      })
      return { events }
    },
  }
}
