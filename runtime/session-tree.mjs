import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { constants as zlibConstants, zstdCompress, zstdDecompress } from 'node:zlib'

const zstdCompressAsync = promisify(zstdCompress)
const zstdDecompressAsync = promisify(zstdDecompress)
const ZSTD_MAGIC = 4247762216
const ZSTD_CHECKSUM = { params: { [zlibConstants.ZSTD_c_checksumFlag]: 1 } }
const SKIP_SESSION_FILES = new Set(['session.lock'])

export function safeSessionFileName(name) {
  const s = String(name || '').trim()
  if (!s || s.includes('..') || s.includes('/') || s.includes('\\') || s.includes('\0')) return ''
  if (SKIP_SESSION_FILES.has(s) || s.startsWith('.')) return ''
  return s
}

export function safeSessionDirName(name) {
  const s = String(name || '').trim()
  if (!s || s === '.' || s === '..') return ''
  if (s.includes('/') || s.includes('\\') || s.includes('\0')) return ''
  if (s.includes('..') || s.startsWith('.')) return ''
  return s
}

export function isSessionLogName(name) {
  const s = String(name || '')
  if (s.endsWith('.jsonl.zstd')) return true
  return s.endsWith('.jsonl') && !s.endsWith('.jsonl.zstd')
}

export async function findSessionDir(sessionRoot, sessionId) {
  const id = String(sessionId || '').trim()
  const root = String(sessionRoot || '').trim()
  if (!id || !root || id.includes('..') || id.includes('/') || id.includes('\\') || id.includes('\0')) return ''
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
  return walk(root, 0)
}

export function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) break
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error(`会话日志不是 zstd：offset ${offset}`)
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
      const blockType = blockHeader >>> 1 & 3
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

function patchHeaderRecord(header, patch = {}, idMap = {}) {
  const next = { ...header }
  if (patch.id) next.id = patch.id
  if (patch.cwd) next.cwd = patch.cwd
  const parent = next.parentSession
  if (typeof parent === 'string' && idMap[parent]) next.parentSession = idMap[parent]
  return next
}

function headerLineOf(text) {
  const cut = text.indexOf('\n')
  const first = cut === -1 ? text : text.slice(0, cut)
  const rest = cut === -1 ? '' : text.slice(cut)
  return { first, rest, oneLine: cut !== -1 && cut === text.length - 1 }
}

async function listSessionFiles(dir) {
  let names = []
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const files = []
  for (const name of names) {
    const safe = safeSessionFileName(name)
    if (!safe) continue
    const buf = await readFile(join(dir, safe))
    files.push({ name: safe, size: buf.length, data: buf.toString('base64') })
  }
  return files
}

async function logPathIn(dir) {
  let names = []
  try {
    names = await readdir(dir)
  } catch {
    return ''
  }
  const zstd = names.find((name) => safeSessionFileName(name) && name.endsWith('.jsonl.zstd'))
  if (zstd) return join(dir, zstd)
  const plain = names.find((name) => safeSessionFileName(name) && name.endsWith('.jsonl'))
  return plain ? join(dir, plain) : ''
}

export async function readLogHeader(dir) {
  const path = await logPathIn(dir)
  if (!path) return null
  try {
    const buf = await readFile(path)
    if (path.endsWith('.jsonl.zstd') || path.endsWith('.zstd')) {
      const frames = scanZstdFrames(buf)
      if (!frames.length) return null
      const text = (await zstdDecompressAsync(buf.subarray(frames[0].start, frames[0].end))).toString('utf8')
      const { first, oneLine } = headerLineOf(text)
      if (!oneLine) return null
      return JSON.parse(first)
    }
    const { first, oneLine } = headerLineOf(buf.toString('utf8'))
    if (!oneLine && first) return JSON.parse(first)
    return JSON.parse(first)
  } catch {
    return null
  }
}

function keepIncreasingLines(text, lastSeq) {
  const kept = []
  let seq = lastSeq
  let dropped = false
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      dropped = true
      continue
    }
    if (typeof event.seq === 'number') {
      if (event.seq <= seq) {
        dropped = true
        continue
      }
      seq = event.seq
    }
    kept.push(line)
  }
  return { kept, lastSeq: seq, dropped }
}

