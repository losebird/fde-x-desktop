import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('.', import.meta.url)))
const py = join(root, 'python')

test('product owns sparql, vocab schemes, and api export', () => {
  const src = readFileSync(join(root, 'product.js'), 'utf8')
  assert.match(src, /api\/vocabulary\/schemes/)
  assert.match(src, /api\/sparql/)
  assert.match(src, /op: 'sparql'/)
  assert.match(src, /api\/export/)
  assert.match(src, /api\/import/)
  assert.equal(src.includes("create_app"), false)
})

test('SPARQL selects workbench labels and skips diaries', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-sparql-'))
  try {
    const dir = join(cwd, '.dsh', 'semantic-os')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'graph.json'), JSON.stringify({
      nodes: [
        { id: 'https://dsh.local/p/a', type: 'Person', content: '张三' },
        { id: 'session:s1:1', type: 'Document', content: '日记原文' },
      ],
      edges: [],
    }))
    const script = [
      'import json,sys',
      `sys.path.insert(0, ${JSON.stringify(py)})`,
      'from bootstrap import run_sparql',
      `cwd = ${JSON.stringify(cwd)}`,
      'q = """SELECT ?s ?label WHERE { ?s <http://www.w3.org/2000/01/rdf-schema#label> ?label }"""',
      'print(json.dumps(run_sparql(cwd, {"query": q}), ensure_ascii=False))',
    ].join('\n')
    const got = JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
    const labels = ((got.results && got.results.bindings) || []).map((row) => String((row.label && row.label.value) || ''))
    assert.ok(labels.includes('张三'))
    assert.equal(labels.some((row) => row.includes('日记')), false)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
