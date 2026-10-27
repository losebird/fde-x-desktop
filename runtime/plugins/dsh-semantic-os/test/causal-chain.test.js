import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const py = join(dirname(fileURLToPath(new URL('.', import.meta.url))), 'python')
const python = process.env.DSH_RUNTIME_PYTHON || process.env.DSH_SEMANTICA_PYTHON || 'python3'

test('downstream of a board is native CAUSED, not drafts that cited it as because', () => {
  const script = [
    'import json,sys',
    `sys.path.insert(0, ${JSON.stringify(py)})`,
    'from semantica.context.context_graph import ContextGraph',
    'from bootstrap import pack_causal_chain, attach_decision_causal_edges',
    'g = ContextGraph()',
    'board = g.record_decision("rel", "板", "r", "板", 0.9, metadata={"status": "已生效"})',
    'follow = g.record_decision("rel", "企业版涨价百分之五", "r", "涨", 0.9, metadata={"status": "已生效"})',
    'draft = g.record_decision("rel", "起草", "r", "起草", 0.9, metadata={"status": "起草"})',
    'g.add_node("ev", "Document", content="依据")',
    'g.add_node("out", "Entity", content="后果")',
    'g.add_edge("ev", board, "supports")',
    'g.add_edge(board, "out", "leads_to")',
    'g.add_causal_relationship(board, follow, "CAUSED")',
    'down = pack_causal_chain(g, board, "downstream", 3)',
    'print(json.dumps({"down": [r["id"] for r in down], "follow": follow, "draft": draft}))',
  ].join('\n')
  const got = JSON.parse(execFileSync(python, ['-c', script], { encoding: 'utf8' }))
  assert.deepEqual(got.down, [got.follow])
  assert.equal(got.down.includes(got.draft), false)
})

test('decision used as because is PRECEDENT_FOR not supports-as-consequence', () => {
  const script = [
    'import json,sys',
    `sys.path.insert(0, ${JSON.stringify(py)})`,
    'from semantica.context.context_graph import ContextGraph',
    'from bootstrap import attach_decision_causal_edges',
    'g = ContextGraph()',
    'board = g.record_decision("rel", "已生效", "r", "过", 0.9, metadata={"status": "已生效"})',
    'draft = g.record_decision("rel", "起草", "r", "草", 0.9, metadata={"status": "起草"})',
    'g.add_node("note", "Document", content="依据")',
    'attach_decision_causal_edges(g, draft, {"because": [board, "note"], "leads_to": []})',
    'edges = []',
    'for e in g.edges:',
    '    src = getattr(e, "source_id", None) or (e.get("source") if isinstance(e, dict) else "")',
    '    tgt = getattr(e, "target_id", None) or (e.get("target") if isinstance(e, dict) else "")',
    '    et = getattr(e, "edge_type", None) or (e.get("type") if isinstance(e, dict) else "")',
    '    edges.append({"source": src, "target": tgt, "type": et})',
    'print(json.dumps({"edges": edges, "board": board, "draft": draft}))',
  ].join('\n')
  const got = JSON.parse(execFileSync(python, ['-c', script], { encoding: 'utf8' }))
  const types = Object.fromEntries(got.edges.map((e) => [e.source + '>' + e.target, e.type]))
  assert.equal(types[got.board + '>' + got.draft], 'PRECEDENT_FOR')
  assert.equal(types['note>' + got.draft], 'supports')
})
