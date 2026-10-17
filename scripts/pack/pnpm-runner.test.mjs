import assert from 'node:assert/strict'
import { chmod, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { assertCorepackUsable, selectPnpmRunner, staleCorepackReason } from './pnpm-runner.mjs'

const pinnedVersion = '11.7.0'

test('corepack present runs the pinned pnpm through corepack', () => {
  const runner = selectPnpmRunner({
    corepackAvailable: true,
    pnpmVersion: '11.20.0',
    pinnedVersion,
  })
  assert.deepEqual(runner, {
    command: 'corepack',
    argsPrefix: ['pnpm@11.7.0'],
  })
})

test('missing corepack uses PATH pnpm when the major matches', () => {
  const runner = selectPnpmRunner({
    corepackAvailable: false,
    pnpmVersion: '11.20.0',
    pinnedVersion,
  })
  assert.deepEqual(runner, {
    command: 'pnpm',
    argsPrefix: [],
  })
  assert.throws(
    () => selectPnpmRunner({
      corepackAvailable: false,
      pnpmVersion: '10.15.0',
      pinnedVersion,
    }),
    /pnpm 11\.x/,
  )
  assert.throws(
    () => selectPnpmRunner({
      corepackAvailable: false,
      pnpmVersion: '12.0.0',
      pinnedVersion,
    }),
    /pnpm 11\.x/,
  )
})

test('missing corepack and pnpm names how to install either', () => {
  assert.throws(
    () => selectPnpmRunner({
      corepackAvailable: false,
      pnpmVersion: '',
      pinnedVersion,
    }),
    (error) => {
      assert.match(error.message, /Node 25\+ no longer ships corepack/)
      assert.match(error.message, /npm install -g pnpm@11\.7\.0/)
      assert.match(error.message, /npm install -g corepack/)
      return true
    },
  )
})

async function writeCorepack(body) {
  const dir = await mkdtemp(join(tmpdir(), 'corepack-check-'))
  const path = join(dir, 'corepack')
  const calls = join(dir, 'calls')
  await writeFile(path, `#!/bin/sh\nprintf '%s\\n' "$*" >> '${calls}'\n${body}\n`)
  await chmod(path, 0o755)
  return { dir, path, calls }
}

test('Node 26 treats corepack below 0.31.0 as stale and 0.31.0 as usable', () => {
  assert.equal(staleCorepackReason({ nodeVersion: '26.12.0', corepackVersion: '0.30.0' }), 'version')
  assert.equal(staleCorepackReason({ nodeVersion: '26.12.0', corepackVersion: '0.31.0' }), '')
  assert.equal(staleCorepackReason({ nodeVersion: '22.23.3', corepackVersion: '0.24.1' }), '')
})

test('Node 26 rejects a corepack older than 0.31.0 before using it', async () => {
  const { path, calls } = await writeCorepack(`if [ "$1" = "--version" ]; then
  printf '%s\\n' '0.24.1'
  exit 0
fi
printf '%s\\n' 'TypeError [ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING]: A dynamic import callback was not specified.' >&2
exit 1`)
  await assert.rejects(
    () => assertCorepackUsable({ PATH: path.slice(0, path.lastIndexOf('/')) }, pinnedVersion, '26.12.0'),
    (error) => {
      assert.match(error.message, /旧版 corepack/)
      assert.match(error.message, /版本 0\.24\.1/)
      assert.match(error.message, /ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING/)
      assert.match(error.message, /不会改用别的工具链/)
      assert.match(error.message, /npm install -g pnpm@11\.7\.0/)
      assert.match(error.message, /mv '/)
      assert.match(error.message, /hash -r/)
      assert.equal(error.cause, undefined)
      return true
    },
  )
  const { readFile } = await import('node:fs/promises')
  assert.equal(await readFile(calls, 'utf8'), '--version\n')
})

test('Node 26 keeps a corepack that is 0.31.0 or newer', async () => {
  const { path, calls } = await writeCorepack(`printf '%s\\n' '0.36.0'\nexit 0`)
  await assertCorepackUsable({ PATH: path.slice(0, path.lastIndexOf('/')) }, pinnedVersion, '26.12.0')
  const { readFile } = await import('node:fs/promises')
  assert.equal(await readFile(calls, 'utf8'), '--version\n')
})

test('Node 22 does not probe corepack', async () => {
  const { path, calls } = await writeCorepack(`printf '%s\\n' 'disk full' >&2\nexit 2`)
  await assertCorepackUsable({ PATH: path.slice(0, path.lastIndexOf('/')) }, pinnedVersion, '22.23.3')
  const { readFile } = await import('node:fs/promises')
  await assert.rejects(() => readFile(calls, 'utf8'), { code: 'ENOENT' })
})

test('Node 26 turns the vm import error into the Chinese stop', async () => {
  const { path } = await writeCorepack(`printf '%s\\n' 'TypeError [ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING]: A dynamic import callback was not specified.' >&2
exit 1`)
  await assert.rejects(
    () => assertCorepackUsable({ PATH: path.slice(0, path.lastIndexOf('/')) }, pinnedVersion, '26.12.0'),
    (error) => {
      assert.match(error.message, /版本没有读出来/)
      assert.match(error.message, /ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING/)
      assert.match(error.cause.stderr, /ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING/)
      return true
    },
  )
})

test('a different corepack failure is rethrown', async () => {
  const { path } = await writeCorepack(`printf '%s\\n' 'disk full' >&2\nexit 2`)
  await assert.rejects(
    () => assertCorepackUsable({ PATH: path.slice(0, path.lastIndexOf('/')) }, pinnedVersion, '26.12.0'),
    (error) => {
      assert.match(error.stderr, /disk full/)
      assert.equal(error.message.includes('旧版 corepack'), false)
      assert.equal(error.cause, undefined)
      return true
    },
  )
})
