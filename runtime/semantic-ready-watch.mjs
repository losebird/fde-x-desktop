import { emit } from './events.mjs'
import { withProbeTimeout } from './live-probe.mjs'
import { ENGINE_PROBE_MS, ENGINE_WATCH_MS, engineOccupancyFp, engineProbeKind } from './engine-probe.mjs'
import { llmFingerprint, readLlmOccupancySync, writeLlmOccupancy } from './dsh-default-llm.mjs'

export function startSemanticReadyWatch(deps) {
  const semanticOs = deps && deps.semanticOs
  const kick = deps && deps.kick
  const readHostLlm = deps && deps.readHostLlm
  const dshHome = deps && deps.dshHome
  const probeMs = Number(deps && deps.probeMs) > 0 ? Number(deps.probeMs) : ENGINE_PROBE_MS
  const watchMs = Number(deps && deps.watchMs) > 0 ? Number(deps.watchMs) : ENGINE_WATCH_MS
  if (typeof semanticOs !== 'function') return () => {}
  let last = ''
  let lastSpawned = ''
  let ticking = false

  const tick = async () => {
    if (ticking) return
    ticking = true
    let result = null
    let failed = false
    try {
      const got = await withProbeTimeout(semanticOs('/ready', { method: 'GET' }), probeMs)
      if (got && typeof got === 'object') result = got
      else failed = true
    } catch {
      failed = true
      result = null
    }
    const kind = engineProbeKind(result, failed)
    ticking = false
    if (kind === 'probe-failed') return
    if (kind === 'unready' && typeof kick === 'function') kick(result)
    if (typeof readHostLlm === 'function') {
      try {
        const host = await readHostLlm()
        if (host) {
          result = {
            ...result,
            llmProvider: host.dshProvider || result.llmProvider,
            llmModel: host.model || result.llmModel,
            llmReady: Boolean(host.configured || result.llmReady),
          }
        }
        if (dshHome && host && host.dshProvider) {
          await writeLlmOccupancy(dshHome, host)
          const hostFp = llmFingerprint(host)
          const spawned = String((readLlmOccupancySync(dshHome) || {}).spawnedFp || lastSpawned || '')
          if (kind === 'ready' && hostFp && hostFp !== spawned) {
            lastSpawned = hostFp
            await writeLlmOccupancy(dshHome, { ...host, spawnedFp: hostFp })
            await semanticOs('/retry-ready', { method: 'POST', body: {} })
          }
        }
      } catch {
        /* host llm occupancy stays */
      }
    }
    const fp = engineOccupancyFp(kind, result)
    if (!fp || fp === last) return
    last = fp
    emit('memory.engine.changed', result, { source: 'bff' })
  }

  void tick()
  const timer = setInterval(() => { void tick() }, watchMs)
  return () => clearInterval(timer)
}
