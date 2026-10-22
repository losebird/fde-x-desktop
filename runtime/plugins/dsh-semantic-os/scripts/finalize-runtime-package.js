import { execFileSync } from 'node:child_process'
import { copyFileSync, cpSync, lstatSync, readFileSync, readlinkSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { computeRuntimeTreeSync, runtimePackageName } from '../runtime-bundle.js'
import { RUNTIME_VERSION } from '../version.js'

function materializeSymlinks(dir, root) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const info = lstatSync(path)
    if (info.isSymbolicLink()) {
      const target = join(dir, readlinkSync(path))
      const relativeTarget = relative(root, target)
      if (relativeTarget.startsWith('..')) throw new Error(`runtime symlink escapes package: ${path}`)
      const targetInfo = statSync(target)
      rmSync(path, { force: true })
      if (targetInfo.isDirectory()) cpSync(target, path, { recursive: true, dereference: true })
      else copyFileSync(target, path)
    } else if (info.isDirectory()) {
      materializeSymlinks(path, root)
    }
  }
}

export function pythonLibRoots(pythonRoot) {
  const found = []
  const seen = new Set()
  const add = (path) => {
    try {
      if (!statSync(path).isDirectory()) return
      let key
      try { key = realpathSync(path) } catch { key = path }
      key = key.replaceAll('\\', '/').toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      found.push(path)
    } catch { /* Windows uses Lib under the cpython prefix; Unix uses lib */ }
  }
  for (const name of ['lib', 'Lib', 'libs']) add(join(pythonRoot, name))
  try {
    for (const name of readdirSync(pythonRoot)) {
      const child = join(pythonRoot, name)
      try { if (!statSync(child).isDirectory()) continue } catch { continue }
      for (const lib of ['lib', 'Lib', 'libs']) add(join(child, lib))
    }
  } catch { /* empty staged tree */ }
  return found
}

function patchStores(pythonRoot) {
  const queue = pythonLibRoots(pythonRoot)
  while (queue.length) {
    const dir = queue.shift()
    let names
    try { names = readdirSync(dir) } catch { continue }
    for (const name of names) {
      const path = join(dir, name)
      if (name === 'site-packages') {
        const candidate = join(path, 'stores.py')
        try { statSync(candidate); copyFileSync(join(process.cwd(), 'python', 'stores.py'), candidate) } catch { /* no stores.py in this site-packages */ }
        return
      }
      try {
        if (statSync(path).isDirectory() && name.startsWith('python3')) queue.push(path)
      } catch { /* keep scanning */ }
    }
  }
}

function removeBytecode(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name === '__pycache__') rmSync(path, { recursive: true, force: true })
      else removeBytecode(path)
    } else if (name.endsWith('.pyc') || name.endsWith('.pyo')) {
      rmSync(path, { force: true })
    }
  }
}

export function finalizeRuntime({ root, python, platform, arch, requirements, constraints }) {
  const wheelhouse = join(root, 'wheelhouse')
  cpSync(constraints, join(root, 'constraints.txt'))
  cpSync(join(process.cwd(), 'runtime', 'README.md'), join(root, 'README.md'))
  const cache = process.env.DSH_RUNTIME_VERIFY_CACHE || join(process.cwd(), 'runtime-dist', '.verify-cache', `${platform}-${arch}`)
  const verifyEnv = { ...process.env, XDG_CACHE_HOME: cache, MPLCONFIGDIR: join(cache, 'matplotlib'), NUMBA_CACHE_DIR: join(cache, 'numba'), HF_HOME: join(cache, 'huggingface'), PYTHONDONTWRITEBYTECODE: '1' }
  execFileSync(python, ['-m', 'pip', 'check'], { stdio: 'inherit', env: verifyEnv })
  execFileSync(python, [join(process.cwd(), 'scripts', 'runtime-smoke.py')], { stdio: 'inherit', env: verifyEnv })
  execFileSync(process.execPath, [join(process.cwd(), 'scripts', 'runtime-sidecar-smoke.js'), python], { stdio: 'inherit', env: verifyEnv })
  const freeze = execFileSync(python, ['-m', 'pip', 'freeze', '--all'], { encoding: 'utf8' })
  writeFileSync(join(root, 'resolved-requirements.txt'), freeze.endsWith('\n') ? freeze : `${freeze}\n`)
  const inventory = join(root, 'LICENSES', 'python-distributions.json')
  execFileSync(python, [join(process.cwd(), 'scripts', 'runtime-inventory.py'), inventory], { stdio: 'inherit', env: verifyEnv })
  execFileSync(python, [join(process.cwd(), 'scripts', 'collect-runtime-licenses.py'), join(process.cwd(), 'runtime', 'license-policy.json'), join(root, 'LICENSES', 'texts')], { stdio: 'inherit', env: verifyEnv })
  rmSync(wheelhouse, { recursive: true, force: true })
  patchStores(join(root, 'python'))
  removeBytecode(join(root, 'python'))
  materializeSymlinks(root, root)
  const pythonRel = relative(root, python)
  if (pythonRel.startsWith('..')) throw new Error('runtime Python must be inside package root')
  const tree = computeRuntimeTreeSync(root)
  writeFileSync(join(root, 'runtime-manifest.json'), `${JSON.stringify({ schemaVersion: 2, runtimeVersion: RUNTIME_VERSION, platform, arch, python: pythonRel.replaceAll('\\', '/'), constraints: 'constraints.txt', fileCount: tree.fileCount, treeHash: tree.treeHash }, null, 2)}\n`)
  writeFileSync(join(root, 'package.json'), `${JSON.stringify({ name: runtimePackageName(platform, arch), version: RUNTIME_VERSION, private: false, os: [platform], cpu: [arch], files: ['**/*'] }, null, 2)}\n`)
  return { files: tree.fileCount }
}
