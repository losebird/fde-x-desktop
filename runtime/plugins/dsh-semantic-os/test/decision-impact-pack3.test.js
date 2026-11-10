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

test('empty graph analyze_decision_impact returns empty lists, not errors', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'fde-di-impact-empty-'))
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from bootstrap import run_analyze_decision_impact, is_fast_read_op
cwd = ${JSON.stringify(cwd)}
got = run_analyze_decision_impact(cwd, {"decision_id": "decision:missing"})
print(json.dumps({
  "ok": got.get("ok"),
  "error": got.get("error"),
  "influenced": got.get("influenced"),
  "downstream": got.get("downstream"),
  "total": got.get("total_influenced"),
  "fast": is_fast_read_op("analyze_decision_impact"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.ok(!got.error)
  assert.equal(got.ok, true)
  assert.deepEqual(got.influenced, [])
  assert.deepEqual(got.downstream, [])
  assert.equal(got.total, 0)
  assert.equal(got.fast, true)
})

test('CAUSED downstream boards appear in analyze_decision_impact', () => {
  const out = py(`
import json, os, sys, tempfile
sys.path.insert(0, "python")
from semantica.context.context_graph import ContextGraph
from stores import write_primary
from bootstrap import run_analyze_decision_impact
home = tempfile.mkdtemp(); os.environ["DSH_HOME"] = home
cwd = tempfile.mkdtemp()
g = ContextGraph()
first = g.record_decision("rel", "只发 darwin-arm64", "先例", "只发", 0.9, metadata={"status": "已生效"})
second = g.record_decision("rel", "沿用只发", "跟着先例", "仍只发", 0.9, metadata={"status": "已生效"})
g.add_causal_relationship(first, second, "CAUSED")
write_primary(g, cwd)
got = run_analyze_decision_impact(cwd, {"decision_id": first})
ids = [r.get("decision_id") or r.get("id") for r in got.get("influenced") or []]
down = [r.get("id") for r in got.get("downstream") or []]
print(json.dumps({
  "first": first, "second": second,
  "ids": ids, "down": down,
  "total": got.get("total_influenced"),
  "error": got.get("error"),
  "ok": got.get("ok"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.ok(!got.error)
  assert.equal(got.ok, true)
  assert.ok(got.ids.includes(got.second) || got.down.includes(got.second), JSON.stringify(got))
})

test('session tool and REST sit beside chain, not a new page', () => {
  const tools = readFileSync(join(root, 'tools.js'), 'utf8')
  const product = readFileSync(join(root, 'product.js'), 'utf8')
  const skill = readFileSync(join(root, 'skills/project-memory/SKILL.md'), 'utf8')
  assert.match(tools, /name: 'analyze_decision_impact'/)
  assert.match(tools, /analyze_decision_impact/)
  assert.match(product, /pathname.endsWith\('\/impact'\)/)
  assert.match(product, /op: 'analyze_decision_impact'/)
  assert.match(skill, /analyze_decision_impact/)
  assert.equal(product.includes('src/pages/'), false)
})
