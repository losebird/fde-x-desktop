import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const python = process.env.DSH_RUNTIME_PYTHON || process.env.DSH_SEMANTICA_PYTHON || 'python3'

function py(code, cwd = root) {
  const r = spawnSync(python, ['-c', code], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: join(root, 'python') },
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}

test('empty graph query mouths return empty lists, not errors', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'fde-di-empty-'))
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from bootstrap import run_query_decisions, run_find_precedents, run_get_causal_chain, is_fast_read_op
cwd = ${JSON.stringify(cwd)}
query = run_query_decisions(cwd, {"query": "要不要只发 darwin-arm64"})
prec = run_find_precedents(cwd, {"scenario": "要不要只发 darwin-arm64"})
chain = run_get_causal_chain(cwd, {"decision_id": "decision:missing"})
print(json.dumps({
  "query": query,
  "prec": prec,
  "chain": chain,
  "fast": [is_fast_read_op("query_decisions"), is_fast_read_op("find_precedents"), is_fast_read_op("get_causal_chain")],
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.ok(!got.query.error)
  assert.deepEqual(got.query.decisions, [])
  assert.deepEqual(got.query.precedents, [])
  assert.ok(!got.prec.error)
  assert.deepEqual(got.prec.precedents, [])
  assert.ok(!got.chain.error)
  assert.deepEqual(got.chain.chain, [])
  assert.deepEqual(got.fast, [true, true, true])
})

test('recorded board is findable via query, precedents, and causal chain', () => {
  const out = py(`
import json, os, sys, tempfile
sys.path.insert(0, "python")
from semantica.context.context_graph import ContextGraph
from stores import write_primary
from bootstrap import run_query_decisions, run_find_precedents, run_get_causal_chain, attach_decision_causal_edges
home = tempfile.mkdtemp(); os.environ["DSH_HOME"] = home
cwd = tempfile.mkdtemp()
g = ContextGraph()
first = g.record_decision("rel", "要不要只发 darwin-arm64", "先例理由", "只发", 0.9, metadata={"status": "已生效"})
second = g.record_decision("rel", "还要不要只发 darwin-arm64", "沿用先例", "仍只发", 0.9, metadata={"status": "已生效"})
attach_decision_causal_edges(g, second, {"because": [first], "leads_to": []})
write_primary(g, cwd)
query = run_query_decisions(cwd, {"query": "只发 darwin-arm64", "category": "rel"})
prec = run_find_precedents(cwd, {"scenario": "要不要只发 darwin-arm64", "category": "rel"})
up = run_get_causal_chain(cwd, {"decision_id": second, "direction": "upstream"})
print(json.dumps({
  "first": first, "second": second,
  "query": [r.get("decision_id") for r in query.get("decisions") or []],
  "prec": [r.get("decision_id") for r in prec.get("precedents") or []],
  "up": [r.get("id") for r in up.get("chain") or []],
  "query_err": query.get("error"),
  "prec_err": prec.get("error"),
  "chain_err": up.get("error"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.ok(!got.query_err)
  assert.ok(!got.prec_err)
  assert.ok(!got.chain_err)
  assert.ok(got.query.includes(got.first))
  assert.ok(got.query.includes(got.second))
  assert.ok(got.prec.includes(got.first) || got.prec.includes(got.second))
  assert.ok(got.up.includes(got.first))
})

test('session tools and 拍板 route expose the three Query mouths', () => {
  const tools = readFileSync(join(root, 'tools.js'), 'utf8')
  const skill = readFileSync(join(root, 'skills/project-memory/SKILL.md'), 'utf8')
  const first = readFileSync(join(root, 'first-turn.js'), 'utf8')
  const intent = readFileSync(join(root, 'python/intent.py'), 'utf8')
  for (const name of ['query_decisions', 'find_precedents', 'get_causal_chain']) {
    assert.match(tools, new RegExp(`name: '${name}'`))
  }
  assert.match(tools, /拍板 → find_precedents/)
  assert.match(first, /intent: '拍板', tool: 'find_precedents'/)
  assert.match(intent, /"tool": "find_precedents"/)
  assert.match(skill, /call `find_precedents` first/)
})
