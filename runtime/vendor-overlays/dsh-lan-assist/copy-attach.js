/**
 * Letter attachment → workspace file. Default dest is inbox-copies.
 * A relative `path` writes one identity under cwd. `dests` zips the
 * letter's attachments onto those identities through the same write.
 * @module dsh-lan-assist/copy-attach
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve, sep } from 'node:path'

const HANDOFF_MIME = 'application/vnd.dsh.handoff+json'
const HANDOFF_NAME = 'dsh-handoff.json'

function underWorkspace(cwd, dest) {
  const root = resolve(String(cwd || ''))
  const path = resolve(String(dest || ''))
  const prefix = root.endsWith(sep) ? root : root + sep
  return path === root || path.startsWith(prefix)
}

function isHandoffAttach(item) {
  return String((item && item.name) || '') === HANDOFF_NAME
    || String((item && item.mime) || '') === HANDOFF_MIME
}

export function destRel(path) {
  const href = String(path || '').trim().replace(/^file:\/\//i, '').replace(/\\/g, '/').replace(/^(?:\.\/)+/, '')
  if (!href || href === '.') return ''
  if (href.startsWith('/') || /^[A-Za-z]:/.test(href) || href.startsWith('//')) return ''
  const parts = href.split('/').filter(Boolean)
  if (!parts.length || parts.some((part) => part === '.' || part === '..')) return ''
  return parts.join('/')
}

function payloadBytes(data, mime, size) {
  const raw = String(data || '')
  if (!raw) return Buffer.alloc(0)
  const compact = raw.replace(/\s/g, '')
  const utf8 = Buffer.from(raw, 'utf8')
  const b64 = /^[A-Za-z0-9+/]+=*$/.test(compact) && compact.length % 4 === 0
    ? Buffer.from(compact, 'base64')
    : Buffer.alloc(0)
  const want = Number(size) || 0
  if (want) {
    if (b64.length === want) return b64
    if (utf8.length === want) return utf8
  }
  const kind = String(mime || '')
  if (!kind || /^text\/|^application\/(json|xml|javascript|x-sh|vnd\.dsh)\b/i.test(kind)) {
    return utf8
  }
  return b64.length ? b64 : utf8
}

function takeDest(remaining, ...names) {
  if (!remaining.length) return ''
  const labels = names.flatMap((value) => {
    const rel = destRel(value)
    const raw = String(value || '').trim()
    return rel && rel !== raw ? [rel, raw] : [rel || raw].filter(Boolean)
  })
  const byPath = remaining.findIndex((dest) => labels.includes(dest))
  const byName = remaining.findIndex((dest) => labels.some((name) => basename(name) === basename(dest)))
  if (byPath < 0 && byName < 0) return ''
  return remaining.splice(byPath >= 0 ? byPath : byName, 1)[0] || ''
}

/**
 * Zip letter attachment indices onto workspace-relative dests.
 * @param {Array<{ index: number, name?: string, fileId?: string, mime?: string }>} atts
 * @param {string[]} dests
 */
export function attachCopyJobs(atts, dests) {
  const remaining = dests.map(destRel).filter(Boolean)
  const jobs = []
  for (const att of Array.isArray(atts) ? atts : []) {
    if (isHandoffAttach(att)) continue
    const index = Number(att && att.index)
    if (!Number.isFinite(index) || index < 0) continue
    const dest = takeDest(remaining, att && att.fileId, att && att.name)
    if (!dest) continue
    jobs.push({ index, dest })
  }
  return jobs
}

async function listLetterAtts(getAttachment, requestId) {
  const atts = []
  for (let index = 0; index < 64; index += 1) {
    const got = await getAttachment(requestId, index)
    if (!got || got.ok === false) break
    atts.push({
      index,
      name: String(got.name || ''),
      mime: String(got.mime || ''),
      fileId: String(got.fileId || got.path || ''),
    })
  }
  return atts
}

async function copyOne(getAttachment, spec, rel) {
  const cwd = String((spec && spec.workspace) || '').trim()
  if (!cwd) return { ok: false, error: 'NO_CWD', hint: '这封没绑工作区，不能另存。' }
  const got = await getAttachment(spec.requestId, spec.index)
  if (!got || got.ok === false) return got
  const dest = join(resolve(cwd), rel)
  if (!underWorkspace(cwd, dest)) return { ok: false, error: 'PATH', hint: '不能写到工作区外面。' }
  try {
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, payloadBytes(got.data, got.mime, got.size))
  } catch {
    return { ok: false, error: 'WRITE', hint: '没另存成。' }
  }
  return { ok: true, path: rel, name: basename(rel) }
}

async function copyDests(getAttachment, spec, dests) {
  const cwd = String((spec && spec.workspace) || '').trim()
  if (!cwd) return { ok: false, error: 'NO_CWD', hint: '这封没绑工作区，不能另存。', copied: 0, warnings: [] }
  const wanted = dests.map(destRel).filter(Boolean)
  const jobs = attachCopyJobs(await listLetterAtts(getAttachment, spec.requestId), wanted)
  const used = new Set(jobs.map((job) => job.dest))
  const leftover = wanted.filter((dest) => !used.has(dest))
  const warnings = leftover.length ? [`${leftover.length} 个工作区文件在信里对不上附件`] : []
  let copied = 0
  for (const job of jobs) {
    const got = await copyOne(getAttachment, {
      requestId: spec.requestId,
      index: job.index,
      workspace: cwd,
    }, job.dest)
    const landed = destRel(String((got && got.path) || ''))
    if (!got || got.ok === false) {
      warnings.push(`${basename(job.dest)}：${String((got && (got.hint || got.error)) || '没落到工作区')}`)
      continue
    }
    if (landed && landed !== job.dest) {
      warnings.push(`${basename(job.dest)}：落到了 ${landed}`)
      continue
    }
    copied += 1
  }
  return { ok: true, copied, warnings }
}

/**
 * @param {Function} fallback
 * @param {Function} getAttachment
 * @param {Record<string, unknown>} spec
 */
export async function copyLetterAttach(fallback, getAttachment, spec = {}) {
  const dests = Array.isArray(spec.dests) ? spec.dests : []
  if (dests.length) return copyDests(getAttachment, spec, dests)
  const rel = destRel(spec && spec.path)
  if (!rel) return fallback(spec)
  return copyOne(getAttachment, spec, rel)
}
