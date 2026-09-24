import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_DSH_HOME } from '../config.mjs'
import { recoverWriteIntent } from '../vendor-overlays/dsh-lan-assist/slots.js'
import { createSessionRoundStore } from '../vendor-overlays/dsh-lan-assist/session-round.js'
import {
  previewTokenIndex,
  projectWriteConfirm,
  releaseEmittedConfirm,
  writeTokenStatus,
} from '../biz/write-confirm.mjs'
import { shouldOpenWriteConfirm } from '../../src/lib/write-confirm.ts'

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'lan-assist-confirm-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })
const { createGate } = await import(pathToFileURL(join(staged, 'write.js')).href)
const { voidUnusedTokens } = await import(pathToFileURL(join(staged, 'gate.js')).href)

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
  assert.equal(gone.writeToken, 'absent')
  assert.equal(gone.canWrite, false)
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
  const unlocked = recoverWriteIntent({
    kind,
    action: '现查',
    speech,
  }, vocab, {})
  assert.equal(unlocked.action, '新建')

  const locked = recoverWriteIntent({
    kind,
    action: '现查',
    speech,
    lookupLocked: true,
  }, vocab, {})
  assert.equal(locked.action, '现查')
  assert.equal(locked.patch, undefined)

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
    workspace: '/tmp/confirm-ws',
  })
  assert.equal(minted.action, '新建')
  assert.ok(String(minted.preview_id || '').trim())
  assert.equal(gate.tokens.size, before + 1)
  assert.equal(gate.previewTokenIndex()[minted.preview_id], 'open')

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
  assert.equal(gate.tokens.size, before + 1)
  assert.ok(lookups >= 1)
})
