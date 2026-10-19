import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join, relative } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./lan-assist-tree.mjs', import.meta.url))
const LOCK_REL = 'runtime/plugins/plugins.lock.json'
const PIN = '31d75468e0ffd58bb5bb214325c7517c7c42a8ab'

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

function sourceCheckout() {
  const source = process.env.LAN_ASSIST_SOURCE || join(homedir(), '.dsh', 'vendor', 'dsh-lan-assist')
  assert.equal(existsSync(source), true, `lan-assist source checkout missing: ${source}`)
  const head = spawnSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
  assert.equal(head.status, 0, head.stderr)
  assert.equal(head.stdout.trim(), PIN)
  return source
}

function endOfJsonValue(text, start) {
  const open = text[start]
  if (open !== '{' && open !== '[') {
    if (open === '"') {
      for (let i = start + 1; i < text.length; i += 1) {
        if (text[i] === '\\') {
          i += 1
          continue
        }
        if (text[i] === '"') return i + 1
      }
      throw new Error('unterminated string')
    }
    const matched = text.slice(start).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|^true|^false|^null/u)
    if (!matched) throw new Error(`bad json value at ${start}`)
    return start + matched[0].length
  }
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  for (let i = start; i < text.length; i += 1) {
    const c = text[i]
    if (inString) {
      if (c === '\\') {
        i += 1
        continue
      }
      if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === open) depth += 1
    else if (c === close) {
      depth -= 1
      if (depth === 0) return i + 1
    }
  }
  throw new Error('unterminated json value')
}

function splitLanAssist(text) {
  const key = '"dsh-lan-assist": '
  const start = text.indexOf(key)
  assert.ok(start >= 0, 'lock has no dsh-lan-assist entry')
  const valueStart = start + key.length
  const valueEnd = endOfJsonValue(text, valueStart)
  return {
    prefix: text.slice(0, valueStart),
    entry: text.slice(valueStart, valueEnd),
    suffix: text.slice(valueEnd),
  }
}

function unifiedLock() {
  return `${JSON.stringify({
    version: 1,
    note: 'preserve-me',
    plugins: {
      'dsh-lan-assist': {
        source: {
          repo: 'losebird/dsh-lan-assist',
          commit: '0000000000000000000000000000000000000000',
          parent: '0000000000000000000000000000000000000000',
        },
        overlay: {
          repo: 'losebird/fde-x-desktop',
          commit: '0000000000000000000000000000000000000000',
          path: 'runtime/vendor-overlays/dsh-lan-assist',
        },
        blobs: { 'pair.js': '0000000000000000000000000000000000000000' },
        excluded: ['leftover-cancel.mjs'],
        dependencies: { nats: { version: '0.0.0', integrity: 'sha512-stale' } },
        files: {
          'runtime/plugins/dsh-lan-assist/package.json': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
      },
      'dsh-semantic-os': {
        source: {
          repo: 'losebird/dsh-semantic-os',
          commit: 'a13e45390a860162042ddbcdd5b6eee3b92651d8',
          parent: '42e228fa25ad757b933bf5ffe1e3fe83640b4ae7',
        },
        overlay: {
          repo: 'losebird/fde-x-desktop',
          commit: '6a79f383b951c7e13f424c4577dc06b85f64304e',
          path: 'runtime/vendor-overlays/dsh-semantic-os',
        },
        files: {
          'runtime/plugins/dsh-semantic-os/README.md': '5682db1d1b3f66aab1737c902411e97eeab0266d29440c455195ca06b3ab076e',
        },
      },
    },
  }, null, 2)}\n`
}

function writeLock(root, text) {
  const abs = join(root, LOCK_REL)
  mkdirSync(join(root, 'runtime', 'plugins'), { recursive: true })
  writeFileSync(abs, text)
  return abs
}

function run(command, root, source) {
  return spawnSync(process.execPath, [script, command, '--source', source, '--root', root], { encoding: 'utf8' })
}

