import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROOFREAD_KIND,
  formatProofreadDraft,
  proofreadConflict,
  proofreadIssue,
  scanProofreadIssues,
} from '../memory/dream-proofread.mjs'

test('conflict when card denies and origin revises the key', () => {
  const reason = proofreadConflict(
    '规则：现况未读到该采购单，未放行',
    '单号格式不对，库里是 PO20250407926，不是连字符那条',
  )
  assert.match(reason, /改口径/)
})

test('conflict when card denies and origin has a hit', () => {
  const reason = proofreadConflict('现况未读到该采购单', 'biz_preview 命中 1 条记录')
  assert.match(reason, /命中/)
})

test('no conflict when origin also denies', () => {
  assert.equal(proofreadConflict('现况未读到该采购单', 'NOT_FOUND 未读到该采购单'), '')
})

test('self draft does not re-enter', () => {
  assert.equal(proofreadConflict('规则：出处与卡片不一致；以出处为准', '库里是连字符'), '')
})

test('issue is 起草 suggestion with 取代 type, original id unchanged', () => {
  const issue = proofreadIssue(
    {
      id: 'memory:old',
      status: '已入档',
      origin: 'session:session-abc',
      body: '规则：现况未读到该采购单\n怎么知道：session:session-abc',
    },
    { text: '应为无连字符，库里是 PO20250407926' },
  )
  assert.equal(issue.kind, PROOFREAD_KIND)
  assert.equal(issue.id, 'memory:old')
  assert.equal(issue.type, 'replaces')
  assert.deepEqual(issue.actions.map((row) => row.op), ['open', 'correct'])
  assert.match(issue.draft, /规则：出处与卡片不一致/)
  assert.match(issue.draft, /怎么知道：session:session-abc/)
  assert.match(issue.draft, /旧卡 memory:old/)
  assert.match(issue.draft, /未证实：待现查/)
})

test('scanProofreadIssues loads origin and caps', async () => {
  const calls = []
  const issues = await scanProofreadIssues(
    [
      { id: 'memory:a', origin: 'session:s1', body: '现况未读到该采购单' },
      { id: 'memory:b', origin: 'session:s1', body: '天气真好这一句足够长' },
    ],
    async (origin) => {
      calls.push(origin)
      return { text: '库里是 PO20250407926，单号无连字符' }
    },
  )
  assert.equal(calls.length, 2)
  assert.equal(issues.length, 1)
  assert.equal(issues[0].id, 'memory:a')
})

test('formatProofreadDraft keeps four sections', () => {
  const draft = formatProofreadDraft({
    cardId: 'memory:x',
    origin: 'file:docs/a.md',
    cardText: '未读到该采购单',
    reason: '卡写未读到，出处在改口径（格式/单号）',
  })
  assert.match(draft, /^规则：/m)
  assert.match(draft, /怎么知道：file:docs\/a.md/)
  assert.match(draft, /陷阱：/)
  assert.match(draft, /未证实：/)
})
