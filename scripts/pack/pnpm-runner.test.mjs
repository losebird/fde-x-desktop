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

test('corepack below 0.31.0 is stale on every Node version', () => {
  assert.equal(staleCorepackReason({ corepackVersion: '0.30.0' }), 'version')
  assert.equal(staleCorepackReason({ corepackVersion: '0.31.0' }), '')
  assert.equal(staleCorepackReason({ corepackVersion: '0.24.1' }), 'version')
  assert.equal(
    staleCorepackReason({ corepackVersion: '0.29.4', probeText: 'Error: Cannot find matching keyid' }),
    'probe',
  )
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
      assert.match(error.message, /for name in corepack pnpm pnpx yarn/)
      assert.match(error.message, /hash -r/)
      assert.match(error.cause.stderr, /ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING/)
      const moveAt = error.message.indexOf('for name in corepack pnpm pnpx yarn')
      const installAt = error.message.indexOf('npm install -g pnpm@11.7.0')
      assert.equal(installAt > moveAt, true)
      return true
    },
  )
  const { readFile } = await import('node:fs/promises')
  assert.equal(await readFile(calls, 'utf8'), '--version\npnpm@11.7.0 --version\n')
})

test('Node 26 keeps a corepack that is 0.31.0 or newer', async () => {
  const { path, calls } = await writeCorepack(`printf '%s\\n' '0.36.0'\nexit 0`)
  await assertCorepackUsable({ PATH: path.slice(0, path.lastIndexOf('/')) }, pinnedVersion, '26.12.0')
  const { readFile } = await import('node:fs/promises')
  assert.equal(await readFile(calls, 'utf8'), '--version\n')
})

test('Node 22 rethrows an unrelated corepack failure', async () => {
  const { path } = await writeCorepack(`printf '%s\\n' 'disk full' >&2\nexit 2`)
  await assert.rejects(
    () => assertCorepackUsable({ PATH: path.slice(0, path.lastIndexOf('/')) }, pinnedVersion, '22.23.3'),
    (error) => {
      assert.match(error.stderr, /disk full/)
      assert.equal(error.message.includes('旧版 corepack'), false)
      return true
    },
  )
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

test('Node 22 stops when the resolved pnpm is an old corepack shim', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'corepack-shim-'))
  const pnpm = join(dir, 'pnpm')
  await writeFile(pnpm, `#!/bin/sh
# require('./lib/corepack.cjs').runMain(['pnpm', ...process.argv.slice(2)]);
printf '%s\\n' 'Error: Cannot find matching keyid: ...' >&2
exit 1
`)
  await chmod(pnpm, 0o755)
  await assert.rejects(
    () => assertCorepackUsable({ PATH: dir }, pinnedVersion, '22.23.3'),
    (error) => {
      const message = error.message
      assert.match(message, /Cannot find matching keyid/)
      assert.equal(message.includes('ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING'), false)
      assert.match(message, /pnpm/)
      assert.match(message, /pnpx/)
      assert.match(message, /yarn/)
      assert.match(message, /EEXIST/)
      const moveAt = message.indexOf('for name in corepack pnpm pnpx yarn')
      const installAt = message.indexOf('npm install -g pnpm@11.7.0')
      assert.equal(moveAt >= 0, true)
      assert.equal(installAt > moveAt, true)
      return true
    },
  )
})
