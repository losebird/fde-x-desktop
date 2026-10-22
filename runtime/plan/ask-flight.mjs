export function createAskFlight() {
  let generation = 0
  let active = null
  return {
    begin() {
      if (active) active.cancel()
      generation += 1
      const id = generation
      const controller = new AbortController()
      const ticket = {
        generation: id,
        signal: controller.signal,
        cancel() {
          controller.abort()
        },
      }
      active = ticket
      return ticket
    },
    accept(id, result) {
      if (id !== generation) return { ok: false, error: 'stale', discarded: true }
      return result
    },
    cancelActive() {
      if (active) active.cancel()
    },
  }
}

export function settleAskWait(signal, work) {
  if (signal?.aborted) return Promise.resolve({ ok: false, error: 'cancelled' })
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      if (signal) signal.removeEventListener('abort', onAbort)
      resolve(value)
    }
    const onAbort = () => finish({ ok: false, error: 'cancelled' })
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
    Promise.resolve()
      .then(() => {
        if (signal?.aborted) return undefined
        return work()
      })
      .then((value) => {
        if (signal?.aborted) finish({ ok: false, error: 'cancelled' })
        else finish({ ok: true, value })
      })
      .catch((error) => {
        if (signal?.aborted) finish({ ok: false, error: 'cancelled' })
        else finish({ ok: false, error: error instanceof Error ? error.message : 'failed' })
      })
  })
}
