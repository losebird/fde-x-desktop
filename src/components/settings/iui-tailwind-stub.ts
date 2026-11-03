/** FDE hang of IUI settings.section does not ship Tailwind 4; preview pages use IUI CSS. */
export const TAILWIND_SOURCE_CSS = ''

export function whenTailwindReady(): Promise<void> {
  return Promise.resolve()
}

export function isTailwindReady(): boolean {
  return false
}

export function reserveTailwindClasses(_css: string): void {}

export function tailwindCandidates(_source: string): string[] {
  return []
}

export function buildTailwindCss(_source: string): string {
  return ''
}

export function installTailwindHost(): void {}
