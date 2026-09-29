import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_DSH_HOME } from '../config.mjs'
import { createSessionRoundStore } from '../vendor-overlays/dsh-lan-assist/session-round.js'
import {
  previewTokenIndex,
  projectWriteConfirm,
  releaseEmittedConfirm,
  writeTokenStatus,
} from '../biz/write-confirm.mjs'
import {
  shouldOpenWriteConfirm,
  writeTokenLive,
  writeTokenStatus as sheetWriteTokenStatus,
} from '../../src/lib/write-confirm.ts'

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'lan-assist-confirm-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })
const { createGate } = await import(pathToFileURL(join(staged, 'write.js')).href)
const { createGate: createOpening, voidUnusedTokens } = await import(pathToFileURL(join(staged, 'gate.js')).href)

const kind = 'KindW'
const vocab = [{
  kind,
  resource: 'kind_w',
  can: ['现查', '新建', '改行', '删除', '过审'],
  clues: [{ say: ['新增一笔', '新增'], keys: ['action'], values: ['新建'] }],
}]

function openSheet(extra = {}) {
  return {
    kind,
    action: '新建',
    preview_id: 'pv-open',
    canWrite: true,
    rows: [{ no: '新单', fields: { title: '甲' } }],
    changes: [{ field: 'title', to: '甲' }],
    ...extra,
  }
}

test('drawer opens only while the write token is unused', () => {
  const live = openSheet()
  assert.equal(shouldOpenWriteConfirm(live, { dismissed: false, hasChanges: true, alreadyAtTarget: false }), true)
  assert.equal(shouldOpenWriteConfirm({ ...live, writeToken: 'open' }, { dismissed: false, hasChanges: true, alreadyAtTarget: false }), true)
  for (const writeToken of ['used', 'expired', 'absent']) {
    assert.equal(
      shouldOpenWriteConfirm({ ...live, writeToken, canWrite: true }, { dismissed: false, hasChanges: true, alreadyAtTarget: false }),
      false,
      writeToken,
    )
  }
  assert.equal(shouldOpenWriteConfirm({ ...live, action: '现查', canWrite: false }, { dismissed: false, hasChanges: false, alreadyAtTarget: false }), false)
  assert.equal(shouldOpenWriteConfirm(live, { dismissed: true, hasChanges: true, alreadyAtTarget: false }), false)
  assert.equal(
    shouldOpenWriteConfirm({ ...live, canWrite: false, changes: [] }, { dismissed: false, hasChanges: false, alreadyAtTarget: true }),
    true,
  )
  assert.equal(
    shouldOpenWriteConfirm({ ...live, canWrite: false }, { dismissed: false, hasChanges: true, alreadyAtTarget: false }),
    true,
  )
  assert.equal(sheetWriteTokenStatus(live), 'live')
  assert.equal(writeTokenLive(live, { 'pv-open': 'used' }), false)
  assert.equal(
    shouldOpenWriteConfirm(live, { dismissed: false, hasChanges: true, alreadyAtTarget: false, tokenIndex: { 'pv-open': 'used' } }),
    false,
  )
})