test('sync replaces only the dsh-lan-assist lock entry', () => {
  const source = sourceCheckout()
  const root = mkdtempSync(join(tmpdir(), 'lan-lock-keep-'))
  try {
    const before = unifiedLock()
    writeLock(root, before)
    const beforeParts = splitLanAssist(before)
    const synced = run('sync', root, source)
    assert.equal(synced.status, 0, synced.stderr)
    const after = readFileSync(join(root, LOCK_REL), 'utf8')
    const afterParts = splitLanAssist(after)
    assert.equal(afterParts.prefix, beforeParts.prefix)
    assert.equal(afterParts.suffix, beforeParts.suffix)
    assert.notEqual(afterParts.entry, beforeParts.entry)
    const parsed = JSON.parse(after)
    assert.deepEqual(Object.keys(parsed), ['version', 'note', 'plugins'])
    assert.equal(parsed.note, 'preserve-me')
    assert.equal(parsed.version, 1)
    assert.deepEqual(Object.keys(parsed.plugins), ['dsh-lan-assist', 'dsh-semantic-os'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('sync restores a stale dsh-lan-assist entry', () => {
  const source = sourceCheckout()
  const root = mkdtempSync(join(tmpdir(), 'lan-lock-stale-'))
  try {
    const before = unifiedLock()
    writeLock(root, before)
    const beforeParts = splitLanAssist(before)
    const synced = run('sync', root, source)
    assert.equal(synced.status, 0, synced.stderr)
    const after = readFileSync(join(root, LOCK_REL), 'utf8')
    const afterParts = splitLanAssist(after)
    assert.equal(afterParts.suffix, beforeParts.suffix)
    const entry = JSON.parse(after).plugins['dsh-lan-assist']
    assert.equal(entry.source.repo, 'losebird/dsh-lan-assist')
    assert.equal(entry.source.commit, PIN)
    assert.equal(entry.source.parent, 'ab6a03af83c65eb6238a254aa1ddf999f1be7515')
    assert.equal(entry.overlay.commit, '6a79f383b951c7e13f424c4577dc06b85f64304e')
    assert.equal(entry.overlay.path, 'runtime/vendor-overlays/dsh-lan-assist')
    assert.equal(entry.dependencies.nats.version, '2.29.3')
    assert.equal(entry.files['runtime/plugins/dsh-lan-assist/package.json'] === 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', false)
    for (const [rel, hash] of Object.entries(entry.files)) {
      assert.equal(sha256(readFileSync(join(root, rel))), hash, rel)
    }
    plantSemanticReadme(root)
    const verified = run('verify', root, source)
    assert.equal(verified.status, 0, verified.stderr)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('sync fails when plugins.lock.json is missing', () => {
  const source = sourceCheckout()
  const root = mkdtempSync(join(tmpdir(), 'lan-lock-missing-'))
  try {
    const synced = run('sync', root, source)
    assert.notEqual(synced.status, 0)
    assert.match(synced.stderr, /plugins\.lock\.json/)
    assert.equal(existsSync(join(root, LOCK_REL)), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('sync fails when plugins.lock.json is not json', () => {
  const source = sourceCheckout()
  const root = mkdtempSync(join(tmpdir(), 'lan-lock-bad-'))
  try {
    const abs = writeLock(root, '{')
    const synced = run('sync', root, source)
    assert.notEqual(synced.status, 0)
    assert.match(synced.stderr, /plugins\.lock\.json/)
    assert.equal(readFileSync(abs, 'utf8'), '{')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

function plantSemanticReadme(root) {
  const src = fileURLToPath(new URL('../../runtime/plugins/dsh-semantic-os/README.md', import.meta.url))
  const dest = join(root, 'runtime/plugins/dsh-semantic-os/README.md')
  mkdirSync(join(root, 'runtime/plugins/dsh-semantic-os'), { recursive: true })
  writeFileSync(dest, readFileSync(src))
}

function lockStyle(text) {
  const newline = text.includes('\r\n') ? '\r\n' : '\n'
  const indented = text.split(/\r?\n/u).find((line) => /^[ \t]+\S/u.test(line))
  const indent = indented ? indented.match(/^[ \t]+/u)[0] : '  '
  return { indent, newline, trailing: text.endsWith('\n') }
}

function rewriteLock(root, mutate) {
  const abs = join(root, LOCK_REL)
  const text = readFileSync(abs, 'utf8')
  const doc = JSON.parse(text)
  mutate(doc)
  const style = lockStyle(text)
  let next = JSON.stringify(doc, null, style.indent)
  if (style.newline === '\r\n') next = next.replace(/\n/g, '\r\n')
  if (style.trailing) next += style.newline
  writeFileSync(abs, next)
}

function pluginTreeDigest(root) {
  const base = join(root, 'runtime', 'plugins')
  if (!existsSync(base)) return 'absent'
  const lines = []
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const abs = join(dir, name)
      if (statSync(abs).isDirectory()) walk(abs)
      else lines.push(`${relative(root, abs).split('\\').join('/')} ${sha256(readFileSync(abs))}`)
    }
  }
  walk(base)
  return lines.join('\n')
}

test('verify reports the lock entry when dsh-semantic-os is removed or corrupted', () => {
  const source = sourceCheckout()
  const mutations = [
    (doc) => { delete doc.plugins['dsh-semantic-os'] },
    (doc) => {
      doc.plugins['dsh-semantic-os'].files['runtime/plugins/dsh-semantic-os/README.md'] = 'b'.repeat(64)
    },
  ]
  for (const mutate of mutations) {
    const root = mkdtempSync(join(tmpdir(), 'lan-lock-entry-'))
    try {
      writeLock(root, unifiedLock())
      const synced = run('sync', root, source)
      assert.equal(synced.status, 0, synced.stderr)
      plantSemanticReadme(root)
      const healthy = run('verify', root, source)
      assert.equal(healthy.status, 0, healthy.stderr)
      rewriteLock(root, mutate)
      const verified = run('verify', root, source)
      assert.notEqual(verified.status, 0)
      assert.match(verified.stderr, /dsh-semantic-os/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
})

test('sync preserves lock indent and newline style', () => {
  const source = sourceCheckout()
  const cases = [
    { indent: '  ', newline: '\n', trailing: true },
    { indent: '    ', newline: '\n', trailing: true },
    { indent: '\t', newline: '\n', trailing: true },
    { indent: '  ', newline: '\r\n', trailing: true },
    { indent: '  ', newline: '\n', trailing: false },
  ]
  for (const style of cases) {
    const root = mkdtempSync(join(tmpdir(), 'lan-lock-style-'))
    try {
      const doc = JSON.parse(unifiedLock())
      let text = JSON.stringify(doc, null, style.indent)
      if (style.newline === '\r\n') text = text.replace(/\n/g, '\r\n')
      if (style.trailing) text += style.newline
      writeLock(root, text)
      const synced = run('sync', root, source)
      assert.equal(synced.status, 0, `${JSON.stringify(style)} ${synced.stderr}`)
      const after = readFileSync(join(root, LOCK_REL), 'utf8')
      if (style.newline === '\n') assert.equal(after.includes('\r'), false, JSON.stringify(style))
      else {
        assert.equal(after.includes('\r\n'), true, JSON.stringify(style))
        assert.equal(after.replace(/\r\n/g, '').includes('\n'), false, JSON.stringify(style))
      }
      assert.equal(after.endsWith('\n'), style.trailing, JSON.stringify(style))
      const logical = after.replace(/\r\n/g, '\n')
      const line = logical.split('\n').find((item) => item.includes(`"commit": "${PIN}"`))
      assert.ok(line, JSON.stringify(style))
      assert.equal(line.match(/^[ \t]*/u)[0], style.indent.repeat(4), JSON.stringify(style))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
})

test('sync writes nothing when the lock is missing, unreadable, or structurally invalid', () => {
  const source = sourceCheckout()
  const cases = [
    { name: 'missing', text: null },
    { name: 'bad json', text: '{' },
    { name: 'plugins array', text: '{"version":1,"plugins":[]}\n' },
  ]
  for (const item of cases) {
    const root = mkdtempSync(join(tmpdir(), 'lan-lock-nowrite-'))
    try {
      const marker = join(root, 'runtime/plugins/dsh-lan-assist/marker.txt')
      mkdirSync(join(root, 'runtime/plugins/dsh-lan-assist'), { recursive: true })
      writeFileSync(marker, 'sentinel')
      if (item.text !== null) writeLock(root, item.text)
      const before = pluginTreeDigest(root)
      const synced = run('sync', root, source)
      assert.notEqual(synced.status, 0, item.name)
      assert.match(synced.stderr, /plugins\.lock\.json/, item.name)
      assert.equal(pluginTreeDigest(root), before, item.name)
      if (item.text === null) assert.equal(existsSync(join(root, LOCK_REL)), false, item.name)
      else assert.equal(readFileSync(join(root, LOCK_REL), 'utf8'), item.text, item.name)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
})

test('verify names dsh-lan-assist when that lock entry is null', () => {
  const source = sourceCheckout()
  const root = mkdtempSync(join(tmpdir(), 'lan-lock-null-'))
  try {
    writeLock(root, unifiedLock())
    const synced = run('sync', root, source)
    assert.equal(synced.status, 0, synced.stderr)
    plantSemanticReadme(root)
    rewriteLock(root, (doc) => { doc.plugins['dsh-lan-assist'] = null })
    const verified = run('verify', root, source)
    assert.notEqual(verified.status, 0)
    assert.match(verified.stderr, /dsh-lan-assist/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
