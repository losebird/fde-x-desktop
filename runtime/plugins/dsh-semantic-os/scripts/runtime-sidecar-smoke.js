import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

if (!process.argv[2]) throw new Error('usage: runtime-sidecar-smoke.js PYTHON')
const python = resolve(process.argv[2])
const cwd = mkdtempSync(join(tmpdir(), 'dsos-runtime-sidecar-'))
const token = randomBytes(24).toString('hex')
const home = join(cwd, 'home')
const cache = join(home, 'cache')
const child = spawn(python, [join(process.cwd(), 'python', 'bootstrap.py')], {
  cwd,
  env: {
    ...process.env,
    HOME: home,
    DSH_HOME: join(home, '.dsh'),
    XDG_CACHE_HOME: cache,
    MPLCONFIGDIR: join(cache, 'matplotlib'),
    NUMBA_CACHE_DIR: join(cache, 'numba'),
    HF_HOME: join(cache, 'huggingface'),
    PYTHONDONTWRITEBYTECODE: '1',
    MACOS_AVOID_NETWORK_DB: '1',
    __CF_USER_TEXT_ENCODING: '0x1F5:0:0',
    SEMANTICA_API_KEY: token,
    DSH_SEMANTICA_PORT: '0',
    DEEPSEEK_API_KEY: '',
    DSH_LLM_PROVIDER: '',
    DSH_LLM_MODEL: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let stdout = ''
let stderr = ''
let timer

function callJson(port, path, { method = 'GET', headers = {}, body = null } = {}) {
  const payload = body == null ? '' : JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers: { ...headers, ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}) } }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }) } catch (error) { reject(error) }
      })
    })
    req.on('error', reject)
    req.end(payload)
  })
}

try {
  const ready = await new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`sidecar ready timeout\n${stdout.slice(-4000)}\n${stderr.slice(-4000)}`)), 240000)
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
      for (const line of stdout.split(/\r?\n/)) {
        const marker = 'DSH_SEMANTIC_OS '
        const index = line.indexOf(marker)
        if (index < 0) continue
        try {
          const value = JSON.parse(line.slice(index + marker.length))
          if (value.ready && value.port) resolve(value)
          else reject(new Error(`sidecar not ready: ${JSON.stringify(value)}`))
          return
        } catch { /* incomplete line */ }
      }
    })
    child.stderr.on('data', (chunk) => { stderr += String(chunk) })
    child.once('exit', (code) => reject(new Error(`sidecar exited ${code}\n${stdout}\n${stderr}`)))
    child.once('error', reject)
  })
  clearTimeout(timer)
  const health = await callJson(ready.port, '/_dsh/health')
  if (health.status !== 200 || health.body.version !== '0.7.0') throw new Error(`health failed: ${JSON.stringify(health)}`)
  const command = { method: 'POST', body: { op: 'get_graph_summary', cwd, args: {} }, headers: { 'x-dsh-cwd': cwd } }
  const unauthorized = await callJson(ready.port, '/_dsh/python', command)
  if (unauthorized.status !== 403) throw new Error(`management endpoint accepted no token: ${JSON.stringify(unauthorized)}`)
  const authorized = await callJson(ready.port, '/_dsh/python', { ...command, headers: { ...command.headers, 'x-api-key': token } })
  if (authorized.status !== 200 || authorized.body.error) throw new Error(`authorized graph summary failed: ${JSON.stringify(authorized)}`)
  console.log(`sidecar runtime verified on port ${ready.port}`)
} finally {
  clearTimeout(timer)
  child.kill('SIGTERM')
  setTimeout(() => child.kill('SIGKILL'), 3000).unref()
  rmSync(cwd, { recursive: true, force: true })
}
