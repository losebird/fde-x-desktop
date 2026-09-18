import type { BizSurfaceRecord } from '@/lib/runtime-api'

const STORAGE_KEY = 'fde:biz:surface-sheet-cache'
const MAX_ENTRIES = 40

type SurfaceSheetEntry = {
  workspaceCwd: string
  surfaceId: string
  sheet: Record<string, unknown>
  connName: string
  at: number
}

function readAll(): SurfaceSheetEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed as SurfaceSheetEntry[] : []
  } catch {
    return []
  }
}

function writeAll(entries: SurfaceSheetEntry[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch {
    // ignore quota / private mode
  }
}

export function rememberBizSurfaceSheet(
  workspaceCwd: string,
  surfaceId: string,
  sheet: Record<string, unknown>,
  connName = '连接器',
) {
  if (!workspaceCwd || !surfaceId || !sheet || typeof sheet !== 'object') return
  const entries = readAll().filter((row) => !(row.workspaceCwd === workspaceCwd && row.surfaceId === surfaceId))
  entries.push({
    workspaceCwd,
    surfaceId,
    sheet,
    connName,
    at: Date.now(),
  })
  writeAll(entries)
}

export function peekBizSurfaceSheet(
  workspaceCwd: string,
  surfaceId: string,
): { sheet: Record<string, unknown>; connName: string } | null {
  if (!workspaceCwd || !surfaceId) return null
  const hit = readAll().find((row) => row.workspaceCwd === workspaceCwd && row.surfaceId === surfaceId)
  if (!hit) return null
  return { sheet: hit.sheet, connName: hit.connName }
}

export function matchSurfaceIdForSheet(
  surfaces: BizSurfaceRecord[],
  sheet: Record<string, unknown>,
  meta: { sessionId?: string; previewId?: string; surfaceId?: string },
): string | undefined {
  const previewId = meta.previewId
    || (typeof sheet.preview_id === 'string' ? sheet.preview_id : undefined)
    || (typeof sheet.previewId === 'string' ? sheet.previewId : undefined)
  const surfaceId = String(meta.surfaceId || '').trim()
  if (surfaceId && surfaces.some((row) => row.id === surfaceId)) return surfaceId
  const pid = String(previewId || '').trim()
  if (!pid) return undefined
  const hit = surfaces.find((row) => row.previewId === pid)
  return hit?.id
}
