/**
 * Install missing pieces for personal use: semantica 0.7.0, FAISS, Oxigraph.
 * macOS: brew install libomp when faiss needs it.
 * Linux: apt/dnf/yum libgomp when faiss needs it.
 * @module dsh-semantic-os/ensure-deps
 */

import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolveBundledRuntime } from './runtime-bundle.js'
import { resolveInstalledRuntime } from './runtime-install.js'

const EXPECTED = '0.7.0'
const SEMANTICA_EXTRAS = 'explorer,graph-embeddings,documents,parse-pdf,nlp-spacy,tripletstore-oxigraph'
const PLUGIN_ROOT = dirname(fileURLToPath(import.meta.url))
const RUNTIME_REQUIREMENTS = join(PLUGIN_ROOT, 'runtime', 'requirements.txt')
const RUNTIME_CONSTRAINTS = join(PLUGIN_ROOT, 'runtime', 'constraints.txt')
const OXIGRAPH_PROBE = 'import pyoxigraph; print("ok")'

function dshHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

function venvPython() {
  return process.platform === 'win32'
    ? join(dshHome(), 'semantic-os', 'venv', 'Scripts', 'python.exe')
    : join(dshHome(), 'semantic-os', 'venv', 'bin', 'python')
}

let activeInstallSignal = null

function run(argv, opts = {}) {
  const timeoutMs = opts.timeoutMs || 180_000
  const signal = opts.signal || activeInstallSignal
  return new Promise((resolve) => {
    let settled = false
    const done = (value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
      resolve(value)
    }
    const proc = spawn(argv[0], argv.slice(1), {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      // Probes/installers must never write bytecode back into the read-only
      // bundled runtime; callers that need a writable cache pass opts.env.
      env: opts.env || { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    })
    let stdout = ''
    let stderr = ''
    const onAbort = () => {
      try { proc.kill('SIGKILL') } catch { /* ignore */ }
      done({ code: -1, stdout, stderr: stderr || 'aborted' })
    }
    const timer = setTimeout(() => {
      try { proc.kill('SIGKILL') } catch { /* ignore */ }
      done({ code: -1, stdout, stderr: stderr || 'timeout' })
    }, timeoutMs)
    proc.stdout?.on('data', (c) => { stdout += String(c) })
    proc.stderr?.on('data', (c) => { stderr += String(c) })
    proc.on('error', (err) => done({ code: -1, stdout, stderr: err.message }))
    proc.on('exit', (code) => done({ code: code ?? -1, stdout, stderr }))
    if (signal) {
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })
    }
  })
}

async function which(cmd) {
  const probe = process.platform === 'win32'
    ? ['where', cmd]
    : ['sh', '-c', `command -v ${cmd}`]
  const out = await run(probe, { timeoutMs: 5000 })
  return out.code === 0 && out.stdout.trim() ? out.stdout.trim().split(/\r?\n/)[0] : ''
}

async function probeSemantica(python) {
  const out = await run([python, '-c', 'import importlib.metadata as m; print(m.version("semantica"))'], { timeoutMs: 15000 })
  const version = out.stdout.trim().split(/\s+/)[0] || ''
  return { ok: out.code === 0 && version === EXPECTED, version, python }
}

async function probeFaiss(python) {
  const out = await run([python, '-c', 'import faiss; print("ok")'], { timeoutMs: 15000 })
  return out.code === 0
}

async function probeOxigraph(python) {
  const out = await run([python, '-c', OXIGRAPH_PROBE], { timeoutMs: 15000 })
  return out.code === 0
}

