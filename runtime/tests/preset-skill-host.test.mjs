import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createCoreConnector } from '../dsh-core.mjs'
import { HOST_GENERATION, ensureGenerationHost } from '../generation.mjs'

const DESIGNED = {
  'fde-app-builder': {
    names: ['fde-app-builder-placeholder', 'fde-app-spec'],
    read: 'fde-app-spec',
    sentence: '禁止折成房间表或家具清单。',
    absent: 'fde-briefing',
  },
  'fde-briefing': {
    names: ['fde-briefing-placeholder', 'fde-briefing'],
    read: 'fde-briefing',
    sentence: '只做外部信息源采集与摘要，不执行业务写操作，不发 IM。',
    absent: 'fde-app-spec',
  },
}

function restoreEnv(previous) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

async function bootHost() {
  const bin = await ensureGenerationHost()
  const home = await mkdtemp(join(tmpdir(), 'fde-preset-skill-'))
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
  const probe = join(import.meta.dirname, 'fixtures', 'preset-skill-probe', 'index.cjs')
  const patchFile = join(home, 'probe.patch.yml')
  await writeFile(patchFile, `${productPatch}\n- insert:\n    - id: fde-preset-skill-probe\n      name: ${JSON.stringify(probe)}\n`)
  const previous = {
    FDE_DSH_HOME: process.env.FDE_DSH_HOME,
    DSH_HOME: process.env.DSH_HOME,
    FDE_DSH_BIN: process.env.FDE_DSH_BIN,
    FDE_DSH_SESSION_ROOT: process.env.FDE_DSH_SESSION_ROOT,
    FDE_DSH_STORAGE_ROOT: process.env.FDE_DSH_STORAGE_ROOT,
    FDE_SEMANTIC_RUNTIME_MODE: process.env.FDE_SEMANTIC_RUNTIME_MODE,
    FDE_AI_WORKSPACE: process.env.FDE_AI_WORKSPACE,
    FDE_PROBE_DIR: process.env.FDE_PROBE_DIR,
    FDE_PROBE_SKILLS: process.env.FDE_PROBE_SKILLS,
  }
  process.env.FDE_DSH_HOME = home
  process.env.DSH_HOME = home
  process.env.FDE_DSH_BIN = bin
  process.env.FDE_DSH_SESSION_ROOT = join(home, 'sessions')
  process.env.FDE_DSH_STORAGE_ROOT = join(home, 'storages')
  process.env.FDE_SEMANTIC_RUNTIME_MODE = 'readonly'
  process.env.FDE_AI_WORKSPACE = cwd
  process.env.FDE_PROBE_DIR = probeDir
  process.env.FDE_PROBE_SKILLS = JSON.stringify(Object.fromEntries(
    Object.entries(DESIGNED).map(([id, row]) => [id, row.read]),
  ))
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

async function readProbe(dir, id) {
  const file = join(dir, `${id}.json`)
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      return JSON.parse(await readFile(file, 'utf8'))
    } catch (error) {
      if (!(error && error.code === 'ENOENT')) throw error
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }
  throw new Error(`探针没有记下 ${id}`)
}

test('fde presets list and read their own skills on the real Host', { timeout: 180_000 }, async () => {
  const host = await bootHost()
  const failures = []
  try {
    for (const [id, designed] of Object.entries(DESIGNED)) {
      try {
        const session = await host.core.call('session/create', { request: { cwd: host.cwd, agentPreset: id } })
        assert.equal(session.agentPreset, id)
        const listed = await host.core.call('skills/list', { request: { sessionId: session.sessionId } })
        const names = (listed.skills || []).map((skill) => skill.name)
        for (const name of designed.names) {
          assert.ok(names.includes(name), `${id} missing ${name}`)
          const row = listed.skills.find((skill) => skill.name === name)
          assert.ok(row && typeof row.description === 'string' && row.description.length > 0, `${id} ${name} has no description`)
        }
        assert.equal(names.includes(designed.absent), false, `${id} listed ${designed.absent}`)
        const seen = await readProbe(host.probeDir, id)
        assert.equal(seen.error, null)
        assert.ok(seen.text.includes(designed.sentence), `${id} skill tool missed its sentence`)
      } catch (error) {
        failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } finally {
    await host.stop()
  }
  assert.deepEqual(failures, [])
})
