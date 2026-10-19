import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createCoreConnector } from '../dsh-core.mjs'
import { HOST_GENERATION, ensureGenerationHost } from '../generation.mjs'

const PRESETS = ['fde-app-builder', 'fde-briefing']
const DESIGNED_TOOLS = ['read', 'write', 'edit', 'skill', 'workflow', 'ralph']

function personaPrefixFromPreset(text) {
  const match = text.match(/^ {4}prefix: >-\n {6}(\S.*)$/m)
  if (!match) throw new Error('preset persona prefix is missing')
  return match[1].trim()
}

function restoreEnv(previous) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

async function bootHost() {
  const bin = await ensureGenerationHost()
  const home = await mkdtemp(join(tmpdir(), 'fde-preset-session-'))
  const cwd = join(home, 'workspace')
  const probeDir = join(home, 'probe')
  const profile = join(home, 'profiles', 'fde-x')
  await mkdir(cwd, { recursive: true })
  await mkdir(probeDir, { recursive: true })
  await mkdir(profile, { recursive: true })
  // The Host rejects an empty profile patch, and normalize turns "[]" into an empty file.
  await writeFile(join(profile, 'cordis.patch.yml'), '- id: preset-host-hold\n  disabled: true\n')
  await writeFile(join(profile, 'cordis.yml'), '[]\n')
  await writeFile(join(home, '.credentials.yaml'), '', { mode: 0o600 })
  const productPatch = await readFile(join(import.meta.dirname, '..', 'dsh-core.patch.yml'), 'utf8')
  const probe = join(import.meta.dirname, 'fixtures', 'preset-session-probe', 'index.cjs')
  const patchFile = join(home, 'probe.patch.yml')
  await writeFile(patchFile, `${productPatch}\n- insert:\n    - id: fde-preset-session-probe\n      name: ${JSON.stringify(probe)}\n`)
  const previous = {
    FDE_DSH_HOME: process.env.FDE_DSH_HOME,
    DSH_HOME: process.env.DSH_HOME,
    FDE_DSH_BIN: process.env.FDE_DSH_BIN,
    FDE_DSH_SESSION_ROOT: process.env.FDE_DSH_SESSION_ROOT,
    FDE_DSH_STORAGE_ROOT: process.env.FDE_DSH_STORAGE_ROOT,
    FDE_SEMANTIC_RUNTIME_MODE: process.env.FDE_SEMANTIC_RUNTIME_MODE,
    FDE_AI_WORKSPACE: process.env.FDE_AI_WORKSPACE,
    FDE_PROBE_DIR: process.env.FDE_PROBE_DIR,
  }
  process.env.FDE_DSH_HOME = home
  process.env.DSH_HOME = home
  process.env.FDE_DSH_BIN = bin
  process.env.FDE_DSH_SESSION_ROOT = join(home, 'sessions')
  process.env.FDE_DSH_STORAGE_ROOT = join(home, 'storages')
  process.env.FDE_SEMANTIC_RUNTIME_MODE = 'readonly'
  process.env.FDE_AI_WORKSPACE = cwd
  process.env.FDE_PROBE_DIR = probeDir
  const core = createCoreConnector({
    bin,
    dshHome: home,
    cwd,
    patchFile,
    startTimeoutMs: 90_000,
  })
  const status = await core.start()
  if (!status.connected || status.version !== HOST_GENERATION.pin) {
    const detail = status.lastError || (status.recentLogs || []).join('\n')
    await core.stop().catch(() => {})
    restoreEnv(previous)
    await rm(home, { recursive: true, force: true })
    throw new Error(`真 Host 没有连上 ${HOST_GENERATION.pin}：${detail}`)
  }
  return {
    core,
    cwd,
    probeDir,
    async stop() {
      await core.stop().catch(() => {})
      restoreEnv(previous)
      await rm(home, { recursive: true, force: true })
    },
  }
}

async function openPreset(host, id) {
  const session = await host.core.call('session/create', { request: { cwd: host.cwd, agentPreset: id } })
  const file = join(host.probeDir, `${id}.json`)
  try {
    const seen = JSON.parse(await readFile(file, 'utf8'))
    return { session, seen }
  } catch (error) {
    const names = await readdir(host.probeDir).catch(() => [])
    const logs = (host.core.logs || []).join('\n')
    throw new Error(`探针没有记下 ${id}（${names.join(',') || '空'}）：${error instanceof Error ? error.message : String(error)}\n${logs}`)
  }
}

test('fde presets open a real Host session with their persona and tools', { timeout: 180_000 }, async () => {
  const host = await bootHost()
  const failures = []
  try {
    const standard = await openPreset(host, 'standard')
    assert.equal(standard.session.agentPreset, 'standard')
    assert.equal(typeof standard.session.sessionId, 'string')
    assert.ok(standard.session.sessionId.length > 0)
    for (const id of PRESETS) {
      try {
        const opened = await openPreset(host, id)
        const designed = personaPrefixFromPreset(await readFile(join(import.meta.dirname, '..', 'presets', id, 'agent.cordis.yml'), 'utf8'))
        assert.equal(opened.session.agentPreset, id)
        assert.equal(typeof opened.session.sessionId, 'string')
        assert.ok(opened.session.sessionId.length > 0)
        assert.equal(opened.seen.error, null)
        assert.equal(opened.seen.personaPrefix, designed)
        const names = opened.seen.names
        for (const tool of DESIGNED_TOOLS) assert.equal(names.includes(tool), true, `${id} missing ${tool}`)
        if (process.platform !== 'win32') assert.equal(names.includes('bash'), true, `${id} missing bash`)
      } catch (error) {
        failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } finally {
    await host.stop()
  }
  assert.deepEqual(failures, [])
})
