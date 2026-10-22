import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { pythonLibRoots } from '../scripts/finalize-runtime-package.js'

test('pythonLibRoots finds Unix lib and nested Windows Lib', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsos-finalize-lib-'))
  const unix = join(root, 'unix')
  const win = join(root, 'win')
  const winLib = join(win, 'cpython-3.12.10-windows-x86_64-none', 'Lib')
  await mkdir(join(unix, 'lib', 'python3.12'), { recursive: true })
  await mkdir(winLib, { recursive: true })
  await writeFile(join(unix, 'lib', 'python3.12', 'keep'), 'x')
  try {
    const endsWithLib = (path) => /[/\\][Ll]ib$/.test(path)
    assert.ok(pythonLibRoots(unix).some(endsWithLib), pythonLibRoots(unix).join(','))
    assert.ok(pythonLibRoots(win).some(endsWithLib), pythonLibRoots(win).join(','))
    assert.deepEqual(pythonLibRoots(join(root, 'missing')), [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
