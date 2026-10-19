export type PlanAppSpec = {
  slug?: string
  entities?: { name?: string }[]
}

export type PlanAppHandle =
  | {
      kind: 'app'
      ledgerId: string
      href: { panel: 'data'; workspaceAppId: string }
    }
  | {
      kind: 'row'
      ledgerId: string
      rid: string
      href: { panel: 'data'; workspaceAppId: string; appRid: string }
    }

export function formatPlanAppSource(input: {
  ledgerId?: string
  rowId?: string | null
}): string | null

export function planAppSource(sourceRef: string): PlanAppHandle | null

export function planAskFields(
  sourceRef: string,
  deps: {
    loadApp: (ledgerId: string) => Promise<{ spec: PlanAppSpec } | null> | { spec: PlanAppSpec } | null
    probeRow: (slug: string, entity: string, rid: string) => boolean | Promise<boolean>
  },
): Promise<Record<string, string>>

export function focusEntityFor(
  spec: PlanAppSpec | null | undefined,
  rid: string,
  probeRow: (slug: string, entity: string, rid: string) => boolean | Promise<boolean>,
): Promise<string>
