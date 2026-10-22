import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IUI_PIN } from '../iui-pin.mjs'
import { DshCoreConnector } from '../dsh-core.mjs'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

async function withEnv(run) {
  const saved = {
    FDE_PLUGIN_IUI: process.env.FDE_PLUGIN_IUI,
    FDE_PLUGIN_DSH_LAN_ASSIST: process.env.FDE_PLUGIN_DSH_LAN_ASSIST,
    FDE_PLUGIN_DSH_SEMANTIC_OS: process.env.FDE_PLUGIN_DSH_SEMANTIC_OS,
    FDE_IUI_ARTIFACT: process.env.FDE_IUI_ARTIFACT,
  }
  delete process.env.FDE_IUI_ARTIFACT
  const home = await mkdtemp(join(tmpdir(), 'fde-closure-'))
  const iui = join(home, 'iui')
  await mkdir(iui, { recursive: true })
  await writeFile(join(iui, 'package.json'), `${JSON.stringify({ name: '@losebird/iui', version: IUI_PIN.version })}\n`)
  await writeFile(join(iui, 'fde-plugin-pin.json'), `${JSON.stringify({ commit: IUI_PIN.commit })}\n`)
  process.env.FDE_PLUGIN_IUI = iui
  try {
    return await run(home)
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await rm(home, { recursive: true, force: true })
  }
}

async function tiny(home, name) {
  const dir = join(home, name)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), `${JSON.stringify({ name })}\n`)
  return dir
}

async function copyPlugin(name) {
  const dest = await mkdtemp(join(tmpdir(), `fde-${name}-`))
  await cp(join(repoRoot, 'runtime', 'plugins', name), dest, {
    recursive: true,
    filter: (src) => !src.split('/').includes('node_modules'),
  })
  return dest
}

test('missing relative import sets state error', async () => {
  const fixture = await copyPlugin('dsh-lan-assist')
  await rm(join(fixture, 'nats-relay.js'), { force: true })
  try {
    const got = await withEnv(async (home) => {
      process.env.FDE_PLUGIN_DSH_LAN_ASSIST = fixture
      process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = await tiny(home, 'sem')
      const connector = new DshCoreConnector({ dshHome: home, cwd: home })
      await connector.ensureIsolatedProfile()
      return { state: connector.state, lastError: connector.lastError }
    })
    assert.equal(got.state, 'error')
    assert.match(got.lastError, /nats-relay\.js/)
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})

test('semantic-os python import is checked', async () => {
  const sem = await copyPlugin('dsh-semantic-os')
  const lan = await copyPlugin('dsh-lan-assist')
  const root = await mkdtemp(join(tmpdir(), 'fde-pair-'))
  const semDir = join(root, 'dsh-semantic-os')
  const lanDir = join(root, 'dsh-lan-assist')
  await cp(sem, semDir, { recursive: true })
  await cp(lan, lanDir, { recursive: true })
  await rm(join(semDir, 'python', 'board.py'), { force: true })
  try {
    const got = await withEnv(async (home) => {
      process.env.FDE_PLUGIN_DSH_LAN_ASSIST = await tiny(home, 'lan')
      process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = semDir
      const connector = new DshCoreConnector({ dshHome: home, cwd: home })
      await connector.ensureIsolatedProfile()
      return { state: connector.state, lastError: connector.lastError }
    })
    assert.equal(got.state, 'error')
    assert.match(got.lastError, /board\.py/)
  } finally {
    await rm(fixtureSafe(sem), { recursive: true, force: true })
    await rm(lan, { recursive: true, force: true })
    await rm(root, { recursive: true, force: true })
  }
})

function fixtureSafe(path) {
  return path
}

function filesContaining(root, needle) {
  const hits = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.git') continue
      const full = join(dir, name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        walk(full)
        continue
      }
      if (!st.isFile()) continue
      let text = ''
      try {
        text = readFileSync(full, 'utf8')
      } catch {
        continue
      }
      if (text.includes(needle)) hits.push(relative(repoRoot, full))
    }
  }
  walk(root)
  return hits
}

test('the tree has no INDEX_OK symbol', () => {
  const files = ['runtime', 'scripts', 'src'].flatMap((dir) => filesContaining(join(repoRoot, dir), 'INDEX_OK')).sort()
  assert.deepEqual(files, ['runtime/tests/plugin-closure.test.mjs'])
})
