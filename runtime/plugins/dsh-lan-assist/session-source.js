/**
 * Native V4 occupancy message source. Never writes kind: 'plugin'.
 * @module dsh-lan-assist/session-source
 */

export function occupancyWriteSource(pluginId) {
  const kind = String(pluginId || '').trim()
  if (!kind || kind === 'plugin') {
    throw new Error('occupancy message source requires a producer-owned kind')
  }
  return { kind }
}

export function occupancyLiftSource(source, pluginId) {
  if (!source || typeof source !== 'object') return null
  const kind = String(source.kind || '').trim()
  const plugin = String(source.plugin || '').trim()
  const mine = String(pluginId || '').trim()
  if (kind && kind !== 'plugin') {
    const next = { ...source, kind }
    delete next.plugin
    return next
  }
  if (kind === 'plugin' && plugin && mine && plugin === mine) {
    const next = { ...source, kind: mine }
    delete next.plugin
    return next
  }
  return null
}
