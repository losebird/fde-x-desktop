export function planTaskMenu(task: { id?: string; sourceRef?: string } | null | undefined): {
  handoff: { enabled: boolean; reason: string }
  openSource: {
    enabled: boolean
    reason: string
    href: {
      panel?: string
      tab?: string
      kind?: string
      rowId?: string
      connection?: string
      traceId?: string
      requestId?: string
      workspaceAppId?: string
      appRid?: string
    } | null
    label: string
  }
}
