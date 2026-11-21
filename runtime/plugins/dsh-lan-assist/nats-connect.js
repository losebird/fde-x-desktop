/**
 * Pick TCP (`nats`) or WebSocket (`nats.ws`) from the server URL.
 * Node nats@2.x only dials TCP; Funnel/wss needs nats.ws + Node's WebSocket.
 * WebSocket constructors choke on userinfo, so tokens come off the URL first.
 */
export function natsUsesWebSocket(url) {
  return /^(ws|wss):\/\//i.test(String(url || '').trim())
}

export function splitNatsServer(raw) {
  const url = String(raw || '').trim()
  if (!url) return { servers: '' }
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return { servers: url }
  }
  const user = decodeURIComponent(parsed.username || '')
  const pass = decodeURIComponent(parsed.password || '')
  parsed.username = ''
  parsed.password = ''
  const servers = parsed.toString()
  if (!user && pass) return { servers, token: pass }
  if (user || pass) return { servers, user, pass }
  return { servers }
}

export function natsModuleSpec(url) {
  return natsUsesWebSocket(url) ? 'nats.ws' : 'nats'
}

export async function loadNatsModule(url, importModule) {
  const spec = natsModuleSpec(url)
  const load = typeof importModule === 'function' ? importModule : ((name) => import(name))
  let mod
  try {
    mod = await load(spec)
  } catch {
    const error = new Error(spec === 'nats.ws' ? 'NATS_WS_MISSING' : 'NATS_DEPENDENCY_MISSING')
    error.code = spec === 'nats.ws' ? 'NATS_WS_MISSING' : 'NATS_DEPENDENCY_MISSING'
    throw error
  }
  if (!mod || typeof mod.connect !== 'function') {
    const error = new Error(spec === 'nats.ws' ? 'NATS_WS_MISSING' : 'NATS_DEPENDENCY_MISSING')
    error.code = spec === 'nats.ws' ? 'NATS_WS_MISSING' : 'NATS_DEPENDENCY_MISSING'
    throw error
  }
  return { mod, spec }
}

export async function connectNats(conf = {}, opts = {}) {
  const url = String((conf && conf.servers) || opts.url || '').trim()
  const split = splitNatsServer(url)
  const { mod, spec } = await loadNatsModule(split.servers || url, opts.importModule)
  const next = { ...conf, servers: split.servers || url }
  if (split.token && next.token == null) next.token = split.token
  if (split.user && next.user == null) next.user = split.user
  if (split.pass && next.pass == null) next.pass = split.pass
  if (next.timeout == null) next.timeout = 8000
  if (next.creds && typeof mod.credsAuthenticator === 'function') {
    next.authenticator = mod.credsAuthenticator(next.creds)
    delete next.creds
  }
  const client = await mod.connect(next)
  return { client, spec, servers: next.servers }
}
