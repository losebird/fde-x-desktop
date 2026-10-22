/**
 * Write slips for dsh-semantic-os to ingest.
 * Mail slips: send/recv archive, searchable 摘录, not a decision.
 * Adopt slips: human nod, category lan_adopt.
 * This plugin never reads the project graph. Missing dir is created.
 * A failed write must not block send, reply, or followup.
 * @module dsh-lan-assist/slips
 */

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { assistHome, dshHome } from './home.js'
import { replaceFile } from './disk.js'

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/
const IPV6 = /^[0-9a-f:]+$/i
const UNSTABLE = /^(anonymous-user-id|anonymous|localhost)$/i

export function slipsDir(home = dshHome()) {
  return join(assistHome(home), 'slips')
}

export function actorLooksUnstable(actor) {
  const raw = String(actor || '').trim()
  if (!raw) return true
  if (UNSTABLE.test(raw)) return true
  if (IPV4.test(raw)) return true
  if (raw.includes(':') && IPV6.test(raw)) return true
  return false
}

/**
 * @returns {{ ok: true, slip: object } | { ok: false, error: string }}
 */
export function buildAdoptSlip({ requestId, sessionId, actor, quote, toIds, adoptedAt }) {
  const id = String(requestId || '').trim()
  if (!id) return { ok: false, error: 'NO_REQUEST' }
  const who = String(actor || '').trim()
  if (actorLooksUnstable(who)) return { ok: false, error: 'BAD_ACTOR' }
  const body = String(quote || '').trim()
  if (!body) return { ok: false, error: 'NO_BODY' }
  return {
    ok: true,
    slip: {
      schemaVersion: 1,
      requestId: id,
      sessionId: String(sessionId || '').trim(),
      actor: who,
      quote: body,
      body,
      toIds: Array.isArray(toIds) ? toIds.map((row) => String(row || '').trim()).filter(Boolean) : [],
      adoptedAt: String(adoptedAt || '').trim() || new Date().toISOString(),
    },
  }
}

/**
 * Archive one sent or received turn. Not a decision. Node id will be mail:<id>.
 * @returns {{ ok: true, slip: object } | { ok: false, error: string }}
 */
export function buildMailSlip({ requestId, turn, sessionId, workspace, actor, quote, fromName, toIds, at }) {
  const req = String(requestId || '').trim()
  if (!req) return { ok: false, error: 'NO_REQUEST' }
  const who = String(actor || '').trim()
  if (actorLooksUnstable(who)) return { ok: false, error: 'BAD_ACTOR' }
  const body = String(quote || '').trim()
  if (!body) return { ok: false, error: 'NO_BODY' }
  const step = String(turn || 'send').trim() || 'send'
  const name = String(fromName || '').trim()
  const text = name && !body.startsWith('【') ? `【${name}】${body}` : body
  return {
    ok: true,
    slip: {
      schemaVersion: 1,
      kind: 'mail',
      id: `${req}.${step}`,
      requestId: req,
      turn: step,
      sessionId: String(sessionId || '').trim(),
      workspace: String(workspace || '').trim(),
      actor: who,
      fromName: name,
      quote: text,
      body: text,
      toIds: Array.isArray(toIds) ? toIds.map((row) => String(row || '').trim()).filter(Boolean) : [],
      at: String(at || '').trim() || new Date().toISOString(),
    },
  }
}

export async function writeSlip(slip, destDir) {
  if (!slip || !slip.requestId) return { ok: false, error: 'NO_REQUEST' }
  const dir = destDir || slipsDir()
  await mkdir(dir, { recursive: true })
  const key = String(slip.id || slip.requestId)
  const name = key.replace(/[^A-Za-z0-9._-]+/g, '_') + '.json'
  const dest = join(dir, name)
  await replaceFile(dest, `${JSON.stringify(slip, null, 2)}\n`)
  return { ok: true, path: dest }
}

export async function writeAdoptSlip(args, destDir) {
  const packed = buildAdoptSlip(args)
  if (!packed.ok) return packed
  try {
    return await writeSlip(packed.slip, destDir)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function writeMailSlip(args, destDir) {
  const packed = buildMailSlip(args)
  if (!packed.ok) return packed
  try {
    return await writeSlip(packed.slip, destDir)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
