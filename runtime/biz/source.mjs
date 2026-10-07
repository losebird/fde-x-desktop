export const APP_SOURCE_TYPES = new Set(['local', 'lookup', 'system'])
export const SLOTS = ['describe', 'list', 'write']

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseAppSkills(raw) {
  if (raw == null) return { skills: [] }
  if (!Array.isArray(raw)) return { error: 'skills 必须是数组' }
  if (raw.length > 32) return { error: 'skills 最多 32 项' }
  const skills = []
  const seen = new Set()
  for (let i = 0; i < raw.length; i += 1) {
    const row = raw[i]
    if (!isRecord(row)) return { error: `skills[${i}] 必须是对象` }
    const name = String(row.name || '').trim()
    const path = String(row.path || '').trim()
    if (!name) return { error: `skills[${i}].name 必填` }
    if (!path.startsWith('/')) return { error: `skills[${i}].path 须为绝对路径` }
    const key = `${name}\0${path}`
    if (seen.has(key)) continue
    seen.add(key)
    skills.push({ name, path })
  }
  return { skills }
}

export function parseAppSource(raw) {
  if (raw == null || raw === '') return { source: { type: 'local' } }
  if (!isRecord(raw)) return { error: 'source 必须是对象' }
  const type = String(raw.type || '').trim()
  if (!APP_SOURCE_TYPES.has(type)) return { error: 'source.type 须为 local、lookup 或 system' }
  if (type === 'local') return { source: { type: 'local' } }
  if (type === 'lookup' || type === 'workspace') return { source: { type: 'lookup' } }
  const systemId = String(raw.systemId || '').trim()
  if (!systemId) return { error: 'source.systemId 必填' }
  return { source: { type: 'system', systemId } }
}

export function recordsViaMcp(spec) {
  return spec?.source?.type === 'system'
}

export function slotHandle(source, slot) {
  if (!source || source.type !== 'mcp') return null
  const handle = source[slot]
  return handle && handle.via === 'mcp' ? handle : null
}

export function mcpToolLocalName(serverName, tool) {
  const name = String(tool || '').trim()
  const prefix = `mcp__${String(serverName || '').trim()}__`
  if (prefix.length > 5 && name.startsWith(prefix)) return name.slice(prefix.length)
  return name
}

/** Migration-only parser for leftover workspace metadata.bizSource. */
export function parseWorkspaceSource(raw) {
  if (raw == null || raw === '') return { source: { type: 'lookup' } }
  if (!isRecord(raw)) return { error: '业务源必须是对象' }
  const type = String(raw.type || '').trim() || 'lookup'
  if (type === 'lookup') return { source: { type: 'lookup' } }
  if (type !== 'bound') return { error: '业务源 type 须为 lookup 或 bound' }
  const describe = raw.describe
  const list = raw.list
  const write = raw.write
  return {
    source: {
      type: 'bound',
      describe: isRecord(describe) ? describe : null,
      list: isRecord(list) ? list : null,
      ...(isRecord(write) ? { write } : {}),
    },
  }
}
