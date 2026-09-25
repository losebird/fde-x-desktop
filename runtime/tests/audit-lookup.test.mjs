import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  auditRecordNo,
  captureLookupBind,
  effectiveBizKind,
  rollbackPreviewBody,
} from '../biz/audit-lookup.mjs'

describe('audit lookup bind', () => {
  test('effectiveBizKind skips speakReceipt meta kinds', () => {
    assert.equal(effectiveBizKind('receipt', '工单'), '工单')
    assert.equal(effectiveBizKind('采购单', 'receipt'), '采购单')
  })

  test('auditRecordNo prefers sheet/body over write speak payload', () => {
    assert.equal(
      auditRecordNo({ no: 'row_pk_9' }, { no: 'TK-22' }, { no: 'TK-22', kind: 'receipt' }),
      'row_pk_9',
    )
    assert.equal(auditRecordNo(null, { no: 'TK-22' }, { no: 'internal-1' }), 'TK-22')
  })

  test('captureLookupBind keeps where, hop, and original speech', () => {
    const bind = captureLookupBind(
      {
        where: [{ field: 'id', op: 'eq', value: '9' }],
        hopWhere: [{ field: 'status', op: 'eq', value: 'open' }],
        speech: '把那一行改回去',
        sessionId: 'session-origin-1',
      },
      {},
    )
    assert.equal(bind.where.length, 1)
    assert.equal(bind.hopWhere.length, 1)
    assert.equal(bind.speech, '把那一行改回去')
    assert.equal(bind.sessionId, 'session-origin-1')
    const body = rollbackPreviewBody(bind, '项目任务', '9', { title: '旧标题' }, '/tmp/ws')
    assert.equal(body.kind, '项目任务')
    assert.equal(body.no, '9')
    assert.equal(body.patch.title, '旧标题')
    assert.equal(String(body.speech || ''), '')
    assert.equal(body.where, undefined)
  })
})
