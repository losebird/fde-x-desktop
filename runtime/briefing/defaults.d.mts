export const SECTION_TYPES: Set<string>
export const RENDER_TYPES: Set<string>
export const TASK_STATUSES: readonly ['todo', 'doing', 'done', 'archived']

export type BriefingSectionSeed = {
  id?: string
  type?: string
  title?: string
  enabled?: boolean
  render?: string
  params?: Record<string, unknown>
}

export function defaultSchedule(): { at: string; days: number[]; onOpen: boolean; tz: string }

export function defaultSections(): BriefingSectionSeed[]

export function sourcesFromMcpSections(sections: unknown): { type: 'mcp'; server: string }[]

export function gateSectionEnabled(section: unknown): unknown

export function prepareDefinitionSections(sections: unknown): unknown[]

export function defaultSources(): { type: 'mcp'; server: string }[]

export function briefingAllowServerNames(sections: unknown): string[]

export function briefingConnectedServerNames(names: unknown): string[]

export function mcpSectionFromConnectedPick(
  server: unknown,
  tool: unknown,
): {
  type: 'mcp'
  title: string
  enabled: true
  render: 'digest'
  params: { server: string; tool: string; summarize: true }
} | null
