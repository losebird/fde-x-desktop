import { randomBytes } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { canonicalWorkspaceCwd } from './cwd.mjs'
import {
  copySkillIntoRoot,
  parseSkillInstallSource,
  sanitizeSkillName,
  SKILL_NAME_RE,
  stageSkillSource,
} from './skill-bundle.mjs'
import { scanAdvice, scanSkillPack } from './skill-scan.mjs'

const CLAWHUB = 'https://clawhub.ai'
const previews = new Map()
const PREVIEW_TTL_MS = 30 * 60 * 1000

function fail(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

export function parseSkillInstallQuery(raw) {
  const text = String(raw || '').trim()
  const parsed = parseSkillInstallSource(text)
  if (parsed.kind === 'empty') return parsed
  if (parsed.kind !== 'local') return parsed
  const path = String(parsed.path || '').trim()
  const abs = canonicalWorkspaceCwd(path)
  if (abs) return parsed
  if (path.startsWith('.') || path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) return parsed
  if (/^@[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(path) || SKILL_NAME_RE.test(sanitizeSkillName(path))) {
    return { kind: 'clawhub', slug: path, version: '' }
  }
  return parsed
}

async function readJson(response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function searchClawhub(query, { fetchImpl } = {}) {
  const q = String(query || '').trim()
  if (!q) return []
  const fetchFn = fetchImpl || globalThis.fetch.bind(globalThis)
  const exactUrl = `${CLAWHUB}/api/v1/search?q=${encodeURIComponent(q)}&mode=exact&limit=8`
  const wideUrl = `${CLAWHUB}/api/v1/search?q=${encodeURIComponent(q)}&limit=8`
  const hits = []
  for (const url of [exactUrl, wideUrl]) {
    let response
    try {
      response = await fetchFn(url, { headers: { accept: 'application/json' } })
    } catch {
      continue
    }
    if (!response || !response.ok) continue
    const body = await readJson(response)
    const rows = Array.isArray(body?.results) ? body.results : Array.isArray(body?.items) ? body.items : []
    for (const row of rows) {
      const slug = String(row.slug || '').trim()
      if (!slug) continue
      hits.push({
        slug,
        displayName: String(row.displayName || row.display_name || slug),
        summary: String(row.summary || ''),
        version: String(row.version || row.latestVersion?.version || ''),
      })
    }
    if (hits.length) break
  }
  const seen = new Set()
  return hits.filter((row) => {
    if (seen.has(row.slug)) return false
    seen.add(row.slug)
    return true
  })
}

export async function resolveSkillQuery(query, { fetchImpl } = {}) {
  const text = String(query || '').trim()
  const parsed = parseSkillInstallQuery(text)
  if (parsed.kind === 'empty') return { found: false, hint: '要填写技能名称。', parsed }
  if (parsed.kind === 'local' || parsed.kind === 'github' || parsed.kind === 'npx') {
    return { found: true, source: text, origin: parsed.kind, parsed, matches: [] }
  }
  const slug = String(parsed.slug || '').trim()
  const matches = await searchClawhub(slug, { fetchImpl })
  const exact = matches.find((row) => row.slug === slug || row.slug.endsWith(`/${slug}`))
  const pick = exact || matches[0]
  if (!pick) {
    return {
      found: false,
      hint: '没有找到这个技能。请核对名称，或提供安装地址 / 命令。',
      parsed,
      matches: [],
    }
  }
  return {
    found: true,
    source: `clawhub install ${pick.slug}`,
    origin: 'clawhub',
    parsed: { kind: 'clawhub', slug: pick.slug, version: pick.version || '' },
    match: pick,
    matches,
  }
}

function prunePreviews() {
  const now = Date.now()
  for (const [id, row] of previews) {
    if (!row || row.expires < now) {
      if (row?.tmp) rm(row.tmp, { recursive: true, force: true }).catch(() => undefined)
      previews.delete(id)
    }
  }
}

export function getSkillPreview(id) {
  prunePreviews()
  return previews.get(String(id || '')) || null
}

export async function previewSkillInstall(query, { fetchImpl } = {}) {
  prunePreviews()
  const resolved = await resolveSkillQuery(query, { fetchImpl })
  if (!resolved.found) {
    return {
      found: false,
      hint: resolved.hint,
      matches: resolved.matches || [],
    }
  }
  let staged
  try {
    staged = await stageSkillSource(resolved.source, fetchImpl)
  } catch (error) {
    const text = String(error && error.message || '')
    if (error && error.code === 'clawhub_install_failed' && /AMBIGUOUS_SKILL_SLUG/.test(text)) {
      return {
        found: false,
        hint: '有多个同名技能。请核对该用哪一个，或粘贴完整安装地址 / 命令。',
        matches: resolved.matches || [],
      }
    }
    throw error
  }
  const scan = await scanSkillPack(staged.src)
  const id = `prv_${randomBytes(8).toString('hex')}`
  previews.set(id, {
    id,
    tmp: staged.tmp,
    src: staged.src,
    name: staged.name,
    origin: resolved.origin,
    source: resolved.source,
    match: resolved.match || null,
    scan,
    expires: Date.now() + PREVIEW_TTL_MS,
  })
  return {
    found: true,
    previewId: id,
    name: staged.name,
    origin: resolved.origin,
    source: resolved.source,
    match: resolved.match || null,
    scan: {
      engine: scan.engine,
      score: scan.score,
      verdict: scan.verdict,
      findings: scan.findings,
      advice: scanAdvice(scan),
    },
  }
}

export async function installSkillPreview(previewId, root) {
  prunePreviews()
  const row = previews.get(String(previewId || ''))
  if (!row) throw fail('preview_expired', '预览已过期，请重新查找。')
  const installed = await copySkillIntoRoot(row.src, root)
  if (row.tmp) await rm(row.tmp, { recursive: true, force: true }).catch(() => undefined)
  previews.delete(row.id)
  return installed
}

export { seedBuiltinSkills } from './skill-seed.mjs'
