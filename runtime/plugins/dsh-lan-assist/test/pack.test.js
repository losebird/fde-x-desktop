import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

test('pack includes the DSH bundle seam and ships no mailbox secrets', () => {
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.ok(pkg.files.includes('cordis.patch.yml'))
  assert.ok(pkg.files.includes('client.js'))
  assert.ok(pkg.files.includes('index.js'))
  assert.ok(pkg.files.includes('files.js'))
  assert.ok(pkg.files.includes('attach.js'))
  assert.ok(pkg.files.includes('dock.js'))
  assert.ok(pkg.files.includes('pair.js'))
  assert.ok(pkg.files.includes('envelope.js'))
  assert.ok(pkg.files.includes('adopt.js'))
  assert.ok(pkg.files.includes('group.js'))
  assert.ok(pkg.files.includes('nudge.js'))
  assert.ok(pkg.files.includes('conn.js'))
  assert.ok(pkg.files.includes('gate.js'))
  assert.ok(pkg.files.includes('draft.js'))
  assert.ok(pkg.files.includes('draft-state.js'))
  assert.ok(pkg.files.includes('advice.js'))
  assert.ok(pkg.files.includes('hear.js'))
  assert.ok(pkg.files.includes('hint.js'))
  assert.ok(pkg.files.includes('tick.js'))
  assert.ok(pkg.files.includes('shout.js'))
  assert.ok(pkg.files.includes('seat.js'))
  assert.ok(pkg.files.includes('see.js'))
  assert.ok(pkg.files.includes('view.js'))
  assert.ok(pkg.files.includes('ask.js'))
  assert.ok(pkg.files.includes('hall.js'))
  assert.ok(pkg.files.includes('handoff.js'))
  assert.equal(pkg.repository.url.includes('losebird/dsh-lan-assist'), true)

  const listed = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      NPM_CONFIG_CACHE: join(root, '.tmp-npm', 'cache'),
      NPM_CONFIG_LOGS_DIR: join(root, '.tmp-npm', 'logs'),
    },
  })
  assert.equal(listed.status, 0, listed.stderr || listed.stdout)
  const payload = JSON.parse(listed.stdout)
  const files = (payload[0] && payload[0].files ? payload[0].files : []).map((row) => row.path)
  assert.ok(files.includes('package.json'))
  assert.ok(files.includes('cordis.patch.yml'))
  assert.ok(files.includes('client.js'))
  assert.ok(files.includes('draft-state.js'))
  assert.ok(files.includes('vendor/office/mammoth.browser.min.js'))
  assert.ok(files.includes('vendor/office/xlsx.full.min.js'))
  assert.ok(files.includes('vendor/office/jszip.min.js'))
  assert.ok(files.includes('scripts/install.sh'))
  assert.ok(files.includes('scripts/install.cmd'))
  assert.ok(!files.some((path) => path.startsWith('test/')))
  assert.ok(!files.some((path) => path.startsWith('dist/')))
  assert.ok(!files.some((path) => path.includes('.dsh/') || path.endsWith('.png') || path.endsWith('.jpg')))
})
