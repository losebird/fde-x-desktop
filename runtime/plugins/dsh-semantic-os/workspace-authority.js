import { realpathSync } from 'node:fs'

function canonical(cwd) {
  try { return realpathSync(String(cwd || '').trim()) } catch { return '' }
}

function headerOf(value) {
  return value && value.header ? value.header : value
}

export function createWorkspaceAuthority() {
  let sessions = null
  let persistence = null
  let persisted = new Set()
  let refreshedAt = 0
  let inflight = null

  function setSessions(value) {
    sessions = value || null
  }

  function setPersistence(value) {
    persistence = value || null
    persisted = new Set()
    refreshedAt = 0
  }

  async function refresh() {
    if (!persistence || typeof persistence.list !== 'function') return
    if (Date.now() - refreshedAt < 5000) return
    if (inflight) return inflight
    inflight = Promise.resolve(persistence.list()).then((headers) => {
      const next = new Set()
      for (const raw of Array.isArray(headers) ? headers : []) {
        const cwd = canonical(headerOf(raw)?.cwd)
        if (cwd) next.add(cwd)
      }
      persisted = next
      refreshedAt = Date.now()
    }).finally(() => { inflight = null })
    return inflight
  }

  async function allows(cwd) {
    const target = canonical(cwd)
    if (!target) return false
    if (sessions && typeof sessions.list === 'function') {
      for (const session of sessions.list()) {
        if (canonical(headerOf(session)?.cwd) === target) return true
      }
    }
    await refresh()
    return persisted.has(target)
  }

  return { allows, setSessions, setPersistence }
}
