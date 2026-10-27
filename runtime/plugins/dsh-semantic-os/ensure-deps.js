/**
 * Install missing pieces for personal use: semantica 0.7.0, FAISS, FalkorDB.
 * Docker first. No Docker: OS-specific store.
 * macOS: brew install libomp then falkordblite.
 * Linux: apt/dnf/yum libgomp then falkordblite. Homebrew is not required.
 * Windows: Docker Desktop, else WSL lite on 6379. Homebrew is not required.
 * File backup only after the OS-specific path fails.
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
const IMAGE = process.env.DSH_FALKORDB_IMAGE || 'falkordb/falkordb:v4.0.3'
const NAME = 'dsh-falkordb'
const LITE_DETAIL = '没 Docker，用官方嵌入式包开店'
const LITE_PROBE = [
  'try:',
  '    from redislite.falkordb_client import FalkorDB',
  'except Exception:',
  '    from falkordblite import FalkorDB',
  'print("ok")',
].join('\n')

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

async function probeFalkorClient(python) {
  const out = await run([python, '-c', 'import falkordb; print("ok")'], { timeoutMs: 15000 })
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

async function startWindowsWslLite() {
  const wsl = await which('wsl')
  if (!wsl) {
    return { ok: false, detail: '这台 Windows 没有 Docker Desktop，也没有 WSL。原生 Windows 开不了嵌入式图库，先用文件备份。' }
  }
  const ping = await run([wsl, '-e', 'true'], { timeoutMs: 15000 })
  if (ping.code !== 0) {
    return { ok: false, detail: '这台 Windows 的 WSL 没起来。先开 WSL 或装 Docker Desktop，否则先用文件备份。' }
  }
  await run([wsl, '-e', 'bash', '-lc', 'python3 -m pip install -q falkordblite || python -m pip install -q falkordblite'], { timeoutMs: 300000 })
  const script = [
    'import os, time',
    'from pathlib import Path',
    'try:',
    '    from redislite.falkordb_client import FalkorDB',
    'except Exception:',
    '    from falkordblite import FalkorDB',
    'dest = Path.home() / ".dsh" / "semantic-os" / "falkordb"',
    'dest.mkdir(parents=True, exist_ok=True)',
    'FalkorDB(str(dest / "graph.db"), serverconfig={"port": "6379", "bind": "127.0.0.1"})',
    'while True:',
    '    time.sleep(60)',
  ].join('; ')
  const launched = spawnDetached([wsl, '-e', 'bash', '-lc', `python3 -c ${JSON.stringify(script)}`])
  if (!launched) return { ok: false, detail: 'WSL 里没能拉起嵌入式图库，先用文件备份。' }
  for (let i = 0; i < 8; i += 1) {
    const live = await probeFalkorServer()
    if (live.ok) return { ok: true, via: 'falkordblite-wsl', detail: '没 Docker，用 WSL 里的官方嵌入式包开店' }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  return { ok: false, detail: 'WSL 里装了嵌入式包，但 6379 还没起来。先用文件备份。' }
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

async function probeFalkorServer(python) {
  const host = process.env.FALKORDB_HOST || '127.0.0.1'
  const port = process.env.FALKORDB_PORT || '6379'
  const resolved = python || await resolveProbePython()
  const out = await run([resolved, '-c', `from falkordb import FalkorDB; g=FalkorDB(host=${JSON.stringify(host)}, port=${Number(port)}).select_graph("dsh_ping"); g.query("RETURN 1"); print("ok")`], { timeoutMs: 8000 })
  if (out.code === 0 && out.stdout.includes('ok')) {
    return { ok: true, via: 'tcp', host, port: Number(port), detail: '' }
  }
  const raw = String(out.stderr || out.stdout || '').toLowerCase()
  const detail = /111|econnrefused|connection refused/.test(raw)
    ? '本机 6379 没人听。'
    : '图库 TCP 没起来。'
  return { ok: false, via: '', host, port: Number(port), detail }
}

async function probeFalkorLite(python) {
  const out = await run([python, '-c', LITE_PROBE], { timeoutMs: 30000 })
  if (out.code === 0 && out.stdout.includes('ok')) {
    return { ok: true, via: 'falkordblite', detail: LITE_DETAIL }
  }
  return { ok: false, via: '', detail: liteFailDetail(out.stderr || out.stdout) }
}

async function probeGraphStore(python) {
  const tcp = await probeFalkorServer(python)
  if (tcp.ok) return tcp
  const lite = await probeFalkorLite(python)
  if (lite.ok) return lite
  return {
    ok: false,
    via: '',
    host: tcp.host,
    port: tcp.port,
    detail: lite.detail || tcp.detail || '图库没起来，先用文件备份。',
  }
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

async function startFalkorDocker() {
  const docker = await which('docker')
  if (!docker) return { ok: false, via: '', detail: '没有 Docker。' }
  const running = await run([docker, 'inspect', '-f', '{{.State.Running}}', NAME], { timeoutMs: 8000 })
  if (running.stdout.trim() === 'true') return { ok: true, via: 'docker', detail: '' }
  const exists = running.code === 0
  if (exists) {
    const started = await run([docker, 'start', NAME], { timeoutMs: 30000 })
    if (started.code === 0) return { ok: true, via: 'docker', detail: '' }
  }
  const pulled = await run([
    docker, 'run', '-d',
    '--name', NAME,
    '--restart', 'unless-stopped',
    '-p', '127.0.0.1:6379:6379',
    IMAGE,
  ], { timeoutMs: 180000 })
  if (pulled.code === 0) return { ok: true, via: 'docker', detail: '' }
  return { ok: false, via: 'docker', detail: (pulled.stderr || pulled.stdout || 'docker run failed').slice(0, 240) }
}

async function collectStatus(python, extra = {}) {
  const wheel = extra.wheel || await probeSemantica(python)
  const faiss = extra.faiss != null ? extra.faiss : await probeFaiss(python)
  const live = extra.live || await probeGraphStore(python)
  const liteOk = live.ok && live.via === 'falkordblite'
  return {
    ok: Boolean(wheel.ok),
    python,
    semantica: wheel,
    vector: { ok: Boolean(faiss), via: faiss ? 'faiss' : '', detail: faiss ? '' : 'FAISS 没装上' },
    graph: {
      ok: Boolean(live.ok),
      via: live.ok ? (live.via === 'tcp' ? 'falkordb' : (live.via || 'falkordb')) : '',
      detail: live.ok ? (liteOk ? LITE_DETAIL : '主账本在 FalkorDB') : (live.detail || '图库没起来，先用文件备份'),
      host: live.host || '127.0.0.1',
      port: live.port || 6379,
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
    progress({ step: 'creating_venv', current: 1, total: 6, detail: runtime.ok ? 'Preparing bundled offline runtime' : 'Creating private Python environment' })
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
      progress({ step: 'installing_semantica', current: 2, total: 6, detail: `Installing semantica[${SEMANTICA_EXTRAS}]==${EXPECTED}` })
      await pipInstall(python, ['-r', RUNTIME_REQUIREMENTS, '-c', RUNTIME_CONSTRAINTS])
      wheel = await probeSemantica(python)
    }
    progress({ step: 'installing_vector', current: 3, total: 6, detail: 'Preparing FAISS vector search' })
    let faiss = await probeFaiss(python)
    if (!faiss && !runtime.ok) {
      await pipInstall(python, 'faiss-cpu')
      faiss = await probeFaiss(python)
    }
    progress({ step: 'installing_graph_client', current: 4, total: 6, detail: 'Preparing FalkorDB client' })
    let client = await probeFalkorClient(python)
    if (!client && !runtime.ok) {
      await pipInstall(python, 'falkordb')
      client = await probeFalkorClient(python)
    }
    progress({ step: 'preparing_graph_store', current: 5, total: 6, detail: runtime.ok ? 'Checking optional graph store' : 'Preparing graph store' })
    const existingServer = await probeFalkorServer()
    const server = existingServer.ok ? existingServer : await startFalkorDocker()
    let live
    if (existingServer.ok || server.ok) {
      live = existingServer.ok ? existingServer : await probeFalkorServer()
      live = { ...live, via: live.via || server.via }
    } else if (process.platform === 'win32') {
      const wsl = await startWindowsWslLite()
      live = wsl.ok
        ? wsl
        : { ok: false, via: '', detail: wsl.detail || (runtime.ok ? '离线运行时使用文件后端；外部 FalkorDB 是可选增强。' : '这台 Windows 没有 Docker Desktop，也没有可用的 WSL，先用文件备份。') }
    } else if (runtime.ok) {
      const lite = await probeFalkorLite(python)
      live = lite.ok
        ? { ok: true, via: 'falkordblite', detail: LITE_DETAIL }
        : { ok: false, via: '', detail: '离线运行时使用文件后端；外部 FalkorDB 是可选增强。' }
    } else {
      const omp = await ensureOpenMp()
      let lite = await probeFalkorLite(python)
      if (!lite.ok && !runtime.ok) {
        await pipInstall(python, 'falkordblite')
        if (!omp.ok) await ensureOpenMp()
        lite = await probeFalkorLite(python)
      }
      if (!lite.ok && !omp.ok) lite = { ...lite, detail: omp.detail }
      live = lite.ok
        ? { ok: true, via: 'falkordblite', detail: LITE_DETAIL }
        : { ok: false, via: '', detail: lite.detail || server.detail || '图库没起来，先用文件备份。' }
    }
    progress({ step: 'verifying', current: 6, total: 6, detail: 'Verifying installed components' })
    const status = await collectStatus(python, { wheel, faiss, live })
    status.source = runtime.ok ? 'bundled' : 'online-fallback'
    status.runtime = runtime.ok ? { key: runtime.key, packageName: runtime.packageName, runtimeVersion: runtime.manifest.runtimeVersion, manifestDigest: runtime.manifestDigest, verified: runtime.verified } : null
    if (!status.graph.ok) status.graph.detail = live.detail || server.detail || status.graph.detail
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
