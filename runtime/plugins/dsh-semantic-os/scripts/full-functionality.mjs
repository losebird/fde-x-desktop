import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const python = process.argv[2]
if (!python) throw new Error('usage: full-functionality.mjs PYTHON')

const cwd = mkdtempSync(join(tmpdir(), 'dsos-full-func-'))
const token = randomBytes(24).toString('hex')
const home = join(cwd, 'home')
const cache = join(home, 'cache')
const results = []

function record(name, ok, detail = '') {
  results.push({ name, ok, detail: String(detail).slice(0, 200) })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + String(detail).slice(0, 140) : ''}`)
}

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
    PYTHONPYCACHEPREFIX: join(cache, 'pycache'),
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
let readyTimer

function callPython(op, args = {}) {
  const payload = JSON.stringify({ op, cwd, args })
  return new Promise((resolve, reject) => {
    const req = request({
      host: '127.0.0.1',
      port: port,
      path: '/_dsh/python',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
        'x-api-key': token,
        'x-dsh-cwd': cwd,
      },
    }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
        catch (error) { reject(error) }
      })
    })
    req.on('error', reject)
    req.end(payload)
  })
}

let port = 0

try {
  await new Promise((resolve, reject) => {
    readyTimer = setTimeout(() => reject(new Error(`sidecar timeout\n${stdout.slice(-2000)}\n${stderr.slice(-2000)}`)), 180000)
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
      for (const line of stdout.split(/\r?\n/)) {
        const marker = 'DSH_SEMANTIC_OS '
        const index = line.indexOf(marker)
        if (index < 0) continue
        try {
          const value = JSON.parse(line.slice(index + marker.length))
          if (value.ready && value.port) { port = value.port; resolve() }
          else reject(new Error(`not ready: ${JSON.stringify(value)}`))
        } catch { /* partial */ }
      }
    })
    child.stderr.on('data', (chunk) => { stderr += String(chunk) })
    child.once('exit', (code) => reject(new Error(`sidecar exited ${code}`)))
    child.once('error', reject)
  })
  clearTimeout(readyTimer)

  // 1. graph basics
  let r = await callPython('add_entity', { id: 'alice', label: 'Alice', type: 'Person' })
  record('add_entity', !r.error && r.id === 'alice', r.status)
  r = await callPython('add_entity', { id: 'bob', label: 'Bob', type: 'Person' })
  record('add_entity (second)', !r.error)
  r = await callPython('add_relationship', { source: 'alice', target: 'bob', type: 'knows' })
  record('add_relationship', !r.error && r.source === 'alice' && r.target === 'bob', r.status)

  r = await callPython('get_graph_summary')
  record('get_graph_summary', !r.error && r.node_count >= 2, `nodes=${r.node_count}`)

  r = await callPython('search_text', { query: 'Alice' })
  record('search_text', !r.error && r.total >= 1, `total=${r.total}`)

  r = await callPython('lineage', { id: 'alice' })
  record('lineage', !r.error && r.ok === true, r.source)

  // 2. decisions
  r = await callPython('record_decision', { category: 'test', scenario: 'ship feature A', reasoning: 'user asked', outcome: 'approved', confidence: 0.9, because: ['alice'] })
  record('record_decision', !r.error && r.status === 'recorded', r.decision_id)
  const decisionId = r.decision_id

  r = await callPython('query_decisions', {})
  record('query_decisions', !r.error && Array.isArray(r.decisions), `count=${r.decisions?.length}`)

  r = await callPython('find_precedents', { scenario: 'ship feature A' })
  record('find_precedents', !r.error && Array.isArray(r.precedents), `count=${r.precedents?.length}`)

  r = await callPython('get_causal_chain', { decision_id: decisionId })
  record('get_causal_chain', !r.error && Array.isArray(r.chain), `hops=${r.chain?.length}`)

  // 3. analytics & reasoning
  r = await callPython('get_graph_analytics', {})
  record('get_graph_analytics', !r.error && r.node_count >= 2, `communities=${r.community_count}`)

  r = await callPython('run_reasoning', {
    facts: ['Person(alice)', 'Person(bob)', 'knows(alice,bob)'],
    rules: ['IF Person(x) THEN Human(x)'],
    mode: 'forward',
  })
  record('run_reasoning (forward)', !r.error && Array.isArray(r.derived_facts || r.inferred_facts), `derived=${(r.derived_facts || r.inferred_facts || []).length}`)

  // 4. extraction (English text to avoid LLM dependency)
  r = await callPython('extract_entities', { text: 'Alice works at Acme Corp in Paris with Bob.' })
  record('extract_entities', !r.error && Array.isArray(r.entities), `method=${r.extractMethod}, count=${r.entities?.length}`)

  r = await callPython('extract_relations', { text: 'Alice works at Acme Corp.' })
  record('extract_relations', !r.error && Array.isArray(r.relations), `count=${r.relations?.length}`)

  // 5. export / import
  r = await callPython('export_graph', { format: 'json' })
  record('export_graph (json)', !r.error && (r.data || Array.isArray(r.entities) || typeof r === 'object'), typeof r.data === 'object' ? 'data object' : 'ok')

  r = await callPython('export_graph', { format: 'csv' })
  record('export_graph (csv)', !r.error, r.error)

  // 6. ingest
  writeFileSync(join(cwd, 'notes.md'), '# Notes\nAlice met Bob at the coffee shop.\nThey discussed shipping feature A.\n')
  r = await callPython('ingest_directory', { paths: [join(cwd, 'notes.md')] })
  record('ingest_directory', !r.error && r.count >= 1, `count=${r.count}`)

  r = await callPython('run_pipeline', {
    texts: [{ path: join(cwd, 'notes.md'), text: 'Alice met Bob at the coffee shop. They discussed shipping feature A.' }],
  })
  record('run_pipeline', !r.error && r.ok === true, `steps=${(r.steps || []).join(',')}`)

  r = await callPython('import_graph', {
    format: 'json',
    data: JSON.stringify({ nodes: [{ id: 'carol', type: 'Person', properties: { content: 'Carol' } }], edges: [] }),
    confirm: true,
  })
  record('import_graph', !r.error && r.ok === true, `nodes_added=${r.nodes_added}`)

  // 7. store status
  r = await callPython('store_status', {})
  record('store_status', !r.error, r.graph?.via || r.error)

  const failed = results.filter((row) => !row.ok)
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