function liteFailDetail(raw) {
  const msg = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 200)
  if (process.platform === 'win32') {
    return ('这台 Windows 原生跑不了嵌入式图库。先试 Docker Desktop，再试 WSL。都没有才用文件备份。' + (msg ? ' ' + msg : '')).slice(0, 240)
  }
  if (process.platform === 'darwin' && /libomp|openmp|libgomp/i.test(msg)) {
    return '这台 Mac 缺 OpenMP（libomp）。装插件时会用 Homebrew 自动装；这次没装上，先用文件备份。'
  }
  if (process.platform === 'linux' && /libgomp|openmp|libomp/i.test(msg)) {
    return '这台 Linux 缺 OpenMP（libgomp）。装插件时会用系统包管理器自动装；这次没装上，先用文件备份。'
  }
  return msg || '嵌入式图库没起来，先用文件备份。'
}

function firstExisting(paths) {
  for (const dest of paths) {
    if (dest && existsSync(dest)) return dest
  }
  return ''
}

function findLibomp() {
  return firstExisting([
    '/opt/homebrew/opt/libomp/lib/libomp.dylib',
    '/usr/local/opt/libomp/lib/libomp.dylib',
    '/opt/local/lib/libomp.dylib',
  ])
}

function findLibgomp() {
  return firstExisting([
    '/usr/lib/x86_64-linux-gnu/libgomp.so.1',
    '/usr/lib/aarch64-linux-gnu/libgomp.so.1',
    '/lib/x86_64-linux-gnu/libgomp.so.1',
    '/lib/aarch64-linux-gnu/libgomp.so.1',
    '/usr/lib64/libgomp.so.1',
    '/usr/lib/libgomp.so.1',
    '/lib64/libgomp.so.1',
  ])
}

async function findBrew() {
  const seen = new Set()
  const candidates = [await which('brew'), '/opt/homebrew/bin/brew', '/usr/local/bin/brew']
  for (const brew of candidates) {
    if (!brew || seen.has(brew) || !existsSync(brew)) continue
    seen.add(brew)
    const out = await run([brew, '--version'], { timeoutMs: 8000 })
    if (out.code === 0) return brew
  }
  return ''
}

async function pkgInstall(pkgs) {
  const tries = []
  const apt = await which('apt-get')
  if (apt) {
    tries.push([apt, 'install', '-y', ...pkgs])
    tries.push(['sudo', '-n', apt, 'install', '-y', ...pkgs])
  }
  const dnf = (await which('dnf')) || (await which('yum'))
  if (dnf) {
    tries.push([dnf, 'install', '-y', ...pkgs])
    tries.push(['sudo', '-n', dnf, 'install', '-y', ...pkgs])
  }
  const pacman = await which('pacman')
  if (pacman) {
    tries.push([pacman, '-S', '--noconfirm', ...pkgs])
    tries.push(['sudo', '-n', pacman, '-S', '--noconfirm', ...pkgs])
  }
  for (const argv of tries) {
    const out = await run(argv, { timeoutMs: 180000 })
    if (out.code === 0) return { ok: true, detail: '' }
  }
  return { ok: false, detail: tries.length ? '系统包没装上' : '没有可用的系统包管理器' }
}

