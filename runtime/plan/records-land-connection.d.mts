export function recordsLandConnectionId(input: {
  currentId?: string | null
  dataLand?: unknown
  connectionLand?: unknown
  landConnection?: string | null
  connections?: ReadonlyArray<{ name?: string; id?: string } | null | undefined> | null
}): string
