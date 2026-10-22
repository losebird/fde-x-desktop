import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const py = join(dirname(fileURLToPath(new URL('.', import.meta.url))), 'python')

test('downstream of a board is leads_to only, not drafts that cited it as because', () => {
  const script = [
    'import json,sys',
    `sys.path.insert(0, ${JSON.stringify(py)})`,
    'from bootstrap import walk_causal_chain',
    'class G:',
    '    def __init__(self):',
    '        self.nodes = {',
    '            "board": {"id": "board", "type": "decision", "content": "板"},',
    '            "ev": {"id": "ev", "type": "Document", "content": "依据"},',
    '            "out": {"id": "out", "type": "Entity", "content": "后果"},',
    '            "draft": {"id": "draft", "type": "decision", "content": "起草"},',
    '        }',
    '        self.edges = [',
    '            {"source": "ev", "target": "board", "type": "supports"},',
    '            {"source": "board", "target": "out", "type": "leads_to"},',
    '            {"source": "board", "target": "draft", "type": "supports"},',
    '        ]',
    'g = G()',
    'down = walk_causal_chain(g, "board", "downstream", 3)',
    'up = walk_causal_chain(g, "board", "upstream", 3)',
    'print(json.dumps({"down": [r["id"] for r in down], "up": [r["id"] for r in up]}))',
  ].join('\n')
  const got = JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
  assert.deepEqual(got.down, ['out'])
  assert.deepEqual(got.up, ['ev'])
})

test('decision used as because is PRECEDENT_FOR not supports-as-consequence', () => {
  const script = [
    'import json,sys',
    `sys.path.insert(0, ${JSON.stringify(py)})`,
    'from bootstrap import attach_decision_causal_edges',
    'class G:',
    '    def __init__(self):',
    '        self.nodes = {',
    '            "board": {"id": "board", "type": "decision", "content": "已生效"},',
    '            "draft": {"id": "draft", "type": "decision", "content": "起草"},',
    '            "note": {"id": "note", "type": "Document", "content": "依据"},',
    '        }',
    '        self.edges = []',
    '    def add_edge(self, src, tgt, edge_type="related_to", **_):',
    '        self.edges.append({"source": src, "target": tgt, "type": edge_type})',
    '        return True',
    'g = G()',
    'attach_decision_causal_edges(g, "draft", {"because": ["board", "note"], "leads_to": []})',
    'print(json.dumps(g.edges, ensure_ascii=False))',
  ].join('\n')
  const edges = JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
  const types = Object.fromEntries(edges.map((e) => [e.source + '>' + e.target, e.type]))
  assert.equal(types['board>draft'], 'PRECEDENT_FOR')
  assert.equal(types['note>draft'], 'supports')
})