function spawnDetached(argv) {
  try {
    const proc = spawn(argv[0], argv.slice(1), {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    proc.unref()
    return true
  } catch {
    return false
  }
}

async function ensureOpenMp() {
  if (process.platform === 'darwin') {
    if (findLibomp()) return { ok: true, detail: '' }
    const brew = await findBrew()
    if (!brew) {
      return { ok: false, detail: '这台 Mac 没有 Homebrew，装不上 OpenMP（libomp），嵌入式图库起不来，先用文件备份。' }
    }
    const inst = await run([brew, 'install', 'libomp'], { timeoutMs: 300000 })
    if (findLibomp() || inst.code === 0) return { ok: true, detail: '' }
    return { ok: false, detail: 'Homebrew 没能装上 libomp，嵌入式图库起不来，先用文件备份。' }
  }
  if (process.platform === 'linux') {
    if (findLibgomp()) return { ok: true, detail: '' }
    const ld = await run(['sh', '-c', 'ldconfig -p 2>/dev/null | grep -q libgomp.so && echo ok'], { timeoutMs: 5000 })
    if (ld.stdout.includes('ok')) return { ok: true, detail: '' }
    let inst = await pkgInstall(['libgomp1'])
    if (!(findLibgomp() || inst.ok)) inst = await pkgInstall(['libgomp'])
    if (findLibgomp() || inst.ok) return { ok: true, detail: '' }
    return { ok: false, detail: '这台 Linux 缺 OpenMP（libgomp），系统包没自动装上，先用文件备份。' }
  }
  if (process.platform === 'win32') {
    return { ok: true, detail: '' }
  }
  return { ok: true, detail: '' }
}

async function resolveProbePython() {
  const vpy = venvPython()
  if ((await probeSemantica(vpy)).ok) return vpy
  return process.env.DSH_SEMANTICA_PYTHON || 'python3'
}

async function probeGraphStore(python) {
  const ok = await probeOxigraph(python)
  if (ok) return { ok: true, via: 'oxigraph', detail: '本机图库（Oxigraph）' }
  return { ok: false, via: '', detail: 'pyoxigraph 没装上' }
}

async function exportLegacyFalkor(python) {
  const script = join(PLUGIN_ROOT, 'python', 'migrations', '070_export_falkordb.py')
  const home = dshHome()
  const out = await run([python, script, home], { timeoutMs: 120000 })
  if (out.code === 0) return { ok: true, detail: out.stdout.trim().slice(0, 240) }
  return { ok: false, detail: (out.stderr || out.stdout || 'export skipped').slice(0, 240) }
}

async function ensureVenvPython() {
  const envPy = process.env.DSH_SEMANTICA_PYTHON
  if (envPy) {
    const hit = await probeSemantica(envPy)
    if (hit.ok) return envPy
  }
  const vpy = venvPython()
  if ((await probeSemantica(vpy)).ok) return vpy
  const py = (await which('python3')) || (await which('python')) || 'python3'
  await mkdir(join(dshHome(), 'semantic-os'), { recursive: true })
  const made = await run([py, '-m', 'venv', join(dshHome(), 'semantic-os', 'venv')], { timeoutMs: 120000 })
  if (made.code !== 0 && !(await probeSemantica(vpy)).ok) {
    return py
  }
  return vpy
}

async function pipInstall(python, spec) {
  const extra = Array.isArray(spec) ? spec : [spec]
  return run([python, '-m', 'pip', 'install', '-q', ...extra], { timeoutMs: 900_000 })
}

async function collectStatus(python, extra = {}) {
  const wheel = extra.wheel || await probeSemantica(python)
  const faiss = extra.faiss != null ? extra.faiss : await probeFaiss(python)
  const live = extra.live || await probeGraphStore(python)
  return {
    ok: Boolean(wheel.ok),
    python,
    semantica: wheel,
    vector: { ok: Boolean(faiss), via: faiss ? 'faiss' : '', detail: faiss ? '' : 'FAISS 没装上' },
    graph: {
      ok: Boolean(live.ok),
      via: live.ok ? 'oxigraph' : '',
      detail: live.ok ? '本机图库（Oxigraph）' : (live.detail || '图库没起来'),
    },
  }
}

/** @type {{ at: number, value: Record<string, unknown> | null }} */
let probeCache = { at: 0, value: null }

export async function probeDeps(options = {}) {
  if (!options.fresh && probeCache.value && Date.now() - probeCache.at < 30000) return probeCache.value
  let runtime = await resolveInstalledRuntime({ verifyFiles: false })
  if (!runtime.ok) runtime = await resolveBundledRuntime({ verifyFiles: false })
  // Full tree verification only when a caller explicitly supplies a trusted digest
  // that differs from the current manifest; a bare status probe stays fast.
  if (runtime.ok && typeof options.trustedRuntimeDigest === 'string' && runtime.manifestDigest !== options.trustedRuntimeDigest) {
    runtime = await resolveInstalledRuntime({ verifyFiles: true })
    if (!runtime.ok) runtime = await resolveBundledRuntime({ verifyFiles: true })
  }
  const envPy = process.env.DSH_SEMANTICA_PYTHON
  const python = runtime.ok
    ? runtime.python
    : (envPy && (await probeSemantica(envPy)).ok)
      ? envPy
      : (await probeSemantica(venvPython())).ok
        ? venvPython()
        : (envPy || venvPython() || 'python3')
  const status = await collectStatus(python)
  status.source = runtime.ok ? 'bundled' : 'existing'
  status.runtime = runtime.ok ? { key: runtime.key, packageName: runtime.packageName, runtimeVersion: runtime.manifest.runtimeVersion, manifestDigest: runtime.manifestDigest, verified: runtime.verified } : null
  probeCache = { at: Date.now(), value: status }
  return status
}

/** @type {Promise<Record<string, unknown>> | null} */
let inflight = null

export async function ensureDeps(options = {}) {
  if (inflight) return inflight
  const progress = typeof options.onProgress === 'function' ? options.onProgress : () => undefined
  inflight = (async () => {
    activeInstallSignal = options.signal || null
    let runtime = await resolveInstalledRuntime({ verifyFiles: true })
    if (!runtime.ok) runtime = await resolveBundledRuntime({ verifyFiles: true })
    const allowOnline = options.allowOnline !== false && process.env.DSH_SEMANTIC_OS_OFFLINE !== '1'
    if (!runtime.ok && !allowOnline) {
      return {
        ok: false,
        semantica: { ok: false, detail: runtime.error || 'bundled runtime missing' },
        graph: { ok: false, detail: 'bundled runtime missing' },
        vector: { ok: false, detail: 'bundled runtime missing' },
        source: 'bundled-missing',
      }
    }
    progress({ step: 'creating_venv', current: 1, total: 4, detail: runtime.ok ? 'Preparing bundled offline runtime' : 'Creating private Python environment' })
    const python = runtime.ok ? runtime.python : await ensureVenvPython()
    let wheel = await probeSemantica(python)
    if (!wheel.ok) {
      if (runtime.ok) {
        return {
          ok: false,
          semantica: { ...wheel, detail: wheel.detail || 'bundled runtime verification failed' },
          graph: { ok: false, detail: 'bundled runtime verification failed' },
          vector: { ok: false, detail: 'bundled runtime verification failed' },
          source: 'bundled-invalid',
        }
      }
      progress({ step: 'installing_semantica', current: 2, total: 4, detail: `Installing semantica[${SEMANTICA_EXTRAS}]==${EXPECTED}` })
      await pipInstall(python, ['-r', RUNTIME_REQUIREMENTS, '-c', RUNTIME_CONSTRAINTS])
      wheel = await probeSemantica(python)
    }
    progress({ step: 'installing_vector', current: 3, total: 4, detail: 'Preparing FAISS vector search' })
    let faiss = await probeFaiss(python)
    if (!faiss && !runtime.ok) {
      await ensureOpenMp()
      await pipInstall(python, 'faiss-cpu')
      faiss = await probeFaiss(python)
    }
    progress({ step: 'verifying', current: 4, total: 4, detail: 'Verifying Oxigraph and migrating old graphs' })
    await exportLegacyFalkor(python)
    const live = await probeGraphStore(python)
    const status = await collectStatus(python, { wheel, faiss, live })
    status.source = runtime.ok ? 'bundled' : 'online-fallback'
    status.runtime = runtime.ok ? { key: runtime.key, packageName: runtime.packageName, runtimeVersion: runtime.manifest.runtimeVersion, manifestDigest: runtime.manifestDigest, verified: runtime.verified } : null
    if (!status.graph.ok) status.graph.detail = live.detail || status.graph.detail
    try {
      const dest = join(dshHome(), 'semantic-os', 'deps.json')
      await writeFile(dest, `${JSON.stringify(status, null, 2)}\n`, 'utf8')
    } catch { /* ignore */ }
    return status
  })().finally(() => {
    activeInstallSignal = null
    inflight = null
  })
  return inflight
}