test('write success rereads written identity 现查 and does not keep the write preview as official', async () => {
  const rows = [
    { no: 'ROW-1', status: 'open', fields: { id: '1', status: 'open', title: '甲' } },
  ]
  const g = createGate({
    vocab,
    lookupTodo(spec) {
      const no = String((spec && spec.no) || '').trim()
      if (no && no !== 'ROW-1') return { ok: false, error: 'NOT_FOUND', matches: [] }
      return { ok: true, matches: rows, hitTotal: 1, hitTotalState: 'known', no: 'ROW-1', status: 'open', fields: rows[0].fields }
    },
    collectionsOf: async () => [{ name: 'kind_w', title: kind }],
    async fieldsOf() {
      return [{ name: 'status', title: '状态', enums: { open: 'open', done: 'done' } }, { name: 'title', title: '标题' }]
    },
    postWrite: async () => ({ ok: true, receiptId: 'rcpt-1', no: 'ROW-1' }),
  })
  const previewed = await g.preview({
    workspace: '/tmp/write-reread-ws',
    kind,
    action: '新建',
    patch: { title: '甲' },
    speech: '新建一笔',
    userSpeech: '新建一笔',
  })
  const previewId = String(previewed.preview_id || previewed.sheet?.preview_id || '')
  assert.ok(previewId)
  const written = await g.write({ preview_id: previewId, workspace: '/tmp/write-reread-ws' })
  assert.equal(written.ok, true)
  const listed = written.sheet && typeof written.sheet === 'object' ? written.sheet : null
  assert.ok(listed)
  assert.equal(listed.action, '现查')
  assert.equal(listed.canWrite, false)
  assert.ok(!listed.preview_id)
  assert.equal(listed.lookupNo, 'ROW-1')
  assert.equal(listed.querySettled, true)
})

test('post-write identity 现查 ignores listBind where that no longer matches', async () => {
  const before = {
    no: 'LV-1',
    status: 'pending',
    fields: { id: '1', status: 'pending', code: 'LV-1', reason: 'maternity' },
  }
  const after = {
    no: 'LV-1',
    status: 'approved',
    fields: { id: '1', status: 'approved', code: 'LV-1', reason: 'maternity' },
  }
  let phase = 'preview'
  const g = createGate({
    vocab,
    lookupTodo(spec) {
      const no = String((spec && spec.no) || '').trim()
      const where = Array.isArray(spec && spec.where) ? spec.where : []
      const wantsPending = where.some((term) => {
        const values = Array.isArray(term && term.values) ? term.values.map(String) : []
        return values.includes('pending') || values.includes('待审')
      })
      const row = phase === 'preview' ? before : after
      if (wantsPending && phase !== 'preview') {
        return { ok: true, matches: [], hitTotal: 0, hitTotalState: 'known', no: '', status: '', fields: {} }
      }
      if (no && no !== 'LV-1') return { ok: false, error: 'NOT_FOUND', matches: [] }
      return {
        ok: true,
        matches: [row],
        hitTotal: 1,
        hitTotalState: 'known',
        no: 'LV-1',
        status: row.status,
        fields: row.fields,
      }
    },
    collectionsOf: async () => [{ name: 'kind_w', title: kind }],
    async fieldsOf() {
      return [
        { name: 'status', title: '状态', enums: { pending: '待审', approved: '已通过' } },
        { name: 'code', title: '单号' },
      ]
    },
    postWrite: async () => {
      phase = 'written'
      return { ok: true, receiptId: 'rcpt-lv', no: 'LV-1' }
    },
  })
  const previewed = await g.preview({
    workspace: '/tmp/write-identity-ws',
    kind,
    action: '过审',
    no: 'LV-1',
    to: 'approved',
    where: [{ keys: ['status'], values: ['pending', '待审'] }],
    speech: '待审产假过一下',
    userSpeech: '待审产假过一下',
  })
  const previewId = String(previewed.preview_id || previewed.sheet?.preview_id || '')
  assert.ok(previewId)
  const written = await g.write({ preview_id: previewId, workspace: '/tmp/write-identity-ws' })
  assert.equal(written.ok, true)
  const sheet = written.sheet && typeof written.sheet === 'object' ? written.sheet : null
  assert.ok(sheet)
  assert.equal(sheet.action, '现查')
  assert.equal(sheet.lookupNo, 'LV-1')
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  assert.equal(rows.length, 1)
  assert.equal(rows[0].no, 'LV-1')
  assert.equal(String(rows[0].status || rows[0].fields?.status || ''), 'approved')
})

