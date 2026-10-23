export type BriefingPresentedItem = {
  text: string
  sub?: string
  href?: string | { panel?: string }
  ref?: string
}

export function unwrapMarkdownLink(text: unknown): { text: string; href: string }

export function presentBriefingItem(item: unknown): BriefingPresentedItem | null

export function digestItems(
  section: { items?: unknown; body?: unknown } | null | undefined,
  opts?: { limit?: number },
): BriefingPresentedItem[]

export function digestBeats(
  section: { items?: unknown; body?: unknown } | null | undefined,
): string[]
