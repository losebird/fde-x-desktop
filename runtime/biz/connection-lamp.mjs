import { connectorCatalogPresent } from '../vendor-overlays/dsh-lan-assist/lookup.js'
import { updateBusinessConnectionStatusByProvider } from '../db.mjs'

/** Providers whose lamp follows lan-assist /state (same set as shared ws_personal seed). */
export const LAN_ASSIST_CONNECTION_PROVIDER = 'lan-assist'

export function lookupReadyFromLanAssistState(state) {
  const lookup = state?.lookup && typeof state.lookup === 'object' ? state.lookup : {}
  if (lookup.configured || lookup.hasToken) return true
  const baseUrl = String(lookup.baseUrl || '').trim()
  return Boolean(baseUrl)
}

export function businessKindsDescribedInLanAssistState(state) {
  if (!state || state.ok === false) return false
  if (String(state.catalogVersion || state.catalog_version || '').trim()) return true
  const direct = {
    kinds: state.kinds,
    maps: state.maps,
    collections: state.collections,
  }
  if (connectorCatalogPresent(direct)) return true
  const catalog = Array.isArray(state.catalog) ? state.catalog : []
  for (const row of catalog) {
    if (!row || typeof row !== 'object') continue
    if (connectorCatalogPresent({
      kinds: row.kinds,
      maps: row.maps,
      collections: row.collections,
    })) return true
  }
  if (Array.isArray(state.vocab) && connectorCatalogPresent({ kinds: state.vocab })) return true
  return false
}

export function lanAssistAdapterHealthy(state) {
  if (!state || state.ok === false) return false
  if (!lookupReadyFromLanAssistState(state)) return false
  return Boolean(state.capabilities?.connector)
}

export function desiredLanAssistConnectionStatus(state, { bizSucceeded = false } = {}) {
  const reachable = Boolean(state && state.ok !== false)
  if (!reachable) return 'pending'
  if (bizSucceeded) return 'connected'
  if (lanAssistAdapterHealthy(state)) return 'connected'
  if (lookupReadyFromLanAssistState(state) && businessKindsDescribedInLanAssistState(state)) {
    return 'connected'
  }
  return 'pending'
}

export function reconcileLanAssistConnectionLamp(db, state, opts = {}) {
  const status = desiredLanAssistConnectionStatus(state, opts)
  const reachable = Boolean(state && state.ok !== false)
  const lastHealth = reachable && status === 'connected'
    ? { state: 'ready', at: new Date().toISOString() }
    : reachable
      ? { state: 'detected', at: new Date().toISOString() }
      : { state: 'offline', at: new Date().toISOString() }
  return updateBusinessConnectionStatusByProvider(db, LAN_ASSIST_CONNECTION_PROVIDER, status, lastHealth)
}

export async function refreshLanAssistConnectionLamp(db, lanAssist, opts = {}) {
  let state = null
  try {
    state = await lanAssist('/state', { search: { sessionId: '' } })
  } catch {
    state = null
  }
  return reconcileLanAssistConnectionLamp(db, state, opts)
}
