import { loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import type { FdeAppSpec, FdeWebSpec } from '@/lib/app-spec'
import { runtimeApi } from '@/lib/runtime-api'
import {
  focusEntityFor,
  formatPlanAppSource,
  planAppSource,
  planAskFields,
  type PlanAppHandle,
} from '../../runtime/app-source.mjs'

export { formatPlanAppSource, planAppSource, type PlanAppHandle }

async function loadApp(ledgerId: string) {
  try {
    const detail = await runtimeApi.getDeclarativeApp(ledgerId)
    if (!detail?.spec) return null
    return { spec: detail.spec }
  } catch {
    return null
  }
}

async function probeRow(slug: string, entity: string, rid: string) {
  const workspace = loadCurrentWorkspaceCwd()
  if (!workspace.ok) return false
  try {
    const row = await runtimeApi.getAppRecord(slug, entity, rid, workspace.cwd)
    return Boolean(row)
  } catch {
    return false
  }
}

export function planTaskAskFields(sourceRef: string) {
  return planAskFields(sourceRef, { loadApp, probeRow })
}

export function focusOpenEntity(spec: FdeAppSpec | FdeWebSpec, rid: string) {
  return focusEntityFor(spec, rid, probeRow)
}
