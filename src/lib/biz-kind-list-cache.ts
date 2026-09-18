import { listQueryFingerprint, operationBundlesAlign } from '@/lib/biz-list-query'

const STORAGE_KEY = 'fde:biz:kind-list-cache'

export type BizKindListSnapshot = {
  workspaceCwd: string
  kind: string
  queryFingerprint: string
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
  if (action === '现查' && rows.length > 0) return true
  if (rows.length <= 1) return false
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
  const queryFingerprint = listQueryFingerprint(sheet)
  const entries = readAll().filter((row) => !(
    row.workspaceCwd === workspaceCwd
    && row.kind === kind
    && row.queryFingerprint === queryFingerprint
  ))
  entries.push({
    workspaceCwd,
    kind,
    queryFingerprint,
    sheet,
    connName,
    surfaceId,
    at: Date.now(),
  })
  writeAll(entries)
}

export function listBizKindListSnapshots(workspaceCwd: string): BizKindListSnapshot[] {
  if (!workspaceCwd) return []
  return readAll()
    .filter((row) => row.workspaceCwd === workspaceCwd)
    .sort((a, b) => b.at - a.at)
}

export function peekBizKindListSheet(
  workspaceCwd: string,
  kind: string,
  queryFingerprint?: string,
): { sheet: Record<string, unknown>; connName: string; surfaceId?: string } | null {
  if (!workspaceCwd || !kind) return null
  const rows = readAll()
    .filter((row) => row.workspaceCwd === workspaceCwd && row.kind === kind)
    .sort((a, b) => b.at - a.at)
  const hit = queryFingerprint
    ? rows.find((row) => row.queryFingerprint === queryFingerprint)
    : undefined
  if (!hit) return null
  return { sheet: hit.sheet, connName: hit.connName, surfaceId: hit.surfaceId }
}

export function peekBizKindListSheetBySurfaceId(
  workspaceCwd: string,
  surfaceId: string,
): { sheet: Record<string, unknown>; connName: string; surfaceId?: string } | null {
  if (!workspaceCwd || !surfaceId) return null
  const hit = readAll().find((row) => row.workspaceCwd === workspaceCwd && row.surfaceId === surfaceId)
  if (!hit) return null
  return { sheet: hit.sheet, connName: hit.connName, surfaceId: hit.surfaceId }
}

export function peekBizKindListSheetForOperation(
  workspaceCwd: string,
  kind: string,
  anchor: Record<string, unknown> | null | undefined,
): { sheet: Record<string, unknown>; connName: string; surfaceId?: string } | null {
  if (!workspaceCwd || !kind) return null
  const rows = readAll()
    .filter((row) => row.workspaceCwd === workspaceCwd && row.kind === kind)
    .sort((a, b) => b.at - a.at)
  if (!anchor) return null
  const anchorFp = listQueryFingerprint(anchor)
  if (anchorFp) {
    const exact = rows.find((row) => listQueryFingerprint(row.sheet) === anchorFp)
    if (exact) return { sheet: exact.sheet, connName: exact.connName, surfaceId: exact.surfaceId }
  }
  const hit = rows.find((row) => operationBundlesAlign(anchor, row.sheet))
  if (!hit) return null
  return { sheet: hit.sheet, connName: hit.connName, surfaceId: hit.surfaceId }
}
