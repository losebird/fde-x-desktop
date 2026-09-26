import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_DSH_HOME } from '../config.mjs'

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'biz-query-settle-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })

const { createGate } = await import(pathToFileURL(join(staged, 'write.js')).href)
const { speakLookup, speakObjectSetTotal } = await import(pathToFileURL(join(staged, 'probe.js')).href)
const { materializeSettledRepeat, previewSettledLookup, settledHopKey } = await import(pathToFileURL(join(staged, 'query-settle.mjs')).href)
const { createSessionRoundStore } = await import(pathToFileURL(join(staged, 'session-round.js')).href)

const hopVocab = [
  {
    kind: 'ParentA',
    resource: 'parent_a',
    can: ['现查'],
    relations: [{ from: 'ParentA', to: 'ChildB', field: 'parentRef' }],
    clues: [{ say: ['expired'], keys: ['status'], values: ['expired'] }],
  },
  {
    kind: 'ChildB',
    resource: 'child_b',
    can: ['现查', '过审'],
    clues: [{ say: ['pending'], keys: ['status'], values: ['pending'] }],
  },
]

const speech = 'pending ChildB ∩ expired ParentA'
const parentRows = Array.from({ length: 25 }, (_, i) => {
  const id = `p${i + 1}`
  const status = i < 20 ? 'expired' : 'active'
  return { no: `PA-${i + 1}`, status, fields: { id, status, code: `PA-${i + 1}` } }
})
const childRows = [
  { no: 'CB-HIT', status: 'pending', fields: { id: 'c-hit', status: 'pending', parentRefId: 'p3', code: 'CB-HIT' } },
]

function termHit(row, term) {
  const keys = Array.isArray(term.keys) ? term.keys : []
  const values = (Array.isArray(term.values) ? term.values : []).map(String)
  if (!keys.length || !values.length) return true
  const fields = row.fields && typeof row.fields === 'object' ? row.fields : {}
  const hit = keys.some((key) => values.includes(String(fields[key] ?? row[key] ?? '')))
  return term.not ? !hit : hit
}

function applyWhere(rows, where) {
  if (!Array.isArray(where) || !where.length) return rows
  return rows.filter((row) => where.every((term) => termHit(row, term)))
}

function lookupTodo(spec) {
  const kind = String(spec.kind || '')
  let rows = kind === 'ParentA' ? parentRows : kind === 'ChildB' ? childRows : []
  const relatedIds = spec.related && Array.isArray(spec.related.ids) ? spec.related.ids.map(String) : []
  if (relatedIds.length) {
    const field = String(spec.related.field || 'parentRefId')
    const idSet = new Set(relatedIds)
    rows = rows.filter((row) => idSet.has(String(row.fields[field] || row.fields.id || '')))
  }
  rows = applyWhere(rows, spec.where)
  if (!rows.length) return { ok: false, error: 'NOT_FOUND', matches: [], hitTotal: 0, hitTotalState: 'known' }
  return {
    ok: true,
    matches: rows,
    hitTotal: rows.length,
    hitTotalState: 'known',
    no: rows[0].no,
    status: rows[0].status,
    fields: rows[0].fields,
  }
}

function gate() {
  return createGate({ vocab: hopVocab, lookupTodo })
}

test('speakObjectSetTotal uses hitTotal not page rows', () => {
  assert.equal(
    speakObjectSetTotal({ hitTotalState: 'known', hitTotal: 21 }, 20),
    '共 21 条，本页 20 条。',
  )
  assert.match(
    speakLookup({ kind: 'ChildB' }, {
      ok: true,
      status: 'pending',
      matches: Array.from({ length: 20 }, (_, i) => ({ no: `R${i}`, status: 'pending' })),
      listed: true,
      hitTotalState: 'known',
      hitTotal: 21,
    }),
    /共 21 条，本页 20 条/,
  )
  assert.match(
    speakLookup({ kind: 'ChildB' }, { ok: false, error: 'NOT_FOUND', hitTotalState: 'known', hitTotal: 0, pageRows: 0 }),
    /共 0 条，本页 0 条/,
  )
})

test('settled hop blocks a second identical 现查 in the same session', async () => {
  const g = gate()
  const body = {
    workspace: '/tmp/settle-ws',
    sessionId: 'sess-settle-a',
    kind: 'ChildB',
    action: '现查',
    speech,
  }
  const first = await g.preview(body)
  assert.equal(first.ok, true)
  assert.ok(previewSettledLookup(first))
  assert.match(String(first.speak || ''), /共 \d+ 条，本页/)
  const second = await g.preview({ ...body })
  assert.equal(second.error, 'QUERY_SETTLED')
  assert.equal(second.querySettledRepeat, true)
  assert.match(String(second.speak || ''), /已结算/)
  const sheet = second.sheet && typeof second.sheet === 'object' ? second.sheet : second
  assert.equal(sheet.kind, 'ChildB')
})

