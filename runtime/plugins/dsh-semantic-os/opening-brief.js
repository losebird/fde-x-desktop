/**
 * Host cache for 开场工作记忆. Fail closed. Stale text may show until refresh.
 * @module dsh-semantic-os/opening-brief
 */

const DEFAULT_TTL_MS = 30_000

/** Cordis prompt sections treat `{{name}}` as variables; neutralize catalog i18n literals. */
export function neutralizePromptMustache(text) {
  return String(text || '')
    .replace(/\{\{/g, '{\u200b{')
    .replace(/\}\}/g, '}\u200b}')
}

export function createOpeningCache(opts = {}) {
  const ttl = Number(opts.ttlMs) > 0 ? Number(opts.ttlMs) : DEFAULT_TTL_MS
  const max = 800
  /** @type {Map<string, { at: number, text: string, pending: boolean }>} */
  const map = new Map()

  function peek(cwd) {
    const hit = map.get(String(cwd || ''))
    return hit && typeof hit.text === 'string' ? hit.text : ''
  }

  function forget(cwd) {
    const key = String(cwd || '')
    if (key) map.delete(key)
  }

  function openingText(cwd, { ready, fetchBrief } = {}) {
    const key = String(cwd || '').trim()
    if (!key) return ''
    const now = Date.now()
    const hit = map.get(key)
    if (hit && now - hit.at < ttl) return hit.text
    if (!ready) return hit && hit.text ? hit.text : ''
    if (hit && hit.pending) return hit.text || ''
    map.set(key, { at: hit ? hit.at : now, text: hit && hit.text ? hit.text : '', pending: true })
    Promise.resolve()
      .then(() => typeof fetchBrief === 'function' ? fetchBrief(key) : '')
      .then((raw) => {
        const text = neutralizePromptMustache(String(raw || '').trim())
        map.set(key, { at: Date.now(), text: text.length <= max ? text : '', pending: false })
      })
      .catch(() => {
        map.set(key, { at: Date.now(), text: hit && hit.text ? hit.text : '', pending: false })
      })
    return hit && hit.text ? hit.text : ''
  }

  function warmup(cwd, opts = {}) {
    return openingText(cwd, opts)
  }

  return { openingText, peek, forget, warmup }
}
