/**
 * Skill bundle occupancy: a catalog skill is a directory (or one flat md)
 * discovered by skill-filesystem. Writes stay inside that bundle.
 */
import { execFile } from 'node:child_process'
import { access, cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { canonicalWorkspaceCwd } from './cwd.mjs'
import { profileCordisPatchPath } from './mcp-archive.mjs'

const execFileAsync = promisify(execFile)
const GITHUB_REPO = /^https:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/]+)(?:\/(.*))?)?(?:\/)?(?:[?#].*)?$/i
const GITHUB_RAW = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/i
const SKILL_FETCH_MAX = 20 * 1024 * 1024

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
      const canonical = canonicalWorkspaceCwd(path)
      if (canonical) dirs.push(canonical)
      continue
    }
    break
  }
  return dirs
}

export async function skillRootsForCwd(aiRuntime, cwd) {
  const roots = []
  const absCwd = canonicalWorkspaceCwd(cwd)
  if (absCwd) {
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

async function skillDirIfPresent(dir) {
  try {
    await access(join(dir, 'SKILL.md'))
    const name = (await readSkillNameFromManifest(join(dir, 'SKILL.md'))) || sanitizeSkillName(basename(dir))
    const description = await readSkillDescriptionFromManifest(join(dir, 'SKILL.md'))
    return { name, description, path: join(dir, 'SKILL.md'), bundleRoot: dir }
  } catch {
    return null
  }
}

async function readSkillDescriptionFromManifest(file) {
  try {
    const text = await readFile(file, 'utf8')
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!match) return ''
    const line = match[1].match(/^description:\s*(.+)$/m)
    return line ? line[1].trim().replace(/^['"]|['"]$/g, '') : ''
  } catch {
    return ''
  }
}

export async function listSkillManifests(aiRuntime, cwd) {
  const roots = await skillRootsForCwd(aiRuntime, cwd)
  const out = []
  const seen = new Set()
  for (const root of roots) {
    let rows = []
    try {
      rows = await readdir(root.path, { withFileTypes: true })
    } catch {
      continue
    }
    for (const row of rows) {
      if (!row.isDirectory() && !row.isSymbolicLink()) continue
      const dir = join(root.path, row.name)
      if (row.name.startsWith('@')) {
        let scoped = []
        try {
          scoped = await readdir(dir, { withFileTypes: true })
        } catch {
          continue
        }
        for (const child of scoped) {
          if (!child.isDirectory() && !child.isSymbolicLink()) continue
          const hit = await skillDirIfPresent(join(dir, child.name))
          if (hit && !seen.has(hit.name)) {
            seen.add(hit.name)
            out.push(hit)
          }
        }
        continue
      }
      const hit = await skillDirIfPresent(dir)
      if (hit && !seen.has(hit.name)) {
        seen.add(hit.name)
        out.push(hit)
      }
    }
  }
  return out
}

export async function exposeSkillAlias(dest, destRoot) {
  const abs = resolve(dest)
  const root = resolve(destRoot)
  const manifest = join(abs, 'SKILL.md')
  const name = (await readSkillNameFromManifest(manifest)) || sanitizeSkillName(basename(abs).replace(/^@/, ''))
  if (!name || !SKILL_NAME_RE.test(name)) return
  const oneLevel = join(root, name)
  if (resolve(oneLevel) !== abs) {
    try {
      const info = await lstat(oneLevel)
      if (info.isSymbolicLink() || info.isDirectory()) await rm(oneLevel, { recursive: true, force: true })
    } catch {
      /* missing */
    }
    await symlink(abs, oneLevel)
  }
  const agentsHome = String(process.env.DSH_AGENTS_HOME || join(homedir(), '.agents')).trim()
  const agents = join(agentsHome, 'skills', name)
  if (resolve(agents) === abs) return
  await mkdir(dirname(agents), { recursive: true })
  try {
    await lstat(agents)
  } catch {
    await symlink(abs, agents)
  }
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

export function parseGithubSkillUrl(raw) {
  const text = String(raw || '').trim()
  const repo = text.match(GITHUB_REPO)
  if (repo) {
    return {
      owner: repo[1],
      repo: repo[2],
      ref: repo[3] || '',
      subpath: String(repo[4] || '').replace(/\/$/, ''),
      kind: 'archive',
    }
  }
  const file = text.match(GITHUB_RAW)
  if (file) {
    return {
      owner: file[1],
      repo: file[2],
      ref: file[3] || '',
      subpath: String(file[4] || '').replace(/\/$/, ''),
      kind: 'raw',
    }
  }
  return null
}

function fail(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

async function fetchGithubBuffer(url, fetchImpl) {
  const response = await fetchImpl(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'fde-x-desktop' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw fail('skill_source_fetch_failed', '没能从这个地址下载技能。')
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > SKILL_FETCH_MAX) throw fail('skill_source_fetch_failed', '没能从这个地址下载技能。')
  return buffer
}

async function findSkillDir(root, subpath) {
  const entries = await readdir(root, { withFileTypes: true })
  const dirs = entries.filter((row) => row.isDirectory() && row.name !== '.git' && row.name !== 'node_modules')
  const base = dirs.length === 1 ? join(root, dirs[0].name) : root
  if (subpath) {
    const target = join(base, subpath)
    try {
      const info = await stat(target)
      if (info.isFile() && basename(target).toLowerCase() === 'skill.md') return dirname(target)
      await access(join(target, 'SKILL.md'))
      return target
    } catch {
      throw fail('missing_skill_md', '这个地址里没有 SKILL.md。')
    }
  }
  const hits = []
  async function walk(dir, depth) {
    if (depth > 3) return
    let rows = []
    try {
      rows = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    if (rows.some((row) => row.isFile() && row.name.toLowerCase() === 'skill.md')) {
      hits.push(dir)
      return
    }
    for (const row of rows) {
      if (row.isDirectory() && row.name !== '.git' && row.name !== 'node_modules') {
        await walk(join(dir, row.name), depth + 1)
      }
    }
  }
  await walk(base, 0)
  if (hits.length === 1) return hits[0]
  if (hits.length > 1) throw fail('ambiguous_skill_pack', '这个仓库里有多份技能，请用带目录的地址。')
  throw fail('missing_skill_md', '这个地址里没有 SKILL.md。')
}

async function gitCloneSparse(parsed, tmp) {
  const repoDir = join(tmp, 'repo')
  const url = `https://github.com/${parsed.owner}/${parsed.repo}.git`
  const branches = parsed.ref ? [parsed.ref] : ['main', 'master']
  let cloned = false
  for (const branch of branches) {
    try {
      await execFileAsync('git', [
        'clone',
        '--depth', '1',
        '--filter=blob:none',
        '--sparse',
        `--branch=${branch}`,
        url,
        repoDir,
      ], { timeout: 60_000 })
      cloned = true
      break
    } catch {
      await rm(repoDir, { recursive: true, force: true }).catch(() => undefined)
    }
  }
  if (!cloned) throw fail('skill_source_fetch_failed', '没能从这个地址下载技能。')
  if (parsed.subpath) {
    await execFileAsync('git', ['-C', repoDir, 'sparse-checkout', 'set', parsed.subpath], { timeout: 30_000 })
  }
  return findSkillDir(repoDir, parsed.subpath)
}

async function materializeGithubSkill(parsed, fetchImpl) {
  const tmp = await mkdtemp(join(tmpdir(), 'fde-skill-src-'))
  if (parsed.kind === 'raw') {
    const url = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${parsed.ref}/${parsed.subpath}`
    const buffer = await fetchGithubBuffer(url, fetchImpl)
    await writeFile(join(tmp, 'SKILL.md'), buffer)
    return { tmp, src: tmp }
  }
  if (parsed.subpath) {
    const src = await gitCloneSparse(parsed, tmp)
    return { tmp, src }
  }
  const refs = parsed.ref ? [parsed.ref] : ['HEAD', 'main', 'master']
  let buffer = null
  for (const ref of refs) {
    const url = `https://github.com/${parsed.owner}/${parsed.repo}/archive/${encodeURIComponent(ref)}.tar.gz`
    try {
      buffer = await fetchGithubBuffer(url, fetchImpl)
      break
    } catch {
      buffer = null
    }
  }
  if (!buffer) throw fail('skill_source_fetch_failed', '没能从这个地址下载技能。')
  const archive = join(tmp, 'pack.tar.gz')
  await writeFile(archive, buffer)
  await execFileAsync('tar', ['-xzf', archive, '-C', tmp])
  await rm(archive, { force: true })
  return { tmp, src: await findSkillDir(tmp, parsed.subpath) }
}

function tokenizeArgs(raw) {
  return String(raw || '')
    .trim()
    .match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)
    ?.map((token) => token.replace(/^['"]|['"]$/g, '')) || []
}

function takeFlag(tokens, name, short = '') {
  const long = `--${name}`
  const dash = short ? `-${short}` : ''
  const out = []
  let value = ''
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token === long || (dash && token === dash)) {
      value = tokens[i + 1] || ''
      i += 1
      continue
    }
    if (token.startsWith(`${long}=`)) {
      value = token.slice(long.length + 1)
      continue
    }
    out.push(token)
  }
  return { tokens: out, value }
}

export function parseSkillInstallSource(raw) {
  const text = String(raw || '').trim().replace(/^\$\s*/, '')
  if (!text) return { kind: 'empty' }
  const npxMatch = text.match(/^npx\s+(?:--yes\s+)?skills\s+add\s+(.+)$/i) || text.match(/^skills\s+add\s+(.+)$/i)
  if (npxMatch) {
    let tokens = tokenizeArgs(npxMatch[1]).filter((token) => token !== '-y' && token !== '--yes' && token !== '--copy' && token !== '-g' && token !== '--global')
    const skillFlag = takeFlag(tokens, 'skill', 's')
    tokens = skillFlag.tokens.filter((token) => token !== '--all')
    const pkg = tokens.find((token) => !token.startsWith('-')) || ''
    if (!pkg) return { kind: 'npx', package: '', skill: skillFlag.value }
    return { kind: 'npx', package: pkg, skill: skillFlag.value }
  }
  const clawMatch = text.match(/^clawhub\s+install\s+(.+)$/i)
  if (clawMatch) {
    let tokens = tokenizeArgs(clawMatch[1]).filter((token) => token !== '--force' && token !== '--no-input')
    const version = takeFlag(tokens, 'version')
    const slug = version.tokens.find((token) => !token.startsWith('-')) || ''
    return { kind: 'clawhub', slug, version: version.value }
  }
  const github = parseGithubSkillUrl(text)
  if (github) return { kind: 'github', github }
  const clawUrl = text.match(/^https:\/\/(?:www\.)?clawhub\.(?:com|ai)\/(?:s\/)?(?:[^/]+\/)?([a-z0-9-]+)\/?$/i)
  if (clawUrl) return { kind: 'clawhub', slug: clawUrl[1], version: '' }
  const clawPrefix = text.match(/^clawhub:([a-z0-9-]+)$/i)
  if (clawPrefix) return { kind: 'clawhub', slug: clawPrefix[1], version: '' }
  if (/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+(?:@[A-Za-z0-9._/-]+)?$/.test(text)) {
    const at = text.indexOf('@')
    if (at > 0) return { kind: 'npx', package: text.slice(0, at), skill: text.slice(at + 1) }
    return { kind: 'npx', package: text, skill: '' }
  }
  return { kind: 'local', path: text }
}

async function copySkillIntoRoot(src, destRoot) {
  const info = await stat(src)
  let name = ''
  if (info.isFile()) {
    name = (await readSkillNameFromManifest(src)) || sanitizeSkillName(basename(src, '.md'))
  } else {
    const manifest = join(src, 'SKILL.md')
    try {
      await access(manifest)
    } catch {
      throw fail('missing_skill_md', '这个地址里没有 SKILL.md。')
    }
    name = (await readSkillNameFromManifest(manifest)) || sanitizeSkillName(basename(src))
  }
  if (!SKILL_NAME_RE.test(name)) throw fail('invalid_skill_name', '技能名不合法')
  const dest = join(destRoot, name)
  const rel = relative(destRoot, dest)
  if (rel.startsWith('..')) throw fail('path_outside_bundle', 'path_outside_bundle')
  await mkdir(destRoot, { recursive: true })
  await rm(dest, { recursive: true, force: true })
  if (info.isFile()) {
    await mkdir(dest, { recursive: true })
    await cp(src, join(dest, 'SKILL.md'))
  } else {
    await cp(src, dest, { recursive: true })
  }
  await exposeSkillAlias(dest, destRoot)
  return { name, dest, path: join(dest, 'SKILL.md') }
}

async function collectSkillDirs(root) {
  const hits = []
  async function walk(dir, depth) {
    if (depth > 5) return
    let rows = []
    try {
      rows = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    if (rows.some((row) => row.isFile() && row.name.toLowerCase() === 'skill.md')) {
      hits.push(dir)
      return
    }
    for (const row of rows) {
      if (row.isDirectory() && row.name !== '.git' && row.name !== 'node_modules') {
        await walk(join(dir, row.name), depth + 1)
      }
    }
  }
  await walk(root, 0)
  return hits
}

function execErrorText(error) {
  if (!error || typeof error !== 'object') return String(error || '')
  const stderr = String(error.stderr || '').trim()
  const stdout = String(error.stdout || '').trim()
  const message = String(error.message || '').trim()
  return stderr || stdout || message
}

async function installFromClawhub(parsed, destRoot) {
  const slug = String(parsed.slug || '').trim()
  if (!slug) throw fail('invalid_skill_source', 'clawhub 需要技能名。')
  const args = ['--workdir', dirname(destRoot), '--dir', basename(destRoot), '--no-input', 'install', slug, '--force']
  if (parsed.version) args.push('--version', parsed.version)
  let lastError = null
  try {
    await execFileAsync('npx', ['--yes', 'clawhub@latest', ...args], {
      timeout: 90_000,
      env: { ...process.env, npm_config_yes: 'true' },
    })
  } catch (error) {
    lastError = error
    try {
      await execFileAsync('clawhub', args, { timeout: 90_000 })
      lastError = null
    } catch (fallback) {
      lastError = fallback
    }
  }
  if (lastError) {
    if (lastError.code === 'ENOENT') throw fail('clawhub_missing', '本机没有 clawhub。先安装 clawhub CLI。')
    const detail = execErrorText(lastError).replace(/^Error:\s*/i, '').trim()
    throw fail('clawhub_install_failed', detail ? `ClawHub 无法安装 ${slug}。${detail}` : `ClawHub 无法安装 ${slug}。`)
  }
  const dest = join(destRoot, slug)
  try {
    await access(join(dest, 'SKILL.md'))
  } catch {
    throw fail('missing_skill_md', '这个地址里没有 SKILL.md。')
  }
  const name = (await readSkillNameFromManifest(join(dest, 'SKILL.md'))) || sanitizeSkillName(slug.replace(/^@/, '').replace(/\//g, '-')) || slug
  await exposeSkillAlias(dest, destRoot)
  return { name, dest, path: join(dest, 'SKILL.md') }
}

async function installFromNpx(parsed, destRoot) {
  const pkg = String(parsed.package || '').trim()
  if (!pkg) throw fail('invalid_skill_source', 'npx skills 需要包名。')
  const tmp = await mkdtemp(join(tmpdir(), 'fde-skill-npx-'))
  await writeFile(join(tmp, 'package.json'), '{"name":"fde-skill-tmp","private":true}\n')
  const args = ['--yes', 'skills', 'add', pkg, '-y', '--copy']
  if (parsed.skill) args.push('--skill', parsed.skill)
  try {
    await execFileAsync('npx', args, { cwd: tmp, timeout: 90_000, env: { ...process.env, npm_config_yes: 'true' } })
    const hits = await collectSkillDirs(tmp)
    if (!hits.length) throw fail('missing_skill_md', '这个地址里没有 SKILL.md。')
    let last = null
    for (const dir of hits) last = await copySkillIntoRoot(dir, destRoot)
    return last
  } catch (error) {
    if (error && ['missing_skill_md', 'invalid_skill_name', 'path_outside_bundle'].includes(error.code)) throw error
    throw fail('npx_skill_failed', error instanceof Error ? error.message : 'npx skills 没有装上。')
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function installSkillBundle({ source, root, fetch: fetchImpl } = {}) {
  const destRoot = resolve(root)
  const parsed = parseSkillInstallSource(source)
  if (parsed.kind === 'clawhub') return installFromClawhub(parsed, destRoot)
  if (parsed.kind === 'npx') return installFromNpx(parsed, destRoot)
  let src = ''
  let tmp = ''
  if (parsed.kind === 'github') {
    const got = await materializeGithubSkill(parsed.github, fetchImpl || globalThis.fetch.bind(globalThis))
    tmp = got.tmp
    src = got.src
  } else if (parsed.kind === 'local') {
    src = resolve(parsed.path)
  } else {
    throw fail('invalid_skill_source', '来源可以是本机目录、GitHub 地址、npx skills add，或 clawhub install。')
  }
  try {
    return await copySkillIntoRoot(src, destRoot)
  } finally {
    if (tmp) await rm(tmp, { recursive: true, force: true }).catch(() => undefined)
  }
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
