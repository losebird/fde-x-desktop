import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

function localSpecs(source) {
  const out = []
  const re = /from ['"](\.[^'"]+)['"]/g
  let match
  while ((match = re.exec(source))) out.push(match[1])
  return out
}

function walkPacked(pkg, entry) {
  const seen = new Set()
  const missing = []
  const queue = [entry]
  while (queue.length) {
    const rel = queue.pop().replace(/\\/g, '/')
    if (seen.has(rel)) continue
    seen.add(rel)
    const abs = join(pkg, rel)
    if (!existsSync(abs)) {
      missing.push(rel)
      continue
    }
    if (!rel.endsWith('.js')) continue
    const dir = dirname(rel)
    for (const spec of localSpecs(readFileSync(abs, 'utf8'))) {
      const next = spec.endsWith('.js') ? spec : `${spec}.js`
      queue.push(join(dir, next))
    }
  }
  return { missing, seen }
}

const root = process.cwd()
const temp = mkdtempSync(join(tmpdir(), 'dsh-semantic-os-package-'))

try {
  const output = execFileSync('npm', ['pack', '--json', '--pack-destination', temp], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: join(temp, 'npm-cache') },
  })
  const packed = JSON.parse(output)
  const filename = packed[0] && packed[0].filename
  if (!filename) throw new Error('npm pack did not return a filename')
  execFileSync('tar', ['-xzf', join(temp, filename), '-C', temp])

  const pkg = join(temp, 'package')
  for (const relative of [
    'index.js',
    'ensure-deps.js',
    'installer.js',
    'runtime-bundle.js',
    'runtime-install.js',
    'sidecar-client.js',
    'workspace-authority.js',
    'version.js',
    'python/bootstrap.py',
    'python/board.py',
    'python/reference.py',
    'python/sight.py',
    'python/grade.py',
    'python/intent.py',
    'python/kind.py',
    'python/ledger.py',
    'python/stores.py',
    'extract-jobs.js',
    'opening-brief.js',
  ]) {
    readFileSync(join(pkg, relative))
  }
  const walked = walkPacked(pkg, 'index.js')
  if (walked.missing.length) throw new Error(`packed plugin missing imports: ${walked.missing.join(', ')}`)
  const py = readFileSync(join(pkg, 'python/bootstrap.py'), 'utf8')
  for (const name of ['stores', 'board', 'reference', 'sight', 'grade', 'kind', 'intent', 'ledger']) {
    if (!py.includes(`from ${name} import`)) throw new Error(`bootstrap no longer imports ${name}`)
    readFileSync(join(pkg, 'python', `${name}.py`))
  }
  await import(pathToFileURL(join(pkg, 'index.js')).href)
  console.log(`package archive imports and contains required runtime resources (${walked.seen.size} js modules)`)
} finally {
  rmSync(temp, { recursive: true, force: true })
}
