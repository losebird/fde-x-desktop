/**
 * One Host bytes window pipe. Face verbs whose result encodes Uint8Array
 * (readBytes, officeToPdf/render, ...) share this loop.
 */
import { argsFromFace } from './catalog-collect.mjs'

function fileNameOf(path) {
  const bits = String(path || '').split(/[\\/]/u)
  return bits[bits.length - 1] || 'file'
}

function partToBuffer(part) {
  const raw = part?.data
  if (!raw) return Buffer.alloc(0)
  if (Buffer.isBuffer(raw)) return raw
  if (raw instanceof Uint8Array) return Buffer.from(raw)
  if (ArrayBuffer.isView(raw)) return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength)
  if (typeof raw === 'string') return Buffer.from(raw, 'base64')
  if (Array.isArray(raw)) return Buffer.from(raw)
  return Buffer.alloc(0)
}

async function invokeBytes(aiRuntime, endpoint, args) {
  if (typeof aiRuntime.callBytes === 'function') return aiRuntime.callBytes(endpoint, args)
  return aiRuntime.call(endpoint, args)
}

export async function readFaceBytes(aiRuntime, verb, input = {}) {
  if (!aiRuntime || typeof aiRuntime.call !== 'function') throw new Error('核心未接通')
  const chunks = []
  let offset = 0
  let mime = ''
  let name = fileNameOf(input.path)
  for (;;) {
    const args = argsFromFace(verb, {
      ...input,
      params: { ...(input.params && typeof input.params === 'object' ? input.params : {}), options: { range: { offset } } },
    })
    const part = await invokeBytes(aiRuntime, verb.endpoint, args)
    if (part && typeof part.name === 'string' && part.name) name = part.name
    if (part && typeof part.mime === 'string' && part.mime) mime = part.mime
    const buf = partToBuffer(part)
    chunks.push(buf)
    const next = Number(part?.offset)
    offset = (Number.isFinite(next) ? next : offset) + buf.length
    if (part?.eof !== false) break
    if (!buf.length) break
  }
  const data = Buffer.concat(chunks)
  return {
    path: input.path,
    name,
    size: data.length,
    data: data.toString('base64'),
    mime,
  }
}

export async function readWorkspaceFileBytes(aiRuntime, { sessionId, path }) {
  if (!sessionId) throw new Error('缺少 sessionId')
  if (!path) throw new Error('缺少 path')
  const { ensureTypertVerbs } = await import('./catalog-typert.mjs')
  const verbs = await ensureTypertVerbs()
  const verb = verbs.find((row) => row.ns === 'workspaceFiles' && row.method === 'readBytes')
  if (!verb) throw new Error('Host 没有字节口')
  return readFaceBytes(aiRuntime, verb, { sessionId, path })
}

export function decodeWorkspaceFileText(file) {
  const data = Buffer.from(String(file?.data || ''), 'base64')
  return {
    path: file?.path,
    name: file?.name,
    text: data.toString('utf8'),
  }
}
