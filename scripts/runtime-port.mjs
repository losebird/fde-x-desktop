import { createConnection } from 'node:net'
import { FDE_RUNTIME_HOST, FDE_RUNTIME_PORT } from '../runtime/config.mjs'

/** TCP connect probe — same semantics as scripts/dev.mjs supervision. */
export function runtimePortOpen(port = FDE_RUNTIME_PORT, host = FDE_RUNTIME_HOST, timeoutMs = 400) {
  return new Promise((resolveOpen) => {
    const socket = createConnection({ port, host })
    const timer = setTimeout(() => {
      socket.destroy()
      resolveOpen(false)
    }, timeoutMs)
    socket.once('connect', () => {
      clearTimeout(timer)
      socket.end()
      resolveOpen(true)
    })
    socket.once('error', () => {
      clearTimeout(timer)
      socket.destroy()
      resolveOpen(false)
    })
  })
}
