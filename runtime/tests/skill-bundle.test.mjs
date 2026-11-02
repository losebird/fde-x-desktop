import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  bundleRootFromPath,
  confinedRelPath,
  exposeSkillAlias,
  installSkillBundle,
  listBundleFiles,
  listSkillManifests,
  parseGithubSkillUrl,
  parseSkillInstallSource,
  parseSkillCustomDirs,
  pathUnderCwd,
  sanitizeSkillName,
  setFrontmatterFlag,
  setSkillModelInvocable,
  skillRootsForCwd,
  SKILL_NAME_RE,
} from '../skill-bundle.mjs'

test('bundleRootFromPath uses the SKILL.md directory', () => {
  assert.equal(bundleRootFromPath('/tmp/foo/SKILL.md'), '/tmp/foo')
  assert.equal(bundleRootFromPath('/tmp/foo.md'), '/tmp/foo.md')
})

test('confinedRelPath stays inside the bundle', () => {
  const inside = confinedRelPath('/tmp/bundle', 'scripts/run.mjs')
  assert.equal(inside.rel, 'scripts/run.mjs')
  assert.throws(() => confinedRelPath('/tmp/bundle', '../escape'), { code: 'path_outside_bundle' })
})

test('setFrontmatterFlag writes and clears disable-model-invocation', () => {
  const src = '---\nname: demo\n---\nbody\n'
  const off = setFrontmatterFlag(src, 'disable-model-invocation', true)
  assert.match(off, /disable-model-invocation: true/)
  const on = setFrontmatterFlag(off, 'disable-model-invocation', undefined)
  assert.equal(/disable-model-invocation:/.test(on), false)
  assert.match(on, /name: demo/)
  assert.match(on, /body/)
})

test('installSkillBundle copies a directory pack into the chosen root', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-skill-'))
  const src = join(dir, 'pack')
  const root = join(dir, 'skills')
  await mkdir(join(src, 'scripts'), { recursive: true })
  await writeFile(join(src, 'SKILL.md'), '---\nname: demo-pack\ndescription: x\n---\n# hi\n')
  await writeFile(join(src, 'scripts', 'run.mjs'), 'export {}\n')
  const installed = await installSkillBundle({ source: src, root })
  assert.equal(installed.name, 'demo-pack')
  const files = await listBundleFiles(installed.dest)
  assert.ok(files.some((row) => row.rel === 'SKILL.md'))
  assert.ok(files.some((row) => row.rel === 'scripts/run.mjs'))
  const text = await readFile(join(installed.dest, 'SKILL.md'), 'utf8')
  const next = await setSkillModelInvocable(join(installed.dest, 'SKILL.md'), false)
  assert.match(next, /disable-model-invocation: true/)
  assert.equal(pathUnderCwd(join(installed.dest, 'scripts', 'run.mjs'), dir), `skills/${installed.name}/scripts/run.mjs`.replace(/\\/g, '/'))
  await rm(dir, { recursive: true, force: true })
})

test('parseSkillInstallSource reads npx, clawhub, github, and local', () => {
  assert.deepEqual(parseSkillInstallSource('npx skills add vercel-labs/agent-skills --skill react-best-practices -y'), {
    kind: 'npx', package: 'vercel-labs/agent-skills', skill: 'react-best-practices',
  })
  assert.deepEqual(parseSkillInstallSource('owner/repo@foo'), {
    kind: 'npx', package: 'owner/repo', skill: 'foo',
  })
  assert.deepEqual(parseSkillInstallSource('clawhub install summarize --version 1.2.3'), {
    kind: 'clawhub', slug: 'summarize', version: '1.2.3',
  })
  assert.deepEqual(parseSkillInstallSource('clawhub install @cua/driver'), {
    kind: 'clawhub', slug: '@cua/driver', version: '',
  })
  assert.equal(parseSkillInstallSource('https://clawhub.com/summarize').kind, 'clawhub')
  assert.equal(parseSkillInstallSource('https://github.com/acme/demo').kind, 'github')
  assert.equal(parseSkillInstallSource('/tmp/my-skill').kind, 'local')
})

test('parseGithubSkillUrl reads repo, tree, and raw URLs', () => {
  assert.deepEqual(parseGithubSkillUrl('https://github.com/acme/demo'), {
    owner: 'acme', repo: 'demo', ref: '', subpath: '', kind: 'archive',
  })
  assert.deepEqual(parseGithubSkillUrl('https://github.com/acme/demo/tree/main/skills/foo'), {
    owner: 'acme', repo: 'demo', ref: 'main', subpath: 'skills/foo', kind: 'archive',
  })
  assert.deepEqual(parseGithubSkillUrl('https://raw.githubusercontent.com/acme/demo/main/SKILL.md'), {
    owner: 'acme', repo: 'demo', ref: 'main', subpath: 'SKILL.md', kind: 'raw',
  })
  assert.equal(parseGithubSkillUrl('https://example.com/skill'), null)
})

