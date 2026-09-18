/**
 * Production vocab is workspace-owned. Package seed is not loaded here.
 * @module dsh-lan-assist/vocab/spoken
 */

export function ensureSpoken(vocab) {
  return Array.isArray(vocab) ? vocab.slice() : []
}
