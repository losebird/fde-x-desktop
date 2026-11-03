import './support/no-stray-processes.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveWriteDrawerFace } from '../../src/lib/write-confirm.ts'

test('a used preview leftover 改行 drawer becomes posted, not another confirm click', () => {
  const face = resolveWriteDrawerFace({
    open: { previewId: 'pv-post', canWrite: true, action: '改行' },
    sheet: { kind: '费用报销', action: '现查', canWrite: false, rows: [{ no: 'EXP1' }] },
    tokenIndex: { 'pv-post': 'used' },
    dismissed: false,
    hasChanges: false,
    alreadyAtTarget: false,
  })
  assert.equal(face, 'posted')
  assert.notEqual(face, 'keep')
  assert.notEqual(face, 'confirm')
})
