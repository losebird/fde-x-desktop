import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('.', import.meta.url)))
const py = join(root, 'python')

test('list_graph_nodes skips session diaries', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-slim-list-'))
  try {
    const dir = join(cwd, '.dsh', 'semantic-os')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'graph.json'), JSON.stringify({
      nodes: [
        { id: 'session:s1:1', type: 'Document', content: '日记原文', properties: { content: '日记原文' } },
        { id: 'https://dsh.local/vocab/x#k', type: 'skos:Concept', content: '采购单', properties: { label: '采购单' } },
      ],
      edges: [{ source: 'https://dsh.local/vocab/x#k', target: 'session:s1:1', type: '出自' }],
    }))
    const script = [
      'import json,sys',
      `sys.path.insert(0, ${JSON.stringify(py)})`,
      'from bootstrap import run_list_graph_nodes, run_list_graph_edges',
      `cwd = ${JSON.stringify(cwd)}`,
      'nodes = run_list_graph_nodes(cwd, {"limit": 50})',
      'edges = run_list_graph_edges(cwd, {"limit": 50})',
      'print(json.dumps({"nids": [n["id"] for n in nodes["nodes"]], "n": nodes["total"], "e": len(edges.get("edges") or edges.get("items") or [])}))',
    ].join('\n')
    const got = JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
    assert.ok(!got.nids.some((id) => String(id).startsWith('session:')))
    assert.equal(got.n, 1)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
