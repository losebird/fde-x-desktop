/** BFF liveness: listening only. No DSH / semantic / IM. */

export const LIVE_PATH = '/live'

export const LIVE_PROBE_MS = 1000

export function liveProbeBody() {
  return { service: 'fde-x-runtime', live: true }
}

export function combineAbortSignal(parent, timeoutMs = LIVE_PROBE_MS) {
  const timeout = AbortSignal.timeout(timeoutMs)
  if (!parent) return timeout
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([parent, timeout])
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (parent.aborted || timeout.aborted) {
    abort()
    return controller.signal
  }
  parent.addEventListener('abort', abort, { once: true })
  timeout.addEventListener('abort', abort, { once: true })
  return controller.signal
}

export async function probeRuntimeLive(url, signal, timeoutMs = LIVE_PROBE_MS) {
  try {
    const response = await fetch(url, { method: 'GET', signal: combineAbortSignal(signal, timeoutMs) })
    return response.ok
  } catch {
    return false
  }
}

export function withProbeTimeout(promise, timeoutMs = LIVE_PROBE_MS) {
  let timer
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('live-probe-timeout')), timeoutMs)
    }),
  ])
}
