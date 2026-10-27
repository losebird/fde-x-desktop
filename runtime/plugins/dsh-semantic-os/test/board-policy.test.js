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

test('auto extract cannot become 已生效', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from board import resolve_board
print(json.dumps(resolve_board({
  "category": "conversation",
  "scenario": "我们定了只发 darwin-arm64",
  "reasoning": "先验证",
  "outcome": "只发 darwin-arm64",
  "confidence": 0.9,
  "because": ["session:s1"],
  "leads_to": ["发版"],
  "receipt_id": "rcp-1",
  "metadata": {"auto": True, "source": "session_ingest"},
}), ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.error, undefined)
  assert.equal(got.status, '起草')
})

test('已生效 needs 依据, 后果 and 回执', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from board import resolve_board
print(json.dumps({
  "no_receipt": resolve_board({
    "status": "已生效",
    "nod_kind": "业务过账",
    "because": ["n1"],
    "leads_to": ["n2"],
  }),
  "ok": resolve_board({
    "status": "已生效",
    "nod_kind": "业务过账",
    "because": ["n1"],
    "leads_to": ["n2"],
    "receipt_id": "rcp-12",
  }),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.no_receipt.error, 'NO_RECEIPT')
  assert.equal(got.ok.status, '已生效')
  assert.equal(got.ok.receipt_id, 'rcp-12')
})

test('write refuses when envelope tenant is not this workspace', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from board import resolve_board
print(json.dumps({
  "mismatch": resolve_board({
    "tenant_cwd": "/other/project",
  }, cwd="/this/project"),
  "ok": resolve_board({
    "tenant_cwd": "/this/project",
    "status": "起草",
  }, cwd="/this/project"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.mismatch.error, 'TENANT_MISMATCH')
  assert.equal(got.ok.status, '起草')
})

test('已冲正 and 作废 do not need a receipt', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from board import resolve_board
print(json.dumps({
  "voids": resolve_board({"status": "已冲正", "leads_to": ["old-board"]}),
  "dropped": resolve_board({"status": "作废"}),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.voids.status, '已冲正')
  assert.equal(got.dropped.status, '作废')
})

test('only 已生效 boards are precedents', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from board import is_precedent
print(json.dumps({
  "live": is_precedent({"properties": {"status": "已生效"}}),
  "draft": is_precedent({"properties": {"status": "起草"}}),
  "voided": is_precedent({"properties": {"status": "作废"}}),
  "corrected": is_precedent({"properties": {"status": "已冲正"}}),
  "legacy": is_precedent({"properties": {"outcome": "发了"}}),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.live, true)
  assert.equal(got.draft, false)
  assert.equal(got.voided, false)
  assert.equal(got.corrected, false)
  assert.equal(got.legacy, false)
})

test('precedent search skips boards that are not 已生效', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from semantica.context.context_graph import ContextGraph
from bootstrap import score_decisions
g = ContextGraph()
live = g.record_decision("rel", "只发 darwin-arm64", "r", "只发", 0.9, metadata={"status": "已生效"})
g.record_decision("rel", "只发 darwin-arm64", "r", "起草板", 0.9, metadata={"status": "起草"})
g.record_decision("rel", "只发 darwin-arm64", "r", "废了", 0.9, metadata={"status": "作废"})
ids = [n.get("id") for n in score_decisions(g, "只发 darwin-arm64", category="rel")]
print(json.dumps({"ids": ids, "live": live}))
`)
  const got = JSON.parse(out)
  assert.deepEqual(got.ids, [got.live])
})

test('memory 理解边 needs a nod and cannot touch 已生效', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from board import resolve_memory_edge, suggest_memory_edge
print(json.dumps({
  "no_nod": resolve_memory_edge({"source": "memory:a", "target": "memory:b", "type": "challenges"}),
  "bad": resolve_memory_edge({"source": "memory:a", "target": "memory:b", "type": "leads_to", "nodded": True}),
  "ok": resolve_memory_edge({"source": "memory:a", "target": "memory:b", "type": "challenges", "nodded": True}),
  "hint": suggest_memory_edge("按第一性原理收决策写口", "按第一性原理收决策写口：页是台账"),
  "enrich": suggest_memory_edge("发版收敛到 macOS arm64", "macOS arm64 先验证安装"),
  "none": suggest_memory_edge("天气真好", "采购单过审"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.no_nod.error, 'NO_NOD')
  assert.equal(got.bad.error, 'NOT_A_CARD')
  assert.equal(got.ok.type, 'challenges')
  assert.equal(got.hint, 'confirms')
  assert.equal(got.enrich, 'enriches')
  assert.equal(got.none, '')
})

test('nod_memory_card needs a nod and cannot become 已生效', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from board import resolve_memory_nod
print(json.dumps({
  "no_id": resolve_memory_nod({}),
  "no_nod": resolve_memory_nod({"id": "memory:1"}),
  "live": resolve_memory_nod({"id": "memory:1", "nodded": True, "status": "已生效"}),
  "ok": resolve_memory_nod({"id": "memory:1", "nodded": True}),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.no_id.error, 'NO_PATH')
  assert.equal(got.no_nod.error, 'NO_NOD')
  assert.equal(got.live.error, 'NOT_A_BOARD')
  assert.equal(got.ok.status, '已入档')
})

test('retire 记忆卡片 needs a nod and is not 冲正', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from board import resolve_memory_retire
print(json.dumps({
  "no_nod": resolve_memory_retire({"id": "memory:1"}),
  "live": resolve_memory_retire({"id": "memory:1", "nodded": True, "status": "已生效"}),
  "ok": resolve_memory_retire({"id": "memory:1", "nodded": True}),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.no_nod.error, 'NO_NOD')
  assert.equal(got.live.error, 'NOT_A_BOARD')
  assert.equal(got.ok.status, '已入档')
})

test('expired 记忆卡片 is 当时 and cannot be 依据', () => {
  const out = py(`
import json, sys
from datetime import datetime, timezone
sys.path.insert(0, "python")
from board import may_cite, memory_still_counts
past = {"type": "记忆卡片", "properties": {"status": "已入档", "kind": "记忆卡片", "valid_until": "2020-01-01T00:00:00+00:00"}}
live = {"type": "记忆卡片", "properties": {"status": "已入档", "kind": "记忆卡片"}}
at = datetime(2026, 8, 28, tzinfo=timezone.utc)
print(json.dumps({
  "past": may_cite(past),
  "live": may_cite(live),
  "counts": memory_still_counts(past, at),
  "open": memory_still_counts(live, at),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.past, false)
  assert.equal(got.live, true)
  assert.equal(got.counts, false)
  assert.equal(got.open, true)
})

test('brief because does not take a 起草 记忆卡片', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from board import may_cite
print(json.dumps({
  "draft": may_cite({"type": "记忆卡片", "properties": {"status": "起草", "kind": "记忆卡片"}}),
  "nodded": may_cite({"type": "记忆卡片", "properties": {"status": "已入档", "kind": "记忆卡片"}}),
  "file": may_cite({"type": "Document", "id": "file:方案"}),
  "session": may_cite({"type": "Document", "id": "session:s1"}),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.draft, false)
  assert.equal(got.nodded, true)
  assert.equal(got.file, true)
  assert.equal(got.session, true)
})

test('brief because does not take a 起草 decision', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from board import may_cite
print(json.dumps({
  "live": may_cite({"type": "decision", "properties": {"status": "已生效"}}),
  "draft": may_cite({"type": "decision", "properties": {"status": "起草"}}),
  "file": may_cite({"type": "Document", "id": "file:方案"}),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.live, true)
  assert.equal(got.draft, false)
  assert.equal(got.file, true)
})

test('会签同意 cannot become 已生效', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from board import resolve_board
print(json.dumps({
  "consent": resolve_board({
    "status": "已生效",
    "nod_kind": "会签同意",
    "because": ["n1"],
    "leads_to": ["n2"],
    "receipt_id": "rcp-12",
  }),
  "post": resolve_board({
    "status": "已生效",
    "nod_kind": "业务过账",
    "because": ["n1"],
    "leads_to": ["n2"],
    "receipt_id": "rcp-12",
  }),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.consent.error, 'NOD_NOT_POSTING')
  assert.equal(got.post.status, '已生效')
  assert.equal(got.post.nod_kind, '业务过账')
})

test('已生效 without 业务过账 is refused', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from board import resolve_board
print(json.dumps(resolve_board({
  "status": "已生效",
  "because": ["n1"],
  "leads_to": ["n2"],
  "receipt_id": "rcp-12",
}), ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.error, 'NOD_NOT_POSTING')
})

test('same 追踪号 cannot record 已生效 twice', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from board import resolve_board
first = resolve_board({
  "status": "已生效",
  "nod_kind": "业务过账",
  "because": ["n1"],
  "leads_to": ["n2"],
  "receipt_id": "rcp-12",
  "trace_id": "tr-1",
})
second = resolve_board({
  "status": "已生效",
  "nod_kind": "业务过账",
  "because": ["n1"],
  "leads_to": ["n2"],
  "receipt_id": "rcp-13",
  "trace_id": "tr-1",
}, existing=[{"id": "dec-1", "status": "已生效", "trace_id": "tr-1"}])
print(json.dumps({"first": first, "second": second}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.first.status, '已生效')
  assert.equal(got.first.trace_id, 'tr-1')
  assert.equal(got.second.error, 'DUPLICATE_LIVE')
  assert.equal(got.second.decision_id, 'dec-1')
})

test('same 回执 cannot record 已生效 twice even without 追踪号', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from board import resolve_board
print(json.dumps(resolve_board({
  "status": "已生效",
  "nod_kind": "业务过账",
  "because": ["n1"],
  "leads_to": ["n2"],
  "receipt_id": "rcp-12",
}, existing=[{"id": "dec-9", "status": "已生效", "receipt_id": "rcp-12"}]), ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.error, 'DUPLICATE_LIVE')
  assert.equal(got.decision_id, 'dec-9')
})

test('graph facts are 当时, never 现在', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from board import then_label
print(json.dumps({
  "draft": then_label({"status": "起草", "valid_from": "2026-08-01T00:00:00Z"}),
  "live": then_label({"status": "已生效", "valid_from": "2026-08-01T00:00:00Z", "ticket": "PO-12"}),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.draft.now, false)
  assert.match(got.draft.label, /当时/)
  assert.equal(got.live.now, false)
  assert.match(got.live.label, /当时/)
  const undated = py(`
import json, sys
sys.path.insert(0, "python")
from board import then_label
print(json.dumps(then_label({"status": "起草"}), ensure_ascii=False))
`)
  const blank = JSON.parse(undated)
  assert.match(blank.label, /没有日期/)
  assert.equal(blank.undated, true)
})

test('Chinese scenario still recalls the same-kind 起草', () => {
  const out = py(`
import json, os, sys, tempfile
sys.path.insert(0, "python")
from semantica.context.context_graph import ContextGraph
from stores import write_primary
from bootstrap import run_query_decisions, run_find_precedents
home = tempfile.mkdtemp(); os.environ["DSH_HOME"] = home
cwd = tempfile.mkdtemp()
g = ContextGraph()
g.record_decision("product", "要不要只发青柠味", "r", "过账试探", 0.9, metadata={"status": "已生效"})
draft = g.record_decision("product", "按第一性原理收决策写口：页是台账", "r", "写口收紧", 0.9, metadata={"status": "起草", "decision_maker": "user"})
write_primary(g, cwd)
query = run_query_decisions(cwd, {"query": "按第一性原理继续处理决策写口"})
prec = run_find_precedents(cwd, {"scenario": "按第一性原理继续处理决策写口"})
print(json.dumps({
  "query": [r.get("decision_id") for r in query.get("decisions") or []],
  "prec": [r.get("decision_id") for r in prec.get("precedents") or []],
  "draft": draft,
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.ok(got.query.includes(got.draft))
  assert.equal(got.prec.includes(got.draft), false)
})

test('query_decisions recalls human 起草; find_precedents stays 已生效', () => {
  const out = py(`
import json, os, sys, tempfile
sys.path.insert(0, "python")
from unittest.mock import patch
from semantica.context.context_graph import ContextGraph
from stores import write_primary, insert_memory_card
from bootstrap import run_query_decisions, run_find_precedents, run_brief_for_decision
home = tempfile.mkdtemp(); os.environ["DSH_HOME"] = home
cwd = tempfile.mkdtemp()
g = ContextGraph()
live = g.record_decision("rel", "只发 darwin-arm64", "r", "只发", 0.9, metadata={"status": "已生效"})
draft = g.record_decision("rel", "只发 darwin-arm64", "r", "起草板", 0.9, metadata={"status": "起草", "decision_maker": "user"})
g.record_decision("rel", "只发 darwin-arm64", "r", "自动抠", 0.9, metadata={"status": "起草", "auto": True, "source": "session_ingest"})
g.record_decision("rel", "只发 darwin-arm64", "r", "废了", 0.9, metadata={"status": "作废"})
write_primary(g, cwd)
insert_memory_card(cwd, "memory:filed", "只发 darwin-arm64 先验证", {"status": "已入档", "kind": "记忆卡片"})
insert_memory_card(cwd, "memory:draft", "只发 darwin-arm64 草稿卡", {"status": "起草", "kind": "记忆卡片"})
query = run_query_decisions(cwd, {"query": "只发 darwin-arm64", "category": "rel"})
prec = run_find_precedents(cwd, {"scenario": "只发 darwin-arm64", "category": "rel"})
hits = {"results": [{"node": {"id": "session:s1", "type": "Document", "content": "要不要只发 darwin-arm64", "properties": {}}, "score": 90}]}
with patch("bootstrap.run_search_text", return_value=hits):
  brief = run_brief_for_decision(cwd, {"scenario": "只发 darwin-arm64", "category": "rel"})
print(json.dumps({
  "query": [r.get("decision_id") for r in query.get("decisions") or []],
  "prec": [r.get("decision_id") for r in prec.get("precedents") or []],
  "live": live, "draft": draft,
  "brief_prec": [r.get("id") for r in brief.get("precedents") or []],
  "brief_drafts": [r.get("id") for r in brief.get("drafts") or []],
  "options": [(r.get("kind"), r.get("label")) for r in brief.get("options") or []],
  "because": brief.get("because") or [],
  "ev": [r.get("id") for r in brief.get("evidence") or []],
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.ok(got.query.includes(got.live))
  assert.ok(got.query.includes(got.draft))
  assert.deepEqual(got.prec, [got.live])
  assert.deepEqual(got.brief_prec, [got.live])
  assert.deepEqual(got.brief_drafts, [got.draft])
  assert.equal(got.options.some((row) => row[0] === '已生效'), true)
  assert.equal(got.because.includes(got.draft), false)
  assert.ok(got.because.includes('memory:filed'))
  assert.equal(got.because.includes('memory:draft'), false)
  assert.ok(got.ev.includes('memory:filed'))
})

test('brief evidence skips vocab classes and does not put them in because', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_brief_for_decision
rows = [
  {"id": "memory:filed", "type": "记忆卡片", "content": "只发 darwin-arm64 先验证", "properties": {"status": "已入档", "kind": "记忆卡片"}},
]
hits = {"results": [
  {"node": {"id": "https://dsh.local/vocab/ws/x#attendance", "type": "owl:Class", "content": "考勤", "properties": {}}, "score": 90},
  {"node": {"id": "search_text", "type": "源码", "content": "search_text", "properties": {}}, "score": 88},
  {"node": {"id": "session:s1:3", "type": "Document", "content": "要不要只发 darwin-arm64", "properties": {}}, "score": 80},
]}
with patch("bootstrap.read_node_rows", return_value=(rows, {"ok": True})):
  with patch("bootstrap.run_search_text", return_value=hits):
    brief = run_brief_for_decision("/ws", {"scenario": "要不要只发 darwin-arm64"})
print(json.dumps({
  "ev": [r.get("id") for r in brief.get("evidence") or []],
  "because": brief.get("because") or [],
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.ev.includes('https://dsh.local/vocab/ws/x#attendance'), false)
  assert.equal(got.ev.includes('search_text'), false)
  assert.ok(got.ev.includes('session:s1:3'))
  assert.equal(got.because.includes('https://dsh.local/vocab/ws/x#attendance'), false)
  assert.ok(got.because.includes('session:s1:3'))
})

test('run_score_decisions only returns 已生效 and skips drafts', () => {
  const out = py(`
import json, os, sys, tempfile
sys.path.insert(0, "python")
from semantica.context.context_graph import ContextGraph
from stores import write_primary
from bootstrap import run_score_decisions
home = tempfile.mkdtemp(); os.environ["DSH_HOME"] = home
cwd = tempfile.mkdtemp()
g = ContextGraph()
live = g.record_decision("rel", "只发 darwin-arm64", "r", "只发", 0.9, metadata={"status": "已生效"})
g.record_decision("rel", "只发 darwin-arm64", "r", "起草板", 0.9, metadata={"status": "起草"})
write_primary(g, cwd)
got = run_score_decisions(cwd, {"scenario": "只发 darwin-arm64", "category": "rel"})
print(json.dumps({
  "ids": [r.get("decision_id") for r in got.get("precedents") or []],
  "n": len(got.get("precedents") or []),
  "live": live,
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.deepEqual(got.ids, [got.live])
  assert.equal(got.n, 1)
})

test('sidecar nod_memory_card refuses missing nod and 已生效', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../python/bootstrap.py', import.meta.url), 'utf8')
  const rec = (src.split('def run_nod_memory_card')[1] || '').split('def run_retire_memory_card')[0] || ''
  assert.match(rec, /resolve_memory_nod/)
  assert.match(rec, /"status": "已入档"/)
  assert.equal(rec.includes('已生效'), false)
})

test('sidecar record_decision refuses missing or ghost because', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../python/bootstrap.py', import.meta.url), 'utf8')
  const rec = src.split('if op == "record_decision":')[1] || ''
  assert.match(rec, /existing_because/)
  assert.match(rec, /return \{"error": "NO_BECAUSE"\}/)
  assert.match(rec, /existing_leads/)
})

test('decision page files a 记忆卡片 only with nodded true', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  assert.match(src, /MemoryHealth/)
  assert.equal(src.includes('semantic-os-inbox-cue'), false)
  assert.equal(src.includes("setDrawer('memory')"), false)
  assert.match(src, /function postSemantic/)
  assert.match(src, /memory.busy/)
  assert.match(src, /memory.retired/)
  assert.match(src, /semanticTabLabel/)
  assert.match(src, /function ensureCss/)
  assert.match(src, /style.textContent !== CSS/)
  assert.match(src, /function MemoryHealth/)
  assert.match(src, /postSemantic\('list_memory_cards'/)
  assert.match(src, /postSemantic\('nod_memory_card'/)
  assert.match(src, /postSemantic\('nod_memory_edge'/)
  assert.match(src, /postSemantic\('retire_memory_card'/)
  assert.match(src, /retire_group/)
  assert.match(src, /memory.retireGroup/)
  assert.match(src, /rowActions/)
  assert.match(src, /card.actions/)
  assert.match(src, /memory.noSource/)
  assert.match(src, /missing_source/)
  assert.match(src, /__dsosPrefix/)
  assert.match(src, /searchParams.set\('cwd'/)
  assert.match(src, /runOp/)
  assert.match(src, /source_memory_card/)
  assert.match(src, /renew_memory_card/)
  assert.match(src, /mute_health_kind/)
  assert.match(src, /postSemantic\('open_node'/)
  assert.match(src, /memory.open/)
  assert.match(src, /card.then && card.then.label/)
  assert.match(src, /setDrawer\('health'\)/)
  assert.match(src, /\/semantic-os\/api\/enrich\/merge/)
  assert.match(src, /\/semantic-os\/extract-session/)
  assert.match(src, /nodded: true/)
  assert.equal(src.includes("row.kind === '报告噪音'"), false)
  assert.equal(src.includes("row.kind === '超长会话'"), false)
  assert.equal(src.includes("row.kind === '重复'"), false)
  assert.match(src, /offset/)
  assert.match(src, /memory.healthHint/)
  assert.equal(src.includes('只读建议'), false)
  assert.match(src, /window.confirm\(t\('memory.retireGroup'\)\)/)
  assert.equal(src.includes("op: 'nod_memory_card'") && src.includes("status: '已生效'"), false)
})

test('open_node is a read-only host tool after 摘录', async () => {
  const { readFile } = await import('node:fs/promises')
  const tools = await readFile(new URL('../tools.js', import.meta.url), 'utf8')
  const gate = await readFile(new URL('../gate.js', import.meta.url), 'utf8')
  const host = await readFile(new URL('../index.js', import.meta.url), 'utf8')
  assert.match(tools, /name: 'open_node'/)
  assert.match(tools, /truncated=true means the archive is longer/)
  assert.match(tools, /READ_TOOLS.has\(spec.name\)/)
  assert.equal(/mutating = \[[^\]]*open_node/.test(tools), false)
  assert.match(gate, /open_node/)
  assert.match(host, /open_node\(id\)/)
})

test('list_memory_cards is a read-only host tool', async () => {
  const { readFile } = await import('node:fs/promises')
  const tools = await readFile(new URL('../tools.js', import.meta.url), 'utf8')
  const gate = await readFile(new URL('../gate.js', import.meta.url), 'utf8')
  const host = await readFile(new URL('../index.js', import.meta.url), 'utf8')
  assert.match(tools, /name: 'list_memory_cards'/)
  assert.match(tools, /offset/)
  assert.match(tools, /Draft cards are not 依据/)
  assert.match(tools, /READ_TOOLS.has\(spec.name\)/)
  assert.equal(/mutating = \[[^\]]*list_memory_cards/.test(tools), false)
  assert.match(gate, /list_memory_cards/)
  assert.match(host, /list_memory_cards before asking for a nod/)
})

test('tool descriptions name 已入档 cards in brief and do not auto-guess 挑战', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../tools.js', import.meta.url), 'utf8')
  assert.match(src, /still-counting 已入档 记忆卡片/)
  assert.match(src, /Draft 记忆卡片 are not 依据/)
  assert.match(src, /Show options, then wait/)
  assert.match(src, /Auto-suggest is confirms\/enriches only/)
  assert.match(src, /do not guess challenges or replaces/)
})

test('memory-guard names 决定不做 and restart, not leftover todos', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../docs/memory-guard.md', import.meta.url), 'utf8')
  assert.match(src, /决定不做/)
  assert.match(src, /选择题硬拦开口/)
  assert.match(src, /默认开 LLM 蒸馏/)
  assert.match(src, /决策页改成选择题/)
  assert.match(src, /人要做/)
  assert.match(src, /必须重启/)
  assert.match(src, /后台可抽起草卡/)
  assert.equal(src.includes('卫生与抽卡必须'), false)
})

test('host prompt names 记忆卡片 tools and keeps 超长会话 as archive', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../index.js', import.meta.url), 'utf8')
  const glossary = await readFile(new URL('../CONTEXT.md', import.meta.url), 'utf8')
  assert.match(src, /nod_memory_card/)
  assert.match(src, /retire_memory_card/)
  assert.match(src, /nod_memory_edge/)
  assert.match(src, /draft_memory_card/)
  assert.match(src, /cause=correction\|choice/)
  assert.match(src, /one cue one card/)
  assert.match(src, /Board, goal, and skill come after/)
  assert.match(src, /超长会话 is archive/)
  assert.match(src, /confirms\/enriches only/)
  assert.match(glossary, /\*\*梳理\*\*/)
  assert.match(glossary, /\*\*超长会话\*\*/)
  assert.match(glossary, /重叠即挑战/)
})

test('decision form does not use scenario text as because', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  assert.match(src, /decision\.form\.needBecause/)
  assert.equal(src.includes('form.scenario.trim().slice'), false)
  assert.match(src, /if \(!because\.length\)/)
})

test('causal edges skip missing ids instead of minting fake nodes', () => {
  const out = py(`
import json, sys
from types import SimpleNamespace
sys.path.insert(0, "python")
from bootstrap import attach_decision_causal_edges, get_node

class Graph:
  def __init__(self):
    self.nodes = {
      "d1": {"id": "d1", "type": "decision", "content": "板"},
      "n1": {"id": "n1", "type": "Document", "content": "依据"},
    }
    self.edges = {}
  def add_edge(self, src, tgt, edge_type=None, **props):
    self.edges[(src, tgt, edge_type)] = True
  def add_node(self, *args, **kwargs):
    raise AssertionError("must not mint a fake node")

g = Graph()
got = attach_decision_causal_edges(g, "d1", {"because": ["n1", "ghost"], "leads_to": ["also-ghost"]})
print(json.dumps({
  "supports": got.get("supports"),
  "leads_to": got.get("leads_to"),
  "skipped": got.get("skipped"),
  "ghost": get_node(g, "ghost") is not None,
  "also": get_node(g, "also-ghost") is not None,
  "linked": ("n1", "d1", "supports") in g.edges,
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.supports, 1)
  assert.equal(got.leads_to, 0)
  assert.equal(got.skipped, 2)
  assert.equal(got.ghost, false)
  assert.equal(got.also, false)
  assert.equal(got.linked, true)
})

test('temporal bounds do not push the playhead into tomorrow', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
from bootstrap import run_temporal_bounds
now = datetime.now(timezone.utc)
row = {
  "id": "n1",
  "type": "Entity",
  "valid_from": (now - timedelta(hours=2)).isoformat(),
  "properties": {"valid_from": (now - timedelta(hours=2)).isoformat()},
}
with patch("bootstrap.read_node_rows", return_value=([row], {"ok": True})):
  got = run_temporal_bounds("/ws", {})
print(json.dumps(got, default=str))
`)
  const got = JSON.parse(out)
  const max = Date.parse(got.max)
  assert.ok(Number.isFinite(max))
  assert.ok(max <= Date.now() + 60 * 1000, `max ${got.max} is in the future`)
})

test('then_label date is the host-local calendar day', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from datetime import datetime, timezone
from board import then_label
local = datetime(2026, 8, 23, 2, 0, 0).astimezone()
stored = local.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
got = then_label({"valid_from": stored})
print(json.dumps({
  "stored": stored,
  "want_date": local.date().isoformat(),
  "label": got["label"],
  "valid_from": got["valid_from"],
  "date_in_label": local.date().isoformat() in got["label"],
  "offset_not_z": "Z" not in str(got["valid_from"]).upper() or "+" in str(got["valid_from"]) or "-" in str(got["valid_from"])[10:],
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.date_in_label, true)
  assert.match(got.valid_from, /[+-]\d{2}:\d{2}$/)
  assert.ok(!got.valid_from.endsWith('Z'))
})
