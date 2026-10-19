import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

function py(script) {
  return execFileSync('python3', ['-c', script], { encoding: 'utf8' })
}

test('apply_extracted_window patches entities without load_session', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_apply_extracted_window, is_fast_read_op

nodes = []
edges = []

def upsert(cwd, nid, ntype, label, extra=None):
  nodes.append({"id": nid, "type": ntype, "label": label})
  return {"ok": True, "id": nid}

def edge(cwd, src, tgt, et):
  edges.append((src, tgt, et))
  return {"ok": True}

with patch("bootstrap.upsert_entity", upsert):
  with patch("bootstrap.insert_edge", edge):
    got = run_apply_extracted_window("/ws", {
      "source": "session:s1",
      "text": "张三买了青柠味",
      "entities": [{"text": "张三", "type": "人"}, {"text": "青柠味", "type": "商品"}],
      "relations": [{"source": "张三", "type": "购买", "target": "青柠味"}],
    })
    bad = run_apply_extracted_window("/ws", {"source": "memory:1"})
print(json.dumps({
  "ok": got.get("ok"),
  "nodes": got.get("nodes"),
  "edges": got.get("edges"),
  "ids": [r["id"] for r in nodes],
  "links": edges,
  "bad": bad.get("error"),
  "fast": is_fast_read_op("apply_extracted_window"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.ok, true)
  assert.equal(got.nodes, 2)
  assert.ok(got.ids.includes('张三'))
  assert.ok(got.links.some((row) => row[2] === '购买'))
  assert.equal(got.bad, 'NOT_A_SESSION')
  assert.equal(got.fast, false)
})