test('next page and write preview are not blocked by settled 现查', async () => {
  const g = gate()
  const base = {
    workspace: '/tmp/settle-ws',
    sessionId: 'sess-settle-b',
    kind: 'ChildB',
    speech,
  }
  const first = await g.preview({ ...base, action: '现查' })
  assert.equal(first.ok, true)
  const page2 = await g.preview({ ...base, action: '现查', page: 2 })
  assert.notEqual(page2.error, 'QUERY_SETTLED')
  const approve = await g.preview({ ...base, action: '过审', speech: `${speech} 过一下` })
  assert.notEqual(approve.error, 'QUERY_SETTLED')
  assert.ok(String(approve.preview_id || approve.sheet?.preview_id || '').startsWith('pv_'))
})

test('different hop bind key allows another 现查', async () => {
  const g = gate()
  const sessionId = 'sess-settle-c'
  const first = await g.preview({
    workspace: '/tmp/settle-ws',
    sessionId,
    kind: 'ChildB',
    action: '现查',
    speech,
  })
  assert.equal(first.ok, true)
  const otherSpeech = 'pending ChildB only'
  const keyA = settledHopKey({
    sessionId,
    workspace: '/tmp/settle-ws',
    speech,
    plan: { speech, steps: first.sheet?.steps, targetIndex: 0, page: 1 },
    spec: {},
    targetKind: 'ChildB',
  })
  const keyB = settledHopKey({
    sessionId,
    workspace: '/tmp/settle-ws',
    speech: otherSpeech,
    plan: { speech: otherSpeech, steps: [{ kind: 'ChildB', where: [{ keys: ['status'], values: ['pending'] }] }], targetIndex: 0, page: 1 },
    spec: {},
    targetKind: 'ChildB',
  })
  assert.notEqual(keyA, keyB)
  const again = await g.preview({
    workspace: '/tmp/settle-ws',
    sessionId,
    kind: 'ChildB',
    action: '现查',
    speech: otherSpeech,
  })
  assert.notEqual(again.error, 'QUERY_SETTLED')
})

function sheetOfPreview(result) {
  return result.sheet && typeof result.sheet === 'object' ? result.sheet : result
}

test('QUERY_SETTLED repeat preview is plugin-leftover; page/write/bind are not', async () => {
  const g = gate()
  const rounds = createSessionRoundStore()
  const sessionId = 'sess-settle-leftover'
  const base = {
    workspace: '/tmp/settle-ws',
    sessionId,
    kind: 'ChildB',
    speech,
  }
  rounds.startRound(sessionId)
  const first = await g.preview({ ...base, action: '现查' })
  assert.equal(first.ok, true)
  rounds.noteToolSheet(sessionId, sheetOfPreview(first))
  const second = await g.preview({ ...base, action: '现查' })
  const repeatSheet = {
    ...sheetOfPreview(second),
    querySettledRepeat: second.querySettledRepeat,
    error: second.error,
  }
  const leftover = rounds.noteToolSheet(sessionId, repeatSheet)
  assert.equal(leftover.cancel, true)
  assert.equal(leftover.leftover, true)
  assert.equal(leftover.cancelKind, 'plugin-leftover')

  const roundsPage = createSessionRoundStore()
  roundsPage.startRound('sess-page')
  const settled = await g.preview({ ...base, sessionId: 'sess-page', action: '现查' })
  roundsPage.noteToolSheet('sess-page', sheetOfPreview(settled))
  const page2 = await g.preview({ ...base, sessionId: 'sess-page', action: '现查', page: 2 })
  const pageOutcome = roundsPage.noteToolSheet('sess-page', sheetOfPreview(page2))
  assert.notEqual(pageOutcome.cancel, true)

  const roundsWrite = createSessionRoundStore()
  roundsWrite.startRound('sess-write')
  const settledW = await g.preview({ ...base, sessionId: 'sess-write', action: '现查' })
  roundsWrite.noteToolSheet('sess-write', sheetOfPreview(settledW))
  const approve = await g.preview({
    ...base,
    sessionId: 'sess-write',
    action: '过审',
    speech: `${speech} 过一下`,
  })
  const writeOutcome = roundsWrite.noteToolSheet('sess-write', sheetOfPreview(approve))
  assert.notEqual(writeOutcome.cancel, true)
})

test('settled 现查 then search_text on same hop is plugin-leftover', async () => {
  const g = gate()
  const rounds = createSessionRoundStore()
  const sessionId = 'sess-settle-search'
  rounds.startRound(sessionId)
  const first = await g.preview({
    workspace: '/tmp/settle-ws',
    sessionId,
    kind: 'ChildB',
    action: '现查',
    speech,
  })
  rounds.noteToolSheet(sessionId, sheetOfPreview(first))
  const searchLeft = rounds.notePostSettledHopTool(sessionId, 'search_text')
  assert.equal(searchLeft.cancel, true)
  assert.equal(searchLeft.cancelKind, 'plugin-leftover')
})

