import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { cleanExtract, isChatFiller, labelInSource } from '../extract-clean.js'

test('cleanExtract keeps verbatim names and drops chat filler', () => {
  const source = '张三买了青柠味，我们今天再看这个功能。'
  const got = cleanExtract(source, {
    entities: [
      { text: '张三', type: '人' },
      { text: '青柠味', type: '商品' },
      { text: '我们', type: '人' },
      { text: '柠檬水', type: '商品' },
      { text: '这个', type: '东西' },
    ],
    relations: [
      { source: '张三', type: '购买', target: '青柠味' },
      { source: '张三', type: '购买', target: '柠檬水' },
    ],
  })
  assert.deepEqual(got.entities.map((row) => row.text), ['张三', '青柠味'])
  assert.equal(got.relations.length, 1)
  assert.equal(got.relations[0].target, '青柠味')
  assert.equal(labelInSource('青柠味', source), true)
  assert.equal(isChatFiller('我们'), true)
})

test('python apply_extracted_window drops invented labels', () => {
  const out = execFileSync('python3', ['-c', `
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_apply_extracted_window
nodes = []
def upsert(cwd, nid, ntype, label, extra=None):
    nodes.append(label)
    return {"ok": True, "id": nid}
def edge(*a):
    return {"ok": True}
with patch("bootstrap.upsert_entity", upsert):
    with patch("bootstrap.insert_edge", edge):
        got = run_apply_extracted_window("/ws", {
            "source": "session:s1",
            "text": "张三买了青柠味",
            "entities": [{"text": "张三", "type": "人"}, {"text": "柠檬水", "type": "商品"}, {"text": "我们", "type": "人"}],
            "relations": [{"source": "张三", "type": "购买", "target": "柠檬水"}],
        })
print(json.dumps({"nodes": got.get("nodes"), "edges": got.get("edges"), "labels": nodes}, ensure_ascii=False))
`], { encoding: 'utf8' })
  const got = JSON.parse(out)
  assert.equal(got.nodes, 1)
  assert.deepEqual(got.labels, ['张三'])
  assert.equal(got.edges, 0)
})
