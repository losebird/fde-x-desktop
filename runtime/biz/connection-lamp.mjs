import { updateBusinessConnectionStatusByProvider } from '../db.mjs'
import { vocabHasKinds } from './vocab-sheet.mjs'

/** Providers whose lamp follows lan-assist /state (same set as shared ws_personal seed). */
export const LAN_ASSIST_CONNECTION_PROVIDER = 'lan-assist'

export function lookupReadyFromLanAssistState(state) {
  const lookup = state?.lookup && typeof state.lookup === 'object' ? state.lookup : {}
  if (lookup.configured || lookup.hasToken) return true
  const baseUrl = String(lookup.baseUrl || '').trim()
  return Boolean(baseUrl)
}

export function lanAssistAdapterHealthy(state) {
  if (!state || state.ok === false) return false
  if (!lookupReadyFromLanAssistState(state)) return false
  return Boolean(state.capabilities?.connector)
}

export function desiredLanAssistConnectionStatus(state, { bizSucceeded = false, vocab } = {}) {
  const reachable = Boolean(state && state.ok !== false)
  if (!reachable) return 'pending'
  if (bizSucceeded) return 'connected'
  if (lanAssistAdapterHealthy(state)) return 'connected'
  if (lookupReadyFromLanAssistState(state) && vocabHasKinds(vocab)) {
    return 'connected'
  }
  return 'pending'
}

/** Same «can work now» signal as business_connections lamp → GET /health im-business-adapter. */
export function imBusinessAdapterHealthFromState(state, { capabilityDetail = '', vocab } = {}) {
  const prefix = String(capabilityDetail || '').trim() || 'IM 与业务系统操作能力'
  if (desiredLanAssistConnectionStatus(state, { vocab }) === 'connected') {
    return {
      state: 'healthy',
      detail: `${prefix}；当前可执行业务操作`,
    }
  }
  if (!state || state.ok === false) {
    return {
      state: 'degraded',
      detail: `${prefix}；适配进程未响应或离线`,
    }
  }
  if (!lookupReadyFromLanAssistState(state)) {
    return {
      state: 'degraded',
      detail: `${prefix}；连接凭据尚未配置完整`,
    }
  }
  return {
    state: 'degraded',
    detail: `${prefix}；业务目录尚未就绪`,
  }
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
