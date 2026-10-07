import { recordsViaMcp } from '../biz/source.mjs'
import { findBizSystem } from '../biz/systems-store.mjs'
import { assertKindOnConnection, mcpSourceFromSystem } from '../biz/systems.mjs'
import { invokeBizSlot } from '../biz/invoke.mjs'
import { sheetFromListPayload, receiptFromWritePayload } from '../biz/bound-shape.mjs'
import { loadBizVocab } from '../biz/vocab-sheet.mjs'
import { listColumns } from './records.mjs'

export function specRecordsViaMcp(spec) {
  return recordsViaMcp(spec)
}

async function sourceForSpec(deps, spec) {
  const systemId = spec?.source?.type === 'system' ? String(spec.source.systemId || '').trim() : ''
  if (!systemId) return null
  const found = await findBizSystem(deps.aiRuntime, systemId)
  if (!found.system) {
    const error = new Error('找不到该业务系统')
    error.code = 'no_system'
    throw error
  }
  return mcpSourceFromSystem(found.system)
}

async function gateEntity(deps, spec, entity, workspaceCwd) {
  const systemId = spec?.source?.type === 'system' ? String(spec.source.systemId || '').trim() : ''
  const vocab = await loadBizVocab(deps.aiRuntime, workspaceCwd)
  const gated = assertKindOnConnection(vocab, entity, systemId)
  if (gated.error) {
    const error = new Error(gated.error)
    error.code = gated.code || 'no_kind'
    throw error
  }
  return gated
}

export async function listBoundRecords(deps, spec, entity, workspaceCwd, opts = {}) {
  if (!specRecordsViaMcp(spec)) return null
  const gated = await gateEntity(deps, spec, entity, workspaceCwd)
  const source = await sourceForSpec(deps, spec)
  const raw = await invokeBizSlot(deps, {
    source,
    slot: 'list',
    args: {
      kind: gated.kind,
      action: '现查',
      cwd: workspaceCwd,
      ...(opts.filter && typeof opts.filter === 'object' ? { filter: opts.filter } : {}),
    },
    cwd: workspaceCwd,
    sessionId: opts.sessionId,
  })
  const mapped = sheetFromListPayload(raw, {
    kind: gated.kind,
    action: '现查',
    canWrite: Boolean(source.write),
    workspace: workspaceCwd,
  })
  if (mapped.error) {
    const error = new Error(mapped.error)
    error.code = 'LIST_SHAPE'
    throw error
  }
  const rows = Array.isArray(mapped.sheet.rows) ? mapped.sheet.rows : []
  const page = Math.max(1, Number(opts.page ?? 1))
  const size = Math.max(1, Math.min(100, Number(opts.size ?? 20)))
  const start = (page - 1) * size
  return {
    rows: rows.slice(start, start + size),
    columns: listColumns(spec, entity),
    total: rows.length,
    page,
    size,
  }
}

export async function writeBoundRecord(deps, spec, entity, workspaceCwd, args) {
  if (!specRecordsViaMcp(spec)) return null
  const gated = await gateEntity(deps, spec, entity, workspaceCwd)
  const source = await sourceForSpec(deps, spec)
  if (!source.write) {
    const error = new Error('未绑 write')
    error.code = 'no_write'
    throw error
  }
  const raw = await invokeBizSlot(deps, {
    source,
    slot: 'write',
    args: { kind: gated.kind, cwd: workspaceCwd, ...args },
    cwd: workspaceCwd,
    sessionId: args.sessionId,
  })
  const mapped = receiptFromWritePayload(raw)
  if (mapped.error) {
    const error = new Error(mapped.error)
    error.code = mapped.code || 'WRITE_SHAPE'
    throw error
  }
  return mapped.receipt
}

export async function computeBoundStat(deps, spec, view, workspaceCwd) {
  const listed = await listBoundRecords(deps, spec, String(view.entity), workspaceCwd, { size: 100 })
  if (!listed) return null
  const metric = view.metric || { fn: 'count' }
  const fn = String(metric.fn || 'count')
  const field = metric.field ? String(metric.field) : ''
  let value = 0
  if (fn === 'sum' && field) {
    value = listed.rows.reduce((sum, row) => sum + Number(row?.[field] || 0), 0)
  } else if (fn === 'avg' && field) {
    const nums = listed.rows.map((row) => Number(row?.[field])).filter((n) => Number.isFinite(n))
    value = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
  } else {
    value = listed.total
  }
  return { value, label: view.label || '统计' }
}
