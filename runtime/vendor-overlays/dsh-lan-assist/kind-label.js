/**
 * Neutralize i18n template kind labels (e.g. {{t("…")}}) for vocab/graph matching.
 * @module dsh-lan-assist/kind-label
 */

const TEMPLATE_KIND = /\{\{\s*t\s*\(\s*["']([^"']+)["']\s*\)\s*\}\}/g

export function neutralizeKindLabel(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  const neutral = text.replace(TEMPLATE_KIND, (_, key) => String(key || '').trim()).trim()
  return neutral || text
}

export function kindLabelTokens(raw) {
  const text = String(raw || '').trim()
  if (!text) return []
  const out = new Set()
  out.add(text)
  const neutral = neutralizeKindLabel(text)
  if (neutral) out.add(neutral)
  TEMPLATE_KIND.lastIndex = 0
  let match = TEMPLATE_KIND.exec(text)
  while (match) {
    const key = String(match[1] || '').trim()
    if (key) out.add(key)
    match = TEMPLATE_KIND.exec(text)
  }
  return [...out].filter((item) => item.length > 0)
}

export function kindLabelsMatch(a, b) {
  const left = String(a || '').trim()
  const right = String(b || '').trim()
  if (!left || !right) return false
  if (left === right) return true
  const A = new Set(kindLabelTokens(left))
  const B = new Set(kindLabelTokens(right))
  for (const token of A) {
    if (B.has(token)) return true
  }
  return false
}
