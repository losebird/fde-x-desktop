import { readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { zstdDecompress } from 'node:zlib'
import { FDE_DSH_HOME } from '../config.mjs'
import { canonicalWorkspaceCwd } from '../cwd.mjs'

const zstdDecompressAsync = promisify(zstdDecompress)
const ZSTD_MAGIC = 4247762216
const SKIP_SPEECH = /Current runtime context|system-reminder|available_skills|<goal_round>|<skill_content>|Compactions remaining/
const MAX_TURN = 4000
const MAX_TOTAL = 8000

function sessionRootOf(explicit) {
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

export function looksLikeJsonDump(text) {
  const raw = String(text || '').trim()
  if (!raw) return false
  if (!(raw.startsWith('{') || raw.startsWith('['))) return false
  try {
    JSON.parse(raw)
    return true
  } catch {
    return /"(ok|error|traceId|receipt)"\s*:/.test(raw)
  }
}

function clipTurn(text) {
  const raw = String(text || '').trim()
  if (!raw) return ''
  if (raw.length <= MAX_TURN) return raw
  return `${raw.slice(0, MAX_TURN - 1).trim()}…`
}

function userTextFromEvent(event) {
  if (!event || event.type !== 'user/message') return ''
  const data = event.data || {}
  const source = data.source || {}
  if (source.kind && source.kind !== 'user') return ''
  if (source.plugin === 'dsh-lan-assist') return ''
  const message = data.message || {}
  const blocks = Array.isArray(data.content)
    ? data.content
    : (Array.isArray(message.content) ? message.content : [])
  const parts = []
  for (const block of blocks) {
    if (block && block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  const text = parts.join('\n').trim()
  if (!text) return ''
  if (SKIP_SPEECH.test(text)) return ''
  if (text.startsWith('/')) return ''
  if (looksLikeJsonDump(text)) return ''
  return clipTurn(text)
}

function assistantTextFromEvent(event) {
  if (!event || event.type !== 'assistant/message') return ''
  const data = event.data && typeof event.data === 'object' ? event.data : {}
  const message = data.message && typeof data.message === 'object' ? data.message : data
  const content = message.content
  const parts = []
  if (typeof content === 'string') parts.push(content)
  else if (Array.isArray(content)) {
    for (const block of content) {
      if (!block) continue
      if (typeof block === 'string') parts.push(block)
      if (block.type === 'reasoning') continue
      if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
    }
  }
  const text = parts.join('\n').trim()
  if (!text || text.startsWith('{')) return ''
  if (SKIP_SPEECH.test(text)) return ''
  if (looksLikeJsonDump(text)) return ''
  return clipTurn(text)
}

function collectOriginTexts(lines) {
  const users = []
  const assistants = []
  const seen = new Set()
  const push = (bucket, text) => {
    if (!text || seen.has(text)) return
    seen.add(text)
    bucket.push(text)
  }
  for (const line of lines) {
    const raw = String(line || '').trim()
    if (!raw) continue
    let event
    try {
      event = JSON.parse(raw)
    } catch {
      continue
    }
    push(users, userTextFromEvent(event))
    push(assistants, assistantTextFromEvent(event))
  }
  return [...users, ...assistants]
}

async function textsFromBuffer(name, buf) {
  if (name.endsWith('.jsonl') && !name.endsWith('.jsonl.zstd')) {
    return collectOriginTexts(buf.toString('utf8').split('\n'))
  }
  if (!name.endsWith('.jsonl.zstd') && !name.endsWith('.zstd')) return []
  const frames = scanZstdFrames(buf)
  const lines = []
  for (let i = 0; i < frames.length; i += 1) {
    const text = (await zstdDecompressAsync(buf.subarray(frames[i].start, frames[i].end))).toString('utf8')
    for (const line of text.split('\n')) {
      if (line.trim()) lines.push(line)
    }
  }
  return collectOriginTexts(lines)
}

function cwdOfHeaderEvent(event) {
  if (!event || typeof event !== 'object') return ''
  const data = event.data && typeof event.data === 'object' ? event.data : {}
  if (event.type === 'session') {
    const raw = event.cwd || event.header?.cwd || data.cwd || data.header?.cwd || data.meta?.cwd || ''
    return canonicalWorkspaceCwd(raw)
  }
  if (event.type !== 'session/header') return ''
  const raw = data.cwd || data.header?.cwd || data.meta?.cwd || ''
  return canonicalWorkspaceCwd(raw)
}

async function linesOfSessionFile(name, buf) {
  if (name.endsWith('.jsonl') && !name.endsWith('.jsonl.zstd') && !name.endsWith('.zstd')) {
    return buf.toString('utf8').split('\n')
  }
  if (!name.endsWith('.zstd')) return []
  const frames = scanZstdFrames(buf)
  const lines = []
  for (let i = 0; i < frames.length; i += 1) {
    const text = (await zstdDecompressAsync(buf.subarray(frames[i].start, frames[i].end))).toString('utf8')
    for (const line of text.split('\n')) {
      if (line.trim()) lines.push(line)
    }
  }
  return lines
}

export async function sessionLogCwd(sessionId, opts = {}) {
  const dir = await findSessionDir(sessionId, opts.sessionRoot)
  if (!dir) return ''
  let names = []
  try {
    names = await readdir(dir)
  } catch {
    return ''
  }
  for (const name of names) {
    if (!name.endsWith('.jsonl') && !name.endsWith('.zstd')) continue
    if (name.includes('..')) continue
    let buf
    try {
      buf = await readFile(join(dir, name))
    } catch {
      continue
    }
    const lines = await linesOfSessionFile(name, buf)
    for (const line of lines) {
      const raw = String(line || '').trim()
      if (!raw) continue
      let event
      try {
        event = JSON.parse(raw)
      } catch {
        continue
      }
      const cwd = cwdOfHeaderEvent(event)
      if (cwd) return cwd
    }
  }
  return ''
}

async function findSessionDir(sessionId, sessionRoot) {
  const id = String(sessionId || '').trim()
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\') || id.includes('\0')) return ''
  const walk = async (dir, depth) => {
    if (depth > 3) return ''
    let entries = []
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return ''
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === id) return join(dir, entry.name)
      const nested = await walk(join(dir, entry.name), depth + 1)
      if (nested) return nested
    }
    return ''
  }
  return walk(sessionRootOf(sessionRoot), 0)
}

/**
 * Read session origin text: user turns first, then assistant replies.
 * Skips injected speech, reasoning, and JSON dumps.
 * @param {string} sessionId
 * @param {{ sessionRoot?: string }} [opts]
 */
export async function readSessionUserOrigin(sessionId, opts = {}) {
  const dir = await findSessionDir(sessionId, opts.sessionRoot)
  if (!dir) return ''
  let names = []
  try {
    names = await readdir(dir)
  } catch {
    return ''
  }
  const texts = []
  for (const name of names) {
    if (!name.endsWith('.jsonl') && !name.endsWith('.zstd')) continue
    if (name.includes('..')) continue
    let buf
    try {
      buf = await readFile(join(dir, name))
    } catch {
      continue
    }
    texts.push(...await textsFromBuffer(name, buf))
  }
  if (!texts.length) return ''
  let out = ''
  for (const line of texts) {
    const next = out ? `${out}\n\n${line}` : line
    if (next.length > MAX_TOTAL) break
    out = next
  }
  return out
}
