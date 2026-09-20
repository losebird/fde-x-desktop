export type SheetColumn = {
  key: string
  label?: string
  enums?: Record<string, string>
}
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

const PREVIEW_META_KEYS = new Set([
  ...INTERNAL_KEYS,
  'index',
  'orderId',
  'no',
  'id',
  'fields',
])

export function isBlankSheetValue(value: unknown) {
  return value == null || value === ''
}

function normalizeCompareValue(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value.trim()
  return String(value)
}

export function sheetFieldValuesEqual(a: unknown, b: unknown) {
  return normalizeCompareValue(a) === normalizeCompareValue(b)
}

function previewFieldKeys(columns: SheetColumn[], ...rows: Array<SheetRow | undefined>) {
  const keys = new Set<string>()
  for (const column of columns) {
    if (column.key && !PREVIEW_META_KEYS.has(column.key)) keys.add(column.key)
  }
  for (const row of rows) {
    if (!row) continue
    for (const key of Object.keys(row)) {
      if (!PREVIEW_META_KEYS.has(key)) keys.add(key)
    }
    const fields = row.fields
    if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
      for (const key of Object.keys(fields as Record<string, unknown>)) {
        if (!PREVIEW_META_KEYS.has(key)) keys.add(key)
      }
    }
  }
  return [...keys]
}

export function pickSheetRowPatch(
  before: SheetRow,
  after: SheetRow,
  columns: SheetColumn[] = [],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const key of previewFieldKeys(columns, before, after)) {
    const next = rowFieldValue(after, key)
    const prev = rowFieldValue(before, key)
    if (!sheetFieldValuesEqual(prev, next)) patch[key] = next
  }
  return patch
}

export function pickFilledSheetInput(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (PREVIEW_META_KEYS.has(key)) continue
    if (!isBlankSheetValue(value)) out[key] = value
  }
  return out
}

