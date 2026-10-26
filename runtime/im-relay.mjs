/** Public IM relay occupancy. Machine transport, not a colleague. */

export function publicImRelay(state) {
  const row = state && typeof state.relay === 'object' && state.relay ? state.relay : {}
  return {
    configured: Boolean(state?.relayConfigured ?? row.configured),
    connected: Boolean(state?.relayConnected ?? row.connected),
    url: String(state?.relayUrl || row.url || '').trim(),
    credsSet: Boolean(state?.relayCredsSet ?? row.credsSet),
    env: Boolean(state?.relayEnv ?? row.env),
    error: String(row.error || state?.relayError || '').trim(),
  }
}
