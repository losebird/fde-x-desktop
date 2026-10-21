/**
 * Cross-project bridge index at {DSH_HOME}/semantic-os/bridge/index.json
 * @module dsh-semantic-os/bridge
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { PLUGIN_VERSION } from './version.js'

export const BRIDGE_PROTOCOL = 1
export { PLUGIN_VERSION }

function home() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

export function bridgePath() {
  return join(home(), 'semantic-os', 'bridge', 'index.json')
}

async function load() {
  try {
    const raw = JSON.parse(await readFile(bridgePath(), 'utf8'))
    if (!raw || typeof raw !== 'object') return { protocol: BRIDGE_PROTOCOL, links: [] }
    const links = Array.isArray(raw.links) ? raw.links : []
    return { protocol: Number(raw.protocol) || BRIDGE_PROTOCOL, links }
  } catch {
    return { protocol: BRIDGE_PROTOCOL, links: [] }
  }
}

async function save(doc) {
  const path = bridgePath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  return doc
}

export async function listBridges(cwd) {
  const doc = await load()
  if (!cwd) return doc.links
  return doc.links.filter((row) => row.sourceCwd === cwd || row.targetCwd === cwd)
}

export function peerCwdOf(link, cwd) {
  const here = String(cwd || '')
  const src = String((link && link.sourceCwd) || '')
  const tgt = String((link && link.targetCwd) || '')
  if (src && src === here && tgt && tgt !== here) return tgt
  if (tgt && tgt === here && src && src !== here) return src
  return ''
}

export async function listBridgePeers(cwd) {
  const here = String(cwd || '')
  const peers = []
  const seen = new Set()
  for (const row of await listBridges(here)) {
    const peer = peerCwdOf(row, here)
    if (!peer || seen.has(peer)) continue
    seen.add(peer)
    peers.push(peer)
  }
  return peers
}

export async function createBridge(input) {
  const sourceCwd = String(input.sourceCwd || '')
  const targetCwd = String(input.targetCwd || '')
  const sourceNode = String(input.sourceNode || 'workspace')
  const targetNode = String(input.targetNode || 'workspace')
  const theirVersion = String(input.pluginVersion || PLUGIN_VERSION)
  if (!sourceCwd || !targetCwd) {
    return { ok: false, error: 'incomplete' }
  }
  if (theirVersion !== PLUGIN_VERSION) {
    return { ok: false, error: 'version_mismatch' }
  }
  const doc = await load()
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const row = {
    id,
    sourceCwd,
    targetCwd,
    sourceNode,
    targetNode,
    protocol: BRIDGE_PROTOCOL,
    pluginVersion: PLUGIN_VERSION,
  }
  doc.links.push(row)
  await save(doc)
  return { ok: true, link: row }
}

export async function deleteBridge(id, cwd) {
  const doc = await load()
  const next = doc.links.filter((row) => {
    if (row.id !== id) return true
    if (cwd && row.sourceCwd !== cwd && row.targetCwd !== cwd) return true
    return false
  })
  doc.links = next
  await save(doc)
  return { ok: true }
}
