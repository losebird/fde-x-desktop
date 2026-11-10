import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const native = readFileSync(join(root, 'python/native_entry.py'), 'utf8')
const boot = readFileSync(join(root, 'python/bootstrap.py'), 'utf8')
const tools = readFileSync(join(root, 'tools.js'), 'utf8')

const PRESENT = [
  'record_decision',
  'find_precedents',
  'get_causal_chain',
  'query_decisions',
  'analyze_decision_impact',
  'check_decision_rules',
]

test('sidecar already exposes Semantica record and query mouths', () => {
  for (const name of PRESENT) {
    assert.match(native, new RegExp(`"${name}"`))
    assert.match(tools, new RegExp(`name: '${name}'`))
  }
  assert.match(boot, /def run_find_precedents/)
  assert.match(boot, /def attach_decision_causal_edges/)
  assert.match(boot, /PRECEDENT_FOR/)
  assert.match(boot, /def persist_decision_board/)
})

test('official impact, rules, and per-board PROV mouths are sidecar ops', () => {
  assert.match(boot, /def run_analyze_decision_impact/)
  assert.match(boot, /def run_check_decision_rules/)
  assert.match(boot, /def run_decision_prov/)
  assert.match(boot, /elif op == "analyze_decision_impact"/)
  assert.match(boot, /elif op == "check_decision_rules"/)
  assert.match(boot, /elif op == "export_decision_prov"/)
  assert.match(native, /"analyze_decision_impact"/)
  assert.match(native, /"check_decision_rules"/)
  assert.match(boot, /elif op == "policy_check":/)
  assert.match(boot, /RULE_CONFLICT/)
  assert.match(boot, /prov:wasDerivedFrom/)
  assert.match(boot, /prov:wasGeneratedBy/)
})

test('whole-graph export still json/csv/rdf; per-board PROV uses lineage/export id', () => {
  assert.match(boot, /if fmt not in \{"json", "csv", "rdf"\}/)
  assert.match(boot, /def run_lineage/)
  assert.match(boot, /def run_decision_prov/)
})
