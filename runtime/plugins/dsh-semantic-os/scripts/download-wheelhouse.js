import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const [python, wheelhouse, requirements, constraints] = process.argv.slice(2)
if (!python || !wheelhouse || !requirements || !constraints) {
  throw new Error('usage: download-wheelhouse.js PYTHON WHEELHOUSE REQUIREMENTS CONSTRAINTS')
}
mkdirSync(wheelhouse, { recursive: true })
const attempts = Number(process.env.DSH_RUNTIME_DOWNLOAD_ATTEMPTS || 5)
let last
for (let allowSdist = 0; allowSdist <= 1; allowSdist += 1) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const args = [
        '-m', 'pip', 'download',
        '--only-binary=:all:',
        '--retries', '10',
        '--timeout', String(process.env.PIP_DEFAULT_TIMEOUT || 600),
        '--dest', wheelhouse,
        '--requirement', requirements,
        '--constraint', constraints,
      ]
      if (process.platform === 'linux') {
        args.splice(4, 0, '--extra-index-url', 'https://download.pytorch.org/whl/cpu')
      }
      if (allowSdist) {
        args.push('wheel')
      }
      execFileSync(python, args, { stdio: 'inherit', env: process.env })
      process.exit(0)
    } catch (error) {
      last = error
      if (attempt === attempts) break
      const delay = Math.min(30, 2 ** attempt)
      console.error(`wheelhouse download attempt ${attempt}/${attempts} failed; retrying in ${delay}s`)
      const until = Date.now() + delay * 1000
      while (Date.now() < until) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.min(1000, until - Date.now()))
    }
  }
  if (allowSdist === 0) console.error('binary-only wheelhouse failed; retrying with sdist and wheel')
}
throw last || new Error('wheelhouse download failed')
