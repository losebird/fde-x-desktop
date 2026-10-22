import type { BizSurfaceRecord } from '@/lib/runtime-api'
import { sameWorkspaceCacheKey, workspaceCacheKey } from '../../runtime/cwd.mjs'

const STORAGE_KEY = 'fde:biz:surface-sheet-cache'
const MAX_ENTRIES = 40

export type SurfaceSheetEntry = {
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
  const key = workspaceCacheKey(workspaceCwd)
  if (!key || !surfaceId || !sheet || typeof sheet !== 'object') return
  const entries = readAll().filter((row) => !(sameWorkspaceCacheKey(row.workspaceCwd, key) && row.surfaceId === surfaceId))
  entries.push({
    workspaceCwd: key,
    surfaceId,
    sheet,
    connName,
    at: Date.now(),
  })
  writeAll(entries)
}

export function listRememberedSurfaceSheets(workspaceCwd: string): SurfaceSheetEntry[] {
  if (!workspaceCacheKey(workspaceCwd)) return []
  return readAll().filter((row) => sameWorkspaceCacheKey(row.workspaceCwd, workspaceCwd))
}

export function peekBizSurfaceSheet(
  workspaceCwd: string,
  surfaceId: string,
): { sheet: Record<string, unknown>; connName: string } | null {
  if (!workspaceCacheKey(workspaceCwd) || !surfaceId) return null
  const hit = readAll().find((row) => sameWorkspaceCacheKey(row.workspaceCwd, workspaceCwd) && row.surfaceId === surfaceId)
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
