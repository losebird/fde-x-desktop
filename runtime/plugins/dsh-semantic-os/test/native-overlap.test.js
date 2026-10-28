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

test('Chinese NER extracts 张三 杭州 阿里巴巴集团 and cache reopens', { timeout: 120000 }, () => {
  const out = py(`
import json, sys, tempfile
from pathlib import Path
sys.path.insert(0, "python")
from bootstrap import detect_language, ensure_extract_cache, make_ner, _entity_json, has_cjk
text = "张三在杭州的阿里巴巴集团工作。"
assert has_cjk(text)
cwd = tempfile.mkdtemp(prefix="dsos-ner-")
ensure_extract_cache(cwd)
ents = [_entity_json(row) for row in make_ner(text).extract_entities(text)]
labels = [row.get("text") for row in ents if row]
lang = detect_language(text)
cache = Path(cwd) / ".dsh" / "extract_cache.sqlite"
ensure_extract_cache(cwd)
ents2 = [_entity_json(row) for row in make_ner(text).extract_entities(text)]
print(json.dumps({
  "labels": labels,
  "lang": lang,
  "cache": cache.is_file(),
  "again": [row.get("text") for row in ents2 if row],
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.ok(got.labels.includes('张三'))
  assert.ok(got.labels.includes('杭州'))
  assert.ok(got.labels.includes('阿里巴巴集团'))
  assert.equal(got.lang, 'zh-cn')
  assert.equal(got.cache, true)
  assert.ok(got.again.includes('张三'))
})

test('DuplicateDetector scores 阿里巴巴 / 阿里巴巴集团 at 0.86', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from bootstrap import run_enrich_dedup
got = run_enrich_dedup("/tmp", {"rows": [
  {"id": "a", "type": "机构", "content": "阿里巴巴"},
  {"id": "b", "type": "机构", "content": "阿里巴巴集团"},
], "threshold": 0.8})
row = (got.get("duplicates") or [{}])[0]
print(json.dumps({"score": row.get("score"), "n": got.get("total_flagged")}))
`)
  const got = JSON.parse(out)
  assert.equal(Number(got.score), 0.86)
  assert.ok(got.n >= 1)
})

test('graph analytics community_count is positive', () => {
  const out = py(`
import json, os, sys, tempfile
from pathlib import Path
sys.path.insert(0, "python")
from bootstrap import run_graph_analytics
import graph_store
cwd = tempfile.mkdtemp(prefix="dsos-ga-")
graph_store.put_node(cwd, {"id": "a", "type": "Person", "content": "甲", "properties": {}, "metadata": {}})
graph_store.put_node(cwd, {"id": "b", "type": "Person", "content": "乙", "properties": {}, "metadata": {}})
graph_store.put_node(cwd, {"id": "c", "type": "Org", "content": "丙", "properties": {}, "metadata": {}})
graph_store.put_edge(cwd, "a", "b", "认识")
graph_store.put_edge(cwd, "b", "c", "任职")
got = run_graph_analytics(cwd, {})
print(json.dumps({"n": got.get("community_count"), "engine": got.get("engine"), "pr": got.get("top_nodes_by_pagerank")}))
`)
  const got = JSON.parse(out)
  assert.ok(got.n > 0)
  assert.equal(got.engine, 'semantica')
})