export async function increasingEventFrames(buf) {
  const frames = scanZstdFrames(buf)
  const out = []
  let lastSeq = -1
  for (let i = 1; i < frames.length; i += 1) {
    const raw = buf.subarray(frames[i].start, frames[i].end)
    const text = (await zstdDecompressAsync(raw)).toString('utf8')
    const { kept, lastSeq: nextSeq, dropped } = keepIncreasingLines(text, lastSeq)
    lastSeq = nextSeq
    if (!kept.length) continue
    if (!dropped) {
      out.push(Buffer.from(raw))
      continue
    }
    out.push(await zstdCompressAsync(Buffer.from(`${kept.join('\n')}\n`), ZSTD_CHECKSUM))
  }
  return out
}

async function adoptCreatedLog(createdPath, incomingBuf) {
  const createdBuf = await readFile(createdPath)
  if (createdPath.endsWith('.jsonl') && !createdPath.endsWith('.jsonl.zstd')) {
    const { first, oneLine } = headerLineOf(createdBuf.toString('utf8'))
    if (!oneLine) throw new Error('新建会话还没有 header 行')
    const incoming = incomingBuf.toString('utf8')
    const cut = incoming.indexOf('\n')
    const body = cut === -1 ? '' : incoming.slice(cut + 1)
    const { kept } = keepIncreasingLines(body, -1)
    if (!kept.length) throw new Error('交接会话里没有可接上的事件')
    await writeFile(createdPath, `${first}\n${kept.join('\n')}\n`)
    return
  }
  const createdFrames = scanZstdFrames(createdBuf)
  if (!createdFrames.length) throw new Error('新建会话还没有 header 帧')
  const header = createdBuf.subarray(createdFrames[0].start, createdFrames[0].end)
  const eventFrames = await increasingEventFrames(incomingBuf)
  if (!eventFrames.length) throw new Error('交接会话里没有可接上的事件')
  await writeFile(createdPath, Buffer.concat([header, ...eventFrames]))
}

async function rewriteSessionLog(name, buf, patch = {}, idMap = {}) {
  if (!patch?.id && !patch?.cwd && !Object.keys(idMap).length) return buf
  if (name.endsWith('.jsonl') && !name.endsWith('.jsonl.zstd')) {
    const text = buf.toString('utf8')
    const { first, rest, oneLine } = headerLineOf(text)
    const header = JSON.parse(first)
    const patched = `${JSON.stringify(patchHeaderRecord(header, patch, idMap))}${oneLine ? '\n' : rest}`
    const cut = patched.indexOf('\n')
    const head = cut === -1 ? `${patched}\n` : patched.slice(0, cut + 1)
    const body = cut === -1 ? '' : patched.slice(cut + 1)
    const { kept } = keepIncreasingLines(body, -1)
    return Buffer.from(`${head}${kept.join('\n')}${kept.length ? '\n' : ''}`, 'utf8')
  }
  if (!name.endsWith('.jsonl.zstd') && !name.endsWith('.zstd')) return buf
  const frames = scanZstdFrames(buf)
  if (!frames.length) throw new Error('会话日志里没有完整的 zstd 帧')
  const headerPlain = await zstdDecompressAsync(buf.subarray(frames[0].start, frames[0].end))
  const headerText = headerPlain.toString('utf8')
  const { first, oneLine } = headerLineOf(headerText)
  if (!oneLine) throw new Error('会话日志第一帧不是单独的 header 行')
  const patched = Buffer.from(`${JSON.stringify(patchHeaderRecord(JSON.parse(first), patch, idMap))}\n`, 'utf8')
  const headerFrame = await zstdCompressAsync(patched, ZSTD_CHECKSUM)
  const eventFrames = await increasingEventFrames(buf)
  return Buffer.concat([headerFrame, ...eventFrames])
}