test('0-row identity 现查 keeps the write receipt instead of an empty official', async () => {
  const row = {
    no: 'GONE-1',
    status: 'open',
    fields: { id: 'g1', status: 'open', code: 'GONE-1', title: '甲' },
  }
  let phase = 'preview'
  const g = createGate({
    vocab,
    lookupTodo(spec) {
      const no = String((spec && spec.no) || '').trim()
      if (phase === 'written') {
        return { ok: true, matches: [], hitTotal: 0, hitTotalState: 'known', no: '', status: '', fields: {} }
      }
      if (no && no !== 'GONE-1') return { ok: false, error: 'NOT_FOUND', matches: [] }
      return { ok: true, matches: [row], hitTotal: 1, hitTotalState: 'known', no: 'GONE-1', status: 'open', fields: row.fields }
    },
    collectionsOf: async () => [{ name: 'kind_w', title: kind }],
    async fieldsOf() {
      return [{ name: 'status', title: '状态', enums: { open: 'open', done: 'done' } }, { name: 'title', title: '标题' }]
    },
    postWrite: async () => {
      phase = 'written'
      return { ok: true, receiptId: 'rcpt-gone', no: 'GONE-1' }
    },
  })
  const previewed = await g.preview({
    workspace: '/tmp/write-empty-id-ws',
    kind,
    action: '改行',
    no: 'GONE-1',
    patch: { title: '乙' },
    speech: '改标题',
    userSpeech: '改标题',
  })
  const previewId = String(previewed.preview_id || previewed.sheet?.preview_id || '')
  assert.ok(previewId)
  const written = await g.write({ preview_id: previewId, workspace: '/tmp/write-empty-id-ws' })
  assert.equal(written.ok, true)
  assert.equal(written.receiptId, 'rcpt-gone')
  assert.equal(written.sheet, undefined)
})

test('dismissed write token cannot be confirmed again', async () => {
  const g = createGate({
    vocab,
    lookupTodo() {
      return { ok: true, matches: [], no: '', status: '', fields: {} }
    },
    fieldsOf: async () => [{ name: 'title', title: '标题' }],
  })
  const minted = await g.preview({
    kind,
    action: '新建',
    patch: { title: '甲' },
    speech: '新建一笔',
    workspace: '/tmp/confirm-ws',
  })
  const previewId = String(minted.preview_id || '')
  assert.ok(previewId)
  voidUnusedTokens(g.tokens, [previewId])
  const written = await g.write({ preview_id: previewId, workspace: '/tmp/confirm-ws' })
  assert.equal(written.ok, false)
  assert.equal(written.error, 'USED')
})

test('write success drops canWrite from the reconnect picture', () => {
  const picture = openSheet({ sessionId: 'sess-a', rows: [{ no: 'ROW-1' }] })
  const released = releaseEmittedConfirm(picture)
  assert.equal(released.canWrite, false)
  assert.equal(released.can_write, false)
  assert.equal(released.writeToken, 'used')
  assert.equal(released.rows[0].no, 'ROW-1')
  assert.equal(released.preview_id, 'pv-open')
  assert.equal(shouldOpenWriteConfirm(released, { dismissed: false, hasChanges: true, alreadyAtTarget: false }), false)

  const index = { 'pv-open': 'used', 'pv-live': 'open', 'pv-old': 'expired' }
  const fromGet = projectWriteConfirm(picture, index)
  assert.equal(fromGet.canWrite, false)
  assert.equal(fromGet.writeToken, 'used')
  assert.equal(fromGet.rows[0].no, 'ROW-1')
  const stillLive = projectWriteConfirm({ ...picture, preview_id: 'pv-live' }, index)
  assert.equal(stillLive.canWrite, true)
  assert.equal(stillLive.writeToken, 'open')
  const expired = projectWriteConfirm({ ...picture, preview_id: 'pv-old' }, index)
  assert.equal(expired.writeToken, 'expired')
  assert.equal(expired.canWrite, false)
  const gone = projectWriteConfirm({ ...picture, preview_id: 'pv-missing' }, index)
  assert.equal(gone.canWrite, true)
  assert.equal(gone.writeToken, undefined)
  const lookup = projectWriteConfirm({ ...picture, action: '现查', preview_id: 'pv-open', canWrite: false }, index)
  assert.equal(lookup.action, '现查')
  assert.equal(lookup.writeToken, undefined)
})

