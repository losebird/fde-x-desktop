/**
 * Files dsh-eyes can turn into text. Audio is not included.
 * Prefer eyes converters (PDF / old Office). Vision describe is optional.
 * @module dsh-semantic-os/eyes-media
 */

import { extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const EYES_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif',
  '.pdf',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v',
])

export const EYES_QUESTION = '用中文写下看见的字、标题、表、物品、人、店。只写看见的，不要猜。看不清就写看不清。'

const EXT = 'png|jpe?g|webp|gif|pdf|docx?|xlsx?|pptx?|mp4|webm|mov|mkv|avi|m4v'
const PATH_RE = new RegExp(
  `(?:^|[\\s"'\`=（【])(\\/(?:[^\\s"'<>|*?]+)\\.(?:${EXT}))(?=$|[\\s"'\`。，、；：！？)）】])`,
  'gi',
)

export function isEyesPath(path) {
  const ext = extname(String(path || '')).toLowerCase()
  return EYES_EXTS.has(ext)
}

export function pathsFromText(text) {
  const out = []
  const seen = new Set()
  const raw = String(text || '')
  PATH_RE.lastIndex = 0
  let match
  while ((match = PATH_RE.exec(raw))) {
    const path = match[1]
    if (!path || seen.has(path) || !isEyesPath(path)) continue
    seen.add(path)
    out.push(path)
  }
  return out
}

function eyesConvertUrl() {
  const homes = [process.env.DSH_HOME, join(homedir(), '.dsh')].filter(Boolean)
  for (const home of homes) {
    const pkg = join(home, 'profiles/web/node_modules/dsh-eyes/package.json')
    if (!existsSync(pkg)) continue
    try {
      const resolved = createRequire(pkg).resolve('./convert.js')
      return pathToFileURL(resolved).href
    } catch {
      /* next */
    }
  }
  return ''
}

/**
 * Read printable text via dsh-eyes converters. No vision model.
 */
export async function extractEyesText(path) {
  const abs = String(path || '')
  if (!abs || !isEyesPath(abs)) return ''
  const href = eyesConvertUrl()
  if (!href) return ''
  try {
    const conv = await import(href)
    const ext = extname(abs).toLowerCase()
    if (ext === '.pdf' && typeof conv.extractPdfText === 'function') {
      const got = await conv.extractPdfText(abs)
      return got && got.text ? String(got.text).trim() : ''
    }
    if ((ext === '.doc' || ext === '.xls' || ext === '.ppt') && typeof conv.extractLegacyOfficeText === 'function') {
      const got = await conv.extractLegacyOfficeText(abs, ext)
      return got && got.text ? String(got.text).trim() : ''
    }
  } catch {
    return ''
  }
  return ''
}

/**
 * @param {{ describe?: Function, see?: Function } | null | undefined} eyes
 * @param {string} path
 * @param {string} [question]
 */
export async function describePath(eyes, path, question) {
  const extracted = await extractEyesText(path)
  if (extracted) return extracted
  if (!eyes) return ''
  if (typeof eyes.describe === 'function') {
    const described = await eyes.describe({
      path,
      question: question || EYES_QUESTION,
      mode: 'see',
    }).catch(() => null)
    if (described && described.text) return String(described.text).trim()
  }
  if (typeof eyes.see === 'function') {
    const seen = await eyes.see({
      path,
      question: question || EYES_QUESTION,
    }).catch(() => null)
    if (seen && seen.text) return String(seen.text).trim()
    if (typeof seen === 'string' && seen.trim()) return seen.trim()
  }
  return ''
}
