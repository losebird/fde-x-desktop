import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const python = process.env.DSH_RUNTIME_PYTHON || process.env.DSH_SEMANTICA_PYTHON || 'python3'

function py(code) {
  const r = spawnSync(python, ['-c', code], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: join(root, 'python') },
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}

test('empty rules allow; talking tools are not the gate', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'fde-di-rules-empty-'))
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from bootstrap import run_check_decision_rules, is_fast_read_op
cwd = ${JSON.stringify(cwd)}
got = run_check_decision_rules(cwd, {"category": "rel", "outcome": "通过", "confidence": 0.2})
print(json.dumps({
  "allowed": got.get("allowed"),
  "conflicts": got.get("conflicts"),
  "error": got.get("error"),
  "fast": is_fast_read_op("check_decision_rules"),
  "fast_search": is_fast_read_op("search_text"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.ok(!got.error)
  assert.equal(got.allowed, true)
  assert.deepEqual(got.conflicts, [])
  assert.equal(got.fast, true)
  assert.equal(got.fast_search, true)
})

test('forbidden outcome conflicts and record_decision does not write', () => {
  const out = py(`
import json, os, sys, tempfile
from pathlib import Path
sys.path.insert(0, "python")
from semantica.context.context_graph import ContextGraph
from stores import write_primary
from bootstrap import run_check_decision_rules, run_tool, run_query_decisions
home = tempfile.mkdtemp(); os.environ["DSH_HOME"] = home
cwd = tempfile.mkdtemp()
g = ContextGraph()
write_primary(g, cwd)
rules_dir = Path(cwd) / ".dsh" / "semantic-os"
rules_dir.mkdir(parents=True, exist_ok=True)
(rules_dir / "decision-rules.json").write_text(json.dumps({"forbidden_outcomes": ["禁止"]}), encoding="utf-8")
preview = run_check_decision_rules(cwd, {"outcome": "禁止", "category": "rel", "confidence": 0.9, "reasoning": "r", "scenario": "s"})
blocked = run_tool("record_decision", cwd, {
  "category": "rel",
  "scenario": "要不要禁止",
  "reasoning": "规则闸探测",
  "outcome": "禁止",
  "confidence": 0.9,
  "session_id": "sess-rules-block",
  "decision_maker": "user",
})
allowed = run_tool("record_decision", cwd, {
  "category": "rel",
  "scenario": "要不要通过",
  "reasoning": "规则闸探测",
  "outcome": "通过",
  "confidence": 0.9,
  "session_id": "sess-rules-ok",
  "decision_maker": "user",
})
listed = run_query_decisions(cwd, {"query": "规则闸探测", "limit": 10})
ids = [r.get("decision_id") for r in listed.get("decisions") or []]
print(json.dumps({
  "preview_allowed": preview.get("allowed"),
  "preview_conflicts": preview.get("conflicts"),
  "blocked_error": blocked.get("error"),
  "blocked_conflicts": blocked.get("conflicts"),
  "allowed_id": allowed.get("decision_id"),
  "allowed_error": allowed.get("error"),
  "ids": ids,
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.preview_allowed, false)
  assert.ok((got.preview_conflicts || []).some((row) => String(row).includes('禁止')))
  assert.equal(got.blocked_error, 'RULE_CONFLICT')
  assert.ok(!got.blocked_conflicts || got.blocked_conflicts.length >= 1)
  assert.ok(got.allowed_id)
  assert.ok(!got.allowed_error)
  assert.ok(got.ids.includes(got.allowed_id))
  assert.equal(got.ids.includes(null), false)
})

test('session tool exposes check_decision_rules; search_text stays ungated by RULE_CONFLICT', () => {
  const tools = readFileSync(join(root, 'tools.js'), 'utf8')
  const skill = readFileSync(join(root, 'skills/project-memory/SKILL.md'), 'utf8')
  const first = readFileSync(join(root, 'first-turn.js'), 'utf8')
  assert.match(tools, /name: 'check_decision_rules'/)
  assert.match(tools, /only block record_decision/)
  assert.match(skill, /RULE_CONFLICT/)
  assert.match(skill, /never block talking/)
  assert.match(first, /search_text/)
  assert.doesNotMatch(first, /check_decision_rules/)
})
