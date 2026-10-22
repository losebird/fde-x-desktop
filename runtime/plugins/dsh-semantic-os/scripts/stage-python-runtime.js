import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function isVenvTemplate(path) {
  const normalized = String(path || '').replaceAll('\\', '/').toLowerCase()
  return normalized.includes('/lib/venv/') || normalized.includes('/venv/scripts/')
}

export function rankPython(path) {
  if (isVenvTemplate(path)) return -1
  const normalized = String(path || '').replaceAll('\\', '/')
  const base = basename(path).toLowerCase()
  if (base === 'python.exe' && /\/python\.exe$/i.test(normalized) && !normalized.toLowerCase().includes('/scripts/')) return 100
  if (/^python3\.\d+$/.test(base)) return 90
  if (base === 'python3') return 80
  if (base === 'python') return 70
  if (base === 'python.exe') return 50
  return 0
}

export function pythonWorks(python) {
  try {
    execFileSync(python, ['-c', 'import sys; print(sys.executable)'], {
      stdio: 'pipe',
      timeout: 30000,
    })
    return true
  } catch {
    return false
  }
}

export function pickStagedPython(root) {
  const candidates = []
  function walk(dir, depth = 0) {
    if (depth > 6) return
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      let info
      try { info = statSync(path) } catch { continue }
      if (info.isDirectory()) walk(path, depth + 1)
      else if (name === 'python.exe' || name === 'python3' || name === 'python' || /^python3\.\d+$/.test(name)) {
        candidates.push(path)
      }
    }
  }
  walk(root)
  const ranked = candidates
    .map((path) => ({ path, rank: rankPython(path) }))
    .filter((row) => row.rank >= 0)
    .sort((a, b) => b.rank - a.rank)
  for (const row of ranked) {
    let path = row.path
    try { path = realpathSync(path) } catch { continue }
    if (pythonWorks(path)) return resolve(path)
  }
  return ''
}

function isDirectRun() {
  try {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1] || '')
  } catch {
    return false
  }
}

if (isDirectRun()) {
  const dest = process.argv[2]
  const version = process.argv[3] || '3.12.10'
  if (!dest) throw new Error('usage: stage-python-runtime.js DEST [PYTHON_VERSION]')
  mkdirSync(dest, { recursive: true })
  execFileSync('uv', ['python', 'install', version, '--install-dir', dest, '--no-bin', '--no-registry', '--reinstall'], {
    stdio: 'inherit',
    env: { ...process.env, UV_CACHE_DIR: process.env.UV_CACHE_DIR || join(dirname(dest), '.uv-cache') },
  })
  const python = pickStagedPython(dest)
  if (!python) throw new Error(`uv installed no usable Python executable under ${dest}`)
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs')
    appendFileSync(process.env.GITHUB_OUTPUT, `python=${python}\n`)
  }
  console.log(python)
}
