import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadSpokenSeed,
  speechHasConnectorWrite,
  writeActionSaysFromSpoken,
} from '../vendor-overlays/dsh-lan-assist/live-write-intent.mjs'
import {
  flipFirstTurn,
  needsSearch,
  routeIntent,
} from '../vendor-overlays/dsh-semantic-os/first-turn.js'

const overlayRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor-overlays')

test('spoken seed write says exclude 现查 and include connector writes', () => {
  const spoken = loadSpokenSeed()
  const says = writeActionSaysFromSpoken(spoken)
  assert.ok(says.length > 0)
  assert.equal(says.includes('查询'), false)
  assert.equal(says.includes('查一下'), false)
  assert.ok(says.some((say) => say.length > 1))
  assert.equal(speechHasConnectorWrite('随便看看目录', spoken), false)
})

test('JS routeIntent keeps memory query, source, board, and chat', () => {
  assert.deepEqual(routeIntent('这个项目里上次怎么定的'), { intent: '查询', tool: 'search_text' })
  assert.deepEqual(routeIntent('PO-12 出自哪次会话'), { intent: '出处', tool: 'lineage' })
  assert.deepEqual(routeIntent('要不要过 PO-12'), { intent: '拍板', tool: 'brief_for_decision' })
  assert.deepEqual(routeIntent('帮我把 PO-12 过账'), { intent: '业务动作', tool: 'brief_for_decision' })
  assert.deepEqual(routeIntent('哈哈随便聊聊'), { intent: '闲聊', tool: '' })
  assert.deepEqual(routeIntent('有哪些待审记忆'), { intent: '查询', tool: 'list_memory_cards' })
  assert.equal(routeIntent('还有哪些待审回款？把备注改成催收').tool, 'biz_preview')
  assert.equal(routeIntent('还有哪些待审回款？把备注改成催收').intent, '现况')
  assert.equal(routeIntent('把状态写成成交').tool, 'biz_preview')
  assert.equal(routeIntent('待审回款挂在哪些合同上？把已到期的那些摊出来。').tool, 'biz_preview')
  assert.equal(routeIntent('待审回款挂在哪些合同上？把已到期的那些摊出来。').intent, '现况')
  assert.deepEqual(routeIntent('聊聊看看'), { intent: '闲聊', tool: '' })
  assert.equal(routeIntent('有哪些待办').tool, 'biz_preview')
  assert.equal(routeIntent('发给我那份纪要').tool, 'search_text')
  assert.equal(routeIntent('看一下纪要').tool, 'search_text')
  assert.deepEqual(routeIntent('PO-12 还没过，催一下待办'), { intent: '催待办', tool: 'search_text' })
  assert.deepEqual(routeIntent('过账试探当时怎么记的'), { intent: '查询', tool: 'search_text' })
})

test('JS routeIntent sends connector write speech to biz_preview', () => {
  const spoken = loadSpokenSeed()
  const writes = writeActionSaysFromSpoken(spoken)
  assert.ok(writes.length > 0)
  const sample = writes[0]
  const got = routeIntent(`请把那张单${sample}`)
  assert.equal(got.intent, '现况')
  assert.equal(got.tool, 'biz_preview')
  assert.equal(needsSearch(got.intent), false)
})

test('first-turn flip does not search the graph for connector writes', async () => {
  let searched = 0
  const flipped = await flipFirstTurn({
    text: `请把那张单${writeActionSaysFromSpoken(loadSpokenSeed())[0]}`,
    search: async () => {
      searched += 1
      return { results: [{ node: { id: 'x', content: 'should not run' } }] }
    },
  })
  assert.equal(flipped.tool, 'biz_preview')
  assert.equal(searched, 0)
  assert.deepEqual(flipped.hits, [])
})

test('first-turn flip still searches for memory query', async () => {
  let searched = 0
  const flipped = await flipFirstTurn({
    text: '这个项目里上次怎么定的',
    search: async () => {
      searched += 1
      return { results: [{ node: { id: 's1', content: '当时那句' } }] }
    },
  })
  assert.equal(flipped.tool, 'search_text')
  assert.equal(searched, 1)
  assert.equal(flipped.hits.length, 1)
})

test('python route_intent matches JS for write vs memory', () => {
  const spoken = loadSpokenSeed()
  const sample = writeActionSaysFromSpoken(spoken)[0]
  const py = join(overlayRoot, 'dsh-semantic-os', 'python')
  const code = `
import json, sys
sys.path.insert(0, ${JSON.stringify(py)})
from intent import route_intent
print(json.dumps({
  "write": route_intent(${JSON.stringify(`请把那张单${sample}`)}),
  "rewrite": route_intent("把状态写成成交"),
  "memory": route_intent("这个项目里上次怎么定的"),
  "board": route_intent("要不要过 PO-12"),
  "post": route_intent("帮我把 PO-12 过账"),
  "source": route_intent("PO-12 出自哪次会话"),
}, ensure_ascii=False))
`
  const r = spawnSync('python3', ['-c', code], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  const got = JSON.parse(r.stdout)
  assert.equal(got.write.intent, '现况')
  assert.equal(got.write.tool, 'biz_preview')
  assert.equal(got.rewrite.intent, '现况')
  assert.equal(got.rewrite.tool, 'biz_preview')
  assert.equal(got.memory.tool, 'search_text')
  assert.equal(got.board.tool, 'brief_for_decision')
  assert.equal(got.post.tool, 'brief_for_decision')
  assert.equal(got.source.tool, 'lineage')
})

test('board speech still wins when it also contains a write say', () => {
  assert.deepEqual(routeIntent('要不要过一下'), { intent: '拍板', tool: 'brief_for_decision' })
})

test('list-only 现查 speech goes to biz_preview', () => {
  const got = routeIntent('这个项目里有哪些结论')
  assert.equal(got.intent, '现况')
  assert.equal(got.tool, 'biz_preview')
})

test('prompt and tool schema tell the model to follow biz_preview', () => {
  const index = readFileSync(join(overlayRoot, 'dsh-semantic-os', 'index.js'), 'utf8')
  const tools = readFileSync(join(overlayRoot, 'dsh-semantic-os', 'tools.js'), 'utf8')
  assert.match(index, /现况 → biz_preview/)
  assert.doesNotMatch(index, /call route_intent first/)
  assert.match(tools, /现况 → biz_preview/)
  assert.match(tools, /name: 'route_intent'/)
})

test('python write says come from spoken.json, not a local list', () => {
  const intent = readFileSync(join(overlayRoot, 'dsh-semantic-os', 'python', 'intent.py'), 'utf8')
  assert.match(intent, /spoken\.json/)
  assert.match(intent, /dsh-lan-assist/)
  assert.match(intent, /_speech_holds_workstation_write/)
  assert.match(intent, /_rewrite_has_value/)
  assert.doesNotMatch(intent, /_connector_write_says/)
  assert.doesNotMatch(intent, /过审.*biz_preview/)
  const first = readFileSync(join(overlayRoot, 'dsh-semantic-os', 'first-turn.js'), 'utf8')
  assert.match(first, /speechHoldsWorkstationWrite/)
  assert.match(first, /speechHasSpokenRole/)
  assert.doesNotMatch(first, /待审记忆/)
  assert.doesNotMatch(first, /有哪些待审/)
  assert.doesNotMatch(first, /SEARCH_INTENTS = new Set\(\['查询', '出处', '业务动作'/)
})
