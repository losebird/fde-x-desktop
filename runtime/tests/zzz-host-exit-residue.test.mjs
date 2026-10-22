import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

test('this run leaves no host exit files or fake pip processes', async () => {
  const started = Date.now() - process.uptime() * 1000 - 1000
  const dir = join(tmpdir(), 'fde-host-exit')
  let names = []
  try {
    names = await readdir(dir)
  } catch {
    names = []
  }
  const fresh = []
  for (const name of names) {
    const info = await stat(join(dir, name))
    if (info.mtimeMs >= started) fresh.push(name)
  }
  assert.deepEqual(fresh, [], `host exit files left by this run: ${fresh.join(', ')}`)
  const { stdout } = await execFileAsync('ps', ['-ax', '-o', 'args='], { maxBuffer: 16 * 1024 * 1024 })
  const orphans = String(stdout).split('\n').filter((line) => line.includes('setInterval') && line.includes('semantica') && /\bpip\b/u.test(line))
  assert.deepEqual(orphans, [], `fake pip processes left by this run: ${orphans.join(' | ')}`)
})
