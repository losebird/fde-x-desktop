/**
 * Separate LAN listener. Never the official /api. Auth every frame with
 * the pairing key except the first hello (pairing codes).
 * @module dsh-lan-assist/lan
 */

import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { BODY_MAX_BYTES, DEFAULT_LAN_PORT } from './home.js'

/**
 * @param {{
 *   port?: number,
 *   host?: string,
 *   onFrame: (frame: Record<string, unknown>, meta: { remote: string }) => Promise<Record<string, unknown>>,
 * }} opts
 */
export function createLanServer(opts) {
  const port = Number(opts.port || DEFAULT_LAN_PORT)
  const host = opts.host || '0.0.0.0'
  const onFrame = opts.onFrame
  let server = null

  async function handle(req, res) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    if (req.method === 'GET' && (req.url === '/' || req.url === '/who')) {
      json(res, 200, { ok: true, service: 'dsh-lan-assist', port })
      return
    }
    if (req.method !== 'POST' || req.url !== '/frame') {
      json(res, 404, { ok: false, error: 'NOT_FOUND' })
      return
    }
    let body
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      json(res, 400, { ok: false, error: 'BAD_JSON' })
      return
    }
    const remote = String((req.socket && req.socket.remoteAddress) || '')
    try {
      const result = await onFrame(body, { remote })
      json(res, result && result.ok === false && result.error === 'KEY_REJECT' ? 403 : 200, result || { ok: false })
    } catch (error) {
      json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  return {
    port,
    host,
    doors() {
      return localDoors(port)
    },
    async start() {
      if (server) return
      server = createServer(handle)
      await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, host, () => {
          server.off('error', reject)
          resolve()
        })
      })
    },
    async stop() {
      const current = server
      server = null
      if (!current) return
      await new Promise((resolve) => current.close(() => resolve()))
    },
  }
}

/**
 * @param {string} door host:port
 * @param {Record<string, unknown>} frame
 */
export async function postFrame(door, frame, opts = {}) {
  const parsed = parseDoor(door)
  if (!parsed) return { ok: false, error: 'BAD_DOOR' }
  const timeoutMs = Number(opts && typeof opts === 'object' ? opts.timeoutMs : opts)
  const wait = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60_000
  const payload = JSON.stringify(frame)
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), wait)
  try {
    const res = await fetch(`http://${parsed.host}:${parsed.port}/frame`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      signal: ac.signal,
    })
    const text = await res.text()
    try {
      return JSON.parse(text)
    } catch {
      return { ok: false, error: 'BAD_PEER_JSON' }
    }
  } catch (error) {
    const name = error && error.name
    if (name === 'AbortError') return { ok: false, error: 'TIMEOUT' }
    return { ok: false, error: 'UNREACHABLE' }
  } finally {
    clearTimeout(timer)
  }
}

export function guessPeerDoor(remote, claimed, port) {
  const plate = String(claimed || '')
  const host = plate.split(':')[0]
  const usable = host && host !== 'local' && host !== '0.0.0.0' && host !== '*'
  if (usable && plate.includes(':')) return plate
  const ip = String(remote || '').replace(/^::ffff:/, '')
  if (ip === '::1') return `127.0.0.1:${port}`
  if (ip) return `${ip}:${port}`
  return usable ? plate : `127.0.0.1:${port}`
}

export function parseDoor(door) {
  const raw = String(door || '').trim()
  const match = raw.match(/^\[?([a-zA-Z0-9._:-]+)\]?:(\d{2,5})$/)
  if (!match) return null
  const host = match[1]
  const port = Number(match[2])
  if (!port || port > 65535) return null
  return { host, port }
}

export function hostOfDoor(door) {
  const parsed = parseDoor(door)
  return parsed ? parsed.host : String(door || '').split(':')[0]
}

/**
 * Same /24 private segment. Guest Wi-Fi usually hands another 192.168.x.
 */
export function sameLanSegment(a, b) {
  const left = hostOfDoor(a).replace(/^::ffff:/, '')
  const right = hostOfDoor(b).replace(/^::ffff:/, '')
  if (!isPrivateIpv4(left) || !isPrivateIpv4(right)) return false
  const a3 = left.split('.').slice(0, 3).join('.')
  const b3 = right.split('.').slice(0, 3).join('.')
  return a3 === b3
}

export function isPrivateIpv4(ip) {
  const parts = String(ip || '').split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  if (parts[0] === 10) return true
  if (parts[0] === 127) return true
  if (parts[0] === 192 && parts[1] === 168) return true
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  if (parts[0] === 169 && parts[1] === 254) return true
  return false
}

export function localDoors(port = DEFAULT_LAN_PORT) {
  const found = []
  const nets = networkInterfaces()
  for (const list of Object.values(nets || {})) {
    for (const item of list || []) {
      if (item.internal) continue
      if (item.family !== 'IPv4' && item.family !== 4) continue
      found.push(`${item.address}:${port}`)
    }
  }
  if (!found.length) found.push(`127.0.0.1:${port}`)
  return found
}

export function publicDoors(port = DEFAULT_LAN_PORT) {
  return localDoors(port).filter((door) => {
    const parsed = parseDoor(door)
    return parsed && !isPrivateIpv4(parsed.host)
  })
}

function json(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let n = 0
    req.on('data', (chunk) => {
      n += chunk.length
      if (n > BODY_MAX_BYTES) {
        reject(new Error('TOO_LARGE'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
