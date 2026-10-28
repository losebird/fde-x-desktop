import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
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

test('missing files in retired Host plugins do not fail the profile', async () => {
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
    assert.equal(got.state, 'idle', got.lastError || '')
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})

test('semantic-os is a BFF library so missing python does not fail the Host profile', async () => {
  const sem = await copyPlugin('dsh-semantic-os')
  await rm(join(sem, 'python', 'board.py'), { force: true })
  try {
    const got = await withEnv(async (home) => {
      process.env.FDE_PLUGIN_DSH_LAN_ASSIST = await tiny(home, 'lan')
      process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = sem
      const connector = new DshCoreConnector({ dshHome: home, cwd: home })
      await connector.ensureIsolatedProfile()
      const manifest = JSON.parse(await readFile(join(home, 'profiles', 'fde-x', 'package.json'), 'utf8'))
      return { state: connector.state, lastError: connector.lastError, bundles: manifest.dsh.profile.bundles }
    })
    assert.equal(got.state, 'idle', got.lastError || '')
    assert.equal(got.bundles.includes('dsh-semantic-os'), false)
  } finally {
    await rm(fixtureSafe(sem), { recursive: true, force: true })
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
