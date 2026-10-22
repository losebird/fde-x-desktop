/**
 * Duty speak only. Roster is not a pairing key.
 * @module dsh-lan-assist/duty
 */

import { refLabel } from './ref.js'

/**
 * @param {{
 *   who?: string,
 *   reason?: 'role' | 'shift' | 'away' | 'sod' | 'threshold',
 *   paired?: boolean,
 *   ref?: { kind?: string, no?: string } | null,
 * }} spec
 */
export function speakDuty(spec = {}) {
  const who = String(spec.who || '').trim() || '该岗的人'
  const label = refLabel(spec.ref)
  const ticket = label ? `这单${label}` : '这单'
  if (spec.paired === false) {
    return `${ticket}按岗位该${who}，但没配对。花名册不能代替配对，不能按岗群发。`
  }
  if (spec.reason === 'sod') {
    return `${ticket}提单人不能过自己的单，要不要转${who}。只开口，不算审批。`
  }
  if (spec.reason === 'threshold') {
    return `${ticket}过了金额阈，要不要转${who}。只开口，不算审批。`
  }
  if (spec.reason === 'away') {
    return `${ticket}按外出该${who}，要不要转。花名册不能代替配对。`
  }
  if (spec.reason === 'shift') {
    return `${ticket}按值班该${who}，要不要转。花名册不能代替配对。`
  }
  return `${ticket}按岗位该${who}，要不要转。花名册不能代替配对。`
}

/**
 * Backup payload: mailbox speak + identity refs. Never keys.
 * @param {Record<string, unknown>} state
 */
export function packBackup(state) {
  const peers = Object.values((state && state.peers) || {})
  return {
    kind: 'lan-assist-mailbox',
    version: 1,
    refs: peers
      .filter((peer) => peer && peer.id && !peer.unpaired)
      .map((peer) => ({
        id: peer.id,
        displayName: peer.displayName || '',
        staffId: peer.staffId || '',
      })),
    ledger: ((state && state.ledger) || []).map((row) => ({ at: row.at, text: row.text })),
    requests: Object.values((state && state.requests) || {}).map((req) => ({
      id: req.id,
      kind: req.kind,
      status: req.status,
      workspace: req.workspace || '',
      ref: req.ref && req.ref.no ? { kind: req.ref.kind || '单据', no: req.ref.no } : null,
    })),
  }
}
