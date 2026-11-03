import { DEFAULT_LAN_PORT, LAN_PROBE_MS } from './plugins/dsh-lan-assist/home.js'
import { localDoors, parseDoor } from './plugins/dsh-lan-assist/lan.js'

const EXTRA_PORTS = [9527, 9528, 18527, 18528, 19021, 19527]

export function ownLanPort(env = process.env) {
  const raw = Number(env.DSH_LAN_ASSIST_PORT || DEFAULT_LAN_PORT)
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_LAN_PORT
}

export function pairDoorCandidates({ skipDoors = [], ports = [], env = process.env } = {}) {
  const skip = new Set(skipDoors.map((door) => String(door || '').trim()).filter(Boolean))
  const own = ownLanPort(env)
  skip.add(`127.0.0.1:${own}`)
  skip.add(`[::1]:${own}`)
  for (const plate of localDoors(own)) skip.add(plate)
  const listed = ports.map(Number).filter((port) => port > 0 && port < 65536)
  const wanted = new Set(listed.length ? listed : [own, ...EXTRA_PORTS].filter((port) => port > 0 && port < 65536))
  const found = []
  const push = (door) => {
    const parsed = parseDoor(door)
    if (!parsed || skip.has(door) || found.includes(door)) return
    found.push(door)
  }
  for (const port of wanted) {
    push(`127.0.0.1:${port}`)
    for (const plate of localDoors(port)) push(plate)
  }
  return found
}

export async function probeLanWho(door, timeoutMs = 400, io = globalThis.fetch) {
  const parsed = parseDoor(door)
  if (!parsed) return null
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await io(`http://${parsed.host}:${parsed.port}/who`, { signal: ac.signal })
    const body = await res.json()
    if (!body || body.ok === false || body.service !== 'dsh-lan-assist') return null
    return { door, pairing: body.pairing === true, port: Number(body.port || parsed.port) }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function discoverPairDoors(opts = {}) {
  const candidates = pairDoorCandidates(opts)
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : Math.min(400, LAN_PROBE_MS)
  const found = []
  const pairing = []
  await Promise.all(candidates.map(async (door) => {
    const who = await probeLanWho(door, timeoutMs, opts.fetch)
    if (!who) return
    found.push(who.door)
    if (who.pairing) pairing.push(who.door)
  }))
  return pairing.length ? pairing : found
}

export const PAIR_DOOR_MISSING_HINT = '找不到对方。确认同一网络，或先接通中继后再填码。'
