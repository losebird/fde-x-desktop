import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('unset FDE_RESOURCES on a staged layout resolves resources/dsh/bin/dsh', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fde-resources-root-'))
  const resources = join(dir, 'resources')
  const runtimeDest = join(resources, 'app', 'runtime')
  mkdirSync(runtimeDest, { recursive: true })
  cpSync(join(repoRoot, 'runtime', 'config.mjs'), join(runtimeDest, 'config.mjs'))
  cpSync(join(repoRoot, 'runtime', 'generation.mjs'), join(runtimeDest, 'generation.mjs'))
  const bin = join(resources, 'dsh', 'bin', 'dsh')
  mkdirSync(dirname(bin), { recursive: true })
  writeFileSync(bin, '#!/usr/bin/env node\n')
  chmodSync(bin, 0o755)
  const home = join(dir, 'home')
  mkdirSync(home, { recursive: true })
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', [
    "import { resolveDshBin, FDE_RESOURCES } from './config.mjs'",
    'console.log(JSON.stringify({ resources: FDE_RESOURCES, bin: resolveDshBin() }))',
  ].join('\n')], {
    cwd: runtimeDest,
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: home,
      PATH: '/usr/bin:/bin',
      FDE_RESOURCES: '',
      FDE_APP_ROOT: '',
      FDE_DSH_BIN: '',
      FDE_DSH_HOME: join(home, 'dsh-home'),
    },
  })
  assert.equal(result.status, 0, result.stderr)
  const parsed = JSON.parse(result.stdout)
  assert.equal(parsed.resources, resources)
  assert.equal(parsed.bin, bin)
})
