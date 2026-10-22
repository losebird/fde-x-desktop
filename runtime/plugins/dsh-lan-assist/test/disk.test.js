import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { replaceFile, stopPid, windowsKillArgs, isReplaceBusy } from '../disk.js'
import { createFileStore } from '../files.js'
import { createStore } from '../store.js'
import { windowsStartupSource } from '../listen.js'

test('replaceFile overwrites when rename cannot replace', async () => {
  const files = { 'box.json': 'old' }
  const io = {
    async writeFile(path, contents) { files[path] = String(contents) },
    async rename() {
      const err = new Error('EPERM')
      err.code = 'EPERM'
      throw err
    },
    async unlink(path) { delete files[path] },
    async chmod() {},
  }
  await replaceFile('box.json', 'new', { io })
  assert.equal(files['box.json'], 'new')
  assert.equal(files['box.json.tmp'], undefined)
})

test('replaceFile still uses rename when the dest is free', async () => {
  const files = {}
  const io = {
    async writeFile(path, contents) { files[path] = String(contents) },
    async rename(from, to) {
      files[to] = files[from]
      delete files[from]
    },
    async unlink(path) { delete files[path] },
    async chmod() {},
  }
  await replaceFile('box.json', 'fresh', { io })
  assert.equal(files['box.json'], 'fresh')
  assert.equal(files['box.json.tmp'], undefined)
})

test('busy replace errors are the Windows overwrite cases', () => {
  assert.equal(isReplaceBusy({ code: 'EPERM' }), true)
  assert.equal(isReplaceBusy({ code: 'EEXIST' }), true)
  assert.equal(isReplaceBusy({ code: 'EACCES' }), true)
  assert.equal(isReplaceBusy({ code: 'ENOENT' }), false)
})

test('windows listen stop uses taskkill /T /F', async () => {
  const calls = []
  const result = await stopPid(4242, {
    platform: 'win32',
    spawn: (cmd, args, opts) => {
      calls.push({ cmd, args, hide: opts.windowsHide })
      return { on(ev, fn) { if (ev === 'exit') fn(0) } }
    },
  })
  assert.equal(result.how, 'taskkill')
  assert.equal(calls[0].cmd, 'taskkill')
  assert.deepEqual(calls[0].args, windowsKillArgs(4242))
  assert.equal(calls[0].hide, true)
})

test('posix listen stop still uses SIGTERM', async () => {
  const seen = []
  const result = await stopPid(77, {
    platform: 'darwin',
    kill: (pid, sig) => seen.push({ pid, sig }),
  })
  assert.equal(result.how, 'SIGTERM')
  assert.deepEqual(seen, [{ pid: 77, sig: 'SIGTERM' }])
})

test('file store keeps bytes off the mailbox JSON', async () => {
  const mem = createFileStore()
  await mem.put('req_a.0', 'echo ok')
  assert.equal(await mem.get('req_a.0'), 'echo ok')
  await mem.dropPrefix('req_a')
  assert.equal(await mem.get('req_a.0'), '')

  const root = await mkdtemp(join(tmpdir(), 'dla-files-'))
  const disk = createFileStore({ root })
  await disk.put('req_b.0', 'echo disk')
  assert.equal(await disk.get('req_b.0'), 'echo disk')
  await disk.dropPrefix('req_b')
  assert.equal(await disk.get('req_b.0'), '')
  await rm(root, { recursive: true, force: true })
})

test('store.update skips the disk when the mailbox JSON did not change', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dla-skip-'))
  const store = createStore({ root })
  await store.update((s) => { s.displayName = 'Ace' })
  const first = await stat(join(root, 'lan-assist', 'state.json'))
  await new Promise((resolve) => setTimeout(resolve, 20))
  await store.update((s) => { s.lastTick = Date.now() })
  const second = await stat(join(root, 'lan-assist', 'state.json'))
  assert.equal(first.mtimeMs, second.mtimeMs)
  await rm(root, { recursive: true, force: true })
})

test('store.update runs one writer at a time', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dla-store-'))
  const store = createStore({ root })
  await Promise.all([
    store.update((s) => { s.displayName = `${s.displayName || ''}A` }),
    store.update((s) => { s.displayName = `${s.displayName || ''}B` }),
    store.update((s) => { s.displayName = `${s.displayName || ''}C` }),
  ])
  const state = await store.get()
  assert.equal(state.displayName.length >= 3, true)
  assert.match(state.displayName, /A/)
  assert.match(state.displayName, /B/)
  assert.match(state.displayName, /C/)
  await rm(root, { recursive: true, force: true })
})

test('windows startup quotes a home path that has spaces', () => {
  const text = windowsStartupSource({
    node: 'C:\\Program Files\\nodejs\\node.exe',
    script: 'C:\\Users\\Zhang San\\.dsh\\lan-assist\\listen-daemon.mjs',
    home: 'C:\\Users\\Zhang San\\.dsh',
    port: 9527,
  })
  assert.match(text, /set ""DSH_HOME=C:\\Users\\Zhang San\\.dsh""/)
  assert.match(text, /set ""DSH_LAN_ASSIST_PORT=9527""/)
  assert.doesNotMatch(text, /set DSH_HOME=C:\\Users\\Zhang San/)
})
