import { readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { zstdDecompress } from 'node:zlib'
import { FDE_DSH_HOME } from '../config.mjs'

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
  if (!text || text.length > MAX_TURN) return ''
  if (SKIP_SPEECH.test(text)) return ''
  if (text.startsWith('/')) return ''
  if (looksLikeJsonDump(text)) return ''
  return text
}

function collectUserTexts(lines) {
  const out = []
  const seen = new Set()
  for (const line of lines) {
    const raw = String(line || '').trim()
    if (!raw) continue
    let event
    try {
      event = JSON.parse(raw)
    } catch {
      continue
    }
    const text = userTextFromEvent(event)
    if (!text || seen.has(text)) continue
    seen.add(text)
    out.push(text)
  }
  return out
}

async function textsFromBuffer(name, buf) {
  if (name.endsWith('.jsonl') && !name.endsWith('.jsonl.zstd')) {
    return collectUserTexts(buf.toString('utf8').split('\n'))
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
  return collectUserTexts(lines)
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
 * Read original user turns from a DSH session log. Never returns JSON dumps.
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
