/**
 * Skill bundle occupancy: a catalog skill is a directory (or one flat md)
 * discovered by skill-filesystem. Writes stay inside that bundle.
 */
import { access, cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { profileCordisPatchPath } from './mcp-archive.mjs'

export const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function sanitizeSkillName(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function bundleRootFromPath(skillPath) {
  const abs = resolve(String(skillPath || ''))
  if (basename(abs).toLowerCase() === 'skill.md') return dirname(abs)
  return abs
}

export function skillManifestPath(bundleRoot) {
  const abs = resolve(String(bundleRoot || ''))
  if (basename(abs).toLowerCase() === 'skill.md') return abs
  return join(abs, 'SKILL.md')
}

export async function findProjectRoot(cwd) {
  const start = resolve(String(cwd || ''))
  let current = start
  while (true) {
    try {
      await access(join(current, '.git'))
      return current
    } catch {
      /* walk up */
    }
    const parent = dirname(current)
    if (parent === current) return start
    current = parent
  }
}

export function parseSkillCustomDirs(text) {
  const lines = String(text || '').split('\n')
  const start = lines.findIndex((line) => /^\s*- id:\s*skill-filesystem\b/.test(line) || /^\s*id:\s*skill-filesystem\b/.test(line))
  if (start < 0) return []
  const base = (lines[start].match(/^(\s*)/) || ['', ''])[1].length
  const dirs = []
  let inList = false
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line.trim()) continue
    const indent = (line.match(/^(\s*)/) || ['', ''])[1].length
    if (indent <= base && (/^- /.test(line.trim()) || /^- id:/.test(line) || /^id:/.test(line.trim()))) break
    if (/customSkillDirs:\s*$/.test(line)) {
      inList = true
      continue
    }
    if (!inList) continue
    const item = line.match(/^\s+-\s+(.+)$/)
    if (item) {
      const path = item[1].trim().replace(/^['"]|['"]$/g, '')
      if (path.startsWith('/')) dirs.push(path)
      continue
    }
    break
  }
  return dirs
}

export async function skillRootsForCwd(aiRuntime, cwd) {
  const roots = []
  const absCwd = String(cwd || '').trim()
  if (absCwd.startsWith('/')) {
    const projectRoot = await findProjectRoot(absCwd)
    roots.push(
      { path: join(projectRoot, '.dsh', 'skills'), source: 'project-dsh' },
      { path: join(projectRoot, '.agents', 'skills'), source: 'project-agents' },
    )
  }
  let patch = ''
  const file = profileCordisPatchPath(aiRuntime)
  if (file) {
    try { patch = await readFile(file, 'utf8') } catch { patch = '' }
  }
  for (const dir of parseSkillCustomDirs(patch)) {
    roots.push({ path: resolve(dir), source: 'custom' })
  }
  const dshHome = String((aiRuntime && aiRuntime.dshHome) || process.env.FDE_DSH_HOME || '').trim()
  const agentsHome = String(process.env.DSH_AGENTS_HOME || join(homedir(), '.agents')).trim()
  if (dshHome) roots.push({ path: join(dshHome, 'skills'), source: 'user-dsh' })
  if (agentsHome) roots.push({ path: join(agentsHome, 'skills'), source: 'user-agents' })
  const seen = new Set()
  return roots.filter((row) => {
    const key = resolve(row.path)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function confinedRelPath(bundleRoot, rel) {
  const root = resolve(bundleRoot)
  const target = resolve(root, String(rel || ''))
  const walked = relative(root, target)
  if (walked.startsWith('..') || walked.startsWith(`..${sep}`)) {
    const err = new Error('path_outside_bundle')
    err.code = 'path_outside_bundle'
    throw err
  }
  return { abs: target, rel: walked.split(sep).join('/') }
}

export async function listBundleFiles(bundleRoot) {
  const root = resolve(bundleRoot)
  const info = await stat(root)
  if (info.isFile()) return [{ rel: basename(root), type: 'file' }]
  const out = []
  const walk = async (dir, prefix) => {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === '.git') continue
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      const abs = join(dir, entry.name)
      if (entry.isDirectory()) {
        out.push({ rel, type: 'dir' })
        await walk(abs, rel)
        continue
      }
      if (entry.isFile() || entry.isSymbolicLink()) out.push({ rel, type: 'file' })
    }
  }
  await walk(root, '')
  out.sort((a, b) => a.rel.localeCompare(b.rel))
  return out
}

export function setFrontmatterFlag(text, key, value) {
  const source = String(text || '')
  const match = source.match(/^(---\r?\n)([\s\S]*?)(\r?\n---[ \t]*\r?\n?)/)
  if (!match) {
    if (value === undefined) return source
    return `---\n${key}: ${value}\n---\n${source}`
  }
  const body = match[2]
  const lineRe = new RegExp(`^${key}:\\s*.*$`, 'm')
  let nextBody = body
  if (value === undefined) {
    nextBody = body.split('\n').filter((line) => !new RegExp(`^${key}:\\s*`).test(line)).join('\n')
  } else if (lineRe.test(body)) {
    nextBody = body.replace(lineRe, `${key}: ${value}`)
  } else {
    nextBody = `${body.replace(/\s+$/, '')}\n${key}: ${value}`
  }
  return `${match[1]}${nextBody}${match[3]}${source.slice(match[0].length)}`
}

export async function setSkillModelInvocable(manifestPath, modelInvocable) {
  const text = await readFile(manifestPath, 'utf8')
  const next = modelInvocable
    ? setFrontmatterFlag(text, 'disable-model-invocation', undefined)
    : setFrontmatterFlag(text, 'disable-model-invocation', true)
  await writeFile(manifestPath, next)
  return next
}

export async function readSkillNameFromManifest(file) {
  const text = await readFile(file, 'utf8')
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return ''
  const name = match[1].match(/^name:\s*(.+)$/m)
  if (!name) return ''
  return sanitizeSkillName(name[1].trim().replace(/^['"]|['"]$/g, ''))
}

export async function installSkillBundle({ source, root }) {
  const src = resolve(source)
  const destRoot = resolve(root)
  const info = await stat(src)
  let name = ''
  if (info.isFile()) {
    name = (await readSkillNameFromManifest(src)) || sanitizeSkillName(basename(src, '.md'))
  } else {
    const manifest = join(src, 'SKILL.md')
    try {
      await access(manifest)
    } catch {
      const err = new Error('missing_skill_md')
      err.code = 'missing_skill_md'
      throw err
    }
    name = (await readSkillNameFromManifest(manifest)) || sanitizeSkillName(basename(src))
  }
  if (!SKILL_NAME_RE.test(name)) {
    const err = new Error('invalid_skill_name')
    err.code = 'invalid_skill_name'
    throw err
  }
  const dest = join(destRoot, name)
  const rel = relative(destRoot, dest)
  if (rel.startsWith('..')) {
    const err = new Error('path_outside_bundle')
    err.code = 'path_outside_bundle'
    throw err
  }
  await mkdir(destRoot, { recursive: true })
  await rm(dest, { recursive: true, force: true })
  if (info.isFile()) {
    await mkdir(dest, { recursive: true })
    await cp(src, join(dest, 'SKILL.md'))
  } else {
    await cp(src, dest, { recursive: true })
  }
  return { name, dest, path: join(dest, 'SKILL.md') }
}

export async function uninstallSkillBundle(bundleRoot) {
  const abs = resolve(bundleRoot)
  await rm(abs, { recursive: true, force: true })
}

export function pathUnderCwd(absPath, cwd) {
  const root = resolve(String(cwd || ''))
  const target = resolve(absPath)
  const walked = relative(root, target)
  if (walked.startsWith('..')) return null
  return walked.split(sep).join('/') || '.'
}

export function bundleInRoots(bundleRoot, roots) {
  const abs = resolve(bundleRoot)
  for (const row of Array.isArray(roots) ? roots : []) {
    const walked = relative(resolve(row.path), abs)
    if (walked && !walked.startsWith('..')) return row
    if (walked === '') return row
  }
  return null
}
