import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('.', import.meta.url)))
const py = join(root, 'python')

function writeGraph(cwd, nodes) {
  const dir = join(cwd, '.dsh', 'semantic-os')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'graph.json'), JSON.stringify({
    nodes: nodes.map((row) => ({
      id: row.id,
      type: row.type || 'Document',
      content: row.content,
      properties: { content: row.content },
    })),
    edges: [],
  }))
}

test('search_text stays local unless across_bridges is on', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsos-bridge-search-'))
  const local = join(home, 'local')
  const peer = join(home, 'peer')
  try {
    writeGraph(local, [{ id: 'session:here:1', content: '本区只谈 falkordb 修复' }])
    writeGraph(peer, [{ id: 'session:there:1', content: '对面秘书配对用六位码' }])
    mkdirSync(join(home, 'semantic-os', 'bridge'), { recursive: true })
    writeFileSync(join(home, 'semantic-os', 'bridge', 'index.json'), JSON.stringify({
      protocol: 1,
      links: [{ sourceCwd: local, targetCwd: peer, sourceNode: 'a', targetNode: 'b' }],
    }))
    const script = [
      'import json,sys',
      `sys.path.insert(0, ${JSON.stringify(py)})`,
      'from bootstrap import run_search_text',
      `local=${JSON.stringify(local)}`,
      'only=run_search_text(local, {"q":"六位码"})',
      'both=run_search_text(local, {"q":"六位码","across_bridges":True})',
      'print(json.dumps({"local":only,"both":both}, ensure_ascii=False))',
    ].join('\n')
    const raw = execFileSync('python3', ['-c', script], {
      env: { ...process.env, DSH_HOME: home },
      encoding: 'utf8',
    })
    const data = JSON.parse(raw)
    assert.equal(data.local.total, 0)
    assert.equal(data.local.bridge_hits || 0, 0)
    assert.ok(data.both.total >= 1)
    assert.equal(data.both.bridge_hits, 1)
    assert.equal(data.both.results[0].via, 'bridge')
    assert.ok(String(data.both.results[0].node.id).startsWith('session:'))
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
