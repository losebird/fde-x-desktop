import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const python = process.argv[2]
if (!python) throw new Error('usage: collab-retrieval.mjs PYTHON')

const cwd = mkdtempSync(join(tmpdir(), 'dsos-collab-'))
const token = randomBytes(24).toString('hex')
const home = join(cwd, 'home')
const cache = join(home, 'cache')
const results = []
function record(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + String(detail).slice(0, 140) : ''}`)
}

const child = spawn(python, [join(process.cwd(), 'python', 'bootstrap.py')], {
  cwd,
  env: {
    ...process.env, HOME: home, DSH_HOME: join(home, '.dsh'),
    XDG_CACHE_HOME: cache, MPLCONFIGDIR: join(cache, 'matplotlib'), NUMBA_CACHE_DIR: join(cache, 'numba'),
    HF_HOME: join(cache, 'huggingface'), PYTHONPYCACHEPREFIX: join(cache, 'pycache'),
    SEMANTICA_API_KEY: token, DSH_SEMANTICA_PORT: '0', DEEPSEEK_API_KEY: '', DSH_LLM_PROVIDER: '', DSH_LLM_MODEL: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stdout = ''
let stderr = ''
let port = 0
let readyTimer

function callPython(op, args = {}) {
  const payload = JSON.stringify({ op, cwd, args })
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path: '/_dsh/python', method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), 'x-api-key': token, 'x-dsh-cwd': cwd },
    }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch (e) { reject(e) } })
    })
    req.on('error', reject)
    req.end(payload)
  })
}

try {
  await new Promise((resolve, reject) => {
    readyTimer = setTimeout(() => reject(new Error(`timeout\n${stdout.slice(-2000)}\n${stderr.slice(-2000)}`)), 180000)
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
      for (const line of stdout.split(/\r?\n/)) {
        const i = line.indexOf('DSH_SEMANTIC_OS ')
        if (i < 0) continue
        try { const v = JSON.parse(line.slice(i + 16)); if (v.ready && v.port) { port = v.port; resolve() } else reject(new Error(`not ready ${JSON.stringify(v)}`)) } catch { /* partial */ }
      }
    })
    child.stderr.on('data', (c) => { stderr += String(c) })
    child.once('exit', (code) => reject(new Error(`exited ${code}`)))
    child.once('error', reject)
  })
  clearTimeout(readyTimer)

  // ---- 1. 并发写图：20 个并发 add_entity，验证 per-cwd 锁不丢数据 ----
  const before = await callPython('get_graph_summary')
  const entities = Array.from({ length: 20 }, (_, i) => `entity-${i}`)
  await Promise.all(entities.map((id) => callPython('add_entity', { id, label: `Entity ${id}`, type: 'Test' })))
  const after = await callPython('get_graph_summary')
  const concurrencyOk = after.node_count >= before.node_count + 20
  record('concurrent 20 writes preserved (per-cwd lock)', concurrencyOk, `before=${before.node_count} after=${after.node_count}`)

  // ---- 2. 向量语义检索：先 ingest 语义文档，再 search_text 验证 semantic_similarity ----
  writeFileSync(join(cwd, 'semantic.md'), 'The quantum computer uses superposition and entanglement to process information in parallel.')
  await callPython('ingest_directory', { paths: [join(cwd, 'semantic.md')] })
  await callPython('run_pipeline', { texts: [{ path: join(cwd, 'semantic.md'), text: 'The quantum computer uses superposition and entanglement to process information in parallel.' }] })
  const semantic = await callPython('search_text', { query: 'quantum computing physics' })
  const hasVectorHit = Array.isArray(semantic.results) && semantic.results.some((row) => Number(row.semantic_similarity) > 0)
  record('vector semantic retrieval (FAISS similarity > 0)', hasVectorHit, `results=${semantic.total}`)

  // ---- 3. 会话摄取：模拟 persistence 读回聊天，upsert_documents + add_entity ----
  const sessionText = 'Alice decided to launch the rocket tomorrow after reviewing the weather report.'
  const doc = await callPython('upsert_documents', { texts: [{ path: 'session:test-session:1', text: sessionText, role: 'assistant' }] })
  record('session upsert_documents', !doc.error && doc.ok === true, `repaired=${doc.repaired}`)
  const sessionNode = await callPython('add_entity', { id: 'session:test-session', type: 'Document', label: sessionText.slice(0, 60), content: sessionText })
  record('session node written to graph', !sessionNode.error)
  const lineage = await callPython('lineage', { id: 'session:test-session' })
  record('session lineage traceable', lineage.ok === true, lineage.path)

  // ---- 4. 全文检索验证会话内容可搜 ----
  const sessionSearch = await callPython('search_text', { query: 'rocket' })
  record('session text searchable in graph', sessionSearch.total >= 1, `total=${sessionSearch.total}`)

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exitCode = failed.length ? 1 : 0
} catch (error) {
  console.error('FATAL:', error.message)
  process.exitCode = 1
} finally {
  clearTimeout(readyTimer)
  child.kill('SIGTERM')
  setTimeout(() => child.kill('SIGKILL'), 3000).unref()
  rmSync(cwd, { recursive: true, force: true })
}
