import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const python = process.env.DSH_RUNTIME_PYTHON || process.env.DSH_SEMANTICA_PYTHON || 'python3'

function py(code) {
  const r = spawnSync(python, ['-c', code], {
    cwd: new URL('..', import.meta.url).pathname,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'python' },
    timeout: 120000,
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}

test('old decision rows migrate and find_precedents_by_scenario keeps the old id', () => {
  const out = py(`
import json, os, sys, tempfile
sys.path.insert(0, "python")
from semantica.context.context_graph import ContextGraph
import graph_store
from stores import write_primary
from bootstrap import run_find_precedents
from migrations.migrate_070_decisions import migrate
home = tempfile.mkdtemp(); os.environ["DSH_HOME"] = home
cwd = tempfile.mkdtemp()
g = ContextGraph()
g.add_node("old-id-1", "decision", content="旧场景要不要涨价", **{"outcome": "涨", "category": "rel", "status": "已生效", "reasoning": "旧"})
write_primary(g, cwd)
marker = graph_store.oxigraph_dir(cwd) / ".migrated-070-decisions"
if marker.exists():
    marker.unlink()
got = migrate(cwd)
prec = run_find_precedents(cwd, {"scenario": "旧场景要不要涨价", "category": "rel"})
ids = [r.get("decision_id") for r in prec.get("precedents") or []]
print(json.dumps({"ids": ids, "migrate": got}))
`)
  const got = JSON.parse(out)
  assert.ok(got.ids.includes('old-id-1'), JSON.stringify(got))
})

test('draft decision is still in Oxigraph after a fresh load_session', () => {
  const out = py(`
import json, os, sys, tempfile
sys.path.insert(0, "python")
from semantica.context.context_graph import ContextGraph
from stores import write_primary
from bootstrap import load_session, save_session, graph_path, run_list_decisions
import graph_store
home = tempfile.mkdtemp(); os.environ["DSH_HOME"] = home
cwd = tempfile.mkdtemp()
g = ContextGraph()
did = g.record_decision("rel", "起草价", "r", "草", 0.9, metadata={"status": "起草"})
write_primary(g, cwd)
session, path = load_session(cwd)
save_session(session, path)
nodes, _ = graph_store.read_all(cwd)
listed = run_list_decisions(cwd, {})
print(json.dumps({
  "did": did,
  "store": did in nodes,
  "list": [r.get("decision_id") for r in listed.get("decisions") or []],
}))
`)
  const got = JSON.parse(out)
  assert.equal(got.store, true)
  assert.ok(got.list.includes(got.did))
})

test('saving a slimmed session does not drop decisions in Oxigraph', () => {
  const out = py(`
import json, os, sys, tempfile
sys.path.insert(0, "python")
from semantica.context.context_graph import ContextGraph
from stores import write_primary
from bootstrap import load_session, save_session, graph_path
import graph_store
home = tempfile.mkdtemp(); os.environ["DSH_HOME"] = home
cwd = tempfile.mkdtemp()
g = ContextGraph()
live = g.record_decision("rel", "已生效板", "r", "过", 0.9, metadata={"status": "已生效"})
draft = g.record_decision("rel", "起草板", "r", "草", 0.9, metadata={"status": "起草"})
write_primary(g, cwd)
before, _ = graph_store.read_all(cwd)
session, path = load_session(cwd)
save_session(session, path)
after, _ = graph_store.read_all(cwd)
print(json.dumps({
  "before": sorted(before),
  "after": sorted(after),
  "live": live,
  "draft": draft,
}))
`)
  const got = JSON.parse(out)
  assert.ok(got.before.includes(got.live))
  assert.ok(got.before.includes(got.draft))
  assert.ok(got.after.includes(got.live))
  assert.ok(got.after.includes(got.draft))
  assert.equal(got.after.length, got.before.length)
})