test('columnMiss and bare askAction do not settle; same speech ignores plan where shape in hop key', () => {
  assert.equal(previewSettledLookup({
    ok: true,
    action: '现查',
    querySettled: true,
    rows: [{ no: 'R1' }],
    where: [{ keys: ['status'], values: ['pending'] }],
    columnMiss: true,
  }), false)
  assert.equal(previewSettledLookup({
    ok: true,
    action: '现查',
    querySettled: true,
    askAction: '改还是查',
    rows: [],
  }), false)
  const sessionId = 'sess-where-fix'
  const keyA = settledHopKey({
    sessionId,
    workspace: '/tmp/settle-ws',
    speech,
    plan: {
      speech,
      steps: [{ kind: 'ChildB', where: [{ keys: ['status'], values: ['pending'] }] }],
      targetIndex: 0,
      page: 1,
    },
    spec: {},
    targetKind: 'ChildB',
  })
  const keyB = settledHopKey({
    sessionId,
    workspace: '/tmp/settle-ws',
    speech,
    plan: {
      speech,
      steps: [{ kind: 'ChildB', where: [{ keys: ['status'], values: ['active'] }] }],
      targetIndex: 0,
      page: 1,
    },
    spec: { from: { kind: 'ParentA', where: [{ keys: ['status'], values: ['expired'] }] } },
    targetKind: 'ChildB',
  })
  assert.equal(keyA, keyB)
})

test('settled hop key uses user utterance not model speech suffix', async () => {
  const g = gate()
  const sessionId = 'sess-speech-suffix'
  const base = {
    workspace: '/tmp/settle-ws',
    sessionId,
    kind: 'ChildB',
    action: '现查',
    speech,
    userSpeech: speech,
  }
  const first = await g.preview({ ...base })
  assert.equal(first.ok, true)
  assert.ok(previewSettledLookup(first))
  const garbled = `${speech} TK-FAKE-999`
  const keyUser = settledHopKey({
    sessionId,
    workspace: '/tmp/settle-ws',
    userSpeech: speech,
    speech: garbled,
    plan: { speech: garbled, page: 1 },
    spec: {},
    targetKind: 'ChildB',
  })
  const keyPlain = settledHopKey({
    sessionId,
    workspace: '/tmp/settle-ws',
    userSpeech: speech,
    speech,
    plan: { speech, page: 1 },
    spec: {},
    targetKind: 'ChildB',
  })
  assert.equal(keyUser, keyPlain)
  const second = await g.preview({ ...base, speech: garbled })
  assert.equal(second.error, 'QUERY_SETTLED')
  assert.equal(second.querySettledRepeat, true)

  const rounds = createSessionRoundStore()
  rounds.startRound(sessionId)
  rounds.noteToolSheet(sessionId, sheetOfPreview(first))
  const third = await g.preview({ ...base, speech: garbled })
  const repeatSheet = {
    ...sheetOfPreview(third),
    querySettledRepeat: third.querySettledRepeat,
    error: third.error,
  }
  const leftover = rounds.noteToolSheet(sessionId, repeatSheet)
  assert.equal(leftover.cancel, true)
  assert.ok(leftover.settledRepeatFrom)
  assert.equal(materializeSettledRepeat(leftover.settledRepeatFrom).error, 'QUERY_SETTLED')
  assert.equal(third.error, 'QUERY_SETTLED')
  assert.notEqual(String(third.speak || ''), '')
})

test('repeat 现查 after ok table: model from/where shape changes still QUERY_SETTLED', async () => {
  const g = gate()
  const sessionId = 'sess-from-shape'
  const base = {
    workspace: '/tmp/settle-ws',
    sessionId,
    kind: 'ChildB',
    action: '现查',
    speech,
  }
  const first = await g.preview({
    ...base,
    from: { kind: 'ParentA', where: [{ keys: ['status'], values: ['expired', 'inactive'] }] },
  })
  assert.equal(first.ok, true)
  assert.ok(previewSettledLookup(first))

  const second = await g.preview({
    ...base,
    from: { kind: 'ParentA', where: [{ keys: ['status'], values: ['expired'] }] },
  })
  assert.equal(second.error, 'QUERY_SETTLED')
  assert.equal(second.querySettledRepeat, true)

  const third = await g.preview({ ...base })
  assert.equal(third.error, 'QUERY_SETTLED')
  assert.equal(third.querySettledRepeat, true)

  const fourth = await g.preview({ ...base })
  assert.equal(fourth.error, 'QUERY_SETTLED')
  assert.match(String(fourth.speak || ''), /已结算|共 \d+ 条/)
})

test('WHERE_UNBOUND and replay results do not count as settled', async () => {
  assert.equal(previewSettledLookup({ ok: false, error: 'WHERE_UNBOUND' }), false)
  const g = gate()
  const replay = await g.preview({
    workspace: '/tmp/settle-ws',
    sessionId: 'sess-replay',
    kind: 'ChildB',
    action: '现查',
    speech,
    replay: true,
    steps: [{ kind: 'ChildB', where: [{ keys: ['status'], values: ['pending'] }] }],
  })
  assert.equal(replay.ok, true)
  const again = await g.preview({
    workspace: '/tmp/settle-ws',
    sessionId: 'sess-replay',
    kind: 'ChildB',
    action: '现查',
    speech,
    replay: true,
    steps: [{ kind: 'ChildB', where: [{ keys: ['status'], values: ['pending'] }] }],
  })
  assert.notEqual(again.error, 'QUERY_SETTLED')
})
