import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { isVenvTemplate, pickStagedPython, rankPython } from '../scripts/stage-python-runtime.js'

test('Windows venv-template python.exe is never selected', () => {
  const template = 'runtime-dist/win32-x64/python/cpython-3.12.10-windows-x86_64-none/Lib/venv/scripts/nt/python.exe'
  const real = 'runtime-dist/win32-x64/python/cpython-3.12.10-windows-x86_64-none/python.exe'
  assert.equal(isVenvTemplate(template), true)
  assert.equal(isVenvTemplate(real), false)
  assert.ok(rankPython(real) > rankPython(template))
  assert.equal(rankPython(template), -1)
})

test('unix staged interpreters still rank above stray python.exe copies', () => {
  assert.ok(rankPython('/opt/python/bin/python3.12') > rankPython('/opt/python/bin/python3'))
  assert.ok(rankPython('/opt/python/bin/python3') > rankPython('/opt/python/bin/python'))
})

test('pickStagedPython skips the venv template and keeps a working interpreter', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsos-stage-python-'))
  const prefix = join(root, 'cpython-3.12.10-windows-x86_64-none')
  const templateDir = join(prefix, 'Lib', 'venv', 'scripts', 'nt')
  const bin = join(prefix, 'bin')
  await mkdir(templateDir, { recursive: true })
  await mkdir(bin, { recursive: true })
  const template = join(templateDir, 'python.exe')
  const real = join(bin, 'python3')
  await writeFile(template, 'not a python\n')
  await writeFile(real, '#!/bin/sh\nexec python3 "$@"\n', { mode: 0o755 })
  try {
    const picked = pickStagedPython(root)
    assert.equal(picked, realpathSync(real))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
