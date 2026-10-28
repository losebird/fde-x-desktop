import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import test from 'node:test'
import { groupSemanticHits } from '../session-find.js'
import { passageQueries } from '../session-corpus.js'

function pythonBin() {
  const bundled = new URL('../runtime-dist/darwin-arm64/python/bin/python3', import.meta.url).pathname
  return existsSync(bundled) ? bundled : 'python3'
}

function passages(query) {
  const r = spawnSync(pythonBin(), ['-c', `
import json, sys
sys.path.insert(0, "python")
from passages import search_passages, _load_store, passage_dir
cwd = ${JSON.stringify('/Users/zxz/Documents/ai-project/dsh-semantic-os')}
store = _load_store(passage_dir(cwd))
rows = search_passages(cwd, ${JSON.stringify(query)}, 16)
out = []
for row in rows:
    nid = row.get("id") or ""
    text = store.get(nid) or ""
    out.append({"id": nid, "text": text, "score": row.get("score")})
print(json.dumps(out, ensure_ascii=False))
`], {
    cwd: new URL('..', import.meta.url).pathname,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'python' },
    maxBuffer: 20 * 1024 * 1024,
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return JSON.parse(r.stdout)
}

function rankQuery(query) {
  const seen = new Set()
  const results = []
  for (const pq of passageQueries(query)) {
    for (const row of passages(pq)) {
      if (!row.id || seen.has(row.id)) continue
      seen.add(row.id)
      results.push({
        node: { id: row.id, content: row.text, valid_from: '2026-08-28T03:00:00Z' },
        score: Number(row.score || 0) * 100,
        via: 'faiss',
      })
    }
  }
  return groupSemanticHits({ query, results }, { query, list: { ids: [], byId: {} } })
}

const GOLD = ['34440', '36235', '99985']
const GOLD_SKIP = 'local gold corpus is not part of the 0.7.0 version bump'

test('G1 overlay ranks a gold 8/28 session first', { skip: GOLD_SKIP }, () => {
  const q = '还记得我们讨论过把语义插件做成和人类记忆一样吗'
  const got = rankQuery(q)
  assert.ok(got.items.length, 'semantic group empty')
  const top = got.items[0].id
  assert.equal(GOLD.some((g) => top.includes(g)), true, `top was ${top}`)
})

test('G3 语义助手还差哪些 hits 34440', { skip: GOLD_SKIP }, () => {
  const got = rankQuery('语义助手还差哪些')
  assert.ok(got.items[0].id.includes('34440'))
})

test('G2 人类记忆 is not 稀疏索引 and is non-empty', { skip: GOLD_SKIP }, () => {
  const got = rankQuery('人类记忆')
  assert.ok(got.items.length)
  assert.equal(/稀疏索引/.test(got.items[0].snippet || got.items[0].id), false)
})
