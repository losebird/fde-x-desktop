import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./plugins-lock.mjs', import.meta.url))
const LAN = '31d75468e0ffd58bb5bb214325c7517c7c42a8ab'
const SEM = 'a13e45390a860162042ddbcdd5b6eee3b92651d8'
const OTHER = '0123456789abcdef0123456789abcdef01234567'

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function writePlugin(root, name, body) {
  const rel = `runtime/plugins/${name}/package.json`
  const abs = join(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, body)
  return { rel, hash: sha256(body) }
}

function lockEntry(name, commit, file) {
  const entry = {
    source: {
      repo: `losebird/${name}`,
      commit,
      parent: 'ab6a03af83c65eb6238a254aa1ddf999f1be7515',
    },
    overlay: {
      repo: 'losebird/fde-x-desktop',
      commit: '6a79f383b951c7e13f424c4577dc06b85f64304e',
      path: `runtime/vendor-overlays/${name}`,
    },
    files: { [file.rel]: file.hash },
  }
  if (name !== 'dsh-lan-assist') return entry
  return {
    source: entry.source,
    overlay: entry.overlay,
    blobs: {},
    dependencies: { nats: {} },
    files: entry.files,
  }
}

test('verify --upstream-sha exits 1 and names the stale plugin and both shas', () => {
  const result = spawnSync(process.execPath, [script, 'verify', '--upstream-sha', OTHER], {
    encoding: 'utf8',
  })
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, /stale dsh-lan-assist/)
  assert.match(result.stderr, /stale dsh-semantic-os/)
  assert.match(result.stderr, new RegExp(LAN))
  assert.match(result.stderr, new RegExp(SEM))
  assert.match(result.stderr, new RegExp(OTHER))
})

test('a matching disk still fails when --upstream-sha differs from the lock commit', () => {
  const root = join(tmpdir(), `pr5-lock-${process.pid}`)
  const lan = writePlugin(root, 'dsh-lan-assist', '{"name":"dsh-lan-assist"}\n')
  const sem = writePlugin(root, 'dsh-semantic-os', '{"name":"dsh-semantic-os"}\n')
  const doc = {
    version: 1,
    plugins: {
      'dsh-lan-assist': lockEntry('dsh-lan-assist', LAN, lan),
      'dsh-semantic-os': lockEntry('dsh-semantic-os', SEM, sem),
    },
  }
  const lockAbs = join(root, 'runtime/plugins/plugins.lock.json')
  mkdirSync(dirname(lockAbs), { recursive: true })
  writeFileSync(lockAbs, `${JSON.stringify(doc, null, 2)}\n`)
  const matched = spawnSync(process.execPath, [script, 'verify', '--root', root], { encoding: 'utf8' })
  assert.equal(matched.status, 0, matched.stderr)
  const stale = spawnSync(process.execPath, [script, 'verify', '--root', root, '--upstream-sha', LAN], {
    encoding: 'utf8',
  })
  assert.equal(stale.status, 1, stale.stderr)
  assert.match(stale.stderr, /stale dsh-semantic-os/)
  assert.match(stale.stderr, new RegExp(SEM))
  assert.match(stale.stderr, new RegExp(LAN))
  assert.equal(stale.stderr.includes('stale dsh-lan-assist'), false)
})

function writeRel(root, rel, body) {
  const abs = join(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, body)
  return { rel, hash: sha256(body) }
}

function semanticLock(root, sealedBody, overlayBody, extra) {
  const lan = writePlugin(root, 'dsh-lan-assist', '{"name":"dsh-lan-assist"}\n')
  const semPkg = writeRel(root, 'runtime/plugins/dsh-semantic-os/package.json', '{"name":"dsh-semantic-os"}\n')
  const stores = writeRel(root, 'runtime/plugins/dsh-semantic-os/python/stores.py', sealedBody)
  writeRel(root, 'runtime/vendor-overlays/dsh-semantic-os/python/stores.py', overlayBody)
  const sem = lockEntry('dsh-semantic-os', SEM, semPkg)
  sem.files[stores.rel] = stores.hash
  if (extra) {
    const file = writeRel(root, extra.sealedRel, extra.sealedBody)
    writeRel(root, extra.overlayRel, extra.overlayBody)
    sem.files[file.rel] = file.hash
  }
  const doc = {
    version: 1,
    plugins: {
      'dsh-lan-assist': lockEntry('dsh-lan-assist', LAN, lan),
      'dsh-semantic-os': sem,
    },
  }
  const lockAbs = join(root, 'runtime/plugins/plugins.lock.json')
  mkdirSync(dirname(lockAbs), { recursive: true })
  writeFileSync(lockAbs, `${JSON.stringify(doc, null, 2)}\n`)
  return root
}

function withSemanticRoot(sealedBody, overlayBody, extra) {
  return semanticLock(mkdtempSync(join(tmpdir(), 'sem-overlay-')), sealedBody, overlayBody, extra)
}

test('plugins-lock exits 1 when sealed stores.py matches the lock and differs from the overlay', () => {
  const root = withSemanticRoot('sealed\n', 'overlay\n')
  try {
    const result = spawnSync(process.execPath, [script, 'verify', '--root', root], { encoding: 'utf8' })
    assert.equal(result.status, 1, result.stderr)
    assert.match(result.stderr, /dsh-semantic-os overlay drift runtime\/plugins\/dsh-semantic-os\/python\/stores\.py/)
    assert.match(result.stderr, /plugins\.lock verify failed/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('plugins-lock exits 1 when another semantic overlay file matches the lock and differs on disk', () => {
  const root = withSemanticRoot('same\n', 'same\n', {
    sealedRel: 'runtime/plugins/dsh-semantic-os/python/extra.py',
    overlayRel: 'runtime/vendor-overlays/dsh-semantic-os/python/extra.py',
    sealedBody: 'sealed-extra\n',
    overlayBody: 'overlay-extra\n',
  })
  try {
    const result = spawnSync(process.execPath, [script, 'verify', '--root', root], { encoding: 'utf8' })
    assert.equal(result.status, 1, result.stderr)
    assert.match(result.stderr, /dsh-semantic-os overlay drift runtime\/plugins\/dsh-semantic-os\/python\/extra\.py/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('plugins-lock exits 0 when sealed stores.py matches the overlay', () => {
  const root = withSemanticRoot('same\n', 'same\n')
  try {
    const result = spawnSync(process.execPath, [script, 'verify', '--root', root], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /plugins\.lock verify ok/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