export function normalizeSheetColumns(raw: unknown): SheetColumn[] {
  if (!Array.isArray(raw)) return []
  const columns: SheetColumn[] = []
  for (const column of raw) {
    if (!column || typeof column !== 'object') continue
    const item = column as { key?: string; label?: string; enums?: Record<string, unknown> }
    const key = String(item.key || item.label || '').trim()
    if (!key || INTERNAL_KEYS.has(key)) continue
    const next: SheetColumn = { key, label: String(item.label || item.key || key) }
    if (item.enums && typeof item.enums === 'object' && !Array.isArray(item.enums)) {
      const enums: Record<string, string> = {}
      for (const [enumKey, enumLabel] of Object.entries(item.enums)) {
        enums[String(enumKey)] = String(enumLabel ?? enumKey)
      }
      if (Object.keys(enums).length) next.enums = enums
    }
    columns.push(next)
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

/** Always a new array of new row objects so footer `.length` cannot share a mutated slice. */
export function cloneSheetRows(raw: unknown): SheetRow[] {
  return normalizeSheetRows(raw).map((row) => ({ ...row }))
}

export function sheetRowIdentity(row: SheetRow, index = 0) {
  const id = String(row.orderId ?? row.no ?? row.id ?? '').trim()
  return id ? `${id}#${index}` : `#${index}`
}

export function sheetRowRenderKey(row: SheetRow, index = 0, sheetIdentity = '') {
  const identity = sheetRowIdentity(row, index)
  return sheetIdentity ? `${sheetIdentity}::${identity}` : identity
}

export function sheetRowKey(row: SheetRow, index = 0) {
  return sheetRowIdentity(row, index)
}

export function sheetRowBusinessNo(row: SheetRow) {
  return String(row.no ?? row.orderId ?? row.id ?? '').trim()
}

export function resolveSheetEnumLabel(column: SheetColumn | undefined, value: unknown): string | null {
  const enums = column?.enums
  if (!enums || value == null || value === '') return null
  const raw = normalizeCompareValue(value)
  if (!raw) return null
  if (Object.prototype.hasOwnProperty.call(enums, raw)) return enums[raw]
  const lower = raw.toLowerCase()
  for (const [enumKey, enumLabel] of Object.entries(enums)) {
    if (String(enumKey).toLowerCase() === lower) return enumLabel
  }
  return null
}

/** Display text for grid cells: schema enum labels + generic date/boolean formatting. */
export function formatSheetCellDisplayValue(value: unknown, column?: SheetColumn): string {
  if (value == null || value === '') return '—'
  const enumLabel = resolveSheetEnumLabel(column, value)
  if (enumLabel != null) return enumLabel
  return formatSheetCellValue(value)
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
  alreadyAtTarget?: boolean
  emptyHint?: string
}

function statusLikeColumn(columns: SheetColumn[]): SheetColumn | undefined {
  return columns.find((column) => {
    const key = String(column.key || '')
    const label = String(column.label || '')
    return /^(status|state|stage)$/i.test(key) || /状态/.test(label)
  })
}

function currentStatusDisplay(primary: SheetRow | undefined, columns: SheetColumn[]): string {
  const col = statusLikeColumn(columns)
  const raw = (col ? rowFieldValue(primary, col.key) : undefined) ?? primary?.status
  const text = formatSheetCellDisplayValue(raw, col)
  return text && text !== '—' ? text : '当前状态'
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

function previewChangesFromSheetPayload(
  sheet: Record<string, unknown>,
  columns: SheetColumn[],
): PreviewChange[] {
  const raw = sheet.changes
  if (!Array.isArray(raw)) return []
  const changes: PreviewChange[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as { field?: string; key?: string; label?: string; from?: unknown; to?: unknown }
    const key = String(row.field || row.key || '').trim()
    const label = String(row.label || columnLabel(columns, key) || key).trim()
    if (!label) continue
    const fromRaw = row.from
    const toRaw = row.to
    if (sheetFieldValuesEqual(fromRaw, toRaw)) continue
    if (isBlankSheetValue(fromRaw) && !isBlankSheetValue(toRaw)) {
      changes.push({ label, to: formatSheetCellDisplayValue(toRaw, columns.find((c) => c.key === key)) })
      continue
    }
    const col = columns.find((c) => c.key === key)
    changes.push({
      label,
      from: formatSheetCellDisplayValue(fromRaw, col),
      to: formatSheetCellDisplayValue(toRaw, col),
    })
  }
  return changes
}

function buildPreviewFieldChanges(
  columns: SheetColumn[],
  primary: SheetRow | undefined,
  original: SheetRow | undefined,
  mode: 'update' | 'create',
) {
  const changes: PreviewChange[] = []
  for (const key of previewFieldKeys(columns, primary, original)) {
    const col = columns.find((column) => column.key === key)
    const label = columnLabel(columns, key) || key
    const toRaw = rowFieldValue(primary, key)
    const fromRaw = rowFieldValue(original, key)
    if (mode === 'create') {
      if (isBlankSheetValue(toRaw)) continue
      changes.push({ label, to: formatSheetCellDisplayValue(toRaw, col) })
      continue
    }
    if (sheetFieldValuesEqual(fromRaw, toRaw)) continue
    changes.push({
      label,
      from: formatSheetCellDisplayValue(fromRaw, col),
      to: formatSheetCellDisplayValue(toRaw, col),
    })
  }
  return changes
}

export function buildPreviewSummary(
  sheet: Record<string, unknown>,
  options: { originalRow?: SheetRow; columns?: SheetColumn[]; patch?: Record<string, unknown> } = {},
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
      changes: buildPreviewFieldChanges(columns, primary, undefined, 'create').slice(0, 5),
      rows,
    }
  }

  if (action === '过审') {
    const payloadChanges = previewChangesFromSheetPayload(sheet, columns)
    const original = options.originalRow
    const changes = payloadChanges.length
      ? payloadChanges
      : (original ? buildPreviewFieldChanges(columns, primary, original, 'update') : [])
    const alreadyAtTarget = sheet.alreadyAtTarget === true || (rows.length > 0 && changes.length === 0)
    if (alreadyAtTarget) {
      const currentLabel = currentStatusDisplay(primary, columns)
      return {
        action,
        kind,
        title: '过审确认',
        subtitle: `该记录已是${currentLabel}，无需再过审。`,
        changes: [],
        rows,
        alreadyAtTarget: true,
        emptyHint: `记录当前为${currentLabel}，没有待提交的变更。`,
      }
    }
    return {
      action,
      kind,
      title: '过审确认',
      subtitle: `将把${kind ? ` ${kind}` : ''}记录标记为已过审`,
      changes,
      rows,
    }
  }

  if (action === '新建') {
    const payloadChanges = previewChangesFromSheetPayload(sheet, columns)
    return {
      action,
      kind,
      title: '新建确认',
      subtitle: `将新建 1 条${kind ? ` ${kind}` : ''}记录`,
      changes: payloadChanges.length
        ? payloadChanges
        : buildPreviewFieldChanges(columns, primary, undefined, 'create'),
      rows,
    }
  }

  const payloadChanges = previewChangesFromSheetPayload(sheet, columns)
  const original = options.originalRow
  if (payloadChanges.length) {
    return {
      action,
      kind,
      title: '改行确认',
      subtitle: kind ? `将更新 ${kind} 记录` : '将更新所选记录',
      changes: payloadChanges,
      rows,
    }
  }
  if (original) {
    let changes = buildPreviewFieldChanges(columns, primary, original, 'update')
    if (!changes.length && options.patch) {
      changes = buildPreviewFieldChanges(columns, { ...original, ...options.patch }, original, 'update')
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

  return {
    action,
    kind,
    title: '改行确认',
    subtitle: kind ? `将更新 ${kind} 记录` : '将更新所选记录',
    changes: [],
    rows,
  }
}

/** True when the preview has field diffs a human can confirm. Empty lists are not confirmable. */
export function sheetHasConfirmablePreviewChanges(
  sheet: Record<string, unknown>,
  options: { originalRow?: SheetRow; columns?: SheetColumn[]; patch?: Record<string, unknown> } = {},
) {
  return buildPreviewSummary(sheet, options).changes.length > 0
}
