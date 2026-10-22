/**
 * Hand mailbox attachments to dsh-eyes only after a click.
 * Eyes is optional: no see_file / see_image tool means no eyes.
 * @module dsh-lan-assist/eyes-bridge
 */

import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'

function toolsOf(ctx) {
  return (ctx && ctx.tools) || (ctx && typeof ctx.get === 'function' && ctx.get('tools')) || undefined
}

function toolNamed(tools, name) {
  if (!tools || typeof tools.get !== 'function') return undefined
  const row = tools.get(name)
  return row && typeof row.execute === 'function' ? row : undefined
}

export function hasEyes(ctx) {
  const tools = toolsOf(ctx)
  return !!(toolNamed(tools, 'see_file') || toolNamed(tools, 'see_image'))
}

function looksImage(name, mime) {
  return /^image\//i.test(String(mime || '')) || /\.(png|jpe?g|gif|webp)$/i.test(String(name || ''))
}

function fileExt(name, mime) {
  const ext = extname(String(name || '')).toLowerCase()
  if (ext && ext.length <= 8) return ext
  if (/png/i.test(mime)) return '.png'
  if (/jpe?g/i.test(mime)) return '.jpg'
  if (/pdf/i.test(mime)) return '.pdf'
  if (/webp/i.test(mime)) return '.webp'
  return '.bin'
}

function safeStem(name) {
  const stem = String(name || 'file').replace(/[/\\?%*:|"<>]/g, '_').replace(/\.[^.]+$/, '')
  return (stem || 'file').slice(0, 40)
}

function asDataUrl(data, mime) {
  const raw = String(data || '')
  if (raw.startsWith('data:')) return raw
  return `data:${mime || 'image/png'};base64,${raw}`
}

async function writeSeeFile(name, mime, data) {
  const dir = join(tmpdir(), 'dsh-lan-assist-see')
  await mkdir(dir, { recursive: true })
  const dest = join(dir, `${Date.now()}-${safeStem(name)}${fileExt(name, mime)}`)
  const raw = String(data || '')
  const buf = raw.startsWith('data:')
    ? Buffer.from(raw.replace(/^data:[^;]+;base64,/, ''), 'base64')
    : Buffer.from(raw, 'base64')
  await writeFile(dest, buf)
  return dest
}

function seenText(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^dsh-eyes could not look/i.test(text)) return ''
  return text
}

/**
 * @param {any} ctx
 */
export function createEyesSee(ctx) {
  return async function see(spec) {
    if (!hasEyes(ctx)) return { ok: false, error: 'NO_EYES' }
    const tools = toolsOf(ctx)
    const list = Array.isArray(spec && spec.attachments) ? spec.attachments : []
    const first = list.find((row) => row && (row.data || row.bytes))
    if (!first) return { ok: false, error: 'NO_FILE' }
    const name = String(first.name || 'file')
    const mime = String(first.mime || '')
    const data = String(first.data || first.bytes || '')
    const question = 'Describe this attachment. Read visible text. Do not claim a contract is fully read.'
    const seeImage = toolNamed(tools, 'see_image')
    const seeFile = toolNamed(tools, 'see_file')
    const exec = {}
    let dest = ''
    try {
      let raw
      if (looksImage(name, mime) && seeImage) {
        raw = await seeImage.execute({ question, image: asDataUrl(data, mime) }, exec)
      } else if (seeFile) {
        dest = await writeSeeFile(name, mime, data)
        raw = await seeFile.execute({ question, file: dest }, exec)
      } else if (seeImage) {
        raw = await seeImage.execute({ question, image: asDataUrl(data, mime) }, exec)
      } else {
        return { ok: false, error: 'NO_EYES' }
      }
      const text = seenText(raw)
      if (!text) return { ok: false, error: 'UNSEEN' }
      return { ok: true, text }
    } catch {
      return { ok: false, error: 'UNSEEN' }
    } finally {
      if (dest) await unlink(dest).catch(() => undefined)
    }
  }
}
