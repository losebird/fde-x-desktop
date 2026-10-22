/**
 * Send seam. LAN today. A later relay must keep the same send(door, frame).
 * @module dsh-lan-assist/transport
 */

import { postFrame } from './lan.js'

export function createLanTransport(opts = {}) {
  const sendFrame = typeof opts.send === 'function' ? opts.send : postFrame
  return {
    name: 'lan',
    async send(door, frame, opts = {}) {
      return sendFrame(door, frame, opts)
    },
  }
}

export function createLanFirstTransport({ lan, relay } = {}) {
  const first = lan || createLanTransport()
  const next = relay && typeof relay.send === 'function' ? relay : null
  return {
    name: next ? 'lan-first' : 'lan',
    async send(door, frame, opts = {}) {
      const lanResult = await first.send(door, frame, opts)
      if (lanResult && lanResult.ok) return { ...lanResult, via: 'lan' }
      if (!next) return lanResult
      const relayed = await next.send(door, frame, opts)
      if (relayed && relayed.ok) return { ...relayed, via: 'relay' }
      return relayed || lanResult
    },
  }
}
