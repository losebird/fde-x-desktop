import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const source = process.argv[2]
if (!source) throw new Error('usage: verify-runtime-relocation.js RUNTIME_ROOT')
const temp = mkdtempSync(join(tmpdir(), 'dsos-runtime-relocation-'))
const target = join(temp, 'runtime moved with spaces')
try {
  cpSync(source, target, { recursive: true, dereference: false })
  const manifest = JSON.parse(readFileSync(join(target, 'runtime-manifest.json'), 'utf8'))
  const python = join(target, manifest.python)
  const cache = join(temp, 'cache')
  const env = { ...process.env, XDG_CACHE_HOME: cache, MPLCONFIGDIR: join(cache, 'matplotlib'), NUMBA_CACHE_DIR: join(cache, 'numba'), HF_HOME: join(cache, 'huggingface') }
  execFileSync(python, [join(process.cwd(), 'scripts', 'runtime-smoke.py')], { stdio: 'inherit', env })
  execFileSync(process.execPath, [join(process.cwd(), 'scripts', 'runtime-sidecar-smoke.js'), python], { stdio: 'inherit', env })
} finally {
  rmSync(temp, { recursive: true, force: true })
}
