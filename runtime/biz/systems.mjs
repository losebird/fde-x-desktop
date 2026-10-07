import { parseAppSkills } from './source.mjs'
import { resolveConnectedKind } from './connected-kind.mjs'

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const SLOTS = ['describe', 'list', 'write']
const NAME_RE = /^[A-Za-z0-9_-]{1,32}$/u

export function parseMcpTools(raw) {
  if (!isRecord(raw)) return { error: 'mcp 系统需要 tools.describe / tools.list' }
  const tools = {}
  for (const slot of SLOTS) {
    const value = raw[slot]
    if (slot === 'write' && (value == null || value === '')) continue
    const tool = String(value || '').trim()
    if (!tool) return { error: `${slot} 工具名必填` }
    tools[slot] = tool
  }
  if (!tools.describe || !tools.list) return { error: 'mcp 系统需要 describe 和 list' }
  return { tools }
}

export function parseBizSystem(raw) {
  if (!isRecord(raw)) return { error: '系统必须是对象' }
  const name = String(raw.name || '').trim()
  const serverName = String(raw.serverName || '').trim()
  if (!name) return { error: '系统名必填' }
  if (!NAME_RE.test(serverName)) return { error: 'serverName 无效' }
  const tools = parseMcpTools(raw.tools)
  if (tools.error) return { error: tools.error }
  const operateRaw = raw.operate && isRecord(raw.operate) ? raw.operate.skills : raw.skills
  const skills = parseAppSkills(operateRaw == null ? [] : operateRaw)
  if (skills.error) return { error: skills.error }
  const id = String(raw.id || '').trim()
  return {
    system: {
      ...(id ? { id } : {}),
      name,
      serverName,
      tools: tools.tools,
      ...(skills.skills.length ? { operate: { skills: skills.skills } } : {}),
    },
  }
}

export function parseLookupOperate(raw) {
  const source = isRecord(raw) ? raw : {}
  const skillsRaw = source.operate && isRecord(source.operate) ? source.operate.skills : source.skills
  const skills = parseAppSkills(skillsRaw == null ? [] : skillsRaw)
  if (skills.error) return { error: skills.error }
  return { lookup: { operate: { skills: skills.skills } } }
}

export function parseBizSystemsFile(raw) {
  const list = Array.isArray(raw)
    ? raw
    : isRecord(raw)
      ? (Array.isArray(raw.systems) ? raw.systems : [])
      : (raw == null ? [] : null)
  if (!list) return { error: '业务系统清单必须是数组' }
  if (list.length > 32) return { error: 'mcp 业务系统最多 32 条' }
  const lookup = parseLookupOperate(isRecord(raw) ? raw.lookup : {})
  if (lookup.error) return { error: lookup.error }
  const systems = []
  const seen = new Set()
  for (let i = 0; i < list.length; i += 1) {
    const parsed = parseBizSystem(list[i])
    if (parsed.error) return { error: `systems[${i}]: ${parsed.error}` }
    const row = parsed.system
    if (row.id) {
      if (seen.has(row.id)) return { error: `重复系统 id ${row.id}` }
      seen.add(row.id)
    }
    systems.push(row)
  }
  return { lookup: lookup.lookup, systems }
}

export function kindConnectionOf(row) {
  const raw = String(row?.connection || '').trim()
  if (!raw || raw === 'lookup') return { type: 'lookup' }
  return { type: 'mcp', systemId: raw }
}

export function skillsForOperate({ connection, spec } = {}) {
  const fromConn = connection && connection.operate && Array.isArray(connection.operate.skills)
    ? connection.operate.skills
    : []
  const fromSpec = spec && Array.isArray(spec.skills) ? spec.skills : []
  const parsed = parseAppSkills([...fromConn, ...fromSpec])
  return parsed.skills || []
}

export function enabledOperateSkills(bagItems, skills) {
  const want = Array.isArray(skills) ? skills : []
  const bag = Array.isArray(bagItems) ? bagItems : []
  const enabled = []
  for (const skill of want) {
    const name = String(skill?.name || '').trim()
    const path = String(skill?.path || '').trim()
    const row = bag.find((item) => {
      const fields = item?.fields && typeof item.fields === 'object' ? item.fields : item
      const rowName = String(fields?.name || item?.id || '').trim()
      const rowPath = String(fields?.path || fields?.bundleRoot || '').trim()
      return (path && rowPath === path) || (name && rowName === name)
    })
    const fields = row?.fields && typeof row.fields === 'object' ? row.fields : row
    if (!fields) {
      return { error: `袋里没有 ${name || path}`, code: 'skill_missing' }
    }
    if (fields.modelInvocable === false) {
      return { error: '未启用', code: 'skill_disabled', name }
    }
    enabled.push({ name: name || String(fields.name || ''), path: path || String(fields.path || '') })
  }
  return { skills: enabled }
}

export function assertKindOnConnection(vocab, kind, connectionId) {
  const name = String(kind || '').trim()
  if (!name) return { error: '词表没有该型', code: 'no_kind' }
  const kinds = Array.isArray(vocab?.kinds) ? vocab.kinds : []
  const resolved = resolveConnectedKind(name, kinds) || name
  const row = kinds.find((item) => String(item.kind || '').trim() === resolved)
  if (!row) return { error: '词表没有该型', code: 'no_kind' }
  const conn = kindConnectionOf(row)
  const want = String(connectionId || 'lookup').trim() || 'lookup'
  if (want === 'lookup') {
    if (conn.type !== 'lookup') return { error: '词表没有该型', code: 'no_kind' }
    return { kind: resolved, row, connection: conn }
  }
  if (conn.type !== 'mcp' || conn.systemId !== want) return { error: '词表没有该型', code: 'no_kind' }
  return { kind: resolved, row, connection: conn }
}

export function mcpSourceFromSystem(system) {
  if (!system || !system.serverName || !system.tools) return null
  const serverName = system.serverName
  const tools = system.tools
  return {
    type: 'mcp',
    serverName,
    describe: { via: 'mcp', serverName, tool: tools.describe },
    list: { via: 'mcp', serverName, tool: tools.list },
    ...(tools.write ? { write: { via: 'mcp', serverName, tool: tools.write } } : {}),
  }
}