test('token index reports open, used, and expired', () => {
  const nowMs = 1_000
  const tokens = new Map([
    ['pv-open', { used: false, expiresAt: 5_000 }],
    ['pv-used', { used: true, expiresAt: 5_000 }],
    ['pv-dead', { used: false, expiresAt: 500 }],
  ])
  assert.equal(writeTokenStatus(tokens.get('pv-open'), nowMs), 'open')
  assert.equal(writeTokenStatus(tokens.get('pv-used'), nowMs), 'used')
  assert.equal(writeTokenStatus(tokens.get('pv-dead'), nowMs), 'expired')
  assert.equal(writeTokenStatus(null, nowMs), 'absent')
  assert.deepEqual(previewTokenIndex(tokens, nowMs), {
    'pv-open': 'open',
    'pv-used': 'used',
    'pv-dead': 'expired',
  })
})

test('successful post voids sibling tokens from the same opening', () => {
  const tokens = new Map([
    ['pv-lead', { used: true, expiresAt: 9_000 }],
    ['pv-sib', { used: false, expiresAt: 9_000 }],
  ])
  voidUnusedTokens(tokens, ['pv-lead', 'pv-sib'])
  assert.equal(tokens.get('pv-lead').used, true)
  assert.equal(tokens.get('pv-sib').used, true)
  assert.equal(previewTokenIndex(tokens, 1)['pv-sib'], 'used')
})

test('wrote follow-up lookup stays a lookup and does not mint a write token', async () => {
  const speech = '新增一笔 KindW'
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.closeRound('sess-a', 'wrote')
  assert.equal(rounds.isWroteFollowup('sess-a'), true)
  const prev = rounds.peek('sess-a')
  const followup = Boolean(prev && !prev.open && prev.closedBy === 'wrote' && prev.wroteFollowup)
  rounds.startRound('sess-a', { followup })
  assert.equal(rounds.isWroteFollowup('sess-a'), true)
  rounds.noteHumanUtterance('sess-a')
  assert.equal(rounds.isWroteFollowup('sess-a'), false)

  let lookups = 0
  const gate = createGate({
    vocab,
    fieldsOf: async () => [{ name: 'title', title: '标题', interface: 'input' }],
    lookupTodo() {
      lookups += 1
      return { ok: true, matches: [{ no: 'ROW-1', status: 'open', fields: { title: '甲' } }], no: 'ROW-1', status: 'open', fields: { title: '甲' } }
    },
  })
  const before = gate.tokens.size
  const minted = await gate.preview({
    kind,
    action: '现查',
    speech,
    patch: { title: '甲' },
    workspace: '/tmp/confirm-ws',
  })
  const mintedSheet = minted.sheet && typeof minted.sheet === 'object' ? minted.sheet : minted
  assert.equal(String(minted.action || mintedSheet.action || ''), '现查')
  assert.equal(String(minted.preview_id || mintedSheet.preview_id || '').trim(), '')
  assert.equal(gate.tokens.size, before)

  const looked = await gate.preview({
    kind,
    action: '现查',
    speech,
    lookupLocked: true,
    workspace: '/tmp/confirm-ws',
  })
  const lookedSheet = looked.sheet && typeof looked.sheet === 'object' ? looked.sheet : looked
  assert.equal(String(looked.action || lookedSheet.action || ''), '现查')
  assert.equal(String(looked.preview_id || lookedSheet.preview_id || '').trim(), '')
  assert.equal(gate.tokens.size, before)
  assert.ok(lookups >= 1)
})

