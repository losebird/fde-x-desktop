const STORAGE_KEY = 'fde:biz:kind-list-cache'

export type BizKindListSnapshot = {
  workspaceCwd: string
  kind: string
  sheet: Record<string, unknown>
  connName: string
  surfaceId?: string
  at: number
}

function readAll(): BizKindListSnapshot[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed as BizKindListSnapshot[] : []
  } catch {
    return []
  }
}

function writeAll(entries: BizKindListSnapshot[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-40)))
  } catch {
    // ignore quota / private mode
  }
}

function isListSheet(sheet: Record<string, unknown>) {
  const action = String(sheet.action || '')
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  const previewId = sheet.preview_id ?? sheet.previewId
  if (rows.length <= 1) return false
  if (action === '现查') return true
  return !previewId
}

export function rememberBizKindListSheet(
  workspaceCwd: string,
  sheet: Record<string, unknown>,
  connName = '连接器',
  surfaceId?: string,
) {
  const kind = String(sheet.kind || '')
  if (!workspaceCwd || !kind || !isListSheet(sheet)) return
  const entries = readAll().filter((row) => !(row.workspaceCwd === workspaceCwd && row.kind === kind))
  entries.push({
    workspaceCwd,
    kind,
    sheet,
    connName,
    surfaceId,
    at: Date.now(),
  })
  writeAll(entries)
}

export function peekBizKindListSheet(
  workspaceCwd: string,
  kind: string,
): { sheet: Record<string, unknown>; connName: string; surfaceId?: string } | null {
  if (!workspaceCwd || !kind) return null
  const hit = readAll()
    .filter((row) => row.workspaceCwd === workspaceCwd && row.kind === kind)
    .sort((a, b) => b.at - a.at)[0]
  if (!hit) return null
  return { sheet: hit.sheet, connName: hit.connName, surfaceId: hit.surfaceId }
}
