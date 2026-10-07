const bags = new Map<string, unknown>()

export function lastModuleBag<T>(kind: string): T | null {
  const key = String(kind || '').trim()
  if (!key || !bags.has(key)) return null
  return bags.get(key) as T
}

export function rememberModuleBag(kind: string, data: unknown) {
  const key = String(kind || '').trim()
  if (!key) return
  bags.set(key, data)
}