test('empty create patch does not mint a token; a literal patch does', async () => {
  const gate = createGate({
    vocab,
    fieldsOf: async () => [{ name: 'title', title: '标题' }],
    lookupTodo() {
      return { ok: true, matches: [], no: '', status: '', fields: {} }
    },
  })
  const before = gate.tokens.size
  const empty = await gate.preview({
    kind,
    action: '新建',
    patch: {},
    speech: '新建一笔',
    workspace: '/tmp/confirm-ws',
  })
  const emptySheet = empty.sheet && typeof empty.sheet === 'object' ? empty.sheet : empty
  assert.equal(gate.tokens.size, before)
  assert.equal(String(empty.preview_id || emptySheet.preview_id || '').trim(), '')

  const filled = await gate.preview({
    kind,
    action: '新建',
    patch: { title: '甲' },
    speech: '新建一笔',
    workspace: '/tmp/confirm-ws',
  })
  assert.equal(gate.tokens.size, before + 1)
  assert.ok(String(filled.preview_id || '').trim())
  const token = gate.tokens.get(filled.preview_id)
  assert.equal(token.patch.title, '甲')
})

test('confirm posts only the clicked changed token and voids empty creates first', async () => {
  const tokens = new Map([
    ['pv-empty', { used: false, action: '新建', patch: {}, expiresAt: 9_000_000_000_000 }],
    ['pv-real', { used: false, action: '新建', patch: { title: '甲' }, expiresAt: 9_000_000_000_000 }],
    ['pv-other', { used: false, action: '删除', patch: {}, no: 'ROW-2', expiresAt: 9_000_000_000_000 }],
  ])
  const posts = []
  const state = {
    pendingWrite: {
      openingId: 'open-1',
      preview_id: 'pv-empty',
      sessionId: 'sess-a',
      lines: [
        { preview_id: 'pv-empty', action: '新建', kind, patch: {}, no: '新单' },
        { preview_id: 'pv-real', action: '新建', kind, patch: { title: '甲' }, no: '新单' },
        { preview_id: 'pv-other', action: '删除', kind, no: 'ROW-2' },
      ],
    },
    pendingSheet: { kind, where: [{ keys: ['title'], values: ['甲'] }] },
  }
  const opening = createOpening({
    store: {
      async get() { return state },
      async update(fn) { fn(state) },
    },
    now: () => 1_000,
    snapshot: async () => ({}),
    note() {},
    opts: {
      gate: {
        tokens,
        async write(spec) {
          posts.push(spec.preview_id)
          return { ok: true, no: 'ROW-9', receiptId: 'r1' }
        },
      },
    },
    catalogOf: () => [],
    reopenReplyDraft: async () => false,
    hearBusinessEvent: async () => {},
    rememberFocus() {},
  })
  const written = await opening.commitWrite({
    preview_id: 'pv-real',
    source: 'workstation',
    sessionId: 'sess-a',
  })
  assert.equal(written.ok, true)
  assert.deepEqual(posts, ['pv-real'])
  assert.equal(tokens.get('pv-empty').used, true)
  assert.equal(tokens.get('pv-other').used, true)

  const emptyPosts = []
  tokens.set('pv-empty', { used: false, action: '新建', patch: {}, expiresAt: 9_000_000_000_000 })
  state.pendingWrite = {
    openingId: 'open-2',
    preview_id: 'pv-empty',
    lines: [{ preview_id: 'pv-empty', action: '新建', kind, patch: {} }],
  }
  opening.opts = undefined
  const refused = await createOpening({
    store: {
      async get() { return state },
      async update(fn) { fn(state) },
    },
    now: () => 1_000,
    snapshot: async () => ({}),
    note() {},
    opts: {
      gate: {
        tokens,
        async write(spec) {
          emptyPosts.push(spec.preview_id)
          return { ok: true, no: 'NO' }
        },
      },
    },
    catalogOf: () => [],
    reopenReplyDraft: async () => false,
    hearBusinessEvent: async () => {},
    rememberFocus() {},
  }).commitWrite({ preview_id: 'pv-empty', source: 'workstation' })
  assert.equal(refused.ok, false)
  assert.equal(refused.error, 'NO_PATCH')
  assert.deepEqual(emptyPosts, [])
  assert.equal(tokens.get('pv-empty').used, true)
})