async function writeSessionFiles(dir, files, options = {}) {
  await mkdir(dir, { recursive: true })
  const headerPatch = options.headerPatch || {}
  const idMap = options.idMap || {}
  const adoptExistingLog = options.adoptExistingLog === true
  for (const file of Array.isArray(files) ? files : []) {
    const name = safeSessionFileName(file && file.name)
    if (!name) continue
    const buf = Buffer.from(String((file && file.data) || ''), 'base64')
    if (!buf.length) continue
    const dest = join(dir, name)
    if (isSessionLogName(name) && adoptExistingLog && existsSync(dest)) {
      await adoptCreatedLog(dest, buf)
      continue
    }
    const next = isSessionLogName(name) ? await rewriteSessionLog(name, buf, headerPatch, idMap) : buf
    await writeFile(dest, next)
  }
}

async function memberRowsOf(projectDir, rootId, rootDir) {
  let entries = []
  try {
    entries = await readdir(projectDir, { withFileTypes: true })
  } catch {
    return []
  }
  const rows = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(projectDir, entry.name)
    if (dir === rootDir) continue
    const header = await readLogHeader(dir)
    if (!header || typeof header !== 'object') continue
    const id = String(header.id || entry.name)
    rows.push({
      dir,
      name: entry.name,
      id,
      parentSession: typeof header.parentSession === 'string' ? header.parentSession : '',
    })
  }
  const byParent = new Map()
  for (const row of rows) {
    if (!row.parentSession) continue
    const list = byParent.get(row.parentSession) || []
    list.push(row)
    byParent.set(row.parentSession, list)
  }
  const ordered = []
  const seen = new Set()
  const queue = [rootId]
  while (queue.length) {
    const parent = queue.shift()
    for (const row of byParent.get(parent) || []) {
      if (seen.has(row.id) || seen.has(row.name)) continue
      seen.add(row.id)
      seen.add(row.name)
      ordered.push(row)
      queue.push(row.id)
    }
  }
  return ordered
}

export async function readSessionTree(sessionRoot, sessionId) {
  const dir = await findSessionDir(sessionRoot, sessionId)
  if (!dir) {
    const error = new Error('找不到这个会话文件')
    error.code = 'not_found'
    throw error
  }
  const files = await listSessionFiles(dir)
  if (!files.length) {
    const error = new Error('这个会话还没有可交接的文件')
    error.code = 'empty'
    throw error
  }
  const members = []
  for (const row of await memberRowsOf(dirname(dir), String(sessionId), dir)) {
    const memberFiles = await listSessionFiles(row.dir)
    if (!memberFiles.length) continue
    members.push({ sessionId: row.id, dir: row.name, files: memberFiles })
  }
  return { sessionId, files, members }
}

export async function writeSessionTree(spec = {}) {
  const parentDir = String(spec.parentDir || '').trim()
  const warnings = []
  if (!parentDir) throw new Error('会话目录还没出现，文件写不进去')
  const createdId = String(spec.createdId || '').trim()
  const sourceId = String(spec.sourceId || '').trim()
  const cwd = String(spec.cwd || '').trim()
  const idMap = {}
  if (sourceId && createdId) idMap[sourceId] = createdId
  await writeSessionFiles(parentDir, spec.files, {
    adoptExistingLog: true,
    headerPatch: { ...(createdId ? { id: createdId } : {}), ...(cwd ? { cwd } : {}) },
    idMap,
  })
  const projectDir = dirname(parentDir)
  const projectPrefix = projectDir.endsWith('/') ? projectDir : `${projectDir}/`
  for (const member of Array.isArray(spec.members) ? spec.members : []) {
    const rawDir = String((member && (member.dir || member.sessionId)) || '').trim()
    const dirName = safeSessionDirName(rawDir)
    if (!dirName) {
      if (rawDir) warnings.push(`子会话 ${rawDir} 落点不在当前工作区会话树里`)
      continue
    }
    const dest = join(projectDir, dirName)
    if (dest === parentDir || dest === projectDir || !dest.startsWith(projectPrefix)) {
      warnings.push(`子会话 ${dirName} 落点不在当前工作区会话树里`)
      continue
    }
    try {
      await writeSessionFiles(dest, member.files, {
        adoptExistingLog: false,
        headerPatch: cwd ? { cwd } : {},
        idMap,
      })
    } catch (error) {
      warnings.push(`子会话 ${dirName} 没写上：${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { warnings }
}
