/** Biz / lan-assist tool names that surface rows on the records panel. */
export const BIZ_SURFACE_TOOL_RE = /(?:preview|write|biz|gate|secretary|lookup|lan[-_]?assist|record)/i

export function isBizSurfaceTool(tool: string) {
  return BIZ_SURFACE_TOOL_RE.test(String(tool || ''))
}
