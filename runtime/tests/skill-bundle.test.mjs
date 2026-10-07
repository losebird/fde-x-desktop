import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  bundleRootFromPath,
  confinedRelPath,
  installSkillBundle,
  listBundleFiles,
  parseSkillCustomDirs,
  pathUnderCwd,
  sanitizeSkillName,
  setFrontmatterFlag,
  setSkillModelInvocable,
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

test('sanitizeSkillName matches Host kebab names', () => {
  assert.equal(sanitizeSkillName('Demo Pack'), 'demo-pack')
  assert.equal(SKILL_NAME_RE.test('demo-pack'), true)
  assert.equal(SKILL_NAME_RE.test('Demo'), false)
})

test('parseSkillCustomDirs reads filesystem provider dirs', () => {
  const text = `- id: llm-pi-ai\n  name: x\n- id: skill-filesystem\n  name: "@deepseek-ai/dsh-skill-filesystem"\n  config:\n    customSkillDirs:\n      - /tmp/extra-skills\n- id: tool-skill\n  name: y\n`
  assert.deepEqual(parseSkillCustomDirs(text), ['/tmp/extra-skills'])
})