test('installSkillBundle installs from a GitHub archive URL', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-skill-gh-'))
  const archiveDir = join(dir, 'demo-main')
  const root = join(dir, 'skills')
  await mkdir(join(archiveDir, 'scripts'), { recursive: true })
  await writeFile(join(archiveDir, 'SKILL.md'), '---\nname: demo-pack\ndescription: x\n---\n# hi\n')
  await writeFile(join(archiveDir, 'scripts', 'run.mjs'), 'export {}\n')
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  await promisify(execFile)('tar', ['-czf', join(dir, 'pack.tar.gz'), '-C', dir, 'demo-main'])
  const tar = await readFile(join(dir, 'pack.tar.gz'))
  const installed = await installSkillBundle({
    source: 'https://github.com/acme/demo',
    root,
    fetch: async (url) => {
      assert.match(String(url), /github\.com\/acme\/demo\/archive/)
      return { ok: true, arrayBuffer: async () => tar }
    },
  })
  assert.equal(installed.name, 'demo-pack')
  const files = await listBundleFiles(installed.dest)
  assert.ok(files.some((row) => row.rel === 'SKILL.md'))
  assert.ok(files.some((row) => row.rel === 'scripts/run.mjs'))
  await rm(dir, { recursive: true, force: true })
})

test('sanitizeSkillName matches Host kebab names', () => {
  assert.equal(sanitizeSkillName('Demo Pack'), 'demo-pack')
  assert.equal(SKILL_NAME_RE.test('demo-pack'), true)
  assert.equal(SKILL_NAME_RE.test('Demo'), false)
})

test('parseSkillCustomDirs reads filesystem provider dirs', () => {
  const text = `- id: llm-pi-ai\n  name: x\n- id: skill-filesystem\n  name: "@deepseek-ai/dsh-skill-filesystem"\n  config:\n    customSkillDirs:\n      - /tmp/extra-skills\n- id: tool-skill\n  name: y\n`
  assert.deepEqual(parseSkillCustomDirs(text), ['/tmp/extra-skills'])
})

test('listSkillManifests finds ClawHub scoped @org/name packs', async () => {
  const previous = process.env.FDE_DSH_HOME
  const previousAgents = process.env.DSH_AGENTS_HOME
  const home = await mkdtemp(join(tmpdir(), 'fde-skill-scope-'))
  process.env.FDE_DSH_HOME = home
  process.env.DSH_AGENTS_HOME = join(home, 'agents')
  try {
    const dest = join(home, 'skills', '@cua', 'driver')
    await mkdir(dest, { recursive: true })
    await writeFile(join(dest, 'SKILL.md'), '---\nname: cua-driver\ndescription: Drive a GUI\n---\n# x\n')
    const rows = await listSkillManifests({ dshHome: home }, '')
    const hit = rows.find((row) => row.name === 'cua-driver')
    assert.ok(hit)
    assert.match(hit.path, /@cua\/driver\/SKILL.md/)
    await exposeSkillAlias(dest, join(home, 'skills'))
    const alias = join(home, 'skills', 'cua-driver', 'SKILL.md')
    const text = await readFile(alias, 'utf8')
    assert.match(text, /name: cua-driver/)
  } finally {
    if (previous == null) delete process.env.FDE_DSH_HOME
    else process.env.FDE_DSH_HOME = previous
    if (previousAgents == null) delete process.env.DSH_AGENTS_HOME
    else process.env.DSH_AGENTS_HOME = previousAgents
    await rm(home, { recursive: true, force: true })
  }
})

test('skillRootsForCwd includes the FDE ledger, the project, and ~/.agents/skills', async () => {
  const previous = process.env.FDE_DSH_HOME
  const previousAgents = process.env.DSH_AGENTS_HOME
  const home = await mkdtemp(join(tmpdir(), 'fde-skill-roots-'))
  const cwd = join(home, 'ws')
  await mkdir(join(cwd, '.git'), { recursive: true })
  process.env.FDE_DSH_HOME = home
  delete process.env.DSH_AGENTS_HOME
  try {
    const { homedir } = await import('node:os')
    const roots = await skillRootsForCwd({ dshHome: home }, cwd)
    const sources = roots.map((row) => row.source)
    assert.deepEqual(sources.sort(), ['project-agents', 'project-dsh', 'user-agents', 'user-dsh'].sort())
    assert.equal(roots.find((row) => row.source === 'user-dsh').path, join(home, 'skills'))
    assert.equal(roots.find((row) => row.source === 'user-agents').path, join(homedir(), '.agents', 'skills'))
  } finally {
    if (previous == null) delete process.env.FDE_DSH_HOME
    else process.env.FDE_DSH_HOME = previous
    if (previousAgents == null) delete process.env.DSH_AGENTS_HOME
    else process.env.DSH_AGENTS_HOME = previousAgents
    await rm(home, { recursive: true, force: true })
  }
})
