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

test('查询 / 出处 / 拍板 map onto existing tools', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from intent import route_intent
print(json.dumps({
  "query": route_intent("这个项目里 PO-12 后来怎么说的"),
  "source": route_intent("PO-12 出自哪次会话"),
  "board": route_intent("要不要过 PO-12"),
  "cards": route_intent("有哪些待审记忆"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.query.intent, '查询')
  assert.equal(got.query.tool, 'search_text')
  assert.equal(got.source.intent, '出处')
  assert.equal(got.source.tool, 'lineage')
  assert.equal(got.board.intent, '拍板')
  assert.equal(got.board.tool, 'brief_for_decision')
  assert.equal(got.cards.intent, '查询')
  assert.equal(got.cards.tool, 'list_memory_cards')
})

test('闲聊 does not search; 业务动作 and 催待办 stay on existing tools', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from intent import route_intent
print(json.dumps({
  "chat": route_intent("哈哈随便聊聊"),
  "act": route_intent("帮我把 PO-12 过账"),
  "nudge": route_intent("PO-12 还没过，催一下待办"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.chat.intent, '闲聊')
  assert.equal(got.chat.tool, '')
  assert.equal(got.act.intent, '业务动作')
  assert.equal(got.act.tool, 'brief_for_decision')
  assert.equal(got.nudge.intent, '催待办')
  assert.equal(got.nudge.tool, 'search_text')
})

test('asking what was already decided is 查询, not 拍板 or 业务动作', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from intent import route_intent
print(json.dumps({
  "recall": route_intent("这个项目里上次是怎么定的"),
  "which": route_intent("之前定了哪些事情"),
  "probe": route_intent("过账试探当时怎么记的"),
  "board": route_intent("要不要现在做意图分类"),
  "act": route_intent("帮我把 PO-12 过账"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.recall.intent, '查询')
  assert.equal(got.recall.tool, 'search_text')
  assert.equal(got.which.intent, '查询')
  assert.equal(got.probe.intent, '查询')
  assert.equal(got.board.intent, '拍板')
  assert.equal(got.act.intent, '业务动作')
})

test('route_intent is a fast read and does not search', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from bootstrap import is_fast_read_op, run_tool
print(is_fast_read_op("route_intent"))
print(json.dumps(run_tool("route_intent", "/tmp", {"text": "PO-12 出自哪次会话"}), ensure_ascii=False))
`)
  const [flag, body] = out.split('\n')
  assert.equal(flag, 'True')
  const got = JSON.parse(body)
  assert.equal(got.intent, '出处')
  assert.equal(got.tool, 'lineage')
})