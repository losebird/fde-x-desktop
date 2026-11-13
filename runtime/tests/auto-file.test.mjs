import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileLowRiskDrafts, isLowRiskAutoFile } from '../memory/auto-file.mjs'
import { draftCard } from '../memory/draft.mjs'

test('index cards and process rules auto-file; conflicts and stops do not', () => {
  assert.equal(isLowRiskAutoFile({
    origin: 'session:s1',
    label: '规则：PO-20261112 案卷\n怎么知道：memory:a\n陷阱：键对不上就停\n未证实：待审不是依据',
  }), true)
  assert.equal(isLowRiskAutoFile({
    origin: 'session:s1',
    label: '规则：目录已对齐。按现况重核。\n怎么知道：session:s1\n陷阱：无\n未证实：继续处理',
  }), true)
  assert.equal(isLowRiskAutoFile({
    origin: 'session:s1',
    label: '规则：现况未读到该采购单，未放行，不过账。\n怎么知道：session:s1\n陷阱：无\n未证实：继续处理',
  }), false)
  assert.equal(isLowRiskAutoFile({
    origin: 'session:s1',
    label: '规则：出处与卡片不一致；以出处为准。\n怎么知道：session:s1 ；旧卡 memory:x\n陷阱：卡写未读到\n未证实：待现查',
  }), false)
  assert.equal(isLowRiskAutoFile({
    origin: 'biz:trace_1',
    label: '规则：目录已对齐。\n怎么知道：session:s1',
  }), false)
  assert.equal(isLowRiskAutoFile({
    label: '规则：回扫升格探针\n怎么知道：session:session-abc\n陷阱：无\n未证实：x',
  }), true)
})

test('draftCard nods low-risk labels and leaves high-risk as 起草', async () => {
  const calls = []
  const aiRuntime = {
    status: () => ({ connected: true }),
    semanticOs: async (_path, options) => {
      calls.push(options)
      if (options.op === 'add_node') return { id: options.args.id }
      if (options.op === 'nod_memory_card') return { ok: true, id: options.args.id, status: '已入档' }
      if (options.op === 'index_passages') return { ok: true }
      return { ok: true }
    },
  }
  const filed = await draftCard({ aiRuntime }, {
    cwd: '/tmp/ws',
    origin: 'session:s1',
    label: '规则：目录已对齐。按现况重核。\n怎么知道：session:s1\n陷阱：无\n未证实：继续处理',
  })
  assert.equal(filed.autoFiled, true)
  assert.equal(filed.card.status, '已入档')
  assert.equal(calls.some((row) => row.op === 'nod_memory_card' && row.args.nodded === true), true)

  const held = await draftCard({ aiRuntime }, {
    cwd: '/tmp/ws',
    origin: 'session:s1',
    label: '规则：现况未读到该采购单，未放行。\n怎么知道：session:s1\n陷阱：无\n未证实：继续处理',
  })
  assert.equal(held.autoFiled, undefined)
  assert.equal(held.card.status, '起草')
})

test('fileLowRiskDrafts nods low-risk drafts and skips stops', async () => {
  const nods = []
  const aiRuntime = {
    status: () => ({ connected: true }),
    semanticOs: async (_path, options) => {
      if (options.op === 'list_memory_cards') {
        return {
          cards: [
            {
              id: 'memory:low',
              status: '起草',
              origin: 'session:s1',
              body: '规则：目录已对齐。\n怎么知道：session:s1\n陷阱：无\n未证实：x',
            },
            {
              id: 'memory:stop',
              status: '起草',
              origin: 'session:s1',
              body: '规则：现况未读到该采购单，未放行。\n怎么知道：session:s1\n陷阱：无\n未证实：x',
            },
            {
              id: 'memory:filed',
              status: '已入档',
              origin: 'session:s1',
              body: '规则：目录已对齐。\n怎么知道：session:s1',
            },
          ],
        }
      }
      if (options.op === 'nod_memory_card') {
        nods.push(options.args.id)
        return { ok: true, id: options.args.id, status: '已入档' }
      }
      return { ok: true }
    },
  }
  const got = await fileLowRiskDrafts({ aiRuntime }, { cwd: '/tmp/ws' })
  assert.deepEqual(got.filed, ['memory:low'])
  assert.deepEqual(nods, ['memory:low'])
  assert.equal(got.ok, true)
})
