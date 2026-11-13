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

test('record_decision MISSING_FIELD on 采购单 still records 已生效', () => {
  const out = py(`
import json, os, sys, tempfile
sys.path.insert(0, "python")
from bootstrap import run_tool, run_find_precedents
home = tempfile.mkdtemp(); os.environ["DSH_HOME"] = home
cwd = tempfile.mkdtemp()
up = run_tool("upsert_workspace_vocab", cwd, {
  "name": "本机业务单据型 · 单据",
  "concepts": [{"id": "purchase-order", "label": "采购单", "fields": ["单号", "状态"], "can": ["现查"]}],
})
first = run_tool("record_decision", cwd, {
  "category": "procurement_verification",
  "scenario": "PO-20261112 缺口不齐就停，不要过账",
  "reasoning": "键对不上就停",
  "outcome": "缺口不齐就停，不要过账",
  "confidence": 0.9,
  "kind": "采购单",
  "ticket": "PO-20261112",
  "system": "采购",
  "environment": "测试",
})
prec = run_find_precedents(cwd, {"scenario": "PO-20261112 缺口不齐就停，不要过账", "max_results": 10})
pids = [r.get("decision_id") for r in prec.get("precedents") or []]
print(json.dumps({
  "up": {"ok": up.get("ok"), "error": up.get("error")},
  "first": first,
  "did": str(first.get("decision_id") or ""),
  "status": first.get("board_status"),
  "warn": first.get("shape_warning") or {},
  "ref": first.get("reference_id"),
  "prec": pids,
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.up.ok, true, JSON.stringify(got.up))
  assert.ok(got.did, JSON.stringify(got.first))
  assert.equal(got.status, '已生效')
  assert.equal(got.first.error, undefined, JSON.stringify(got.first))
  assert.equal(got.warn.error, 'MISSING_FIELD')
  assert.equal(got.warn.field, '状态')
  assert.ok(!got.ref, JSON.stringify(got.first))
  assert.ok(got.prec.includes(got.did), JSON.stringify(got.prec))
})

test('record_decision unfolds \\\\uXXXX tenant_cwd and still skips 业务引用', () => {
  const out = py(`
import json, os, sys, tempfile
sys.path.insert(0, "python")
from bootstrap import run_tool
home = tempfile.mkdtemp(); os.environ["DSH_HOME"] = home
cwd = tempfile.mkdtemp()
run_tool("upsert_workspace_vocab", cwd, {
  "name": "本机业务单据型 · 单据",
  "concepts": [{"id": "purchase-order", "label": "采购单", "fields": ["单号", "状态"], "can": ["现查"]}],
})
first = run_tool("record_decision", cwd, {
  "category": "procurement_verification",
  "scenario": "\\\\u7f3a\\\\u53e3\\\\u4e0d\\\\u9f50\\\\u5c31\\\\u505c",
  "reasoning": "\\\\u952e\\\\u5bf9\\\\u4e0d\\\\u4e0a\\\\u5c31\\\\u505c",
  "outcome": "\\\\u7f3a\\\\u53e3\\\\u4e0d\\\\u9f50\\\\u5c31\\\\u505c\\\\uff0c\\\\u4e0d\\\\u8981\\\\u8fc7\\\\u8d26",
  "confidence": 0.9,
  "kind": "\\\\u91c7\\\\u8d2d\\\\u5355",
  "ticket": "PO-20261112",
  "system": "\\\\u91c7\\\\u8d2d",
  "environment": "\\\\u6d4b\\\\u8bd5",
  "nod_kind": "\\\\u4f1a\\\\u7b7e\\\\u540c\\\\u610f",
  "tenant_cwd": "".join("\\\\u%04x" % ord(ch) for ch in cwd),
})
print(json.dumps({
  "first": first,
  "did": str(first.get("decision_id") or ""),
  "status": first.get("board_status"),
  "warn": first.get("shape_warning") or {},
  "ref": first.get("reference_id"),
  "nod": first.get("nod_kind"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.first.error, undefined, JSON.stringify(got.first))
  assert.ok(got.did, JSON.stringify(got.first))
  assert.equal(got.status, '已生效')
  assert.equal(got.warn.error, 'MISSING_FIELD')
  assert.equal(got.warn.field, '状态')
  assert.ok(!got.ref, JSON.stringify(got.first))
  assert.equal(got.nod, '会签同意')
})

test('record_decision without because is live and listed', () => {
  const out = py(`
import json, os, sys, tempfile
sys.path.insert(0, "python")
from bootstrap import run_tool, run_list_decisions, run_find_precedents
home = tempfile.mkdtemp(); os.environ["DSH_HOME"] = home
cwd = tempfile.mkdtemp()
first = run_tool("record_decision", cwd, {
  "category": "rel",
  "scenario": "没有依据也要不要记下",
  "reasoning": "Semantica 记下即落图",
  "outcome": "记下",
  "confidence": 0.9,
})
did = str(first.get("decision_id") or "")
listed = run_list_decisions(cwd, {"limit": 80})
ids = [r.get("decision_id") for r in listed.get("decisions") or []]
prec = run_find_precedents(cwd, {"scenario": "没有依据也要不要记下", "max_results": 10})
pids = [r.get("decision_id") for r in prec.get("precedents") or []]
print(json.dumps({
  "first": first,
  "did": did,
  "status": first.get("board_status"),
  "list": ids,
  "prec": pids,
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.ok(got.did, JSON.stringify(got.first))
  assert.equal(got.status, '已生效')
  assert.equal(got.first.error, undefined, JSON.stringify(got.first))
  assert.ok(got.list.includes(got.did), JSON.stringify(got.list))
  assert.ok(got.prec.includes(got.did), JSON.stringify(got.prec))
})

test('recorded draft lists after slim and is citable as because', () => {
  const out = py(`
import json, os, sys, tempfile
sys.path.insert(0, "python")
from bootstrap import run_tool, run_list_decisions, load_session, save_session, graph_path
import graph_store
home = tempfile.mkdtemp(); os.environ["DSH_HOME"] = home
cwd = tempfile.mkdtemp()
first = run_tool("record_decision", cwd, {
  "category": "rel",
  "scenario": "全量验收要不要只发验收包",
  "reasoning": "真机",
  "outcome": "要发",
  "confidence": 0.9,
  "session_id": "probe-session",
})
did = str(first.get("decision_id") or "")
session, path = load_session(cwd)
save_session(session, path)
listed = run_list_decisions(cwd, {"include_auto": True, "limit": 80})
ids = [r.get("decision_id") for r in listed.get("decisions") or []]
stored = graph_store.read_one(cwd, did) or {}
second = run_tool("record_decision", cwd, {
  "category": "rel",
  "scenario": "第二块板要不要引用第一块",
  "reasoning": "because",
  "outcome": "引用",
  "confidence": 0.9,
  "because": [did],
})
print(json.dumps({
  "first": first,
  "did": did,
  "list": ids,
  "type": stored.get("type"),
  "second": second,
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.ok(got.did, JSON.stringify(got.first))
  assert.equal(String(got.type || '').toLowerCase(), 'decision')
  assert.ok(got.list.includes(got.did), JSON.stringify(got.list))
  assert.equal(got.second.error, undefined, JSON.stringify(got.second))
  assert.ok(got.second.decision_id)
})
