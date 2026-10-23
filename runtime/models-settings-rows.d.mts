export type ModelRowFields = {
  id: string
  name: string
  contextWindow?: number
  maxTokens?: number
  reasoningEfforts?: unknown
  input?: string[]
}

export function modelCapacityFromDiscoverRow(row: unknown): { contextWindow?: number; maxTokens?: number }

export function sealCustomProviderModels(models: unknown): unknown[]

export function pickModelRowFields(row: unknown): ModelRowFields | null

export function fillModelRowGaps(current: ModelRowFields, candidate: unknown): ModelRowFields

export function alignModelRowsWithDiscover(models: unknown, discovered: unknown): ModelRowFields[]

export function mergeModelRows(existing: readonly unknown[], pickedCandidates: readonly unknown[]): ModelRowFields[]
