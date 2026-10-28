import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

function pythonBin() {
  if (process.env.DSH_RUNTIME_PYTHON) return process.env.DSH_RUNTIME_PYTHON
  const bundled = new URL('../runtime-dist/darwin-arm64/python/bin/python3', import.meta.url).pathname
  if (existsSync(bundled)) return bundled
  return 'python3'
}

function py(code) {
  const r = spawnSync(pythonBin(), ['-c', code], {
    cwd: new URL('..', import.meta.url).pathname,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'python' },
    timeout: 180000,
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}

test('semantica CLI --help is reachable', { timeout: 60000 }, () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from native_entry import run_semantica_help
got = run_semantica_help()
print(json.dumps({"ok": got.get("ok"), "has": "usage" in (got.get("help") or "").lower() or "semantica" in (got.get("help") or "").lower()}))
`)
  const got = JSON.parse(out)
  assert.equal(got.ok, true)
  assert.equal(got.has, true)
})

test('schema gate keeps 张三 and drops GPE; bootstrap_schema returns ontology/ttl/draft', { timeout: 120000 }, () => {
  const out = py(`
import json, sys, tempfile
sys.path.insert(0, "python")
from native_entry import run_schema_gate, run_bootstrap_schema
import graph_store
cwd = tempfile.mkdtemp(prefix="dsos-schema-")
graph_store.put_node(cwd, {"id": "p1", "type": "PERSON", "content": "张三", "properties": {}, "metadata": {}})
graph_store.put_node(cwd, {"id": "g1", "type": "GPE", "content": "杭州", "properties": {}, "metadata": {}})
gate = run_schema_gate(cwd, {"concepts": ["PERSON"], "entities": [
  {"text": "张三", "label": "PERSON"},
  {"text": "杭州", "label": "GPE"},
]})
boot = run_bootstrap_schema(cwd, {"entities": [
  {"text": "张三", "type": "PERSON"},
  {"text": "李四", "type": "PERSON"},
], "relationships": [], "min_occurrences": 1})
kept = [row.get("text") for row in (gate.get("kept") or [])]
print(json.dumps({
  "kept": kept,
  "ontology": bool(boot.get("ontology")),
  "ttl": bool(boot.get("ttl") is not None),
  "draft": boot.get("draft"),
  "classes_key": "classes" in (boot.get("ontology") or {}) if isinstance(boot.get("ontology"), dict) else False,
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.ok(got.kept.includes('张三'))
  assert.equal(got.kept.includes('杭州'), false)
  assert.equal(got.ontology, true)
  assert.equal(got.draft, true)
})

test('TierCalculator GOLD and GraphRAG community_count', { timeout: 120000 }, () => {
  const out = py(`
import json, sys, tempfile
sys.path.insert(0, "python")
from native_entry import run_trust_tiers, run_community_rag
import graph_store
cwd = tempfile.mkdtemp(prefix="dsos-rag-")
graph_store.put_node(cwd, {"id": "a", "type": "Person", "content": "甲", "properties": {}, "metadata": {}})
graph_store.put_node(cwd, {"id": "b", "type": "Person", "content": "乙", "properties": {}, "metadata": {}})
graph_store.put_node(cwd, {"id": "c", "type": "Org", "content": "丙", "properties": {}, "metadata": {}})
graph_store.put_edge(cwd, "a", "b", "认识")
graph_store.put_edge(cwd, "b", "c", "任职")
tier = run_trust_tiers(cwd, {"corroboration": 2, "confidence": 0.8})
rag = run_community_rag(cwd, {"algorithm": "louvain"})
print(json.dumps({"tier": tier.get("tier"), "n": rag.get("community_count"), "ok": rag.get("ok"), "err": rag.get("error") or rag.get("detail")}))
`)
  const got = JSON.parse(out)
  assert.equal(String(got.tier).toUpperCase(), 'GOLD')
  assert.equal(got.ok, true)
  assert.ok(got.n > 0)
})

test('ErasureCoordinator receipt graph is erased', { timeout: 120000 }, () => {
  const out = py(`
import json, sys, tempfile
sys.path.insert(0, "python")
import graph_store
from bootstrap import run_erase_ledger
cwd = tempfile.mkdtemp(prefix="dsos-erase-")
graph_store.put_node(cwd, {"id": "person:zhang", "type": "Person", "content": "张三", "properties": {}, "metadata": {}})
got = run_erase_ledger(cwd, {"id": "person:zhang", "kind": "entity", "confirm": True, "nodded": True})
graph = got.get("graph") or {}
status = graph.get("status") if isinstance(graph, dict) else str(graph)
print(json.dumps({"ok": got.get("ok"), "status": status, "err": got.get("error"), "detail": got.get("detail"), "receipt": bool(got.get("receipt"))}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.ok, true)
  assert.match(String(got.status || ''), /eras/i)
})

test('cache reopen hits and SPARQL returns 张三 李四', { timeout: 180000 }, () => {
  const out = py(`
import json, sys, tempfile
from pathlib import Path
sys.path.insert(0, "python")
from bootstrap import ensure_extract_cache, make_ner, _entity_json, run_sparql
import graph_store
text = "张三在杭州的阿里巴巴集团工作。"
cwd = tempfile.mkdtemp(prefix="dsos-c2-")
ensure_extract_cache(cwd)
ents = [_entity_json(row) for row in make_ner(text).extract_entities(text)]
ensure_extract_cache(cwd)
ents2 = [_entity_json(row) for row in make_ner(text).extract_entities(text)]
graph_store.put_node(cwd, {"id": "https://dsh.local/p/a", "type": "Person", "content": "张三", "properties": {}, "metadata": {}})
graph_store.put_node(cwd, {"id": "https://dsh.local/p/b", "type": "Person", "content": "李四", "properties": {}, "metadata": {}})
q = "SELECT ?s ?label WHERE { ?s <http://www.w3.org/2000/01/rdf-schema#label> ?label }"
sparql = run_sparql(cwd, {"query": q})
labels = [str((row.get("label") or {}).get("value") or "") for row in ((sparql.get("results") or {}).get("bindings") or [])]
print(json.dumps({
  "ner": [row.get("text") for row in ents if row],
  "again": [row.get("text") for row in ents2 if row],
  "cache": (Path(cwd) / ".dsh" / "extract_cache.sqlite").is_file(),
  "labels": labels,
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.ok(got.ner.includes('张三'))
  assert.ok(got.again.includes('张三'))
  assert.equal(got.cache, true)
  assert.ok(got.labels.includes('张三'))
  assert.ok(got.labels.includes('李四'))
})
