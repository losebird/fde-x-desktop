import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGate } from '../write.js'

function gateOf(rows, extra = {}) {
  const table = new Map(rows.map((row) => [row.no, { ...row }]))
  return createGate({
    now: () => 1_700_000_000_000,
    loadVocab: extra.loadVocab || (async () => [{
      kind: '工单', fields: ['单号', '状态'], can: ['现查', '删除'], resource: 'biz_tickets', ticketField: 'ticketNo',
      catalogVersion: extra.catalogVersion || '',
    }]),
    lookupTodo: async (spec) => {
      function hit(row) {
        const terms = Array.isArray(spec.where) ? spec.where : []
        return terms.every((term) => {
          const keys = term.keys || ['status']
          const values = term.values || []
          if (!values.length) return true
          const got = String(row[keys[0]] || '')
          return term.not ? !values.includes(got) : values.includes(got)
        })
      }
      if (spec.no) {
        const row = table.get(spec.no)
        if (!row || !hit(row)) return { ok: false, error: 'NOT_FOUND' }
        return { ok: true, no: row.no, status: row.status, fields: row, matches: [{ no: row.no, status: row.status, fields: row }], fingerprint: `${row.no}:${row.status}` }
      }
      const matches = [...table.values()].filter(hit).map((row) => ({ no: row.no, status: row.status, fields: row }))
      return { ok: true, matches, fingerprint: 'many' }
    },
    postWrite: extra.postWrite || (async (spec) => {
      const row = table.get(spec.no)
      if (!row) return { ok: false }
      if (spec.patch) Object.assign(row, spec.patch)
      if (spec.action === '删除') table.delete(spec.no)
      return { ok: true, receiptId: `rcpt_${spec.no}` }
    }),
  })
}

test('batch 改行 freezes the listed nos and writes only those', async () => {
  const posted = []
  const gate = gateOf(
    [{ no: 'TK-1', status: 'processing', title: '甲' }, { no: 'TK-2', status: 'processing', title: '乙' }, { no: 'TK-3', status: 'open', title: '丙' }],
    {
      postWrite: async (spec) => {
        posted.push(spec.no)
        return { ok: true, receiptId: `rcpt_${spec.no}` }
      },
    },
  )
  const preview = await gate.preview({
    kind: '工单',
    action: '改行',
    where: [{ keys: ['status'], values: ['processing'] }],
    patch: { title: '先看日志' },
    batch: true,
    workspace: '/ws',
  })
  assert.equal(preview.batch, true)
  assert.deepEqual(preview.nos.sort(), ['TK-1', 'TK-2'])
  assert.ok(preview.preview_id)
  const written = await gate.write({ preview_id: preview.preview_id, trace_id: 'batch-1' })
  assert.equal(written.ok, true, written.error)
  assert.deepEqual(posted.sort(), ['TK-1', 'TK-2'])
  assert.ok(!posted.includes('TK-3'))
})

test('batch 删除 needs a separate confirm', async () => {
  const gate = gateOf([{ no: 'TK-1', status: 'processing' }, { no: 'TK-2', status: 'processing' }])
  const preview = await gate.preview({
    kind: '工单',
    action: '删除',
    where: [{ keys: ['status'], values: ['processing'] }],
    batch: true,
    workspace: '/ws',
  })
  assert.equal(preview.batch, true)
  const denied = await gate.write({ preview_id: preview.preview_id, trace_id: 'del-1' })
  assert.equal(denied.ok, false)
  assert.equal(denied.error, 'NEED_CONFIRM')
  const ok = await gate.write({ preview_id: preview.preview_id, trace_id: 'del-1', confirm: true })
  assert.equal(ok.ok, true, ok.error)
})

test('write refuses a preview after catalogVersion changes', async () => {
  let version = 'v1'
  const gate = gateOf([{ no: 'TK-1', status: 'processing', title: '甲' }], {
    catalogVersion: 'v1',
    loadVocab: async () => [{
      kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo',
      catalogVersion: version,
    }],
  })
  const preview = await gate.preview({
    kind: '工单', no: 'TK-1', action: '改行', patch: { title: '新' }, workspace: '/ws',
  })
  assert.ok(preview.preview_id)
  version = 'v2'
  const written = await gate.write({ preview_id: preview.preview_id, trace_id: 'stale' })
  assert.equal(written.ok, false)
  assert.equal(written.error, 'STALE_CATALOG')
})
