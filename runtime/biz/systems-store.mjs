import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { profileCordisPatchPath } from '../mcp-archive.mjs'
import { collectBag } from '../catalog-collect.mjs'
import { resolvePrimarySessionForRuntime } from '../session-primary.mjs'
import { enabledOperateSkills, parseBizSystem, parseBizSystemsFile, parseLookupOperate, skillsForOperate } from './systems.mjs'
import { parseWorkspaceSource } from './source.mjs'
import { listWorkspaces, patchWorkspaceMetadata } from '../db.mjs'

function newSystemId() {
  return `sys_${randomBytes(6).toString('hex')}`
}

export function bizSystemsPath(aiRuntime) {
  const patch = profileCordisPatchPath(aiRuntime)
  if (!patch) return ''
  return join(patch, '..', 'biz-systems.json')
}

function emptyProfile() {
  return { lookup: { operate: { skills: [] } }, systems: [] }
}

export async function readBizSystems(aiRuntime) {
  const file = bizSystemsPath(aiRuntime)
  if (!file) return emptyProfile()
  let text = ''
  try {
    text = await readFile(file, 'utf8')
  } catch {
    return emptyProfile()
  }
  if (!String(text).trim()) return emptyProfile()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: '业务系统档案不是 JSON', ...emptyProfile() }
  }
  const listed = parseBizSystemsFile(parsed)
  if (listed.error) return { error: listed.error, ...emptyProfile() }
  return { lookup: listed.lookup, systems: listed.systems }
}

export async function writeBizProfile(aiRuntime, profile) {
  const file = bizSystemsPath(aiRuntime)
  if (!file) return { error: '缺少 profile 路径', code: 'missing_profile' }
  const listed = parseBizSystemsFile({
    lookup: profile?.lookup,
    systems: Array.isArray(profile?.systems) ? profile.systems : [],
  })
  if (listed.error) return { error: listed.error, code: 'validation_error' }
  const rows = listed.systems.map((row) => ({
    ...row,
    id: row.id || newSystemId(),
  }))
  const next = { lookup: listed.lookup, systems: rows }
  await mkdir(join(file, '..'), { recursive: true })
  await writeFile(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}

export async function writeBizSystems(aiRuntime, systems) {
  const current = await readBizSystems(aiRuntime)
  if (current.error) return current
  return writeBizProfile(aiRuntime, { lookup: current.lookup, systems })
}

export async function writeLookupOperate(aiRuntime, skills) {
  const parsed = parseLookupOperate({ operate: { skills } })
  if (parsed.error) return { error: parsed.error, code: 'validation_error' }
  const current = await readBizSystems(aiRuntime)
  if (current.error) return current
  return writeBizProfile(aiRuntime, { lookup: parsed.lookup, systems: current.systems })
}

export async function upsertBizSystem(aiRuntime, raw) {
  const parsed = parseBizSystem(raw)
  if (parsed.error) return { error: parsed.error, code: 'validation_error' }
  const current = await readBizSystems(aiRuntime)
  if (current.error) return current
  const next = parsed.system
  if (!next.id) next.id = newSystemId()
  const systems = [...current.systems]
  const index = systems.findIndex((row) => row.id === next.id)
  if (index >= 0) systems[index] = next
  else systems.push(next)
  return writeBizProfile(aiRuntime, { lookup: current.lookup, systems })
}

export async function deleteBizSystem(aiRuntime, systemId) {
  const id = String(systemId || '').trim()
  if (!id) return { error: '缺少系统 id', code: 'validation_error' }
  const current = await readBizSystems(aiRuntime)
  if (current.error) return current
  return writeBizProfile(aiRuntime, {
    lookup: current.lookup,
    systems: current.systems.filter((row) => row.id !== id),
  })
}

export async function resolveOperateSkills(aiRuntime, spec, cwd) {
  const listed = await readBizSystems(aiRuntime)
  if (listed.error) return listed
  let connection = listed.lookup
  const sourceType = spec?.source?.type
  if (sourceType === 'local') connection = { operate: { skills: [] } }
  if (sourceType === 'system') {
    const systemId = String(spec.source.systemId || '').trim()
    connection = listed.systems.find((row) => row.id === systemId) || null
    if (!connection) return { error: '找不到该业务系统', code: 'no_system' }
  }
  const merged = skillsForOperate({ connection, spec })
  if (!merged.length) return { skills: [] }
  const sessionId = await resolvePrimarySessionForRuntime(aiRuntime, { cwd })
  if (!sessionId) return { error: '没有可用的 AI 会话', code: 'no_session' }
  const bag = await collectBag(aiRuntime, 'skill', { sessionId, cwd })
  return enabledOperateSkills(bag.items, merged)
}

export async function findBizSystem(aiRuntime, systemId) {
  const id = String(systemId || '').trim()
  const current = await readBizSystems(aiRuntime)
  if (current.error) return current
  return { system: current.systems.find((row) => row.id === id) || null, systems: current.systems }
}

/**
 * One-shot: cwd metadata.bizSource bound → profile mcp 系统，然后清掉 bizSource。
 */
export async function migrateBoundWorkspaceSources(db, aiRuntime) {
  if (!db) return { migrated: 0 }
  const current = await readBizSystems(aiRuntime)
  if (current.error) return current
  const systems = [...current.systems]
  let migrated = 0
  const rows = listWorkspaces(db)
  for (const row of Array.isArray(rows) ? rows : []) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    if (!meta.bizSource) continue
    const parsed = parseWorkspaceSource(meta.bizSource)
    if (parsed.source?.type === 'bound') {
      const describe = parsed.source.describe
      const list = parsed.source.list
      const write = parsed.source.write
      const skillHandles = [describe, list, write].filter((handle) => handle?.via === 'skill')
      const mcpHandles = [describe, list, write].filter((handle) => handle?.via === 'mcp')
      const serverName = mcpHandles[0]?.serverName
      const sameServer = serverName && mcpHandles.every((handle) => handle.serverName === serverName)
      if (sameServer && describe?.via === 'mcp' && list?.via === 'mcp') {
        const already = systems.find((sys) => (
          sys.serverName === serverName
          && sys.tools.describe === describe.tool
          && sys.tools.list === list.tool
        ))
        if (!already) {
          const operateSkills = skillHandles.map((handle) => ({ name: handle.name, path: handle.path }))
          systems.push({
            id: newSystemId(),
            name: serverName,
            serverName,
            tools: {
              describe: describe.tool,
              list: list.tool,
              ...(write?.via === 'mcp' ? { write: write.tool } : {}),
            },
            ...(operateSkills.length ? { operate: { skills: operateSkills } } : {}),
          })
          migrated += 1
        }
      }
    }
    patchWorkspaceMetadata(db, row.id, { bizSource: null })
  }
  if (migrated) await writeBizSystems(aiRuntime, systems)
  return { migrated, systems }
}
