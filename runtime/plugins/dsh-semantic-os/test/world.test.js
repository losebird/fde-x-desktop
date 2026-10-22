import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { clipSearchPayload, stampWorldHit } from '../tools.js'

function py(code) {
  const r = spawnSync('python3', ['-c', code], {
    cwd: new URL('..', import.meta.url).pathname,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'python' },
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}

test('stamp_hit grades from id/type/receipt, never system_live', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from world import stamp_hit
rows = {
  "session": stamp_hit({"node": {"id": "session:s1:1", "type": "Document", "content": "延期", "properties": {"valid_from": "2026-08-12"}}, "score": 120}),
  "memory": stamp_hit({"node": {"id": "memory:ab12", "type": "记忆卡片", "content": "华东客户", "properties": {}}, "via": "agent-memory", "score": 150}),
  "inferred": stamp_hit({"node": {"id": "person:1", "type": "Person", "content": "张三", "properties": {"auto": True}}, "score": 80}),
  "receipt": stamp_hit({"node": {"id": "dec-1", "type": "decision", "content": "延期", "properties": {"status": "已生效", "receipt_id": "R1", "nod_kind": "业务过账"}}, "score": 160}),
  "draft": stamp_hit({"node": {"id": "dec-2", "type": "decision", "content": "延期", "properties": {"status": "起草"}}, "score": 100}),
}
print(json.dumps({k: {"grade": v["knowledge_grade"], "live": v["is_live"], "src": v["source_type"]} for k, v in rows.items()}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.session.grade, 'observation')
  assert.equal(got.memory.grade, 'user_memory')
  assert.equal(got.inferred.grade, 'inferred')
  assert.equal(got.receipt.grade, 'verified_receipt')
  assert.equal(got.draft.grade, 'observation')
  assert.equal(got.session.live, false)
  assert.equal(got.receipt.live, false)
})

test('expand_query and missing_live use vocab spoken forms, not a kind-name if', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from world import concepts_from_rows, expand_query, missing_live
rows = [
  {"id": "https://v#contract", "type": "skos:Concept", "content": "合同", "properties": {
    "altLabels": ["签约文件"], "can": ["现查"], "resource": "biz_contracts",
    "clues": [{"say": ["合同状态"]}]
  }},
  {"id": "https://v#note", "type": "skos:Concept", "content": "备忘", "properties": {}},
]
concepts = concepts_from_rows(rows)
exp = expand_query("合同为什么延期", concepts, [{"relation": "skos:closeMatch", "source_label": "合同", "target_label": "签约方"}])
miss = missing_live("合同和审批现在怎样", concepts)
note = missing_live("备忘写了什么", concepts)
print(json.dumps({"extra": exp["extra"], "matched": exp["matched"], "miss": miss, "note": note}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.ok(got.extra.includes('签约文件') || got.extra.includes('签约方'))
  assert.equal(got.miss.length, 1)
  assert.equal(got.miss[0].kind, '合同')
  assert.equal(got.miss[0].via, 'assist')
  assert.equal(got.note.length, 0)
})

test('recall_world one search, empty live_facts, 闲聊 skips search', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from world import recall_world, concepts_from_rows
calls = []
hits = {"results": [
  {"node": {"id": "session:s1:1", "type": "Document", "content": "项目因验收延期", "properties": {"valid_from": "2026-08-12"}}, "score": 120},
  {"node": {"id": "memory:ab", "type": "记忆卡片", "content": "华东客户指上海某公司", "properties": {}}, "via": "agent-memory", "score": 150},
  {"node": {"id": "dec-1", "type": "decision", "content": "上次延期", "properties": {"status": "已生效", "receipt_id": "R1", "nod_kind": "业务过账"}}, "score": 160},
], "total": 3}
def search(cwd, args):
  calls.append(dict(args))
  return hits
concepts = concepts_from_rows([
  {"id": "https://v#contract", "type": "skos:Concept", "content": "合同", "properties": {"can": ["现查"], "resource": "biz_contracts"}},
])
got = recall_world("/ws", {"query": "合同为什么延期，现在什么状态"}, search=search, concepts=concepts, peers=["/other"])
chat = recall_world("/ws", {"query": "哈哈随便聊聊"}, search=search, concepts=concepts)
print(json.dumps({
  "live": got["live_facts"],
  "missing_kind": [row["kind"] for row in got["missing"]],
  "grades": sorted({row["knowledge_grade"] for row in got["results"]}),
  "mem": len(got["memories"]),
  "dec": len(got["decisions"]),
  "ev": len(got["evidence"]),
  "sources": [row["source_type"] for row in got["sources"]],
  "assist_live": [row["live"] for row in got["sources"] if row["source_type"] == "assist"],
  "chat_results": chat["results"],
  "chat_intent": chat["intent"],
}, ensure_ascii=False))
print(len(calls))
`)
  const lines = out.split('\n')
  const got = JSON.parse(lines[0])
  const callCount = Number(lines[1])
  assert.equal(got.live.length, 0)
  assert.deepEqual(got.missing_kind, ['合同'])
  assert.ok(got.grades.includes('observation'))
  assert.ok(got.grades.includes('user_memory'))
  assert.ok(got.grades.includes('verified_receipt'))
  assert.equal(got.mem, 1)
  assert.equal(got.dec, 1)
  assert.ok(got.sources.includes('workspace'))
  assert.ok(got.sources.includes('bridge'))
  assert.ok(got.sources.includes('assist'))
  assert.deepEqual(got.assist_live, [true])
  assert.deepEqual(got.chat_results, [])
  assert.equal(got.chat_intent, '闲聊')
  assert.equal(callCount, 1)
})

test('recall_world extra alias search is capped and does not open a connector', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from world import recall_world, concepts_from_rows
calls = []
def search(cwd, args):
  calls.append(args.get("q"))
  q = args.get("q")
  nid = "session:s1:1" if q == "合同延期" else "session:s1:2"
  return {"results": [{"node": {"id": nid, "type": "Document", "content": q, "properties": {}}, "score": 100}], "total": 1}
concepts = concepts_from_rows([
  {"id": "https://v#c", "type": "skos:Concept", "content": "合同", "properties": {"altLabels": ["签约文件"], "can": ["现查"]}},
])
got = recall_world("/ws", {"query": "合同延期", "across_bridges": False}, search=search, concepts=concepts)
print(json.dumps({"calls": calls, "ids": [r["id"] for r in got["results"]], "expanded": got["expanded"], "live": got["live_facts"]}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.calls[0], '合同延期')
  assert.ok(got.calls.length <= 4)
  assert.ok(got.ids.includes('session:s1:1'))
  assert.deepEqual(got.live, [])
})

test('run_search_text envelope is additive and matching still hits the same id', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-world-search-'))
  try {
    const dir = join(cwd, '.dsh', 'semantic-os')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'graph.json'), JSON.stringify({
      nodes: [{
        id: 'session:s1:1',
        type: 'Document',
        content: '要不要只发 darwin-arm64',
        properties: { content: '要不要只发 darwin-arm64', valid_from: '2026-08-22T01:45:17.656000+08:00' },
        valid_from: '2026-08-22T01:45:17.656000+08:00',
      }],
      edges: [],
    }))
    const out = py(`
import json, sys
sys.path.insert(0, "python")
from bootstrap import run_search_text
got = run_search_text(${JSON.stringify(cwd)}, {"q": "darwin-arm64", "across_bridges": False})
hit = (got.get("results") or [None])[0] or {}
print(json.dumps({"id": (hit.get("node") or {}).get("id"), "grade": hit.get("knowledge_grade"), "live": hit.get("is_live"), "then": bool(hit.get("then")), "total": got.get("total"), "facts": got.get("live_facts"), "missing": got.get("missing")}, ensure_ascii=False))
`)
    const got = JSON.parse(out)
    assert.equal(got.id, 'session:s1:1')
    assert.equal(got.grade, 'observation')
    assert.equal(got.live, false)
    assert.equal(got.then, true)
    assert.equal(got.total, 1)
    assert.deepEqual(got.facts, [])
    assert.deepEqual(got.missing, [])
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('search_text is the only search mouth; recall_world is not a host op', () => {
  const out = py(`
import sys
sys.path.insert(0, "python")
from bootstrap import is_fast_read_op, needs_workspace_lock, _FAST_READ_OPS
print(is_fast_read_op("recall_world"), "recall_world" in _FAST_READ_OPS, is_fast_read_op("search_text"), needs_workspace_lock("search_text"))
`)
  assert.equal(out, 'False False True False')
})

test('search_text missing comes from vocab can/resource, first hit stays', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-world-miss-'))
  try {
    const dir = join(cwd, '.dsh', 'semantic-os')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'graph.json'), JSON.stringify({
      nodes: [
        {
          id: 'session:s1:1',
          type: 'Document',
          content: '合同延期因为验收标准未确认',
          properties: { content: '合同延期因为验收标准未确认', valid_from: '2026-08-12T10:00:00+08:00' },
        },
        {
          id: 'https://v#contract',
          type: 'skos:Concept',
          content: '合同',
          properties: { label: '合同', can: ['现查'], resource: 'biz_contracts' },
        },
      ],
      edges: [],
    }))
    const out = py(`
import json, sys
sys.path.insert(0, "python")
from bootstrap import run_search_text
got = run_search_text(${JSON.stringify(cwd)}, {"q": "合同延期", "across_bridges": False})
print(json.dumps({
  "first": ((got.get("results") or [{}])[0].get("node") or {}).get("id"),
  "missing": [row.get("kind") for row in (got.get("missing") or [])],
  "via": [row.get("via") for row in (got.get("missing") or [])],
  "live": got.get("live_facts"),
}, ensure_ascii=False))
`)
    const got = JSON.parse(out)
    assert.equal(got.first, 'session:s1:1')
    assert.deepEqual(got.missing, ['合同'])
    assert.deepEqual(got.via, ['assist'])
    assert.deepEqual(got.live, [])
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('Host clipSearchPayload stamps corpus hits that lack a grade', () => {
  const got = clipSearchPayload({
    results: [{
      node: { id: 'session:s1:9', type: 'Document', content: '延期', properties: { content: '延期' } },
      score: 90,
    }],
    total: 1,
    query: '延期',
  })
  const hit = stampWorldHit(got.results[0], '/ws')
  assert.equal(hit.knowledge_grade, 'observation')
  assert.equal(hit.is_live, false)
  assert.equal(hit.source_type, 'session')
})

test('draft_memory_card stores knowledge_grade metadata', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-world-mem-'))
  try {
    const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_draft_memory_card
with patch("bootstrap.insert_memory_card", return_value={"ok": True, "via": "insert"}):
  with patch("agent_mem.store_agent_memory", return_value={"ok": True}) as store:
    got = run_draft_memory_card(${JSON.stringify(cwd)}, {"label": "连接业务系统走协助插件", "cause": "correction", "source": "session:s1"})
print(json.dumps(got, ensure_ascii=False))
`)
    const got = JSON.parse(out)
    assert.equal(got.ok, true)
    const src = spawnSync('python3', ['-c', `
import inspect, sys
sys.path.insert(0, "python")
import bootstrap
print(inspect.getsource(bootstrap.run_draft_memory_card))
`], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8', env: { ...process.env, PYTHONPATH: 'python' } })
    assert.match(src.stdout, /knowledge_grade/)
    assert.match(src.stdout, /user_memory/)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
