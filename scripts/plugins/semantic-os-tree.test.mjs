import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./semantic-os-tree.mjs', import.meta.url))
const PIN = 'a13e45390a860162042ddbcdd5b6eee3b92651d8'
const PARENT = '42e228fa25ad757b933bf5ffe1e3fe83640b4ae7'

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function gitSource(dir, files) {
  mkdirSync(dir, { recursive: true })
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body)
  const git = (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
  git(['init'])
  git(['config', 'user.email', 'pr5@example.com'])
  git(['config', 'user.name', 'pr5'])
  git(['add', '.'])
  git(['commit', '-m', 'fixture'])
}

function fixture(body) {
  const root = join(tmpdir(), `pr5-sem-${process.pid}-${Math.random().toString(16).slice(2)}`)
  const source = join(root, 'source')
  const overlay = join(root, 'runtime/vendor-overlays/dsh-semantic-os')
  mkdirSync(overlay, { recursive: true })
  gitSource(source, { 'README.md': body })
  const rel = 'runtime/plugins/dsh-semantic-os/README.md'
  const abs = join(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, body)
  const lanRel = 'runtime/plugins/dsh-lan-assist/package.json'
  const lanBody = '{"name":"dsh-lan-assist"}\n'
  mkdirSync(dirname(join(root, lanRel)), { recursive: true })
  writeFileSync(join(root, lanRel), lanBody)
  const doc = {
    version: 1,
    plugins: {
      'dsh-lan-assist': {
        source: {
          repo: 'losebird/dsh-lan-assist',
          commit: '31d75468e0ffd58bb5bb214325c7517c7c42a8ab',
          parent: 'ab6a03af83c65eb6238a254aa1ddf999f1be7515',
        },
        overlay: {
          repo: 'losebird/fde-x-desktop',
          commit: '6a79f383b951c7e13f424c4577dc06b85f64304e',
          path: 'runtime/vendor-overlays/dsh-lan-assist',
        },
        files: { [lanRel]: sha256(lanBody) },
      },
      'dsh-semantic-os': {
        source: { repo: 'losebird/dsh-semantic-os', commit: PIN, parent: PARENT },
        overlay: {
          repo: 'losebird/fde-x-desktop',
          commit: '6a79f383b951c7e13f424c4577dc06b85f64304e',
          path: 'runtime/vendor-overlays/dsh-semantic-os',
        },
        files: { [rel]: sha256(body) },
      },
    },
  }
  const lock = join(root, 'runtime/plugins/plugins.lock.json')
  mkdirSync(dirname(lock), { recursive: true })
  writeFileSync(lock, `${JSON.stringify(doc, null, 2)}\n`)
  return { root, source, rel, abs }
}

function verify(root, source) {
  return spawnSync(process.execPath, [
    script, 'verify', '--source', source, '--root', root,
    '--overlay', join(root, 'runtime/vendor-overlays/dsh-semantic-os'),
  ], { encoding: 'utf8' })
}

test('verify --source exits 1 when HEAD is not the pinned semantic-os commit', () => {
  const { root, source } = fixture('hello\n')
  const result = verify(root, source)
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, new RegExp(`source HEAD .+ != ${PIN}`))
})

test('verify --source exits 1 when a rebuilt file differs on disk', () => {
  const { root, source, abs } = fixture('hello\n')
  writeFileSync(abs, 'tampered\n')
  const result = verify(root, source)
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, /bytes differ runtime\/plugins\/dsh-semantic-os\/README.md/)
})
