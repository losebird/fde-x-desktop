import { mapKindsFromCatalog } from './vocab-sheet.mjs'

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function tryJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function unwrapPayload(raw) {
  if (typeof raw === 'string') {
    const parsed = tryJson(raw.trim())
    return parsed == null ? raw : unwrapPayload(parsed)
  }
  if (!isRecord(raw)) return raw
  if (raw.result !== undefined && raw.jsonrpc === '2.0') return unwrapPayload(raw.result)
  if (isRecord(raw.content) || Array.isArray(raw.content)) {
    const text = textFromMcpContent(raw.content)
    if (text) {
      const nested = tryJson(text)
      if (nested != null) return unwrapPayload(nested)
    }
  }
  return raw
}

function textFromMcpContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (typeof block === 'string') parts.push(block)
    else if (isRecord(block) && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join('\n').trim()
}

export function collectionRows(parsed) {
  if (Array.isArray(parsed)) return parsed
  if (!isRecord(parsed)) return null
  for (const key of ['rows', 'items', 'results', 'records', 'data']) {
    if (Array.isArray(parsed[key])) return parsed[key]
  }
  const arrays = Object.values(parsed).filter((value) => (
    Array.isArray(value)
    && value.length
    && value.every((row) => row && typeof row === 'object')
  ))
  if (arrays.length === 1) return arrays[0]
  return null
}

function columnList(payload, rows) {
  if (isRecord(payload) && Array.isArray(payload.columns) && payload.columns.length) {
    return payload.columns
  }
  const first = rows.find((row) => isRecord(row))
  if (!first) return []
  return Object.keys(first).filter((key) => key && key !== 'fields')
}

export function kindsFromDescribePayload(raw) {
  const payload = unwrapPayload(raw)
  if (payload == null) return { error: 'describe 结果为空' }
  if (typeof payload === 'string') {
    const parsed = tryJson(payload)
    if (parsed == null) return { error: 'describe 对不上词表形' }
    return kindsFromDescribePayload(parsed)
  }
  if (Array.isArray(payload)) {
    return mapKindsFromCatalog({ kinds: payload })
  }
  if (isRecord(payload) && Array.isArray(payload.kinds)) {
    return mapKindsFromCatalog(payload)
  }
  if (isRecord(payload) && Array.isArray(payload.collections)) {
    const kinds = payload.collections.map((row) => {
      if (typeof row === 'string') return { kind: row, label: row, fields: [] }
      if (!isRecord(row)) return null
      const kind = String(row.kind || row.name || '').trim()
      if (!kind) return null
      return {
        kind,
        label: String(row.label || row.title || kind),
        fields: Array.isArray(row.fields) ? row.fields : [],
      }
    }).filter(Boolean)
    return mapKindsFromCatalog({
      kinds,
      relations: Array.isArray(payload.relations) ? payload.relations : [],
      catalogVersion: payload.catalogVersion ?? payload.catalog_version ?? null,
    })
  }
  return { error: 'describe 对不上词表形' }
}

export function sheetFromListPayload(raw, { kind, action, canWrite, previewId, workspace } = {}) {
  const payload = unwrapPayload(raw)
  if (payload == null) return { error: 'list 结果为空' }
  const list = collectionRows(payload)
  if (!list) return { error: 'list 对不上 {kind,columns,rows} 形' }
  const objectRows = list.map((row, index) => {
    if (isRecord(row)) return row
    if (typeof row === 'string') return { text: row, no: String(index + 1) }
    return { value: row, no: String(index + 1) }
  })
  const columns = columnList(isRecord(payload) ? payload : {}, objectRows)
  const sheetKind = String((isRecord(payload) && payload.kind) || kind || '').trim()
  if (!sheetKind) return { error: 'list 缺少 kind' }
  return {
    sheet: {
      ok: true,
      kind: sheetKind,
      action: String((isRecord(payload) && payload.action) || action || '现查'),
      columns,
      rows: objectRows,
      listed: true,
      querySettled: true,
      canWrite: Boolean(canWrite),
      preview_id: previewId || null,
      previewId: previewId || null,
      ...(workspace ? { workspace } : {}),
    },
  }
}

export function receiptFromWritePayload(raw) {
  const payload = unwrapPayload(raw)
  if (payload == null) return { error: 'write 结果为空' }
  if (typeof payload === 'string') {
    const parsed = tryJson(payload)
    if (parsed != null) return receiptFromWritePayload(parsed)
    return { receipt: { ok: true, receiptId: '', recordNo: '', message: payload } }
  }
  if (!isRecord(payload)) return { error: 'write 对不上回执形' }
  if (payload.ok === false) {
    return {
      error: String(payload.hint || payload.error || payload.message || '过账失败'),
      code: String(payload.error || 'write_failed'),
    }
  }
  return {
    receipt: {
      ok: payload.ok !== false,
      receiptId: String(payload.receiptId || payload.receipt_id || ''),
      recordNo: String(payload.recordNo || payload.no || payload.id || ''),
      kind: payload.kind,
      action: payload.action,
    },
  }
}
