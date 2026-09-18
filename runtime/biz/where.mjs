/**
 * Normalize preview where clauses before lan-assist /preview.
 * Alias → gate-native terms; field label → schema key binding happens in lan-assist where-pass.
 */

import { normalizeAliasWhere } from '../vendor-overlays/dsh-lan-assist/where-pass.js'

/**
 * @param {unknown} raw
 * @returns {Array<Record<string, unknown>>}
 */
export function normalizePreviewWhere(raw) {
  return normalizeAliasWhere(raw)
}
