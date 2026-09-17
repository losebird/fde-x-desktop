export type SheetColumn = { key: string; label?: string }
export type SheetRow = Record<string, unknown>

export function isBizListQueryAction(action: string) {
  return String(action || '').trim() === '现查'
}

const INTERNAL_KEYS = new Set([
  'fields',
  'preview_id',
  'previewId',
  'canWrite',
  'can_write',
  'digest',
  'sessionId',
])

export function normalizeSheetColumns(raw: unknown): SheetColumn[] {
  if (!Array.isArray(raw)) return []
  const columns: SheetColumn[] = []
  for (const column of raw) {
    if (!column || typeof column !== 'object') continue
    const item = column as { key?: string; label?: string }
    const key = String(item.key || item.label || '').trim()
    if (!key || INTERNAL_KEYS.has(key)) continue
    columns.push({ key, label: String(item.label || item.key || key) })
  }
  return columns
}

export function normalizeSheetRows(raw: unknown): SheetRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map((row) => {
    if (!row || typeof row !== 'object') return {}
    const item = row as { no?: string; status?: string; fields?: Record<string, unknown> }
    return {
      orderId: item.no,
      status: item.status,
      ...(item.fields ?? {}),
      ...row,
    }
  })
}

export function sheetRowKey(row: SheetRow, index = 0) {
  return String(row.orderId ?? row.no ?? row.id ?? index)
}

export function formatSheetCellValue(value: unknown): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).format(date)
      }
    }
    return value
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(value)
  }
  return String(value)
}

export function columnLabel(columns: SheetColumn[], key: string) {
  return columns.find((column) => column.key === key)?.label || key
}

export type PreviewChange = {
  label: string
  from?: string
  to?: string
  value?: string
}

export type PreviewSummary = {
  title: string
  subtitle?: string
  action: string
  kind: string
  changes: PreviewChange[]
  rows?: SheetRow[]
}

function rowFieldValue(row: SheetRow | undefined, key: string) {
  if (!row) return undefined
  if (row[key] !== undefined) return row[key]
  const fields = row.fields
  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    return (fields as Record<string, unknown>)[key]
  }
  return undefined
}

function summarizeRow(row: SheetRow | undefined, columns: SheetColumn[]) {
  if (!row) return '—'
  const parts = columns
    .slice(0, 4)
    .map((column) => `${column.label || column.key}：${formatSheetCellValue(rowFieldValue(row, column.key))}`)
    .filter((part) => !part.endsWith('：—'))
  return parts.length ? parts.join(' · ') : sheetRowKey(row)
}

export function buildPreviewSummary(
  sheet: Record<string, unknown>,
  options: { originalRow?: SheetRow; columns?: SheetColumn[] } = {},
): PreviewSummary {
  const action = String(sheet.action || '')
  const kind = String(sheet.kind || '')
  const columns = options.columns?.length
    ? options.columns
    : normalizeSheetColumns(sheet.columns)
  const rows = normalizeSheetRows(sheet.rows)
  const primary = rows[0]

  if (action === '删除') {
    return {
      action,
      kind,
      title: '删除确认',
      subtitle: `将删除 1 条${kind ? ` ${kind}` : ''}记录`,
      changes: columns.map((column) => ({
        label: column.label || column.key,
        value: formatSheetCellValue(rowFieldValue(primary, column.key)),
      })),
      rows,
    }
  }

  if (action === '过审') {
    return {
      action,
      kind,
      title: '过审确认',
      subtitle: `将把${kind ? ` ${kind}` : ''}记录标记为已过审`,
      changes: columns.map((column) => ({
        label: column.label || column.key,
        value: formatSheetCellValue(rowFieldValue(primary, column.key)),
      })),
      rows,
    }
  }

  if (action === '新建') {
    return {
      action,
      kind,
      title: '新建确认',
      subtitle: `将新建 1 条${kind ? ` ${kind}` : ''}记录`,
      changes: columns.map((column) => ({
        label: column.label || column.key,
        to: formatSheetCellValue(rowFieldValue(primary, column.key)),
      })),
      rows,
    }
  }

  const original = options.originalRow
  const changes: PreviewChange[] = []
  for (const column of columns) {
    const fromRaw = rowFieldValue(original, column.key)
    const toRaw = rowFieldValue(primary, column.key)
    const from = formatSheetCellValue(fromRaw)
    const to = formatSheetCellValue(toRaw)
    if (from === to && from === '—') continue
    if (from === to) continue
    changes.push({
      label: column.label || column.key,
      from,
      to,
    })
  }

  if (!changes.length && primary) {
    changes.push({
      label: '记录',
      value: summarizeRow(primary, columns),
    })
  }

  return {
    action,
    kind,
    title: '改行确认',
    subtitle: kind ? `将更新 ${kind} 记录` : '将更新所选记录',
    changes,
    rows,
  }
}
