import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

function py(code) {
  const r = spawnSync('python3', ['-c', code], {
    cwd: new URL('..', import.meta.url).pathname,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'python' },
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}

test('fast-read set includes list_decisions and excludes writers', () => {
  const out = py(`
import sys
sys.path.insert(0, "python")
from bootstrap import is_fast_read_op
print(is_fast_read_op("list_decisions"), is_fast_read_op("export_ledger"), is_fast_read_op("backup_graph"))
print(is_fast_read_op("record_decision"), is_fast_read_op("erase_ledger"), is_fast_read_op("restore_graph"))
print(is_fast_read_op("get_graph_analytics"))
`)
  assert.match(out, /True True True/)
  assert.match(out, /False False False/)
  assert.match(out, /True/)
})

test('unknown ops and analytics do not take the workspace write lock', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import needs_workspace_lock, run_graph_analytics, is_fast_read_op

edges = [{"source": "a", "target": "b", "type": "related_to"}] * 3
rows = [{"id": "a", "type": "Person"}, {"id": "b", "type": "Person"}]
with patch("bootstrap.read_node_rows", return_value=(rows, {"ok": True})):
  with patch("bootstrap.read_edge_rows", return_value=edges):
    got = run_graph_analytics("/ws", {})
print(json.dumps({
  "lock_unknown": needs_workspace_lock("definitely_not_an_op"),
  "lock_search": needs_workspace_lock("search_text"),
  "lock_write": needs_workspace_lock("record_decision"),
  "lock_nod": needs_workspace_lock("nod_memory_card"),
  "lock_analytics": needs_workspace_lock("get_graph_analytics"),
  "fast_analytics": is_fast_read_op("get_graph_analytics"),
  "engine": got.get("engine"),
  "nodes": got.get("node_count"),
  "edges": got.get("edge_count"),
  "top": got.get("top_degree"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.lock_unknown, false)
  assert.equal(got.lock_search, false)
  assert.equal(got.lock_write, true)
  assert.equal(got.lock_nod, true)
  assert.equal(got.lock_analytics, false)
  assert.equal(got.fast_analytics, true)
  assert.equal(got.engine, 'degree')
  assert.equal(got.nodes, 2)
  assert.equal(got.edges, 3)
  assert.ok(got.top && got.top.length)
})

test('opening_brief fails closed without cwd and stays 当时', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_opening_brief, is_fast_read_op

empty = run_opening_brief("", {})
rows = [
  {"id": "live", "type": "decision", "properties": {"status": "已生效", "outcome": "只发 arm64", "scenario": "要不要只发", "timestamp": "2026-08-24T01:00:00+08:00"}},
  {"id": "draft", "type": "decision", "properties": {"status": "起草", "outcome": "起草板"}},
  {"id": "memory:1", "type": "记忆卡片", "content": "先验证 macOS", "properties": {"status": "起草", "kind": "记忆卡片"}},
  {"id": "memory:2", "type": "记忆卡片", "content": "第二张待审", "properties": {"status": "起草", "kind": "记忆卡片"}},
  {"id": "memory:filed", "type": "记忆卡片", "content": "点过头的口径", "properties": {"status": "已入档", "kind": "记忆卡片"}},
]
with patch("bootstrap.read_node_rows", return_value=(rows, {"ok": True})):
  with patch("bootstrap.read_memory_card_rows", return_value=(rows, {"ok": True})):
    with patch("bootstrap.read_nodes_by_id", return_value={}):
      with patch("bootstrap.read_edge_rows", return_value=[]):
        got = run_opening_brief("/ws", {})
print(json.dumps({
  "fast": is_fast_read_op("opening_brief"),
  "empty": empty.get("text"),
  "empty_ok": empty.get("ok"),
  "text": got.get("text"),
  "live": got.get("live"),
  "filed": got.get("filed"),
  "drafts": got.get("drafts"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.fast, true)
  assert.equal(got.empty, '')
  assert.equal(got.empty_ok, false)
  assert.match(got.text, /当时，不是现在/)
  assert.match(got.text, /只发 arm64/)
  assert.equal(got.text.includes('起草板'), false)
  assert.match(got.text, /点过头的口径/)
  assert.match(got.text, /已入档记忆/)
  assert.equal(got.text.includes('起草板'), false)
  assert.equal(got.text.includes('先验证 macOS'), false)
  assert.equal(got.text.includes('第二张待审'), false)
  assert.equal(got.text.includes('待审'), false)
  assert.ok(got.text.length <= 800)
  assert.equal(got.live, 1)
  assert.equal(got.filed, 1)
  assert.equal(got.drafts, 0)
})

test('open_node on a 记忆卡片 clips the source session around the cue', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_open_node

diary = ("甲" * 400) + " 我们定了：只发 darwin-arm64。 " + ("乙" * 400)
rows = [
  {"id": "memory:1", "type": "记忆卡片", "content": "我们定了：只发 darwin-arm64。", "properties": {"kind": "记忆卡片", "source": "session:s1", "status": "起草"}},
  {"id": "session:s1", "type": "Document", "content": diary, "properties": {}},
]
by_id = {row["id"]: row for row in rows}
with patch("bootstrap.read_nodes_by_id", side_effect=lambda cwd, ids: {i: by_id[i] for i in ids if i in by_id}):
  got = run_open_node("/ws", {"id": "memory:1", "limit": 240})
print(json.dumps({
  "text": got.get("text"),
  "excerpt": got.get("excerpt_id"),
  "truncated": got.get("truncated"),
  "len": got.get("length"),
  "diary_len": len(diary),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.match(got.text, /darwin-arm64/)
  assert.equal(got.excerpt, 'session:s1')
  assert.equal(got.len, got.diary_len)
  assert.equal(got.truncated, true)
  assert.ok(got.text.length < got.diary_len)
  assert.equal(got.text.includes('甲'.repeat(200)), false)
  assert.equal(got.text.includes('乙'.repeat(200)), false)
})

test('open_node on a card with no source does not pretend the cue is the diary', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_open_node

rows = [{"id": "memory:bare", "type": "记忆卡片", "content": "工人+问到再抽", "properties": {"kind": "记忆卡片", "status": "起草"}}]
by_id = {row["id"]: row for row in rows}
with patch("bootstrap.read_nodes_by_id", side_effect=lambda cwd, ids: {i: by_id[i] for i in ids if i in by_id}):
  got = run_open_node("/ws", {"id": "memory:bare", "limit": 800})
print(json.dumps({"missing": got.get("missing_source"), "source": got.get("source") or "", "ok": got.get("ok")}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.ok, true)
  assert.equal(got.missing, true)
  assert.equal(got.source, '')
})

test('open_node caps what the model sees and does not cut the archive', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_open_node, is_fast_read_op

blob = "甲" * 5000
rows = [{"id": "session:s1:1", "type": "Document", "content": blob, "properties": {"timestamp": "2026-08-22T01:45:17.656000+08:00"}}]
by_id = {row["id"]: row for row in rows}
with patch("bootstrap.read_nodes_by_id", side_effect=lambda cwd, ids: {i: by_id[i] for i in ids if i in by_id}):
  got = run_open_node("/ws", {"id": "session:s1:1", "limit": 400})
  miss = run_open_node("/ws", {"id": "session:missing"})
  empty = run_open_node("/ws", {})
print(json.dumps({
  "fast": is_fast_read_op("open_node"),
  "len": got.get("length"),
  "shown": len(got.get("text") or ""),
  "truncated": got.get("truncated"),
  "miss": miss.get("error"),
  "empty": empty.get("error"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.fast, true)
  assert.equal(got.len, 5000)
  assert.ok(got.shown <= 400)
  assert.equal(got.truncated, true)
  assert.equal(got.miss, 'NOT_FOUND')
  assert.equal(got.empty, 'NO_ID')
})

test('session_text is read-only and does not truncate the archive', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_session_text, is_fast_read_op

blob = "甲" * 2500
rows = [{"id": "session:s1:1", "type": "Document", "content": blob, "properties": {"timestamp": "2026-08-22T01:45:17.656000+08:00"}}]
by_id = {row["id"]: row for row in rows}
with patch("bootstrap.read_nodes_by_id", side_effect=lambda cwd, ids: {i: by_id[i] for i in ids if i in by_id}):
  got = run_session_text("/ws", {"id": "session:s1:1"})
  bad = run_session_text("/ws", {"id": "memory:1"})
print(json.dumps({
  "fast": is_fast_read_op("session_text"),
  "len": got.get("length"),
  "text_len": len(got.get("text") or ""),
  "bad": bad.get("error"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.fast, true)
  assert.equal(got.len, 2500)
  assert.equal(got.text_len, 2500)
  assert.equal(got.bad, 'NOT_A_SESSION')
})

test('memory_health is read-only and flags 无出处 / 超长会话', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_memory_health, is_fast_read_op

rows = [
  {"id": "memory:orphan", "type": "记忆卡片", "content": "没有出处的卡片", "properties": {"kind": "记忆卡片", "status": "起草"}},
  {"id": "session:s1:1", "type": "Document", "content": "甲" * 2100, "properties": {}},
  {"id": "session:s2:1", "type": "Document", "content": "乙" * 2100, "properties": {}},
  {"id": "memory:ok", "type": "记忆卡片", "content": "有出处", "properties": {"kind": "记忆卡片", "source": "session:s1:1"}},
  {"id": "memory:dead", "type": "记忆卡片", "content": "已停用无出处", "properties": {"kind": "记忆卡片", "status": "起草", "valid_until": "2020-01-01T00:00:00+00:00"}},
]
edges = [{"source": "session:s1:1", "target": "memory:ok", "type": "出自"}]
with patch("bootstrap.read_node_rows", return_value=(rows, {"ok": True})):
  with patch("bootstrap.read_edge_rows", return_value=edges):
    with patch("bootstrap.read_memory_card_rows", return_value=([], {"ok": True})):
      with patch("bootstrap.run_enrich_dedup", return_value={"duplicates": [{"entity_a": {"id": "a1"}, "entity_b": {"id": "a2"}}]}):
        got = run_memory_health("/ws", {})
print(json.dumps({
  "fast": is_fast_read_op("memory_health"),
  "writes": got.get("writes"),
  "kinds": sorted({row.get("kind") for row in got.get("issues") or []}),
  "ids": [row.get("id") for row in got.get("issues") or []],
  "dup": [row.get("other") for row in got.get("issues") or [] if row.get("kind") == "重复"],
  "dup_ops": [action.get("op") for row in got.get("issues") or [] if row.get("kind") == "重复" for action in (row.get("actions") or [])],
  "extract": sorted([(row.get("id"), row.get("extract"), row.get("extracted")) for row in got.get("issues") or [] if row.get("kind") == "超长会话"]),
  "extract_ops": sorted([row.get("id") for row in got.get("issues") or [] if any(action.get("op") == "extract" for action in (row.get("actions") or []))]),
  "groups": [row.get("kind") for row in got.get("groups") or []],
  "group_ops": {row.get("kind"): row.get("actions") for row in got.get("groups") or []},
  "orphan_ops": [action.get("op") for row in got.get("issues") or [] if row.get("id") == "memory:orphan" for action in (row.get("actions") or [])],
  "total": got.get("total"),
  "has_more": got.get("has_more"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.fast, true)
  assert.equal(got.writes, false)
  assert.ok(got.kinds.includes('无出处'))
  assert.ok(got.kinds.includes('超长会话'))
  assert.ok(got.ids.includes('memory:orphan'))
  assert.ok(got.ids.includes('session:s1:1'))
  assert.ok(got.ids.includes('session:s2:1'))
  assert.equal(got.ids.includes('memory:ok'), false)
  assert.equal(got.ids.includes('memory:dead'), false)
  assert.deepEqual(got.dup, ['a2'])
  assert.deepEqual(got.dup_ops, ['open', 'merge'])
  assert.deepEqual(got.extract, [['session:s1:1', false, true], ['session:s2:1', true, false]])
  assert.deepEqual(got.extract_ops, ['session:s2:1'])
  assert.ok(got.groups.includes('超长会话'))
  assert.ok(got.groups.includes('重复'))
  assert.deepEqual(got.group_ops['无出处'], ['retire_group'])
  assert.deepEqual(got.orphan_ops, ['open', 'source', 'retire'])
  assert.equal(got.has_more, false)
})

test('memory_health pages honestly and mutes 报告噪音 after a nod', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_memory_health, run_mute_health_kind, run_source_memory_card, run_renew_memory_card

rows = [{"id": "memory:n%s" % i, "type": "记忆卡片", "content": "--- ### 还未完成 | 项 | 说明 |", "properties": {"kind": "记忆卡片", "status": "起草", "source": "session:s1"}} for i in range(5)]
rows.append({"id": "memory:orphan", "type": "记忆卡片", "content": "没有出处的卡片", "properties": {"kind": "记忆卡片", "status": "起草"}})
rows.append({"id": "memory:dead", "type": "记忆卡片", "content": "已过期卡", "properties": {"kind": "记忆卡片", "status": "已入档", "valid_until": "2020-01-01T00:00:00+00:00"}})
with patch("bootstrap.read_node_rows", return_value=(rows, {"ok": True})):
  with patch("bootstrap.read_edge_rows", return_value=[]):
    with patch("bootstrap.run_enrich_dedup", return_value={"duplicates": []}):
      with patch("bootstrap.read_memory_card_rows", return_value=([], {"ok": True})):
        page = run_memory_health("/ws", {"limit": 3, "offset": 0})
        later = run_memory_health("/ws", {"limit": 3, "offset": 3})
      mute_rows = [{"id": "memory:health-mute", "type": "记忆卡片", "content": "梳理一类不再列出", "properties": {"kind": "记忆卡片", "status": "起草", "muted": ["报告噪音"]}}]
      with patch("bootstrap.read_memory_card_rows", return_value=(mute_rows, {"ok": True})):
        muted = run_memory_health("/ws", {})
with patch("bootstrap.read_memory_card_rows", return_value=([{"id": "memory:orphan", "type": "记忆卡片", "properties": {"kind": "记忆卡片"}}], {"ok": True})):
  with patch("bootstrap.patch_node_props", return_value={"ok": True, "via": "patch"}):
    with patch("bootstrap.insert_edge", return_value={"ok": True}):
      sourced = run_source_memory_card("/ws", {"id": "memory:orphan", "source": "session:s1", "nodded": True})
    renewed = run_renew_memory_card("/ws", {"id": "memory:orphan", "nodded": True})
with patch("bootstrap.read_memory_card_rows", return_value=([], {"ok": True})):
  with patch("bootstrap.insert_memory_card", return_value={"ok": True, "via": "insert"}) as inserted:
    muted_write = run_mute_health_kind("/ws", {"kind": "报告噪音", "nodded": True})
print(json.dumps({
  "page_n": len(page.get("issues") or []),
  "total": page.get("total"),
  "has_more": page.get("has_more"),
  "later_n": len(later.get("issues") or []),
  "later_more": later.get("has_more"),
  "muted_kinds": [row.get("kind") for row in muted.get("issues") or []],
  "source": sourced.get("source"),
  "renewed": renewed.get("valid_until"),
  "mute_kind": muted_write.get("kind"),
  "inserted": inserted.call_args.args[1] if inserted.call_args else "",
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.page_n, 3)
  assert.equal(got.total, 7)
  assert.equal(got.has_more, true)
  assert.equal(got.later_n, 3)
  assert.equal(got.later_more, true)
  assert.equal(got.muted_kinds.includes('报告噪音'), false)
  assert.ok(got.muted_kinds.includes('无出处'))
  assert.equal(got.source, 'session:s1')
  assert.equal(got.renewed, '')
  assert.equal(got.mute_kind, '报告噪音')
  assert.equal(got.inserted, 'memory:health-mute')
})

test('expired cards can be confirmed retired and source write fails closed on edge', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_memory_health, run_source_memory_card

rows = [
  {"id": "memory:dead", "type": "记忆卡片", "content": "已过期卡", "properties": {"kind": "记忆卡片", "status": "已入档", "valid_until": "2020-01-01T00:00:00+00:00"}},
]
with patch("bootstrap.read_node_rows", return_value=(rows, {"ok": True})):
  with patch("bootstrap.read_edge_rows", return_value=[]):
    with patch("bootstrap.read_memory_card_rows", return_value=([], {"ok": True})):
      with patch("bootstrap.run_enrich_dedup", return_value={"duplicates": []}):
        health = run_memory_health("/ws", {})
ops = [action.get("op") for row in health.get("issues") or [] if row.get("kind") == "已过期" for action in (row.get("actions") or [])]
with patch("bootstrap.read_memory_card_rows", return_value=([{"id": "memory:orphan", "type": "记忆卡片", "properties": {"kind": "记忆卡片"}}], {"ok": True})):
  with patch("bootstrap.patch_node_props", return_value={"ok": True, "via": "patch"}):
    with patch("bootstrap.insert_edge", return_value={"error": "INSERT_FAILED"}):
      sourced = run_source_memory_card("/ws", {"id": "memory:orphan", "source": "session:s1", "nodded": True})
print(json.dumps({"ops": ops, "source_error": sourced.get("error"), "source_ok": sourced.get("ok")}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.deepEqual(got.ops, ['open', 'renew', 'retire'])
  assert.equal(Boolean(got.source_ok), false)
  assert.equal(got.source_error, 'INSERT_FAILED')
})

test('enrich_dedup skips schema types and mixed-type pairs', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_enrich_dedup, _dedup_pair_action

rows = [
  {"id": "https://example.local/vocab#class-Document", "type": "owl:Class", "content": "Document", "properties": {}},
  {"id": "Document", "type": "知识图", "content": "Document", "properties": {}},
  {"id": "memory:a", "type": "记忆卡片", "content": "同一口径", "properties": {"kind": "记忆卡片"}},
  {"id": "memory:b", "type": "记忆卡片", "content": "同一口径", "properties": {"kind": "记忆卡片"}},
]
with patch("bootstrap.read_node_rows", return_value=(rows, {"ok": True})):
  got = run_enrich_dedup("/ws", {"threshold": 0.9})
ids = [(row["entity_a"]["id"], row["entity_b"]["id"]) for row in got.get("duplicates") or []]
schema = _dedup_pair_action({"id": "https://example.local/vocab#class-Document", "type": "owl:Class"}, {"id": "Document", "type": "知识图"}, set())
link = _dedup_pair_action({"id": "memory:a", "type": "记忆卡片"}, {"id": "memory:b", "type": "记忆卡片"}, {"memory:a", "memory:b"})
print(json.dumps({"ids": ids, "schema": schema, "link": link, "scanned": got.get("scanned")}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.ids.some((pair) => pair.includes('https://example.local/vocab#class-Document')), false)
  assert.equal(got.schema, '')
  assert.equal(got.link, 'link')
})

test('memory_health duplicate cards emit link, not merge overwrite', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_memory_health

rows = [
  {"id": "memory:a", "type": "记忆卡片", "content": "同一口径", "properties": {"kind": "记忆卡片", "status": "起草", "source": "session:s1"}},
  {"id": "memory:b", "type": "记忆卡片", "content": "同一口径", "properties": {"kind": "记忆卡片", "status": "起草", "source": "session:s1"}},
]
with patch("bootstrap.read_node_rows", return_value=(rows, {"ok": True})):
  with patch("bootstrap.read_edge_rows", return_value=[{"source": "session:s1", "target": "memory:a", "type": "出自"}, {"source": "session:s1", "target": "memory:b", "type": "出自"}]):
    with patch("bootstrap.read_memory_card_rows", return_value=([], {"ok": True})):
      with patch("bootstrap.run_enrich_dedup", return_value={"duplicates": [{"entity_a": {"id": "memory:a", "label": "同一口径"}, "entity_b": {"id": "memory:b", "label": "同一口径"}}]}):
        got = run_memory_health("/ws", {})
dups = [row for row in got.get("issues") or [] if row.get("kind") == "重复"]
print(json.dumps({
  "ops": [action.get("op") for row in dups for action in (row.get("actions") or [])],
  "types": [row.get("type") for row in dups],
  "others": [row.get("other") for row in dups],
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.deepEqual(got.ops, ['open', 'link'])
  assert.equal(got.ops.includes('merge'), false)
  assert.ok(got.types[0])
  assert.deepEqual(got.others, ['memory:b'])
})

test('draft_memory_card encodes at the act and is live 已入档', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_draft_memory_card

with patch("bootstrap.insert_memory_card", return_value={"ok": True, "via": "insert"}) as inserted:
  ok = run_draft_memory_card("/ws", {"label": "不要硬编码，业务词走词表", "cause": "correction", "source": "session:s1"})
  live = run_draft_memory_card("/ws", {"label": "不要硬编码，业务词走词表", "cause": "correction", "status": "已入档"})
  bad = run_draft_memory_card("/ws", {"label": "不要硬编码，业务词走词表"})
  chat = run_draft_memory_card("/ws", {"label": "今天天气怎么样？我们聊聊", "cause": "chat"})
print(json.dumps({
  "ok": ok.get("status"),
  "cause": ok.get("cause"),
  "via": ok.get("via"),
  "id": ok.get("id"),
  "live": live.get("error"),
  "bad": bad.get("error"),
  "chat": chat.get("error"),
  "label": inserted.call_args.args[2] if inserted.call_args else "",
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.ok, '已入档')
  assert.equal(got.cause, 'correction')
  assert.equal(got.via, 'insert')
  assert.match(got.id, /^memory:/)
  assert.equal(got.live, null)
  assert.equal(got.bad, 'NOT_A_CARD')
  assert.equal(got.chat, 'NOT_A_CARD')
  assert.match(got.label, /不要硬编码/)
})

test('nod and retire memory cards patch one node without loading the graph', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_nod_memory_card, run_retire_memory_card, is_fast_read_op

rows = [{"id": "memory:1", "type": "记忆卡片", "content": "先验证", "properties": {"status": "起草", "kind": "记忆卡片"}}]
with patch("bootstrap.read_memory_card_rows", return_value=(rows, {"ok": True})):
  with patch("bootstrap.patch_node_props", return_value={"ok": True, "via": "patch"}) as patched:
    filed = run_nod_memory_card("/ws", {"id": "memory:1", "nodded": True})
    retired = run_retire_memory_card("/ws", {"id": "memory:1", "nodded": True})
    calls = [call.args[2] for call in patched.call_args_list]
print(json.dumps({
  "filed": filed.get("status"),
  "filed_via": filed.get("via"),
  "retired_until": bool(retired.get("valid_until")),
  "retired_via": retired.get("via"),
  "fast_nod": is_fast_read_op("nod_memory_card"),
  "keys": [sorted(row.keys()) for row in calls],
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.filed, '已入档')
  assert.equal(got.filed_via, 'patch')
  assert.equal(got.retired_until, true)
  assert.equal(got.retired_via, 'patch')
  assert.equal(got.fast_nod, false)
  assert.ok(got.keys[0].includes('status'))
  assert.ok(got.keys[1].includes('valid_until'))
})

test('fast-read set includes list_memory_cards', () => {
  const out = py(`
import sys
sys.path.insert(0, "python")
from bootstrap import is_fast_read_op
print(is_fast_read_op("list_memory_cards"), is_fast_read_op("nod_memory_card"))
`)
  assert.match(out, /True False/)
})

test('report-noise drafts stay out of inbox and opening, hygiene flags them', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_list_memory_cards, run_opening_brief, run_memory_health, is_report_noise

assert is_report_noise("--- ### 还未完成 | 项 | 说明 |") is True
assert is_report_noise("** ### 当时要做的分期 1.") is True
assert is_report_noise("我们定了只发 arm64") is False
assert is_report_noise("最小闭环是 skill") is False
rows = [
  {"id": "memory:noise", "type": "记忆卡片", "content": "--- ### 还未完成 | 项 | 说明 | |---|---| | 再重启 |", "properties": {"status": "起草", "kind": "记忆卡片"}},
  {"id": "memory:heading", "type": "记忆卡片", "content": "** ### 当时要做的分期 1.", "properties": {"status": "起草", "kind": "记忆卡片"}},
  {"id": "memory:ok", "type": "记忆卡片", "content": "先验证 macOS", "properties": {"status": "起草", "kind": "记忆卡片"}},
  {"id": "live", "type": "decision", "properties": {"status": "已生效", "outcome": "只发 arm64"}},
]
with patch("bootstrap.read_node_rows", return_value=(rows, {"ok": True})):
  with patch("bootstrap.read_memory_card_rows", return_value=(rows, {"ok": True})):
    with patch("bootstrap.read_nodes_by_id", return_value={}):
      listed = run_list_memory_cards("/ws", {})
      with patch("bootstrap.read_edge_rows", return_value=[]):
        with patch("bootstrap.read_memory_card_rows", return_value=(rows, {"ok": True})):
          with patch("bootstrap.run_enrich_dedup", return_value={"duplicates": []}):
            health = run_memory_health("/ws", {})
          brief = run_opening_brief("/ws", {})
print(json.dumps({
  "ids": [r.get("id") for r in listed.get("cards") or []],
  "noise": [row.get("id") for row in health.get("issues") or [] if row.get("kind") == "报告噪音"],
  "text": brief.get("text"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.deepEqual(got.ids, ['memory:ok'])
  assert.deepEqual(got.noise.sort(), ['memory:heading', 'memory:noise'])
  assert.equal(got.text.includes('还未完成'), false)
  assert.equal(got.text.includes('先验证 macOS'), false)
  assert.equal(got.text.includes('待审'), false)
})

test('undated 记忆卡片 then follows the source session clock', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_list_memory_cards

rows = [
  {"id": "memory:old", "type": "记忆卡片", "content": "先验证 macOS", "properties": {"status": "起草", "kind": "记忆卡片", "source": "session:s1"}},
  {"id": "session:s1", "type": "Document", "content": "会话", "properties": {"timestamp": "2026-08-22T01:45:17.656000+08:00"}},
]
with patch("bootstrap.read_memory_card_rows", return_value=(rows, {"ok": True})):
  with patch("bootstrap.read_nodes_by_id", return_value={"session:s1": rows[1]}):
    got = run_list_memory_cards("/ws", {})
card = (got.get("cards") or [{}])[0]
print(json.dumps({
  "id": card.get("id"),
  "label": (card.get("then") or {}).get("label"),
  "undated": (card.get("then") or {}).get("undated"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.id, 'memory:old')
  assert.match(got.label, /2026-08-22/)
  assert.equal(got.undated, false)
})

test('list_memory_cards suggests 理解边 on the current page only', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_list_memory_cards

rows = [
  {"id": "memory:new", "type": "记忆卡片", "content": "发版收敛到 macOS arm64", "properties": {"status": "起草", "kind": "记忆卡片"}},
  {"id": "memory:old", "type": "记忆卡片", "content": "macOS arm64 先验证安装", "properties": {"status": "已入档", "kind": "记忆卡片"}},
]
with patch("bootstrap.read_memory_card_rows", return_value=(rows, {"ok": True})):
  with patch("bootstrap.read_nodes_by_id", return_value={}):
    got = run_list_memory_cards("/ws", {})
card = (got.get("cards") or [{}])[0]
print(json.dumps({
  "id": card.get("id"),
  "suggest": card.get("suggest"),
  "ops": [row.get("op") for row in (card.get("actions") or [])],
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.id, 'memory:new')
  assert.equal(got.suggest && got.suggest.type, 'enriches')
  assert.equal(got.suggest && got.suggest.target, 'memory:old')
  assert.deepEqual(got.ops, ['open', 'file', 'retire', 'link'])
})

test('list_memory_cards default is 起草, 已入档 only with include_filed', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_list_memory_cards

rows = [
  {"id": "memory:draft", "type": "记忆卡片", "content": "只发 arm64", "properties": {"status": "起草", "kind": "记忆卡片", "source": "session:s1"}},
  {"id": "memory:filed", "type": "记忆卡片", "content": "已点过头", "properties": {"status": "已入档", "kind": "记忆卡片", "source": "session:s2"}},
  {"id": "n1", "type": "Document", "content": "会话"},
]
with patch("bootstrap.read_memory_card_rows", return_value=(rows, {"ok": True})):
  with patch("bootstrap.read_nodes_by_id", return_value={}):
    draft = run_list_memory_cards("/ws", {})
    allc = run_list_memory_cards("/ws", {"include_filed": True})
print(json.dumps({
  "draft": [r.get("id") for r in draft.get("cards") or []],
  "all": [r.get("id") for r in allc.get("cards") or []],
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.deepEqual(got.draft, ['memory:draft'])
  assert.deepEqual(got.all.sort(), ['memory:draft', 'memory:filed'])
})

test('list_memory_cards pages with offset and has_more', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_list_memory_cards

rows = [
  {"id": "memory:a", "type": "记忆卡片", "content": "甲", "properties": {"status": "起草", "kind": "记忆卡片", "timestamp": "2026-08-24T02:00:00+08:00"}},
  {"id": "memory:b", "type": "记忆卡片", "content": "乙", "properties": {"status": "起草", "kind": "记忆卡片", "timestamp": "2026-08-24T01:00:00+08:00"}},
  {"id": "memory:c", "type": "记忆卡片", "content": "丙", "properties": {"status": "起草", "kind": "记忆卡片", "timestamp": "2026-08-24T00:00:00+08:00"}},
]
with patch("bootstrap.read_memory_card_rows", return_value=(rows, {"ok": True})):
  with patch("bootstrap.read_nodes_by_id", return_value={}):
    first = run_list_memory_cards("/ws", {"limit": 2})
    second = run_list_memory_cards("/ws", {"limit": 2, "offset": 2})
print(json.dumps({
  "first": [r.get("id") for r in first.get("cards") or []],
  "more": first.get("has_more"),
  "total": first.get("total"),
  "second": [r.get("id") for r in second.get("cards") or []],
  "second_more": second.get("has_more"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.total, 3)
  assert.equal(got.first.length, 2)
  assert.equal(got.more, true)
  assert.equal(got.second.length, 1)
  assert.equal(got.second_more, false)
})

test('retired 起草 cards drop out of the inbox and opening brief', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_list_memory_cards, run_opening_brief

rows = [
  {"id": "memory:live", "type": "记忆卡片", "content": "还算数", "properties": {"status": "起草", "kind": "记忆卡片"}},
  {"id": "memory:dead", "type": "记忆卡片", "content": "已停用", "properties": {"status": "起草", "kind": "记忆卡片", "valid_until": "2020-01-01T00:00:00+00:00"}},
  {"id": "live", "type": "decision", "properties": {"status": "已生效", "outcome": "只发 arm64", "timestamp": "2026-08-24T01:00:00+08:00"}},
]
with patch("bootstrap.read_node_rows", return_value=(rows, {"ok": True})):
  with patch("bootstrap.read_memory_card_rows", return_value=(rows, {"ok": True})):
    with patch("bootstrap.read_nodes_by_id", return_value={}):
      listed = run_list_memory_cards("/ws", {})
      with patch("bootstrap.read_edge_rows", return_value=[]):
        brief = run_opening_brief("/ws", {})
print(json.dumps({
  "ids": [r.get("id") for r in listed.get("cards") or []],
  "text": brief.get("text"),
  "drafts": brief.get("drafts"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.deepEqual(got.ids, ['memory:live'])
  assert.equal(got.text.includes('待审'), false)
  assert.equal(got.text.includes('还算数'), false)
  assert.equal(got.text.includes('已停用'), false)
  assert.equal(got.drafts, 0)
})

test('fast-read set includes query_decisions and find_precedents', () => {
  const out = py(`
import sys
sys.path.insert(0, "python")
from bootstrap import is_fast_read_op
print(is_fast_read_op("query_decisions"), is_fast_read_op("find_precedents"))
print(is_fast_read_op("record_decision"))
`)
  assert.match(out, /True True/)
  assert.match(out, /False/)
})

test('list_decisions hides 作废 and 已冲正 boards', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_list_decisions
rows = [
  {"id": "live", "type": "decision", "properties": {"status": "已生效", "outcome": "过了", "timestamp": "2026-08-29T00:00:00+08:00"}},
  {"id": "void", "type": "decision", "properties": {"status": "作废", "outcome": "expect-NO_BECAUSE", "timestamp": "2026-08-28T00:00:00+08:00"}},
  {"id": "rev", "type": "decision", "properties": {"status": "已冲正", "outcome": "冲了", "timestamp": "2026-08-27T00:00:00+08:00"}},
]
with patch("bootstrap.read_node_rows", return_value=(rows, {"ok": True})):
  got = run_list_decisions("/ws", {})
print(json.dumps({"ids": [d["decision_id"] for d in got["decisions"]], "total": got["total"]}))
`)
  const got = JSON.parse(out)
  assert.deepEqual(got.ids, ['live'])
  assert.equal(got.total, 1)
})

test('list_decisions hides auto clones and sorts newest first', () => {
  const out = py(`
import sys
sys.path.insert(0, "python")
from bootstrap import pack_official_decision, _is_auto_decision, _outcome_key

human = {"id": "e8061ff0-4d9d-4976-8428-adeb4c451a9b", "type": "decision", "properties": {
  "category": "product", "outcome": "暂缓展示本地日", "timestamp": "2026-08-23T07:38:49Z",
  "decision_maker": "user",
}}
auto = {"id": "aaaa", "type": "decision", "properties": {
  "outcome": "缓存 falkordblite 失败状态，失败一次后快速跳过",
  "source": "session_ingest", "auto": True, "timestamp": "2026-08-22T13:00:00Z",
  "decision_maker": "auto-extract",
}}
print(_is_auto_decision(human), _is_auto_decision(auto))
packed = pack_official_decision(human)
print(packed["decision_id"], packed["metadata"]["auto"], packed["timestamp"][:10])
print(_outcome_key(auto["properties"]["outcome"])[:12])
live = {"id": "live-1", "type": "decision", "properties": {
  "status": "已生效", "receipt_id": "rcp-12", "outcome": "过了",
}}
print(pack_official_decision(live)["metadata"]["status"], pack_official_decision(live)["metadata"]["receipt_id"])
`)
  assert.match(out, /False True/)
  assert.match(out, /e8061ff0-4d9d-4976-8428-adeb4c451a9b False 2026-08-23/)
  assert.match(out, /已生效 rcp-12/)
})
