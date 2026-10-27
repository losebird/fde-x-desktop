import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('.', import.meta.url)))
const pyDir = join(root, 'python')
const python = process.env.DSH_RUNTIME_PYTHON || process.env.DSH_SEMANTICA_PYTHON || 'python3'

function py(code, env = {}) {
  const r = spawnSync(python, ['-c', code], {
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: pyDir, ...env },
    timeout: 60000,
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}

test('oxigraph round-trip keeps Chinese and workbench counts', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-oxi-'))
  const home = mkdtempSync(join(tmpdir(), 'dsos-home-'))
  try {
    const dir = join(cwd, '.dsh', 'semantic-os')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'graph.json'), JSON.stringify({
      nodes: [
        { id: 'a', type: 'Person', content: '甲「」——𠀀' },
        { id: 'b', type: 'Person', content: '乙' },
      ],
      edges: [{ source: 'a', target: 'b', type: '认识' }],
    }))
    const out = py(`
import json, os, sys
sys.path.insert(0, ${JSON.stringify(pyDir)})
os.environ["DSH_HOME"] = ${JSON.stringify(home)}
from stores import read_primary, write_primary, read_node_rows, read_edge_rows, primary_status
st = primary_status()
g, meta = read_primary(${JSON.stringify(cwd)})
rows, rst = read_node_rows(${JSON.stringify(cwd)})
edges = read_edge_rows(${JSON.stringify(cwd)})
print(json.dumps({"via": st.get("via"), "nodes": len(rows), "edges": len(edges), "zh": [r.get("content") for r in rows], "empty": meta.get("empty")}))
`)
    const got = JSON.parse(out)
    assert.equal(got.via, 'oxigraph')
    assert.equal(got.nodes, 2)
    assert.equal(got.edges, 1)
    assert.ok(got.zh.some((text) => String(text).includes('甲')))
  } finally {
    rmSync(cwd, { recursive: true, force: true })
    rmSync(home, { recursive: true, force: true })
  }
})

test('save after slim keeps hidden Entity, DATE, and draft decisions', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-oxi-keep-'))
  const home = mkdtempSync(join(tmpdir(), 'dsos-home-'))
  try {
    const out = py(`
import json, os, sys
sys.path.insert(0, ${JSON.stringify(pyDir)})
os.environ["DSH_HOME"] = ${JSON.stringify(home)}
from semantica.context.context_graph import ContextGraph
from stores import write_primary, upsert_entity
import graph_store
from bootstrap import load_session, save_session, graph_path
cwd = ${JSON.stringify(cwd)}
g = ContextGraph()
g.add_node("person:1", "Person", content="张三")
g.add_node("draft:1", "decision", content="起草价", **{"status": "起草"})
write_primary(g, cwd)
upsert_entity(cwd, "ent:hidden", "Entity", "隐藏实体")
upsert_entity(cwd, "date:1", "DATE", "2024-03")
session, path = load_session(cwd)
save_session(session, path)
nodes, edges = graph_store.read_all(cwd)
types = {nid: n.get("type") for nid, n in nodes.items()}
print(json.dumps({"ids": sorted(nodes), "types": types, "draft": nodes.get("draft:1", {}).get("properties", {}).get("status") or nodes.get("draft:1", {}).get("type")}))
`)
    const got = JSON.parse(out)
    assert.ok(got.ids.includes('ent:hidden'), got.ids)
    assert.ok(got.ids.includes('date:1'), got.ids)
    assert.ok(got.ids.includes('draft:1'), got.ids)
    assert.ok(got.ids.includes('person:1'), got.ids)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
    rmSync(home, { recursive: true, force: true })
  }
})

test('explicit drop of a visible node is gone after save', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-oxi-del-'))
  const home = mkdtempSync(join(tmpdir(), 'dsos-home-'))
  try {
    const out = py(`
import json, os, sys
sys.path.insert(0, ${JSON.stringify(pyDir)})
os.environ["DSH_HOME"] = ${JSON.stringify(home)}
from semantica.context.context_graph import ContextGraph
from stores import write_primary
import graph_store
from bootstrap import load_session, save_session, _drop_graph_node
cwd = ${JSON.stringify(cwd)}
g = ContextGraph()
g.add_node("keep", "Person", content="留")
g.add_node("drop", "Person", content="删")
write_primary(g, cwd)
session, path = load_session(cwd)
_drop_graph_node(session.graph, "drop")
save_session(session, path)
nodes, _ = graph_store.read_all(cwd)
print(json.dumps({"ids": sorted(nodes)}))
`)
    const got = JSON.parse(out)
    assert.deepEqual(got.ids, ['keep'])
  } finally {
    rmSync(cwd, { recursive: true, force: true })
    rmSync(home, { recursive: true, force: true })
  }
})

test('close_store is the lite alias', () => {
  const src = py(`
import stores, json
print(json.dumps({"same": stores.close_lite is stores.close_store}))
`)
  assert.equal(JSON.parse(src).same, true)
})
