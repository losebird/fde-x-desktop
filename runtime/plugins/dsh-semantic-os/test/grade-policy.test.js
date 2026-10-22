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

test('envelope body is not extracted unless nodded', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from grade import may_extract
print(json.dumps({
  "closed": may_extract({"kind": "信封", "text": "请林督过 PO-12，金额 12800"}),
  "open": may_extract({"kind": "信封", "text": "请林督过 PO-12", "nodded": True}),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.closed.ok, false)
  assert.equal(got.closed.error, 'ENVELOPE_CLOSED')
  assert.equal(got.open.ok, true)
})

test('board text drops 手机号, 账号 and 金额明细', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from grade import scrub_text
print(json.dumps(scrub_text("请过 PO-12，电话 13812345678，账号 6222021234567890123，金额 12800.50 元"), ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.match(got, /PO-12/)
  assert.doesNotMatch(got, /13812345678/)
  assert.doesNotMatch(got, /6222021234567890123/)
  assert.doesNotMatch(got, /12800/)
})

test('search hits also drop 人身信息', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from grade import scrub_hit
print(json.dumps(scrub_hit({
  "node": {"id": "session:s1:1", "content": "电话 13900001111 过 PO-12", "properties": {"content": "电话 13900001111 过 PO-12"}},
}), ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.match(JSON.stringify(got), /PO-12/)
  assert.doesNotMatch(JSON.stringify(got), /13900001111/)
})

test('scrub_text leaves text without digits unchanged', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from grade import scrub_text
print(json.dumps(scrub_text("上次灰度回滚用了脚本"), ensure_ascii=False))
`)
  assert.equal(JSON.parse(out), '上次灰度回滚用了脚本')
})

test('extract_entities refuses a closed 信封', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from bootstrap import run_tool
print(json.dumps(run_tool("extract_entities", "/tmp", {
  "kind": "信封",
  "text": "请林督过 PO-12，电话 13800001111",
}), ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.error, 'ENVELOPE_CLOSED')
  assert.deepEqual(got.entities, [])
})

test('quoted 信封 body is closed even without kind', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from grade import may_extract
print(json.dumps({
  "quote": may_extract({"text": "【信封】请林督过采购单 PO-12，金额未传"}),
  "chat": may_extract({"text": "我们定了只发 darwin-arm64"}),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.quote.ok, false)
  assert.equal(got.quote.error, 'ENVELOPE_CLOSED')
  assert.equal(got.chat.ok, true)
})
